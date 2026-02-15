"""
Saging API — FastAPI app.
Health and readiness for Step 1; more endpoints added in later steps.
"""
from pathlib import Path

from dotenv import load_dotenv

# Load .env before secrets so USE_AWS_SECRETS and AWS creds are available
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.secrets import load_secrets_if_configured

load_secrets_if_configured()

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.llm import validate_clinical_snippet, complete_session, document_analyze_gaps, document_complete
from app.pii import redact_text

app = FastAPI(
    title="Saging API",
    description="Integration backend for Saging — frontend, PII, LLM, voice, storage.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Health", "description": "Liveness and readiness."},
        {"name": "API", "description": "Clinical validate, chat complete, records."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def root():
    """List main endpoints. Use /docs for full Swagger UI."""
    return {
        "service": "Saging API",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": [
            "GET /health",
            "GET /ready",
            "GET /api/status",
            "POST /api/redact",
            "GET /api/clinical/framework",
            "POST /api/clinical/validate",
            "POST /api/chat/complete",
            "POST /api/documents/analyze",
            "POST /api/documents/analyze-upload",
            "POST /api/documents/complete",
            "POST /api/tts",
            "POST /api/transcribe",
            "POST /api/summary",
            "GET /api/summary",
            "POST /api/summary/persist",
            "POST /api/records",
        ],
    }


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
from typing import Optional, List

class ValidateRequest(BaseModel):
    text: str
    fast: bool = False  # use smallest/fastest model for chat (spontaneous feel)
    role: str = "patient"  # "patient" | "practitioner" — practitioner = doctor asking, AI suggests follow-ups for doctor

class SuggestionItem(BaseModel):
    question: str
    rationale: str
    priority: str  # "critical" | "important" | "recommended"

class ValidateResponse(BaseModel):
    suggestions: List[SuggestionItem]
    basis: str
    complete: bool = False  # true when no more follow-ups needed
    configured: bool
    error: Optional[str] = None


@app.get("/api/status", tags=["API"])
def api_status():
    """Which integrations are configured (for testing after Secrets Manager)."""
    return {
        "llm": settings.has_llm(),
        "s3": settings.has_s3(),
        "pii_service": bool(settings.pii_service_url),
    }


class RedactRequest(BaseModel):
    text: str


class RedactSpan(BaseModel):
    start: int
    end: int
    label: str


class RedactResponse(BaseModel):
    redacted_text: str
    spans: List[RedactSpan]
    error: Optional[str] = None


@app.post("/api/redact", response_model=RedactResponse, tags=["API"])
def redact(body: RedactRequest):
    """
    Redact PII from text. If PII_SERVICE_URL is set, calls that service;
    otherwise uses in-app regex fallback (email, phone, SSN, dates).
    Returns redacted text and spans (start, end, label) for highlighting.
    """
    out = redact_text(body.text)
    spans = [RedactSpan(start=s["start"], end=s["end"], label=s.get("label", "PII")) for s in out.get("spans", [])]
    return RedactResponse(
        redacted_text=out.get("redacted_text", body.text),
        spans=spans,
        error=out.get("error"),
    )


@app.get("/api/clinical/framework", tags=["API"])
def clinical_framework():
    """
    Return the documentation framework used to justify validation suggestions.
    Frontend or auditors can cite this as the basis for LLM responses.
    """
    from app.prompts import DOCUMENTATION_FRAMEWORK
    return {"framework": DOCUMENTATION_FRAMEWORK}


@app.post("/api/clinical/validate", response_model=ValidateResponse, tags=["API"])
def clinical_validate(body: ValidateRequest):
    """
    Suggest follow-up questions or missing elements for a clinical snippet.
    Set fast=true for live chat (uses smallest/fastest model for spontaneous feel).
    Responses include rationale and basis so they are justifiable.
    """
    out = validate_clinical_snippet(body.text, fast=body.fast, role=(body.role or "patient"))
    raw_suggestions = out.get("suggestions") or []
    suggestions = [
        SuggestionItem(
            question=s.get("question", ""),
            rationale=s.get("rationale", ""),
            priority=s.get("priority") or "recommended",
        )
        for s in raw_suggestions
    ]
    return ValidateResponse(
        suggestions=suggestions,
        basis=out.get("basis") or "",
        complete=out.get("complete", False),
        configured=settings.has_llm(),
        error=out.get("error"),
    )


