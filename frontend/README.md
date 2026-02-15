# Saging Frontend (Hexi)

React + Vite app. Voice questionnaire uses Web Speech API and talks to the Saging API.

## Prerequisites

- **Node 18+** and **npm** on your PATH, or **nvm** (recommended).
- Backend running at `http://localhost:8000` (see `saging-api/`).

## Run (pick one)

### Option A: Script (sources nvm if present, then install + dev)

```bash
cd frontend
chmod +x run.sh
./run.sh
```

### Option B: Manual (ensure Node is on PATH first)

```bash
# If using nvm:
nvm use          # uses .nvmrc (Node 20)
# or: nvm install 20

cd frontend
npm install
npm run dev
```

### If `npm` or `node` not found

- **Install Node:** https://nodejs.org (LTS) or `brew install node`.
- **Or use nvm:** https://github.com/nvm-sh/nvm  
  Then: `nvm install 20`, `nvm use 20`, and run the commands above from `frontend/`.

## URLs

- **App:** http://localhost:5173 (after `npm run dev`).
- **API** (run from `saging-api/`): http://localhost:8000 — frontend proxies `/api` to it in dev.

## Voice testing

See [TESTING_VOICE.md](./TESTING_VOICE.md).
