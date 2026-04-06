@echo off
REM deploy.bat -- Stage and deploy CheeseStock to Cloudflare Pages
REM
REM Usage:  scripts\deploy.bat
REM
REM Steps:
REM   1. Runs stage_deploy.py to build deploy\ (hard-linked, no disk copy)
REM   2. Verifies file count is under 20,000
REM   3. Runs wrangler pages deploy deploy\
REM
REM stage_deploy.py is the sole deploy gatekeeper (wrangler has no file exclusion mechanism).
REM ASCII-only commit message (Korean breaks Cloudflare API).

cd /d "%~dp0\.."

:: Dual-Python: use 64-bit for pipeline scripts
if defined KRX_PYTHON (
    set PYTHON=%KRX_PYTHON%
) else if exist "%USERPROFILE%\miniconda3\envs\krx64\python.exe" (
    set PYTHON=%USERPROFILE%\miniconda3\envs\krx64\python.exe
) else (
    set PYTHON=python
)

echo [1/3] Pre-deploy verification...
"%PYTHON%" scripts/verify.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Verification failed -- fix errors before deploying
    pause
    exit /b 1
)

echo.
echo [2/3] Staging deploy directory...
"%PYTHON%" scripts/stage_deploy.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Staging failed -- file count over limit or script error
    pause
    exit /b 1
)

echo.
echo [3/3] Deploying to Cloudflare Pages...
call npx wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] wrangler deploy failed
    pause
    exit /b 1
)

echo.
echo Deploy complete.
