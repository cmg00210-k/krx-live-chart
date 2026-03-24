#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_residuals.py — Stage B-1: Walk-Forward MRA Residual Extraction Pipeline

Extracts per-sample residuals from the 12-col Ridge MRA using strict walk-forward:
  - 60-day train, 20-day test windows (no overlap, no look-ahead)
  - Ridge lambda=2.0 (from Stage A-1 optimal)
  - Each test sample gets: y_predicted, y_actual, residual = y_actual - y_predicted

Output:
  data/backtest/rl_residuals.csv     — per-sample residuals with metadata + features
  data/backtest/rl_residuals_summary.json — distribution stats, buy/sell breakdown, autocorr

References:
  - Stage A-1: mra_extended.py (IC 0.057, Ridge lambda=2.0)
  - Stage B plan: project_stage_b_rl_plan.md (LinUCB input)
  - Li et al. (2010) LinUCB, core_data/11_RL §7.3

Usage:
    python scripts/rl_residuals.py
    python scripts/rl_residuals.py --horizon 5       (default: 5)
    python scripts/rl_residuals.py --train-days 60   (default: 60)
    python scripts/rl_residuals.py --test-days 20    (default: 20)
    python scripts/rl_residuals.py --lambda 2.0      (default: 2.0)
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
CSV_PATH = BACKTEST_DIR / "wc_return_pairs.csv"
OUT_CSV = BACKTEST_DIR / "rl_residuals.csv"
OUT_JSON = BACKTEST_DIR / "rl_residuals_summary.json"

# Tier classification (from Stage A-1 / Phase A findings)
TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

# 12 feature names (same as mra_extended.py)
FEATURE_NAMES = [
    "hw", "vw", "mw", "rw", "confidence_norm", "signal_dir",
    "market_type", "log_confidence", "pattern_tier",
    "hw_x_signal", "vw_x_signal", "conf_x_signal",
]


# ──────────────────────────────────────────────
# Data Loading + Feature Engineering (reused from mra_extended.py)
# ──────────────────────────────────────────────

def load_and_engineer(horizon):
    """Load CSV, derive 6 new features, return X (n x 12), y (n,), dates[], meta[]."""
    col = f"ret_{horizon}"
    rows = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            val = row.get(col)
            if not val or val == "":
                continue
            try:
                ret = float(val)
                hw = float(row["hw"]) if row.get("hw") else 1.0
                vw = float(row["vw"]) if row.get("vw") else 1.0
                mw = float(row["mw"]) if row.get("mw") else 1.0
                rw = float(row["rw"]) if row.get("rw") else 1.0
                conf = float(row["confidence"]) if row.get("confidence") else 50.0
            except ValueError:
                continue

            signal = row.get("signal", "neutral")
            sig_dir = 1.0 if signal == "buy" else (-1.0 if signal == "sell" else 0.0)

            market = row.get("market", "")
            mkt_type = 1.0 if market == "kosdaq" else 0.0

            ptype = row.get("type", "")
            if ptype in TIER1:
                tier = 1.0
            elif ptype in TIER2:
                tier = 2.0
            elif ptype in TIER3:
                tier = 3.0
            else:
                tier = 2.0

            log_conf = math.log(max(conf, 1.0))
            conf_norm = conf / 100.0

            rows.append({
                "hw": hw, "vw": vw, "mw": mw, "rw": rw,
                "confidence_norm": conf_norm,
                "signal_dir": sig_dir,
                "market_type": mkt_type,
                "log_confidence": log_conf,
                "pattern_tier": tier,
                "hw_x_signal": hw * sig_dir,
                "vw_x_signal": vw * sig_dir,
                "conf_x_signal": conf_norm * sig_dir,
                "ret": ret,
                "date": row.get("date", ""),
                "code": row.get("code", ""),
                "type": ptype,
                "signal": signal,
                "market": market,
            })

    n = len(rows)
    X = np.zeros((n, len(FEATURE_NAMES)))
    y = np.zeros(n)
    dates = []
    meta = []

    for i, r in enumerate(rows):
        for j, fname in enumerate(FEATURE_NAMES):
            X[i, j] = r[fname]
        y[i] = r["ret"]
        dates.append(r["date"])
        meta.append({
            "code": r["code"],
            "type": r["type"],
            "signal": r["signal"],
            "market": r["market"],
        })

    return X, y, dates, meta


