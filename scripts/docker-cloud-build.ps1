# Build & push Grudge WoW images via Docker Build Cloud (no local Docker Desktop required)
param(
  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# Load .env
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}

# Org access tokens (dckr_oat_*) must use the Docker Hub org name as username, not a personal account.
# The token also needs cloud-connect scope to use Docker Build Cloud (see .env.example).
$User = $env:DOCKERHUB_USERNAME
$Token = $env:DOCKER_API_TOKEN_CLOUD
$Builder = $env:DOCKER_BUILDX_BUILDER
$CloudEndpoint = $env:DOCKER_BUILD_CLOUD_ENDPOINT
if (-not $User -or -not $Token) { throw "Set DOCKERHUB_USERNAME (org name) and DOCKER_API_TOKEN_CLOUD in .env" }
if (-not $Builder) { $Builder = "cloud-molochdadev-grudgestudio" }
if (-not $CloudEndpoint) { $CloudEndpoint = "molochdadev/grudgestudio" }

Write-Host "=== Docker Build Cloud: $User (builder: $Builder, endpoint: $CloudEndpoint) ===" -ForegroundColor Cyan

$Token | docker login -u $User --password-stdin
if ($LASTEXITCODE -ne 0) {
  throw @"
docker login failed. For dckr_oat_* tokens use the org name (grudgestudio), not a personal username.
"@
}

docker buildx use $Builder 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[setup] connecting buildx to $CloudEndpoint" -ForegroundColor Yellow
  docker buildx create --name $Builder --driver cloud $CloudEndpoint --use
  if ($LASTEXITCODE -ne 0) { throw "buildx builder '$CloudEndpoint' not available for account $User" }
}

$inspect = docker buildx inspect $Builder 2>&1 | Out-String
if ($inspect -match "forbidden from performing this action|401 Unauthorized|cloud-connect") {
  throw @"

Docker Build Cloud denied builder access for '$CloudEndpoint'.

Fix (pick one):
  1. Edit the org access token in Docker Admin Console and enable cloud-connect scope
     (https://docs.docker.com/build-cloud/ci/#creating-access-tokens)
  2. Create a builder under the grudgestudio org at https://app.docker.com/build/
     then set DOCKER_BUILD_CLOUD_ENDPOINT=grudgestudio/<builder-name>
  3. Share the molochdadev/grudgestudio builder with the grudgestudio org, or use a
     molochdadev personal access token with cloud-connect for builds.

Registry login succeeded; only the remote builder authorization failed.
"@
}

$images = @(
  @{ Name = "grudge_wow"; File = "docker/grudge-wow/Dockerfile" },
  @{ Name = "wow-grudge-gateway"; File = "docker/gateway/Dockerfile" },
  @{ Name = "wow-grudge-pipeline"; File = "docker/pipeline/Dockerfile" }
)

foreach ($img in $images) {
  $ref = "${User}/$($img.Name):${Tag}"
  Write-Host "[build] $ref" -ForegroundColor Yellow
  docker buildx build `
    --builder $Builder `
    --platform linux/amd64 `
    --tag $ref `
    --push `
    -f $img.File `
    .
  if ($LASTEXITCODE -ne 0) { throw "build failed: $ref" }
  Write-Host "[ok] pushed $ref" -ForegroundColor Green
}

Write-Host ""
Write-Host "Images pushed. Deploy with:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.hub.yml --env-file .env up -d"