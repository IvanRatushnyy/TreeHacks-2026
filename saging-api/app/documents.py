"""Extract text from uploaded documents (PDF, TXT) so the LLM can read them."""
from typing import Optional


def extract_text_from_file(content: bytes, filename: str) -> Optional[str]:
    """
    Extract plain text from a file. Supports PDF and TXT.
    Returns None if the format is unsupported or extraction fails.
    """
    name = (filename or "").lower()
    if name.endswith(".txt"):
        try:
            return content.decode("utf-8", errors="replace").strip()
        except Exception:
            return None
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            parts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            return "\n\n".join(parts).strip() if parts else None
        except Exception:
            return None
    return None