# ──────────────────────────────────────────────
# Ridge Regression (closed-form, same as mra_extended.py)
# ──────────────────────────────────────────────

def ridge_fit(X, y, lam):
    """Ridge: beta = (X'X + lambda*I)^-1 X'y (intercept unpenalized)"""
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    XtX = X1.T @ X1
    penalty = lam * np.eye(p + 1)
    penalty[0, 0] = 0
    beta = np.linalg.solve(XtX + penalty, X1.T @ y)
    return beta


def predict(X, beta):
    """Predict with intercept."""
    n = X.shape[0]
    X1 = np.column_stack([np.ones(n), X])
    return X1 @ beta


# ──────────────────────────────────────────────
# Walk-Forward Residual Extraction (core of B-1)
# ──────────────────────────────────────────────

def walk_forward_residuals(X, y, dates, meta, train_days=60, test_days=20, lam=2.0):
    """
    Strict walk-forward: train on T days, predict next T' days.
    Returns per-sample residuals with full metadata.

    No overlap, no look-ahead. Each sample appears in exactly one test window.
    """
    unique_dates = sorted(set(dates))
    date_to_idx = defaultdict(list)
    for i, d in enumerate(dates):
        date_to_idx[d].append(i)

    n_dates = len(unique_dates)
    residuals = []
    period_stats = []
    period_id = 0
    start = 0

    while start + train_days + test_days <= n_dates:
        train_dates = unique_dates[start:start + train_days]
        test_dates = unique_dates[start + train_days:start + train_days + test_days]

        train_idx = []
        for d in train_dates:
            train_idx.extend(date_to_idx[d])
        test_idx = []
        for d in test_dates:
            test_idx.extend(date_to_idx[d])

        if len(train_idx) < 100 or len(test_idx) < 30:
            start += test_days
            continue

        X_tr, y_tr = X[train_idx], y[train_idx]
        X_te, y_te = X[test_idx], y[test_idx]

        beta = ridge_fit(X_tr, y_tr, lam)
        y_hat = predict(X_te, beta)
        resid = y_te - y_hat

        # Per-period IC
        ic = float('nan')
        if np.std(y_hat) > 1e-10 and np.std(y_te) > 1e-10:
            corr, _ = sp_stats.spearmanr(y_hat, y_te)
            if np.isfinite(corr):
                ic = float(corr)

        period_label = f"{test_dates[0]}~{test_dates[-1]}"

        # Store per-sample residuals
        for k, idx in enumerate(test_idx):
            residuals.append({
                "idx": idx,
                "date": dates[idx],
                "code": meta[idx]["code"],
                "market": meta[idx]["market"],
                "type": meta[idx]["type"],
                "signal": meta[idx]["signal"],
                "y_pred": float(y_hat[k]),
                "y_actual": float(y_te[k]),
                "residual": float(resid[k]),
                "wf_period": period_id,
                "wf_label": period_label,
                # Features for context engineering (B-2)
                "features": X[idx].tolist(),
            })

        period_stats.append({
            "period_id": period_id,
            "label": period_label,
            "n_train": len(train_idx),
            "n_test": len(test_idx),
            "ic": round(ic, 6) if np.isfinite(ic) else None,
            "mean_resid": round(float(np.mean(resid)), 6),
            "std_resid": round(float(np.std(resid)), 6),
            "beta": beta.tolist(),
        })

        period_id += 1
        start += test_days

    return residuals, period_stats


# ──────────────────────────────────────────────
# Residual Analysis
# ──────────────────────────────────────────────

