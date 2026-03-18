@echo off
chcp 65001 >nul

:: ── 중복 실행 방지: 포트 8765 사용 중이면 종료 ──
netstat -an | findstr ":8765 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [KRX] WS 서버가 이미 실행 중입니다 (포트 8765)
    exit /b 0
)

cd /d "%~dp0"

:: Python 3.9-32bit 경로 (Kiwoom OCX는 32bit 전용)
set PYTHON32=C:\Users\seth1\AppData\Local\Programs\Python\Python39-32\python.exe

if not exist "%PYTHON32%" (
    echo [오류] Python 3.9-32bit 없음: %PYTHON32%
    exit /b 1
)

:: 의존성 설치 (조용히)
"%PYTHON32%" -m pip install -r requirements.txt -q 2>nul

:: 서버 시작 (최소화 + 로그 파일)
echo [KRX] WS 서버 시작 중... (%date% %time%)
start /min "" "%PYTHON32%" ws_server.py > server.log 2>&1
