@echo off
REM STEP 3 - Makes the agent start by itself every time this PC logs in,
REM so staff never have to think about it. Run once.

title Step 3 - Enable Autostart
cd /d "%~dp0"
color 0F
cls

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LAUNCHER=%STARTUP%\SPE Print Agent.vbs"

echo.
echo ==========================================================
echo   STEP 3 OF 3  -  START AUTOMATICALLY AT LOGIN
echo ==========================================================
echo.

if not exist "%STARTUP%" (
  color 4F
  echo   Could not find the Windows Startup folder:
  echo   %STARTUP%
  echo.
  pause
  exit /b 1
)

REM A tiny VBScript launcher, written directly. Avoids PowerShell entirely so
REM there is nothing to go wrong with execution policy or quote escaping.
echo Set WshShell = CreateObject("WScript.Shell") > "%LAUNCHER%"
echo WshShell.Run """%~dp02-START.bat""", 7, False >> "%LAUNCHER%"

if not exist "%LAUNCHER%" (
  color 4F
  echo   Failed to create the startup launcher.
  echo.
  pause
  exit /b 1
)

echo   Done. The print agent will now start automatically
echo   whenever this PC is switched on and logged in.
echo.
echo   It opens minimised in the taskbar.
echo.
echo   To turn this off later, delete this file:
echo   %LAUNCHER%
echo.
echo ==========================================================
echo.
echo   SETUP IS COMPLETE. You can close this window.
echo.
pause
