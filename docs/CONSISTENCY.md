# Consistency guide

Canonical names and flows for code, docs, and UI. **Gemini doc audits use this as source of truth.**

## Product names

| Term | Meaning | Do not use |
|------|---------|------------|
| **Grudge ID** | Auth system at id.grudge-studio.com | "Grudge auth", "GS auth" in user-facing text |
| **grudgeUsername** | Canonical cross-game display name | `username` alone in API responses (use both only when mapping) |
| **grudgeId** | UUID primary key for a player | `accountId` for Grudge identity (accountId in play/direct is legacy alias) |
| **WoW account** / **wowLogin** | AzerothCore game login (≤16 chars) | "Blizzard account" |
| **Wowser** | In-browser WoW 3.3.5a client | "WoW client" when meaning Wowser specifically |
| **AzerothCore** / **AC** | Private server backend | "server" alone in technical docs |

## URLs (production)

| Key | Value |
|-----|-------|
| `CORS_ORIGIN` | `https://wow.grudge-studio.com` |
| `PUBLIC_GATEWAY_URL` | `https://wow-api.grudge-studio.com` |
| `PUBLIC_PIPELINE_URL` | `https://wow-pipeline.grudge-studio.com` |
| `PUBLIC_AUTH_WS` | `wss://wow-auth.grudge-studio.com` |
| `PUBLIC_WORLD_WS` | `wss://wow-world.grudge-studio.com` |
| `GRUDGE_AUTH_URL` | `https://id.grudge-studio.com` |

## Docker Hub

| Key | Value |
|-----|-------|
| Org / login username | `grudgestudio` (for `dckr_oat_*` tokens) |
| Gateway image | `grudgestudio/wow-grudge-gateway:latest` |
| Pipeline image | `grudgestudio/wow-grudge-pipeline:latest` |
| Build Cloud endpoint | `molochdadev/grudgestudio` (until org builder exists) |

## Environment variables

### Gateway

| Variable | Docker value | Native value |
|----------|--------------|--------------|
| `GATEWAY_PORT` | 8787 | 8787 |
| `PIPELINE_URL` | `http://wow-pipeline:3000` | `http://127.0.0.1:3000` |
| `WOW_AUTH_HOST` | `ac-authserver:3724` | `127.0.0.1:3724` |
| `WOW_WORLD_HOST` | `ac-worldserver:8085` | `127.0.0.1:8085` |
| `AC_SOAP_HOST` | `ac-worldserver:7878` | `127.0.0.1:7878` |
| `PLAYER_DATA_PATH` | `/app/data/players.json` | `./data/players.json` |
| `REQUIRE_GRUDGE_AUTH` | `true` | `true` (set `false` only for local dev) |

### Pipeline

| Variable | Value |
|----------|-------|
| `PIPELINE_PORT` | 3000 |
| `WOW_DATA_PATH` | `/azerothcore/env/dist/data` (Docker) |
| `WOWSER_PUBLIC` | `/app/wowser-public` (Docker) |

## Player flow (ordered)

1. `GET /api/player/me` → `needsUsernameSetup`
2. `POST /api/player/username` → `action: accept | set`
3. `GET /api/player/characters` (optional, launcher panel)
4. `POST /api/play/direct` → Wowser launch params
5. Wowser iframe loads with pipeline + WS + wow credentials

## File ownership

| Concern | Location |
|---------|----------|
| Gateway routes | `server/gateway/index.js` |
| Grudge auth | `server/gateway/lib/grudge-auth.js` |
| Player store | `server/gateway/lib/player-store.js` |
| SOAP provision | `server/gateway/lib/ac-provision.js` |
| Characters query | `server/gateway/lib/ac-characters.js` |
| Player schema | `server/gateway/player-schema.json` |
| Launcher UI | `frontend/site/index.html`, `screen.wow.js` |
| E2E test | `scripts/test-flow.mjs` |

## API path prefix

All REST routes use `/api/` prefix. Health: `/api/health` (not `/health` on gateway).

Pipeline health: `/health` on port 3000 directly.

## Credential env names

| Canonical | Not |
|-----------|-----|
| `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_MAX_API` |
| `POLY_PIZZA_KEY` | `Poly_Pizza_api` |
| `COLYEUS_DEPLOY_TOKEN` | `Deploy_CLI_COLYESUS` |
| `GEMINI_API_KEY` | `GEMINI_CLI_API` |

See `docs/CREDENTIALS.md`.

## Doc maintenance rules

1. Update `docs/API.md` when adding/changing gateway routes.
2. Update `docs/ARCHITECTURE.md` when adding services or changing data flow.
3. Update `.env.example` when adding env vars; mirror comment in `CONSISTENCY.md`.
4. Run `.\scripts\gemini-docs.ps1` after substantive changes.