# End-to-end stack verification for wow.grudge-studio.com
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

function Test-Url($label, $url, $expect) {
  try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec 8 -UseBasicParsing
    $ok = $r.StatusCode -eq 200
    if ($expect -and $ok) { $ok = $r.Content -match $expect }
    $mark = if ($ok) { "[ok]" } else { "[--]" }
    $color = if ($ok) { "Green" } else { "Yellow" }
    Write-Host "$mark $label" -ForegroundColor $color
    if (-not $ok -and $r.Content) { Write-Host "     $($r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)))" -ForegroundColor DarkGray }
    return $ok
  } catch {
    Write-Host "[--] $label — $($_.Exception.Message)" -ForegroundColor Yellow
    return $false
  }
}

Write-Host "=== Grudge WoW stack verification ===" -ForegroundColor Cyan

# Docker
$dockerOk = $false
try { docker ps -q 2>$null | Out-Null; $dockerOk = $LASTEXITCODE -eq 0 } catch {}
Write-Host "$(if ($dockerOk) {'[ok]'} else {'[--]'}) Docker daemon" -ForegroundColor $(if ($dockerOk) {"Green"} else {"Yellow"})

if ($dockerOk) {
  $names = docker ps --format "{{.Names}}" 2>$null
  foreach ($svc in @("wow-gateway","wow-pipeline","acore-docker-ac-worldserver-1","wow-grudge-studio-ac-authserver-1")) {
    $up = $names -match $svc
    Write-Host "$(if ($up) {'[ok]'} else {'[--]'}) container $svc" -ForegroundColor $(if ($up) {"Green"} else {"Yellow"})
  }
  $vol = docker run --rm -v wow-grudge-studio_ac-client-data:/data alpine sh -c "test -d /data/dbc && du -sh /data" 2>$null
  if ($vol) { Write-Host "[ok] AC client-data volume ($vol)" -ForegroundColor Green }
  else { Write-Host "[--] AC client-data volume missing or empty" -ForegroundColor Yellow }
}

# No native node stealing ports
$nodeOnGateway = netstat -ano 2>$null | Select-String ":8787.*LISTENING" | Where-Object { $_ -notmatch "docker" }
if (-not $nodeOnGateway) {
  Write-Host "[ok] port 8787 not blocked by stray native node" -ForegroundColor Green
} else {
  Write-Host "[--] port 8787 conflict — run: Get-Process node | Stop-Process -Force" -ForegroundColor Yellow
}

Test-Url "Local gateway" "http://127.0.0.1:8787/api/health" '"wow-pipeline:3000"'
Test-Url "Local pipeline" "http://127.0.0.1:3000/health" "WoW client data"
Test-Url "Public launcher" "https://wow.grudge-studio.com/" "200"
Test-Url "Public gateway" "https://wow-api.grudge-studio.com/api/health" '"status":"ok"'
Test-Url "Public pipeline" "https://wow-pipeline.grudge-studio.com/health" '"status"'

Write-Host ""
Write-Host "Flow test:" -ForegroundColor Cyan
if (Get-Command node -ErrorAction SilentlyContinue) {
  node scripts/test-flow.mjs 2>&1
}

Write-Host ""
Write-Host "SOAP admin bootstrap (if 0 accounts):" -ForegroundColor Cyan
Write-Host "  cd server/gateway && node scripts/init-ac-admin.mjs"