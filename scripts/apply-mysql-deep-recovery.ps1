$ErrorActionPreference='Stop'
$workspaceRoot=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $workspaceRoot 'deploy/.runtime'
$proof=Get-Content -LiteralPath (Join-Path $runtime 'mysql-db-deep-preapply.json') -Raw | ConvertFrom-Json
if (!$proof.passed -or $proof.records -ne 3 -or $proof.target -ne 'mysql.careops_db_deep_recovered') { throw 'Verified recovery table required' }
$sourceConfig='D:/Program Files/xampp/mysql/bin/my.ini'
$sourceProcess=Get-CimInstance Win32_Process -Filter "name='mysqld.exe'" | Where-Object { $_.CommandLine -match '(?i)d:[\\/]program files[\\/]xampp[\\/]mysql[\\/]bin[\\/]my.ini' }
if ($sourceProcess) { throw 'Source MySQL must be stopped' }
$databaseDirectory=[IO.Path]::GetFullPath('D:/Program Files/xampp/mysql/data/mysql')
$suffix='.careops-before-deep-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$moves=@(); $applied=@()
try {
    foreach ($extension in @('MAD','MAI','frm')) {
        $original=Join-Path $databaseDirectory ('db.'+$extension)
        $candidate=Join-Path $databaseDirectory ('careops_db_deep_recovered.'+$extension)
        $preserved=$original+$suffix
        if (!(Test-Path -LiteralPath $candidate) -or (Test-Path -LiteralPath $preserved)) { throw 'Recovery file missing or preserved target exists' }
        if (![IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($original)).Equals($databaseDirectory,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected target' }
        Move-Item -LiteralPath $original -Destination $preserved
        $moves+=@{original=$original;preserved=$preserved}
        Move-Item -LiteralPath $candidate -Destination $original
        $applied+=@{original=$original;candidate=$candidate}
    }
    $config=[IO.File]::ReadAllText($sourceConfig)
    [IO.File]::WriteAllText((Join-Path $runtime ('mysql-config-before-deep'+$suffix+'.ini')),$config)
    if ($config -notmatch '(?mi)^\s*console\s*(?:=|$)') {
        # Avoid FreeConsole() on this older Windows server; the launcher captures
        # stdout/stderr in separate files outside the database directory.
        $config=[regex]::Replace($config,'(?mi)^\[mysqld\]\s*$',"[mysqld]`r`nconsole=1",1)
        [IO.File]::WriteAllText($sourceConfig,$config,[Text.UTF8Encoding]::new($false))
    }
    @{applied=$true;sourceBackup='db.MAD-261002082922.BAK';recoveredRecords=3;logicalSha256=$proof.logicalSha256;preservedFiles=$moves;accountTableChanged=$false;businessDatabaseSqlWritten=$false;checkedAt=[DateTimeOffset]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runtime 'mysql-db-deep-applied.json') -Encoding utf8
} catch {
    foreach ($entry in $applied) { if (Test-Path -LiteralPath $entry.original) { Move-Item -LiteralPath $entry.original -Destination $entry.candidate } }
    foreach ($entry in $moves) { if (Test-Path -LiteralPath $entry.preserved) { Move-Item -LiteralPath $entry.preserved -Destination $entry.original } }
    throw
}
$arguments=@(('"--defaults-file='+$sourceConfig+'"'),'--console')
$child=Start-Process -FilePath 'D:/Program Files/xampp/mysql/bin/mysqld.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'mysql-recovered.out.log') -RedirectStandardError (Join-Path $runtime 'mysql-recovered.err.log')
@{pid=$child.Id;configuration=$sourceConfig;console=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'mysql-recovered-process.json') -Encoding utf8
Write-Output 'Activated the three historically recovered grants; all original files retained.'
