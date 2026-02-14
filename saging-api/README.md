# Saging API — Integration Backend

This folder contains **only** the API/integration backend for Saging. It does not modify the existing `backend/` folder (local PII model, PDF redactor, etc.).

**Responsibilities:**
- REST API endpoints for the frontend
- Integrations: LLM (e.g. OpenEvidence), PII service, future voice-to-text
- Data layer, S3, secrets (e.g. AWS Secrets Manager)
- Deployments and service wiring

**Stack (per blueprint):** Python, FastAPI, async; Swagger/OpenAPI for docs.

---

## Run (Step 1)

```bash
cd saging-api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # optional; edit if you need overrides
uvicorn app.main:app --reload --port 8000
```

- **API:** http://localhost:8000  
- **Swagger UI:** http://localhost:8000/docs  
- **ReDoc:** http://localhost:8000/redoc  
- **Health:** http://localhost:8000/health  
- **Ready:** http://localhost:8000/ready  

## AWS (bucket + Secrets Manager)

1. **One-time setup** (creates S3 bucket + secret with dummy values):
   ```bash
   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
   python scripts/setup_aws.py
   ```
2. In **AWS Console → Secrets Manager**, open `saging-api-secrets` and replace dummy values (especially `OPENAI_API_KEY` for LLM).
3. **Run app with secrets:** set `USE_AWS_SECRETS=1`, `SAGING_SECRETS_NAME=saging-api-secrets`, and AWS creds (or IAM role), then start uvicorn.

See [docs/REQUIRED_SECRET_KEYS.md](./docs/REQUIRED_SECRET_KEYS.md) and [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

See [LAYOUT.md](./LAYOUT.md) for the step-by-step implementation plan.
