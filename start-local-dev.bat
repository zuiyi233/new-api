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
echo   New API Local Dev Start
echo ========================================
echo.
echo This launcher will:
echo   1. check ports and fallback automatically
echo   2. start PostgreSQL and Redis
echo   3. start local backend with hot reload
echo   4. start local frontend
echo   5. open browser automatically
echo.

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\scripts\dev-start.ps1" %*
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Local dev startup failed. Exit code: %EXIT_CODE%
  echo Try running .\scripts\dev-start.ps1 manually for more details.
  pause
  exit /b %EXIT_CODE%
)

if exist "logs\dev-local\dev-state.json" (
  echo.
  echo State file:
  echo   logs\dev-local\dev-state.json
)

echo.
echo [OK] Local dev environment is running.
echo Use stop-local-dev.bat to stop it.
echo If you need port takeover first, use start-local-dev-force.bat
echo.
endlocal
exit /b 0
