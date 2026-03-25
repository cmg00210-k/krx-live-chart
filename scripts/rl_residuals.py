#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_residuals.py — Stage B-1: Walk-Forward MRA Residual Extraction Pipeline

Extracts per-sample residuals from the 20-col Ridge MRA using strict walk-forward:
  - 60-day train, 20-day test windows (no overlap, no look-ahead)
  - Ridge lambda=2.0 (from Stage A-1 optimal)
  - 12 original features + 5 APT factors (Phase 4-1)
  - Each test sample gets: y_predicted, y_actual, residual = y_actual - y_predicted

APT Factors (Phase 4-1, Ross 1976):
  12. momentum_60d   — 60-day return (Jegadeesh & Titman 1993)
  13. beta_60d       — rolling beta vs market (Sharpe 1964)
  14. value_inv_pbr  — 1/PBR (Fama & French 1993)
  15. log_size       — log(marketCap) (Fama & French 1993)
  16. liquidity_20d  — 20-day avg turnover (Amihud 2002)

Output:
  data/backtest/rl_residuals.csv     — per-sample residuals with metadata + features
  data/backtest/rl_residuals_summary.json — distribution stats, buy/sell breakdown, autocorr

References:
  - Stage A-1: mra_extended.py (IC 0.057, Ridge lambda=2.0)
  - Phase 4-1: mra_apt_extended.py (IC 0.100, +0.043 OOS)
  - Stage B plan: project_stage_b_rl_plan.md (LinUCB input)
  - Li et al. (2010) LinUCB, core_data/11_RL §7.3

Usage:
    python scripts/rl_residuals.py
    python scripts/rl_residuals.py --horizon 5       (default: 5)
    python scripts/rl_residuals.py --train-days 60   (default: 60)
    python scripts/rl_residuals.py --test-days 20    (default: 20)
    python scripts/rl_residuals.py --lambda 2.0      (default: 2.0)
    python scripts/rl_residuals.py --12col            (use 12-col only, skip APT)
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
CSV_PATH = BACKTEST_DIR / "wc_return_pairs.csv"
INDEX_PATH = DATA_DIR / "index.json"
FIN_DIR = DATA_DIR / "financials"
OUT_CSV = BACKTEST_DIR / "rl_residuals.csv"
OUT_JSON = BACKTEST_DIR / "rl_residuals_summary.json"

# Tier classification (from Stage A-1 / Phase A findings)
TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

# 12 original feature names (Stage A-1)
FEATURE_NAMES_12 = [
    "hw", "vw", "mw", "rw", "confidence_norm", "signal_dir",
    "market_type", "log_confidence", "pattern_tier",
    "hw_x_signal", "vw_x_signal", "conf_x_signal",
]

# 5 APT factors (Phase 4-1) + 3 short-term momentum (Phase 5-2)
APT_NAMES = [
    "momentum_60d", "beta_60d", "value_inv_pbr", "log_size", "liquidity_20d",
    "stock_ret_5d", "market_ret_0d", "market_ret_5d",
]

# Full 20 features (default)
FEATURE_NAMES = FEATURE_NAMES_12 + APT_NAMES


# ──────────────────────────────────────────────
# APT Factor Loading (Phase 4-1)
# ──────────────────────────────────────────────

