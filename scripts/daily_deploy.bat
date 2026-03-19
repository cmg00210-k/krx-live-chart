@echo off
chcp 65001 >nul 2>nul
echo ============================================
echo   CheeseStock Daily Data Update + Deploy
echo ============================================
echo.

cd /d "%~dp0\.."

echo [1/5] OHLCV Download...
python scripts/download_ohlcv.py --cron
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] OHLCV download failed
    pause
    exit /b 1
)

echo [2/5] Intraday 1m/5m/15m/30m/1h...
python scripts/generate_intraday.py --timeframe 1m --days 3
python scripts/generate_intraday.py --timeframe 5m --days 5
python scripts/generate_intraday.py --timeframe 15m --days 5
python scripts/generate_intraday.py --timeframe 30m --days 5
python scripts/generate_intraday.py --timeframe 1h --days 5

echo [3/5] Index update...
python scripts/download_ohlcv.py --update-index-only 2>nul

echo [4/5] Cloudflare Pages deploy...
call npx wrangler pages deploy . --project-name cheesestock --branch main --commit-dirty=true

echo.
echo ============================================
echo   Done!
echo ============================================
pause
