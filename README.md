# Grudge WoW (wow.grudge-studio.com)

Browser-playable World of Warcraft 3.3.5a via **Wowser** + **AzerothCore**, gated by **Grudge ID**.

**Repo:** [github.com/MolochDaGod/wow-grudge-studio](https://github.com/MolochDaGod/wow-grudge-studio)

| Surface | URL |
|---------|-----|
| Launcher UI | https://wow.grudge-studio.com |
| Gateway API | https://wow-api.grudge-studio.com |
| Asset pipeline | https://wow-pipeline.grudge-studio.com |
| Auth WebSocket | wss://wow-auth.grudge-studio.com |
| World WebSocket | wss://wow-world.grudge-studio.com |
| Grudge ID | https://id.grudge-studio.com |

## Quick start

```powershell
cd C:\Users\david\Desktop\wow-grudge-studio
copy .env.example .env   # edit secrets
.\start-all.ps1
```

Verify:

```powershell
node scripts/test-flow.mjs
curl https://wow-api.grudge-studio.com/api/health
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, services, data flow |
| [docs/API.md](docs/API.md) | Gateway REST endpoints |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, Build Cloud, tunnels, production |
| [docs/CONSISTENCY.md](docs/CONSISTENCY.md) | Canonical names, env vars, player flow |
| [docs/DOCKER-BUILD-CLOUD.md](docs/DOCKER-BUILD-CLOUD.md) | Build Cloud token scopes checklist |
| [docs/CREDENTIALS.md](docs/CREDENTIALS.md) | API tokens, Cloudflare tunnel, rotation |
| [docs/HOSTING-AND-PLAY.md](docs/HOSTING-AND-PLAY.md) | **cloud-connect, hosting best practices, browser play** |
| [docs/CLIENT-DATA.md](docs/CLIENT-DATA.md) | AC extracted data vs Wowser assets, file types |

## Player flow

1. Sign in with Grudge ID (cookie `gs_player_session` or Bearer token).
2. Accept or set **grudgeUsername** (canonical cross-game name).
3. **Enter Azeroth** — gateway auto-provisions an AzerothCore account via SOAP.
4. Character list loads from MySQL before launch.
5. Wowser client connects through public WebSocket bridges.

## Project layout

```
frontend/site/          Vercel launcher (Grudge UI + Wowser iframe)
frontend/wowser-client/ Wowser dev client
server/gateway/         API, auth, SOAP provision, WS bridges
server/pipeline/        WoW client data / asset server
docker/                 Gateway & pipeline Dockerfiles
docker/acore/           AzerothCore compose include
scripts/                test-flow, docker-cloud-build, gemini-docs
data/players.json       Grudge ID → grudgeUsername → wow login map
```

## Docker images (Build Cloud)

```powershell
.\scripts\docker-cloud-build.ps1
docker compose -f docker-compose.hub.yml --env-file .env up -d
```

Images: `grudgestudio/wow-grudge-gateway:latest`, `grudgestudio/wow-grudge-pipeline:latest`

## Doc consistency (Gemini CLI)

When `GEMINI_API_KEY` is set:

```powershell
.\scripts\gemini-docs.ps1
```

See [.gemini/GEMINI.md](.gemini/GEMINI.md) for the project context file Gemini uses.