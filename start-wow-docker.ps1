# Grudge WoW — Docker launcher (AzerothCore + Wowser gateway/pipeline + tunnel)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

Write-Host "Building and starting Grudge WoW Docker stack..." -ForegroundColor Cyan
docker compose --env-file .env up -d --build 2>&1

Write-Host ""
Write-Host "Waiting for database import and client data (first run: 5-15 min)..." -ForegroundColor Yellow
docker compose ps

Write-Host ""
Write-Host "Starting Cloudflare tunnel (wow-grudge)..." -ForegroundColor Cyan
$tunnelCfg = Join-Path $Root "cloudflared\config.yml"
if (Test-Path "C:\Users\david\Tools\cloudflared.exe") {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Process -FilePath "C:\Users\david\Tools\cloudflared.exe" -ArgumentList "tunnel","--config",$tunnelCfg,"run","wow-grudge" -WindowStyle Minimized
}

Write-Host ""
Write-Host "Grudge WoW is starting up:" -ForegroundColor Green
Write-Host "  Game server  -> localhost:3724 (auth) / localhost:8085 (world)"
Write-Host "  Gateway API  -> https://wow-api.grudge-studio.com/api/health"
Write-Host "  Pipeline     -> https://wow-pipeline.grudge-studio.com/health"
Write-Host "  Browser play -> https://wow.grudge-studio.com"
Write-Host ""
Write-Host "Create account (after worldserver is up):" -ForegroundColor Yellow
Write-Host "  docker attach acore-docker-ac-worldserver-1"
Write-Host "  account create wow wow wow"
Write-Host ""
Write-Host "Logs: docker compose logs -f ac-worldserver wow-gateway wow-pipeline"