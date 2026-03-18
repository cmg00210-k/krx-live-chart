@echo off
chcp 65001 >nul
echo CheeseStock WS 서버 자동시작 제거 중...

schtasks /Delete /TN "CheeseStock_WSServer" /F

if %errorlevel% equ 0 (
    echo [성공] 자동시작 제거 완료
) else (
    echo [실패] 작업이 없거나 관리자 권한 필요
)

pause
