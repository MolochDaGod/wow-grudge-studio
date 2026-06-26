# Gateway API

Base: `https://wow-api.grudge-studio.com` (local: `http://127.0.0.1:8787`)

All player endpoints require Grudge ID auth unless `REQUIRE_GRUDGE_AUTH=false`.

## Auth

Send session cookie or Bearer token on every request:

```http
Cookie: gs_player_session=...
```

```http
Authorization: Bearer <token>
```

CORS allows `CORS_ORIGIN` with `credentials: true`.

---

## `GET /api/health`

No auth. Service status.

```json
{
  "status": "ok",
  "service": "wow-grudge-gateway",
  "pipeline": "http://wow-pipeline:3000",
  "auth": "ac-authserver:3724",
  "world": "ac-worldserver:8085",
  "playerStore": "/app/data/players.json",
  "timestamp": "2026-06-25T00:00:00.000Z"
}
```

---

## `GET /api/config`

No auth. Public client configuration.

```json
{
  "pipelineUrl": "https://wow-pipeline.grudge-studio.com",
  "authWsUrl": "wss://wow-auth.grudge-studio.com",
  "worldWsUrl": "wss://wow-world.grudge-studio.com",
  "clientVersion": "3.3.5a",
  "realm": "Grudge WoW",
  "grudgeAuthUrl": "https://id.grudge-studio.com",
  "requiresGrudgeId": true
}
```

---

## `GET /api/player/me`

Current player profile and launch state.

```json
{
  "grudgeId": "uuid",
  "grudgeUsername": "PlayerName",
  "displayName": "PlayerName",
  "needsUsernameSetup": false,
  "usernameSetupComplete": true,
  "isFirstLaunch": false,
  "wowAccountReady": true,
  "wowLogin": "playername",
  "launchCount": 3
}
```

---

## `POST /api/player/username`

Complete username onboarding.

**Body:**

```json
{ "action": "accept" }
```

```json
{ "action": "set", "username": "NewName" }
```

- `accept` — use display name from Grudge ID profile
- `set` — choose username (3–30 chars: letters, numbers, `_`, `-`); proxies `complete-profile` to Grudge ID when Bearer token present

**Response:**

```json
{
  "ok": true,
  "player": { /* same shape as /api/player/me */ }
}
```

---

## `GET /api/player/characters`

Character list for the provisioned WoW account.

```json
{
  "grudgeId": "uuid",
  "grudgeUsername": "PlayerName",
  "wowLogin": "playername",
  "accountId": 42,
  "dbAvailable": true,
  "characters": [
    { "guid": 1, "name": "Hero", "race": 1, "class": 1, "level": 80, "gender": 0 }
  ],
  "error": null
}
```

If no WoW account yet: `characters: []` with `message: "Launch once to provision your WoW account."`

---

## `POST /api/play/direct`

Provision WoW account (if needed) and return Wowser launch payload.

**Requires:** `needsUsernameSetup === false`

**Response:**

```json
{
  "mode": "wowser",
  "grudgeId": "uuid",
  "grudgeUsername": "PlayerName",
  "wowAccount": { "login": "playername", "password": "...", "created": true },
  "characters": [],
  "pipelineUrl": "https://wow-pipeline.grudge-studio.com",
  "authWsUrl": "wss://wow-auth.grudge-studio.com",
  "worldWsUrl": "wss://wow-world.grudge-studio.com",
  "clientUrl": "https://wow.grudge-studio.com",
  "realm": "Grudge WoW",
  "message": "Welcome PlayerName! Your WoW account is ready."
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 401 | Not signed in |
| 409 | Username setup required |
| 502 | SOAP provision failed |

---

## `GET /api/grudge/player/:grudgeId`

Cross-game lookup. **Own grudgeId only** (403 otherwise).

```json
{
  "grudgeId": "uuid",
  "grudgeUsername": "PlayerName",
  "wowLogin": "playername",
  "games": ["wow"]
}
```

---

## `POST /api/play/disconnect`

Session cleanup ack.

```json
{ "ok": true, "grudgeId": "uuid" }
```

---

## Proxies

| Path | Target |
|------|--------|
| `/pipeline/*` | `PIPELINE_URL` (wow-pipeline) |
| WS `/auth` | `WOW_AUTH_HOST` |
| WS `/world` | `WOW_WORLD_HOST` |