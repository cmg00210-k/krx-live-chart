@echo off
:: =============================================
::  KRX Daily Data Update (cron / scheduler)
::  [V6-FIX] P0-1/P0-2: Split bundled steps, individual errorlevel checks
::  [V6-FIX] P1-3/P1-4: Unified step counter [N/20]
::  [V6-FIX] P2-2: Log file output to logs/pipeline_YYYYMMDD.log
::  [V6-FIX] P2-7: Banner version v66 (matches sw.js CACHE_NAME)
::
::  Windows Task Scheduler:
::    schtasks /create /sc daily /tn "KRX_DailyUpdate" /tr "C:\Users\seth1\krx-live-chart-remote\scripts\daily_update.bat" /st 16:00
::
::  Manual:
::    scripts\daily_update.bat
:: =============================================

chcp 65001 >nul

:: Move to project root (one level up from bat location)
cd /d "%~dp0\.."

:: [V6-FIX] P2-2: Ensure logs directory exists
if not exist "logs" mkdir logs

:: [V6-FIX] P2-2: Set log file path (pipeline_YYYYMMDD.log)
set LOGFILE=logs\pipeline_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%.log

:: Log to both console and file using a subroutine
call :LOG "========================================"
call :LOG "KRX Daily Data Update - START (v66, 20 steps)"
call :LOG "========================================"

:: Dual-Python: 64-bit for data pipeline, 32-bit reserved for server (Kiwoom OCX)
:: KRX_PYTHON env var (64-bit) -> fallback to conda krx64 -> fallback to system python
if defined KRX_PYTHON (
    set PYTHON=%KRX_PYTHON%
) else if exist "%USERPROFILE%\miniconda3\envs\krx64\python.exe" (
    set PYTHON=%USERPROFILE%\miniconda3\envs\krx64\python.exe
) else (
    set PYTHON=python
)

:: Check Python exists
if not exist "%PYTHON%" (
    call :LOG "ERROR: Python not found: %PYTHON%"
    call :LOG "Set KRX_PYTHON env var or install conda env: conda create -n krx64 python=3.12"
    exit /b 1
)

:: Show Python version for pipeline diagnostics
"%PYTHON%" --version >> "%LOGFILE%" 2>&1

:: Track warning count for summary
set WARN_COUNT=0

:: =============================================
:: Phase 1: Data Downloads (Steps 0-10)
:: =============================================

:: -- Step 0: API Health Check (Open API quick probe) --
call :LOG ""
call :LOG "[0/20] API Health Check..."
"%PYTHON%" scripts/krx_probe_phase0.py --quick --save-health >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "ERROR: KRX API health check FAILED - aborting pipeline"
    exit /b 1
)

:: -- Step 1: KOSIS economic indicators (22 composite indices) --
:: NOTE: KOSIS runs before macro so MCS CSI uses today's KOSIS data
call :LOG ""
call :LOG "[1/20] KOSIS download..."
"%PYTHON%" scripts/download_kosis.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: KOSIS download failed"
    set /a WARN_COUNT+=1
)

:: -- Step 2: Macro indicators (ECOS/FRED/OECD) --
call :LOG ""
call :LOG "[2/20] Macro indicators download..."
"%PYTHON%" scripts/download_macro.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Macro download failed"
    set /a WARN_COUNT+=1
)

:: -- Step 3: Bond / yield curve + credit spread --
call :LOG ""
call :LOG "[3/20] Bonds download..."
"%PYTHON%" scripts/download_bonds.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Bonds download failed"
    set /a WARN_COUNT+=1
)

:: -- Step 4: Market context (CCSI, VKOSPI, investor flow) --
call :LOG ""
call :LOG "[4/20] Market context download..."
"%PYTHON%" scripts/download_market_context.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Market context download failed"
    set /a WARN_COUNT+=1
)

:: -- Step 5: KRX Open API derivatives (futures + options) --
call :LOG ""
call :LOG "[5/20] Derivatives download (Open API)..."
"%PYTHON%" scripts/download_derivatives.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Derivatives download failed"
    set /a WARN_COUNT+=1
)

:: [V6-FIX] P0-1: VKOSPI and ETF split into separate steps with individual checks
:: -- Step 6: KRX Open API - VKOSPI --
call :LOG ""
call :LOG "[6/20] VKOSPI download (Open API)..."
"%PYTHON%" scripts/download_vkospi.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: VKOSPI download failed - stale VKOSPI data may persist"
    set /a WARN_COUNT+=1
)

