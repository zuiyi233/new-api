param(
  [int]$Port = 36173,
  [int]$PostgresPort = 35432,
  [int]$RedisPort = 36379,
  [switch]$NoHotReload
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'dev-common.ps1')

$root = Get-RepoRoot
Set-Location $root

$defaultEnv = [ordered]@{
  'PORT'                 = $Port.ToString()
  'SQL_DSN'              = "postgresql://root:123456@127.0.0.1:$PostgresPort/new-api?sslmode=disable"
  'REDIS_CONN_STRING'    = "redis://127.0.0.1:$RedisPort/0"
  'TZ'                   = 'Asia/Shanghai'
  'GIN_MODE'             = 'debug'
  'ERROR_LOG_ENABLED'    = 'true'
  'BATCH_UPDATE_ENABLED' = 'true'
}

foreach ($entry in $defaultEnv.GetEnumerator()) {
  Set-Item -Path ("Env:" + $entry.Key) -Value $entry.Value
}

$overrideFile = Join-Path $root '.env.dev.local'
if (Test-Path $overrideFile) {
  Write-Host "==> 读取覆盖配置: $overrideFile" -ForegroundColor Cyan
  Get-Content $overrideFile | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
      return
    }
    $parts = $line -split '=', 2
    if ($parts.Length -ne 2) {
      return
    }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    Set-Item -Path ("Env:" + $name) -Value $value
  }
}

$distIndex = Join-Path $root 'web/dist/index.html'
if (-not (Test-Path $distIndex)) {
  Write-Warning '未检测到 web/dist/index.html。当前仓库的 Go 主程序会 embed web/dist，首次本地后端启动前至少要先生成一次前端构建产物。'
  Write-Warning '可先在 web 目录执行: npm install --legacy-peer-deps && npm run build'
}

$null = Ensure-DevLogDir -Root $root

Write-Host '==> 启动本地后端' -ForegroundColor Cyan
Write-Host "    PORT=$($env:PORT)"
Write-Host "    SQL_DSN=$($env:SQL_DSN)"
Write-Host "    REDIS_CONN_STRING=$($env:REDIS_CONN_STRING)"
Write-Host "    热重载=$(-not $NoHotReload)"
Write-Host ''
Write-Host '提示：如果你要验证“复制地址/回调地址/对外 API 地址”，系统设置里的 ServerAddress 仍可能是旧值，请手动按需改成当前本地后端地址。' -ForegroundColor Yellow
Write-Host ''

if ($NoHotReload) {
  go run . --log-dir ./logs/dev-local
  exit $LASTEXITCODE
}

$airPath = Ensure-AirInstalled
$airConfig = Join-Path $PSScriptRoot 'air.dev.toml'
& $airPath -c $airConfig
exit $LASTEXITCODE
