@echo off
REM Starts the label print agent. Keep this window open while the shop is running,
REM or use install-startup.bat to have Windows launch it automatically at login.

title Saree Palace Elite - Label Print Agent
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Download the LTS installer from https://nodejs.org
  echo and run this file again afterwards.
  echo.
  pause
  exit /b 1
)

REM Uncomment the next line to let phones on the same WiFi print to this printer.
REM set BIND=0.0.0.0

node server.js
pause
