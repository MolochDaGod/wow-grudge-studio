$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Wait-Docker {
  for ($i = 0; $i -lt 48; $i++) {
    docker ps -q 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return $true }
    if ($i -eq 0) { Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 5
  }
  return $false
}

if (-not (Wait-Docker)) { throw "Docker Desktop is not running." }

docker compose --env-file .env up -d @args
if ($LASTEXITCODE -ne 0) {
  Write-Host "Compose failed, retrying once..." -ForegroundColor Yellow
  Start-Sleep -Seconds 8
  if (-not (Wait-Docker)) { throw "Docker lost connection." }
  docker compose --env-file .env up -d @args
}
exit $LASTEXITCODE