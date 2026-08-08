@echo off
REM STEP 1 - Run this first. It checks everything and tells you what is wrong.
REM It does not start anything permanently. Safe to run any time.

title Step 1 - Print Agent Check
cd /d "%~dp0"
color 0F
cls

echo.
echo ==========================================================
echo   STEP 1 OF 3  -  CHECKING THIS PC
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

node server.js --check

echo.
echo ==========================================================
echo   Read the RESULT line above.
echo   If it says all checks passed, run 2-START.bat next.
echo ==========================================================
echo.
pause
exit /b 0

:NONODE
color 4F
echo   PROBLEM FOUND: Node.js is not installed on this PC.
echo.
echo   This is the most common cause of the agent not starting.
echo.
echo   HOW TO FIX:
echo     1. Open a browser and go to:  https://nodejs.org
echo     2. Download the big green "LTS" button.
echo     3. Run the installer. Click Next on every screen.
echo        Do NOT tick the box about "Tools for Native Modules".
echo     4. IMPORTANT: close this window, then open 1-CHECK.bat again.
echo        (A new window is required for Windows to see Node.)
echo.
echo ==========================================================
echo.
pause
exit /b 1