def _load_index():
    """Load index.json → {code: {marketCap, market}}."""
    if not INDEX_PATH.exists():
        return {}
    with open(INDEX_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {s["code"]: {"marketCap": s.get("marketCap", 0), "market": s.get("market", "").lower()}
            for s in data["stocks"]}


def _load_financials():
    """Load financials → {code: total_equity}."""
    result = {}
    if not FIN_DIR.exists():
        return result
    for fp in FIN_DIR.glob("*.json"):
        try:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            annual = d.get("annual")
            if annual and isinstance(annual, list):
                for a in annual:
                    eq = a.get("total_equity")
                    if eq and eq > 0:
                        result[d["code"]] = eq
                        break
        except Exception:
            pass
    return result


def _load_ohlcv_all(index_info):
    """Load all OHLCV → {code: [(date, close, volume), ...]}."""
    ohlcv = {}
    for code, info in index_info.items():
        market = info["market"]
        if not market:
            continue
        fpath = DATA_DIR / market / f"{code}.json"
        if not fpath.exists():
            continue
        try:
            with open(fpath, encoding="utf-8") as f:
                d = json.load(f)
            candles = d.get("candles", [])
            if len(candles) < 10:
                continue
            series = [(c["time"], c["close"], c.get("volume", 0))
                      for c in candles if c.get("time") and c.get("close", 0) > 0]
            if series:
                ohlcv[code] = series
        except Exception:
            pass
    return ohlcv


def _compute_market_returns(ohlcv, index_info, top_n=100):
    """Cap-weighted daily market return from top N stocks."""
    sorted_stocks = sorted(
        [(code, index_info[code]["marketCap"]) for code in ohlcv if code in index_info],
        key=lambda x: -x[1]
    )[:top_n]
    top_codes = [s[0] for s in sorted_stocks]
    top_caps = np.array([s[1] for s in sorted_stocks], dtype=np.float64)
    total_cap = top_caps.sum() or 1.0
    weights = top_caps / total_cap

    code_closes = {}
    all_dates = set()
    for code in top_codes:
        closes = {}
        for dt, cl, _ in ohlcv[code]:
            closes[dt] = cl
            all_dates.add(dt)
        code_closes[code] = closes

    mkt_returns = {}
    prev_closes = [0.0] * len(top_codes)
    for dt in sorted(all_dates):
        w_ret = 0.0
        w_sum = 0.0
        for i, code in enumerate(top_codes):
            cl = code_closes[code].get(dt)
            if cl is not None and cl > 0:
                if prev_closes[i] > 0:
                    ret = (cl - prev_closes[i]) / prev_closes[i]
                    w_ret += weights[i] * ret
                    w_sum += weights[i]
                prev_closes[i] = cl
        if w_sum > 0.3:
            mkt_returns[dt] = w_ret
    return mkt_returns


def _compute_apt_factors(rows, ohlcv, mkt_returns, index_info, financials):
    """Compute 8 APT factors per sample. Returns np.array (n, 8) with NaN for missing.
    Cols 0-4: Phase 4-1 original (momentum_60d, beta_60d, value_inv_pbr, log_size, liquidity_20d)
    Cols 5-7: Phase 5-2 short-term (stock_ret_5d, market_ret_0d, market_ret_5d)
    """
    n = len(rows)
    factors = np.full((n, 8), np.nan)

    # Pre-compute rolling 5-day market returns
    mkt_dates_sorted = sorted(mkt_returns.keys())
    mkt_ret_5d = {}
    for ki, dt in enumerate(mkt_dates_sorted):
        if ki >= 5:
            cum = 1.0
            for j in range(ki - 4, ki + 1):
                cum *= (1.0 + mkt_returns.get(mkt_dates_sorted[j], 0))
            mkt_ret_5d[dt] = (cum - 1.0) * 100
        else:
            mkt_ret_5d[dt] = mkt_returns.get(dt, 0) * 100
    date_idx = {}
    for code, series in ohlcv.items():
        date_idx[code] = {s[0]: i for i, s in enumerate(series)}

    for i, row in enumerate(rows):
        code = row["code"]
        date = row["date"]
        if code not in ohlcv or code not in date_idx:
            continue
        series = ohlcv[code]
        didx = date_idx[code]
        idx = didx.get(date)
        if idx is None:
            continue

        # momentum_60d
        if idx >= 60:
            cur = series[idx][1]
            past = series[idx - 60][1]
            if past > 0:
                factors[i, 0] = (cur / past - 1.0) * 100

        # beta_60d
        if idx >= 60:
            sr, mr = [], []
            for j in range(max(1, idx - 59), idx + 1):
                dt_j = series[j][0]
                if series[j - 1][1] > 0 and dt_j in mkt_returns:
                    sr.append((series[j][1] - series[j - 1][1]) / series[j - 1][1])
                    mr.append(mkt_returns[dt_j])
            if len(sr) >= 20:
                var_m = np.var(mr, ddof=1)
                if var_m > 1e-12:
                    factors[i, 1] = np.cov(sr, mr, ddof=1)[0, 1] / var_m

        # value_inv_pbr
        mcap = index_info.get(code, {}).get("marketCap", 0)
        equity = financials.get(code)
        if mcap > 0 and equity and equity > 0:
            pbr = (mcap * 1e8) / equity
            if pbr > 0.01:
                factors[i, 2] = 1.0 / pbr

        # log_size
        if mcap > 0:
            factors[i, 3] = math.log(mcap)

        # liquidity_20d
        if idx >= 20 and mcap > 0:
            vols = [series[j][2] for j in range(idx - 19, idx + 1)]
            avg_vol = np.mean(vols)
            cur_price = series[idx][1]
            if cur_price > 0 and avg_vol > 0:
                factors[i, 4] = (avg_vol * cur_price) / (mcap * 1e8) * 100

        # stock_ret_5d (Phase 5-2: short-term stock momentum, Jegadeesh & Titman 1993)
        if idx >= 5:
            cur = series[idx][1]
            past5 = series[idx - 5][1]
            if past5 > 0:
                factors[i, 5] = (cur / past5 - 1.0) * 100

        # market_ret_0d (Phase 5-2: daily market return, CAPM Sharpe 1964)
        if date in mkt_returns:
            factors[i, 6] = mkt_returns[date] * 100

        # market_ret_5d (Phase 5-2: 5-day cumulative market return, Lo 2004 AMH)
        if date in mkt_ret_5d:
            factors[i, 7] = mkt_ret_5d[date]

    return factors


def _zscore_by_date(factors, dates):
    """Cross-sectional MAD-robust z-score, winsorized ±3, NaN→0."""
    result = factors.copy()
    date_to_indices = defaultdict(list)
    for i, d in enumerate(dates):
        date_to_indices[d].append(i)

    for dt, idxs in date_to_indices.items():
        if len(idxs) < 5:
            continue
        for col in range(factors.shape[1]):
            vals = factors[idxs, col]
            valid = ~np.isnan(vals)
            if valid.sum() < 3:
                continue
            vv = vals[valid]
            mu = np.median(vv)
            mad = np.median(np.abs(vv - mu))
            scale = mad * 1.4826 if mad > 1e-10 else np.std(vv, ddof=1)
            if scale < 1e-10:
                continue
            for idx in idxs:
                if np.isnan(factors[idx, col]):
                    result[idx, col] = 0.0
                else:
                    result[idx, col] = np.clip((factors[idx, col] - mu) / scale, -3, 3)

    return np.nan_to_num(result, nan=0.0)


# ──────────────────────────────────────────────
# Data Loading + Feature Engineering (reused from mra_extended.py)
# ──────────────────────────────────────────────

def load_and_engineer(horizon, use_apt=True):
    """Load CSV, derive features, return X (n x 20 or 12), y (n,), dates[], meta[].
    When use_apt=True (default), adds 8 APT factors from OHLCV/index/financials.
    """
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
    feature_names = FEATURE_NAMES if use_apt else FEATURE_NAMES_12

    # Build base 12-col matrix
    X12 = np.zeros((n, len(FEATURE_NAMES_12)))
    y = np.zeros(n)
    dates = []
    meta = []

    for i, r in enumerate(rows):
        for j, fname in enumerate(FEATURE_NAMES_12):
            X12[i, j] = r[fname]
        y[i] = r["ret"]
        dates.append(r["date"])
        meta.append({
            "code": r["code"],
            "type": r["type"],
            "signal": r["signal"],
            "market": r["market"],
        })

    if not use_apt:
        return X12, y, dates, meta

    # Load APT auxiliary data
    print("  -> Loading APT auxiliary data (index, financials, OHLCV)...")
    index_info = _load_index()
    financials = _load_financials()
    ohlcv = _load_ohlcv_all(index_info)
    print(f"     Index: {len(index_info)}, Financials: {len(financials)}, OHLCV: {len(ohlcv)}")

    if not ohlcv:
        print("  -> [WARN] No OHLCV data, falling back to 12-col")
        return X12, y, dates, meta

    # Compute market returns + APT factors
    mkt_returns = _compute_market_returns(ohlcv, index_info, top_n=100)
    apt_raw = _compute_apt_factors(rows, ohlcv, mkt_returns, index_info, financials)

    # Coverage report
    for j, fname in enumerate(APT_NAMES):
        valid = np.sum(~np.isnan(apt_raw[:, j]))
        print(f"     {fname}: {valid:,}/{n:,} ({valid/n*100:.1f}%)")

    apt_z = _zscore_by_date(apt_raw, dates)
    X = np.column_stack([X12, apt_z])

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

        # James-Stein per-feature shrinkage (Stein 1961, Phase 5-2)
        # Shrink toward expanding grand mean of prior betas.
        # Skip intercept (j=0). Require >= 4 prior periods because:
        #   - p=21 params with <4 obs → variance estimate unstable (ddof=1 → 2~3 DF)
        #   - Empirical: >=2 caused over-shrinkage; >=4 balances bias-variance
        # Bias correction (beta[0] adjustment) is Empirical Bayes re-centering,
        # not part of canonical Stein 1961 but standard in financial panel applications
        # (Efron 2012 "Large-Scale Inference", §6.2).
        if len(period_stats) >= 4:
            prior_betas = np.array([ps["beta"] for ps in period_stats])
            beta_mean = prior_betas.mean(axis=0)
            p_feat = len(beta) - 1  # exclude intercept
            # Per-feature variance across periods (individual stability measure)
            beta_var = np.var(prior_betas, axis=0, ddof=1)
            for j in range(1, len(beta)):  # skip intercept at j=0
                var_j = beta_var[j]
                diff_sq_j = (beta[j] - beta_mean[j]) ** 2
                if diff_sq_j > 1e-12 and var_j > 1e-12:
                    # Conservative: shrink proportional to feature's own instability
                    B_j = max(0.0, 1.0 - max(p_feat - 2, 1) * var_j / (p_feat * diff_sq_j))
                    beta[j] = B_j * beta[j] + (1.0 - B_j) * beta_mean[j]
            # Bias correction: re-center intercept so training predictions are unbiased
            y_hat_tr = predict(X_tr, beta)
            beta[0] -= np.mean(y_hat_tr - y_tr)

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

    # ── Autocorrelation: corrected 3-type measurement (Petersen 2009) ──
    # Old pooled AC was artifact: 99.92% of lag-1 pairs are same-date cross-sectional
    autocorr_pooled = {}
    for lag in [1, 2, 3, 5, 10]:
        if n > lag + 30:
            corr, pval = sp_stats.spearmanr(resid_arr[:-lag], resid_arr[lag:])
            if np.isfinite(corr):
                autocorr_pooled[f"lag_{lag}"] = {
                    "corr": round(float(corr), 6),
                    "p_value": round(float(pval), 6),
                }

    # (a) Within-stock AC(1): per-stock time-series AC, then average
    by_code = defaultdict(list)
    for r in residuals:
        by_code[r["code"]].append((r["date"], r["residual"]))
    within_stock_acs = []
    for code, series in by_code.items():
        series.sort(key=lambda x: x[0])
        if len(series) < 5:
            continue
        arr_s = np.array([s[1] for s in series])
        ac_s, _ = sp_stats.spearmanr(arr_s[:-1], arr_s[1:])
        if np.isfinite(ac_s):
            within_stock_acs.append(ac_s)
    within_stock_ac = {
        "mean": round(float(np.mean(within_stock_acs)), 6) if within_stock_acs else None,
        "median": round(float(np.median(within_stock_acs)), 6) if within_stock_acs else None,
        "std": round(float(np.std(within_stock_acs)), 6) if within_stock_acs else None,
        "n_stocks": len(within_stock_acs),
    }

    # (b) Date-level AC(1): AC of daily mean residuals
    date_resids = defaultdict(list)
    for r in residuals:
        date_resids[r["date"]].append(r["residual"])
    dates_sorted = sorted(date_resids.keys())
    date_means = np.array([np.mean(date_resids[d]) for d in dates_sorted])
    date_ac, date_p = (None, None)
    if len(date_means) > 5:
        date_ac, date_p = sp_stats.spearmanr(date_means[:-1], date_means[1:])
        if not np.isfinite(date_ac):
            date_ac, date_p = None, None
    date_level_ac = {
        "corr": round(float(date_ac), 6) if date_ac is not None else None,
        "p_value": round(float(date_p), 6) if date_p is not None else None,
        "n_dates": len(dates_sorted),
    }

    # (c) Demeaned within-stock AC(1): remove date mean, then per-stock AC
    date_mean_map = {d: np.mean(date_resids[d]) for d in dates_sorted}
    by_code_dm = defaultdict(list)
    for r in residuals:
        dm = r["residual"] - date_mean_map.get(r["date"], 0)
        by_code_dm[r["code"]].append((r["date"], dm))
    demeaned_acs = []
    for code, series in by_code_dm.items():
        series.sort(key=lambda x: x[0])
        if len(series) < 5:
            continue
        arr_d = np.array([s[1] for s in series])
        ac_d, _ = sp_stats.spearmanr(arr_d[:-1], arr_d[1:])
        if np.isfinite(ac_d):
            demeaned_acs.append(ac_d)
    demeaned_ac = {
        "mean": round(float(np.mean(demeaned_acs)), 6) if demeaned_acs else None,
        "median": round(float(np.median(demeaned_acs)), 6) if demeaned_acs else None,
        "std": round(float(np.std(demeaned_acs)), 6) if demeaned_acs else None,
        "n_stocks": len(demeaned_acs),
    }

    autocorr = autocorr_pooled
    autocorr_corrected = {
        "within_stock": within_stock_ac,
        "date_level": date_level_ac,
        "demeaned_within_stock": demeaned_ac,
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
        "autocorrelation_corrected": autocorr_corrected,
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
    use_apt = True  # default: 20-col with APT + short-term momentum factors

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
        elif args[i] == "--12col":
            use_apt = False; i += 1
        else:
            i += 1

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest first.")
        sys.exit(1)

    feature_names = FEATURE_NAMES if use_apt else FEATURE_NAMES_12
    mode_label = f"{len(feature_names)}-col" + (" + APT" if use_apt else "")

    print("=" * 60)
    print(f"Stage B-1: Walk-Forward MRA Residual Extraction ({mode_label})")
    print("=" * 60)
    print(f"  horizon={horizon}, train={train_days}d, test={test_days}d, lambda={lam}")

    # ── Step 1: Load + Feature Engineering ──
    print(f"\n[1/4] Loading CSV + engineering {len(feature_names)} features...")
    X, y, dates, meta = load_and_engineer(horizon, use_apt=use_apt)
    n, p = X.shape
    # Update feature_names to match actual dimension (APT may fall back to 12)
    if p == len(FEATURE_NAMES_12):
        feature_names = FEATURE_NAMES_12
    else:
        feature_names = FEATURE_NAMES
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

    # CSV: per-sample residuals (features in separate columns)
    csv_header = (
        ["date", "code", "market", "type", "signal",
         "y_pred", "y_actual", "residual", "wf_period", "wf_label"]
        + feature_names
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
    print(f"  -> CSV: {OUT_CSV} ({len(residuals):,} rows, {len(feature_names)} features)")

    # JSON: summary + period stats
    summary = _to_native({
        "config": {
            "horizon": horizon,
            "train_days": train_days,
            "test_days": test_days,
            "ridge_lambda": lam,
            "n_features": p,
            "feature_names": feature_names,
            "apt_enabled": use_apt and p > len(FEATURE_NAMES_12),
        },
        "analysis": analysis,
        "period_stats": [{k: v for k, v in ps.items() if k != "beta"} for ps in period_stats],
        "period_betas": {
            ps["period_id"]: {
                "label": ps["label"],
                "coefficients": {
                    name: round(float(ps["beta"][j]), 6)
                    for j, name in enumerate(["intercept"] + feature_names)
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
