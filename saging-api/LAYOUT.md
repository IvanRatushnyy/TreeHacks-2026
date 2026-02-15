# Saging API — Step-by-Step Layout

One thing at a time: do a step → test (e.g. Swagger) → add keys/S3/secrets if needed → then move on.

---

## Step 1 — Foundation ✅
- [x] Create FastAPI app (minimal)
- [x] Health/readiness endpoint (e.g. `GET /health`)
- [x] Run locally, open Swagger UI (`/docs`), confirm it works
- [x] Add `.env` / env vars pattern (no secrets in code)

**Deliverable:** App runs, `/docs` works, health check passes.

---

## Step 2 — Config & secrets pattern ✅
- [x] Central config (env: `PORT`, `ENV`, optional `OPENEVIDENCE_API_KEY`, etc.)
- [x] Document which keys we’ll need (OpenEvidence, future voice, etc.)
- [x] Optional: wire AWS Secrets Manager (or keep `.env` for hackathon)
- [x] No secrets in repo; `.env.example` only

**Deliverable:** Config module; list of required API keys; optional Secrets Manager.

---

## Step 3 — First “data” endpoint
- [ ] One simple endpoint the frontend will call (e.g. `GET /api/patient/{id}` or `GET /api/status`)
- [ ] Return mock/static JSON first
- [ ] Test in Swagger
- [ ] Define request/response shapes (Pydantic models)

**Deliverable:** One working endpoint; clear contract for frontend.

---

## Step 4 — PII integration ✅
- [x] Define how this API talks to the PII model (HTTP to teammate’s service, or local call)
- [x] One endpoint: `POST /api/redact` — body: `{ "text": "..." }`, response: redacted text + spans
- [x] Call PII service from FastAPI; handle errors/timeouts (10s); fallback if no URL
- [x] Test in Swagger with sample clinical text

**Deliverable:** Frontend → Saging API → PII model; redaction works end-to-end.

---

## Step 5 — LLM integration (OpenEvidence)
- [ ] Get OpenEvidence API key; add to config/secrets
- [ ] One endpoint: e.g. `POST /api/clinical/validate` or `POST /api/evidence` — send anonymized snippet, get “missing criteria” or evidence
- [ ] Prompt logic: e.g. “What are required elements for X?” / “Is this complete?”
- [ ] Test in Swagger

**Deliverable:** Zero-Trust-style validation using OpenEvidence.

---

## Step 6 — Voice-to-text (future) ✅ placeholder
- [x] Placeholder endpoint: `POST /api/transcribe` (mock; returns transcript message + error until real impl)
- [ ] When teammate is ready: replace with real call (Whisper API or their service)
- [x] Contract: input = `audio_base64` or `audio_url`, output = `transcript`, `segments`, `error`

**Deliverable:** Stable API contract; implementation can be stubbed then filled in.

---

## Step 7 — Storage (S3)
- [ ] Create S3 bucket (manual or Terraform); enable versioning if we need Object Lock later
- [ ] Config: bucket name, region; credentials via env or IAM
- [ ] One endpoint: e.g. `POST /api/records` — accept JSON (or file), store in S3, return key/version
- [ ] Optional: add retention/Object Lock (Terraform in doc) later

**Deliverable:** Frontend can “save” a record to S3 via API.

---

## Step 8 — MCP / Poke (if in scope)
- [ ] MCP server in separate process or same repo; Saging API exposes no direct Poke code
- [ ] API endpoints that MCP can call: e.g. `get_patient_status`, `check_incomplete_records`
- [ ] Reuse or mirror existing API routes so MCP = thin client over same API

**Deliverable:** MCP server calls Saging API; Poke can query patient status.

---

## Step 9 — Fetch.ai / Billing agent (if in scope)
- [ ] Event or webhook: “chart complete” → notify billing agent
- [ ] Or endpoint billing agent calls to fetch structured encounter data
- [ ] Keep scope small: e.g. “mark complete” + “get encounter summary for billing”

**Deliverable:** Billing agent can react to completed charts and get data via API.

---

## Step 10 — Deployment & polish
- [ ] Dockerfile for Saging API
- [ ] Deploy to one environment (e.g. Fly.io, Railway, or AWS)
- [ ] CORS, rate limiting, and env-based URLs for frontend

**Deliverable:** API deployable and callable by frontend in one environment.

---

## Notes
- **Feasibility:** If something from the Google doc is too heavy (e.g. full PQC, full Object Lock), we can do a minimal version and note “BAA-ready” or “demo only.”
- **Order:** Steps 1–3 are mandatory. 4–5 are core (PII + LLM). 6–10 can be reordered or dropped based on time and teammates.

## Eventually / Backlog
- [ ] **Final doc to S3:** Generate doc from user input/scanning, standardize format, create PDF, store in S3.
- [ ] **Doc upload / scan / media → PII → PDF → S3 + DDB:** Upload docs, scanning, or media; send through PII system; receive PDF back in good format; upload PDF to S3; record in DDB with masked patient details. *(See `STEPS.md` for ordered to-dos.)*
- [ ] **DB with protected data:** Store encounter/session data in a DB; sensitive fields hashed/masked/encrypted so a leak does not expose PHI.
- [ ] **Source of old patient docs:** Ingest patient documents (from scan/PII pipeline) → standardize into fixed columns/fields → store in DB + S3. Main formatted doc = fixed schema; Zero Trust questionnaire can fill gaps (separate transcript PDF).
- [ ] **Transcribed + summarized storage:** Store transcribed data (voice/text export) and its summary; **endpoint for summary** so the app can show the summary (e.g. GET /api/summary or GET /api/sessions/{id}/summary).

---

**To-do list:** See **`STEPS.md`** for the current ordered list of steps (including doc upload, DDB table, etc.) so we don’t forget to come back.

**What do you want to do first?**  
Reply with the step number (or “Step 1”) and we’ll implement only that, test in Swagger, then move on.
