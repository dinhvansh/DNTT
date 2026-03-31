param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

Get-Content $BackupFile | docker compose exec -T postgres psql -U payment_app -d payment_request

Write-Output "Restore completed from: $BackupFile"
