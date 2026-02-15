// In dev, use same origin (Vite proxies /api to backend). Else use env or default.
const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');

export async function validateSnippet(text, fast = true, role = 'patient') {
  const res = await fetch(`${API_BASE}/api/clinical/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fast, role: role || 'patient' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function chatComplete(transcript, fileContent = null) {
  const res = await fetch(`${API_BASE}/api/chat/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      transcript: transcript || '', 
      file_content: fileContent || null 
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/documents/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_text: documentText || '', transcript: transcript || '' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  const res = await fetch(`${API_BASE}/api/knowledge-gaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      transcript: transcript || '', 
      symptoms: symptoms || [],
      workflow: workflow || 'general',
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Get the most efficient next question to ask based on current transcript.
 * @param {string} transcript - Current conversation transcript
 * @param {string} currentQuestion - Question just answered (optional)
 * @returns {{ next_question, rationale, alternatives, is_complete }}
 */
export async function getNextQuestion(transcript, currentQuestion = null) {
  const res = await fetch(`${API_BASE}/api/workflow/next-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      transcript: transcript || '',
      current_question: currentQuestion,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

