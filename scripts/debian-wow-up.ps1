# Start Grudge WoW via Debian WSL (preferred - native docker, more RAM)
$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "=== Grudge WoW via Debian WSL ===" -ForegroundColor Cyan
# Only restart WSL when explicitly requested (wsl --shutdown kills a running stack)
if ($env:WOW_WSL_RESTART -eq '1') {
  Write-Host "WOW_WSL_RESTART=1 - restarting WSL for .wslconfig changes" -ForegroundColor Yellow
  wsl --shutdown 2>$null
  Start-Sleep 4
}
wsl -d Debian -- bash -lc 'echo "Debian: $(free -h | awk "/Mem:/ {print \$2}") RAM, $(nproc) CPUs"'

# Docker login for Hub pulls (grudge_wow image)
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}
if ($env:DOCKER_API_TOKEN_CLOUD -and $env:DOCKERHUB_USERNAME) {
  $env:DOCKER_API_TOKEN_CLOUD | wsl -d Debian -- docker login -u $env:DOCKERHUB_USERNAME --password-stdin 2>&1 | Out-Host
}

# Start stack in Debian
wsl -d Debian -- bash "/mnt/c/Users/david/Desktop/wow-grudge-studio/scripts/debian-wow-up.sh"

# Cloudflare tunnel on Windows (points at WSL-forwarded localhost)
$tunnelExe = "C:\Users\david\Tools\cloudflared.exe"
$tunnelCfg = Join-Path $Root "cloudflared\config.yml"
if (Test-Path $tunnelExe) {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $tunnelExe -ArgumentList "tunnel", "--config", $tunnelCfg, "run", "wow-grudge" -WindowStyle Minimized
  Write-Host "[ok] cloudflared tunnel wow-grudge" -ForegroundColor Green
}

Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Cyan
Write-Host "  https://wow.grudge-studio.com"
Write-Host "  https://wow-api.grudge-studio.com/api/health"
Write-Host "  https://wow-pipeline.grudge-studio.com/health"