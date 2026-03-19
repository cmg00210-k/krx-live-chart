@echo off
chcp 65001 >nul
title CheeseStock Live Server

:: ═══════════════════════════════════════════
::  CheeseStock 실시간 서버 (원클릭 실행)
::  바탕화면 바로가기용 — 더블클릭으로 시작
:: ═══════════════════════════════════════════

cd /d "%~dp0"

:: Python 3.9-32bit 경로
if defined KRX_PYTHON32 (
    set PYTHON32=%KRX_PYTHON32%
) else (
    set PYTHON32=%LOCALAPPDATA%\Programs\Python\Python39-32\python.exe
)

if not exist "%PYTHON32%" (
    echo [오류] Python 3.9-32bit 미설치
    echo %PYTHON32%
    pause
    exit /b 1
)

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║  CheeseStock Live Server              ║
echo  ║  wss://ws.cheesestock.co.kr           ║
echo  ╠═══════════════════════════════════════╣
echo  ║  Kiwoom 로그인 창이 뜹니다...          ║
echo  ║  로그인 완료 후 자동으로 서버 시작      ║
echo  ╚═══════════════════════════════════════╝
echo.

:: 의존성 설치 (조용히)
"%PYTHON32%" -m pip install -r requirements.txt -q 2>nul

:: 서버 시작 (Kiwoom 로그인 포함)
"%PYTHON32%" ws_server.py

pause
