# Saging API — Overview (after completed steps)

Use this after each step to see what’s built, how it works, inputs/outputs, external dependencies, and what’s next.

---

## What we built (current state)

- **FastAPI app** in `saging-api/` (separate from `backend/`). Runs with `uvicorn app.main:app --port 8000`. Docs at `/docs`, `/redoc`.
- **Config & secrets:** `.env` + optional AWS Secrets Manager. Keys loaded at startup; no secrets in repo.
- **Endpoints:** Health, status, PII redact, clinical framework, clinical validate (LLM), chat complete (LLM), S3 records. (Voice transcribe added as placeholder in Step 6.)

---

## How each part works

### 1. Health & status
- **GET /** — Returns service name and list of endpoint paths.
- **GET /health** — Liveness: `{"status":"ok"}`.
- **GET /ready** — Readiness: `{"status":"ready"}`.
- **GET /api/status** — Which integrations are on: `{ "llm", "s3", "pii_service" }` (booleans).  
  **Input:** none. **Output:** JSON. **Where:** response body.

### 2. PII redaction
- **POST /api/redact** — Masks PII in text so it can be sent to the LLM or stored safely. (This is **not** the source of patient files; it only redacts/masks text.)
- **How it works:** If `PII_SERVICE_URL` is set, POSTs text to that service (tries `/api/redact-text`, `/redact-text`, `/api/redact`); 10s timeout. Else uses in-app regex (email, phone, SSN, dates).
- **Input:** Body `{ "text": "string" }`. **Output:** `{ "redacted_text", "spans": [ { "start", "end", "label" } ], "error" }`. **Where:** response body.

### 3. Clinical framework (for citations)
- **GET /api/clinical/framework** — Returns the documentation framework text used to justify validation suggestions.
- **Input:** none. **Output:** `{ "framework": "..." }`. **Where:** response body.

### 4. Clinical validation (LLM)
- **POST /api/clinical/validate** — Suggests follow-up questions or missing elements for a clinical snippet (Zero Trust–style).
- **How it works:** Uses a fixed system prompt + documentation framework (no fine-tuning). LLM order: Claude (primary) → OpenAI (fallback) → Bedrock. With `fast: true` uses smallest/fastest model (e.g. Haiku) for chat.
- **Input:** Body `{ "text": "string", "fast": false }`. **Output:** `{ "suggestions": [ { "question", "rationale", "priority" } ], "basis", "configured", "error" }`. **Where:** response body.

### 5. Chat complete (end of chat / stop button)
- **POST /api/chat/complete** — When user stops or ends the chat, summarizes transcript and returns suggested note + gaps.
- **How it works:** Sends full transcript to LLM (fast model); returns structured JSON.
- **Input:** Body `{ "transcript": "string" }`. **Output:** `{ "suggested_note", "remaining_gaps": [], "complete", "error" }`. **Where:** response body.

### 6. Records (S3)
- **POST /api/records** — Stores a record (e.g. JSON or text) in S3.
- **How it works:** Uses `SAGING_S3_BUCKET` + AWS creds (env or IAM). `PutObject` with given key and body.
- **Input:** Body `{ "key": "e.g. patient-123/visit-1.json", "body": "string" }`. **Output:** `{ "ok", "key" }` or `{ "ok": false, "error" }`. **Where:** response body.

### 7. Voice-to-text (Step 6 placeholder)
- **POST /api/transcribe** — Placeholder for voice teammate. Contract: audio (or URL) in → transcript out. Currently returns 501 or mock.
- **Input:** (TBD when implemented) e.g. `{ "audio_base64" }` or `{ "audio_url" }`. **Output:** (TBD) e.g. `{ "transcript", "segments" }`. **Where:** response body.

### 8. Summary (for app to show summarized note)
- **POST /api/summary** — Store summary for a session (e.g. after chat/complete, save `suggested_note`). Body: `{ "session_id", "summary" }`. In-memory until DB.
- **GET /api/summary?session_id=...** — Get stored summary so the app can display it. 404 if none.
- **Input:** POST body or query `session_id`. **Output:** `{ "session_id", "summary" }`. **Where:** response body.

---

## What expects input from the frontend / caller

| Endpoint | Expects from caller |
|----------|----------------------|
| POST /api/redact | Text string to redact. |
| POST /api/clinical/validate | Clinical snippet + optional `fast` flag. |
| POST /api/chat/complete | Full chat transcript. |
| POST /api/records | S3 key and body (e.g. final note or JSON). |
| POST /api/transcribe | Audio (or URL) once implemented. |

All other endpoints are GET with no body.

---

## What we provide as output (and where)

- **All responses:** JSON in the HTTP response body. Shapes are in OpenAPI (`/docs`) and in this doc.
- **Redact:** Redacted text + spans (for highlighting or downstream LLM).
- **Validate:** List of suggestions (question, rationale, priority) + basis string (for citations).
- **Chat complete:** Suggested note + remaining_gaps + complete flag (for UI and optional storage).
- **Records:** Success/failure + key (for confirmation and later retrieval from S3).

---

## Services we do not have here (depend on other team members)

1. **PII redaction service** — Optional for *redaction* only: if teammate exposes an HTTP API that accepts `{ "text" }` and returns `{ "redacted_text", "spans" }`, set `PII_SERVICE_URL` and we call it. Otherwise we use in-app regex. (This is not the *source* of patient files; the pipeline that ingests old patient documents for standardizing/storing is separate and in backlog.)
2. **Voice-to-text** — Not implemented. When teammate provides Whisper or another service, we’ll call it from `POST /api/transcribe` (contract: audio in → transcript out).
3. **Frontend / Hexi UI** — Live chat, orb, stop button, etc. are built elsewhere; they call our API.
4. **MCP / Poke, Fetch.ai billing agent** — Not implemented; in layout as future steps.

---

## Next items (short)

- **Step 6 (voice):** Implement real `POST /api/transcribe` when voice teammate is ready (audio → transcript).
- **Step 8 (MCP/Poke):** Expose endpoints or MCP server so Poke can query patient status / incomplete records.
- **Step 9 (Fetch.ai):** Chart-complete event or endpoint for billing agent.
- **Step 10:** Deployment polish (Dockerfile exists; deploy to one env).
- **Backlog:** Final doc → standardized format → PDF → S3; DB with hashed/masked/encrypted sensitive data.
- **Backlog:** Source of old patient docs (scan/PII pipeline) → standardize fixed columns/fields → store DB + S3; main formatted doc = fixed schema; Zero Trust questionnaire fills gaps (separate transcript PDF).
- **Backlog:** Store transcribed + summarized data; **endpoint for summary** so app can show summary (e.g. GET /api/summary or GET /api/sessions/{id}/summary).

---

*Update this file after completing each step.*
