@echo off
chcp 65001 >nul
echo ============================================
echo   KRX WebSocket Server v3.0 (Kiwoom OCX)
echo   ws://localhost:8765
echo ============================================
echo.
echo   [필수] Kiwoom HTS 로그인 상태
echo   [필수] Python 3.9-32bit + PyQt5
echo   [주의] KNOWSTOCK과 동시 실행 불가
echo.

cd /d "%~dp0"

:: Python 3.9-32bit 경로 (환경변수 KRX_PYTHON32 우선, 없으면 기본 경로)
:: Kiwoom OCX는 32bit 전용 — 각 개발자의 설치 경로가 다를 수 있음
if defined KRX_PYTHON32 (
    set PYTHON32=%KRX_PYTHON32%
) else (
    set PYTHON32=%LOCALAPPDATA%\Programs\Python\Python39-32\python.exe
)

:: Python 존재 확인
if not exist "%PYTHON32%" (
    echo [오류] Python 3.9-32bit를 찾을 수 없습니다:
    echo        %PYTHON32%
    echo.
    echo 설치: https://www.python.org/downloads/release/python-3913/
    echo       [Windows installer (32-bit)] 선택
    pause
    exit /b 1
)

:: 의존성 설치
echo 의존성 설치 중...
"%PYTHON32%" -m pip install -r requirements.txt -q

:: 서버 시작
echo.
echo Kiwoom OCX 서버 시작...
"%PYTHON32%" ws_server.py

pause
