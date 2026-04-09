$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '==> 停止本地开发基础设施容器' -ForegroundColor Cyan
docker compose -f docker-compose.dev-infra.yml down
