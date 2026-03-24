#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_context_features.py — Stage B-2: Context Feature Engineering for LinUCB

Computes 10-dimensional context features for each residual sample by joining
rl_residuals.csv with raw OHLCV data for accurate regime computation.

10-dim Context Design:
  Group A — Residual History (sequential per-stock):
    0. resid_sign:     sign of previous residual for same stock {-1, 0, +1}
    1. resid_mag_z:    |prev_residual| / rolling_std(20), clamped [0, 3]
    2. resid_run_len:  consecutive same-sign residual count / 5.0, clamped [0, 1]
  Group B — Regime (from OHLCV + predictions):
    3. ewma_vol:       EWMA volatility from OHLCV returns (lambda=0.94)
    4. pred_magnitude: |y_pred| / global_std(y_pred)
  Group C — Categorical:
    5. signal_dir:     +1 (buy), -1 (sell), 0 (neutral)
    6. market_type:    1 (KOSDAQ), 0 (KOSPI)
  Group D — Pattern Identity:
    7. pattern_tier:   remapped 1→-1, 2→0, 3→+1
    8. confidence_norm: confidence / 100 (already in CSV)
  Group E — OHLCV Regime:
    9. raw_hurst:      Hurst exponent via R/S analysis (80-bar window)

Output:
  data/backtest/rl_context.csv      — 199K rows, 10 context cols + metadata
  data/backtest/rl_context_stats.json — per-feature stats + correlation matrix

Academic Basis:
  - Hurst (1951): R/S analysis for trend persistence
  - Bollerslev (1986): EWMA volatility clustering
  - Li et al. (2010): LinUCB context design
  - Lo (2004): Adaptive Market Hypothesis — time-varying regime

Usage:
    python scripts/rl_context_features.py
