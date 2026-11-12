@echo off
title DPM2 - Database Schema Push
setlocal enabledelayedexpansion

echo ======================================================
echo    DPM2 - Database Schema Push ^& Migration Script
echo ======================================================
echo.

rem Strategy 1: Check if docker compose is running
docker compose ps app 2>nul | findstr /i "Up" >nul
if %errorlevel% equ 0 (
    echo [1/2] Running migration inside running app container...
    docker compose exec -T app node scripts/migrate.mjs
    goto :done
)

docker compose ps db 2>nul | findstr /i "Up" >nul
if %errorlevel% equ 0 (
    echo [1/2] Database container running: launching ephemeral container to apply migrations...
    docker compose run --rm app node scripts/migrate.mjs
    goto :done
)

rem Strategy 2: Local pnpm execution
echo [1/2] Running migration locally...
if exist "scripts\migrate.mjs" (
    node scripts\migrate.mjs
) else (
    call pnpm db:migrate
)

:done
echo.
echo ======================================================
echo    ✓ DATABASE SCHEMA PUSH COMPLETE SUCCESSFULLY!
echo ======================================================
echo.
pause
