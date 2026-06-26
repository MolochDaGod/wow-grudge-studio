# Send worldserver console commands (account create) via docker attach stdin
$ErrorActionPreference = "Stop"
$container = "acore-docker-ac-worldserver-1"
$commands = @(
  "account create admin admin admin"
  "account set gmlevel admin 3 -1"
)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "wsl"
$psi.Arguments = "-d Debian -- docker attach $container"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 2
foreach ($cmd in $commands) {
  $p.StandardInput.WriteLine($cmd)
  Start-Sleep -Milliseconds 500
}
Start-Sleep -Seconds 2
try { $p.Kill() } catch {}
Write-Host "[ok] sent AC console commands to $container" -ForegroundColor Green