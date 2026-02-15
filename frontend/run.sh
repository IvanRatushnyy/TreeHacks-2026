#!/usr/bin/env bash
# Run frontend: find Node (nvm, Homebrew, profile, or PATH), install deps, start dev server.
set -e
cd "$(dirname "$0")"

# 0) Load shell profile so nvm/node from your terminal are available
if [ -z "$NVM_DIR" ] && [ -s "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null || true
elif [ -z "$NVM_DIR" ] && [ -s "$HOME/.bash_profile" ]; then
  source "$HOME/.bash_profile" 2>/dev/null || true
fi

# 1) Prefer nvm if available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  [ -f .nvmrc ] && nvm use 2>/dev/null || true
elif [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
  [ -f .nvmrc ] && nvm use 2>/dev/null || true
fi

# 2) Add Homebrew Node to PATH if present (macOS)
if [ -d /opt/homebrew/opt/node/bin ]; then
  export PATH="/opt/homebrew/opt/node/bin:$PATH"
elif [ -d /usr/local/opt/node/bin ]; then
  export PATH="/usr/local/opt/node/bin:$PATH"
fi

# 3) Ensure npm is available
if ! command -v npm >/dev/null 2>&1; then
  echo "Node/npm not found. Try:"
  echo "  - nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash, then nvm install 20"
  echo "  - macOS: brew install node"
  echo "  - Or install from https://nodejs.org (LTS)"
  exit 1
fi

echo "Using $(command -v node) $(node -v)"
npm ci --prefer-offline --no-audit --no-fund 2>/dev/null || npm install
exec npm run dev
