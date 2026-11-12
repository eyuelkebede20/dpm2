@echo off
title DPM2 Production Stack - Startup
setlocal enabledelayedexpansion

:: Check for stop argument
for %%a in (%*) do (
    if /i "%%a"=="--stop" (
        echo   Stopping DPM2 system...
        docker compose down
        echo   System stopped successfully.
        exit /b 0
    )
)

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "logs" mkdir logs
if not exist "run" mkdir run
if not exist "backups" mkdir backups
echo %date% %time% - START requested>> "logs\startup-history.log"

set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "G=%ESC%[92m"
set "R=%ESC%[91m"
set "Y=%ESC%[93m"
set "C=%ESC%[96m"
set "Z=%ESC%[0m"

echo.
echo  %C%=====================================================%Z%
echo  %C%  DPM2 Production System  -  Startup%Z%
echo  %C%=====================================================%Z%
echo.

:: 1. Docker check
echo   %C%[1/6]%Z% Checking Docker Engine...
where docker >nul 2>&1
if errorlevel 1 (
    echo   %R%[!] Docker is not installed or not in PATH.%Z%
    echo       Please install Docker Desktop from docker.com, restart, and rerun.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo   %Y%[..]%Z% Docker Desktop is not running. Attempting to start...
    set "DD=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    if exist "!DD!" (
        start "" "!DD!"
    ) else (
        set "DD=%LOCALAPPDATA%\Docker\Docker\Docker Desktop.exe"
        if exist "!DD!" start "" "!DD!"
    )
    echo   Waiting for Docker daemon to become responsive...
    timeout /t 10 /nobreak >nul
)

docker info >nul 2>&1
if errorlevel 1 (
    echo   %R%[!] Docker is still not running. Please start Docker Desktop and rerun.%Z%
    pause
    exit /b 1
)
echo   %G%[OK]%Z% Docker Engine is running.

:: 2. Folders
echo.
echo   %C%[2/6]%Z% Preparing runtime directories...
if not exist "run" mkdir run
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
echo   %G%[OK]%Z% Directories ready.

:: 3. .env check
echo.
echo   %C%[3/6]%Z% Checking .env settings...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo   %Y%[!] .env was created from .env.example. Setting real passwords recommended.%Z%
    ) else (
        echo   %R%[!] Missing .env and .env.example.%Z%
        pause
        exit /b 1
    )
)
echo   %G%[OK]%Z% Environment configuration verified.

:: 4. Resolve local LAN IP
echo.
echo   %C%[4/6]%Z% Resolving network adapter and host LAN IP...
set "LAN_IP=localhost"
for /f "usebackq tokens=*" %%I in (`powershell -NoProfile -Command "try { @((Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -ExpandProperty InterfaceAlias -First 1) -ErrorAction Stop).IPAddress)[0] } catch { 'localhost' }"`) do set "LAN_IP=%%I"
echo   Detected Host LAN IP: %LAN_IP%

:: 5. Launch containers
echo.
echo   %C%[5/6]%Z% Starting DPM2 container stack...
docker compose up -d --build
if errorlevel 1 (
    echo   %R%[!] docker compose failed.%Z%
    pause
    exit /b 1
)
echo   %G%[OK]%Z% Containers deployed.

:: 6. Wait for health
echo.
echo   %C%[6/6]%Z% Waiting for database and app to become healthy...
set "APP_PORT=3000"
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"APP_PORT=" ".env" 2^>nul') do set "APP_PORT=%%B"

set /a WAITED=0
:health_loop
curl -sf "http://127.0.0.1:%APP_PORT%/api/health" >nul 2>&1
if not errorlevel 1 goto :system_ready
timeout /t 3 /nobreak >nul
set /a WAITED+=3
if %WAITED% lss 90 goto :health_loop

echo   %Y%[!] Container is taking longer than usual to respond. Checking container status...%Z%
docker compose ps

:system_ready
echo.
if exist "deploy\show-url.bat" (
    call deploy\show-url.bat
) else (
    echo  =====================================================
    echo    DPM2 URL on LAN:   http://%LAN_IP%:%APP_PORT%
    echo    DPM2 on localhost: http://localhost:%APP_PORT%
    echo  =====================================================
)

echo.
echo   Press any key to close this terminal. DPM2 containers continue running.
pause >nul
exit /b 0
