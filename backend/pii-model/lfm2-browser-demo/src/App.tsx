import { useEffect, useMemo, useRef, useState } from "react";
import { env, pipeline } from "@huggingface/transformers";

/**
 * App.tsx — Modular PII/PHI span extraction (Regex + Model)
 *
 * Plug in any text -> get spans [{label,start,end,text,source,score}]
 * Reusable pure functions: extractRegexSpans, extractModelSpans, mergeSpans, extractAllSpans
 */

const MODEL_ID = "onnx-community/multilang-pii-ner-ONNX";

/** ---------- Types ---------- */
export type SpanSource = "regex" | "model";

export type EntitySpan = {
  label: string;
  text: string;
  start: number;
  end: number;
  source: SpanSource;
  score: number; // model score or 1.0 for regex
  priority: number; // overlap winner
};

type RegexRule = {
  label: string;
  re: RegExp;
  priority: number;
  enabledByDefault?: boolean;
  postFilter?: (matchText: string) => boolean;
};

type ExtractOptions = {
  useRegex?: boolean;
  useModel?: boolean;
  minModelScore?: number;
  snapModelWordish?: boolean;
  regexEnabled?: Record<string, boolean>;
  rules?: RegexRule[];
};

/** ---------- Small utilities ---------- */
function sanitizeWord(w: string) {
  return String(w).replace(/^##/, "").replace(/^▁/, "").trim();
}

function unique<T>(xs: T[]) {
  return Array.from(new Set(xs));
}

function escapeHTML(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Expand model offsets to include adjacent "word-ish" chars */
function snapSpanToWordish(original: string, s: EntitySpan): EntitySpan {
  let { start, end } = s;
  if (start < 0 || end <= start) return s;

  const isWordish = (ch: string) => /[A-Za-z0-9'’._-]/.test(ch);

  while (start > 0 && isWordish(original[start - 1])) start--;
  while (end < original.length && isWordish(original[end])) end++;

  return { ...s, start, end, text: original.slice(start, end) };
}

function normalizeLabel(label: string) {
  const L = String(label || "").toUpperCase();
  if (L.includes("EMAIL")) return "EMAIL";
  if (L.includes("PHONE")) return "PHONE";
  if (L.includes("URL") || L.includes("WEB")) return "URL";
  if (L.includes("IP")) return "IP";
  if (L.includes("SSN")) return "SSN";
  if (L.includes("CREDIT") || L.includes("CARD")) return "CREDIT_CARD";
  if (L.includes("ADDRESS")) return "ADDRESS";
  if (L.includes("PERSON")) return "PERSON";
  if (L.includes("ORG")) return "ORG";
  if (L.includes("LOC") || L.includes("GPE")) return "LOCATION";
  if (L.includes("DATE") || L.includes("TIME")) return "DATE_TIME";
  return label;
}

/** Luhn check (useful for credit cards) */
function luhnValid(num: string) {
  const digits = num.replace(/[ -]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** ---------- Regex rules (healthcare-focused) ---------- */
const REGEX_RULES: RegexRule[] = [
  // Dates & times
  {
    label: "DATE",
    re: /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g,
    priority: 220,
  },
  {
    label: "DATE",
    re: /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+\d{4}\b/gi,
    priority: 220,
  },
  {
    label: "TIME",
    re: /\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\s*(?:AM|PM|am|pm)?\b/g,
    priority: 200,
  },

  // Contact/network
  {
    label: "EMAIL",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    priority: 180,
  },
  {
    label: "URL",
    re: /\bhttps?:\/\/[^\s<>"')]+/gi,
    priority: 170,
  },
  {
    label: "PHONE",
    re: /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    priority: 165,
  },
  {
    label: "IP",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    priority: 160,
  },

  // IDs
  {
    label: "SSN",
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
    priority: 230,
  },
  {
    label: "CREDIT_CARD",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    priority: 120,
    enabledByDefault: false,
    postFilter: (t) => luhnValid(t),
  },

  // Provider IDs
  {
    label: "NPI",
    re: /\b(?:NPI[:\s#-]*)?\d{10}\b/gi,
    priority: 210,
  },
  {
    label: "DEA",
    re: /\b(?:DEA[:\s#-]*)?[A-Z]{2}\d{7}\b/gi,
    priority: 210,
  },

  // Clinical IDs
  {
    label: "MRN",
    re: /\b(?:MRN|Medical\s*Record\s*(?:No\.?|Number)|Pt\s*MRN)[:\s#-]*\d{6,12}\b/gi,
    priority: 240,
  },
  {
    label: "FIN",
    re: /\b(?:FIN|F\.?I\.?N\.?|Financial\s*ID)[:\s#-]*\d{6,14}\b/gi,
    priority: 215,
  },
  {
    label: "ENCOUNTER_ID",
    re: /\b(?:Encounter|Visit)[:\s#-]*(?:ID[:\s#-]*)?\d{5,14}\b/gi,
    priority: 215,
  },
  {
    label: "ACCESSION",
    re: /\b(?:Accession|ACC(?:ession)?|ACC#)[:\s#-]*[A-Z0-9-]{6,20}\b/gi,
    priority: 220,
  },
  {
    label: "SPECIMEN_ID",
    re: /\b(?:Specimen|Sample)[:\s#-]*(?:ID[:\s#-]*)?[A-Z0-9-]{6,24}\b/gi,
    priority: 205,
  },

  // DICOM UID
  {
    label: "DICOM_UID",
    re: /\b(?:\d+\.){3,}\d+\b/g,
    priority: 190,
  },

  // Address-ish (demo)
  {
    label: "ADDRESS",
    re: /\b\d{1,6}\s+[A-Za-z0-9.'’\-]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court)\b\.?/g,
    priority: 140,
  },
];

function defaultRegexEnabledMap(rules: RegexRule[]) {
  const m: Record<string, boolean> = {};
  for (const r of rules) m[r.label] = r.enabledByDefault ?? true;
  return m;
}

/** ---------- Core modular extractors ---------- */
export function extractRegexSpans(
  text: string,
  rules: RegexRule[],
  enabled: Record<string, boolean>
): EntitySpan[] {
  const spans: EntitySpan[] = [];

  for (const rule of rules) {
    if (enabled[rule.label] === false) continue;

    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = rule.re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const matchText = text.slice(start, end);

      if (rule.postFilter && !rule.postFilter(matchText)) {
        if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
        continue;
      }

      spans.push({
        label: rule.label,
        text: matchText,
        start,
        end,
        score: 1,
        source: "regex",
        priority: rule.priority,
      });

      if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
    }
  }

  return spans;
}

export function extractModelSpans(text: string, raw: any[], minScore = 0.2): EntitySpan[] {
  const spans: EntitySpan[] = [];

  for (const item of raw || []) {
    const labelRaw = item.entity || item.label || "UNKNOWN";
    if (labelRaw === "O" || labelRaw === "LABEL_0") continue;

    const score = item.score ?? 0;
    if (score < minScore) continue;

    const start = typeof item.start === "number" ? item.start : -1;
    const end = typeof item.end === "number" ? item.end : -1;

    if (start >= 0 && end > start && end <= text.length) {
      spans.push({
        label: normalizeLabel(labelRaw),
        text: text.slice(start, end),
        start,
        end,
        score,
        source: "model",
        priority: 20,
      });
      continue;
    }

    // fallback
    const word = sanitizeWord(item.word ?? "");
    if (!word) continue;
    const idx = text.indexOf(word);
    if (idx !== -1) {
      spans.push({
        label: normalizeLabel(labelRaw),
        text: text.slice(idx, idx + word.length),
        start: idx,
        end: idx + word.length,
        score,
        source: "model",
        priority: 20,
      });
    }
  }

  return spans;
}

export function mergeSpans(spans: EntitySpan[]): EntitySpan[] {
  const s = spans.filter((x) => x.start >= 0 && x.end > x.start);

  s.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (la !== lb) return lb - la;
    return b.score - a.score;
  });

  const out: EntitySpan[] = [];
  for (const cur of s) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(cur);
      continue;
    }

    if (cur.start >= last.end) {
      out.push(cur);
      continue;
    }

    const lastLen = last.end - last.start;
    const curLen = cur.end - cur.start;

    const curBetter =
      cur.priority > last.priority ||
      (cur.priority === last.priority && curLen > lastLen) ||
      (cur.priority === last.priority && curLen === lastLen && cur.score > last.score);

    if (curBetter) out[out.length - 1] = cur;
  }

  return out;
}

/** One-call “API”: text (+ optional raw model output) -> merged spans */
export function extractAllSpans(
  text: string,
  args: { rawModel?: any[] },
  options: ExtractOptions = {}
): EntitySpan[] {
  const {
    useRegex = true,
    useModel = true,
    minModelScore = 0.2,
    snapModelWordish = true,
    regexEnabled = defaultRegexEnabledMap(REGEX_RULES),
    rules = REGEX_RULES,
  } = options;

  const pieces: EntitySpan[] = [];

  if (useModel && args.rawModel) {
    const ms = extractModelSpans(text, args.rawModel, minModelScore);
    pieces.push(...(snapModelWordish ? ms.map((s) => snapSpanToWordish(text, s)) : ms));
  }

  if (useRegex) {
    pieces.push(...extractRegexSpans(text, rules, regexEnabled));
  }

  return mergeSpans(pieces);
}

/** ---------- Optional render helpers ---------- */
export function redactText(text: string, spans: EntitySpan[], mode: "block" | "token" = "block") {
  if (!spans.length) return text;

  let out = "";
  let cursor = 0;
  const counts: Record<string, number> = {};

  for (const s of spans) {
    out += text.slice(cursor, s.start);

    if (mode === "token") {
      counts[s.label] = (counts[s.label] ?? 0) + 1;
      out += `[${s.label}_${counts[s.label]}]`;
    } else {
      out += "█".repeat(Math.max(1, s.end - s.start));
    }

    cursor = s.end;
  }

  out += text.slice(cursor);
  return out;
}

export function highlightHTML(text: string, spans: EntitySpan[]) {
  if (!spans.length) return escapeHTML(text);

  let out = "";
  let cursor = 0;

  for (const s of spans) {
    out += escapeHTML(text.slice(cursor, s.start));
    out += `<mark title="${escapeHTML(`${s.label} • ${s.source}`)}">${escapeHTML(
      text.slice(s.start, s.end)
    )}</mark>`;
    cursor = s.end;
  }

  out += escapeHTML(text.slice(cursor));
  return out;
}

/** ---------- React App ---------- */
export default function App() {
  const detectorRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Starting…");

  const [text, setText] = useState(
    [
      "Patient: Jane Doe (DOB 03/12/2006) presented to Stanford Clinic on March 12, 2026 at 14:23.",
      "MRN: 004512789, FIN 9988776655, Encounter ID: 77123456. Address: 123 Main St, Palo Alto.",
      "Contact: jane.doe@example.com, (415) 555-1234. Referring MD NPI: 1234567890; DEA: AB1234567.",
      "Labs: Accession: 24-ABC12345; Specimen ID: S-2026-000991; DICOM UID 1.2.840.113619.2.55.3.604688123.78.1456789012.467.",
      "Network note: PACS source IP 10.21.34.56. Prior SSN 123-45-6789 documented in external fax.",
    ].join(" ")
  );

  const [rawModel, setRawModel] = useState<any[]>([]);

  // Controls
  const [minScore, setMinScore] = useState(0.2);
  const [useHighlight, setUseHighlight] = useState(true);
  const [redactMode, setRedactMode] = useState<"block" | "token">("block");
  const [useRegex, setUseRegex] = useState(true);
  const [useModel, setUseModel] = useState(true);
  const [snapModelWordish, setSnapModelWordish] = useState(true);

  const allRegexLabels = useMemo(() => unique(REGEX_RULES.map((r) => r.label)).sort(), []);
  const [regexEnabled, setRegexEnabled] = useState<Record<string, boolean>>(
    defaultRegexEnabledMap(REGEX_RULES)
  );

  const spans = useMemo(() => {
    return extractAllSpans(text, { rawModel }, { useRegex, useModel, minModelScore: minScore, snapModelWordish, regexEnabled });
  }, [text, rawModel, useRegex, useModel, minScore, snapModelWordish, regexEnabled]);

  const redacted = useMemo(() => redactText(text, spans, redactMode), [text, spans, redactMode]);
  const highlighted = useMemo(() => highlightHTML(text, spans), [text, spans]);

  async function loadDetector() {
    setLoading(true);
    setStatus("Loading PII detector (WASM)…");

    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.backends.onnx.wasm.proxy = true;
    env.backends.onnx.wasm.simd = true;
    env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);

    const detector = await pipeline("token-classification", MODEL_ID, { device: "wasm" });
    detectorRef.current = detector;

    setLoading(false);
    setStatus("Ready");
  }

  async function runModel() {
    const det = detectorRef.current;
    if (!det) return;

    setStatus("Running model…");
    try {
      const output = await det(text, { aggregation_strategy: "simple" });
      setRawModel(Array.isArray(output) ? output : []);
      setStatus("Ready");
    } catch (e: any) {
      console.error(e);
      setStatus(`Model failed: ${e?.message ?? String(e)}`);
    }
  }

  function toggleAllRegex(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const lab of allRegexLabels) next[lab] = on;
    setRegexEnabled(next);
  }

  useEffect(() => {
    loadDetector().catch((e) => {
      console.error(e);
      setStatus(`Failed to load: ${e?.message ?? String(e)}`);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1020, margin: "0 auto", padding: 20 }}>
      <h1>De-ID Extractor (Modular)</h1>

      <div style={{ marginBottom: 10 }}>
        <b>Status:</b> {status}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={runModel} disabled={loading || !detectorRef.current}>
          Run model
        </button>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Use model
          <input type="checkbox" checked={useModel} onChange={(e) => setUseModel(e.target.checked)} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Min model score
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: 80 }}
            disabled={!useModel}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Snap model spans
          <input
            type="checkbox"
            checked={snapModelWordish}
            onChange={(e) => setSnapModelWordish(e.target.checked)}
            disabled={!useModel}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Use regex
          <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Highlight
          <input type="checkbox" checked={useHighlight} onChange={(e) => setUseHighlight(e.target.checked)} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Redaction mode
          <select value={redactMode} onChange={(e) => setRedactMode(e.target.value as any)}>
            <option value="block">Block (█)</option>
            <option value="token">Token ([LABEL_n])</option>
          </select>
        </label>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Regex detectors</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => toggleAllRegex(true)}>Enable all</button>
          <button onClick={() => toggleAllRegex(false)}>Disable all</button>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {allRegexLabels.map((k) => (
            <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {k}
              <input
                type="checkbox"
                checked={regexEnabled[k] ?? true}
                onChange={(e) => setRegexEnabled((p) => ({ ...p, [k]: e.target.checked }))}
                disabled={!useRegex}
              />
            </label>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        style={{
          width: "100%",
          marginBottom: 16,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      />

      <h3>Preview</h3>
      {useHighlight ? (
        <div
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 10,
          }}
          dangerouslySetInnerHTML={{ __html: useHighlight ? highlightHTML(text, spans) : escapeHTML(text) }}
        />
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          {text}
        </pre>
      )}

      <h3>Redacted Output</h3>
      <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        {redacted}
      </pre>

      <h3>Spans (positions + types)</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(spans, null, 2)}</pre>

      <h3>Raw model output</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rawModel, null, 2)}</pre>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Reuse <code>extractAllSpans(text, &#123;rawModel&#125;, options)</code> anywhere to get positions + labels.
      </div>
    </div>
  );
}
