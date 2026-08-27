#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

"$PROJECT_DIR/start.sh"
curl -fsS http://127.0.0.1:8000/api/health | grep -q '"status":"ok"'
curl -fsS http://127.0.0.1:5173/ | grep -q '<div id="root"></div>'

domain="gui/$(id -u)"
launchctl print "$domain/com.scrollshot.backend" >/dev/null
launchctl print "$domain/com.scrollshot.frontend" >/dev/null

echo "后台服务生命周期测试通过。"
