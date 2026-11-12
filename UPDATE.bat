@echo off
title DPM2 - Local Update ^& Database Migration
setlocal enabledelayedexpansion

echo ==========================================================
echo         DPM2 - Update ^& Setup Script
echo ==========================================================
echo.

echo [1/4] Stashing local changes (if any)...
call git stash --include-untracked || call git stash
echo.

echo [2/4] Pulling latest code from Git...
call git pull origin feat/om-nav-and-workspace-polish 2>nul || call git pull
echo.

echo [3/4] Installing dependencies...
call pnpm install --frozen-lockfile 2>nul || call pnpm install
echo.

echo [4/4] Executing Database Migrations...
call pnpm db:migrate
if %errorlevel% neq 0 (
    echo [ERROR] Migration failed. Please check if PostgreSQL is running.
    exit /b %errorlevel%
)
echo.

echo ==========================================================
echo               UPDATE COMPLETE SUCCESSFULLY!
echo ==========================================================
echo.
pause
