# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser — wow.grudge-studio.com (Vercel)                       │
│  Grudge auth modal · username onboarding · character panel      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS + cookies
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare tunnel (wow-grudge)                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  wow-api:8787        wow-pipeline:3000   wow-auth / wow-world (WS)
  (wow-gateway)       (asset server)      (TCP bridges)
        │                   │                   │
        └─────────┬─────────┘                   │
                  ▼                             ▼
        ┌─────────────────┐           ┌─────────────────┐
        │ ac-authserver   │           │ ac-worldserver  │
        │ :3724           │           │ :8085 / SOAP    │
        └────────┬────────┘           │ :7878           │
                 │                    └────────┬────────┘
                 └────────────┬───────────────┘
                              ▼
                    ┌─────────────────┐
                    │ ac-database     │
                    │ acore_auth      │
                    │ acore_characters│
                    └─────────────────┘
```

## Services

| Service | Port (local) | Role |
|---------|--------------|------|
| `wow-gateway` | 8787 | REST API, Grudge auth proxy, SOAP provision, WS bridges |
| `wow-pipeline` | 3000 | Serves WoW client data to Wowser |
| `ac-authserver` | 3724 | AzerothCore authentication |
| `ac-worldserver` | 8085 | Game world; SOAP on 7878 for account create |
| `ac-database` | 3306 (63306 ext) | MySQL |

## Authentication

Grudge ID at `id.grudge-studio.com` issues session cookies. The gateway accepts:

- **Cookie**: `gs_player_session` (browser `credentials: 'include'`)
- **Bearer**: `Authorization: Bearer <token>` (optional)

Profile is fetched from `GET {GRUDGE_AUTH_URL}/api/auth/me`.

## Player data

`data/players.json` (schema: `server/gateway/player-schema.json`):

```
grudgeId (UUID) → {
  grudgeUsername,    // canonical cross-game name
  wowAccount.login,  // AzerothCore account (max 16 chars)
  wowAccount.password,
  usernameSetupComplete,
  launchCount, ...
}
```

## Account provisioning

`POST /api/play/direct` calls SOAP on `ac-worldserver:7878`:

```
account create <login> <password>
```

Login is derived from `grudgeUsername` (sanitized, unique). Fallback: `AC_MOCK_PROVISION=true` for dev without SOAP.

## WebSocket bridging

Browser connects to public hosts; gateway upgrades and forwards raw TCP:

| Public host | Gateway path | Upstream |
|-------------|--------------|----------|
| wow-auth.grudge-studio.com | `/auth` | WOW_AUTH_HOST:3724 |
| wow-world.grudge-studio.com | `/world` | WOW_WORLD_HOST:8085 |

## Frontend deployment

`frontend/site/` deploys to Vercel. Wowser runs in an iframe with query params from `/api/play/direct` (pipeline, WS URLs, realm, credentials).

## Fallback modes

`start-all.ps1` tries in order:

1. Docker full stack (`docker-compose.yml` or `docker-compose.hub.yml` if hub images set)
2. Native `node` gateway + pipeline if Docker gateway unhealthy
3. Cloudflare tunnel for public URLs regardless