@echo off
chcp 65001 >nul
echo ============================================
echo   CheeseStock 일일 데이터 갱신 + 자동 배포
echo   장 마감 후 실행 (16:00 KST 이후)
echo ============================================
echo.

cd /d "%~dp0\.."

:: Step 1: OHLCV 다운로드 (pykrx)
echo [1/4] OHLCV 다운로드 중...
python scripts/download_ohlcv.py --cron
if %ERRORLEVEL% NEQ 0 (
    echo [오류] OHLCV 다운로드 실패
    pause
    exit /b 1
)

:: Step 2: 분봉 보간 데이터 생성 (전 타임프레임)
echo [2/4] 분봉 데이터 생성 중...
python scripts/generate_intraday.py --timeframe 1m --days 3
python scripts/generate_intraday.py --timeframe 5m --days 5
python scripts/generate_intraday.py --timeframe 15m --days 5
python scripts/generate_intraday.py --timeframe 30m --days 5
python scripts/generate_intraday.py --timeframe 1h --days 5

:: Step 3: index.json 가격 업데이트
echo [3/4] index.json 갱신 중...
python scripts/download_ohlcv.py --update-index-only 2>nul

:: Step 4: Cloudflare Pages 배포
echo [4/4] Cloudflare Pages 배포 중...
call npx wrangler pages deploy . --project-name cheesestock --branch main --commit-dirty=true

echo.
echo ============================================
echo   갱신 + 배포 완료!
echo ============================================
pause
