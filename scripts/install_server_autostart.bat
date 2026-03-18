@echo off
chcp 65001 >nul
echo ============================================
echo   CheeseStock WS 서버 자동시작 설치
echo ============================================
echo.

:: 기존 작업 삭제 (있으면)
schtasks /Delete /TN "CheeseStock_WSServer" /F >nul 2>&1

:: 새 작업 등록: 로그온 시 자동 시작
set SCRIPT_PATH=%~dp0..\server\start_server_silent.bat

schtasks /Create ^
  /TN "CheeseStock_WSServer" ^
  /TR "\"%SCRIPT_PATH%\"" ^
  /SC ONLOGON ^
  /RL HIGHEST ^
  /F

if %errorlevel% equ 0 (
    echo.
    echo [성공] 자동시작 등록 완료!
    echo   - 작업 이름: CheeseStock_WSServer
    echo   - 트리거: Windows 로그온 시
    echo   - 실행: %SCRIPT_PATH%
    echo.
    echo 제거하려면: schtasks /Delete /TN "CheeseStock_WSServer" /F
) else (
    echo.
    echo [실패] 관리자 권한으로 다시 실행해주세요.
)

echo.
pause
