@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Push to GitHub - Ma8967.github.io

set "GIT=E:\cherry_studio\Cherry Studio\resources\app.asar.unpacked\resources\binaries\win32-x64\git\cmd\git.exe"

echo ============================================
echo  Pushing to github.com/Ma8967/Ma8967.github.io
echo  A GitHub login window may open. Sign in as Ma8967.
echo ============================================
echo.

"%GIT%" push -u origin main

echo.
if errorlevel 1 (
  echo [FAILED] Read the message above.
) else (
  echo [OK] Push finished. Open the Actions tab on GitHub.
)
echo.
pause
