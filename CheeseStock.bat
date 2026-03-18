@echo off
chcp 65001 >nul

:: ── CheeseStock 원클릭 런처 ──
:: 1. WS 서버 시작 (Kiwoom 로그인)
:: 2. HTTP 서버 시작 (CORS 해결)
:: 3. 브라우저 열기

:: WS 서버 시작 (중복 방지 내장)
call "%~dp0server\start_server_silent.bat"

:: HTTP 서버 확인 (포트 5500)
netstat -an | findstr ":5500 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [CheeseStock] HTTP 서버 시작 중 (포트 5500)...
    cd /d "%~dp0"
    start /min "" npx serve -l 5500 -s --no-clipboard
    timeout /t 3 /nobreak >nul
) else (
    echo [CheeseStock] HTTP 서버 이미 실행 중 (포트 5500)
)

:: 브라우저 열기 (HTTP)
start "" "http://localhost:5500"
