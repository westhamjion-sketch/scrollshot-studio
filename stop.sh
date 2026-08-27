#!/usr/bin/env bash
set -euo pipefail

DOMAIN="gui/$(id -u)"

for label in com.scrollshot.backend com.scrollshot.frontend; do
  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$label"
  fi
done

echo "卷轴服务已停止。"

