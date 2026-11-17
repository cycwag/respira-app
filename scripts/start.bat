@echo off
title RESPIRA Application Launcher
color 0A

echo ==================================================
echo           MENYALAKAN SISTEM RESPIRA
echo ==================================================

set SCRIPTS_DIR=%~dp0
set PROJECT_ROOT=%SCRIPTS_DIR%..\
set BACKEND_DIR=%PROJECT_ROOT%backend
set FRONTEND_DIR=%PROJECT_ROOT%frontend

echo [1/2] Menyalakan Backend Express di port 5000...
start "RESPIRA Backend (Port 5000)" cmd /k "cd /d "%BACKEND_DIR%" && npm start"

timeout /t 3 /nobreak >nul

echo [2/2] Menyalakan Frontend Next.js di port 3000...
start "RESPIRA Frontend (Port 3000)" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ==================================================
echo   Aplikasi RESPIRA berhasil dijalankan!
echo   - Frontend : http://localhost:3000
echo   - Backend  : http://localhost:5000
echo ==================================================
echo Membuka browser ke http://localhost:3000 ...

start http://localhost:3000

echo.
echo Catatan: Jangan tutup jendela terminal Backend dan Frontend yang baru terbuka.
echo.
pause
