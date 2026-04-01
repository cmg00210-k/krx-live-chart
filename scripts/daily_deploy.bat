@echo off
chcp 65001 >nul 2>nul
echo ============================================
echo   CheeseStock Daily Data Update + Deploy
echo ============================================
echo.

cd /d "%~dp0\.."

echo [1/5] Pre-deploy verification...
python scripts/verify.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Verification failed - fix errors before deploying
    pause
    exit /b 1
)

echo [2/5] OHLCV Download...
python scripts/download_ohlcv.py --cron
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] OHLCV download failed
    pause
    exit /b 1
)

echo [3/5] Intraday 1m/5m/15m/30m/1h...
python scripts/generate_intraday.py --timeframe 1m --days 3
python scripts/generate_intraday.py --timeframe 5m --days 5
python scripts/generate_intraday.py --timeframe 15m --days 5
python scripts/generate_intraday.py --timeframe 30m --days 5
python scripts/generate_intraday.py --timeframe 1h --days 5

echo [4/6] Index update...
python scripts/update_index_prices.py

echo [5/6] Sector fundamentals...
python scripts/download_sector.py

echo [6/6] Cloudflare Pages deploy...
python scripts/stage_deploy.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Staging failed -- file count over limit
    pause
    exit /b 1
)
call npx wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="daily-update"

echo.
echo ============================================
echo   Done!
echo ============================================
pause
