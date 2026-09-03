@echo off
chcp 65001 >nul
title firsattan al - Yönetim Paneli
cd /d "%~dp0"

echo ==========================================
echo   firsattan al  -  Yönetim Paneli
echo   http://localhost:5175
echo ==========================================
echo.
echo   NOT: Backend'in ayakta olmasi gerekir.
echo   Vite proxy'si /api isteklerini 127.0.0.1:8000 adresine yollar.
echo.

if not exist "node_modules" (
    echo [!] node_modules yok, bagimliliklar kuruluyor...
    call npm install
)

if not exist ".env" copy .env.example .env >nul

call npm run dev
pause
