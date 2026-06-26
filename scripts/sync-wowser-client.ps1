# Build wowser-client and sync into Vercel launcher bundle
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Client = Join-Path $Root "frontend\wowser-client"
$Site = Join-Path $Root "frontend\site\client"

Push-Location $Client
if (-not (Test-Path node_modules)) { npm install --no-fund --no-audit }
npm run build
Pop-Location

# Vite build output (hashed JS)
$dist = Join-Path $Client "dist"
if (Test-Path $dist) {
  Copy-Item -Recurse -Force (Join-Path $dist "*") $Site
  Write-Host "[ok] copied dist build" -ForegroundColor Green
}

foreach ($dir in @("Wowser", "Shaders", "Interface")) {
  $src = Join-Path $Client "public\$dir"
  $dst = Join-Path $Site $dir
  if (Test-Path $src) {
    Copy-Item -Recurse -Force $src $dst
    Write-Host "[ok] copied $dir" -ForegroundColor Green
  }
}

Write-Host "[ok] Wowser client synced to frontend/site/client — deploy with: cd frontend/site && vercel --prod" -ForegroundColor Cyan