# ---- Chat / session complete (end of chat or stop button) ----

class ChatCompleteRequest(BaseModel):
    transcript: str  # full live chat transcript to summarize

class ChatCompleteResponse(BaseModel):
    suggested_note: str
    remaining_gaps: List[str]
    complete: bool
    recommendations: str = ""  # e.g. OTC options, when to consult doctor
    error: Optional[str] = None


@app.post("/api/chat/complete", response_model=ChatCompleteResponse, tags=["API"])
def chat_complete(body: ChatCompleteRequest):
    """
    Call when user hits stop or ends the chat. Sends full transcript,
    returns suggested chart note, remaining gaps, complete flag, and recommendations.
    """
    out = complete_session(body.transcript)
    return ChatCompleteResponse(
        suggested_note=out.get("suggested_note") or "",
        remaining_gaps=out.get("remaining_gaps") or [],
        complete=out.get("complete", False),
        recommendations=out.get("recommendations") or "",
        error=out.get("error"),
    )


# ---- Documents: analyze for gaps (our format), complete from transcript ----

class DocumentGapItem(BaseModel):
    question: str
    field: str
    priority: str


class DocumentAnalyzeRequest(BaseModel):
    document_text: str


class DocumentAnalyzeResponse(BaseModel):
    gaps: List[DocumentGapItem]
    summary: str
    extracted_text: Optional[str] = None  # set when analyzing from uploaded file (PDF/TXT)
    error: Optional[str] = None


class DocumentCompleteRequest(BaseModel):
    document_text: str
    transcript: str


class DocumentCompleteResponse(BaseModel):
    completed_document: str
    error: Optional[str] = None


@app.post("/api/documents/analyze", response_model=DocumentAnalyzeResponse, tags=["API"])
def documents_analyze(body: DocumentAnalyzeRequest):
    """
    Compare the uploaded document to our documentation framework; return missing info as gaps (questions to ask).
    Send document_text in JSON. For PDF/TXT file upload use POST /api/documents/analyze-upload.
    """
    out = document_analyze_gaps(body.document_text or "")
    raw_gaps = out.get("gaps") or []
    gaps = [DocumentGapItem(question=g.get("question", ""), field=g.get("field", ""), priority=g.get("priority", "recommended")) for g in raw_gaps]
    return DocumentAnalyzeResponse(gaps=gaps, summary=out.get("summary") or "", error=out.get("error"))


@app.post("/api/documents/analyze-upload", response_model=DocumentAnalyzeResponse, tags=["API"])
async def documents_analyze_upload(file: UploadFile = File(...)):
    """
    Upload a PDF or TXT file; we extract text and run the same analysis as /api/documents/analyze.
    Like ChatGPT: you attach the doc, we read it and return gaps (missing info) + the extracted text for later completion.
    """
    from app.documents import extract_text_from_file
    content = await file.read()
    text = extract_text_from_file(content, file.filename or "")
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file. Use PDF or TXT.")
    out = document_analyze_gaps(text)
    raw_gaps = out.get("gaps") or []
    gaps = [DocumentGapItem(question=g.get("question", ""), field=g.get("field", ""), priority=g.get("priority", "recommended")) for g in raw_gaps]
    return DocumentAnalyzeResponse(
        gaps=gaps,
        summary=out.get("summary") or "",
        extracted_text=text,
        error=out.get("error"),
    )


@app.post("/api/documents/complete", response_model=DocumentCompleteResponse, tags=["API"])
def documents_complete(body: DocumentCompleteRequest):
    """
    Fill the document with information from the encounter transcript. Clinician takes precedence; do not contradict.
    """
    out = document_complete(body.document_text or "", body.transcript or "")
    return DocumentCompleteResponse(
        completed_document=out.get("completed_document") or body.document_text or "",
        error=out.get("error"),
    )


# ---- TTS (human-like voice when OpenAI key is set) ----

class TTSRequest(BaseModel):
    text: str


@app.post("/api/tts", tags=["API"])
def tts_speak(body: TTSRequest):
    """
    Return MP3 audio for the given text (OpenAI TTS). More human-like than browser SpeechSynthesis.
    If TTS not configured, returns 503. Frontend can fall back to browser speech.
    """
    from fastapi.responses import Response
    from app.tts import has_tts, synthesize
    if not has_tts():
        raise HTTPException(status_code=503, detail="TTS not configured. Set OPENAI_API_KEY for human-like voice.")
    audio = synthesize(body.text)
    if not audio:
        raise HTTPException(status_code=500, detail="TTS failed")
    return Response(content=audio, media_type="audio/mpeg")


