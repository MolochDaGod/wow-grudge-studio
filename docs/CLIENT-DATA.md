# Client data and file types (AzerothCore + Wowser)

## AzerothCore (`azerothcore-wotlk` via `docker/acore`)

Official stack: [acore-docker](https://github.com/azerothcore/acore-docker) images built from [azerothcore-wotlk](https://github.com/azerothcore/azerothcore-wotlk).

### Extracted client data (what we use)

The `acore/ac-wotlk-client-data` init container populates volume `ac-client-data`:

| Path | Format | Used by |
|------|--------|---------|
| `dbc/` | `.dbc` database files | Server + Wowser lookups |
| `maps/` | `.map` terrain | Server + world rendering |
| `vmaps/` | `.vmtree`, `.vmtile` | Line-of-sight / collision |
| `mmaps/` | `.mmap` / `.mmtile` | Pathfinding (server) |
| `Cameras/` | `.m2` camera data | Cinematics |
| `data-version` | text | Version marker |

**Size:** ~3.1 GB after first `docker compose up`.

**Not included:** raw `.MPQ` archives from a retail WoW install. AC Docker extracts these for the server; you do not mount `C:\...\World of Warcraft\Data` manually when using `ac-client-data`.

### Server containers

| Image | Role |
|-------|------|
| `acore/ac-wotlk-db-import` | Schema + world DB import (one-shot) |
| `acore/ac-wotlk-authserver` | Login :3724 |
| `acore/ac-wotlk-worldserver` | Realm :8085, SOAP :7878 |
| `acore/ac-wotlk-client-data` | Seeds extracted data volume |

## Wowser browser client

### UI assets (bundled on Vercel)

Shipped under `frontend/site/client/`:

| Path | Purpose |
|------|---------|
| `Wowser/Wowser.toc` | Entry TOC for in-browser UI |
| `Wowser/*.xml` | Frame definitions |
| `Shaders/**/*.vert` / `*.frag` | WebGL shaders |
| `assets/wowser-client-*.js` | Built TypeScript client |

Rebuild/copy after wowser-client changes:

```powershell
cd frontend/wowser-client
npm run build
# copy dist + public into frontend/site/client (see scripts/sync-wowser-client.ps1)
```

### Game assets (from pipeline)

Production iframe loads with query params from `/api/play/direct`:

- `pipeline=https://wow-pipeline.grudge-studio.com`
- `auth=wss://wow-auth.grudge-studio.com`
- `world=wss://wow-world.grudge-studio.com`

`wow-pipeline` mounts `ac-client-data` at `/azerothcore/env/dist/data` and serves it when `WOW_DATA_PATH` is set (Docker default).

### MPQ vs extracted (important)

| System | Expects |
|--------|---------|
| Legacy `server/wowser` pipeline | `.MPQ` chain under client `Data/` |
| **Current `server/pipeline`** | Extracted AC data (static HTTP) |
| **wowser-client (TS)** | HTTP fetch for TOC/XML/shaders; game networking still experimental |

Full retail `Interface/` from WoW is **not** in repo (license/size). Login UI uses bundled `Wowser/` stubs.

## SOAP auto-provision

`docker/acore/conf/worldserver.conf` (mounted via `docker-compose.override.yml`):

```
SOAP.Enabled = 1
SOAP.IP = "0.0.0.0"
```

Bootstrap admin once:

```powershell
cd server/gateway
node scripts/init-ac-admin.mjs
```

Creates `admin` / `AC_SOAP_PASS` with gmlevel 3 for gateway SOAP calls.