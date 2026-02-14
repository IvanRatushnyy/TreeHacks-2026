"""
Saging API — FastAPI app.
Health and readiness for Step 1; more endpoints added in later steps.
"""
from app.secrets import load_secrets_if_configured

load_secrets_if_configured()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.llm import validate_clinical_snippet

app = FastAPI(
    title="Saging API",
    description="Integration backend for Saging — frontend, PII, LLM, voice, storage.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health():
    """Liveness: is the process up?"""
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
def ready():
    """Readiness: is the app ready to accept traffic? (e.g. DB/optional deps later.)"""
    return {"status": "ready"}


# ----- API (Steps 3–5) -----

from pydantic import BaseModel

class ValidateRequest(BaseModel):
    text: str

class ValidateResponse(BaseModel):
    suggestions: str
    configured: bool


@app.get("/api/status", tags=["API"])
def api_status():
    """Which integrations are configured (for testing after Secrets Manager)."""
    return {
        "llm": settings.has_llm(),
        "s3": settings.has_s3(),
    }


@app.post("/api/clinical/validate", response_model=ValidateResponse, tags=["API"])
def clinical_validate(body: ValidateRequest):
    """
    Suggest follow-up questions or missing elements for a clinical snippet.
    Uses OpenAI or Bedrock (replaces OpenEvidence).
    """
    suggestions = validate_clinical_snippet(body.text)
    return ValidateResponse(suggestions=suggestions, configured=settings.has_llm())


class RecordCreate(BaseModel):
    key: str  # e.g. "patient-123/visit-1.json"
    body: str  # JSON string or text to store


@app.post("/api/records", tags=["API"])
def create_record(r: RecordCreate):
    """Store a record in S3 (demo). Requires SAGING_S3_BUCKET and AWS creds."""
    if not settings.has_s3():
        return {"ok": False, "error": "S3 not configured. Set SAGING_S3_BUCKET."}
    try:
        import boto3
        s3 = boto3.client("s3", region_name=settings.aws_region)
        s3.put_object(
            Bucket=settings.saging_s3_bucket,
            Key=r.key,
            Body=r.body.encode("utf-8"),
            ContentType="application/json",
        )
        return {"ok": True, "key": r.key}
    except Exception as e:
        return {"ok": False, "error": str(e)}
