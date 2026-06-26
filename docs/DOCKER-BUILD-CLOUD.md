# Docker Build Cloud checklist

## Current status

Run `.\scripts\verify-credentials.ps1` — Build Cloud line must show `[ok]`.

| Step | Status |
|------|--------|
| Org login (`grudgestudio` + OAT) | ✅ Works |
| Registry push scope (wow-grudge-*) | ✅ Works |
| Builder access (`molochdadev/grudgestudio`) | ❌ Enable **cloud-connect** on OAT (see below) |

Full hosting + play guide: [HOSTING-AND-PLAY.md](HOSTING-AND-PLAY.md)

## Token setup (one-time)

1. Open [Docker Admin Console](https://app.docker.com/) → select **grudgestudio** org.
2. **Admin Console → Access tokens** → edit **GrudgeBuilder** (or create new).
3. Enable scopes:
   - ✅ **cloud-connect**
   - ✅ **Read public repositories**
   - ✅ **Image Push** on `wow-grudge-gateway`
   - ✅ **Image Push** on `wow-grudge-pipeline`
4. Save token to `.env`:

   ```
   DOCKERHUB_USERNAME=grudgestudio
   DOCKER_API_TOKEN_CLOUD=dckr_oat_...
   ```

5. Login username is **`grudgestudio`**, not `molochdadev`.

## Builder options

### Option A — Share existing builder (fastest)

Builder owner (`molochdadev`) shares `grudgestudio` builder with grudgestudio org in [Build Cloud dashboard](https://app.docker.com/build/).

Keep in `.env`:

```
DOCKER_BUILD_CLOUD_ENDPOINT=molochdadev/grudgestudio
DOCKER_BUILDX_BUILDER=cloud-molochdadev-grudgestudio
```

### Option B — Org-owned builder (recommended)

1. Create builder under **grudgestudio** org at https://app.docker.com/build/
2. Update `.env`:

   ```
   DOCKER_BUILD_CLOUD_ENDPOINT=grudgestudio/<builder-name>
   DOCKER_BUILDX_BUILDER=cloud-grudgestudio-<builder-name>
   ```

3. OAT with cloud-connect on grudgestudio org can build directly.

## Build & deploy

```powershell
.\scripts\docker-cloud-build.ps1
docker compose -f docker-compose.hub.yml --env-file .env up -d
```

Expected output:

```
[build] grudgestudio/wow-grudge-gateway:latest
[ok] pushed grudgestudio/wow-grudge-gateway:latest
[build] grudgestudio/wow-grudge-pipeline:latest
[ok] pushed grudgestudio/wow-grudge-pipeline:latest
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `incorrect username or password` on login | Use org name `grudgestudio`, not personal username |
| `forbidden ... builder:...:build` | Add cloud-connect to OAT or share/create builder |
| `concurrent build limit of 0` | Build Cloud plan/seat issue — check subscription |
| Local `docker info` fails | OK for Build Cloud; only buildx cloud driver needed |

## Verify without building

```powershell
docker login -u grudgestudio
docker buildx inspect cloud-molochdadev-grudgestudio
```

Inspect should show nodes **running** without `401` or `forbidden` errors.