@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
call npm run smoke
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo EXE files are ready in the dist folder.
pause
exit /b 0
:failed
echo Build failed. Copy the error above and send it to Codex.
pause
exit /b 1
