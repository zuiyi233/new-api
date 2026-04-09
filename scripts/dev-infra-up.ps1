param(
  [int]$PostgresPort = 35432,
  [int]$RedisPort = 36379
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:DEV_PG_PORT) {
  $env:DEV_PG_PORT = $PostgresPort.ToString()
}

if (-not $env:DEV_REDIS_PORT) {
  $env:DEV_REDIS_PORT = $RedisPort.ToString()
}

Write-Host '==> 切换到本地开发基础设施模式（Scheme 2）' -ForegroundColor Cyan
Write-Host "    前端: 35173  后端: 36173  Postgres: $($env:DEV_PG_PORT)  Redis: $($env:DEV_REDIS_PORT)"

$runningContainers = docker ps --format '{{.Names}}'
if ($runningContainers -contains 'new-api') {
  Write-Host '==> 停止应用容器 new-api，避免本地后端与容器后端同时执行定时任务' -ForegroundColor Yellow
  docker stop new-api | Out-Null
}

Write-Host '==> 启动/重建 PostgreSQL + Redis 开发基础设施容器' -ForegroundColor Cyan
docker compose -f docker-compose.dev-infra.yml up -d --force-recreate postgres redis

Write-Host ''
Write-Host '==> 当前基础设施状态' -ForegroundColor Green
docker compose -f docker-compose.dev-infra.yml ps

Write-Host ''
Write-Host '==> 下一步：' -ForegroundColor Green
Write-Host '    1. .\scripts\dev-api.ps1'
Write-Host '    2. .\scripts\dev-web.ps1'
