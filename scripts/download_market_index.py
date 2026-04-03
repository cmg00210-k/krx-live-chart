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
sys.stdout.reconfigure(encoding='utf-8')
import os
import json
import argparse
from datetime import datetime, timedelta

HAS_FDR = False
HAS_PYKRX = False
try:
    import FinanceDataReader as fdr
    HAS_FDR = True
except ImportError:
    pass
try:
    from pykrx import stock as pykrx_stock
    HAS_PYKRX = True
except ImportError:
    pass

if not HAS_FDR and not HAS_PYKRX:
    print("[ERROR] FinanceDataReader or pykrx required: pip install FinanceDataReader pykrx")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "market")

# FDR 심볼 / pykrx 티커
INDICES = {
    "kospi":    {"fdr": "KS11",  "pykrx": "1001"},
    "kosdaq":   {"fdr": "KQ11",  "pykrx": "2001"},
    "kospi200": {"fdr": "KS200", "pykrx": "1028"},
}


def download_index_fdr(name, symbol, start, end):
    """FDR 경유 지수 다운로드 (primary)"""
    print(f"[{name.upper()}] FDR {symbol} {start} ~ {end} ...")
    df = fdr.DataReader(symbol, start, end)
    if df is None or df.empty:
        print(f"[{name.upper()}] FDR: no data")
        return []
    records = []
    for date_idx, row in df.iterrows():
        close = float(row["Close"]) if row["Close"] > 0 else None
        if close:
            records.append({"time": date_idx.strftime("%Y-%m-%d"), "close": close})
    print(f"[{name.upper()}] FDR: {len(records)} days")
    return records


def download_index_pykrx(name, ticker, start, end):
    """pykrx fallback"""
    print(f"[{name.upper()}] pykrx {ticker} {start} ~ {end} ...")
    try:
        df = pykrx_stock.get_index_ohlcv_by_date(start, end, ticker)
    except Exception as e:
        print(f"[{name.upper()}] pykrx error: {e}")
        return []
    if df is None or df.empty:
        return []
    records = []
    # pykrx column names may be Korean or English depending on version
    close_col = None
    for c in df.columns:
        if c in ("종가", "Close", "close"):
            close_col = c
            break
    if close_col is None:
        close_col = df.columns[3]  # OHLCV order: open, high, low, close
    for date_idx, row in df.iterrows():
        close = float(row[close_col]) if row[close_col] > 0 else None
        if close:
            records.append({"time": date_idx.strftime("%Y-%m-%d"), "close": close})
    print(f"[{name.upper()}] pykrx: {len(records)} days")
    return records


def download_index(name, info, start, end):
    """Try FDR first, fallback to pykrx"""
    records = []
    if HAS_FDR:
        records = download_index_fdr(name, info["fdr"], start, end)
    if not records and HAS_PYKRX:
        records = download_index_pykrx(name, info["pykrx"], start, end)
    if not records:
        print(f"[{name.upper()}] FAILED: no data from any source")
    return records


def main():
    parser = argparse.ArgumentParser(description="KRX 시장 지수 다운로더")
    parser.add_argument("--years", type=int, default=2, help="다운로드 기간 (년, 기본 2)")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    end = datetime.today().strftime("%Y%m%d")
    start = (datetime.today() - timedelta(days=args.years * 365)).strftime("%Y%m%d")

    for name, info in INDICES.items():
        records = download_index(name, info, start, end)
        if records:
            out_path = os.path.join(DATA_DIR, f"{name}_daily.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False)
            print(f"[{name.upper()}] 저장: {out_path} ({len(records)}건)")

    print("\n완료!")


if __name__ == "__main__":
    main()
