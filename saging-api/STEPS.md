# Saging — To-Do Steps (come back to these)

Use this list to track what’s done and what’s next. One thing at a time: do a step → test → then move on.

---

## Done recently
- [x] **Generate summary for Practitioner and Patient** — Button shown in both modes; Practitioner label “Generate summary”, Patient “Done & generate summary”.
- [x] **Summary → S3 + DDB** — On generate summary we store in memory, then call `POST /api/summary/persist` to upload to S3 (`summaries/{session_id}.txt`) and log to DynamoDB (masked patient ref + s3_key). Requires `SAGING_S3_BUCKET`; optional `SAGING_DDB_TABLE`.

---

## Next steps (in order)

### 1. Doc upload / scan / media → PII → PDF → S3 + DDB
- [ ] Add UI and API for **uploading docs, scanning docs, or uploading media**.
- [ ] Send upload through **PII system** (existing redaction pipeline).
- [ ] Receive **PDF back** in good format from PII/redaction.
- [ ] **Upload PDF to S3** (e.g. `documents/{id}.pdf`).
- [ ] **Record in DynamoDB** with masked patient details pointing to the file.
- **Deliverable:** User can upload a doc/scan/media → PII runs → PDF stored in S3 + DDB record (masked).

### 2. DynamoDB table (if not already created)
- [ ] Create DynamoDB table for summary records (e.g. `saging-summary-records`) with PK `session_id`, attributes: `s3_key`, `patient_id_masked`, `created_at`, `type`.
- [ ] Same or separate table for document records (doc upload pipeline).
- [ ] Set `SAGING_DDB_TABLE` in env when ready.

### 3. Step 7 — Storage (S3) — polish
- [ ] S3 bucket created; versioning if needed.
- [ ] `POST /api/records` tested; frontend can save records via API.
- [ ] Optional: retention / Object Lock later.

### 4. Step 6 — Voice-to-text (real impl)
- [ ] When teammate is ready: replace `POST /api/transcribe` placeholder with real call (Whisper or their service).

### 5. Step 8 — MCP / Poke (if in scope)
- [ ] MCP server or endpoints so Poke can query patient status / incomplete records.

### 6. Step 9 — Fetch.ai / Billing (if in scope)
- [ ] “Chart complete” → notify billing agent or endpoint for encounter summary.

### 7. Step 10 — Deployment & polish
- [ ] Dockerfile; deploy to one environment; CORS, rate limiting, env-based URLs.

---

## Backlog (later)
- [ ] **DB with protected data:** Encounter/session data in DB; sensitive fields hashed/masked/encrypted.
- [ ] **Source of old patient docs:** Ingest from scan/PII pipeline → standardize → DB + S3; fixed schema doc + Zero Trust questionnaire.
- [ ] **Transcribed + summarized storage:** Persist transcript + summary; endpoint for app to show summary (e.g. GET /api/sessions/{id}/summary).

---

**Reference:** Full layout and history in `LAYOUT.md`.
