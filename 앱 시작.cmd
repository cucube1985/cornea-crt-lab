@echo off
chcp 65001 >nul
setlocal
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 is required.
  pause
  exit /b 1
)
node "%~dp0scripts\local-launcher.mjs" start
if errorlevel 1 pause
