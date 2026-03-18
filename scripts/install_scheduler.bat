@echo off
chcp 65001 >nul
echo Windows 작업 스케줄러에 KRX 데이터 자동 갱신 등록...

:: 매일 16:05에 auto_update.bat 실행
schtasks /create /tn "KRX_AutoUpdate" /tr "\"%~dp0auto_update.bat\"" /sc daily /st 16:05 /f

if %errorlevel% equ 0 (
    echo.
    echo 등록 완료! 매일 16:05에 자동으로 데이터가 갱신됩니다.
    echo 확인: schtasks /query /tn "KRX_AutoUpdate"
    echo 삭제: schtasks /delete /tn "KRX_AutoUpdate" /f
) else (
    echo.
    echo 등록 실패. 관리자 권한으로 실행해주세요.
)
pause
