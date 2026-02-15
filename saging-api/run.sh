#!/usr/bin/env bash
# Run backend. Frees port 8000 if in use (kills process on 8000), then starts uvicorn.
set -e
cd "$(dirname "$0")"

PORT=8000
PID=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi

.venv/bin/uvicorn app.main:app --port $PORT