# ---- Voice-to-text (Step 6 placeholder; real impl when teammate is ready) ----

class TranscribeRequest(BaseModel):
    audio_base64: Optional[str] = None  # base64-encoded audio
    audio_url: Optional[str] = None   # or URL to audio file

class TranscribeResponse(BaseModel):
    transcript: str
    segments: Optional[List[dict]] = None  # optional [{ start, end, text }]
    error: Optional[str] = None


@app.post("/api/transcribe", response_model=TranscribeResponse, tags=["API"])
def transcribe(body: TranscribeRequest):
    """
    Voice-to-text placeholder. Contract: audio (base64 or URL) in → transcript out.
    Returns 501-style mock until voice teammate provides real service; then we call it here.
    """
    # Placeholder: no voice service yet
    if body.audio_base64 or body.audio_url:
        return TranscribeResponse(
            transcript="[Transcribe not implemented yet. Send audio_base64 or audio_url when voice service is ready.]",
            segments=None,
            error="Not implemented",
        )
    return TranscribeResponse(transcript="", segments=None, error="Provide audio_base64 or audio_url.")


# ---- Summary (for app to show transcribed/summarized note; in-memory until DB) ----

# In-memory store: session_id -> summary. Replace with DB when available.
_summary_store: dict = {}

class SummaryPutRequest(BaseModel):
    session_id: str
    summary: str  # e.g. suggested_note from chat/complete

class SummaryResponse(BaseModel):
    session_id: str
    summary: str


@app.post("/api/summary", response_model=SummaryResponse, tags=["API"])
def put_summary(body: SummaryPutRequest):
    """
    Store a summary for a session (e.g. after chat/complete, save suggested_note).
    In-memory for now; will be backed by DB when available. App can then GET to show it.
    """
    _summary_store[body.session_id] = body.summary
    return SummaryResponse(session_id=body.session_id, summary=body.summary)


@app.get("/api/summary", response_model=SummaryResponse, tags=["API"])
def get_summary(session_id: str):
    """
    Get the stored summary for a session so the app can display it.
    Returns 404 if no summary stored for that session_id.
    """
    if session_id not in _summary_store:
        raise HTTPException(status_code=404, detail="No summary for this session")
    return SummaryResponse(session_id=session_id, summary=_summary_store[session_id])


class SummaryPersistRequest(BaseModel):
    session_id: str
    patient_id: Optional[str] = None  # optional; will be stored masked in DDB


class SummaryPersistResponse(BaseModel):
    ok: bool
    s3_key: Optional[str] = None
    ddb_logged: bool = False
    error: Optional[str] = None


@app.post("/api/summary/persist", response_model=SummaryPersistResponse, tags=["API"])
def persist_summary(body: SummaryPersistRequest):
    """
    After storing a summary (POST /api/summary), call this to upload it to S3 and log to DDB.
    S3 key: summaries/{session_id}.txt. DDB record: masked patient ref + s3_key (if SAGING_DDB_TABLE set).
    """
    if body.session_id not in _summary_store:
        raise HTTPException(status_code=404, detail="No summary for this session. Call POST /api/summary first.")
    summary_text = _summary_store[body.session_id]
    s3_key = f"summaries/{body.session_id}.txt"
    if not settings.has_s3():
        return SummaryPersistResponse(ok=False, error="S3 not configured. Set SAGING_S3_BUCKET.")
    try:
        import boto3
        s3 = boto3.client("s3", region_name=settings.aws_region)
        s3.put_object(
            Bucket=settings.saging_s3_bucket,
            Key=s3_key,
            Body=summary_text.encode("utf-8"),
            ContentType="text/plain",
        )
        ddb_ok = False
        try:
            from app.ddb import put_summary_record
            ddb_ok = put_summary_record(body.session_id, s3_key, body.patient_id)
        except Exception:
            pass
        return SummaryPersistResponse(ok=True, s3_key=s3_key, ddb_logged=ddb_ok)
    except Exception as e:
        return SummaryPersistResponse(ok=False, error=str(e))


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
