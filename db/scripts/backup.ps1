param(
  [string]$OutputDir = "db/backups"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$targetFile = Join-Path $OutputDir "payment_request-$timestamp.sql"

docker compose exec -T postgres pg_dump -U payment_app -d payment_request --clean --if-exists | Set-Content -Path $targetFile

Write-Output "Backup created: $targetFile"
