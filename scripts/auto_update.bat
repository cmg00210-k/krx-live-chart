@echo off
chcp 65001 >nul
echo ============================================
echo   KRX Data Auto Update (%date% %time%)
echo ============================================

cd /d "%~dp0\.."

set PYTHON32=C:\Users\seth1\AppData\Local\Programs\Python\Python39-32\python.exe

:: Step 1: OHLCV + index.json (top 100, fast)
echo.
echo [1/3] Downloading OHLCV + market cap...
"%PYTHON32%" scripts/download_ohlcv.py --top 100 --delay 0.2

:: Step 2: Full index update (stock list + lastClose + marketCap)
echo.
echo [2/3] Updating full stock index...
"%PYTHON32%" scripts/update_index_prices.py

:: Step 3: Sector fundamentals
echo.
echo [3/3] Updating sector fundamentals...
"%PYTHON32%" scripts/download_sector.py

echo.
echo ============================================
echo   Auto update complete!
echo ============================================
