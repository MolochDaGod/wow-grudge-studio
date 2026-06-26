# Audit wow-grudge-studio docs vs code using Gemini CLI
# Requires: npm i -g @google/gemini-cli  AND  active GEMINI_API_KEY
param(
  [switch]$Fix
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# Load .env (GEMINI_API_KEY or GEMINI_CLI_API alias)
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
  }
}
if ($env:GEMINI_CLI_API -and -not $env:GEMINI_API_KEY) {
  $env:GEMINI_API_KEY = $env:GEMINI_CLI_API
}

if (-not $env:GEMINI_API_KEY) {
  Write-Host "Set GEMINI_API_KEY in .env (create at https://aistudio.google.com/apikey)" -ForegroundColor Yellow
  Write-Host "Skipping Gemini audit — docs are in docs/ and README.md" -ForegroundColor Cyan
  exit 0
}

$gemini = Get-Command gemini -ErrorAction SilentlyContinue
if (-not $gemini) {
  throw "gemini CLI not found. Run: npm i -g @google/gemini-cli"
}

$prompt = @"
Read .gemini/GEMINI.md and docs/CONSISTENCY.md first.

Audit this project for documentation drift:
1. Compare server/gateway/index.js routes to docs/API.md
2. Compare .env.example vars to docs/CONSISTENCY.md and docker-compose*.yml
3. Check README.md quick-start commands still work
4. List any UI strings in frontend/site/ that violate CONSISTENCY.md naming

Output the drift report format defined in .gemini/GEMINI.md.
Do not modify files unless explicitly asked.
"@

$outFile = Join-Path $Root "docs\drift-report-$(Get-Date -Format 'yyyyMMdd-HHmm').md"
Write-Host "=== Gemini doc audit ===" -ForegroundColor Cyan
Write-Host "Report -> $outFile" -ForegroundColor Yellow

if ($Fix) {
  $prompt += "`n`nApply safe doc-only fixes (markdown files only). Do not change server code."
}

$prompt | gemini --non-interactive 2>&1 | Tee-Object -FilePath $outFile

Write-Host ""
Write-Host "[ok] Audit complete: $outFile" -ForegroundColor Green