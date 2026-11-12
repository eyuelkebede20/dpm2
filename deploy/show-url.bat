@echo off
setlocal EnableDelayedExpansion
:: ============================================================
::  deploy\show-url.bat
::  Prints the DPM2 LAN URL and status to the console.
:: ============================================================

set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "APP_PORT=3000"
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if "%%A"=="APP_PORT" set "APP_PORT=%%B"
    )
)

set "LAN_IP="
for /f "usebackq tokens=*" %%I in (`powershell -NoProfile -Command "try { @((Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -ExpandProperty InterfaceAlias -First 1) -ErrorAction Stop).IPAddress)[0] } catch { 'localhost' }"`) do set "LAN_IP=%%I"

if not defined LAN_IP set "LAN_IP=localhost"

echo.
echo  =====================================================
echo    Open this address on ANY PC or tablet on the LAN:
echo.
echo      http://!LAN_IP!:!APP_PORT!
echo.
if not "!LAN_IP!"=="localhost" (
    echo    On this server host:
    echo      http://localhost:!APP_PORT!
    echo.
)
echo  =====================================================
echo.

curl -sf "http://127.0.0.1:!APP_PORT!/api/health" >nul 2>&1
if errorlevel 1 (
    echo    Status: Initializing / Starting up
) else (
    echo    Status: ONLINE ^& HEALTHY
)
echo.
