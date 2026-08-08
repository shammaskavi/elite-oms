@echo off
REM Starts the label print agent. Keep this window open while the shop is running,
REM or use install-startup.bat to have Windows launch it automatically at login.

title Saree Palace Elite - Label Print Agent
cd /d "%~dp0"

set "LOGFILE=%~dp0agent-log.txt"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  Node.js is NOT installed on this PC.
  echo.
  echo  Download the LTS installer from https://nodejs.org
  echo  install it, then run this file again.
  echo ============================================================
  echo.
  echo Node.js not found >"%LOGFILE%"
  pause
  exit /b 1
)

echo Starting print agent... output is also being saved to:
echo   %LOGFILE%
echo.
echo To check it is working, open this in your browser:
echo   http://localhost:9110/health
echo.

REM Uncomment the next line to let phones on the same WiFi print to this printer.
REM set BIND=0.0.0.0

REM Tee output to both the console and a log file so failures can be diagnosed
REM even if this window gets closed.
node server.js 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -FilePath '%LOGFILE%'"

echo.
echo ============================================================
echo  The print agent has STOPPED. Any error is shown above and
echo  saved in agent-log.txt next to this file.
echo ============================================================
pause
