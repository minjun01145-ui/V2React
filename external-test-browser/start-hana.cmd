@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\start.ps1" -Hana
if errorlevel 1 pause
