"""
KRX 전체 종목 OHLCV 데이터 다운로더

데이터 소스: pykrx (KRX 공식 데이터 스크래핑)
종목 리스트: FinanceDataReader (KRX 상장 전종목)
출력 형식:   TradingView Lightweight Charts 호환 JSON

폴더 구조 (코스콤 전환 대비):
  data/
  ├── index.json          ← 전체 종목 인덱스 (코드, 이름, 시장)
  ├── kospi/
  │   ├── 005930.json     ← 삼성전자 일봉
  │   └── ...
  └── kosdaq/
      ├── 247540.json     ← 에코프로비엠 일봉
      └── ...

사용법:
  python scripts/download_ohlcv.py              # 기본 1년치, 전체 종목
  python scripts/download_ohlcv.py --years 3    # 3년치
  python scripts/download_ohlcv.py --market KOSPI  # KOSPI만
  python scripts/download_ohlcv.py --code 005930   # 삼성전자만
  python scripts/download_ohlcv.py --top 100       # 시가총액 상위 100개
  python scripts/download_ohlcv.py --incremental   # 기존 데이터 이후만 다운로드 (빠름)
"""

import sys
import os
import json
import time
import argparse
import logging
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

# ── 로깅 설정 (--cron 모드에서 파일 출력용) ──
logger = logging.getLogger('krx_downloader')
logger.setLevel(logging.INFO)
_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(_console_handler)

from pykrx import stock
import FinanceDataReader as fdr

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")


