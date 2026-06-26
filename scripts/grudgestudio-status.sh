#!/usr/bin/env bash
# Quick health check from grudgestudio / WSL
set -euo pipefail

echo "=== Grudge WoW status ($(hostname)) ==="
echo ""

check() {
  local name="$1" url="$2"
  local code body
  code=$(curl -sS -m 8 -o /tmp/grudge-check.json -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "[ok] $name ($code)"
    head -c 120 /tmp/grudge-check.json; echo ""
  else
    echo "[!!] $name ($code)"
  fi
}

check "wow frontend" "https://wow.grudge-studio.com/"
check "wow-api health" "https://wow-api.grudge-studio.com/api/health"
check "wow-api config" "https://wow-api.grudge-studio.com/api/config"
check "wow-pipeline" "https://wow-pipeline.grudge-studio.com/health"
check "grudge id" "https://id.grudge-studio.com/"

echo ""
if command -v docker >/dev/null 2>&1 && docker ps -q >/dev/null 2>&1; then
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'wow|acore|cloudflare' || docker ps --format 'table {{.Names}}\t{{.Status}}' | head -12
else
  echo "docker unavailable in this shell — checking via Debian WSL..."
  powershell.exe -NoProfile -Command "wsl -d Debian -- docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>/dev/null | grep -E 'wow|acore|cloudflare' || true
fi

if pgrep -a cloudflared >/dev/null 2>&1 || powershell.exe -NoProfile -Command "Get-Process cloudflared -EA SilentlyContinue" >/dev/null 2>&1; then
  echo ""
  echo "[ok] cloudflared process running"
fi