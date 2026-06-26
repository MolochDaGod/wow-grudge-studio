# Deployment

## Environments

| Mode | Compose file | When |
|------|--------------|------|
| Local build | `docker-compose.yml` | Docker Desktop up, building from source |
| Hub images | `docker-compose.hub.yml` | After Build Cloud push |
| Native fallback | none | Docker down; `start-all.ps1` runs node locally |

## Prerequisites

- Docker Desktop (or remote Docker host)
- Cloudflare tunnel `wow-grudge` → local 8787 / 3000 / 3724 / 8085
- Vercel project for `frontend/site`
- Grudge ID at `id.grudge-studio.com`
- AzerothCore SOAP admin account on worldserver console:

```
account create admin admin admin
account set gmlevel admin 3 -1
```

## Configuration

Copy and edit:

```powershell
copy .env.example .env
```

Key variables — see [CONSISTENCY.md](CONSISTENCY.md) for full list.

## Start stack

```powershell
.\start-all.ps1
```

Loads `.env`, starts tunnel, Docker (or native fallback), Wowser dev client on `:5173`.

## Build & push images (Docker Build Cloud)

```powershell
.\scripts\docker-cloud-build.ps1
```

Then deploy:

```powershell
docker compose -f docker-compose.hub.yml --env-file .env up -d
```

**Blocked?** See [DOCKER-BUILD-CLOUD.md](DOCKER-BUILD-CLOUD.md).

## Frontend (Vercel)

```powershell
cd frontend/site
vercel --prod
```

`vercel.json` rewrites `/auth/callback` for Grudge OAuth return.

For fully self-hosted live server (no Vercel), route `wow.grudge-studio.com` in cloudflared to the gateway (8787). The gateway now serves the launcher static files + `/api` etc. See cloudflared/config.docker.yml and the updated grudge-wow Dockerfile.

## Health checks

```powershell
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:3000/health
curl https://wow-api.grudge-studio.com/api/health
node scripts/test-flow.mjs
```

## AzerothCore first run

First `docker compose up` extracts client data and imports DB — **10–20 minutes**. Monitor:

```powershell
docker compose logs -f ac-worldserver wow-gateway
```

## Production notes

- `data/players.json` persists in Docker volume `wow-player-data`
- Rotate `DOCKER_API_TOKEN_CLOUD` and SOAP passwords regularly
- Do not commit `.env` or player JSON files (see `.gitignore`)