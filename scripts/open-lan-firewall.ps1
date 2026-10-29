#Requires -RunAsAdministrator
param([string]$ConfigDirectory, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
if (!$ConfigDirectory) { $ConfigDirectory = Join-Path $frontendRoot 'deploy/.runtime' }
$runtimeDirectory = [IO.Path]::GetFullPath($ConfigDirectory)
$manifest = Get-Content -LiteralPath (Join-Path $runtimeDirectory 'manifest.json') -Raw | ConvertFrom-Json
$origin = [Uri]$manifest.origin
$address = $null
if (![Net.IPAddress]::TryParse($origin.DnsSafeHost, [ref]$address)) { throw 'LAN test rule requires a literal local IP origin.' }
$port = $origin.Port
$program = Join-Path $runtimeDirectory 'tools/nginx-1.31.8/nginx.exe'
if (!(Test-Path -LiteralPath $program)) { throw 'CareOps nginx binary not found.' }
$ruleName = "CareOps-LAN-HTTPS-$port"
$existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if ($Remove) {
    if ($existing) {
        $application = $existing | Get-NetFirewallApplicationFilter
        if ($application.Program -ne $program) { throw 'Rule belongs to a different application; no change made.' }
        $existing | Remove-NetFirewallRule
    }
    $statusFile = Join-Path $runtimeDirectory 'firewall-status.json'
    if (Test-Path -LiteralPath $statusFile) { Remove-Item -LiteralPath $statusFile }
    Write-Output 'CareOps LAN rule removed; other firewall rules unchanged.'
    exit 0
}
if ($existing) {
    $application = $existing | Get-NetFirewallApplicationFilter
    $ports = $existing | Get-NetFirewallPortFilter
    $addresses = $existing | Get-NetFirewallAddressFilter
    if ($application.Program -ne $program -or $ports.LocalPort -ne $port -or $addresses.RemoteAddress -notcontains 'LocalSubnet' -or $addresses.LocalAddress -notcontains $address.IPAddressToString) { throw 'Existing rule differs. Review it rather than overwriting.' }
} else {
    New-NetFirewallRule -Name $ruleName -DisplayName "CareOps HTTPS LAN test $port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -LocalAddress $address.IPAddressToString -RemoteAddress LocalSubnet -Program $program -Profile Any | Out-Null
}
Write-Output "Allowed CareOps nginx TCP $port at $address, source LocalSubnet only. Other firewall rules unchanged."
@{ rule = $ruleName; port = $port; localAddress = $address.IPAddressToString; remoteAddress = 'LocalSubnet'; enabled = $true; checkedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'firewall-status.json') -Encoding UTF8
