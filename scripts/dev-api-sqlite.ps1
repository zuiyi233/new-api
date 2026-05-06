<#
.SYNOPSIS
  Launch backend in SQLite mode with memory cache (no Docker).
.DESCRIPTION
  Sets environment variables for SQLite + memory cache and starts
  the backend via air (hot-reload) or go run.
#>
param(
  [int]$Port = 36173,
  [string]$SQLitePath = '',
  [switch]$NoHotReload
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')

$root = Get-RepoRoot
Set-Location $root

if ([string]::IsNullOrEmpty($SQLitePath)) {
  $SQLitePath = Join-Path $root 'new-api-local.db'
}

$env:PORT = $Port.ToString()
$env:SQL_DSN = ''
$env:SQLITE_PATH = $SQLitePath
$env:REDIS_CONN_STRING = ''
$env:MEMORY_CACHE_ENABLED = 'true'
$env:TZ = 'Asia/Shanghai'
$env:GIN_MODE = 'debug'
$env:ERROR_LOG_ENABLED = 'true'
$env:BATCH_UPDATE_ENABLED = 'true'
$env:SESSION_SECRET = 'local-dev-session-secret-change-in-production'

$overrideFile = Join-Path $root '.env.dev.local'
if (Test-Path $overrideFile) {
  Get-Content $overrideFile | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Length -ne 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    Set-Item -Path ("Env:" + $name) -Value $value
  }
}

$null = Ensure-DevLogDir -Root $root

Write-Host ''
Write-Host '==> Starting backend (SQLite mode)' -ForegroundColor Cyan
Write-Host "    PORT=$($env:PORT)"
Write-Host "    SQLITE_PATH=$SQLitePath"
Write-Host "    REDIS=disabled (memory cache)"
Write-Host "    HotReload=$(-not $NoHotReload)"
Write-Host ''

if ($NoHotReload) {
  go run . --log-dir ./logs/dev-local
  exit $LASTEXITCODE
}

$airPath = Ensure-AirInstalled
$airConfig = Join-Path $PSScriptRoot 'air.dev.toml'
& $airPath -c $airConfig
exit $LASTEXITCODE
