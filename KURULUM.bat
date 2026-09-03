@echo off
chcp 65001 >nul
title firsattan al - Yönetim Paneli Kurulum
cd /d "%~dp0"

echo ==========================================
echo   firsattan al  -  Yönetim PANELI KURULUMU
echo ==========================================
echo.

if not exist ".env" (
    echo [1/2] .env olusturuluyor...
    copy .env.example .env >nul
) else (
    echo [1/2] .env mevcut, atlaniyor.
)

echo.
echo [2/2] npm bagimliliklari...
call npm install

echo.
echo ==========================================
echo   KURULUM TAMAMLANDI
echo ==========================================
echo.
echo   Baslatmak icin : BASLAT.bat  -^> http://localhost:5175
echo.
echo   API icin firsattanal-backend deposunu da kurun:
echo   https://github.com/ismailbahar/firsattanal-backend
echo.
pause
