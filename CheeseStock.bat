@echo off
chcp 65001 >nul

:: 서버 시작 (중복 방지 내장)
call "%~dp0server\start_server_silent.bat"

:: 2초 대기 후 브라우저 열기
timeout /t 2 /nobreak >nul

:: index.html 열기
start "" "%~dp0index.html"
