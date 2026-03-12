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
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

from pykrx import stock
import FinanceDataReader as fdr

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")


def get_all_stocks():
    """KRX 전체 상장종목 리스트 (FinanceDataReader 사용, 재시도 포함)"""
    print("  종목 리스트 로딩 중...")

    for attempt in range(3):
        try:
            kospi = fdr.StockListing('KOSPI')
            kosdaq = fdr.StockListing('KOSDAQ')
            break
        except Exception as e:
            print(f"  ⚠ 종목 리스트 로드 실패 (시도 {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(3)
            else:
                raise

    stocks = []
    for _, row in kospi.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            stocks.append({"code": code, "name": name, "market": "KOSPI"})

    for _, row in kosdaq.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            stocks.append({"code": code, "name": name, "market": "KOSDAQ"})

    print(f"  KOSPI {len(kospi)}개 + KOSDAQ {len(kosdaq)}개 = {len(stocks)}개")
    return stocks


def download_stock(code, name, market, start_date, end_date, output_dir):
    """단일 종목 OHLCV 다운로드 → 시장별 폴더에 JSON 저장"""
    try:
        df = stock.get_market_ohlcv(start_date, end_date, code)

        if df.empty:
            return None

        candles = []
        for date_idx, row in df.iterrows():
            o = int(row["시가"])
            h = int(row["고가"])
            l = int(row["저가"])
            c = int(row["종가"])
            v = int(row["거래량"])

            if o <= 0 or h <= 0 or l <= 0 or c <= 0:
                continue

            candles.append({
                "time": date_idx.strftime("%Y-%m-%d"),
                "open": o, "high": h, "low": l, "close": c,
                "volume": v
            })

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
            "size_kb": os.path.getsize(filepath) / 1024,
            "last_close": candles[-1]["close"],
            "file": f"{market.lower()}/{code}.json"
        }

    except Exception as e:
        return {"error": str(e)}


def build_index(stocks_meta, start_date, end_date):
    """data/index.json 생성 — js/api.js에서 읽는 전체 종목 인덱스"""
    index = {
        "source": "pykrx (KRX)",
        "license": "개발용 (사업화 시 코스콤 전환 필요)",
        "period": f"{start_date}~{end_date}",
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "total": len(stocks_meta),
        "kospi": len([s for s in stocks_meta if s["market"] == "KOSPI"]),
        "kosdaq": len([s for s in stocks_meta if s["market"] == "KOSDAQ"]),
        "stocks": stocks_meta
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
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=args.years * 365)).strftime("%Y%m%d")

    print(f"═══════════════════════════════════════════")
    print(f"  KRX OHLCV 다운로더")
    print(f"  기간: {start_date} ~ {end_date} ({args.years}년)")
    print(f"  저장: data/kospi/, data/kosdaq/")
    print(f"═══════════════════════════════════════════")
    print()

    # ── 종목 리스트 가져오기 ──
    if args.code:
        # 단일 종목 모드
        name = stock.get_market_ticker_name(args.code) or args.code
        targets = [{"code": args.code, "name": name, "market": "KOSPI"}]
        print(f"  단일 종목: {name}({args.code})")
    else:
        targets = get_all_stocks()

        if args.market:
            targets = [s for s in targets if s["market"] == args.market]
            print(f"  필터: {args.market}만 ({len(targets)}개)")

        if args.top:
            targets = targets[:args.top]
            print(f"  필터: 상위 {args.top}개")

    print(f"\n── 다운로드 시작 ({len(targets)}개 종목) ──\n")

    success = 0
    fail = 0
    skip = 0
    stocks_meta = []
    start_time = time.time()

    for i, s in enumerate(targets):
        result = download_stock(s["code"], s["name"], s["market"], start_date, end_date, DATA_DIR)

        if result is None:
            skip += 1
        elif "error" in result:
            fail += 1
            if (i + 1) % 50 == 0 or fail <= 3:
                print(f"  ✗ [{i+1}/{len(targets)}] {s['name']}({s['code']}): {result['error']}")
        else:
            success += 1
            stocks_meta.append({
                "code": result["code"],
                "name": result["name"],
                "market": result["market"],
                "file": result["file"],
                "lastClose": result["last_close"]
            })
            # 진행률 표시 (50개마다 또는 처음 5개)
            if (i + 1) % 50 == 0 or i < 5:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(targets) - i - 1) / rate if rate > 0 else 0
                print(f"  ✓ [{i+1}/{len(targets)}] {s['name']}({s['code']}): "
                      f"{result['count']}봉 {result['size_kb']:.0f}KB "
                      f"| 남은 시간: {int(eta//60)}분 {int(eta%60)}초")

        # KRX 서버 부하 방지
        if i < len(targets) - 1:
            time.sleep(args.delay)

    # ── 인덱스 파일 생성 ──
    index_path = build_index(stocks_meta, start_date, end_date)

    # ── 용량 계산 ──
    total_size = 0
    for root, dirs, files in os.walk(DATA_DIR):
        for f in files:
            if f.endswith(".json"):
                total_size += os.path.getsize(os.path.join(root, f))

    elapsed = time.time() - start_time

    print(f"\n═══════════════════════════════════════════")
    print(f"  완료! ({int(elapsed//60)}분 {int(elapsed%60)}초 소요)")
    print(f"  성공: {success} | 실패: {fail} | 건너뜀: {skip}")
    print(f"  인덱스: {len(stocks_meta)}종목 (data/index.json)")
    print(f"  총 용량: {total_size / 1024 / 1024:.1f}MB")
    print(f"═══════════════════════════════════════════")


if __name__ == "__main__":
    main()
