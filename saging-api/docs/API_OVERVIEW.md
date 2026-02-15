# Saging API — Overview for Frontend

Base URL: `http://localhost:8000` (or your deployment URL).  
OpenAPI (Swagger): `GET /docs`, ReDoc: `GET /redoc`.

---

## Health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness |

---

## Config & status

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | `{ llm, s3 }` — which integrations are configured |
| GET | `/api/clinical/framework` | Documentation framework text (for citations) |

---

## PII redaction
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/redact` | Redact PII from text. Body: `{ "text": "..." }`. Response: `{ "redacted_text", "spans": [{ "start", "end", "label" }], "error" }`. If `PII_SERVICE_URL` is set, calls that service; else in-app regex (email, phone, SSN, dates). |

---

## Voice-to-text (placeholder)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/transcribe` | Placeholder. Body: `{ "audio_base64" }` or `{ "audio_url" }`. Response: `{ "transcript", "segments", "error" }`. Real impl when voice teammate is ready. |

---

## Live chat flow

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clinical/validate` | **During chat:** send latest note/snippet; get follow-up suggestions. Use `fast: true` in body for smallest/fastest model (spontaneous feel). |
| POST | `/api/chat/complete` | **End of chat / stop button:** send full transcript; get suggested note, remaining gaps, and `complete` flag. |

### POST /api/clinical/validate

- **Body:** `{ "text": "Patient is drowsy after surgery", "fast": true }`
- **Response:** `{ "suggestions": [ { "question", "rationale", "priority" } ], "basis", "configured", "error" }`
- Use **fast: true** for real-time chat; omit or false for full model when you need stronger justification.

### POST /api/chat/complete

- **Body:** `{ "transcript": "10:02 Patient entered...\n10:03 Initial observation..." }`
- **Response:** `{ "suggested_note", "remaining_gaps": [], "complete": bool, "error" }`
- Call when user clicks stop or when you consider the chat “done.”

---

## Summary (for app to show summarized note)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/summary` | Store summary for a session. Body: `{ "session_id": "...", "summary": "..." }` (e.g. `suggested_note` from chat/complete). |
| GET | `/api/summary?session_id=...` | Get stored summary for a session so the app can display it. 404 if none. In-memory until DB. |

---

## Records (S3)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/records` | Store a record (e.g. final note) in S3. Body: `{ "key": "patient-123/visit-1.json", "body": "..." }` |

---

## Summary (usage)

- **During live chat:** `POST /api/clinical/validate` with `fast: true` and the current note (or accumulated text).
- **Override/append notes:** same endpoint; send the updated text as `text`.
- **Stop / end of chat:** `POST /api/chat/complete` with full `transcript`; then optionally `POST /api/summary` to store the suggested note and `GET /api/summary?session_id=...` to show it in the app; optionally `POST /api/records` to persist to S3.
