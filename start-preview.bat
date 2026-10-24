@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Blog Preview - localhost:4000
echo Starting preview at http://localhost:4000
echo.
call npx hexo server
echo.
echo Preview stopped.
pause
