"""
Clinical validation via LLM (replaces OpenEvidence).
Order: Claude (CLAUDE_API_KEY) → OpenAI fallback → Bedrock.
"""
from app.config import settings


def validate_clinical_snippet(text: str) -> str:
    """
    Ask LLM what might be missing or unclear in a clinical snippet.
    Returns suggested follow-up questions or "missing criteria".
    Uses Claude first; falls back to OpenAI then Bedrock.
    """
    if not settings.has_llm():
        return "LLM not configured. Set CLAUDE_API_KEY or OPENAI_API_KEY, or use Bedrock."

    # 1. Claude (primary)
    key_claude = (settings.claude_api_key or "").strip()
    if key_claude and not key_claude.startswith("sk-ant-dummy"):
        return _claude_validate(text)

    # 2. OpenAI (fallback)
    key_openai = (settings.openai_api_key or "").strip()
    if key_openai and not key_openai.startswith("sk-dummy"):
        return _openai_validate(text)

    # 3. Bedrock
    if settings.llm_provider == "bedrock":
        return _bedrock_validate(text)

    return "LLM not configured."


def _claude_validate(text: str) -> str:
    try:
        import anthropic
    except ImportError:
        return "Install anthropic: pip install anthropic"

    prompt = (
        "You are a clinical documentation assistant. Given this brief clinical note, "
        "suggest 1–3 short follow-up questions or missing elements a clinician should clarify "
        "for a complete, unambiguous record. Be concise.\n\nNote: " + text
    )
    try:
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        r = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        for block in r.content:
            if hasattr(block, "text") and block.text:
                return block.text.strip()
        return "No response from Claude."
    except Exception as e:
        return f"Claude error: {e}"


def _openai_validate(text: str) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        return "Install openai: pip install openai"

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = (
        "You are a clinical documentation assistant. Given this brief clinical note, "
        "suggest 1–3 short follow-up questions or missing elements a clinician should clarify "
        "for a complete, unambiguous record. Be concise.\n\nNote: " + text
    )
    try:
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
        )
        return (r.choices[0].message.content or "").strip()
    except Exception as e:
        return f"OpenAI error: {e}"


def _bedrock_validate(text: str) -> str:
    try:
        import boto3
        import json
    except ImportError:
        return "boto3 required for Bedrock"

    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        prompt = (
            "You are a clinical documentation assistant. Given this brief clinical note, "
            "suggest 1–3 short follow-up questions or missing elements a clinician should clarify. "
            "Be concise.\n\nNote: " + text
        )
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=json.dumps(body),
        )
        out = json.loads(resp["body"].read())
        # extract text from Claude response
        for block in out.get("content", []):
            if block.get("type") == "text":
                return (block.get("text", "") or "").strip()
        return "No response from Bedrock."
    except Exception as e:
        return f"Bedrock error: {e}"
