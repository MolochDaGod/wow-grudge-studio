# Credentials

All secrets live in `.env` (gitignored). **Never paste tokens in chat** — rotate any that were exposed.

## WoW stack (required)

| Variable | Purpose |
|----------|---------|
| `DOCKER_API_TOKEN_CLOUD` | Docker Hub org OAT — login as `grudgestudio` |
| `DOCKERHUB_USERNAME` | Always `grudgestudio` for org tokens |
| `DOCKER_DB_ROOT_PASSWORD` | AzerothCore MySQL root |
| `AC_SOAP_USER` / `AC_SOAP_PASS` | Worldserver SOAP admin |

## Cloudflare (tunnel + DNS)

| Variable | Purpose |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | API token for automation |
| `CLOUDFLARE_ACCOUNT_ID` | Grudge account: `ee475864561b02d4588180b8b9acf694` |
| `CLOUDFLARE_ZONE_ID` | `grudge-studio.com`: `e8c0c2ee3063f24eb31affddabf9730a` |

**Local tunnel** (no API needed to run):

- Config: `cloudflared/config.yml`
- Credentials: `%USERPROFILE%\.cloudflared\40054045-d722-400d-811e-ac8bcff05d68.json`
- Tunnel name: `wow-grudge`

**Token scopes needed for full API management:**

- Account → Account Settings → Read
- Zone → DNS → Read (and Edit to auto-fix records)
- Account → Cloudflare One Connectors → Read (for tunnel status via API)

Current token can list accounts/zones but **cannot read DNS or tunnel details** until scopes are expanded.

Verify:

```powershell
.\scripts\verify-credentials.ps1
```

## Optional integrations

| Variable | Used by | Header / format |
|----------|---------|-------------------|
| `POLY_PIZZA_KEY` | Grudge agent asset search | `X-Auth-Token` |
| `COLYEUS_DEPLOY_TOKEN` | Colyseus Cloud CLI deploy | deploy CLI secret |
| `GEMINI_API_KEY` | `scripts/gemini-docs.ps1` | Google AI Studio key |

### Colyseus SSH public key

The `colyseus-cloud-deploy-key-*` public key is registered in Colyseus Cloud for git/SSH deploys — not stored in `.env` (public keys are not secrets).

## Variable naming (canonical)

Use these names in `.env` — not the informal names from chat:

| Informal | Canonical |
|----------|-----------|
| `CLOUDFLARE_MAX_API` | `CLOUDFLARE_API_TOKEN` |
| `Poly_Pizza_api` | `POLY_PIZZA_KEY` |
| `Deploy_CLI_COLYESUS` (base64) | `COLYEUS_DEPLOY_TOKEN` (decoded) |

## Rotation checklist

After any leak in chat or logs:

1. Cloudflare → My Profile → API Tokens → roll token
2. Docker → grudgestudio org → Access tokens → regenerate OAT
3. Poly Pizza → dashboard → new API key
4. Colyseus Cloud → deploy settings → new deploy token
5. Google AI Studio → new Gemini key