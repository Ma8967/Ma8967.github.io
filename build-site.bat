@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Build Blog
echo Cleaning...
call npx hexo clean
echo.
echo Generating...
call npx hexo generate
if errorlevel 1 (
  echo.
  echo Build failed, check the messages above.
  pause
  exit /b 1
)
echo.
echo Done. Upload everything inside public\ to your GitHub repository root.
pause
