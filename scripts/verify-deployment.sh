#!/usr/bin/env bash
# Deployment + secrets sanity check (no secret values printed)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

red() { echo "[!!] $*"; }
ok() { echo "[ok] $*"; }

echo "=== Deployment verification ==="

ENV_FILE="$ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env present"
  required=(
    DOCKER_DB_ROOT_PASSWORD
    DOCKERHUB_USERNAME
    DOCKER_API_TOKEN_CLOUD
    CLOUDFLARE_API_TOKEN
    CLOUDFLARE_ACCOUNT_ID
    CLOUDFLARE_ZONE_ID
    GRUDGE_WOW_IMAGE
    PUBLIC_GATEWAY_URL
    CORS_ORIGIN
    GRUDGE_AUTH_URL
  )
  for key in "${required[@]}"; do
    if grep -q "^${key}=" "$ENV_FILE" && [[ -n "$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2-)" ]]; then
      ok "$key set"
    else
      red "$key missing or empty"
    fi
  done
else
  red ".env missing - copy from .env.example"
fi

TUNNEL_CRED="${CLOUDFLARE_TUNNEL_CRED_FILE:-/mnt/c/Users/david/.cloudflared/40054045-d722-400d-811e-ac8bcff05d68.json}"
if [[ -f "$TUNNEL_CRED" ]]; then ok "tunnel credentials file"; else red "tunnel credentials missing: $TUNNEL_CRED"; fi

if [[ -f "$ROOT/frontend/site/.vercel/project.json" ]]; then
  ok "Vercel project linked ($(python3 -c "import json;print(json.load(open('$ROOT/frontend/site/.vercel/project.json'))['projectName'])" 2>/dev/null || echo wow-frontend))"
else
  red "frontend/site/.vercel/project.json missing"
fi

echo ""
bash "$ROOT/scripts/grudgestudio-status.sh" 2>/dev/null || true