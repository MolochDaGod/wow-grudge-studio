# Local build + push grudgestudio/grudge_wow (loads .env for docker login)
param([string]$Tag = "latest")

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}

$User = $env:DOCKERHUB_USERNAME
$Token = $env:DOCKER_API_TOKEN_CLOUD
if (-not $User -or -not $Token) { throw "Set DOCKERHUB_USERNAME and DOCKER_API_TOKEN_CLOUD in .env" }

$Ref = "${User}/grudge_wow:${Tag}"
Write-Host "=== Local build: $Ref ===" -ForegroundColor Cyan

$Token | docker login -u $User --password-stdin
if ($LASTEXITCODE -ne 0) { throw "docker login failed" }

docker build -t $Ref -f docker/grudge-wow/Dockerfile .
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

docker push $Ref
if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

Write-Host "[ok] pushed $Ref" -ForegroundColor Green
Write-Host "Deploy: docker compose -f docker-compose.hub.yml --env-file .env up -d"