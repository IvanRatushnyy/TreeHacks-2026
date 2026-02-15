#!/usr/bin/env bash
# From repo root: run the frontend (sources nvm / Homebrew, installs deps, starts Vite).
set -e
cd "$(dirname "$0")/saging-api"
bash run.sh
