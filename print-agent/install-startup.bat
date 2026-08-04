@echo off
REM Registers the print agent to start automatically when this user logs in,
REM so staff never have to think about it.

setlocal
set "AGENT_DIR=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP%\SPE Print Agent.lnk"

powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath = 'cmd.exe';" ^
  "$s.Arguments = '/c start \"\" /min \"%AGENT_DIR%start-agent.bat\"';" ^
  "$s.WorkingDirectory = '%AGENT_DIR%';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Save()"

if errorlevel 1 (
  echo Failed to create the startup shortcut.
  pause
  exit /b 1
)

echo.
echo Done. The print agent will start automatically at login.
echo To undo, delete: %SHORTCUT%
echo.
pause
