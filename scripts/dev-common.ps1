function Get-RepoRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

function Ensure-DevLogDir {
  param(
    [string]$Root
  )

  $logDir = Join-Path $Root 'logs/dev-local'
  if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
  }
  return $logDir
}

function Get-DevStatePath {
  param(
    [string]$Root
  )

  $logDir = Ensure-DevLogDir -Root $Root
  return (Join-Path $logDir 'dev-state.json')
}

function Read-DevState {
  param(
    [string]$Root
  )

  $statePath = Get-DevStatePath -Root $Root
  if (-not (Test-Path $statePath)) {
    return $null
  }

  try {
    return (Get-Content $statePath -Raw | ConvertFrom-Json)
  } catch {
    Write-Warning "读取状态文件失败：$statePath，已忽略旧状态。"
    return $null
  }
}

function Write-DevState {
  param(
    [string]$Root,
    [hashtable]$State
  )

  $statePath = Get-DevStatePath -Root $Root
  $State | ConvertTo-Json -Depth 10 | Set-Content -Path $statePath -Encoding UTF8
}

function Remove-DevState {
  param(
    [string]$Root
  )

  $statePath = Get-DevStatePath -Root $Root
  if (Test-Path $statePath) {
    Remove-Item -Path $statePath -Force
  }
}

function Test-PortInUse {
  param(
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $connected = $iar.AsyncWaitHandle.WaitOne(200)
    if (-not $connected) {
      return $false
    }
    $client.EndConnect($iar) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Resolve-FreePort {
  param(
    [int[]]$Candidates,
    [string]$Name
  )

  foreach ($candidate in $Candidates) {
    if (-not (Test-PortInUse -Port $candidate)) {
      return $candidate
    }
  }

  throw "没有找到可用的 $Name 端口，候选列表：$($Candidates -join ', ')"
}

function Get-DevPortCandidates {
  return @{
    frontend = @(35173, 35174, 35175, 35176, 45173, 45174)
    backend  = @(36173, 36174, 36175, 36176, 46173, 46174)
    postgres = @(35432, 35433, 35434, 45432)
    redis    = @(36379, 36380, 36381, 46379)
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
      continue
    }
  }

  return $false
}

function Stop-ProcessIfExists {
  param(
    [int]$Id
  )

  try {
    Stop-Process -Id $Id -Force -ErrorAction Stop
  } catch {
  }
}

function Get-ListeningProcessIdsByPort {
  param(
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $connections) {
    return @()
  }

  return @($connections | Where-Object { $_ -and $_ -ne 0 })
}

function Stop-ProcessByPort {
  param(
    [int]$Port
  )

  foreach ($processId in (Get-ListeningProcessIdsByPort -Port $Port)) {
    Stop-ProcessIfExists -Id $processId
  }
}

function Ensure-PortReleased {
  param(
    [int]$Port,
    [string]$Name = '端口',
    [int]$WaitMilliseconds = 1500
  )

  $processIds = Get-ListeningProcessIdsByPort -Port $Port
  if ($processIds.Count -eq 0) {
    return $true
  }

  Write-Host "==> 强制释放$Name端口 $Port，占用进程：$($processIds -join ', ')" -ForegroundColor Yellow
  foreach ($processId in $processIds) {
    Stop-ProcessIfExists -Id $processId
  }

  Start-Sleep -Milliseconds $WaitMilliseconds

  if ((Get-ListeningProcessIdsByPort -Port $Port).Count -eq 0) {
    Write-Host "==> $Name端口 $Port 已释放" -ForegroundColor Green
    return $true
  }

  Write-Warning "$Name端口 $Port 释放失败，将尝试 fallback 到下一个可用端口。"
  return $false
}

function Get-PreferredPrimaryPorts {
  $candidates = Get-DevPortCandidates
  return @{
    frontend = $candidates.frontend[0]
    backend = $candidates.backend[0]
  }
}

function Get-AirBinaryPath {
  $command = Get-Command air -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $gobin = & go env GOBIN 2>$null
  if ($gobin) {
    $candidate = Join-Path $gobin 'air.exe'
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $gopath = & go env GOPATH 2>$null
  if ($gopath) {
    $candidate = Join-Path $gopath 'bin/air.exe'
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Ensure-AirInstalled {
  $airPath = Get-AirBinaryPath
  if ($airPath) {
    return $airPath
  }

  Write-Host '==> 未检测到 air，开始自动安装后端热重载工具...' -ForegroundColor Yellow
  & go install github.com/air-verse/air@latest
  if ($LASTEXITCODE -ne 0) {
    throw '安装 air 失败，请检查 Go 环境和网络后重试。'
  }

  $airPath = Get-AirBinaryPath
  if (-not $airPath) {
    throw 'air 安装完成，但未找到 air.exe。'
  }

  return $airPath
}

function Get-PreferredPackageManager {
  $bun = Get-Command bun -ErrorAction SilentlyContinue
  if ($bun) {
    return 'bun'
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    return 'npm'
  }

  throw '未检测到 bun 或 npm，请先安装前端包管理器。'
}
