// In dev, use same origin (Vite proxies /api to backend). Else use env or default.
const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');

const MODEL_DIR = import.meta.env.VITE_PII_MODEL_DIR ?? '/src/lfm2-350m-merged-ONNX';
const TRANSFORMERS_WEB_MODULE =
  import.meta.env.VITE_TRANSFORMERS_WEB_MODULE ??
  '/@fs/root/TreeHacks-2026/backend/pii-model/node_modules/@huggingface/transformers/dist/transformers.web.js';

let generator = null;
let initPromise = null;
const sentenceEntitiesCache = new Map();
const sentenceEntitiesInFlight = new Map();
const MAX_SENTENCE_CACHE = 1200;

const redactorListeners = new Set();
const redactorState = {
  phase: 'idle',
  ready: false,
  message: 'PII model not initialized',
  engine: 'lfm2-webgpu-q4',
  error: null,
};

function getStatusSnapshot() {
  return { ...redactorState };
}

function setRedactorStatus(patch) {
  Object.assign(redactorState, patch);
  const next = getStatusSnapshot();
  for (const cb of redactorListeners) cb(next);
}

function splitBySentence(text) {
  return (text || '').match(/[^.!?\n]+[.!?]?|\n+/g) || [];
}

function normalizeLabel(label) {
  const upper = String(label || 'PII').toUpperCase();
  if (upper === 'PERSON' || upper === 'PER' || upper.includes('PERSON') || upper.includes('NAME')) return 'NAME';
  if (upper.includes('EMAIL')) return 'EMAIL';
  if (upper.includes('PHONE')) return 'PHONE';
  if (upper.includes('SSN')) return 'SSN';
  if (upper.includes('ADDRESS')) return 'ADDRESS';
  if (upper.includes('DATE') || upper.includes('DOB') || upper.includes('TIME')) return 'DATE';
  if (upper.includes('ID') || upper.includes('MRN') || upper.includes('NPI') || upper.includes('DEA')) return 'ID';
  return upper.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'PII';
}

function parseGeneratedText(output) {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.generated_text === 'string') return first.generated_text;
    if (first && typeof first.text === 'string') return first.text;
  }
  if (typeof output === 'string') return output;
  return '';
}

function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.text === 'string' && x.text.trim())
      .map((x) => ({ text: x.text.trim(), label: normalizeLabel(x.label) }));
  } catch {
    return [];
  }
}

function regexFallbackEntities(sentence) {
  const out = [];
  const patterns = [
    { label: 'EMAIL', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
    { label: 'PHONE', re: /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
    { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
    { label: 'DATE', re: /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g },
    { label: 'NAME', re: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g },
  ];

  for (const p of patterns) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(sentence)) !== null) {
      out.push({ text: m[0], label: p.label });
      if (p.re.lastIndex === m.index) p.re.lastIndex++;
    }
  }
  return out;
}

async function classifySentenceEntities(sentence) {
  const key = String(sentence || '');
  if (!key.trim()) return [];

  const cached = sentenceEntitiesCache.get(key);
  if (cached) return cached.map((x) => ({ ...x }));

  const inflight = sentenceEntitiesInFlight.get(key);
  if (inflight) {
    const result = await inflight;
    return result.map((x) => ({ ...x }));
  }

  const work = (async () => {
    if (!generator) return regexFallbackEntities(key);

    const prompt = `### Instruction:\ncensor: ${key}\n\n### Response:\n`;

    try {
      const output = await generator(prompt, {
        max_new_tokens: 220,
        do_sample: false,
        temperature: 0.0,
      });

      const generated = parseGeneratedText(output);
      const payload = generated.startsWith(prompt) ? generated.slice(prompt.length).trim() : generated.trim();
      const parsed = extractJsonArray(payload);
      if (parsed.length > 0) return parsed;
    } catch {
      // fall through to regex fallback
    }

    return regexFallbackEntities(key);
  })();

  sentenceEntitiesInFlight.set(key, work);
  try {
    const result = await work;
    sentenceEntitiesCache.set(key, result);
    if (sentenceEntitiesCache.size > MAX_SENTENCE_CACHE) {
      const first = sentenceEntitiesCache.keys().next().value;
      if (first !== undefined) sentenceEntitiesCache.delete(first);
    }
    return result.map((x) => ({ ...x }));
  } finally {
    sentenceEntitiesInFlight.delete(key);
  }
}

