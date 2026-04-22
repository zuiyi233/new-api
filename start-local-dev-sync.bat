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
echo   New API Pure Local Dev (No Docker)
echo ========================================
echo.
echo This launcher will:
echo   1. check Go, Node.js, npx availability
echo   2. start backend with SQLite (local DB)
echo   3. start frontend with Vite dev server
echo   4. verify both services are accessible
echo   NOTE: No Docker required. Zero containers.
echo.

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\scripts\dev-start-sync.ps1" %*
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Pure local startup failed. Exit code: %EXIT_CODE%
  echo Try running .\scripts\dev-start-sync.ps1 manually for details.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo [OK] Frontend ^& Backend running locally (SQLite).
echo Use stop-local-dev.bat to stop all services.
echo.
endlocal
exit /b 0
