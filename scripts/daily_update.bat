@echo off
:: ═══════════════════════════════════════════════
::  KRX 일일 데이터 업데이트 (cron/스케줄러용)
::
::  Windows 작업 스케줄러 등록:
::    schtasks /create /sc daily /tn "KRX_DailyUpdate" /tr "C:\Users\seth1\krx-live-chart-remote\scripts\daily_update.bat" /st 16:00
::
::  수동 실행:
::    scripts\daily_update.bat
:: ═══════════════════════════════════════════════

chcp 65001 >nul
echo [%date% %time%] ========================================
echo [%date% %time%] KRX 일일 데이터 업데이트 시작
echo [%date% %time%] ========================================

:: 프로젝트 루트로 이동 (bat 파일 위치 기준 한 단계 위)
cd /d "%~dp0\.."

:: Python 경로 설정 (pykrx/FDR 설치된 환경)
set PYTHON=C:\Users\seth1\AppData\Local\Programs\Python\Python39-32\python.exe

:: Python 존재 확인
if not exist "%PYTHON%" (
    echo [%date% %time%] 오류: Python을 찾을 수 없습니다: %PYTHON%
    exit /b 1
)

:: ── 1단계: 매크로 지표 다운로드 (ECOS/FRED/OECD) ──
echo.
echo [%date% %time%] [1/7] 매크로 지표 다운로드 중...
"%PYTHON%" scripts/download_macro.py
if errorlevel 1 (
    echo [%date% %time%] 경고: 매크로 지표 다운로드 실패
)

:: ── 2단계: KOSIS 경제지표 다운로드 (경기종합지수 22항목) ──
echo.
echo [%date% %time%] [2/7] KOSIS 경제지표 다운로드 중...
"%PYTHON%" scripts/download_kosis.py
if errorlevel 1 (
    echo [%date% %time%] 경고: KOSIS 다운로드 실패
)

:: ── 3단계: 금리/채권 데이터 다운로드 (수익률 곡선 + 신용 스프레드) ──
echo.
echo [%date% %time%] [3/7] 금리/채권 데이터 다운로드 중...
"%PYTHON%" scripts/download_bonds.py
if errorlevel 1 (
    echo [%date% %time%] 경고: 금리/채권 다운로드 실패
)

:: ── 3단계: 시장 컨텍스트 다운로드 (CCSI, VKOSPI, 투자자 수급) ──
echo.
echo [%date% %time%] [4/7] 시장 컨텍스트 다운로드 중...
"%PYTHON%" scripts/download_market_context.py
if errorlevel 1 (
    echo [%date% %time%] 경고: 시장 컨텍스트 다운로드 실패
)

:: ── 4단계: OHLCV 다운로드 (cron 모드 — 로그 파일 출력) ──
echo.
echo [%date% %time%] [5/7] OHLCV 다운로드 중 (cron 모드)...
"%PYTHON%" scripts/download_ohlcv.py --cron --years 1
if errorlevel 1 (
    echo [%date% %time%] 경고: OHLCV 다운로드 실패 (일부 종목)
)

:: ── 5단계: 분봉 데이터 생성 (5분봉) ──
echo.
echo [%date% %time%] [6/7] 분봉 데이터 생성 중 (5분봉)...
"%PYTHON%" scripts/generate_intraday.py --timeframe 5m
if errorlevel 1 (
    echo [%date% %time%] 경고: 분봉 생성 실패
)

:: ── 6단계: 인덱스 가격/등락률 갱신 (OHLCV 파일 기반, FDR 없이) ──
echo.
echo [%date% %time%] [7/7] 인덱스 가격 갱신 중...
"%PYTHON%" scripts/update_index_prices.py --offline
if errorlevel 1 (
    echo [%date% %time%] 경고: 인덱스 갱신 실패
)

echo.
echo [%date% %time%] ========================================
echo [%date% %time%] 일일 데이터 업데이트 완료 (7단계)
echo [%date% %time%] ========================================
exit /b 0
