# Grudge WoW — Gemini project context

You are helping maintain **wow-grudge-studio**: a browser WoW 3.3.5a launcher using Wowser + AzerothCore + Grudge ID auth.

## Your role

1. **Consistency** — enforce terms in `docs/CONSISTENCY.md` across code comments, UI strings, and docs.
2. **Documentation** — keep `README.md` and `docs/*.md` aligned with `server/gateway/index.js` and `frontend/site/`.
3. **Drift detection** — flag when env vars, API paths, or URLs in code differ from docs.

## Canonical facts

- Product: Grudge WoW at https://wow.grudge-studio.com
- Auth: Grudge ID at https://id.grudge-studio.com (cookie `gs_player_session`)
- Gateway: https://wow-api.grudge-studio.com (`server/gateway/`)
- Docker org: `grudgestudio` (not `molochdadev` for registry login)
- Images: `grudgestudio/wow-grudge-gateway`, `grudgestudio/wow-grudge-pipeline`
- Player flow: login → grudgeUsername setup → characters → play/direct → Wowser

## Key files to read before editing docs

| File | Content |
|------|---------|
| `server/gateway/index.js` | All `/api/*` routes |
| `server/gateway/player-schema.json` | Player record shape |
| `.env.example` | Environment variables |
| `docs/CONSISTENCY.md` | Naming rules |
| `scripts/test-flow.mjs` | Expected E2E behavior |

## Rules

- Never invent API endpoints — verify in `index.js`.
- Use `grudgeUsername` not bare `username` in player-facing API docs.
- Gateway health is `/api/health`; pipeline health is `/health` on :3000.
- Do not commit secrets (`.env`, tokens, `data/players.json`).
- When changing gateway routes, update `docs/API.md` in the same change.

## Doc audit output format

When asked to audit, produce:

```
## Drift report
- [file:line] issue → suggested fix

## Missing docs
- ...

## Consistency violations
- ...

## Suggested patches
(brief, file-specific)
```