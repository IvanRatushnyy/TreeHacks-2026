import { useEffect, useMemo, useRef, useState } from "react";
import { env, pipeline } from "@huggingface/transformers";

// ✅ Vite-friendly PDF.js worker import (fixes MIME/404 issues)
import * as pdfjs from "pdfjs-dist/legacy/build/pdf";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
(pdfjs as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MODEL_ID = "onnx-community/multilang-pii-ner-ONNX";

/** ---------------- Types ---------------- */
type SpanSource = "regex" | "model";

type EntitySpan = {
  label: string;
  text: string;
  start: number;
  end: number;
  source: SpanSource;
  score: number;
  priority: number;
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
  // ✅ new: extend PERSON spans to include adjacent last-name tokens
  extendPersonSpans?: boolean;
};

/** ---------------- Utilities ---------------- */
function sanitizeWord(w: string) {
  return String(w).replace(/^##/, "").replace(/^▁/, "").trim();
}
function unique<T>(xs: T[]) {
  return Array.from(new Set(xs));
}
function escapeHTML(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Normalize model labels across different NER conventions.
 * ✅ Fix: treat PER / B-PER / I-PER as PERSON (many HF NER models use PER).
 */
function normalizeLabel(label: string) {
  const L = String(label || "").toUpperCase();

  if (L.includes("EMAIL")) return "EMAIL";
  if (L.includes("PHONE")) return "PHONE";
  if (L.includes("URL") || L.includes("WEB")) return "URL";
  if (L.includes("IP")) return "IP";
  if (L.includes("SSN")) return "SSN";
  if (L.includes("CREDIT") || L.includes("CARD")) return "CREDIT_CARD";
  if (L.includes("ADDRESS")) return "ADDRESS";

  // ✅ add common NER tag families
  if (L === "PER" || L.includes("-PER") || L.includes("PERSON")) return "PERSON";
  if (L === "ORG" || L.includes("-ORG")) return "ORG";
  if (L === "LOC" || L.includes("-LOC") || L.includes("GPE")) return "LOCATION";

  if (L.includes("DATE") || L.includes("TIME")) return "DATE_TIME";
  return label;
}

/** Expand model offsets to include adjacent “word-ish” chars */
function snapSpanToWordish(original: string, s: EntitySpan): EntitySpan {
  let { start, end } = s;
  if (start < 0 || end <= start) return s;
  const isWordish = (ch: string) => /[A-Za-z0-9'’._-]/.test(ch);
  while (start > 0 && isWordish(original[start - 1])) start--;
  while (end < original.length && isWordish(original[end])) end++;
  return { ...s, start, end, text: original.slice(start, end) };
}

/**
 * ✅ Extend PERSON spans to include adjacent capitalized tokens (e.g. "Jane" -> "Jane Doe").
 * This helps when the model only tags the first name.
 *
 * - Extends across spaces and common separators.
 * - Allows up to 3 additional name tokens (tunable).
 * - Stops at punctuation that usually ends a name (comma, semicolon, etc).
 */
function extendPersonSpan(text: string, s: EntitySpan, maxExtraTokens = 3): EntitySpan {
  if (s.label !== "PERSON") return s;
  if (s.start < 0 || s.end <= s.start) return s;

  let start = s.start;
  let end = s.end;

  // Helper: parse " nextToken" sequences
  // Accept: Doe, O'Neil, Van-Dyke, McDonald, Jr, III
  // Reject: lowercase common words unless they are name particles
  const particle = /^(?:de|da|del|della|di|la|le|van|von|bin|ibn)$/i;
  const nameToken = /^[A-Z][A-Za-z'’.-]{1,}$/;
  const suffixToken = /^(?:Jr|Sr|II|III|IV|V)\.?$/;

  // Don’t extend if immediately followed by a hard stop
  const hardStop = (ch: string) => /[,\n;:(){}\[\]]/.test(ch);

  let added = 0;
  while (added < maxExtraTokens) {
    if (end >= text.length) break;
    if (hardStop(text[end])) break;

    // allow one separator space
    if (text[end] !== " ") break;

    const tail = text.slice(end + 1);

    // Capture next token up to word boundary
    const m = /^([A-Za-z'’.-]+)\b/.exec(tail);
    if (!m) break;

    const tok = m[1];
    const ok =
      nameToken.test(tok) ||
      particle.test(tok) || // allow "van", "de"
      suffixToken.test(tok);

    if (!ok) break;

    // Extend end to include the leading space + token
    end = end + 1 + tok.length;
    added++;
  }

  if (end !== s.end) {
    return { ...s, start, end, text: text.slice(start, end) };
  }
  return s;
}

/** Luhn check (credit cards) */
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

/** ---------------- Regex Rules ---------------- */
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
  { label: "EMAIL", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, priority: 180 },
  { label: "URL", re: /\bhttps?:\/\/[^\s<>"')]+/gi, priority: 170 },
  
  // Phone numbers - multiple patterns for better coverage
  {
    label: "PHONE",
    re: /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    priority: 165,
  },
  {
    label: "PHONE",
    re: /\b\d{3}[\s.-]?\d{4}\b/g,  // 7-digit local numbers
    priority: 163,
  },
  {
    label: "PHONE",
    re: /\b\d{10}\b/g,  // 10 digits no separators
    priority: 162,
  },
  {
    label: "PHONE",
    re: /\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,  // International
    priority: 164,
  },
  {
    label: "IP",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    priority: 160,
  },

  // Person names - common patterns
  {
    label: "PERSON",
    re: /\b(?:Patient|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    priority: 250,
  },
  {
    label: "PERSON",
    re: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,  // Two capitalized words (First Last)
    priority: 150,
  },

  // IDs
  { label: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g, priority: 230 },
  {
    label: "CREDIT_CARD",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    priority: 120,
    enabledByDefault: false,
    postFilter: (t) => luhnValid(t),
  },

  // Provider IDs
  { label: "NPI", re: /\b(?:NPI[:\s#-]*)?\d{10}\b/gi, priority: 210 },
  { label: "DEA", re: /\b(?:DEA[:\s#-]*)?[A-Z]{2}\d{7}\b/gi, priority: 210 },

  // Clinical IDs
  {
    label: "MRN",
    re: /\b(?:MRN|Medical\s*Record\s*(?:No\.?|Number)|Pt\s*MRN)[:\s#-]*\d{6,12}\b/gi,
    priority: 240,
  },
  { label: "FIN", re: /\b(?:FIN|F\.?I\.?N\.?|Financial\s*ID)[:\s#-]*\d{6,14}\b/gi, priority: 215 },
  { label: "ENCOUNTER_ID", re: /\b(?:Encounter|Visit)[:\s#-]*(?:ID[:\s#-]*)?\d{5,14}\b/gi, priority: 215 },
  { label: "ACCESSION", re: /\b(?:Accession|ACC(?:ession)?|ACC#)[:\s#-]*[A-Z0-9-]{6,20}\b/gi, priority: 220 },
  { label: "SPECIMEN_ID", re: /\b(?:Specimen|Sample)[:\s#-]*(?:ID[:\s#-]*)?[A-Z0-9-]{6,24}\b/gi, priority: 205 },

  // DICOM UID
  { label: "DICOM_UID", re: /\b(?:\d+\.){3,}\d+\b/g, priority: 190 },

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

/** ---------------- Core extractors (modular) ---------------- */
function extractRegexSpans(text: string, rules: RegexRule[], enabled: Record<string, boolean>): EntitySpan[] {
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

function extractModelSpans(text: string, raw: any[], minScore = 0.2): EntitySpan[] {
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

function mergeSpans(spans: EntitySpan[]): EntitySpan[] {
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

function extractAllSpans(text: string, args: { rawModel?: any[] }, options: ExtractOptions = {}): EntitySpan[] {
  const {
    useRegex = true,
    useModel = true,
    minModelScore = 0.2,
    snapModelWordish = true,
    regexEnabled = defaultRegexEnabledMap(REGEX_RULES),
    rules = REGEX_RULES,
    extendPersonSpans = true, // ✅ enabled by default
  } = options;

  const pieces: EntitySpan[] = [];

  if (useModel && args.rawModel) {
    let ms = extractModelSpans(text, args.rawModel, minModelScore);
    if (snapModelWordish) ms = ms.map((s) => snapSpanToWordish(text, s));
    if (extendPersonSpans) ms = ms.map((s) => extendPersonSpan(text, s));
    pieces.push(...ms);
  }

  if (useRegex) {
    pieces.push(...extractRegexSpans(text, rules, regexEnabled));
  }

  return mergeSpans(pieces);
}

/** ---------------- Text helpers ---------------- */
function redactText(text: string, spans: EntitySpan[], mode: "block" | "token" = "block") {
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

function highlightHTML(text: string, spans: EntitySpan[]) {
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

/** ---------------- PDF “asterisk replacement” preview ----------------
 * This is NOT editing the PDF file streams.
 * It renders the page to canvas, then covers detected tokens with a white box
 * and draws asterisks in the same location (so it LOOKS like replaced text).
 */

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height?: number;
};

type ItemMap = { start: number; end: number; item: TextItem };

function buildPageTextAndMap(items: TextItem[]) {
  let pageText = "";
  const map: ItemMap[] = [];
  for (const it of items) {
    const s = it.str ?? "";
    if (!s) continue;
    const start = pageText.length;
    pageText += s;
    const end = pageText.length;
    map.push({ start, end, item: it });
    pageText += " "; // keep tokens separated
  }
  return { pageText, map };
}

function itemBBox(item: TextItem, viewport: any) {
  // Matches PDF.js text-layer transform approach
  const tx = (pdfjs as any).Util.transform(viewport.transform, item.transform);
  const x = tx[4];
  const y = tx[5];

  const fontHeight = Math.hypot(tx[2], tx[3]);
  const w = Math.abs(item.width) * (viewport.scale ?? 1);
  const h = fontHeight;

  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (w <= 0 || h <= 0) return null;

  // Top-left box (canvas y grows downward)
  return { x, yTop: y - h, yBase: y, w, h };
}

/** Find spans that overlap an item and return the overlapping character ranges */
function getOverlappingSpans(
  itemRange: { start: number; end: number },
  spans: EntitySpan[]
): Array<{ span: EntitySpan; charStart: number; charEnd: number }> {
  const overlapping: Array<{ span: EntitySpan; charStart: number; charEnd: number }> = [];
  for (const sp of spans) {
    if (sp.start < itemRange.end && sp.end > itemRange.start) {
      const charStart = Math.max(0, sp.start - itemRange.start);
      const charEnd = Math.min(itemRange.end - itemRange.start, sp.end - itemRange.start);
      overlapping.push({ span: sp, charStart, charEnd });
    }
  }
  return overlapping;
}

/** Draw "replacement" asterisks over specific character ranges in the original token */
function drawAsteriskReplacement(
  ctx: CanvasRenderingContext2D,
  bbox: { x: number; yTop: number; yBase: number; w: number; h: number },
  itemText: string,
  charRanges: Array<{ charStart: number; charEnd: number }> = []
) {
  const clean = itemText ?? "";
  if (!clean.trim() || !charRanges.length) return;

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Choose a font size that fits the token height
  let fontSize = Math.max(6, bbox.h);
  ctx.font = `${fontSize}px sans-serif`;

  // For each overlapping range, redact only that portion
  for (const range of charRanges) {
    const { charStart, charEnd } = range;
    const prefix = clean.substring(0, charStart);
    const toRedact = clean.substring(charStart, charEnd);

    if (!toRedact.trim()) continue;

    const redacted = toRedact.replace(/[^\s]/g, "*");
    const prefixWidth = ctx.measureText(prefix).width || 0;
    const redactWidth = ctx.measureText(redacted).width || 1;

    // Cover only the redacted portion with white rectangle
    ctx.fillStyle = "white";
    ctx.fillRect(bbox.x + prefixWidth - 1, bbox.yTop - 1, redactWidth + 2, bbox.h + 2);

    // Draw asterisks at the correct position
    ctx.fillStyle = "black";
    ctx.fillText(redacted, bbox.x + prefixWidth, bbox.yBase);
  }

  ctx.restore();
}

async function renderRedactedPdfAsAsterisks(args: {
  file: File;
  canvases: Array<HTMLCanvasElement | null>;
  scale: number;
  getSpansForPage: (pageIndex0: number, pageText: string) => EntitySpan[];
  onStatus?: (s: string) => void;
}) {
  const { file, canvases, scale, getSpansForPage, onStatus } = args;

  onStatus?.("Rendering PDF…");
  const bytes = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: bytes }).promise;

  for (let p = 1; p <= doc.numPages; p++) {
    onStatus?.(`Rendering page ${p}/${doc.numPages}…`);
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });

    const canvas = canvases[p - 1];
    if (!canvas) continue;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    // Render original page first
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Extract text items & build offsets
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as TextItem[];
    const { pageText, map } = buildPageTextAndMap(items);

    // Detect spans (regex + optional model) on the extracted page text
    const spans = getSpansForPage(p - 1, pageText);

    // Replace only the portions of tokens that overlap sensitive spans
    for (const m of map) {
      const overlappingRanges = getOverlappingSpans({ start: m.start, end: m.end }, spans);
      if (!overlappingRanges.length) continue;

      const bbox = itemBBox(m.item, viewport);
      if (!bbox) continue;

      // Guard: skip absurdly large bboxes (prevents "everything redacted" due to one bad calc)
      if (bbox.w > canvas.width * 0.95 && bbox.h > canvas.height * 0.95) continue;

      drawAsteriskReplacement(ctx, bbox, m.item.str, overlappingRanges);
    }
  }

  onStatus?.("Done (preview).");
}

/** Create an actual redacted PDF file with text replaced as images */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

async function createRedactedPdf(args: {
  file: File;
  scale: number;
  getSpansForPage: (pageIndex0: number, pageText: string) => EntitySpan[];
  onStatus?: (s: string) => void;
}): Promise<Blob> {
  const { file, getSpansForPage, onStatus } = args;

  onStatus?.("Preparing redaction data…");
  const bytes = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: bytes }).promise;

  // Collect all spans for all pages
  const spansByPage: Record<string, Array<{ text: string; charStart: number; charEnd: number }>> = {};

  for (let p = 1; p <= doc.numPages; p++) {
    onStatus?.(`Scanning page ${p}/${doc.numPages} for sensitive text…`);
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as TextItem[];
    const { pageText, map } = buildPageTextAndMap(items);

    // Get spans for this page
    const spans = getSpansForPage(p - 1, pageText);

    // Build replacement data for each overlapping span
    const pageReplacements = [];
    for (const m of map) {
      const overlappingRanges = getOverlappingSpans({ start: m.start, end: m.end }, spans);
      if (!overlappingRanges.length) continue;

      for (const range of overlappingRanges) {
        pageReplacements.push({
          text: m.item.str,
          charStart: range.charStart,
          charEnd: range.charEnd,
        });
      }
    }

    if (pageReplacements.length > 0) {
      spansByPage[String(p - 1)] = pageReplacements;
    }
  }

  onStatus?.("Sending to server for redaction…");

  // Convert PDF to base64 using FileReader
  const pdfBase64 = await fileToBase64(file);

  try {
    // Call backend API
    const response = await fetch("http://localhost:5000/api/redact-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf: pdfBase64,
        spans: spansByPage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Redaction failed");
    }

    // Decode the redacted PDF base64 to binary
    const redactedPdfBase64 = result.pdf;
    const binaryString = atob(redactedPdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    onStatus?.("Redaction complete!");
    return new Blob([bytes], { type: "application/pdf" });
  } catch (error: any) {
    throw new Error(`Failed to redact PDF: ${error.message}`);
  }
}

/** Download a blob as a file */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** ---------------- App ---------------- */
export default function App() {
  const detectorRef = useRef<any>(null);

  // model
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Starting…");

  // text
  const [text, setText] = useState(
    [
      "Patient: Jane Doe (DOB 03/12/2006) presented to Stanford Clinic on March 12, 2026 at 14:23.",
      "MRN: 004512789, FIN 9988776655, Encounter ID: 77123456. Address: 123 Main St, Palo Alto.",
      "Contact: jane.doe@example.com, (415) 555-1234, 650-555-9876, or 4085551111. Cell: +1-408-555-7890.",
      "Labs: Accession: 24-ABC12345; Specimen ID: S-2026-000991; DICOM UID 1.2.840.113619.2.55.3.604688123.78.1456789012.467.",
      "Network note: PACS source IP 10.21.34.56. Prior SSN 123-45-6789 documented in external fax. Referring MD NPI: 1234567890; DEA: AB1234567.",
    ].join(" ")
  );
  const [rawModelText, setRawModelText] = useState<any[]>([]);

  // options
  const [minScore, setMinScore] = useState(0.15);
  const [useHighlight, setUseHighlight] = useState(true);
  const [redactMode, setRedactMode] = useState<"block" | "token">("block");
  const [useRegex, setUseRegex] = useState(true);
  const [useModel, setUseModel] = useState(true);
  const [snapModelWordish, setSnapModelWordish] = useState(true);
  const [extendPersonSpans, setExtendPersonSpans] = useState(true);

  const allRegexLabels = useMemo(() => unique(REGEX_RULES.map((r) => r.label)).sort(), []);
  const [regexEnabled, setRegexEnabled] = useState<Record<string, boolean>>(defaultRegexEnabledMap(REGEX_RULES));

  const textSpans = useMemo(() => {
    return extractAllSpans(
      text,
      { rawModel: rawModelText },
      {
        useRegex,
        useModel,
        minModelScore: minScore,
        snapModelWordish,
        regexEnabled,
        extendPersonSpans,
      }
    );
  }, [text, rawModelText, useRegex, useModel, minScore, snapModelWordish, regexEnabled, extendPersonSpans]);

  const redactedText = useMemo(() => redactText(text, textSpans, redactMode), [text, textSpans, redactMode]);
  const highlighted = useMemo(() => highlightHTML(text, textSpans), [text, textSpans]);

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState("No PDF loaded");
  const [pdfName, setPdfName] = useState("");
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfScale, setPdfScale] = useState(1.4);

  const [pdfPageTexts, setPdfPageTexts] = useState<string[]>([]);
  const [rawModelPdfPages, setRawModelPdfPages] = useState<any[][]>([]);

  const pdfCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  async function loadDetector() {
    setLoading(true);
    setStatus("Loading PII detector (WASM)…");

    env.allowLocalModels = false;
    env.useBrowserCache = true;
    (env.backends?.onnx?.wasm as any).proxy = true;
    (env.backends?.onnx?.wasm as any).simd = true;

    // Avoid thread warnings unless crossOriginIsolated is enabled
    const canThreads = (globalThis as any).crossOriginIsolated === true;
    (env.backends?.onnx?.wasm as any).numThreads = canThreads ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

    const detector = await pipeline("token-classification", MODEL_ID, { device: "wasm" });
    detectorRef.current = detector;

    setLoading(false);
    setStatus(canThreads ? "Ready (multi-thread)" : "Ready (single-thread)");
  }

  async function runModelOnText() {
    const det = detectorRef.current;
    if (!det) return;

    setStatus("Running model on text…");
    try {
      const output = await det(text, { aggregation_strategy: "simple" });
      setRawModelText(Array.isArray(output) ? output : []);
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

  async function handlePdfUpload(file: File) {
    setPdfStatus("Loading PDF…");
    setPdfFile(file);
    setPdfName(file.name);

    try {
      const bytes = await file.arrayBuffer();
      const doc = await (pdfjs as any).getDocument({ data: bytes }).promise;
      setPdfPages(doc.numPages);

      setPdfStatus(`Extracting text (${doc.numPages} page(s))…`);
      const pageTexts: string[] = [];
      const raw: any[][] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const items = (textContent.items || []) as TextItem[];
        const { pageText } = buildPageTextAndMap(items);
        pageTexts.push(pageText);
        raw.push([]); // model outputs per page filled later
      }

      setPdfPageTexts(pageTexts);
      setRawModelPdfPages(raw);
      setPdfStatus("PDF ready. (Optional) Run model on pages, then Render asterisk redaction.");
    } catch (e: any) {
      console.error(e);
      setPdfStatus(`Failed to load PDF: ${e?.message ?? String(e)}`);
    }
  }

  async function runModelOnPdfPages() {
    const det = detectorRef.current;
    if (!det || !pdfPageTexts.length) return;

    setPdfStatus("Running model on PDF pages…");
    try {
      const out: any[][] = [];
      for (let i = 0; i < pdfPageTexts.length; i++) {
        const modelOut = await det(pdfPageTexts[i], { aggregation_strategy: "simple" });
        out.push(Array.isArray(modelOut) ? modelOut : []);
      }
      setRawModelPdfPages(out);
      setPdfStatus("Model complete. Ready to render.");
    } catch (e: any) {
      console.error(e);
      setPdfStatus(`Model on PDF failed: ${e?.message ?? String(e)}`);
    }
  }

  async function renderPdfAsterisks() {
    if (!pdfFile) return;
    if (!pdfPages) return;

    await renderRedactedPdfAsAsterisks({
      file: pdfFile,
      canvases: pdfCanvasRefs.current,
      scale: pdfScale,
      onStatus: setPdfStatus,
      getSpansForPage: (pageIndex0, pageText) => {
        const rawModel = rawModelPdfPages[pageIndex0] ?? [];
        return extractAllSpans(pageText, { rawModel }, { useRegex, useModel, minModelScore: minScore, snapModelWordish, regexEnabled, extendPersonSpans });
      },
    });
  }

  async function downloadRedactedPdf() {
    if (!pdfFile) return;
    if (!pdfPages) return;

    try {
      const blob = await createRedactedPdf({
        file: pdfFile,
        scale: pdfScale,
        onStatus: setPdfStatus,
        getSpansForPage: (pageIndex0, pageText) => {
          const rawModel = rawModelPdfPages[pageIndex0] ?? [];
          return extractAllSpans(pageText, { rawModel }, { useRegex, useModel, minModelScore: minScore, snapModelWordish, regexEnabled, extendPersonSpans });
        },
      });
      
      const baseName = pdfName.replace(/\.pdf$/i, "");
      downloadBlob(blob, `${baseName}-redacted.pdf`);
      setPdfStatus("✓ PDF redacted and downloaded!");
    } catch (e: any) {
      console.error(e);
      setPdfStatus(`Download failed: ${e?.message ?? String(e)}`);
    }
  }

  useEffect(() => {
    loadDetector().catch((e) => {
      console.error(e);
      setStatus(`Failed to load: ${e?.message ?? String(e)}`);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1>De-ID Extractor (Text + PDF “Asterisk Replace” Preview)</h1>

      <div style={{ marginBottom: 10 }}>
        <b>Status:</b> {status}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={runModelOnText} disabled={loading || !detectorRef.current}>
          Run model (text)
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
          Extend PERSON spans (Jane → Jane Doe)
          <input
            type="checkbox"
            checked={extendPersonSpans}
            onChange={(e) => setExtendPersonSpans(e.target.checked)}
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
          Redaction mode (text box)
          <select value={redactMode} onChange={(e) => setRedactMode(e.target.value as any)}>
            <option value="block">Block (█)</option>
            <option value="token">Token ([LABEL_n])</option>
          </select>
        </label>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 18 }}>
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

      {/* TEXT */}
      <h2>Text</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        style={{ width: "100%", marginBottom: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      />

      <h3>Preview</h3>
      {useHighlight ? (
        <div
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, padding: 12, border: "1px solid #eee", borderRadius: 10 }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #eee", borderRadius: 10 }}>{text}</pre>
      )}

      <h3>Redacted Output</h3>
      <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #eee", borderRadius: 10 }}>{redactedText}</pre>

      <h3>Spans</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(textSpans, null, 2)}</pre>

      {/* PDF */}
      <hr style={{ margin: "28px 0" }} />
      <h2>PDF (rendered with “*” replacements)</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            handlePdfUpload(f).catch(console.error);
          }}
        />

        <button onClick={runModelOnPdfPages} disabled={loading || !detectorRef.current || !pdfPageTexts.length}>
          Run model (PDF pages)
        </button>

        <button onClick={renderPdfAsterisks} disabled={!pdfFile || !pdfPages}>
          Render asterisk redaction
        </button>

        <button onClick={downloadRedactedPdf} disabled={!pdfFile || !pdfPages} style={{ backgroundColor: "#4CAF50" }}>
          ⬇ Download redacted PDF
        </button>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Scale
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="3"
            value={pdfScale}
            onChange={(e) => setPdfScale(Number(e.target.value))}
            style={{ width: 70 }}
            disabled={!pdfFile}
          />
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <b>PDF status:</b> {pdfStatus}
        {pdfName ? <span> — {pdfName}</span> : null}
        {pdfPages ? <span> — {pdfPages} page(s)</span> : null}
      </div>

      {pdfPages > 0 && (
        <div style={{ display: "grid", gap: 18 }}>
          {Array.from({ length: pdfPages }, (_, i) => (
            <div key={i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Page {i + 1}</div>
              <canvas
                ref={(el) => {
                  pdfCanvasRefs.current[i] = el;
                }}
                style={{ width: "100%", height: "auto", borderRadius: 8 }}
              />
              <details style={{ marginTop: 10 }}>
                <summary>Extracted page text (debug)</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>{pdfPageTexts[i] ?? ""}</pre>
              </details>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        This replaces detected PDF text visually by drawing asterisks over it in the canvas preview. If you need a{" "}
        <b>downloadable edited PDF</b> (actual text replaced inside the PDF), that’s a different step (PDF content stream
        rewriting) and we can add it next.
      </div>
    </div>
  );
}
