param([Parameter(Mandatory=$true)][int]$DatabaseProcessId)
$ErrorActionPreference='Stop'
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$DatabaseProcessId"
if (!$process -or $process.Name -ne 'mysqld.exe' -or $process.ExecutablePath -ine 'D:\Program Files\xampp\mysql\bin\mysqld.exe' -or $process.CommandLine -notmatch '(?i)d:[\\/]program files[\\/]xampp[\\/]mysql[\\/]bin[\\/]my.ini') { throw 'Unexpected source database process' }
$event=[Threading.EventWaitHandle]::OpenExisting("MySQLShutdown$DatabaseProcessId")
try { [void]$event.Set() } finally { $event.Dispose() }
$deadline=[DateTime]::UtcNow.AddSeconds(20)
do { if (!(Get-Process -Id $DatabaseProcessId -ErrorAction SilentlyContinue)) { Write-Output 'MariaDB stopped through its shutdown event.'; exit 0 }; Start-Sleep -Milliseconds 500 } while ([DateTime]::UtcNow -lt $deadline)
throw 'MariaDB did not finish a graceful stop; no files were changed.'
