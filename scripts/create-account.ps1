# Grudge WoW — account provisioning
# Accounts are normally auto-created on first launch via gateway + AzerothCore SOAP.
# Use this script only for manual overrides or SOAP troubleshooting.

param(
  [string]$User = "wow",
  [string]$Pass = "wow"
)

Write-Host "=== Grudge WoW Accounts ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default flow (no manual step):" -ForegroundColor Green
Write-Host "  1. Player signs in with Grudge ID at https://wow.grudge-studio.com"
Write-Host "  2. First visit: accept or set their Grudge username"
Write-Host "  3. Gateway auto-creates AzerothCore account via SOAP on first launch"
Write-Host ""
Write-Host "Player mapping is stored in gateway data/players.json:" -ForegroundColor Yellow
Write-Host "  grudgeId -> grudgeUsername (canonical cross-game name)"
Write-Host "  grudgeId -> wowAccount.login + wowAccount.password"
Write-Host ""
Write-Host "SOAP requirements:" -ForegroundColor Yellow
Write-Host "  - ac-worldserver SOAP enabled on port 7878"
Write-Host "  - AC_SOAP_USER / AC_SOAP_PASS in .env (default admin/admin)"
Write-Host "  - SOAP user needs GM in acore_auth.account_access (realmID -1)"
Write-Host ""
Write-Host "Manual account create (fallback):" -ForegroundColor Yellow
Write-Host "  docker attach acore-docker-ac-worldserver-1"
Write-Host "  account create $User $Pass $Pass"
Write-Host ""
Write-Host "Detach without stopping: Ctrl+P then Ctrl+Q"
Write-Host ""
Write-Host "Realm: Grudge WoW @ localhost:8085"
Write-Host "Browser: https://wow.grudge-studio.com"