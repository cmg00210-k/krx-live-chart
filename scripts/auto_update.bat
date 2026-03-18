@echo off
chcp 65001 >nul
echo ============================================
echo   KRX 데이터 자동 갱신 (%date% %time%)
echo ============================================

cd /d "%~dp0\.."

set PYTHON32=C:\Users\seth1\AppData\Local\Programs\Python\Python39-32\python.exe

:: 1단계: OHLCV + index.json 갱신 (상위 100종목, 빠르게)
echo.
echo [1/3] OHLCV + 시총 다운로드 중...
"%PYTHON32%" scripts/download_ohlcv.py --top 100 --delay 0.2

:: 2단계: 전체 종목 인덱스만 갱신 (종목 목록 + lastClose + marketCap)
echo.
echo [2/3] 전체 종목 인덱스 갱신 중...
"%PYTHON32%" scripts/update_index_prices.py

:: 3단계: 업종 펀더멘탈 갱신
echo.
echo [3/3] 업종 펀더멘탈 갱신 중...
"%PYTHON32%" scripts/download_sector.py

echo.
echo ============================================
echo   자동 갱신 완료!
echo ============================================
