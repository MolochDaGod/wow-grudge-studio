# Grudge WoW / Wowser local launcher
# Starts pipeline + gateway, optionally Wowser dev client and Cloudflare tunnel.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$envFile = Join-Path $Root ".env"

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $Root ".env.example") $envFile
  Write-Host "Created .env from .env.example — set WOW_DATA_PATH before playing." -ForegroundColor Yellow
}

function Ensure-Npm($dir) {
  if (-not (Test-Path (Join-Path $dir "node_modules"))) {
    Write-Host "Installing deps in $dir ..."
    Push-Location $dir
    npm install --no-fund --no-audit
    Pop-Location
  }
}

Ensure-Npm (Join-Path $Root "server\gateway")
Ensure-Npm (Join-Path $Root "server\pipeline")

$gateway = Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory (Join-Path $Root "server\gateway") -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 1
$pipeline = Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory (Join-Path $Root "server\pipeline") -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 1

$clientDir = Join-Path $Root "frontend\wowser-client"
if (Test-Path (Join-Path $clientDir "package.json")) {
  Ensure-Npm $clientDir
  $client = Start-Process -FilePath "npm" -ArgumentList "run","start:dev","--","--host","0.0.0.0","--port","5173" -WorkingDirectory $clientDir -PassThru -WindowStyle Minimized
}

$tunnelCfg = Join-Path $Root "cloudflared\config.yml"
if ((Test-Path "C:\Users\david\Tools\cloudflared.exe") -and (Test-Path $tunnelCfg)) {
  $tunnel = Start-Process -FilePath "C:\Users\david\Tools\cloudflared.exe" -ArgumentList "tunnel","--config",$tunnelCfg,"run","wow-grudge" -PassThru -WindowStyle Minimized
  Write-Host "Cloudflare tunnel started (wow-grudge)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Grudge WoW stack running:" -ForegroundColor Cyan
Write-Host "  Gateway   -> http://127.0.0.1:8787/api/health"
Write-Host "  Pipeline  -> http://127.0.0.1:3000/health"
Write-Host "  Wowser UI -> http://127.0.0.1:5173"
Write-Host "  Frontend  -> https://wow.grudge-studio.com"
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

try {
  while ($true) { Start-Sleep -Seconds 5 }
} finally {
  foreach ($p in @($gateway, $pipeline, $client, $tunnel)) {
    if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
}