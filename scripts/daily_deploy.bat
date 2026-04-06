@echo off
:: =============================================
::  CheeseStock Daily Data Update + Deploy
::  [V6-FIX] P0-4: Added 8 compute steps between download and deploy
::  [V6-FIX] P1-3: Unified step counter [N/16]
::  [V6-FIX] P2-2: Log file output
::  [V6-FIX] P2-7: Banner version v66
:: =============================================

chcp 65001 >nul 2>nul

cd /d "%~dp0\.."

:: [V6-FIX] P2-2: Ensure logs directory exists and set log path
if not exist "logs" mkdir logs
set LOGFILE=logs\deploy_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%.log

call :LOG "============================================"
call :LOG "  CheeseStock Daily Data Update + Deploy (v66, 16 steps)"
call :LOG "============================================"

:: Dual-Python: use 64-bit for pipeline scripts
if defined KRX_PYTHON (
    set PYTHON=%KRX_PYTHON%
) else if exist "%USERPROFILE%\miniconda3\envs\krx64\python.exe" (
    set PYTHON=%USERPROFILE%\miniconda3\envs\krx64\python.exe
) else (
    set PYTHON=python
)

set WARN_COUNT=0

:: =============================================
:: Phase 1: Verification
:: =============================================

call :LOG "[1/16] Pre-deploy verification..."
"%PYTHON%" scripts/verify.py >> "%LOGFILE%" 2>&1
if %ERRORLEVEL% NEQ 0 (
    call :LOG "[ERROR] Verification failed - fix errors before deploying"
    pause
    exit /b 1
)

:: =============================================
:: Phase 2: Data Downloads (Steps 2-6)
:: =============================================

call :LOG "[2/16] OHLCV Download..."
"%PYTHON%" scripts/download_ohlcv.py --cron >> "%LOGFILE%" 2>&1
if %ERRORLEVEL% NEQ 0 (
    call :LOG "[ERROR] OHLCV download failed"
    pause
    exit /b 1
)

call :LOG "[3/16] Intraday 1m/5m/15m/30m/1h..."
"%PYTHON%" scripts/generate_intraday.py --timeframe 1m --days 3 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday 1m generation failed"
    set /a WARN_COUNT+=1
)
"%PYTHON%" scripts/generate_intraday.py --timeframe 5m --days 5 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday 5m generation failed"
    set /a WARN_COUNT+=1
)
"%PYTHON%" scripts/generate_intraday.py --timeframe 15m --days 5 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday 15m generation failed"
    set /a WARN_COUNT+=1
)
"%PYTHON%" scripts/generate_intraday.py --timeframe 30m --days 5 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday 30m generation failed"
    set /a WARN_COUNT+=1
)
"%PYTHON%" scripts/generate_intraday.py --timeframe 1h --days 5 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Intraday 1h generation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[4/16] Index update..."
"%PYTHON%" scripts/update_index_prices.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Index update failed"
    set /a WARN_COUNT+=1
)

call :LOG "[5/16] Sector fundamentals..."
"%PYTHON%" scripts/download_sector.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Sector fundamentals failed"
    set /a WARN_COUNT+=1
)

:: =============================================
:: [V6-FIX] P0-4: Phase 3 - Compute Pipeline
:: These 8 steps were MISSING -- deploy was pushing raw data
:: without computed derivatives (macro composite, CAPM beta, etc.)
:: Compute failures WARN but do not block deploy.
:: =============================================

call :LOG "[6/16] Macro composite score..."
"%PYTHON%" scripts/compute_macro_composite.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Macro composite computation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[7/16] CAPM beta computation..."
"%PYTHON%" scripts/compute_capm_beta.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: CAPM beta computation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[8/16] Bond metrics (Duration/Convexity/DV01)..."
"%PYTHON%" scripts/compute_bond_metrics.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Bond metrics computation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[9/16] Flow signals + HMM regimes..."
"%PYTHON%" scripts/compute_flow_signals.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Flow signals computation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[10/16] Futures basis analysis..."
"%PYTHON%" scripts/compute_basis.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Basis computation failed"
    set /a WARN_COUNT+=1
)

call :LOG "[11/16] Options latest snapshot..."
"%PYTHON%" scripts/prepare_options_latest.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Options latest snapshot failed"
    set /a WARN_COUNT+=1
)

call :LOG "[12/16] Options analytics (BSM IV + Greeks)..."
"%PYTHON%" scripts/compute_options_analytics.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Options analytics failed"
    set /a WARN_COUNT+=1
)

call :LOG "[13/16] EVA computation..."
"%PYTHON%" scripts/compute_eva.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: EVA computation failed"
    set /a WARN_COUNT+=1
)

:: =============================================
:: Phase 4: Deploy
:: =============================================

call :LOG "[14/16] Pre-deploy verification (post-compute)..."
"%PYTHON%" scripts/verify.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Post-compute verification has warnings (deploying anyway)"
    set /a WARN_COUNT+=1
)

call :LOG "[15/16] Stage deploy..."
"%PYTHON%" scripts/stage_deploy.py >> "%LOGFILE%" 2>&1
if %ERRORLEVEL% NEQ 0 (
    call :LOG "[ERROR] Staging failed -- file count over limit"
    pause
    exit /b 1
)

call :LOG "[16/16] Cloudflare Pages deploy..."
call npx wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="daily-update" >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "[ERROR] Wrangler deploy failed"
    pause
    exit /b 1
)

call :LOG ""
call :LOG "============================================"
call :LOG "  Done! (v66, 16 steps, %WARN_COUNT% warnings)"
call :LOG "  Log file: %LOGFILE%"
call :LOG "============================================"
pause
exit /b 0

:: =============================================
:: Subroutine: Log to both console and file
:: =============================================
:LOG
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOGFILE%"
goto :eof
