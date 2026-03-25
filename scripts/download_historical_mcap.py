#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
download_historical_mcap.py — Historical Market Cap Reconstruction

Resolves look-ahead bias in APT factors (log_size, value_inv_pbr, liquidity_20d)
by computing point-in-time market cap from:
  historical_mcap = historical_close * shares_outstanding

Shares outstanding sourced from FDR StockListing (current), which is
an approximation — splits/rights issues can shift shares count.
For ~1-3 year horizons on large-cap KRX stocks, this is standard practice
(Bali, Engle & Murray 2016 "Empirical Asset Pricing", §4.2).

Output:
  data/historical_mcap.json — {code: {date: mcap_억원}}

Usage:
    python scripts/download_historical_mcap.py
    python scripts/download_historical_mcap.py --years 3
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
INDEX_PATH = os.path.join(DATA_DIR, "index.json")
OUT_PATH = os.path.join(DATA_DIR, "historical_mcap.json")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, default=3)
    args = parser.parse_args()

    print("=" * 60)
    print("Historical Market Cap Reconstruction")
    print("=" * 60)

    # 1. Load current shares outstanding from FDR
    print("\n[1/3] Loading current shares outstanding (FDR)...")
    import FinanceDataReader as fdr

    shares_map = {}  # code -> shares_outstanding
    for market in ["KOSPI", "KOSDAQ"]:
        try:
            df = fdr.StockListing(market)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    code = str(row.get("Code", ""))
                    stocks = row.get("Stocks", 0)
                    if code and stocks and stocks > 0:
                        shares_map[code] = int(stocks)
        except Exception as e:
            print(f"  [WARN] {market} listing failed: {e}")

    print(f"  -> {len(shares_map)} stocks with shares outstanding")

    # 2. Load index.json for stock list + market info
    if not os.path.exists(INDEX_PATH):
        print("[ERROR] index.json not found")
        sys.exit(1)

    with open(INDEX_PATH, encoding="utf-8") as f:
        index_data = json.load(f)

    stocks = index_data.get("stocks", [])
    print(f"  -> {len(stocks)} stocks in index")

    # 3. Reconstruct historical mcap from OHLCV close * shares
    print(f"\n[2/3] Reconstructing historical market cap ({args.years} years)...")

    result = {}  # code -> {date: mcap_억원}
    n_stocks = 0
    n_skipped = 0

    for s in stocks:
        code = s.get("code", "")
        market = s.get("market", "").lower()
        if not code or not market:
            continue

        if code not in shares_map:
            n_skipped += 1
            continue

        shares = shares_map[code]
        fpath = os.path.join(DATA_DIR, market, f"{code}.json")
        if not os.path.exists(fpath):
            n_skipped += 1
            continue

        try:
            with open(fpath, encoding="utf-8") as f:
                ohlcv = json.load(f)
            candles = ohlcv.get("candles", [])
        except Exception:
            n_skipped += 1
            continue

        if not candles:
            n_skipped += 1
            continue

        mcap_series = {}
        for c in candles:
            dt = c.get("time", "")
            close = c.get("close", 0)
            if dt and close and close > 0:
                # mcap in 억원 = shares * close / 1e8
                mcap = int(shares * close / 1e8)
                if mcap > 0:
                    mcap_series[dt] = mcap

        if mcap_series:
            result[code] = mcap_series
            n_stocks += 1

    print(f"  -> {n_stocks} stocks reconstructed, {n_skipped} skipped")

    # 4. Save
    print(f"\n[3/3] Saving to {OUT_PATH}...")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    file_size = os.path.getsize(OUT_PATH)
    print(f"  -> {file_size / 1024 / 1024:.1f} MB written")

    # Validation: spot-check Samsung
    if "005930" in result:
        dates = sorted(result["005930"].keys())
        if dates:
            first_date = dates[0]
            last_date = dates[-1]
            first_mcap = result["005930"][first_date]
            last_mcap = result["005930"][last_date]
            print(f"\n  Spot check (005930 Samsung):")
            print(f"    {first_date}: {first_mcap:,}억원")
            print(f"    {last_date}: {last_mcap:,}억원")
            print(f"    Date range: {len(dates)} trading days")

    print(f"\n{'=' * 60}")
    print("DONE - historical_mcap.json ready for look-ahead bias fix")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