"""

import csv
import json
import math
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import stats as sp_stats

ROOT = Path(__file__).resolve().parent.parent
BACKTEST_DIR = ROOT / "data" / "backtest"
DATA_DIR = ROOT / "data"
RESID_CSV = BACKTEST_DIR / "rl_residuals.csv"
OUT_CSV = BACKTEST_DIR / "rl_context.csv"
OUT_JSON = BACKTEST_DIR / "rl_context_stats.json"

CONTEXT_NAMES = [
    "resid_sign",       # 0
    "resid_mag_z",      # 1
    "resid_run_len",    # 2
    "ewma_vol",         # 3
    "pred_magnitude",   # 4
    "signal_dir",       # 5
    "market_type",      # 6
    "pattern_tier",     # 7
    "confidence_norm",  # 8
    "raw_hurst",        # 9
]

TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}  # invertedHammer: Tier-2 (52.3% win rate)
TIER3 = {"spinningTop", "doji", "fallingWedge"}


# ──────────────────────────────────────────────
# OHLCV Regime Computations (from raw candle data)
# ──────────────────────────────────────────────

def compute_hurst(closes, min_window=10):
    """Rescaled Range (R/S) analysis for Hurst exponent.
    Matches indicators.js calcHurst() logic.
    Returns H in [0, 1] or None if insufficient data.
    """
    n = len(closes)
    if n < min_window * 4:
        return None

    windows = []
    w = min_window
    while w <= n // 2:
        windows.append(int(w))
        w = int(w * 1.5)

    if len(windows) < 2:
        return None

    log_w = []
    log_rs = []

    for w in windows:
        n_blocks = n // w
        if n_blocks < 1:
            continue
        rs_vals = []
        for b in range(n_blocks):
            block = closes[b * w:(b + 1) * w]
            mean_b = np.mean(block)
            devs = np.cumsum(block - mean_b)
            R = np.max(devs) - np.min(devs)
            S = np.std(block, ddof=0)
            if S > 1e-10:
                rs_vals.append(R / S)
        if rs_vals:
            avg_rs = np.mean(rs_vals)
            if avg_rs > 0:
                log_w.append(np.log(w))
                log_rs.append(np.log(avg_rs))

    if len(log_w) < 2:
        return None

    lw = np.array(log_w)
    lr = np.array(log_rs)
    n_pts = len(lw)
    denom = n_pts * np.sum(lw ** 2) - np.sum(lw) ** 2
    if abs(denom) < 1e-15:
        return None
    H = (n_pts * np.sum(lw * lr) - np.sum(lw) * np.sum(lr)) / denom
    return float(np.clip(H, 0.0, 1.0))


def compute_ewma_vol(closes, lam=0.94):
    """EWMA volatility: sigma^2_t = lam * sigma^2_{t-1} + (1-lam) * r^2_t.
    Returns sqrt(sigma^2_t) at the last bar.
    Bollerslev (1986) GARCH(1,1) simplified.
    """
    n = len(closes)
    if n < 2:
        return None
    returns = np.diff(closes) / np.maximum(closes[:-1], 1e-10)
    var_t = returns[0] ** 2
    for i in range(1, len(returns)):
        var_t = lam * var_t + (1.0 - lam) * returns[i] ** 2
    return float(np.sqrt(max(var_t, 0.0)))


# ──────────────────────────────────────────────
# OHLCV Data Loading
# ──────────────────────────────────────────────

_ohlcv_cache = {}


def load_ohlcv(code, market):
    """Load OHLCV JSON for a stock, return candles list + date→index map."""
    key = f"{market}/{code}"
    if key in _ohlcv_cache:
        return _ohlcv_cache[key]

    path = DATA_DIR / market / f"{code}.json"
    if not path.exists():
        _ohlcv_cache[key] = (None, None)
        return None, None

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        candles = data.get("candles", [])
        date_map = {}
        for i, c in enumerate(candles):
            date_map[c["time"]] = i
        _ohlcv_cache[key] = (candles, date_map)
        return candles, date_map
    except Exception:
        _ohlcv_cache[key] = (None, None)
        return None, None


def get_ohlcv_features(code, market, date_str, lookback=80):
    """Compute OHLCV-based features at a given date.
    Returns (ewma_vol, raw_hurst) or (None, None) if insufficient data.
    """
    candles, date_map = load_ohlcv(code, market)
    if candles is None or date_str not in date_map:
        return None, None

    idx = date_map[date_str]
    if idx < lookback - 1:
        return None, None

    # Extract lookback window of closes
    window = candles[idx - lookback + 1:idx + 1]
    closes = np.array([c["close"] for c in window], dtype=np.float64)

    if len(closes) < lookback:
        return None, None

    ewma = compute_ewma_vol(closes)
    hurst = compute_hurst(closes)

    return ewma, hurst


# ──────────────────────────────────────────────
# Residual-based Feature Computation
# ──────────────────────────────────────────────

def compute_residual_features(stock_samples):
    """Compute sequential residual features for one stock's samples.
    Samples must be sorted by date.
    Returns list of (resid_sign, resid_mag_z, resid_run_len) per sample.
    """
    n = len(stock_samples)
    features = []

    # Rolling std of residuals (expanding window, min 5 samples)
    residuals_so_far = []
    prev_resid = None
    prev_sign = 0
    run_len = 0

    for i in range(n):
        resid = stock_samples[i]["residual"]

        if prev_resid is not None:
            resid_sign = 1.0 if prev_resid > 0 else (-1.0 if prev_resid < 0 else 0.0)
            # Rolling std from all prior residuals (expanding window)
            if len(residuals_so_far) >= 5:
                roll_std = np.std(residuals_so_far[-20:], ddof=1)
                resid_mag_z = abs(prev_resid) / max(roll_std, 1e-6)
            else:
                resid_mag_z = 0.0
            # Run length
            cur_sign = 1 if resid > 0 else (-1 if resid < 0 else 0)
            if cur_sign == prev_sign and cur_sign != 0:
                run_len += 1
            else:
                run_len = 1
            resid_run_len = min(run_len / 5.0, 1.0)
            prev_sign = cur_sign
        else:
            resid_sign = 0.0
            resid_mag_z = 0.0
            resid_run_len = 0.0
            prev_sign = 1 if resid > 0 else (-1 if resid < 0 else 0)
            run_len = 1

        features.append((resid_sign, resid_mag_z, resid_run_len))
        residuals_so_far.append(resid)
        prev_resid = resid

    return features


# ──────────────────────────────────────────────
# Main Pipeline
# ──────────────────────────────────────────────

def main():
    t0 = time.time()

    if not RESID_CSV.exists():
        print(f"[ERROR] {RESID_CSV} not found. Run rl_residuals.py first.")
        sys.exit(1)

    print("=" * 60)
    print("Stage B-2: Context Feature Engineering (10-dim)")
    print("=" * 60)

    # ── Step 1: Load residuals ──
    print("\n[1/5] Loading rl_residuals.csv...")
    rows = []
    with open(RESID_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "date": row["date"],
                "code": row["code"],
                "market": row["market"],
                "type": row["type"],
                "signal": row["signal"],
                "y_pred": float(row["y_pred"]),
                "y_actual": float(row["y_actual"]),
                "residual": float(row["residual"]),
                "wf_period": int(row["wf_period"]),
                "confidence_norm": float(row["confidence_norm"]),
                "hw": float(row["hw"]),
            })
    n_total = len(rows)
    print(f"  -> {n_total:,} samples loaded")

    # ── Step 2: Group by stock, compute residual features ──
    print("\n[2/5] Computing residual history features (per-stock sequential)...")
    by_stock = defaultdict(list)
    for i, r in enumerate(rows):
        by_stock[r["code"]].append((i, r))

    # Sort each stock's samples by date
    for code in by_stock:
        by_stock[code].sort(key=lambda x: x[1]["date"])

    resid_features = [None] * n_total  # (sign, mag_z, run_len) per sample
    for code, stock_items in by_stock.items():
        samples = [item[1] for item in stock_items]
        indices = [item[0] for item in stock_items]
        feats = compute_residual_features(samples)
        for j, idx in enumerate(indices):
            resid_features[idx] = feats[j]

    n_resid_ok = sum(1 for f in resid_features if f is not None)
    print(f"  -> {n_resid_ok:,}/{n_total:,} residual features computed")

    # ── Step 3: Compute OHLCV regime features ──
    print("\n[3/5] Computing OHLCV regime features (ewma_vol, raw_hurst)...")
    ohlcv_features = [None] * n_total  # (ewma_vol, raw_hurst)
    n_ohlcv_ok = 0
    n_ohlcv_miss = 0
    unique_stocks = set(r["code"] for r in rows)
    print(f"  -> {len(unique_stocks):,} unique stocks to load")

    progress_interval = max(1, n_total // 20)
    for i, r in enumerate(rows):
        if i % progress_interval == 0:
            pct = i / n_total * 100
            elapsed = time.time() - t0
            print(f"  -> {pct:.0f}% ({i:,}/{n_total:,}) elapsed={elapsed:.0f}s")

        ewma, hurst = get_ohlcv_features(r["code"], r["market"], r["date"])
        if ewma is not None and hurst is not None:
            ohlcv_features[i] = (ewma, hurst)
            n_ohlcv_ok += 1
        else:
            n_ohlcv_miss += 1

    print(f"  -> OHLCV features: {n_ohlcv_ok:,} OK, {n_ohlcv_miss:,} missing")

    # ── Step 4: Assemble 10-dim context ──
    print("\n[4/5] Assembling 10-dim context vectors...")

    # Global stats for normalization
    all_y_pred = np.array([r["y_pred"] for r in rows])
    pred_std = float(np.std(all_y_pred))
    if pred_std < 1e-10:
        pred_std = 1.0

    all_ewma = [ohlcv_features[i][0] for i in range(n_total) if ohlcv_features[i] is not None]
    ewma_mean = float(np.mean(all_ewma)) if all_ewma else 0.02
    ewma_std = float(np.std(all_ewma)) if all_ewma else 0.01

    all_hurst = [ohlcv_features[i][1] for i in range(n_total) if ohlcv_features[i] is not None]
    hurst_mean = float(np.mean(all_hurst)) if all_hurst else 0.5
    hurst_std = float(np.std(all_hurst)) if all_hurst else 0.1

    contexts = np.zeros((n_total, 10))
    n_complete = 0

    for i, r in enumerate(rows):
        rf = resid_features[i]
        of = ohlcv_features[i]

        # Dim 0-2: Residual history
        if rf is not None:
            contexts[i, 0] = rf[0]  # resid_sign
            contexts[i, 1] = min(rf[1], 3.0)  # resid_mag_z, pre-clamp
            contexts[i, 2] = rf[2]  # resid_run_len
        # else: 0.0 (default)

        # Dim 3: ewma_vol (z-scored)
        if of is not None:
            contexts[i, 3] = (of[0] - ewma_mean) / max(ewma_std, 1e-6)
        # else: 0.0

        # Dim 4: pred_magnitude
        contexts[i, 4] = abs(r["y_pred"]) / pred_std

        # Dim 5: signal_dir
        sig = r["signal"]
        contexts[i, 5] = 1.0 if sig == "buy" else (-1.0 if sig == "sell" else 0.0)

        # Dim 6: market_type
        contexts[i, 6] = 1.0 if r["market"] == "kosdaq" else 0.0

        # Dim 7: pattern_tier (remapped: tier1→-1, tier2→0, tier3→+1)
        ptype = r["type"]
        if ptype in TIER1:
            contexts[i, 7] = -1.0
        elif ptype in TIER3:
            contexts[i, 7] = 1.0
        # else: 0.0 (tier2 / unknown)

        # Dim 8: confidence_norm (already [0,1])
        contexts[i, 8] = r["confidence_norm"]

        # Dim 9: raw_hurst (z-scored)
        if of is not None:
            contexts[i, 9] = (of[1] - hurst_mean) / max(hurst_std, 1e-6)
        # else: 0.0

        if rf is not None and of is not None:
            n_complete += 1

    # Final clamp all to [-3, +3]
    contexts = np.clip(contexts, -3.0, 3.0)

    print(f"  -> Complete samples (all features): {n_complete:,}/{n_total:,} "
          f"({n_complete / n_total * 100:.1f}%)")

    # ── Step 5: Save outputs ──
    print("\n[5/5] Saving outputs...")

    # CSV
    csv_header = (
        ["date", "code", "market", "type", "signal",
         "y_pred", "y_actual", "residual", "wf_period"]
        + CONTEXT_NAMES
    )
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(csv_header)
        for i, r in enumerate(rows):
            row = [
                r["date"], r["code"], r["market"], r["type"], r["signal"],
                f"{r['y_pred']:.6f}", f"{r['y_actual']:.6f}",
                f"{r['residual']:.6f}", r["wf_period"],
            ] + [f"{contexts[i, j]:.6f}" for j in range(10)]
            writer.writerow(row)
    print(f"  -> CSV: {OUT_CSV} ({n_total:,} rows)")

    # Stats JSON
    stats = {"n_samples": n_total, "n_complete": n_complete}
    per_feature = {}
    corr_matrix = np.corrcoef(contexts.T)
    for j, name in enumerate(CONTEXT_NAMES):
        col = contexts[:, j]
        per_feature[name] = {
            "mean": round(float(np.mean(col)), 6),
            "std": round(float(np.std(col, ddof=1)), 6),
            "min": round(float(np.min(col)), 4),
            "max": round(float(np.max(col)), 4),
            "pct_zero": round(float(np.mean(np.abs(col) < 1e-8) * 100), 1),
        }
    stats["features"] = per_feature

    # Correlation with residual (target relevance check)
    residuals = np.array([r["residual"] for r in rows])
    feature_residual_corr = {}
    for j, name in enumerate(CONTEXT_NAMES):
        corr, pval = sp_stats.spearmanr(contexts[:, j], residuals)
        if np.isfinite(corr):
            feature_residual_corr[name] = {
                "spearman_r": round(float(corr), 6),
                "p_value": round(float(pval), 6),
            }
    stats["feature_residual_correlation"] = feature_residual_corr

    # Feature-feature correlation matrix
    corr_dict = {}
    for j1, n1 in enumerate(CONTEXT_NAMES):
        for j2, n2 in enumerate(CONTEXT_NAMES):
            if j2 > j1:
                val = float(corr_matrix[j1, j2])
                if abs(val) > 0.3:
                    corr_dict[f"{n1}_x_{n2}"] = round(val, 4)
    stats["high_correlations"] = corr_dict

    stats["normalization"] = {
        "ewma_vol": {"mean": round(ewma_mean, 6), "std": round(ewma_std, 6)},
        "raw_hurst": {"mean": round(hurst_mean, 6), "std": round(hurst_std, 6)},
        "pred_std": round(pred_std, 6),
    }

    elapsed = time.time() - t0
    stats["elapsed_seconds"] = round(elapsed, 1)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"  -> JSON: {OUT_JSON}")

    # Summary
    print(f"\n{'=' * 60}")
    print("CONTEXT FEATURE SUMMARY")
    print(f"{'=' * 60}")
    print(f"  {'Feature':<20} {'Mean':>8} {'Std':>8} {'%Zero':>8} {'Corr(resid)':>12}")
    for name in CONTEXT_NAMES:
        pf = per_feature[name]
        fr = feature_residual_corr.get(name, {})
        corr_val = fr.get("spearman_r", float("nan"))
        print(f"  {name:<20} {pf['mean']:>8.4f} {pf['std']:>8.4f} "
              f"{pf['pct_zero']:>7.1f}% {corr_val:>11.4f}")

    if corr_dict:
        print(f"\n  High feature-feature correlations (|r|>0.3):")
        for pair, val in sorted(corr_dict.items(), key=lambda x: -abs(x[1])):
            print(f"    {pair}: {val}")

    print(f"\n  Total time: {elapsed:.1f}s")
    print("  Done.")


if __name__ == "__main__":
    main()
