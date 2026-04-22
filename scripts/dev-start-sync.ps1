<#
.SYNOPSIS
  New API Local Dev - Pure Local Synchronous Startup (No Docker)
.DESCRIPTION
  Starts frontend (Vite) and backend (Go/air) locally using SQLite + memory cache.
  No Docker containers required. All dependencies run natively on the host machine.
#>
param(
  [switch]$OpenBrowser = $true,
  [switch]$ForceKillPreferredPorts,
  [string]$SQLitePath = '',
  [int]$FrontendPort = 0,
  [int]$BackendPort = 0
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')

$root = Get-RepoRoot
Set-Location $root

Write-Host ''
Write-Host '========================================' -ForegroundColor White
Write-Host '  New API Pure Local Dev Launcher' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor White
Write-Host ''
Write-Host '  Mode: SQLite + Memory Cache (No Docker)' -ForegroundColor DarkGray
Write-Host ''

$oldState = Read-DevState -Root $root
if ($oldState) {
  Write-Host '[*] Detected previous dev session, cleaning up...' -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot 'dev-stop.ps1') -KeepInfra
}

$preferredPorts = Get-DevPortCandidates
$primaryPorts = Get-PreferredPrimaryPorts

if ($ForceKillPreferredPorts) {
  Write-Host '[*] Force mode: releasing preferred ports (35173 / 36173)' -ForegroundColor Yellow
  [void](Ensure-PortReleased -Port ([int]$primaryPorts.frontend) -Name 'Frontend')
  [void](Ensure-PortReleased -Port ([int]$primaryPorts.backend) -Name 'Backend')
}

if ($FrontendPort -gt 0) {
  $frontendPort = $FrontendPort
} else {
  $frontendPort = Resolve-FreePort -Candidates $preferredPorts.frontend -Name 'Frontend'
}

if ($BackendPort -gt 0) {
  $backendPort = $BackendPort
} else {
  $backendPort = Resolve-FreePort -Candidates $preferredPorts.backend -Name 'Backend'
}

Write-Host '[*] Port allocation:' -ForegroundColor Cyan
Write-Host "    Frontend : $frontendPort"
Write-Host "    Backend  : $backendPort"
Write-Host ''

$pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $pwsh) {
  $pwsh = (Get-Process -Id $PID).Path
}
if (-not $pwsh) {
  throw 'pwsh not found, cannot continue.'
}

if ([string]::IsNullOrEmpty($SQLitePath)) {
  $sqlitePath = Join-Path $root 'new-api-local.db'
} else {
  $sqlitePath = $SQLitePath
}

$apiProcess = $null
$webProcess = $null

