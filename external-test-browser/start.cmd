@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
set "electron_config_cache=%~dp0.cache\electron"
if not exist "node_modules\electron\dist\electron.exe" (
  call npm ci
  if errorlevel 1 (
    echo Could not install the browser. Check Node.js and your network connection.
    pause
    exit /b 1
  )
  node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo Could not download the browser runtime. Check your network connection.
    pause
    exit /b 1
  )
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
