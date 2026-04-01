@echo off
:: =============================================
::  KRX Daily Data Update (cron / scheduler)
::
::  Windows Task Scheduler:
::    schtasks /create /sc daily /tn "KRX_DailyUpdate" /tr "C:\Users\seth1\krx-live-chart-remote\scripts\daily_update.bat" /st 16:00
::
::  Manual:
::    scripts\daily_update.bat
:: =============================================

chcp 65001 >nul
echo [%date% %time%] ========================================
echo [%date% %time%] KRX Daily Data Update - START
echo [%date% %time%] ========================================

:: Move to project root (one level up from bat location)
cd /d "%~dp0\.."

:: Python path (env with pykrx/FDR installed)
set PYTHON=C:\Users\seth1\AppData\Local\Programs\Python\Python39-32\python.exe

:: Check Python exists
if not exist "%PYTHON%" (
    echo [%date% %time%] ERROR: Python not found: %PYTHON%
    exit /b 1
)

:: -- Step 1: KOSIS economic indicators (22 composite indices) --
:: NOTE: KOSIS runs before macro so MCS CSI uses today's KOSIS data
echo.
echo [%date% %time%] [1/7] KOSIS download...
"%PYTHON%" scripts/download_kosis.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: KOSIS download failed
)

:: -- Step 2: Macro indicators (ECOS/FRED/OECD) --
echo.
echo [%date% %time%] [2/7] Macro indicators download...
"%PYTHON%" scripts/download_macro.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Macro download failed
)

:: -- Step 3: Bond / yield curve + credit spread --
echo.
echo [%date% %time%] [3/7] Bonds download...
"%PYTHON%" scripts/download_bonds.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Bonds download failed
)

:: -- Step 4: Market context (CCSI, VKOSPI, investor flow) --
echo.
echo [%date% %time%] [4/7] Market context download...
"%PYTHON%" scripts/download_market_context.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Market context download failed
)

:: -- Step 5: OHLCV download (cron mode - log to file) --
echo.
echo [%date% %time%] [5/7] OHLCV download (cron mode)...
"%PYTHON%" scripts/download_ohlcv.py --cron --years 1
if errorlevel 1 (
    echo [%date% %time%] WARNING: OHLCV download failed (partial)
)

:: -- Step 6: Intraday candle generation (5m) --
echo.
echo [%date% %time%] [6/7] Intraday generation (5m)...
"%PYTHON%" scripts/generate_intraday.py --timeframe 5m
if errorlevel 1 (
    echo [%date% %time%] WARNING: Intraday generation failed
)

:: -- Step 7: Index price / change update (OHLCV-based, no FDR) --
echo.
echo [%date% %time%] [7/7] Index price update...
"%PYTHON%" scripts/update_index_prices.py --offline
if errorlevel 1 (
    echo [%date% %time%] WARNING: Index update failed
)

echo.
echo [%date% %time%] ========================================
echo [%date% %time%] KRX Daily Data Update - DONE (7 steps)
echo [%date% %time%] ========================================
exit /b 0
