@echo off
chcp 65001 >nul
echo ============================================
echo   CheeseStock Cloudflare Tunnel 설정
echo   wss://ws.cheesestock.co.kr → localhost:8765
echo ============================================
echo.

:: ── cloudflared 설치 확인 ──
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] cloudflared가 설치되어 있지 않습니다.
    echo.
    echo 설치 방법:
    echo   winget install Cloudflare.cloudflared
    echo   또는: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    pause
    exit /b 1
)

:: ── WS 서버 실행 확인 ──
netstat -an | findstr ":8765 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [경고] WS 서버가 실행 중이 아닙니다 (포트 8765)
    echo        먼저 server\start_server.bat 을 실행하세요.
    echo.
    echo 그래도 터널을 시작하시겠습니까? (서버가 나중에 시작되어도 됨)
    pause
)

:: ── 터널 시작 ──
echo 터널 시작 중...
echo   로컬: ws://localhost:8765
echo   원격: wss://ws.cheesestock.co.kr/ws
echo.
echo   종료: Ctrl+C
echo.
cloudflared tunnel --url http://localhost:8765 --protocol http2

pause
