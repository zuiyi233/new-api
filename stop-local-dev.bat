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
echo   New API Local Dev Stop
echo ========================================
echo.

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\scripts\dev-stop.ps1" %*
set "EXIT_CODE=%errorlevel%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Local dev stop failed. Exit code: %EXIT_CODE%
  echo Try running .\scripts\dev-stop.ps1 manually for more details.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo [OK] Local dev environment has been stopped.
echo.
endlocal
exit /b 0
