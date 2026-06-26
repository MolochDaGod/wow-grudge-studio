#!/usr/bin/env bash
# Run Grudge WoW stack from Debian WSL (native docker — more stable than Docker Desktop)
set -euo pipefail

ROOT="/mnt/c/Users/david/Desktop/wow-grudge-studio"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      export "${BASH_REMATCH[1]}=${BASH_REMATCH[2]}"
    fi
  done < .env
  set +a
fi

echo "=== Debian WSL WoW stack ==="
echo "Docker: $(docker --version)"
free -h | head -2

# Stop stray native node on Windows ports (best-effort via PowerShell)
powershell.exe -NoProfile -Command "Get-Process node -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue" 2>/dev/null || true

COMPOSE_ARGS=(-f docker-compose.hub.yml)
if [[ -f docker-compose.override.yml ]]; then
  COMPOSE_ARGS+=(-f docker-compose.override.yml)
fi
if [[ ! -f docker-compose.hub.yml ]]; then
  COMPOSE_ARGS=(-f docker-compose.yml)
  [[ -f docker-compose.override.yml ]] && COMPOSE_ARGS+=(-f docker-compose.override.yml)
fi

# Windows path → WSL path for MPQ data
if [[ -n "${WOW_MPQ_DATA_PATH:-}" && "$WOW_MPQ_DATA_PATH" =~ ^[A-Za-z]: ]]; then
  _drive=$(echo "${WOW_MPQ_DATA_PATH:0:1}" | tr '[:upper:]' '[:lower:]')
  _rest=$(echo "$WOW_MPQ_DATA_PATH" | cut -c4- | tr '\\' '/')
  WOW_MPQ_DATA_PATH="/mnt/${_drive}/${_rest}"
  export WOW_MPQ_DATA_PATH
fi

# Optional: wowserhq/wowser MPQ pipeline (blizzardry) on :3001 — proxies via WOWSER_NATIVE_URL
if [[ -n "${WOW_MPQ_DATA_PATH:-}" && -d "$WOW_MPQ_DATA_PATH" ]]; then
  export WOWSER_NATIVE_URL="${WOWSER_NATIVE_URL:-http://127.0.0.1:3001}"
  WOWSER_DIR="$ROOT/server/wowser"
  if [[ -d "$WOWSER_DIR" ]]; then
    node "$ROOT/scripts/init-wowser-pipeline-config.mjs" 2>/dev/null || true
    if [[ ! -d "$WOWSER_DIR/node_modules" ]]; then
      echo "[..] installing wowserhq/wowser pipeline deps (first run)..."
      (cd "$WOWSER_DIR" && npm install --no-fund --no-audit) || true
    fi
    if ! curl -sf http://127.0.0.1:3001/pipeline/find/test >/dev/null 2>&1; then
      echo "[..] starting wowserhq native MPQ pipeline on :3001"
      nohup bash -lc "cd '$WOWSER_DIR' && npm run serve" >/tmp/wowser-pipeline.log 2>&1 &
      sleep 3
    fi
  fi
fi

docker compose "${COMPOSE_ARGS[@]}" --env-file .env pull wow-gateway wow-pipeline 2>/dev/null || true
docker compose "${COMPOSE_ARGS[@]}" --env-file .env up -d

echo ""
echo "Waiting for gateway..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    echo "[ok] gateway :8787"
    curl -s http://127.0.0.1:8787/api/health
    echo ""
    curl -s http://127.0.0.1:3000/health || true
    echo ""
    # Bootstrap SOAP admin once MySQL + worldserver are up (Grudge auto-provision)
    if [[ -n "${DOCKER_DB_ROOT_PASSWORD:-}" ]]; then
      for j in $(seq 1 30); do
        if docker exec wow-grudge-studio-ac-database-1 mysql -uroot -p"${DOCKER_DB_ROOT_PASSWORD}" -e "SELECT 1" >/dev/null 2>&1; then
          node "$ROOT/server/gateway/scripts/init-ac-admin.mjs" 2>/dev/null && echo "[ok] SOAP admin bootstrapped" || true
          break
        fi
        sleep 2
      done
    fi
    docker compose "${COMPOSE_ARGS[@]}" ps --format 'table {{.Name}}\t{{.Status}}\t{{.Image}}' | grep -E 'wow|acore|ac-' || docker compose "${COMPOSE_ARGS[@]}" ps
    exit 0
  fi
  sleep 2
done

echo "[warn] gateway not healthy yet — check: docker compose logs -f wow-gateway ac-worldserver"
docker compose "${COMPOSE_ARGS[@]}" ps
exit 1