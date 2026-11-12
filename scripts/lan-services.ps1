param(
    [ValidateSet('start', 'stop', 'status', 'preflight')][string]$Action = 'status',
    [ValidateSet('all', 'frontend', 'backend')][string]$Service = 'all',
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
function Assert-ServicePortsFree {
    $ports = @()
    if ($Service -in @('all', 'frontend')) { $ports += [int]$manifest.frontendPort }
    if ($Service -in @('all', 'backend')) { $ports += [int]$manifest.backendPort }
    foreach ($port in $ports) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $listener.Start() }
        catch { throw "Port $port is already occupied. No existing process was stopped. Use the managed LAN launcher instead of starting a second server." }
        finally { $listener.Stop() }
    }
}
if ($Action -eq 'preflight') { Assert-ServicePortsFree; Write-Output 'Service ports are available.'; exit 0 }
if ($Action -eq 'status') {
    if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath } else { Write-Output 'No managed LAN services recorded.' }
    exit 0
}
if ($Action -eq 'stop') {
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $allProcesses = @(Get-CimInstance Win32_Process)
        foreach ($record in $state.services) {
            if ($record.managed -eq $false) { continue }
            if ($Service -ne 'all' -and $record.name -ne $Service) { continue }
            $rootProcess = $allProcesses | Where-Object { $_.ProcessId -eq $record.pid -and $_.CommandLine -like "*$runner*" -and $_.CommandLine -like "*$runtimeDirectory*" -and $_.CommandLine -match ("\s" + [regex]::Escape($record.name) + "\s") }
            if (!$rootProcess) { continue }
            $ownedIds = [Collections.Generic.List[int]]::new()
            $ownedIds.Add([int]$rootProcess.ProcessId)
            for ($index = 0; $index -lt $ownedIds.Count; $index++) {
                foreach ($childProcess in $allProcesses | Where-Object { $_.ParentProcessId -eq $ownedIds[$index] }) { $ownedIds.Add([int]$childProcess.ProcessId) }
            }
            for ($index = $ownedIds.Count - 1; $index -ge 0; $index--) { Stop-Process -Id $ownedIds[$index] -ErrorAction SilentlyContinue }
            foreach ($ownedId in $ownedIds) { Wait-Process -Id $ownedId -Timeout 10 -ErrorAction SilentlyContinue }
        }
        if ($Service -eq 'all') {
            if (Test-Path -LiteralPath $nginxExecutable) { & $nginxExecutable -p $nginxPrefix -c $nginxConfig -s quit }
            Remove-Item -LiteralPath $statePath
        } else {
            $state.services = @($state.services | Where-Object { $_.name -ne $Service })
            $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
        }
    }
    if ($Service -eq 'all') { Write-Output 'Managed Node/gateway services stopped. Redis data/volume retained.' }
    else { Write-Output "Stopped managed $Service only; other services were retained." }
    exit 0
}
Assert-ServicePortsFree
if ($Service -ne 'all') {
    if (!(Test-Path -LiteralPath $statePath)) { throw 'Start the complete LAN stack before restarting an individual service.' }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if (@($state.services | Where-Object { $_.name -eq $Service }).Count) { throw 'Stop the selected managed service first.' }
    $arguments = @('"' + $runner + '"', $Service, '"' + $runtimeDirectory + '"')
    $childProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $frontendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory "$Service.out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$Service.err.log") -PassThru
    $state.services = @($state.services) + @{ name = $Service; pid = $childProcess.Id }
    $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output "Started $Service; other services and gateway were retained."
    exit 0
}
if (Test-Path -LiteralPath $statePath) {
    $previousState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $processes = @(Get-CimInstance Win32_Process)
    $ownedServices = @($previousState.services | Where-Object {
        $record = $_
        if ($record.managed -ne $false) { $processes | Where-Object { $_.ProcessId -eq $record.pid -and $_.CommandLine -like "*$runner*" } }
    })
    $ownedGateway = @($processes | Where-Object { $_.ProcessId -eq $previousState.gatewayPid -and $_.ExecutablePath -eq $nginxExecutable })
    if ($ownedServices.Count -or $ownedGateway.Count) { throw 'Managed services are still running. Check status before starting another instance.' }
    $archive = Join-Path $runtimeDirectory ("services-stale-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '.json')
    Move-Item -LiteralPath $statePath -Destination $archive
    Write-Output 'Archived stale process IDs; no running service was stopped.'
}
if (!(Test-Path -LiteralPath $nginxExecutable)) { throw 'Portable nginx 1.31.8 is required under deploy/.runtime/tools for this Windows LAN launcher.' }
& $nodeExecutable (Join-Path $frontendRoot 'scripts/deployment-config.cjs') --check --generated "--out=$runtimeDirectory"
if ($LASTEXITCODE -ne 0) { throw 'Configuration check failed.' }
& $nginxExecutable -p $nginxPrefix -c $nginxConfig -t
if ($LASTEXITCODE -ne 0) { throw 'nginx config check failed.' }
& docker compose -p careops-lan -f (Join-Path $runtimeDirectory 'redis.compose.yml') up -d
if ($LASTEXITCODE -ne 0) { throw 'Redis could not start.' }
$services = @()
$serviceNames = @('backend', 'frontend')
$backupConfiguration = Join-Path $runtimeDirectory 'backup.env'
if ((Test-Path -LiteralPath $backupConfiguration) -and ((Get-Content -LiteralPath $backupConfiguration) -match '^BACKUP_AUTOMATION_ENABLED=true$')) { $serviceNames += 'backup' }
foreach ($service in $serviceNames) {
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
