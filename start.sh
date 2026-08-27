#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$PROJECT_DIR/.run"
DOMAIN="gui/$(id -u)"

mkdir -p "$RUN_DIR"

if [ ! -x "$PROJECT_DIR/.venv/bin/uvicorn" ] || [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
  echo "依赖尚未安装，请先运行 ./run.sh 完成首次安装。" >&2
  exit 1
fi

load_service() {
  local label="$1"
  local plist="$2"
  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$label"
    sleep 0.5
  fi
  launchctl bootstrap "$DOMAIN" "$plist"
}

load_service "com.scrollshot.backend" "$PROJECT_DIR/launchd/com.scrollshot.backend.plist"
load_service "com.scrollshot.frontend" "$PROJECT_DIR/launchd/com.scrollshot.frontend.plist"

for _ in {1..40}; do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo "卷轴已启动：http://127.0.0.1:5173/"
    exit 0
  fi
  sleep 0.25
done

echo "启动失败，请检查 $RUN_DIR/backend.log 和 $RUN_DIR/frontend.log" >&2
exit 1
