@echo off
:: =============================================
::  KRX Data Auto Update (hourly, Mon-Fri 09:30-16:05)
::  [V6-FIX] P1-1: Added errorlevel checks on all steps
::  [V6-FIX] P2-2: Log file output
::  [V6-FIX] P2-7: Banner version v66
::
::  Task Scheduler: CheeseStock_HourlyDeploy
:: =============================================

chcp 65001 >nul

cd /d "%~dp0\.."

:: [V6-FIX] P2-2: Ensure logs directory exists and set log path
if not exist "logs" mkdir logs
set LOGFILE=logs\auto_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%.log

call :LOG "============================================"
call :LOG "  KRX Data Auto Update (v66, 3 steps)"
call :LOG "============================================"

:: Dual-Python: 64-bit for data pipeline, 32-bit reserved for server (Kiwoom OCX)
if defined KRX_PYTHON (
    set PYTHON64=%KRX_PYTHON%
) else if exist "%USERPROFILE%\miniconda3\envs\krx64\python.exe" (
    set PYTHON64=%USERPROFILE%\miniconda3\envs\krx64\python.exe
) else (
    set PYTHON64=python
)

if not exist "%PYTHON64%" (
    call :LOG "ERROR: Python not found: %PYTHON64%"
    call :LOG "Set KRX_PYTHON env var or install conda env: conda create -n krx64 python=3.12"
    exit /b 1
)

set WARN_COUNT=0

:: Step 1: OHLCV + index.json (top 100, fast)
call :LOG ""
call :LOG "[1/3] Downloading OHLCV + market cap..."
"%PYTHON64%" scripts/download_ohlcv.py --top 100 --delay 0.2 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: OHLCV download failed"
    set /a WARN_COUNT+=1
)

:: Step 2: Full index update (stock list + lastClose + marketCap)
call :LOG ""
call :LOG "[2/3] Updating full stock index..."
"%PYTHON64%" scripts/update_index_prices.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Index update failed"
    set /a WARN_COUNT+=1
)

:: Step 3: Sector fundamentals
call :LOG ""
call :LOG "[3/3] Updating sector fundamentals..."
"%PYTHON64%" scripts/download_sector.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :LOG "WARNING: Sector fundamentals failed"
    set /a WARN_COUNT+=1
)

call :LOG ""
call :LOG "============================================"
call :LOG "  Auto update complete! (%WARN_COUNT% warnings)"
call :LOG "  Log file: %LOGFILE%"
call :LOG "============================================"
exit /b 0

:: =============================================
:: Subroutine: Log to both console and file
:: =============================================
:LOG
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOGFILE%"
goto :eof
