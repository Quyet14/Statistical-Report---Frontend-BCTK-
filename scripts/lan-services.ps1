param(
    [ValidateSet('start', 'stop', 'status')][string]$Action = 'status',
    [string]$ConfigDirectory,
    [switch]$OpenFirewall
)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
if (!$ConfigDirectory) { $ConfigDirectory = Join-Path $frontendRoot 'deploy/.runtime' }
$runtimeDirectory = [IO.Path]::GetFullPath($ConfigDirectory)
$manifest = Get-Content -LiteralPath (Join-Path $runtimeDirectory 'manifest.json') -Raw | ConvertFrom-Json
$statePath = Join-Path $runtimeDirectory 'services.json'
$nginxDirectory = Join-Path $runtimeDirectory 'tools/nginx-1.31.8'
$nginxExecutable = Join-Path $nginxDirectory 'nginx.exe'
$nginxPrefix = $nginxDirectory.Replace('\', '/') + '/'
$nginxConfig = (Join-Path $runtimeDirectory 'nginx.conf').Replace('\', '/')
$nodeExecutable = (Get-Command node).Source
$runner = Join-Path $frontendRoot 'scripts/run-service.cjs'
if ($Action -eq 'status') {
    if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath } else { Write-Output 'No managed LAN services recorded.' }
    exit 0
}
if ($Action -eq 'stop') {
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $allProcesses = @(Get-CimInstance Win32_Process)
        foreach ($service in $state.services) {
            $rootProcess = $allProcesses | Where-Object { $_.ProcessId -eq $service.pid -and $_.CommandLine -like "*$runner*" }
            if (!$rootProcess) { continue }
            $ownedIds = [Collections.Generic.List[int]]::new()
            $ownedIds.Add([int]$rootProcess.ProcessId)
            for ($index = 0; $index -lt $ownedIds.Count; $index++) {
                foreach ($childProcess in $allProcesses | Where-Object { $_.ParentProcessId -eq $ownedIds[$index] }) { $ownedIds.Add([int]$childProcess.ProcessId) }
            }
            for ($index = $ownedIds.Count - 1; $index -ge 0; $index--) { Stop-Process -Id $ownedIds[$index] -ErrorAction SilentlyContinue }
        }
        if (Test-Path -LiteralPath $nginxExecutable) { & $nginxExecutable -p $nginxPrefix -c $nginxConfig -s quit }
        Remove-Item -LiteralPath $statePath
    }
    Write-Output 'Managed Node/gateway services stopped. Redis data/volume retained.'
    exit 0
}
if (Test-Path -LiteralPath $statePath) { throw 'Managed state exists. Check status and stop before starting again.' }
if (!(Test-Path -LiteralPath $nginxExecutable)) { throw 'Portable nginx 1.31.8 is required under deploy/.runtime/tools for this Windows LAN launcher.' }
& $nodeExecutable (Join-Path $frontendRoot 'scripts/deployment-config.cjs') --check --generated "--out=$runtimeDirectory"
if ($LASTEXITCODE -ne 0) { throw 'Configuration check failed.' }
& $nginxExecutable -p $nginxPrefix -c $nginxConfig -t
if ($LASTEXITCODE -ne 0) { throw 'nginx config check failed.' }
& docker compose -p careops-lan -f (Join-Path $runtimeDirectory 'redis.compose.yml') up -d
if ($LASTEXITCODE -ne 0) { throw 'Redis could not start.' }
$services = @()
foreach ($service in @('backend', 'frontend')) {
    $arguments = @('"' + $runner + '"', $service, '"' + $runtimeDirectory + '"')
    $childProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $frontendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory "$service.out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$service.err.log") -PassThru
    $services += @{ name = $service; pid = $childProcess.Id }
}
$gateway = Start-Process -FilePath $nginxExecutable -ArgumentList @('-p', $nginxPrefix, '-c', $nginxConfig) -WorkingDirectory $nginxDirectory -WindowStyle Hidden -PassThru
@{ origin = $manifest.origin; services = $services; gatewayPid = $gateway.Id } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
if ($OpenFirewall) {
    & (Join-Path $PSScriptRoot 'open-lan-firewall.ps1') -ConfigDirectory $runtimeDirectory
}
Write-Output "LAN gateway started: $($manifest.origin)"
