@echo off
setlocal
rem One-click local start wrapper for star-weather-planner (Next.js).
rem Delegates to scripts\start-local.ps1 and forwards every argument.
rem Usage: start-local.cmd [-Port 3000] [-NoBrowser] [-Reinstall] [-SmokeTest]

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%start-local.ps1"

if not exist "%PS_SCRIPT%" (
    echo [start-local] Cannot find "%PS_SCRIPT%".
    exit /b 1
)

where pwsh >nul 2>&1
if %ERRORLEVEL%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
)

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [start-local] Failed with exit code %EXIT_CODE%.
    rem Keep the window open when double-clicked from Explorer.
    if /I "%~1"=="" pause
)
exit /b %EXIT_CODE%
