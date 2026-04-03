"""
KRX 상장폐지 종목 OHLCV 다운로더 (D-1 Survivorship Bias Correction)

데이터 소스: FDR KRX-DELISTING (메타데이터) + pykrx (OHLCV)
학술 근거:   Elton, Gruber & Blake (1996, JF 51(4):1097-1108)
             — 상장 종목만으로 구성된 백테스트 유니버스는 WR을 2-5pp 과대 추정

폴더 구조:
  data/
  ├── delisted_index.json   ← 상폐 종목 메타 인덱스
  └── delisted/
      ├── 008110.json       ← 대동전자 일봉
      └── ...

사용법:
  python scripts/download_delisted.py                # 2015년 이후 전체 상폐 종목
  python scripts/download_delisted.py --test 10      # 타당성 검증 (10종목만)
  python scripts/download_delisted.py --since 2020   # 2020년 이후 상폐만
  python scripts/download_delisted.py --code 008110  # 단일 종목
  python scripts/download_delisted.py --incremental  # 기존 파일 스킵
  python scripts/download_delisted.py --cron         # 무인 실행 모드
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
logger = logging.getLogger('krx_delisted_downloader')
logger.setLevel(logging.INFO)
_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(_console_handler)

from pykrx import stock
import FinanceDataReader as fdr
import pandas as pd

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DELISTED_DIR = os.path.join(DATA_DIR, "delisted")


def get_delisted_stocks(since_year=2015):
    """KRX 상장폐지 종목 리스트 (FDR KRX-DELISTING)

    Args:
        since_year: 이 연도 이후 상폐 종목만 필터 (기본: 2015)

    Returns:
        list[dict]: [{code, name, market, listingDate, delistingDate, reason}]
    """
    logger.info("  상폐 종목 리스트 로딩 중...")

    for attempt in range(3):
        try:
            df = fdr.StockListing('KRX-DELISTING')
            break
        except Exception as e:
            logger.warning(f"  FDR KRX-DELISTING 로드 실패 (시도 {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(3)
            else:
                raise

    total_raw = len(df)
    stocks = []
    spac_filtered = 0
    non_stock_filtered = 0
    short_code_filtered = 0

    for _, row in df.iterrows():
        code = str(row.get('Symbol', '')).strip()
        name = str(row.get('Name', '')).strip()
        market = str(row.get('Market', '')).strip()

        # 6자리 코드만 (8자리 = 신주인수권증서/워런트)
        if len(code) != 6:
            short_code_filtered += 1
            continue

        if not code or not name:
            continue

        # KOSPI/KOSDAQ만 (KONEX 제외 — 유동성 부족으로 패턴 분석 부적합)
        if market not in ('KOSPI', 'KOSDAQ'):
            continue

        # SPAC 필터: 합병 전 NAV 근처 거래 → 기술적 패턴 분석 부적합
        # REF: download_ohlcv.py:74-78
        name_upper = name.upper()
        if '스팩' in name or 'SPAC' in name_upper:
            spac_filtered += 1
            continue

        # SecuGroup 필터: '주권'(보통주)만 — 우선주/ETF/ETN 등 제외
        secu_group = str(row.get('SecuGroup', '')).strip()
        if secu_group and secu_group not in ('주권', ''):
            non_stock_filtered += 1
            continue

        # 날짜 파싱
        delisting_date = row.get('DelistingDate')
        listing_date = row.get('ListingDate')

        if pd.isna(delisting_date):
            continue

        # since_year 필터
        try:
            if hasattr(delisting_date, 'year'):
                if delisting_date.year < since_year:
                    continue
                delist_str = delisting_date.strftime('%Y-%m-%d')
            else:
                delist_str = str(delisting_date)[:10]
                if int(delist_str[:4]) < since_year:
                    continue
        except (ValueError, TypeError):
            continue

        # 상장일 파싱
        list_str = None
        if pd.notna(listing_date):
            try:
                if hasattr(listing_date, 'strftime'):
                    list_str = listing_date.strftime('%Y-%m-%d')
                else:
                    list_str = str(listing_date)[:10]
            except Exception:
                pass

        reason = str(row.get('Reason', '')).strip()

        stocks.append({
            "code": code,
            "name": name,
            "market": market,
            "listingDate": list_str,
            "delistingDate": delist_str,
            "reason": reason,
        })

    logger.info(f"  FDR 전체: {total_raw}건")
    logger.info(f"  필터 결과: {len(stocks)}개 (8자리 제외 {short_code_filtered}, "
                f"SPAC 제외 {spac_filtered}, 비주권 제외 {non_stock_filtered})")

    # 상폐일 기준 최신순 정렬
    stocks.sort(key=lambda s: s['delistingDate'], reverse=True)
    return stocks


def _get_existing_candle_count(code):
    """기존 delisted JSON 파일의 캔들 수 반환. 없으면 0."""
    filepath = os.path.join(DELISTED_DIR, f"{code}.json")
    if not os.path.exists(filepath):
        return 0
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return len(data.get("candles", []))
    except Exception:
        return 0


def download_delisted_stock(code, name, market, listing_date, delisting_date):
    """단일 상폐 종목 OHLCV 다운로드 → data/delisted/{code}.json

    Args:
        listing_date: "YYYY-MM-DD" 또는 None
        delisting_date: "YYYY-MM-DD"

    Returns:
        dict: {code, name, market, count, size_kb, last_close, file} 또는 {error: ...}
    """
    MAX_ATTEMPTS = 3
    RETRY_SLEEP = 2

    def _is_permanent_error(exc):
        msg = str(exc).lower()
        return any(k in msg for k in ("404", "not found", "invalid", "종목코드"))

    # 날짜 범위: max(listing_date, delisting_date - 5y) ~ delisting_date
    # 5년 캡으로 데이터 볼륨 제한
    try:
        end_dt = datetime.strptime(delisting_date, "%Y-%m-%d")
    except ValueError:
        return {"error": f"Invalid delisting_date: {delisting_date}"}

    cap_start = end_dt - timedelta(days=5 * 365)
    if listing_date:
        try:
            list_dt = datetime.strptime(listing_date, "%Y-%m-%d")
            start_dt = max(list_dt, cap_start)
        except ValueError:
            start_dt = cap_start
    else:
        start_dt = cap_start

    start_str = start_dt.strftime("%Y%m%d")
    end_str = end_dt.strftime("%Y%m%d")

    # pykrx OHLCV 다운로드
    df = None
    last_exc = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            df = stock.get_market_ohlcv(start_str, end_str, code, adjusted=True)
            break
        except Exception as e:
            last_exc = e
            if _is_permanent_error(e):
                break
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(RETRY_SLEEP)

    if last_exc is not None and df is None:
        return {"error": str(last_exc)}

    try:
        candles = []
        if df is not None and not df.empty:
            for date_idx, row in df.iterrows():
                o = int(row["시가"])
                h = int(row["고가"])
                l = int(row["저가"])
                c = int(row["종가"])
                v = int(row["거래량"])

                # 가격 0 제외 (거래정지일)
                if o <= 0 or h <= 0 or l <= 0 or c <= 0:
                    continue

                candles.append({
                    "time": date_idx.strftime("%Y-%m-%d"),
                    "open": o, "high": h, "low": l, "close": c,
                    "volume": v
                })

        # 최소 50봉 필요 (backtester.js:92 기준)
        if len(candles) < 50:
            return {"error": f"insufficient candles ({len(candles)} < 50)"}

        # data/delisted/ 폴더에 저장
        os.makedirs(DELISTED_DIR, exist_ok=True)

        data = {
            "code": code,
            "name": name,
            "market": market,
            "timeframe": "1d",
            "count": len(candles),
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "candles": candles
        }

        filepath = os.path.join(DELISTED_DIR, f"{code}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        return {
            "code": code,
            "name": name,
            "market": market,
            "count": len(candles),
            "size_kb": round(os.path.getsize(filepath) / 1024, 1),
            "last_close": candles[-1]["close"],
            "file": f"delisted/{code}.json",
            "delistingDate": delisting_date,
        }

    except Exception as e:
        return {"error": str(e)}


def build_delisted_index(stocks_meta):
    """data/delisted_index.json 생성 — 백테스터에서 읽는 상폐 종목 인덱스

    Args:
        stocks_meta: download_delisted_stock()의 성공 반환값 리스트
    """
    # 상폐일 기준 최신순 정렬
    stocks_meta.sort(key=lambda s: s.get('delistingDate', ''), reverse=True)

    index = {
        "source": "pykrx + FDR KRX-DELISTING",
        "license": "개발용 (사업화 시 코스콤 전환 필요)",
        "purpose": "D-1 Survivorship Bias Correction (Elton, Gruber & Blake 1996)",
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "total": len(stocks_meta),
        "kospi": len([s for s in stocks_meta if s.get("market") == "KOSPI"]),
        "kosdaq": len([s for s in stocks_meta if s.get("market") == "KOSDAQ"]),
        "stocks": stocks_meta,
    }

    # 최초/최종 상폐일
    delist_dates = [s.get('delistingDate', '') for s in stocks_meta if s.get('delistingDate')]
    if delist_dates:
        index["min_delisting_date"] = min(delist_dates)
        index["max_delisting_date"] = max(delist_dates)

    filepath = os.path.join(DATA_DIR, "delisted_index.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    logger.info(f"  delisted_index.json 저장: {len(stocks_meta)}종목")
    return filepath


def main():
    parser = argparse.ArgumentParser(description="KRX 상장폐지 종목 OHLCV 다운로더 (D-1 Survivorship Bias)")
    parser.add_argument("--test", type=int, metavar="N",
                        help="타당성 검증 모드: 최근 상폐 N종목만 다운로드")
    parser.add_argument("--since", type=int, default=2015,
                        help="상폐 연도 하한 (기본: 2015)")
    parser.add_argument("--code", type=str, help="특정 종목 코드만")
    parser.add_argument("--delay", type=float, default=0.8,
                        help="요청 간 대기(초, 기본: 0.8)")
    parser.add_argument("--incremental", action="store_true",
                        help="기존 파일이 있으면 스킵")
    parser.add_argument("--cron", action="store_true",
                        help="무인 실행 모드 (로그 파일 출력)")
    args = parser.parse_args()

    # ── --cron 모드 ──
    if args.cron:
        log_dir = os.path.join(PROJECT_ROOT, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(
            log_dir,
            f"download_delisted_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
        ))
        logger.addHandler(file_handler)
        logger.removeHandler(_console_handler)
        logger.info(f"[CRON] 로그 파일: {log_file}")

    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(DELISTED_DIR, exist_ok=True)

    mode_tag = ''
    if args.cron:
        mode_tag += ' [CRON]'
    if args.incremental:
        mode_tag += ' [INCREMENTAL]'
    if args.test:
        mode_tag += f' [TEST {args.test}]'

    logger.info(f"═══════════════════════════════════════════")
    logger.info(f"  KRX 상폐 종목 OHLCV 다운로더{mode_tag}")
    logger.info(f"  상폐일 기준: {args.since}년 이후")
    logger.info(f"  저장: data/delisted/")
    logger.info(f"  학술 근거: Elton, Gruber & Blake (1996)")
    logger.info(f"═══════════════════════════════════════════")

    # ── 종목 리스트 ──
    if args.code:
        # 단일 종목 — FDR에서 메타 검색
        all_delisted = get_delisted_stocks(since_year=2000)
        targets = [s for s in all_delisted if s['code'] == args.code]
        if not targets:
            logger.error(f"  종목 코드 {args.code}를 FDR KRX-DELISTING에서 찾을 수 없습니다.")
            sys.exit(1)
        logger.info(f"  단일 종목: {targets[0]['name']}({args.code})")
    else:
        targets = get_delisted_stocks(since_year=args.since)

    if args.test:
        targets = targets[:args.test]
        logger.info(f"  테스트 모드: 최근 상폐 {len(targets)}종목만 처리")

    total = len(targets)
    logger.info(f"  대상: {total}종목")
    logger.info("")

    # ── 다운로드 루프 ──
    success = 0
    fail = 0
    skipped = 0
    success_meta = []  # build_delisted_index 입력용
    start_time = time.time()

    for i, s in enumerate(targets):
        code = s['code']
        name = s['name']
        market = s['market']
        listing_date = s.get('listingDate')
        delisting_date = s['delistingDate']

        # incremental: 기존 파일 있으면 스킵
        if args.incremental:
            existing_count = _get_existing_candle_count(code)
            if existing_count >= 50:
                skipped += 1
                success_meta.append({
                    "code": code, "name": name, "market": market,
                    "delistingDate": delisting_date,
                    "file": f"delisted/{code}.json",
                    "count": existing_count,
                    "lastClose": 0,
                })
                if (i + 1) % 50 == 0:
                    logger.info(f"  진행: {i+1}/{total} (스킵 {skipped})")
                continue

        result = download_delisted_stock(code, name, market, listing_date, delisting_date)

        if result and "error" not in result:
            success += 1
            success_meta.append(result)
            logger.info(f"  [{i+1}/{total}] {code} {name[:16]:<16s} "
                        f"폐지={delisting_date} 봉수={result['count']} "
                        f"크기={result['size_kb']}KB")
        elif result and "error" in result:
            fail += 1
            if "insufficient" not in result["error"]:
                # insufficient candles는 정상적인 스킵 — 에러 표시 불필요
                logger.warning(f"  [{i+1}/{total}] {code} {name[:16]:<16s} "
                               f"실패: {result['error'][:60]}")
            else:
                logger.info(f"  [{i+1}/{total}] {code} {name[:16]:<16s} "
                            f"스킵: {result['error']}")
        else:
            fail += 1

        time.sleep(args.delay)

    elapsed = time.time() - start_time

    # ── 인덱스 생성 ──
    if success_meta:
        build_delisted_index(success_meta)

    # ── 결과 요약 ──
    logger.info("")
    logger.info(f"═══════════════════════════════════════════")
    logger.info(f"  완료: {elapsed:.1f}초")
    logger.info(f"  성공: {success}, 실패: {fail}, 스킵: {skipped}")
    logger.info(f"  총 인덱스 종목: {len(success_meta)}")
    if success_meta:
        total_candles = sum(s.get('count', 0) for s in success_meta)
        logger.info(f"  총 캔들 수: {total_candles:,}")
    logger.info(f"═══════════════════════════════════════════")

    # --cron 실패율 체크
    if args.cron and total > 0:
        success_rate = (success + skipped) / total
        if success_rate < 0.5:
            logger.error(f"[CRON] 성공률 {success_rate:.1%} < 50% — 비정상 종료")
            sys.exit(1)


if __name__ == "__main__":
    main()
