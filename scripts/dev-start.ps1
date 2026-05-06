param(
  [switch]$OpenBrowser = $true,
  [switch]$ForceKillPreferredPorts
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')

$root = Get-RepoRoot
Set-Location $root

$oldState = Read-DevState -Root $root
if ($oldState) {
  Write-Host '==> 检测到旧的本地开发会话，先执行清理...' -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot 'dev-stop.ps1') -KeepInfra
}

$preferredPorts = Get-DevPortCandidates
$primaryPorts = Get-PreferredPrimaryPorts

if ($ForceKillPreferredPorts) {
  Write-Host '==> 已启用强制启动模式：优先释放首选前后端端口（35173 / 36173）' -ForegroundColor Yellow
  [void](Ensure-PortReleased -Port ([int]$primaryPorts.frontend) -Name '前端首选')
  [void](Ensure-PortReleased -Port ([int]$primaryPorts.backend) -Name '后端首选')
}

$frontendPort = Resolve-FreePort -Candidates $preferredPorts.frontend -Name '前端'
$backendPort = Resolve-FreePort -Candidates $preferredPorts.backend -Name '后端'
$postgresPort = Resolve-FreePort -Candidates $preferredPorts.postgres -Name 'PostgreSQL'
$redisPort = Resolve-FreePort -Candidates $preferredPorts.redis -Name 'Redis'

Write-Host '==> 本次本地开发端口分配如下：' -ForegroundColor Cyan
Write-Host "    前端: $frontendPort"
Write-Host "    后端: $backendPort"
Write-Host "    PostgreSQL: $postgresPort"
Write-Host "    Redis: $redisPort"

$pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $pwsh) {
  $pwsh = (Get-Process -Id $PID).Path
}
if (-not $pwsh) {
  throw '未找到 pwsh，可执行一键启动失败。'
}

$apiProcess = $null
$webProcess = $null

try {
  $runningContainers = docker ps --format '{{.Names}}'
  if ($runningContainers -contains 'new-api') {
    Write-Host '==> 停止应用容器 new-api，避免本地后端与容器后端同时执行定时任务' -ForegroundColor Yellow
    docker stop new-api | Out-Null
  }

  $env:DEV_PG_PORT = $postgresPort.ToString()
  $env:DEV_REDIS_PORT = $redisPort.ToString()
  docker compose -f docker-compose.dev-infra.yml up -d --force-recreate postgres redis | Out-Host

  $apiArgs = @(
    '-NoLogo',
    '-NoExit',
    '-File',
    (Join-Path $PSScriptRoot 'dev-api.ps1'),
    '-Port',
    $backendPort,
    '-PostgresPort',
    $postgresPort,
    '-RedisPort',
    $redisPort
  )

  $apiProcess = Start-Process -FilePath $pwsh -ArgumentList $apiArgs -WorkingDirectory $root -PassThru

  $apiReady = Wait-HttpReady -Url "http://127.0.0.1:$backendPort/api/status" -TimeoutSeconds 120
  if (-not $apiReady) {
    throw "本地后端启动超时：http://127.0.0.1:$backendPort/api/status"
  }

  $webArgs = @(
    '-NoLogo',
    '-NoExit',
    '-File',
    (Join-Path $PSScriptRoot 'dev-web.ps1'),
    '-Port',
    $frontendPort,
    '-ApiTarget',
    "http://127.0.0.1:$backendPort"
  )

  $webProcess = Start-Process -FilePath $pwsh -ArgumentList $webArgs -WorkingDirectory $root -PassThru

  $webReady = Wait-HttpReady -Url "http://127.0.0.1:$frontendPort" -TimeoutSeconds 120
  if (-not $webReady) {
    throw "本地前端启动超时：http://127.0.0.1:$frontendPort"
  }

  $state = @{
    started_at = (Get-Date).ToString('s')
    ports = @{
      frontend = $frontendPort
      backend = $backendPort
      postgres = $postgresPort
      redis = $redisPort
    }
    processes = @{
      frontend = $webProcess.Id
      backend = $apiProcess.Id
    }
  }

  Write-DevState -Root $root -State $state

  Write-Host ''
  Write-Host '==> 本地开发环境已就绪' -ForegroundColor Green
  Write-Host "    前端地址: http://127.0.0.1:$frontendPort"
  Write-Host "    后端地址: http://127.0.0.1:$backendPort"
  Write-Host "    PostgreSQL: 127.0.0.1:$postgresPort"
  Write-Host "    Redis: 127.0.0.1:$redisPort"
  Write-Host ''
  Write-Host "    停止命令: .\scripts\dev-stop.ps1"

  if ($OpenBrowser) {
    Start-Process "http://127.0.0.1:$frontendPort"
  }
} catch {
  Write-Warning "一键启动失败：$($_.Exception.Message)"
  if ($webProcess) {
    Stop-ProcessIfExists -Id $webProcess.Id
  }
  if ($apiProcess) {
    Stop-ProcessIfExists -Id $apiProcess.Id
  }
  try {
    docker compose -f docker-compose.dev-infra.yml down | Out-Host
  } catch {
  }
  Remove-DevState -Root $root
  throw
}
