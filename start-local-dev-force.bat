@echo off
setlocal

cd /d "%~dp0"

set "POWERSHELL_EXE="
where pwsh >nul 2>nul
if %errorlevel%==0 (
  set "POWERSHELL_EXE=pwsh"
) else (
  where powershell >nul 2>nul
  if %errorlevel%==0 (
    set "POWERSHELL_EXE=powershell"
  )
)

if not defined POWERSHELL_EXE (
  echo [ERROR] PowerShell was not found. Please install pwsh or enable powershell.exe.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   New API Local Dev Force Start
echo ========================================
echo.
echo Force mode will:
echo   1. try to release preferred frontend/backend ports first
echo   2. then start local dev environment
echo   3. if release still fails, it will fallback automatically
echo.

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\scripts\dev-start.ps1" -ForceKillPreferredPorts %*
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Local dev force startup failed. Exit code: %EXIT_CODE%
  echo Try running .\scripts\dev-start.ps1 -ForceKillPreferredPorts manually for more details.
  pause
  exit /b %EXIT_CODE%
)

if exist "logs\dev-local\dev-state.json" (
  echo.
  echo State file:
  echo   logs\dev-local\dev-state.json
)

echo.
echo [OK] Local dev environment is running in force mode.
echo Use stop-local-dev.bat to stop it.
echo.
endlocal
exit /b 0
