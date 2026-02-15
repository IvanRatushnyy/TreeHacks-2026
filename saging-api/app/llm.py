"""
Clinical validation via LLM (replaces OpenEvidence).
Uses a fixed system prompt and documentation framework (no fine-tuning);
responses are structured (suggestions + rationale + basis) so they are justifiable.
Order: Claude (CLAUDE_API_KEY) → OpenAI fallback → Bedrock.
"""
import json
import re
from typing import Any

from app.config import settings
from app.prompts import (
    CLINICAL_VALIDATION_SYSTEM_PROMPT,
    CLINICAL_VALIDATION_FAST_SYSTEM_PROMPT,
    CLINICAL_VALIDATION_FAST_PRACTITIONER_SYSTEM_PROMPT,
    SESSION_COMPLETE_SYSTEM_PROMPT,
    DOCUMENT_ANALYZE_SYSTEM_PROMPT,
    DOCUMENT_COMPLETE_SYSTEM_PROMPT,
    build_validation_user_prompt,
    build_validation_user_prompt_fast,
    build_validation_user_prompt_fast_practitioner,
    build_session_complete_prompt,
)


def validate_clinical_snippet(text: str, *, fast: bool = False, role: str = "patient") -> dict[str, Any]:
    """
    Ask LLM what might be missing or unclear in a clinical snippet.
    Returns structured dict: suggestions (list of {question, rationale, priority}), basis, optional error.
    Uses Claude first; falls back to OpenAI then Bedrock.
    """
    if not settings.has_llm():
        return {
            "suggestions": [],
            "basis": "",
            "complete": False,
            "error": "LLM not configured. Set CLAUDE_API_KEY or OPENAI_API_KEY, or use Bedrock.",
        }

    raw: str
    practitioner = (role or "patient").strip().lower() == "practitioner"
    key_claude = (settings.claude_api_key or "").strip()
    if key_claude and not key_claude.startswith("sk-ant-dummy"):
        raw = _claude_validate(text, fast=fast, practitioner=practitioner and fast)
    else:
        key_openai = (settings.openai_api_key or "").strip()
        if key_openai and not key_openai.startswith("sk-dummy"):
            raw = _openai_validate(text, fast=fast, practitioner=practitioner and fast)
        elif settings.llm_provider == "bedrock":
            raw = _bedrock_validate(text, fast=fast, practitioner=practitioner and fast)
        else:
            return {"suggestions": [], "basis": "", "complete": False, "error": "LLM not configured."}

    if raw.startswith("Claude error:") or raw.startswith("OpenAI error:") or raw.startswith("Bedrock error:"):
        return {"suggestions": [], "basis": "", "complete": False, "error": raw}
    return _parse_validation_response(raw)


def _parse_validation_response(raw: str) -> dict[str, Any]:
    """Parse LLM JSON output; fallback to wrapping plain text if parsing fails."""
    raw = raw.strip()
    # Try to extract JSON block if model wrapped it in markdown
    json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw)
    if json_match:
        raw = json_match.group(1)
    # Or find first { ... } in the response
    brace = raw.find("{")
    if brace >= 0:
        raw = raw[brace:]
    try:
        data = json.loads(raw)
        suggestions = data.get("suggestions") or []
        if not isinstance(suggestions, list):
            suggestions = []
        else:
            suggestions = [
                {
                    "question": str(s.get("question", "")),
                    "rationale": str(s.get("rationale", "")),
                    "priority": str(s.get("priority", "recommended")).lower()
                    if s.get("priority") in ("critical", "important", "recommended")
                    else "recommended",
                }
                for s in suggestions
            ]
        basis = str(data.get("basis", "")).strip()
        basis_lower = (basis or "").lower()
        complete = len(suggestions) == 0 and any(
            x in basis_lower for x in ("sufficient", "complete", "no further", "good coverage", "meets")
        )
        return {
            "suggestions": suggestions,
            "basis": basis or "Documentation framework (see API docs).",
            "complete": complete,
            "error": None,
        }
    except (json.JSONDecodeError, TypeError):
        return {
            "suggestions": [{"question": raw[:500], "rationale": "Model returned free text.", "priority": "recommended"}],
            "basis": "Response not in structured format; displayed as provided.",
            "complete": False,
            "error": None,
        }


# Fast models: smallest/fastest for chat (spontaneous feel)
CLAUDE_FAST_MODEL = "claude-3-haiku-20240307"
CLAUDE_FULL_MODEL = "claude-sonnet-4-20250514"
OPENAI_FAST_MODEL = "gpt-4o-mini"
MAX_TOKENS_FAST = 256
MAX_TOKENS_FULL = 600


def _call_claude(user_content: str, *, system: str, model: str, max_tokens: int) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.claude_api_key)
    r = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    for block in r.content:
        if hasattr(block, "text") and block.text:
            return block.text.strip()
    return "No response from Claude."


