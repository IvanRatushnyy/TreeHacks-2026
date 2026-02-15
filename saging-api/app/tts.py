"""
Text-to-speech for more human-like voice. Uses OpenAI TTS when OPENAI_API_KEY is set.
Uses gpt-4o-mini-tts with instructions for natural tone; fallback: frontend browser SpeechSynthesis.
"""
import os
from typing import Optional

from app.config import settings

# Best quality per OpenAI: marin, cedar. Older set: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer
TTS_VOICE = os.environ.get("TTS_VOICE", "marin")
# Instructions make the biggest difference: control tone, pace, intonation (gpt-4o-mini-tts only)
TTS_INSTRUCTIONS = os.environ.get(
    "TTS_INSTRUCTIONS",
    "Speak in a warm, natural, conversational tone. Use a calm, steady pace—not too fast. "
    "Sound like a helpful human assistant in a clinical setting, not robotic or monotone.",
)
# Newer model supports instructions and sounds more human; fallback to tts-1-hd if needed
TTS_MODEL = os.environ.get("TTS_MODEL", "gpt-4o-mini-tts")


def has_tts() -> bool:
    key = (settings.openai_api_key or "").strip()
    return bool(key) and not key.startswith("sk-dummy")


def synthesize(text: str) -> Optional[bytes]:
    """Return MP3 audio bytes for the given text, or None if TTS not configured."""
    if not has_tts():
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        payload = {
            "model": TTS_MODEL,
            "voice": TTS_VOICE,
            "input": (text or "").strip()[:4096],
        }
        if "gpt-4o-mini-tts" in TTS_MODEL and TTS_INSTRUCTIONS:
            payload["instructions"] = TTS_INSTRUCTIONS
        r = client.audio.speech.create(**payload)
        return r.content
    except Exception:
        return None
