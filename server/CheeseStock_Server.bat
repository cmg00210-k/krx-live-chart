@echo off
chcp 65001 >nul 2>nul
title CheeseStock Live Server

cd /d "%~dp0"

if defined KRX_PYTHON32 (
    set PYTHON32=%KRX_PYTHON32%
) else (
    set PYTHON32=%LOCALAPPDATA%\Programs\Python\Python39-32\python.exe
)

if not exist "%PYTHON32%" (
    echo [ERROR] Python 3.9-32bit not found: %PYTHON32%
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo   CheeseStock Live Server
echo   wss://ws.cheesestock.co.kr
echo  ==========================================
echo   Kiwoom login window will appear...
echo  ==========================================
echo.

"%PYTHON32%" -m pip install -r requirements.txt -q 2>nul
"%PYTHON32%" ws_server.py

pause
