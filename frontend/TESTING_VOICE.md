# Testing voice (Web Speech API + fast LLM)

## Prerequisites

- **Chrome** (recommended for best Web Speech API support).
- Backend running: `cd saging-api && .venv/bin/uvicorn app.main:app --port 8000`
- Frontend: `npm run dev` (or `npx vite`) from `frontend/`. Default URL: http://localhost:5173

## Optional: point frontend at API

If the API is on another host/port, create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
```

## Test steps

1. Open the app in **Chrome** (e.g. http://localhost:5173).
2. Click **"Start voice (keep talking; follow-ups will flow)"**. Allow microphone when prompted.
3. Speak a short clinical phrase (e.g. "Patient has a headache" or "Patient is dizzy").
4. Confirm:
   - **Live Chat** shows your words as they are transcribed (and keeps updating).
   - Recording stays on (red button, "Stop recording") and the timer (REC: 00:00:xx) counts up.
   - After a short delay, **Follow-up questions** appear below (from the fast LLM).
5. Keep talking; say more (e.g. "It started two days ago"). Transcript should append and follow-ups can update.
6. Click **"Stop recording"** when done. Recording stops; transcript and last follow-ups remain.

## What we test

- **Continuous recording**: Recording does not stop while the LLM responds; you can keep speaking.
- **On-the-fly transcription**: Words appear as you speak (interim and final).
- **Fast LLM**: Suggestions come from `POST /api/clinical/validate` with `fast: true`.
- **No dropped input**: Because we use `continuous: true`, speech is not cut off when we send to the API.

## If voice doesn’t start

- Use **Chrome** and allow the microphone for the page.
- Check the browser console for errors.
- Ensure the API is reachable: open http://localhost:8000/docs and try `POST /api/clinical/validate` with `{"text": "test", "fast": true}`.
