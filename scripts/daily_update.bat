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
echo [%date% %time%] KRX Daily Data Update - START (v52, 18 steps)
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

:: -- Step 0: API Health Check (Open API quick probe) --
echo.
echo [%date% %time%] [0/10] API Health Check...
"%PYTHON%" scripts/krx_probe_phase0.py --quick --save-health
if errorlevel 1 (
    echo [%date% %time%] ERROR: KRX API health check FAILED - aborting pipeline
    exit /b 1
)

:: -- Step 1: KOSIS economic indicators (22 composite indices) --
:: NOTE: KOSIS runs before macro so MCS CSI uses today's KOSIS data
echo.
echo [%date% %time%] [1/10] KOSIS download...
"%PYTHON%" scripts/download_kosis.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: KOSIS download failed
)

:: -- Step 2: Macro indicators (ECOS/FRED/OECD) --
echo.
echo [%date% %time%] [2/10] Macro indicators download...
"%PYTHON%" scripts/download_macro.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Macro download failed
)

:: -- Step 3: Bond / yield curve + credit spread --
echo.
echo [%date% %time%] [3/10] Bonds download...
"%PYTHON%" scripts/download_bonds.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Bonds download failed
)

:: -- Step 4: Market context (CCSI, VKOSPI, investor flow) --
echo.
echo [%date% %time%] [4/10] Market context download...
"%PYTHON%" scripts/download_market_context.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Market context download failed
)

:: -- Step 5: KRX Open API derivatives (futures + options) --
echo.
echo [%date% %time%] [5/10] Derivatives download (Open API)...
"%PYTHON%" scripts/download_derivatives.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Derivatives download failed
)

:: -- Step 6: KRX Open API - VKOSPI + ETF --
echo.
echo [%date% %time%] [6/10] VKOSPI + ETF download (Open API)...
"%PYTHON%" scripts/download_vkospi.py
"%PYTHON%" scripts/download_etf.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: VKOSPI/ETF download failed
)

:: -- Step 7: KRX OTP - Investor + Short Selling --
echo.
echo [%date% %time%] [7/10] Investor + Short Selling (OTP)...
"%PYTHON%" scripts/download_investor.py
"%PYTHON%" scripts/download_shortselling.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Investor/ShortSelling download failed
)

:: -- Step 8: OHLCV download (cron mode - log to file) --
echo.
echo [%date% %time%] [8/10] OHLCV download (cron mode)...
"%PYTHON%" scripts/download_ohlcv.py --cron --incremental --years 1
if errorlevel 1 (
    echo [%date% %time%] WARNING: OHLCV download failed (partial)
)

:: -- Step 9: Intraday candle generation (5m) --
echo.
echo [%date% %time%] [9/10] Intraday generation (5m)...
"%PYTHON%" scripts/generate_intraday.py --timeframe 5m
if errorlevel 1 (
    echo [%date% %time%] WARNING: Intraday generation failed
)

:: -- Step 10: Index price / change update (OHLCV-based, no FDR) --
echo.
echo [%date% %time%] [10/10] Index price update...
"%PYTHON%" scripts/update_index_prices.py --offline
if errorlevel 1 (
    echo [%date% %time%] WARNING: Index update failed
)

:: =============================================
:: Phase 2: Post-Processing Compute Pipeline
:: (runs after all downloads complete)
:: =============================================

:: -- Step 11: Options latest snapshot (derivatives -> options_latest.json) --
echo.
echo [%date% %time%] [11/18] Options latest snapshot...
"%PYTHON%" scripts/prepare_options_latest.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Options latest snapshot failed
)

:: -- Step 12: Options analytics (BSM IV + Greeks, needs Step 11) --
echo.
echo [%date% %time%] [12/18] Options analytics (BSM IV + Greeks)...
"%PYTHON%" scripts/compute_options_analytics.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Options analytics failed
)

:: -- Step 13: Bond metrics (Duration / Convexity / DV01, needs Step 3) --
echo.
echo [%date% %time%] [13/18] Bond metrics (Duration/Convexity/DV01)...
"%PYTHON%" scripts/compute_bond_metrics.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Bond metrics failed
)

:: -- Step 14: Futures basis analysis (needs Step 5 derivatives) --
echo.
echo [%date% %time%] [14/18] Futures basis analysis...
"%PYTHON%" scripts/compute_basis.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Basis computation failed
)

:: -- Step 15: Macro composite score v2 (needs Steps 1-3 macro/KOSIS/bonds) --
echo.
echo [%date% %time%] [15/18] Macro composite score...
"%PYTHON%" scripts/compute_macro_composite.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Macro composite failed
)

:: -- Step 16: Flow signals + HMM regime labels (needs Step 7 investor data) --
echo.
echo [%date% %time%] [16/18] Flow signals + HMM regimes...
"%PYTHON%" scripts/compute_flow_signals.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: Flow signals failed
)

:: -- Step 17: CAPM beta (needs Step 8 OHLCV + Step 2 macro) --
echo.
echo [%date% %time%] [17/18] CAPM beta computation...
"%PYTHON%" scripts/compute_capm_beta.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: CAPM beta failed
)

:: -- Step 18: EVA computation (needs Step 8 OHLCV + financials) --
echo.
echo [%date% %time%] [18/18] EVA computation...
"%PYTHON%" scripts/compute_eva.py
if errorlevel 1 (
    echo [%date% %time%] WARNING: EVA computation failed
)

echo.
echo [%date% %time%] ========================================
echo [%date% %time%] KRX Daily Data Update - DONE (v52, 18 steps)
echo [%date% %time%] ========================================
exit /b 0
