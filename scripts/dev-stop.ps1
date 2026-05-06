param(
  [switch]$KeepInfra
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')

$root = Get-RepoRoot
Set-Location $root

$state = Read-DevState -Root $root
$preferredPorts = Get-DevPortCandidates

if ($state -and $state.processes) {
  if ($state.processes.frontend) {
    Stop-ProcessIfExists -Id ([int]$state.processes.frontend)
  }
  if ($state.processes.backend) {
    Stop-ProcessIfExists -Id ([int]$state.processes.backend)
  }
}

$portsToStop = [System.Collections.Generic.List[int]]::new()

if ($state -and $state.ports) {
  foreach ($name in @('frontend', 'backend')) {
    if ($state.ports.$name) {
      [void]$portsToStop.Add([int]$state.ports.$name)
    }
  }
}

foreach ($candidate in ($preferredPorts.frontend + $preferredPorts.backend)) {
  if (-not $portsToStop.Contains([int]$candidate)) {
    [void]$portsToStop.Add([int]$candidate)
  }
}

foreach ($port in $portsToStop) {
  Stop-ProcessByPort -Port $port
}

if (-not $KeepInfra) {
  if ($state -and $state.ports) {
    if ($state.ports.postgres) {
      $env:DEV_PG_PORT = ([int]$state.ports.postgres).ToString()
    }
    if ($state.ports.redis) {
      $env:DEV_REDIS_PORT = ([int]$state.ports.redis).ToString()
    }
  }
  docker compose -f docker-compose.dev-infra.yml down | Out-Host
}

Remove-DevState -Root $root

Write-Host '==> 本地开发环境已停止' -ForegroundColor Green
