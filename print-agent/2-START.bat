@echo off
REM STEP 2 - Starts the print agent. This window must stay open.

title Print Agent - KEEP THIS WINDOW OPEN
cd /d "%~dp0"
color 0F
cls

where node >nul 2>nul
if errorlevel 1 (
  color 4F
  echo.
  echo   Node.js is not installed. Run 1-CHECK.bat for instructions.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo   PRINT AGENT IS STARTING
echo.
echo   Leave this window open while the shop is running.
echo   Minimise it - do not close it.
echo.
echo   To confirm it works, open this in a browser:
echo     http://localhost:9110/health
echo ==========================================================
echo.

REM Uncomment the next line to let phones on the same WiFi print.
REM set BIND=0.0.0.0

node server.js

REM Only reached if the agent stops or crashes.
color 4F
echo.
echo ==========================================================
echo   THE PRINT AGENT HAS STOPPED.
echo   The reason is shown above and saved in agent-log.txt
echo ==========================================================
echo.
pause
