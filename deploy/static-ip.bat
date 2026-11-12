@echo off
setlocal EnableDelayedExpansion
:: ============================================================
::  deploy\static-ip.bat
::  Set a static LAN IP on the DPM2 production server (Windows).
:: ============================================================

net session >nul 2>&1
if errorlevel 1 (
    echo  [!] This script requires Administrator rights.
    echo      Right-click and choose "Run as administrator".
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo    DPM2 Production - Static IP Setup (Windows)
echo  =====================================================
echo.

set "ADAPTER="
set "CURRENT_IP="
set "GATEWAY="
set "SUBNET="

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object RouteMetric | Select-Object -First 1 | ForEach-Object { $_.InterfaceIndex }" ^
    2^>nul') do set "IF_INDEX=%%L"

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "Get-NetAdapter -InterfaceIndex !IF_INDEX! | Select-Object -ExpandProperty Name" ^
    2^>nul') do set "ADAPTER=%%L"

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "Get-NetIPAddress -InterfaceIndex !IF_INDEX! -AddressFamily IPv4 | Select-Object -ExpandProperty IPAddress" ^
    2^>nul') do set "CURRENT_IP=%%L"

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "Get-NetIPAddress -InterfaceIndex !IF_INDEX! -AddressFamily IPv4 | Select-Object -ExpandProperty PrefixLength" ^
    2^>nul') do set "PREFIX=%%L"

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "Get-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceIndex !IF_INDEX! | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop" ^
    2^>nul') do set "GATEWAY=%%L"

for /f "tokens=*" %%L in ('powershell -NoProfile -Command ^
    "$p=!PREFIX!; $mask=([Math]::Pow(2,32)-[Math]::Pow(2,32-$p)); [Net.IPAddress]::Parse([String]$mask).ToString()" ^
    2^>nul') do set "SUBNET=%%L"

echo   Active Network Adapter Settings:
echo     Adapter  : !ADAPTER!
echo     IP       : !CURRENT_IP! / !PREFIX!
echo     Subnet   : !SUBNET!
echo     Gateway  : !GATEWAY!
echo.
echo   These settings will be fixed as your permanent static IP.
set /p "CONFIRM=  Lock this static IP? [Y/N]: "
if /i not "!CONFIRM!"=="Y" (
    echo   Cancelled.
    pause
    exit /b 0
)

echo.
echo   [..] Configuring static IP on adapter !ADAPTER!...
netsh interface ip set address name="!ADAPTER!" static !CURRENT_IP! !SUBNET! !GATEWAY!
if errorlevel 1 (
    echo   [!] Failed to set static IP via netsh.
    pause
    exit /b 1
)

echo   [..] Configuring DNS (8.8.8.8 + 1.1.1.1)...
netsh interface ip set dns name="!ADAPTER!" static 8.8.8.8
netsh interface ip add dns name="!ADAPTER!" 1.1.1.1 index=2

echo.
echo  =====================================================
echo    Static IP successfully assigned!
echo    DPM2 URL: http://!CURRENT_IP!:3000
echo  =====================================================
echo.
pause