def _claude_validate(text: str, *, fast: bool = False, practitioner: bool = False) -> str:
    try:
        import anthropic
    except ImportError:
        return "Claude error: Install anthropic: pip install anthropic"
    try:
        if fast:
            if practitioner:
                from app.prompts import build_validation_user_prompt_fast_practitioner
                return _call_claude(
                    build_validation_user_prompt_fast_practitioner(text),
                    system=CLINICAL_VALIDATION_FAST_PRACTITIONER_SYSTEM_PROMPT,
                    model=CLAUDE_FAST_MODEL,
                    max_tokens=MAX_TOKENS_FAST,
                )
            return _call_claude(
                build_validation_user_prompt_fast(text),
                system=CLINICAL_VALIDATION_FAST_SYSTEM_PROMPT,
                model=CLAUDE_FAST_MODEL,
                max_tokens=MAX_TOKENS_FAST,
            )
        return _call_claude(
            build_validation_user_prompt(text),
            system=CLINICAL_VALIDATION_SYSTEM_PROMPT,
            model=CLAUDE_FULL_MODEL,
            max_tokens=MAX_TOKENS_FULL,
        )
    except Exception as e:
        return f"Claude error: {e}"


def _openai_validate(text: str, *, fast: bool = False, practitioner: bool = False) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        return "OpenAI error: Install openai: pip install openai"
    client = OpenAI(api_key=settings.openai_api_key)
    if fast and practitioner:
        from app.prompts import build_validation_user_prompt_fast_practitioner
        system = CLINICAL_VALIDATION_FAST_PRACTITIONER_SYSTEM_PROMPT
        user_content = build_validation_user_prompt_fast_practitioner(text)
    else:
        system = CLINICAL_VALIDATION_FAST_SYSTEM_PROMPT if fast else CLINICAL_VALIDATION_SYSTEM_PROMPT
        user_content = build_validation_user_prompt_fast(text) if fast else build_validation_user_prompt(text)
    max_tokens = MAX_TOKENS_FAST if fast else MAX_TOKENS_FULL
    try:
        r = client.chat.completions.create(
            model=OPENAI_FAST_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            max_tokens=max_tokens,
        )
        return (r.choices[0].message.content or "").strip()
    except Exception as e:
        return f"OpenAI error: {e}"


def _bedrock_validate(text: str, *, fast: bool = False, practitioner: bool = False) -> str:
    try:
        import boto3
        import json as _json
    except ImportError:
        return "Bedrock error: boto3 required for Bedrock"
    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        if fast and practitioner:
            from app.prompts import build_validation_user_prompt_fast_practitioner
            system = CLINICAL_VALIDATION_FAST_PRACTITIONER_SYSTEM_PROMPT
            user_content = build_validation_user_prompt_fast_practitioner(text)
        else:
            system = CLINICAL_VALIDATION_FAST_SYSTEM_PROMPT if fast else CLINICAL_VALIDATION_SYSTEM_PROMPT
            user_content = build_validation_user_prompt_fast(text) if fast else build_validation_user_prompt(text)
        max_tokens = MAX_TOKENS_FAST if fast else MAX_TOKENS_FULL
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
        }
        resp = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=_json.dumps(body),
        )
        out = _json.loads(resp["body"].read())
        for block in out.get("content", []):
            if block.get("type") == "text":
                return (block.get("text", "") or "").strip()
        return "No response from Bedrock."
    except Exception as e:
        return f"Bedrock error: {e}"


# ---- Session complete (end of chat / stop button) ----

def complete_session(transcript: str) -> dict[str, Any]:
    """
    When user stops chat or ends session: summarize transcript and return
    suggested note + remaining gaps + complete flag. Uses fast model for speed.
    """
    if not settings.has_llm():
        return {
            "suggested_note": "",
            "remaining_gaps": [],
            "complete": False,
            "error": "LLM not configured.",
        }
    raw = _session_complete_call(transcript)
    if raw.startswith("Claude error:") or raw.startswith("OpenAI error:") or raw.startswith("Bedrock error:"):
        return {"suggested_note": "", "remaining_gaps": [], "complete": False, "error": raw}
    return _parse_session_complete_response(raw)


def _parse_session_complete_response(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw)
    if json_match:
        raw = json_match.group(1)
    brace = raw.find("{")
    if brace >= 0:
        raw = raw[brace:]
    try:
        data = json.loads(raw)
        return {
            "suggested_note": str(data.get("suggested_note", "")).strip(),
            "remaining_gaps": [str(x) for x in (data.get("remaining_gaps") or []) if x],
            "complete": bool(data.get("complete", False)),
            "recommendations": str(data.get("recommendations", "")).strip(),
            "error": None,
        }
    except (json.JSONDecodeError, TypeError):
        return {
            "suggested_note": raw[:800],
            "remaining_gaps": [],
            "complete": False,
            "recommendations": "",
            "error": "Response not in expected JSON format.",
        }


def _session_complete_call(transcript: str) -> str:
    key_claude = (settings.claude_api_key or "").strip()
    if key_claude and not key_claude.startswith("sk-ant-dummy"):
        return _claude_session_complete(transcript)
    key_openai = (settings.openai_api_key or "").strip()
    if key_openai and not key_openai.startswith("sk-dummy"):
        return _openai_session_complete(transcript)
    if settings.llm_provider == "bedrock":
        return _bedrock_session_complete(transcript)
    return "LLM not configured."


