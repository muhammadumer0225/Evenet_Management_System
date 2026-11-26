param(
  [string]$TaskName = "EventSphere MongoDB Daily Backup",
  [string]$Time = "02:00"
)

$ErrorActionPreference = "Stop"
$BackendDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Node = (Get-Command node -ErrorAction Stop).Source
$Script = Join-Path $BackendDir "scripts\backupMongo.js"
$Action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Script`"" -WorkingDirectory $BackendDir
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Daily EventSphere MongoDB backup with retention cleanup" -Force | Out-Null
Write-Host "Scheduled '$TaskName' daily at $Time. Verify MONGO_URI and MongoDB Database Tools in backend/.env/PATH."
