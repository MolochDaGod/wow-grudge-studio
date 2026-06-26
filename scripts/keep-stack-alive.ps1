# Keeps Grudge WoW Docker stack + Cloudflare tunnel running (Docker Desktop flake recovery)
$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}

$tunnelExe = "C:\Users\david\Tools\cloudflared.exe"
$tunnelCfg = Join-Path $Root "cloudflared\config.yml"

function Test-Port($port) {
  try { return (Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded }
  catch { return $false }
}

function Ensure-Docker {
  # Prefer Debian WSL native docker (stable); fall back to Docker Desktop
  wsl -d Debian -- docker ps -q 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { return "debian" }
  docker ps -q 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { return "desktop" }
  wsl -d Debian -- true 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { return "debian" }
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
  for ($i = 1; $i -le 40; $i++) {
    Start-Sleep 4
    wsl -d Debian -- docker ps -q 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return "debian" }
    docker ps -q 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return "desktop" }
  }
  return $false
}

function Ensure-Tunnel {
  if (-not (Test-Path $tunnelExe)) { return }
  if (Get-Process cloudflared -ErrorAction SilentlyContinue) { return }
  Start-Process -FilePath $tunnelExe -ArgumentList "tunnel", "--config", $tunnelCfg, "run", "wow-grudge" -WindowStyle Minimized
}

Write-Host "[keep-alive] Grudge WoW stack watchdog started" -ForegroundColor Cyan

while ($true) {
  Ensure-Tunnel
  $docker = Ensure-Docker
  if ($docker) {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $needsRestart = (-not (Test-Port 8787)) -or (-not (Test-Port 3000))
    if ($needsRestart) {
      Write-Host "[keep-alive] restarting compose via $docker $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
      if ($docker -eq "debian") {
        wsl -d Debian -- bash "/mnt/c/Users/david/Desktop/wow-grudge-studio/scripts/debian-wow-up.sh" 2>&1 | Out-Null
      } else {
        $composeArgs = @("-f", "docker-compose.hub.yml")
        if (Test-Path "docker-compose.override.yml") { $composeArgs += @("-f", "docker-compose.override.yml") }
        docker compose @composeArgs --env-file .env up -d 2>&1 | Out-Null
      }
      Start-Sleep 90
    }
  } else {
    Write-Host "[keep-alive] docker unavailable $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor DarkYellow
  }
  Start-Sleep 30
}