def _claude_session_complete(transcript: str) -> str:
    try:
        return _call_claude(
            build_session_complete_prompt(transcript),
            system=SESSION_COMPLETE_SYSTEM_PROMPT,
            model=CLAUDE_FAST_MODEL,
            max_tokens=400,
        )
    except Exception as e:
        return f"Claude error: {e}"


def _openai_session_complete(transcript: str) -> str:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        r = client.chat.completions.create(
            model=OPENAI_FAST_MODEL,
            messages=[
                {"role": "system", "content": SESSION_COMPLETE_SYSTEM_PROMPT},
                {"role": "user", "content": build_session_complete_prompt(transcript)},
            ],
            max_tokens=400,
        )
        return (r.choices[0].message.content or "").strip()
    except Exception as e:
        return f"OpenAI error: {e}"


def _bedrock_session_complete(transcript: str) -> str:
    try:
        import boto3
        import json as _json
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "system": SESSION_COMPLETE_SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": build_session_complete_prompt(transcript)}],
        }
        resp = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=_json.dumps(body),
        )
        out = _json.loads(resp["body"].read())
        for block in out.get("content", []):
            if block.get("type") == "text":
                return (block.get("text", "") or "").strip()
        return "No response from Bedrock."
    except Exception as e:
        return f"Bedrock error: {e}"


# ---- Document: analyze for gaps, complete with transcript ----

def document_analyze_gaps(document_text: str) -> dict[str, Any]:
    """Return list of gaps (missing info per our format). Keys: gaps (list of {question, field, priority}), summary, error."""
    if not settings.has_llm():
        return {"gaps": [], "summary": "", "error": "LLM not configured."}
    user_prompt = f"""Document to assess:\n\n{document_text[:12000]}\n\nOutput JSON only: gaps (array of {{question, field, priority}}), summary (one sentence)."""
    raw = _doc_call(user_prompt, DOCUMENT_ANALYZE_SYSTEM_PROMPT, max_tokens=600)
    if raw.startswith("Claude error:") or raw.startswith("OpenAI error:") or raw.startswith("Bedrock error:"):
        return {"gaps": [], "summary": "", "error": raw}
    raw = raw.strip()
    json_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw)
    if json_match:
        raw = json_match.group(1)
    brace = raw.find("{")
    if brace >= 0:
        raw = raw[brace:]
    try:
        data = json.loads(raw)
        gaps = data.get("gaps") or []
        if not isinstance(gaps, list):
            gaps = []
        else:
            gaps = [{"question": str(g.get("question", "")), "field": str(g.get("field", "")), "priority": str(g.get("priority", "recommended"))[:20]} for g in gaps]
        return {"gaps": gaps, "summary": str(data.get("summary", "")).strip(), "error": None}
    except (json.JSONDecodeError, TypeError):
        return {"gaps": [], "summary": "", "error": "Response not valid JSON."}


def document_complete(document_text: str, transcript: str) -> dict[str, Any]:
    """Return completed document (filled from transcript). Keys: completed_document, error."""
    if not settings.has_llm():
        return {"completed_document": document_text, "error": "LLM not configured."}
    user_prompt = f"""Original document:\n\n{document_text[:8000]}\n\n---\n\nTranscript/answers from encounter:\n\n{transcript[:8000]}\n\n---\n\nOutput the completed document as plain text only (no JSON, no markdown). Preserve structure; fill gaps from the transcript. Do not contradict the clinician."""
    raw = _doc_call(user_prompt, DOCUMENT_COMPLETE_SYSTEM_PROMPT, max_tokens=2000)
    if raw.startswith("Claude error:") or raw.startswith("OpenAI error:") or raw.startswith("Bedrock error:"):
        return {"completed_document": document_text, "error": raw}
    return {"completed_document": raw.strip(), "error": None}


def _doc_call(user_content: str, system: str, max_tokens: int = 600) -> str:
    """Single LLM call for document ops; same provider order as validate."""
    key_claude = (settings.claude_api_key or "").strip()
    if key_claude and not key_claude.startswith("sk-ant-dummy"):
        try:
            return _call_claude(user_content, system=system, model=CLAUDE_FAST_MODEL, max_tokens=max_tokens)
        except Exception as e:
            return f"Claude error: {e}"
    key_openai = (settings.openai_api_key or "").strip()
    if key_openai and not key_openai.startswith("sk-dummy"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.openai_api_key)
            r = client.chat.completions.create(
                model=OPENAI_FAST_MODEL,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user_content}],
                max_tokens=max_tokens,
            )
            return (r.choices[0].message.content or "").strip()
        except Exception as e:
            return f"OpenAI error: {e}"
    if settings.llm_provider == "bedrock":
        try:
            import boto3
            import json as _json
            client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
            body = {"anthropic_version": "bedrock-2023-05-31", "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": user_content}]}
            resp = client.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=_json.dumps(body))
            out = _json.loads(resp["body"].read())
            for block in out.get("content", []):
                if block.get("type") == "text":
                    return (block.get("text", "") or "").strip()
            return ""
        except Exception as e:
            return f"Bedrock error: {e}"
    return "LLM not configured."
