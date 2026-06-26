# Verify third-party API credentials loaded from .env (no secrets printed)
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

function Report($name, $ok, $detail) {
  $color = if ($ok) { "Green" } else { "Yellow" }
  $mark = if ($ok) { "[ok]" } else { "[--]" }
  Write-Host "$mark $name" -ForegroundColor $color
  if ($detail) { Write-Host "     $detail" -ForegroundColor DarkGray }
}

Write-Host "=== Credential verification ===" -ForegroundColor Cyan

# Docker Hub (org OAT)
if ($env:DOCKER_API_TOKEN_CLOUD -and $env:DOCKERHUB_USERNAME) {
  $auth = curl.exe -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:grudgestudio/grudge_wow:pull" `
    -u "$($env:DOCKERHUB_USERNAME):$($env:DOCKER_API_TOKEN_CLOUD)"
  $dockerOk = $auth -match '"token"'
  Report "Docker Hub ($($env:DOCKERHUB_USERNAME))" $dockerOk $(if (-not $dockerOk) { "login or repo scope issue" })
} else {
  Report "Docker Hub" $false "DOCKERHUB_USERNAME / DOCKER_API_TOKEN_CLOUD not set"
}

# Build Cloud builder
if ($env:DOCKER_BUILDX_BUILDER) {
  $inspect = docker buildx inspect $env:DOCKER_BUILDX_BUILDER 2>&1 | Out-String
  $bcOk = $inspect -notmatch "forbidden|401 Unauthorized"
  Report "Docker Build Cloud ($($env:DOCKER_BUILDX_BUILDER))" $bcOk $(if (-not $bcOk) { "needs cloud-connect on OAT - see docs/DOCKER-BUILD-CLOUD.md" })
}

# Cloudflare
if ($env:CLOUDFLARE_API_TOKEN) {
  $cfAcct = curl.exe -s -H "Authorization: Bearer $($env:CLOUDFLARE_API_TOKEN)" "https://api.cloudflare.com/client/v4/accounts"
  $acctOk = $cfAcct -match '"success":true'
  Report "Cloudflare account API" $acctOk

  if ($env:CLOUDFLARE_ZONE_ID) {
    $cfDns = curl.exe -s -H "Authorization: Bearer $($env:CLOUDFLARE_API_TOKEN)" `
      "https://api.cloudflare.com/client/v4/zones/$($env:CLOUDFLARE_ZONE_ID)/dns_records?per_page=1"
    $dnsOk = $cfDns -match '"success":true'
    Report "Cloudflare DNS API" $dnsOk $(if (-not $dnsOk) { "token needs Zone.DNS Read - add in Cloudflare token settings" })
  }

  $tunnelCred = "$env:USERPROFILE\.cloudflared\40054045-d722-400d-811e-ac8bcff05d68.json"
  if (Test-Path $tunnelCred) {
    Report "Cloudflare tunnel credentials (local)" $true "wow-grudge tunnel file present"
  } else {
    Report "Cloudflare tunnel credentials (local)" $false "missing $tunnelCred"
  }
} else {
  Report "Cloudflare" $false "CLOUDFLARE_API_TOKEN not set"
}

# Poly Pizza
if ($env:POLY_PIZZA_KEY) {
  $pp = curl.exe -s -H "X-Auth-Token: $($env:POLY_PIZZA_KEY)" "https://api.poly.pizza/v1/search?License=free&limit=1"
  $ppOk = $pp -notmatch "API key|dingus|Unauthorized"
  Report "Poly Pizza API" $ppOk $(if (-not $ppOk) { "key rejected or query error" })
} else {
  Report "Poly Pizza" $false "POLY_PIZZA_KEY not set (optional)"
}

# Colyseus deploy
if ($env:COLYEUS_DEPLOY_TOKEN) {
  Report "Colyseus deploy token" $true "set (verify via colyseus cloud dashboard)"
} else {
  Report "Colyseus deploy" $false "COLYEUS_DEPLOY_TOKEN not set (optional)"
}

# Gemini
if ($env:GEMINI_API_KEY) {
  $g = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$($env:GEMINI_API_KEY)" -ErrorAction SilentlyContinue
  $gOk = $null -ne $g.models
  Report "Gemini API" $gOk $(if (-not $gOk) { "key missing, invalid, or suspended" })
} else {
  Report "Gemini API" $false "GEMINI_API_KEY not set (optional - scripts/gemini-docs.ps1)"
}

Write-Host ""