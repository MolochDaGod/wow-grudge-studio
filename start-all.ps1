# Grudge WoW — full launcher (native Wowser + Docker AzerothCore when available)
$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot
Set-Location $Root

# Load .env so WOW_GATEWAY_IMAGE / WOW_PIPELINE_IMAGE enable docker-compose.hub.yml
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}

function Ensure-Npm($dir) {
  if (-not (Test-Path (Join-Path $dir "node_modules"))) {
    Push-Location $dir; npm install --no-fund --no-audit; Pop-Location
  }
}

Write-Host "=== Grudge WoW Stack ===" -ForegroundColor Cyan

# Native node on :8787/:3000 blocks Docker gateway/pipeline — always clear first
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$clientDir = Join-Path $Root "frontend\wowser-client"
if (Test-Path $clientDir) {
  Ensure-Npm $clientDir
  Start-Process -FilePath "npm" -ArgumentList "run","start:dev","--","--host","0.0.0.0","--port","5173" -WorkingDirectory $clientDir -WindowStyle Minimized
}

# 2) Cloudflare tunnel (public connectivity)
$tunnelCfg = Join-Path $Root "cloudflared\config.yml"
if (Test-Path "C:\Users\david\Tools\cloudflared.exe") {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath "C:\Users\david\Tools\cloudflared.exe" -ArgumentList "tunnel","--config",$tunnelCfg,"run","wow-grudge" -WindowStyle Minimized
  Write-Host "[ok] Cloudflare tunnel wow-grudge" -ForegroundColor Green
}

# 3) AzerothCore via Docker (game server) — best-effort
$dockerOk = $false
for ($i = 0; $i -lt 12; $i++) {
  docker ps -q 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
  if ($i -eq 0) { Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 5
}

$dockerStackOk = $false
if ($dockerOk) {
  Write-Host "[..] Starting AzerothCore Docker stack (first run: 10-20 min)..." -ForegroundColor Yellow
  $composeFile = "docker-compose.yml"
  if ($env:WOW_GATEWAY_IMAGE -and $env:WOW_PIPELINE_IMAGE) {
    $composeFile = "docker-compose.hub.yml"
    Write-Host "[..] Using Docker Hub images (Build Cloud)" -ForegroundColor Yellow
  }
  docker compose -f $composeFile --env-file .env up -d 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[..] Waiting for wow-gateway container..." -ForegroundColor Yellow
    for ($w = 0; $w -lt 30; $w++) {
      try {
        $g = Invoke-WebRequest -Uri "http://127.0.0.1:8787/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($g.StatusCode -eq 200) { $dockerStackOk = $true; break }
      } catch {}
      Start-Sleep -Seconds 2
    }
    if ($dockerStackOk) {
      Write-Host "[ok] AzerothCore + Wowser Docker stack started" -ForegroundColor Green
      Write-Host "[..] Bootstrapping SOAP admin (if needed)..." -ForegroundColor Yellow
      $env:AC_MYSQL_HOST = "127.0.0.1"
      $env:AC_MYSQL_PORT = $env:DOCKER_DB_EXTERNAL_PORT
      if (-not $env:AC_MYSQL_PORT) { $env:AC_MYSQL_PORT = "63306" }
      Push-Location (Join-Path $Root "server\gateway")
      node scripts/init-ac-admin.mjs 2>&1 | ForEach-Object { Write-Host $_ }
      Pop-Location
      Write-Host "     Accounts auto-provision on first Grudge ID launch" -ForegroundColor Yellow
    } else {
      Write-Host "[warn] Docker containers up but gateway not healthy yet" -ForegroundColor Yellow
    }
  } else {
    Write-Host "[warn] Docker compose failed — Wowser UI still works, game server offline" -ForegroundColor Yellow
  }
} else {
  Write-Host "[warn] Docker not available — will try native gateway + pipeline" -ForegroundColor Yellow
}

# 4) Native gateway + pipeline fallback only if Docker gateway isn't healthy
$gatewayDir = Join-Path $Root "server\gateway"
$pipelineDir = Join-Path $Root "server\pipeline"
Ensure-Npm $gatewayDir
Ensure-Npm $pipelineDir

function Test-LocalHealth($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    return $r.StatusCode -eq 200
  } catch { return $false }
}

$needGateway = -not (Test-LocalHealth "http://127.0.0.1:8787/api/health")
$needPipeline = -not (Test-LocalHealth "http://127.0.0.1:3000/health")

if ($needGateway) {
  $env:DOTENV_PATH = Join-Path $Root ".env"
  $env:PLAYER_DATA_PATH = Join-Path $Root "data\players.json"
  Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $gatewayDir -WindowStyle Minimized
  Write-Host "[ok] Native wow-gateway on :8787" -ForegroundColor Green
}
if ($needPipeline) {
  $env:DOTENV_PATH = Join-Path $Root ".env"
  Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $pipelineDir -WindowStyle Minimized
  Write-Host "[ok] Native wow-pipeline on :3000" -ForegroundColor Green
}

Write-Host ""
Write-Host "Live endpoints:" -ForegroundColor Cyan
Write-Host "  Browser UI   https://wow.grudge-studio.com"
Write-Host "  Gateway API  https://wow-api.grudge-studio.com/api/health"
Write-Host "  Pipeline     https://wow-pipeline.grudge-studio.com/health"
Write-Host "  Local Wowser http://127.0.0.1:5173"
Write-Host "  Game auth    localhost:3724 | world localhost:8085 (when Docker AC is up)"