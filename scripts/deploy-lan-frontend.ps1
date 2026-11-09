param()
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $frontendRoot 'deploy/.runtime'
$settingsPath = Join-Path $runtime 'frontend.env'
$servicesScript = Join-Path $PSScriptRoot 'lan-services.ps1'
$selector = Join-Path $PSScriptRoot 'select-galaxy-frontend.cjs'
$node = (Get-Command node).Source
if (!(Test-Path -LiteralPath $settingsPath)) { throw 'Configure the LAN runtime before deploying.' }
$previousSettings = [IO.File]::ReadAllText($settingsPath)
$build = '.next-work-release-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff') + '-local'
$environmentNames = @('CAREOPS_RELEASE', 'CAREOPS_WORK_DIST_DIR', 'CIRCLE_NODE_TOTAL')
$previousEnvironment = @{}
foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location $frontendRoot
try {
    $env:CAREOPS_RELEASE = 'work'
    $env:CAREOPS_WORK_DIST_DIR = $build
    # Limit static-generation workers on this 8 GB development machine.
    $env:CIRCLE_NODE_TOTAL = '3'
    Write-Output "Building current saved source into $build; the live build stays available."
    & $node (Join-Path $frontendRoot 'node_modules/next/dist/bin/next') build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. The running LAN release was not changed.' }
    if (!(Test-Path -LiteralPath (Join-Path $frontendRoot "$build/BUILD_ID"))) { throw 'Build is incomplete; LAN unchanged.' }
    try {
        & $servicesScript -Action stop
        & $node $selector "--build=$build"
        if ($LASTEXITCODE -ne 0) { throw 'Could not select the completed build.' }
        & $servicesScript -Action start
        $ready = $false
        for ($attempt = 0; $attempt -lt 12; $attempt++) {
            & $node (Join-Path $PSScriptRoot 'check-lan.cjs')
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            Start-Sleep -Seconds 2
        }
        if (!$ready) { throw 'New release did not become ready.' }
        $manifest = Get-Content -LiteralPath (Join-Path $runtime 'manifest.json') -Raw | ConvertFrom-Json
        Write-Output "Deployed $build at $($manifest.origin). Reload the browser once."
    } catch {
        $deploymentError = $_
        Write-Warning 'Deployment failed; restoring the previous frontend selection.'
        & $servicesScript -Action stop
        [IO.File]::WriteAllText($settingsPath, $previousSettings, [Text.UTF8Encoding]::new($false))
        & $servicesScript -Action start
        throw $deploymentError
    }
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
    Pop-Location
}
