"""
KOSPI/KOSDAQ 시장 지수 일봉 다운로더

데이터 소스: pykrx stock.get_index_ohlcv_by_date()
출력: data/market/kospi_daily.json, data/market/kosdaq_daily.json

CAPM beta 계산에 필요한 시장 수익률 데이터.
학술 근거: core_data/25_capm_delta_covariance.md §1.2

사용법:
  python scripts/download_market_index.py              # 기본 2년
  python scripts/download_market_index.py --years 3    # 3년치
"""

import sys
import os
import json
import argparse
from datetime import datetime, timedelta

try:
    from pykrx import stock
except ImportError:
    print("[ERROR] pykrx 필요: pip install pykrx")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "market")

# pykrx 내부 지수 티커
INDICES = {
    "kospi": "1001",   # KOSPI 종합
    "kosdaq": "2001",  # KOSDAQ 종합
}


def download_index(name, ticker, start, end):
    """지수 일봉 OHLCV 다운로드 → [{time, close}] 형식"""
    print(f"[{name.upper()}] {start} ~ {end} 다운로드 중...")
    df = stock.get_index_ohlcv_by_date(start, end, ticker)
    if df is None or df.empty:
        print(f"[{name.upper()}] 데이터 없음")
        return []

    records = []
    for date_idx, row in df.iterrows():
        date_str = date_idx.strftime("%Y-%m-%d")
        close = float(row["종가"]) if row["종가"] > 0 else None
        if close:
            records.append({"time": date_str, "close": close})

    print(f"[{name.upper()}] {len(records)}일 데이터 수집")
    return records


def main():
    parser = argparse.ArgumentParser(description="KRX 시장 지수 다운로더")
    parser.add_argument("--years", type=int, default=2, help="다운로드 기간 (년, 기본 2)")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    end = datetime.today().strftime("%Y%m%d")
    start = (datetime.today() - timedelta(days=args.years * 365)).strftime("%Y%m%d")

    for name, ticker in INDICES.items():
        records = download_index(name, ticker, start, end)
        if records:
            out_path = os.path.join(DATA_DIR, f"{name}_daily.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False)
            print(f"[{name.upper()}] 저장: {out_path} ({len(records)}건)")

    print("\n완료!")


if __name__ == "__main__":
    main()