def get_all_stocks():
    """KRX 전체 상장종목 리스트 (FinanceDataReader 사용, 재시도 포함)"""
    logger.info("  종목 리스트 로딩 중...")

    for attempt in range(3):
        try:
            kospi = fdr.StockListing('KOSPI')
            kosdaq = fdr.StockListing('KOSDAQ')
            break
        except Exception as e:
            logger.warning(f"  종목 리스트 로드 실패 (시도 {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(3)
            else:
                raise

    stocks = []
    spac_filtered = 0
    for _, row in kospi.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            # SPAC 필터: 합병 전 NAV 근처 거래 → 기술적 패턴 분석 부적합
            name_upper = name.upper()
            if '스팩' in name or 'SPAC' in name_upper:
                spac_filtered += 1
                continue
            stocks.append({"code": code, "name": name, "market": "KOSPI"})

    for _, row in kosdaq.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            name_upper = name.upper()
            if '스팩' in name or 'SPAC' in name_upper:
                spac_filtered += 1
                continue
            stocks.append({"code": code, "name": name, "market": "KOSDAQ"})

    logger.info(f"  KOSPI {len(kospi)}개 + KOSDAQ {len(kosdaq)}개 = {len(stocks)}개 (SPAC {spac_filtered}개 제외)")
    return stocks


def _get_existing_last_date(code, market, output_dir):
    """기존 JSON 파일에서 마지막 캔들 날짜를 읽어온다. 없으면 None."""
    filepath = os.path.join(output_dir, market.lower(), f"{code}.json")
    if not os.path.exists(filepath):
        return None, None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        candles = data.get("candles", [])
        if candles:
            return candles[-1]["time"], data  # "YYYY-MM-DD", full data object
    except Exception:
        pass
    return None, None


def download_stock(code, name, market, start_date, end_date, output_dir, incremental=False):
    """단일 종목 OHLCV 다운로드 → 시장별 폴더에 JSON 저장

    Args:
        incremental: True면 기존 JSON의 마지막 날짜+1부터만 다운로드하여 append
    """
    MAX_ATTEMPTS = 3
    RETRY_SLEEP = 2  # seconds between attempts

    def _is_permanent_error(exc):
        """404 / invalid code 등 재시도해도 소용없는 에러 판별"""
        msg = str(exc).lower()
        return any(k in msg for k in ("404", "not found", "invalid", "종목코드"))

    # [B-5] incremental: 기존 데이터에서 마지막 날짜 확인 → 다음 날부터 다운로드
    existing_data = None
    actual_start = start_date
    if incremental:
        last_date, existing_data = _get_existing_last_date(code, market, output_dir)
        if last_date:
            # 마지막 날짜의 다음 날부터 다운로드 (당일 중복 방지)
            next_day = datetime.strptime(last_date, "%Y-%m-%d") + timedelta(days=1)
            actual_start = next_day.strftime("%Y%m%d")
            if actual_start > end_date:
                # 이미 최신 → 스킵 (None이 아닌 기존 데이터 반환)
                if existing_data and existing_data.get("candles"):
                    candles = existing_data["candles"]
                    return {
                        "code": code, "name": name, "market": market,
                        "count": len(candles),
                        "size_kb": 0,
                        "last_close": candles[-1]["close"],
                        "file": f"{market.lower()}/{code}.json",
                        "skipped": True,  # 신규 데이터 없음 표시
                    }
                return None

    df = None
    last_exc = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            # [C-3] 수정주가 적용: 액면분할/병합 반영 (미반영 시 허위 패턴 발생)
            df = stock.get_market_ohlcv(actual_start, end_date, code, adjusted=True)
            break  # success
        except Exception as e:
            last_exc = e
            if _is_permanent_error(e):
                break  # don't retry permanent failures
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(RETRY_SLEEP)

    if last_exc is not None and df is None:
        return {"error": str(last_exc)}

    try:
        new_candles = []
        if df is not None and not df.empty:
            for date_idx, row in df.iterrows():
                o = int(row["시가"])
                h = int(row["고가"])
                l = int(row["저가"])
                c = int(row["종가"])
                v = int(row["거래량"])

                if o <= 0 or h <= 0 or l <= 0 or c <= 0:
                    continue

                new_candles.append({
                    "time": date_idx.strftime("%Y-%m-%d"),
                    "open": o, "high": h, "low": l, "close": c,
                    "volume": v
                })

        # [B-5] incremental: 기존 캔들 + 새 캔들 병합
        if incremental and existing_data and existing_data.get("candles"):
            old_candles = existing_data["candles"]
            if new_candles:
                # 중복 방지: 새 캔들의 날짜가 기존에 이미 있으면 제거
                old_dates = {c["time"] for c in old_candles}
                new_candles = [c for c in new_candles if c["time"] not in old_dates]
                candles = old_candles + new_candles
            else:
                candles = old_candles  # 새 데이터 없으면 기존 유지
        else:
            candles = new_candles

        if not candles:
            return None

        # 시장별 하위 폴더에 저장
        market_dir = os.path.join(output_dir, market.lower())
        os.makedirs(market_dir, exist_ok=True)

        data = {
            "code": code,
            "name": name,
            "market": market,
            "timeframe": "1d",
            "count": len(candles),
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "candles": candles
        }

        filepath = os.path.join(market_dir, f"{code}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        return {
            "code": code,
            "name": name,
            "market": market,
            "count": len(candles),
            "new_count": len(new_candles) if incremental else len(candles),
            "size_kb": os.path.getsize(filepath) / 1024,
            "last_close": candles[-1]["close"],
            "file": f"{market.lower()}/{code}.json"
        }

    except Exception as e:
        return {"error": str(e)}


def fetch_market_caps(date_str):
    """FinanceDataReader로 전체 종목 시가총액 조회 (억원 단위)

    pykrx의 get_market_cap_by_ticker가 컬럼명 인코딩 문제로 실패하므로
    FinanceDataReader.StockListing()의 Marcap 필드를 사용.

    Args:
        date_str: "YYYYMMDD" 형식의 날짜 (미사용, FDR은 최신 데이터 반환)

    Returns:
        dict: { 종목코드: 시총(억원) }
    """
    market_caps = {}
    try:
        import FinanceDataReader as fdr

        for market in ["KOSPI", "KOSDAQ"]:
            try:
                df = fdr.StockListing(market)
                if df is not None and not df.empty and "Marcap" in df.columns:
                    for _, row in df.iterrows():
                        code = str(row.get("Code", ""))
                        marcap = row.get("Marcap", 0)
                        if code and marcap and marcap > 0:
                            cap_억 = int(marcap / 100_000_000)  # 원 → 억원
                            if cap_억 > 0:
                                market_caps[code] = cap_억
            except Exception as e:
                logger.warning(f"  {market} 시총 조회 실패: {e}")

        logger.info(f"  시가총액 데이터: {len(market_caps)}종목 로드 완료")

    except Exception as e:
        logger.warning(f"  시가총액 조회 전체 실패: {e}")

    return market_caps


def fetch_sector_info():
    """FinanceDataReader로 전체 종목 섹터/업종 정보 조회

    Returns:
        dict: { 종목코드: { 'sector': '...', 'industry': '...' } }
    """
    sector_map = {}
    try:
        import FinanceDataReader as fdr
        for market in ['KRX-DESC']:
            df = fdr.StockListing(market)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    code = str(row.get('Code', ''))
                    raw_sector = row.get('Sector', '')
                    raw_industry = row.get('Industry', '')
                    import math
                    def _safe_str(v):
                        if v is None: return ''
                        if isinstance(v, float) and math.isnan(v): return ''
                        s = str(v).strip()
                        return '' if s.lower() == 'nan' else s
                    sector = _safe_str(raw_sector)
                    industry = _safe_str(raw_industry)
                    # FDR에서 Sector가 대부분 NaN이므로 Industry를 sector로 사용
                    if not sector and industry:
                        sector = industry
                    if code and sector:
                        sector_map[code] = {
                            'sector': sector,
                            'industry': industry,
                        }
        logger.info(f"  섹터 정보: {len(sector_map)}종목 로드 완료")
    except Exception as e:
        logger.warning(f"  섹터 정보 조회 실패: {e}")
    return sector_map


def _fetch_indices():
    """KOSPI/KOSDAQ 최신 지수 조회"""
    indices = {}
    try:
        import FinanceDataReader as fdr
        # KOSPI 지수
        df = fdr.DataReader('KS11', start=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        if df is not None and not df.empty:
            indices['kospi'] = float(df.iloc[-1]['Close'])
        # KOSDAQ 지수
        df = fdr.DataReader('KQ11', start=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        if df is not None and not df.empty:
            indices['kosdaq'] = float(df.iloc[-1]['Close'])
        if indices:
            logger.info(f"  지수 조회 완료: KOSPI {indices.get('kospi', '?')}, KOSDAQ {indices.get('kosdaq', '?')}")
    except Exception as e:
        logger.warning(f"  지수 조회 실패: {e}")
    return indices


def build_index(stocks_meta, start_date, end_date, market_caps=None, sector_map=None):
    """data/index.json 생성 — js/api.js에서 읽는 전체 종목 인덱스

    Args:
        stocks_meta: 종목 메타 리스트
        start_date: 시작일
        end_date: 종료일
        market_caps: { 종목코드: 시총(억원) } (선택)
        sector_map: { 종목코드: { 'sector': '...', 'industry': '...' } } (선택)
    """
    # 시가총액 필드 추가
    if market_caps:
        for s in stocks_meta:
            code = s["code"]
            if code in market_caps:
                s["marketCap"] = market_caps[code]

    # 섹터/업종 필드 추가
    if sector_map:
        for s in stocks_meta:
            code = s["code"]
            if code in sector_map:
                s["sector"] = sector_map[code].get("sector", "")
                s["industry"] = sector_map[code].get("industry", "")

    index = {
        "source": "pykrx (KRX)",
        "license": "개발용 (사업화 시 코스콤 전환 필요)",
        "period": f"{start_date}~{end_date}",
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "total": len(stocks_meta),
        "kospi": len([s for s in stocks_meta if s["market"] == "KOSPI"]),
        "kosdaq": len([s for s in stocks_meta if s["market"] == "KOSDAQ"]),
        "stocks": stocks_meta,
        "indices": _fetch_indices(),
    }

    filepath = os.path.join(DATA_DIR, "index.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    return filepath


def main():
    parser = argparse.ArgumentParser(description="KRX 전체 종목 OHLCV 다운로더")
    parser.add_argument("--years", type=int, default=1, help="다운로드 연수 (기본: 1)")
    parser.add_argument("--market", type=str, choices=["KOSPI", "KOSDAQ"], help="특정 시장만")
    parser.add_argument("--code", type=str, help="특정 종목 코드만")
    parser.add_argument("--top", type=int, help="시가총액 상위 N개만")
    parser.add_argument("--delay", type=float, default=0.8, help="요청 간 대기(초, 기본: 0.8)")
    parser.add_argument("--incremental", action="store_true",
                        help="증분 다운로드: 기존 JSON의 마지막 날짜 이후만 다운로드")
    parser.add_argument("--cron", action="store_true",
                        help="무인 실행 모드 (프롬프트 없음, 로그 파일 출력)")
    args = parser.parse_args()

    # ── --cron 모드: 로그를 파일로 리다이렉트, 인터랙티브 프롬프트 비활성화 ──
    if args.cron:
        log_dir = os.path.join(PROJECT_ROOT, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(
            log_dir,
            f"download_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )
        # 파일 핸들러 추가, 콘솔 핸들러 제거
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
        ))
        logger.addHandler(file_handler)
        logger.removeHandler(_console_handler)
        logger.info(f"[CRON] 로그 파일: {log_file}")

    os.makedirs(DATA_DIR, exist_ok=True)

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=args.years * 365)).strftime("%Y%m%d")

    mode_tag = ' [CRON]' if args.cron else ''
    mode_tag += ' [INCREMENTAL]' if args.incremental else ''
    logger.info(f"═══════════════════════════════════════════")
    logger.info(f"  KRX OHLCV 다운로더{mode_tag}")
    logger.info(f"  기간: {start_date} ~ {end_date} ({args.years}년)")
    if args.incremental:
        logger.info(f"  모드: 증분 (기존 데이터 이후만 다운로드)")
    logger.info(f"  저장: data/kospi/, data/kosdaq/")
    logger.info(f"═══════════════════════════════════════════")

    # ── 종목 리스트 가져오기 ──
    if args.code:
        # 단일 종목 모드
        name = stock.get_market_ticker_name(args.code) or args.code
        targets = [{"code": args.code, "name": name, "market": "KOSPI"}]
        logger.info(f"  단일 종목: {name}({args.code})")
    else:
        targets = get_all_stocks()

        if args.market:
            targets = [s for s in targets if s["market"] == args.market]
            logger.info(f"  필터: {args.market}만 ({len(targets)}개)")

        if args.top:
            targets = targets[:args.top]
            logger.info(f"  필터: 상위 {args.top}개")

    logger.info(f"  다운로드 시작 ({len(targets)}개 종목)")

    success = 0
    fail = 0
    skip = 0
    stocks_meta = []
    start_time = time.time()

    for i, s in enumerate(targets):
        result = download_stock(s["code"], s["name"], s["market"], start_date, end_date, DATA_DIR,
                               incremental=args.incremental)

        if result is None:
            skip += 1
        elif "error" in result:
            fail += 1
            if (i + 1) % 50 == 0 or fail <= 3:
                logger.info(f"  X [{i+1}/{len(targets)}] {s['name']}({s['code']}): {result['error']}")
        else:
            success += 1
            entry = {
                "code": result["code"],
                "name": result["name"],
                "market": result["market"],
                "file": result["file"],
                "lastClose": result["last_close"]
            }

            # [OPT] 사이드바 즉시 표시용 요약 데이터 (index.json에서 바로 사용)
            # 마지막 2봉에서 전일 종가, 변동폭, 등락률, 거래량 추출
            candle_path = os.path.join(DATA_DIR, result["file"])
            try:
                with open(candle_path, "r", encoding="utf-8") as cf:
                    candle_data = json.load(cf)
                candles = candle_data.get("candles", [])
                if len(candles) >= 2:
                    last = candles[-1]
                    prev = candles[-2]
                    entry["prevClose"] = prev["close"]
                    entry["change"] = last["close"] - prev["close"]
                    entry["changePercent"] = round(
                        (last["close"] - prev["close"]) / prev["close"] * 100, 2
                    ) if prev["close"] > 0 else 0.0
                    entry["volume"] = last.get("volume", 0)
                elif len(candles) == 1:
                    entry["prevClose"] = candles[-1]["close"]
                    entry["change"] = 0
                    entry["changePercent"] = 0.0
                    entry["volume"] = candles[-1].get("volume", 0)
            except Exception:
                pass  # 요약 추출 실패 시 기존 필드만 유지

            stocks_meta.append(entry)
            # 진행률 표시 (50개마다 또는 처음 5개)
            if (i + 1) % 50 == 0 or i < 5:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(targets) - i - 1) / rate if rate > 0 else 0
                new_info = ""
                if args.incremental:
                    nc = result.get("new_count", result["count"])
                    new_info = f" (+{nc}신규)" if not result.get("skipped") else " (최신)"
                logger.info(f"  V [{i+1}/{len(targets)}] {s['name']}({s['code']}): "
                            f"{result['count']}봉 {result['size_kb']:.0f}KB{new_info} "
                            f"| 남은 시간: {int(eta//60)}분 {int(eta%60)}초")

        # KRX 서버 부하 방지
        if i < len(targets) - 1:
            time.sleep(args.delay)

    # ── 시가총액 데이터 조회 ──
    logger.info(f"  시가총액 데이터 조회 중...")
    market_caps = fetch_market_caps(end_date)

    # ── 섹터/업종 정보 조회 ──
    logger.info(f"  섹터/업종 정보 조회 중...")
    sector_map = fetch_sector_info()

    # ── 인덱스 파일 생성 (시총 + 섹터 포함) ──
    index_path = build_index(stocks_meta, start_date, end_date, market_caps, sector_map)

    # ── 용량 계산 ──
    total_size = 0
    for root, dirs, files in os.walk(DATA_DIR):
        for f in files:
            if f.endswith(".json"):
                total_size += os.path.getsize(os.path.join(root, f))

    elapsed = time.time() - start_time

    logger.info(f"═══════════════════════════════════════════")
    logger.info(f"  완료! ({int(elapsed//60)}분 {int(elapsed%60)}초 소요)")
    logger.info(f"  성공: {success} | 실패: {fail} | 건너뜀: {skip}")
    logger.info(f"  인덱스: {len(stocks_meta)}종목 (data/index.json)")
    logger.info(f"  총 용량: {total_size / 1024 / 1024:.1f}MB")
    logger.info(f"═══════════════════════════════════════════")

    # --cron 모드: 종료 코드 반환 (실패가 전체의 50% 초과 시 에러)
    if args.cron:
        total = success + fail + skip
        if total > 0 and fail > total * 0.5:
            logger.error(f"  [CRON] 실패율 과다: {fail}/{total} — 종료 코드 1")
            return 1
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code or 0)
    except Exception as e:
        logger.error(f"[FATAL] {e}")
        sys.exit(1)