try {

  Write-Host '[1/4] Checking local dependencies...' -ForegroundColor Yellow

  $goCmd = Get-Command go -ErrorAction SilentlyContinue
  if (-not $goCmd) {
    throw 'Go is not installed or not in PATH. Please install Go 1.22+ first.'
  }
  $goVersion = & go version 2>$null
  Write-Host "       Go : $($goVersion.Trim())" -ForegroundColor Green

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    throw 'Node.js is not installed or not in PATH. Please install Node.js first.'
  }
  $nodeVersion = & node --version 2>$null
  Write-Host "       Node.js : $($nodeVersion.Trim())" -ForegroundColor Green

  $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
  if (-not $npxCmd) {
    throw 'npx is not available. Please ensure Node.js is properly installed.'
  }
  Write-Host '       npx : OK' -ForegroundColor Green
  Write-Host ''


  Write-Host "[2/4] Starting local backend on port $backendPort ..." -ForegroundColor Yellow
  Write-Host "    Database : SQLite ($sqlitePath)" -ForegroundColor DarkGray
  Write-Host "    Cache    : Memory (no Redis)" -ForegroundColor DarkGray
  Write-Host ''

  $apiArgs = @(
    '-NoLogo',
    '-NoExit',
    '-File',
    (Join-Path $PSScriptRoot 'dev-api-sqlite.ps1'),
    '-Port',
    $backendPort,
    '-SQLitePath',
    $sqlitePath
  )

  $apiProcess = Start-Process -FilePath $pwsh -ArgumentList $apiArgs -WorkingDirectory $root -PassThru
  Write-Host "    Backend PID: $($apiProcess.Id)" -ForegroundColor DarkGray

  $apiReady = Wait-HttpReady -Url "http://127.0.0.1:$backendPort/api/status" -TimeoutSeconds 180
  if (-not $apiReady) {
    throw "Backend startup timed out: http://127.0.0.1:$backendPort/api/status"
  }
  Write-Host '    Backend is healthy.' -ForegroundColor Green
  Write-Host ''


  Write-Host "[3/4] Starting local frontend on port $frontendPort ..." -ForegroundColor Yellow

  $webDir = Join-Path $root 'web'
  if (-not (Test-Path $webDir)) {
    throw "Frontend directory not found: $webDir"
  }

  if (-not (Test-Path (Join-Path $webDir 'node_modules'))) {
    Write-Host '    node_modules not found, installing dependencies...' -ForegroundColor Yellow
    Push-Location $webDir
    try {
      npm install --legacy-peer-deps
      if ($LASTEXITCODE -ne 0) {
        throw 'npm install failed. Check Node.js and network connectivity.'
      }
    } finally {
      Pop-Location
    }
    Write-Host '    Dependencies installed.' -ForegroundColor Green
  } else {
    Write-Host '    Dependencies already present.' -ForegroundColor DarkGray
  }

  $viteEnv = @{
    'VITE_DEV_PORT' = $frontendPort.ToString()
    'VITE_API_TARGET' = "http://127.0.0.1:$backendPort"
  }
  foreach ($entry in $viteEnv.GetEnumerator()) {
    Set-Item -Path ("Env:" + $entry.Key) -Value $entry.Value
  }

  $webArgs = @(
    '-NoLogo',
    '-NoExit',
    '-Command',
    "cd '$webDir'; npx vite --host 0.0.0.0 --port $frontendPort --strictPort"
  )

  $webProcess = Start-Process -FilePath $pwsh -ArgumentList $webArgs -WorkingDirectory $root -PassThru
  Write-Host "    Frontend PID: $($webProcess.Id)" -ForegroundColor DarkGray

  $webReady = Wait-HttpReady -Url "http://127.0.0.1:$frontendPort" -TimeoutSeconds 120
  if (-not $webReady) {
    throw "Frontend startup timed out: http://127.0.0.1:$frontendPort"
  }
  Write-Host '    Frontend is healthy.' -ForegroundColor Green
  Write-Host ''


  Write-Host '[4/4] Verifying cross-service connectivity...' -ForegroundColor Yellow

  try {
    $crossCheck = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$frontendPort" -TimeoutSec 10
    Write-Host "    Frontend -> Browser : OK ($($crossCheck.StatusCode))" -ForegroundColor Green
  } catch {
    Write-Warning "    Frontend -> Browser : Warning - $($_.Exception.Message)"
  }

  try {
    $apiCheck = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$backendPort/api/status" -TimeoutSec 10
    Write-Host "    Frontend -> Backend : OK ($($apiCheck.StatusCode))" -ForegroundColor Green
  } catch {
    Write-Warning "    Frontend -> Backend : Warning - $($_.Exception.Message)"
  }

  Write-Host ''


  $state = @{
    started_at = (Get-Date).ToString('s')
    mode = 'pure-local'
    sqlite_path = $sqlitePath
    ports = @{
      frontend = $frontendPort
      backend = $backendPort
    }
    processes = @{
      frontend = $webProcess.Id
      backend = $apiProcess.Id
    }
  }

  Write-DevState -Root $root -State $state

  Write-Host '========================================' -ForegroundColor Green
  Write-Host '  Pure Local Dev Environment Ready!' -ForegroundColor Green
  Write-Host '========================================' -ForegroundColor Green
  Write-Host ''
  Write-Host "  Frontend : http://127.0.0.1:$frontendPort" -ForegroundColor Cyan
  Write-Host "  Backend  : http://127.0.0.1:$backendPort" -ForegroundColor Cyan
  Write-Host "  Database : $sqlitePath (SQLite)" -ForegroundColor DarkGray
  Write-Host "  Cache    : In-memory (no Redis)" -ForegroundColor DarkGray
  Write-Host ''
  Write-Host "  Stop command: .\stop-local-dev.bat" -ForegroundColor DarkGray
  Write-Host ''

  if ($OpenBrowser) {
    Start-Process "http://127.0.0.1:$frontendPort"
    Write-Host '  Browser opened.' -ForegroundColor DarkGray
  }

} catch {
  Write-Host ''
  Write-Host "[ERROR] Startup failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ''

  if ($webProcess) {
    Write-Host '[*] Stopping frontend process...' -ForegroundColor Yellow
    Stop-ProcessIfExists -Id $webProcess.Id
  }
  if ($apiProcess) {
    Write-Host '[*] Stopping backend process...' -ForegroundColor Yellow
    Stop-ProcessIfExists -Id $apiProcess.Id
  }

  Remove-DevState -Root $root

  Write-Host '[*] Cleanup complete. Please check the error above and retry.' -ForegroundColor Red
  throw
}