function entitiesToSentenceSpans(sentence, entities) {
  const spans = [];
  const seen = new Set();

  for (const ent of entities || []) {
    const text = String(ent.text || '').trim();
    if (!text) continue;
    const label = normalizeLabel(ent.label);
    const start = sentence.indexOf(text);
    if (start === -1) continue;
    const key = `${start}:${start + text.length}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spans.push({ start, end: start + text.length, text, label });
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const filtered = [];
  let cursor = -1;
  for (const s of spans) {
    if (s.start < cursor) continue;
    filtered.push(s);
    cursor = s.end;
  }

  return filtered;
}

function applyEntitiesToSentence(sentence, entities, labelCounts, placeholderMap) {
  const filtered = entitiesToSentenceSpans(sentence, entities);

  if (!filtered.length) return sentence;

  let out = '';
  let i = 0;
  for (const s of filtered) {
    out += sentence.slice(i, s.start);
    labelCounts[s.label] = (labelCounts[s.label] || 0) + 1;
    const token = `[${s.label}_${labelCounts[s.label]}]`;
    placeholderMap.set(token, s.text);
    out += token;
    i = s.end;
  }
  out += sentence.slice(i);
  return out;
}

async function redactTextBySentence(text) {
  console.log("Asked to redact: " + text)
  const chunks = splitBySentence(text);
  const labelCounts = {};
  const placeholderMap = new Map();
  const redactedChunks = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) {
      redactedChunks.push(chunk);
      continue;
    }

    console.log("Trying to classify: " + chunk)
    const entities = await classifySentenceEntities(chunk);
    console.log("Entities: " + JSON.stringify(entities))
    const redacted = applyEntitiesToSentence(chunk, entities, labelCounts, placeholderMap);
    redactedChunks.push(redacted);
  }

  return {
    redactedText: redactedChunks.join(''),
    placeholderMap,
  };
}

export async function getSensitiveSpans(text) {
  const input = text || '';
  const chunks = splitBySentence(input);
  const spans = [];
  let offset = 0;

  for (const chunk of chunks) {
    if (!chunk.trim()) {
      offset += chunk.length;
      continue;
    }

    const entities = await classifySentenceEntities(chunk);
    const localSpans = entitiesToSentenceSpans(chunk, entities);

    for (const s of localSpans) {
      spans.push({
        start: s.start + offset,
        end: s.end + offset,
        label: s.label,
      });
    }

    offset += chunk.length;
  }

  return spans;
}

function restorePlaceholders(text, placeholderMap) {
  let out = String(text ?? '');
  const entries = [...placeholderMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [token, original] of entries) {
    out = out.split(token).join(original);
  }
  return out;
}

function restoreInObject(value, placeholderMap) {
  if (typeof value === 'string') return restorePlaceholders(value, placeholderMap);
  if (Array.isArray(value)) return value.map((v) => restoreInObject(v, placeholderMap));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = restoreInObject(v, placeholderMap);
    return out;
  }
  return value;
}

async function redactThenCall(text, callFn) {
  const originalText = text || '';
  console.log('[PII Redaction] Pre-redaction text:', originalText);
  const { redactedText, placeholderMap } = await redactTextBySentence(originalText);
  console.log('[PII Redaction] Post-redaction text:', redactedText);
  const response = await callFn(redactedText);
  return restoreInObject(response, placeholderMap);
}

export async function validateSnippet(text, fast = true, role = 'patient') {
  return redactThenCall(text, async (redactedText) => {
    const res = await fetch(`${API_BASE}/api/clinical/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: redactedText, fast, role: role || 'patient' }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export async function chatComplete(transcript, fileContent = null) {
  return redactThenCall(transcript, async (redactedText) => {
    const res = await fetch(`${API_BASE}/api/chat/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: redactedText || '',
        file_content: fileContent || null,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export async function putSummary(sessionId, summary) {
  const res = await fetch(`${API_BASE}/api/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, summary }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSummary(sessionId) {
  const res = await fetch(`${API_BASE}/api/summary?session_id=${encodeURIComponent(sessionId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Persist stored summary to S3 and log to DDB (masked). Call after putSummary. */
export async function persistSummary(sessionId, patientId = null) {
  const res = await fetch(`${API_BASE}/api/summary/persist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, patient_id: patientId ?? undefined }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Analyze document for missing info per our format. Returns { gaps: [{ question, field, priority }], summary, error }. */
export async function documentsAnalyze(documentText) {
  const res = await fetch(`${API_BASE}/api/documents/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_text: documentText || '' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Upload PDF or TXT; backend extracts text and analyzes. Returns { gaps, summary, extracted_text, error }. */
export async function documentsAnalyzeUpload(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/documents/analyze-upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Complete document using transcript; returns { completed_document, error }. */
export async function documentsComplete(documentText, transcript) {
  return redactThenCall(transcript, async (redactedText) => {
    const res = await fetch(`${API_BASE}/api/documents/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_text: documentText || '', transcript: redactedText || '' }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

/** Human-like TTS: returns blob of MP3 audio, or null if 503/error (use browser fallback). */
export async function getTtsAudio(text) {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: (text || '').slice(0, 4096) }),
  });
  if (res.status === 503 || !res.ok) return null;
  return res.blob();
}

/**
 * Intelligent knowledge gap detection for nurse workflow.
 * Returns gaps with positions for globe visualization.
 * @param {string} transcript - Current conversation transcript
 * @param {string[]} symptoms - Extracted symptoms if available
 * @param {string} workflow - Workflow type: general | pain | vitals_abnormal | medication_reconciliation
 * @returns {{ gaps: Array<{id, question, field, priority, position}>, filled_count, total_count, complete, next_question, error }}
 */
export async function detectKnowledgeGaps(transcript, symptoms = [], workflow = 'general') {
  return redactThenCall(transcript, async (redactedText) => {
    const res = await fetch(`${API_BASE}/api/knowledge-gaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: redactedText || '',
        symptoms: symptoms || [],
        workflow: workflow || 'general',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

/**
 * Get the most efficient next question to ask based on current transcript.
 * @param {string} transcript - Current conversation transcript
 * @param {string} currentQuestion - Question just answered (optional)
 * @returns {{ next_question, rationale, alternatives, is_complete }}
 */
export async function getNextQuestion(transcript, currentQuestion = null) {
  return redactThenCall(transcript, async (redactedText) => {
    const res = await fetch(`${API_BASE}/api/workflow/next-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: redactedText || '',
        current_question: currentQuestion,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export async function initFrontendRedactor() {
  if (generator) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!('gpu' in navigator)) {
        setRedactorStatus({
          phase: 'fallback',
          ready: false,
          message: 'WebGPU unavailable (regex fallback)',
          engine: 'fallback',
          error: null,
        });
        return false;
      }

      setRedactorStatus({
        phase: 'loading',
        ready: false,
        message: 'Loading Liquid model in browser...',
        engine: 'lfm2-webgpu-q4',
        error: null,
      });

      const { env, pipeline } = await import(TRANSFORMERS_WEB_MODULE);
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.useBrowserCache = false;

      generator = await pipeline('text-generation', MODEL_DIR, {
        device: 'webgpu',
        dtype: 'q4',
      });

      setRedactorStatus({
        phase: 'ready',
        ready: true,
        message: 'Liquid model ready (browser)',
        engine: 'lfm2-webgpu-q4',
        error: null,
      });

      return true;
    } catch (error) {
      setRedactorStatus({
        phase: 'fallback',
        ready: false,
        message: 'Model load failed (regex fallback)',
        engine: 'fallback',
        error: error?.message ?? String(error),
      });
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function getFrontendRedactorStatus() {
  return getStatusSnapshot();
}

export function onFrontendRedactorStatus(cb) {
  redactorListeners.add(cb);
  cb(getStatusSnapshot());
  return () => redactorListeners.delete(cb);
}

export async function redactTextFrontend(text) {
  const { redactedText } = await redactTextBySentence(text);
  return { redacted_text: redactedText, engine: generator ? 'lfm2-webgpu-q4' : 'fallback' };
}
