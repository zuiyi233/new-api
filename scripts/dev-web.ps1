param(
  [int]$Port = 35173,
  [string]$ApiTarget = 'http://127.0.0.1:36173'
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')
$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root 'web'
$packageManager = Get-PreferredPackageManager

Set-Location $webDir

$env:VITE_DEV_PORT = $Port.ToString()
$env:VITE_API_TARGET = $ApiTarget

Write-Host '==> 启动本地前端' -ForegroundColor Cyan
Write-Host "    VITE_DEV_PORT=$($env:VITE_DEV_PORT)"
Write-Host "    VITE_API_TARGET=$($env:VITE_API_TARGET)"
Write-Host "    包管理器=$packageManager"

if (-not (Test-Path (Join-Path $webDir 'node_modules'))) {
  Write-Host '==> 未检测到 web/node_modules，安装依赖中...' -ForegroundColor Yellow
  if ($packageManager -eq 'bun') {
    bun install
  } else {
    npm install --legacy-peer-deps
  }
}

if ($packageManager -eq 'bun') {
  bun run dev --host 0.0.0.0 --port $env:VITE_DEV_PORT --strictPort
} else {
  npm run dev -- --host 0.0.0.0 --port $env:VITE_DEV_PORT --strictPort
}