def analyze_residuals(residuals, period_stats):
    """Compute summary statistics on the residual distribution."""
    resid_arr = np.array([r["residual"] for r in residuals])
    y_pred_arr = np.array([r["y_pred"] for r in residuals])
    y_actual_arr = np.array([r["y_actual"] for r in residuals])
    n = len(resid_arr)

    # Overall distribution
    dist = {
        "n": n,
        "mean": round(float(np.mean(resid_arr)), 6),
        "std": round(float(np.std(resid_arr, ddof=1)), 6),
        "median": round(float(np.median(resid_arr)), 6),
        "skewness": round(float(sp_stats.skew(resid_arr)), 4),
        "kurtosis": round(float(sp_stats.kurtosis(resid_arr)), 4),
        "min": round(float(np.min(resid_arr)), 4),
        "max": round(float(np.max(resid_arr)), 4),
        "pct_1": round(float(np.percentile(resid_arr, 1)), 4),
        "pct_5": round(float(np.percentile(resid_arr, 5)), 4),
        "pct_25": round(float(np.percentile(resid_arr, 25)), 4),
        "pct_75": round(float(np.percentile(resid_arr, 75)), 4),
        "pct_95": round(float(np.percentile(resid_arr, 95)), 4),
        "pct_99": round(float(np.percentile(resid_arr, 99)), 4),
    }

    # Overall IC check (should match A-1)
    overall_ic = None
    if np.std(y_pred_arr) > 1e-10:
        corr, pval = sp_stats.spearmanr(y_pred_arr, y_actual_arr)
        if np.isfinite(corr):
            overall_ic = {"ic": round(float(corr), 6), "p_value": round(float(pval), 6)}

    # Walk-forward IC summary
    wf_ics = [p["ic"] for p in period_stats if p["ic"] is not None]
    wf_summary = None
    if wf_ics:
        ics = np.array(wf_ics)
        mean_ic = float(np.mean(ics))
        std_ic = float(np.std(ics, ddof=1)) if len(ics) > 1 else 0.0
        t_stat = mean_ic / (std_ic / np.sqrt(len(ics))) if std_ic > 0 else 0.0
        wf_summary = {
            "n_periods": len(ics),
            "mean_ic": round(mean_ic, 6),
            "std_ic": round(std_ic, 6),
            "t_stat": round(t_stat, 4),
            "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
        }

    # By signal direction
    by_signal = {}
    for sig_name in ["buy", "sell", "neutral"]:
        mask = np.array([r["signal"] == sig_name for r in residuals])
        if np.sum(mask) < 30:
            continue
        sig_resid = resid_arr[mask]
        sig_pred = y_pred_arr[mask]
        sig_actual = y_actual_arr[mask]
        sig_ic = None
        if np.std(sig_pred) > 1e-10 and np.std(sig_actual) > 1e-10:
            corr, pval = sp_stats.spearmanr(sig_pred, sig_actual)
            if np.isfinite(corr):
                sig_ic = round(float(corr), 6)
        by_signal[sig_name] = {
            "n": int(np.sum(mask)),
            "mean_resid": round(float(np.mean(sig_resid)), 6),
            "std_resid": round(float(np.std(sig_resid, ddof=1)), 6),
            "skewness": round(float(sp_stats.skew(sig_resid)), 4),
            "kurtosis": round(float(sp_stats.kurtosis(sig_resid)), 4),
            "ic": sig_ic,
        }

    # By market
    by_market = {}
    for mkt in ["kospi", "kosdaq"]:
        mask = np.array([r["market"] == mkt for r in residuals])
        if np.sum(mask) < 30:
            continue
        mkt_resid = resid_arr[mask]
        by_market[mkt] = {
            "n": int(np.sum(mask)),
            "mean_resid": round(float(np.mean(mkt_resid)), 6),
            "std_resid": round(float(np.std(mkt_resid, ddof=1)), 6),
            "kurtosis": round(float(sp_stats.kurtosis(mkt_resid)), 4),
        }

    # By pattern tier
    by_tier = {}
    for tier_name, tier_set in [("tier1", TIER1), ("tier2", TIER2), ("tier3", TIER3)]:
        mask = np.array([r["type"] in tier_set for r in residuals])
        if np.sum(mask) < 30:
            continue
        tier_resid = resid_arr[mask]
        tier_pred = y_pred_arr[mask]
        tier_actual = y_actual_arr[mask]
        tier_ic = None
        if np.std(tier_pred) > 1e-10 and np.std(tier_actual) > 1e-10:
            corr, _ = sp_stats.spearmanr(tier_pred, tier_actual)
            if np.isfinite(corr):
                tier_ic = round(float(corr), 6)
        by_tier[tier_name] = {
            "n": int(np.sum(mask)),
            "mean_resid": round(float(np.mean(tier_resid)), 6),
            "std_resid": round(float(np.std(tier_resid, ddof=1)), 6),
            "kurtosis": round(float(sp_stats.kurtosis(tier_resid)), 4),
            "ic": tier_ic,
        }

    # Residual autocorrelation (lag 1~5) — important for regime detection in B-2
    autocorr = {}
    for lag in [1, 2, 3, 5, 10]:
        if n > lag + 30:
            corr, pval = sp_stats.spearmanr(resid_arr[:-lag], resid_arr[lag:])
            if np.isfinite(corr):
                autocorr[f"lag_{lag}"] = {
                    "corr": round(float(corr), 6),
                    "p_value": round(float(pval), 6),
                }

    # Residual sign persistence (consecutive same-sign runs)
    signs = np.sign(resid_arr)
    runs = []
    current_run = 1
    for i in range(1, len(signs)):
        if signs[i] == signs[i - 1]:
            current_run += 1
        else:
            runs.append(current_run)
            current_run = 1
    runs.append(current_run)
    runs_arr = np.array(runs)
    sign_persistence = {
        "mean_run_length": round(float(np.mean(runs_arr)), 4),
        "max_run_length": int(np.max(runs_arr)),
        "pct_positive": round(float(np.mean(signs > 0) * 100), 1),
    }

    return {
        "distribution": dist,
        "overall_ic": overall_ic,
        "walk_forward": wf_summary,
        "by_signal": by_signal,
        "by_market": by_market,
        "by_tier": by_tier,
        "autocorrelation": autocorr,
        "sign_persistence": sign_persistence,
    }


