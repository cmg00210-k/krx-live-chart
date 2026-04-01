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
REM No manual file juggling, no .cfignore bugs, no 25 MB violations.
REM ASCII-only commit message (Korean breaks Cloudflare API).

cd /d "%~dp0\.."

echo [1/2] Staging deploy directory...
python scripts/stage_deploy.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Staging failed -- file count over limit or script error
    pause
    exit /b 1
)

echo.
echo [2/2] Deploying to Cloudflare Pages...
call npx wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] wrangler deploy failed
    pause
    exit /b 1
)

echo.
echo Deploy complete.
