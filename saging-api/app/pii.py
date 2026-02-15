"""
PII redaction: call optional external PII service or use in-app fallback.
Contract: text in → redacted_text + spans (for frontend or downstream LLM).
"""
import re
from typing import Any

import httpx

from app.config import settings


def redact_text(text: str) -> dict[str, Any]:
    """
    Redact PII from text. If PII_SERVICE_URL is set, call it; else use in-app fallback.
    Returns { "redacted_text", "spans": [ {"start", "end", "label"} ], "error" }.
    """
    if settings.pii_service_url:
        return _redact_via_service(text)
    return _redact_fallback(text)


def _redact_via_service(text: str) -> dict[str, Any]:
    """POST to teammate's PII service. Expects JSON: { text } -> { redacted_text, spans }."""
    url = (settings.pii_service_url or "").rstrip("/")
    # Try common paths
    for path in ["/api/redact-text", "/redact-text", "/api/redact"]:
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.post(
                    f"{url}{path}",
                    json={"text": text},
                    headers={"Content-Type": "application/json"},
                )
                r.raise_for_status()
                data = r.json()
                return {
                    "redacted_text": data.get("redacted_text", text),
                    "spans": data.get("spans", []),
                    "error": None,
                }
        except httpx.HTTPError as e:
            continue
        except Exception as e:
            return {
                "redacted_text": text,
                "spans": [],
                "error": f"PII service error: {e}",
            }
    return {
        "redacted_text": text,
        "spans": [],
        "error": "PII service not reachable or returned an error. Using fallback.",
    }


def _redact_fallback(text: str) -> dict[str, Any]:
    """
    In-app fallback: simple regex-based PII detection and masking.
    Spans use character offsets; labels are generic. Good for demo when no external service.
    """
    spans = []
    # Patterns: (label, regex). We search and mask with asterisks.
    patterns = [
        ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")),
        ("PHONE", re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")),
        ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
        ("DATE", re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")),
    ]
    result = text
    # Process in reverse order of match start so we don't shift offsets
    for label, pat in patterns:
        for m in pat.finditer(text):
            spans.append({"start": m.start(), "end": m.end(), "label": label})
    # Sort by start and build redacted string (non-overlapping replacement)
    spans.sort(key=lambda s: s["start"])
    if spans:
        # Merge overlapping and replace
        merged = _merge_spans(spans)
        for s in reversed(merged):
            result = result[: s["start"]] + "*" * (s["end"] - s["start"]) + result[s["end"] :]
    return {"redacted_text": result, "spans": spans, "error": None}


def _merge_spans(spans: list) -> list:
    """Merge overlapping spans; return sorted by start."""
    if not spans:
        return []
    out = [{"start": spans[0]["start"], "end": spans[0]["end"]}]
    for s in spans[1:]:
        if s["start"] <= out[-1]["end"]:
            out[-1]["end"] = max(out[-1]["end"], s["end"])
        else:
            out.append({"start": s["start"], "end": s["end"]})
    return out