:: -- Step 7: KRX Open API - ETF --
call :LOG ""
call :LOG "[7/20] ETF download (Open API)..."
"%PYTHON%" scripts/download_etf.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: ETF download failed"
    set /a WARN_COUNT+=1
)

:: [V6-FIX] P0-2: Investor and Short Selling split into separate steps
:: -- Step 8: KRX OTP - Investor --
call :LOG ""
call :LOG "[8/20] Investor data download (OTP)..."
"%PYTHON%" scripts/download_investor.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Investor download failed - stale investor data may persist"
    set /a WARN_COUNT+=1
)

:: -- Step 9: KRX OTP - Short Selling --
call :LOG ""
call :LOG "[9/20] Short Selling download (OTP)..."
"%PYTHON%" scripts/download_shortselling.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Short Selling download failed"
    set /a WARN_COUNT+=1
)

:: -- Step 10: OHLCV download (cron mode - log to file) --
call :LOG ""
call :LOG "[10/20] OHLCV download (cron mode)..."
"%PYTHON%" scripts/download_ohlcv.py --cron --incremental --years 1 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: OHLCV download failed (partial)"
    set /a WARN_COUNT+=1
)

:: -- Step 11: Intraday candle generation (5m) --
call :LOG ""
call :LOG "[11/20] Intraday generation (5m)..."
"%PYTHON%" scripts/generate_intraday.py --timeframe 5m >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday generation failed"
    set /a WARN_COUNT+=1
)

:: -- Step 12: Index price / change update (OHLCV-based, no FDR) --
call :LOG ""
call :LOG "[12/20] Index price update..."
"%PYTHON%" scripts/update_index_prices.py --offline >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Index update failed"
    set /a WARN_COUNT+=1
)

:: =============================================
:: Phase 2: Post-Processing Compute Pipeline
:: (runs after all downloads complete)
:: =============================================

:: -- Step 13: Options latest snapshot (derivatives -> options_latest.json) --
call :LOG ""
call :LOG "[13/20] Options latest snapshot..."
"%PYTHON%" scripts/prepare_options_latest.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Options latest snapshot failed"
    set /a WARN_COUNT+=1
)

:: -- Step 14: Options analytics (BSM IV + Greeks, needs Step 13) --
call :LOG ""
call :LOG "[14/20] Options analytics (BSM IV + Greeks)..."
"%PYTHON%" scripts/compute_options_analytics.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Options analytics failed"
    set /a WARN_COUNT+=1
)

:: -- Step 15: Bond metrics (Duration / Convexity / DV01, needs Step 3) --
call :LOG ""
call :LOG "[15/20] Bond metrics (Duration/Convexity/DV01)..."
"%PYTHON%" scripts/compute_bond_metrics.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Bond metrics failed"
    set /a WARN_COUNT+=1
)

:: -- Step 16: Futures basis analysis (needs Step 5 derivatives) --
call :LOG ""
call :LOG "[16/20] Futures basis analysis..."
"%PYTHON%" scripts/compute_basis.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Basis computation failed"
    set /a WARN_COUNT+=1
)

:: -- Step 17: Macro composite score v2 (needs Steps 1-3 macro/KOSIS/bonds) --
call :LOG ""
call :LOG "[17/20] Macro composite score..."
"%PYTHON%" scripts/compute_macro_composite.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Macro composite failed"
    set /a WARN_COUNT+=1
)

:: -- Step 18: Flow signals + HMM regime labels (needs Step 8 investor data) --
call :LOG ""
call :LOG "[18/20] Flow signals + HMM regimes..."
"%PYTHON%" scripts/compute_flow_signals.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Flow signals failed"
    set /a WARN_COUNT+=1
)

:: -- Step 19: CAPM beta (needs Step 10 OHLCV + Step 2 macro) --
call :LOG ""
call :LOG "[19/20] CAPM beta computation..."
"%PYTHON%" scripts/compute_capm_beta.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: CAPM beta failed"
    set /a WARN_COUNT+=1
)

:: -- Step 20: EVA computation (needs Step 10 OHLCV + financials) --
call :LOG ""
call :LOG "[20/20] EVA computation..."
"%PYTHON%" scripts/compute_eva.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: EVA computation failed"
    set /a WARN_COUNT+=1
)

call :LOG ""
call :LOG "========================================"
call :LOG "KRX Daily Data Update - DONE (v66, 20 steps, %WARN_COUNT% warnings)"
call :LOG "========================================"
call :LOG "Log file: %LOGFILE%"
exit /b 0

:: =============================================
:: Subroutine: Log to both console and file
:: =============================================
:LOG
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOGFILE%"
goto :eof
