@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Blog Admin - localhost:5001
echo Starting admin panel at http://localhost:5001
echo.
node admin\server.js
echo.
echo Admin stopped.
pause