# ──────────────────────────────────────────────
# JSON serialization helper
# ──────────────────────────────────────────────

def _to_native(obj):
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main():
    t0 = time.time()
    args = sys.argv[1:]
    horizon = 5
    train_days = 60
    test_days = 20
    lam = 2.0

    i = 0
    while i < len(args):
        if args[i] == "--horizon" and i + 1 < len(args):
            horizon = int(args[i + 1]); i += 2
        elif args[i] == "--train-days" and i + 1 < len(args):
            train_days = int(args[i + 1]); i += 2
        elif args[i] == "--test-days" and i + 1 < len(args):
            test_days = int(args[i + 1]); i += 2
        elif args[i] == "--lambda" and i + 1 < len(args):
            lam = float(args[i + 1]); i += 2
        else:
            i += 1

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest first.")
        sys.exit(1)

    print("=" * 60)
    print("Stage B-1: Walk-Forward MRA Residual Extraction")
    print("=" * 60)
    print(f"  horizon={horizon}, train={train_days}d, test={test_days}d, lambda={lam}")

    # ── Step 1: Load + Feature Engineering ──
    print(f"\n[1/4] Loading CSV + engineering 12 features...")
    X, y, dates, meta = load_and_engineer(horizon)
    n, p = X.shape
    print(f"  -> {n:,} samples, {p} features, {len(set(dates))} unique dates")

    # ── Step 2: Walk-Forward Residual Extraction ──
    print(f"\n[2/4] Walk-Forward residual extraction...")
    residuals, period_stats = walk_forward_residuals(
        X, y, dates, meta,
        train_days=train_days,
        test_days=test_days,
        lam=lam,
    )
    print(f"  -> {len(residuals):,} residual samples from {len(period_stats)} periods")
    if residuals:
        coverage = len(residuals) / n * 100
        print(f"  -> Coverage: {coverage:.1f}% of total samples")

    # ── Step 3: Analyze Residuals ──
    print(f"\n[3/4] Analyzing residual distribution...")
    analysis = analyze_residuals(residuals, period_stats)

    dist = analysis["distribution"]
    print(f"  -> Mean: {dist['mean']}, Std: {dist['std']}")
    print(f"  -> Skewness: {dist['skewness']}, Kurtosis: {dist['kurtosis']}")
    print(f"  -> Range: [{dist['min']}, {dist['max']}]")

    if analysis["walk_forward"]:
        wf = analysis["walk_forward"]
        print(f"  -> WF IC: mean={wf['mean_ic']}, t={wf['t_stat']}, positive={wf['ic_positive_pct']}%")

    print(f"\n  By Signal:")
    for sig, stats in analysis["by_signal"].items():
        print(f"    {sig:>8}: n={stats['n']:>6,}, mean_resid={stats['mean_resid']:>8.4f}, "
              f"kurtosis={stats['kurtosis']:>6.1f}, IC={stats['ic']}")

    if analysis["autocorrelation"]:
        print(f"\n  Autocorrelation:")
        for lag, ac in analysis["autocorrelation"].items():
            sig = "***" if ac["p_value"] < 0.001 else "**" if ac["p_value"] < 0.01 else "*" if ac["p_value"] < 0.05 else ""
            print(f"    {lag}: r={ac['corr']:>8.4f} (p={ac['p_value']:.4f}) {sig}")

    print(f"\n  Sign Persistence:")
    sp = analysis["sign_persistence"]
    print(f"    mean_run={sp['mean_run_length']:.2f}, max_run={sp['max_run_length']}, "
          f"pct_positive={sp['pct_positive']}%")

    # ── Step 4: Save Outputs ──
    print(f"\n[4/4] Saving outputs...")

    # CSV: per-sample residuals (without features array for readability; features in separate columns)
    csv_header = (
        ["date", "code", "market", "type", "signal",
         "y_pred", "y_actual", "residual", "wf_period", "wf_label"]
        + FEATURE_NAMES
    )
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(csv_header)
        for r in residuals:
            row = [
                r["date"], r["code"], r["market"], r["type"], r["signal"],
                f"{r['y_pred']:.6f}", f"{r['y_actual']:.6f}", f"{r['residual']:.6f}",
                r["wf_period"], r["wf_label"],
            ] + [f"{v:.6f}" for v in r["features"]]
            writer.writerow(row)
    print(f"  -> CSV: {OUT_CSV} ({len(residuals):,} rows)")

    # JSON: summary + period stats
    summary = _to_native({
        "config": {
            "horizon": horizon,
            "train_days": train_days,
            "test_days": test_days,
            "ridge_lambda": lam,
            "n_features": p,
            "feature_names": FEATURE_NAMES,
        },
        "analysis": analysis,
        "period_stats": [{k: v for k, v in ps.items() if k != "beta"} for ps in period_stats],
        "period_betas": {
            ps["period_id"]: {
                "label": ps["label"],
                "coefficients": {
                    name: round(float(ps["beta"][j]), 6)
                    for j, name in enumerate(["intercept"] + FEATURE_NAMES)
                },
            }
            for ps in period_stats
        },
        "elapsed_seconds": round(time.time() - t0, 1),
    })
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"  -> JSON: {OUT_JSON}")

    elapsed = time.time() - t0
    print(f"\n  Total time: {elapsed:.1f}s")
    print("  Done.")


if __name__ == "__main__":
    main()
