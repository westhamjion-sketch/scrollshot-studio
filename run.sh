#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [ ! -d "$PROJECT_DIR/.venv" ]; then
  if ! "$PYTHON_BIN" -c 'import sys; raise SystemExit(sys.version_info < (3, 11))'; then
    echo "需要 Python 3.11+。可通过 PYTHON_BIN=/path/to/python3.12 ./run.sh 指定。" >&2
    exit 1
  fi
  "$PYTHON_BIN" -m venv "$PROJECT_DIR/.venv"
  "$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/backend/requirements.txt"
fi

if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
  npm --prefix "$PROJECT_DIR/frontend" install
fi

trap 'kill 0' EXIT
(
  cd "$PROJECT_DIR/backend"
  "$PROJECT_DIR/.venv/bin/uvicorn" app.main:app --reload --host 127.0.0.1 --port 8000
) &
npm --prefix "$PROJECT_DIR/frontend" run dev -- --host 127.0.0.1
