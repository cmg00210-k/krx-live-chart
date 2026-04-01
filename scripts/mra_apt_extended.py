#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mra_apt_extended.py — Phase 4-1: APT Factor Extension (12-col → 17-col Ridge)

Extends Stage A-1 MRA with 5 APT (Arbitrage Pricing Theory) factors:
  12. momentum_60d   — 60-day return at pattern date (Jegadeesh & Titman 1993)
  13. beta_60d       — rolling 60-day beta vs cap-weighted market (Sharpe 1964)
  14. value_inv_pbr  — 1/PBR (Fama & French 1993 HML factor)
  15. log_size       — log(marketCap) (Fama & French 1993 SMB factor)
  16. liquidity_20d  — 20-day avg turnover (Amihud 2002)

Data Sources:
  - wc_return_pairs.csv (302K samples with code + date)
  - data/{market}/{code}.json (OHLCV candles)
  - data/index.json (marketCap per stock)
  - data/financials/{code}.json (total_equity for PBR)

Academic Basis:
  - Ross (1976): APT multi-factor pricing
  - Fama & French (1993): 3-factor model (MKT, SMB, HML)
  - Jegadeesh & Titman (1993): Momentum factor
  - Amihud (2002): Illiquidity as priced factor
  - core_data/23_apt_factor_model.md

Output:
  data/backtest/mra_apt_results.json     — full comparison report
  data/backtest/mra_apt_coefficients.json — 17-col Ridge coefficients for JS

Usage:
    python scripts/mra_apt_extended.py
    python scripts/mra_apt_extended.py --horizon 5   (default)
    python scripts/mra_apt_extended.py --quick        (skip walk-forward)
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

# Tier classification (from Stage A-1)
TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

# Original 12 features (Stage A-1 baseline)
FEATURE_NAMES_12 = [
    "hw", "vw", "mw", "rw", "confidence_norm", "signal_dir",
    "market_type", "log_confidence", "pattern_tier",
    "hw_x_signal", "vw_x_signal", "conf_x_signal",
]

# 5 new APT factors
APT_FACTOR_NAMES = [
    "momentum_60d",    # 60-day return
    "beta_60d",        # 60-day rolling beta vs market
    "value_inv_pbr",   # 1/PBR (value factor)
    "log_size",        # log(marketCap in 억원)
    "liquidity_20d",   # 20-day avg turnover
]

# Full 17 features
FEATURE_NAMES_17 = FEATURE_NAMES_12 + APT_FACTOR_NAMES


# ══════════════════════════════════════════════════════
#  1. Data Loading
# ══════════════════════════════════════════════════════

def load_index():
    """Load index.json → {code: {marketCap, market}}."""
    with open(INDEX_PATH, encoding="utf-8") as f:
        data = json.load(f)
    result = {}
    for s in data["stocks"]:
        result[s["code"]] = {
            "marketCap": s.get("marketCap", 0),
            "market": s.get("market", "").lower(),
        }
    return result


def load_financials():
    """Load financials → {code: total_equity (latest annual)}."""
    result = {}
    for fp in FIN_DIR.glob("*.json"):
        try:
            with open(fp, encoding="utf-8") as f:
                d = json.load(f)
            annual = d.get("annual")
            if annual and isinstance(annual, list) and len(annual) > 0:
                # Use most recent annual report with positive equity
                for a in annual:
                    eq = a.get("total_equity")
                    if eq and eq > 0:
                        result[d["code"]] = eq
                        break
        except Exception:
            pass
    return result


def load_ohlcv_all(index_info):
    """Load all OHLCV files → {code: [(date, close, volume), ...]} sorted by date."""
    ohlcv = {}
    loaded = 0
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
            # Store as list of (date, close, volume) for memory efficiency
            series = []
            for c in candles:
                dt = c.get("time", "")
                cl = c.get("close", 0)
                vol = c.get("volume", 0)
                if dt and cl > 0:
                    series.append((dt, cl, vol))
            if series:
                ohlcv[code] = series
                loaded += 1
        except Exception:
            pass
    print(f"  -> Loaded OHLCV for {loaded} stocks")
    return ohlcv


def build_date_index(ohlcv):
    """Build {code: {date: idx}} for fast date lookups."""
    date_idx = {}
    for code, series in ohlcv.items():
        date_idx[code] = {s[0]: i for i, s in enumerate(series)}
    return date_idx


# ══════════════════════════════════════════════════════
#  2. Market Return Computation (for Beta)
# ══════════════════════════════════════════════════════

def compute_market_returns(ohlcv, index_info, top_n=100):
    """
    Cap-weighted daily market return from top N stocks.
    Returns {date: market_return} dict.
    """
    # Select top N by marketCap
    sorted_stocks = sorted(
        [(code, index_info[code]["marketCap"]) for code in ohlcv if code in index_info],
        key=lambda x: -x[1]
    )[:top_n]
    top_codes = [s[0] for s in sorted_stocks]
    top_caps = {s[0]: s[1] for s in sorted_stocks}
    total_cap = sum(s[1] for s in sorted_stocks) or 1

    # Collect all dates from top stocks
    all_dates = set()
    for code in top_codes:
        for dt, _, _ in ohlcv[code]:
            all_dates.add(dt)
    all_dates = sorted(all_dates)

    # Compute daily cap-weighted return
    mkt_returns = {}
    prev_closes = {}  # {code: prev_close}

    for dt in all_dates:
        weighted_ret = 0.0
        total_w = 0.0
        for code in top_codes:
            series = ohlcv[code]
            # Find this date in the series
            found = False
            for s in series:
                if s[0] == dt:
                    close = s[1]
                    if code in prev_closes and prev_closes[code] > 0:
                        ret = (close - prev_closes[code]) / prev_closes[code]
                        w = top_caps[code] / total_cap
                        weighted_ret += w * ret
                        total_w += w
                    prev_closes[code] = close
                    found = True
                    break
        if total_w > 0.3:  # At least 30% of market represented
            mkt_returns[dt] = weighted_ret

    print(f"  -> Market returns computed: {len(mkt_returns)} trading days from top {top_n} stocks")
    return mkt_returns


def compute_market_returns_fast(ohlcv, index_info, top_n=100):
    """
    Optimized: use pre-built date-indexed arrays for top N stocks.
    Returns {date: market_return}.
    """
    sorted_stocks = sorted(
        [(code, index_info[code]["marketCap"]) for code in ohlcv if code in index_info],
        key=lambda x: -x[1]
    )[:top_n]
    top_codes = [s[0] for s in sorted_stocks]
    top_caps = np.array([s[1] for s in sorted_stocks], dtype=np.float64)
    total_cap = top_caps.sum() or 1.0
    weights = top_caps / total_cap

    # Build {code: {date: close}} for fast lookup
    code_closes = {}
    all_dates = set()
    for code in top_codes:
        closes = {}
        for dt, cl, _ in ohlcv[code]:
            closes[dt] = cl
            all_dates.add(dt)
        code_closes[code] = closes

    all_dates = sorted(all_dates)
    mkt_returns = {}
    prev_closes = [0.0] * len(top_codes)

    for dt in all_dates:
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

    print(f"  -> Market returns: {len(mkt_returns)} days (top {top_n} cap-weighted)")
    return mkt_returns


# ══════════════════════════════════════════════════════
#  3. APT Factor Computation (per sample)
# ══════════════════════════════════════════════════════

def compute_apt_factors(rows, ohlcv, date_idx, mkt_returns, index_info, financials):
    """
    For each row in wc_return_pairs, compute 5 APT factors.
    Returns np.array (n, 5) with NaN for missing.
    """
    n = len(rows)
    factors = np.full((n, 5), np.nan)
    mkt_dates_sorted = sorted(mkt_returns.keys())
    mkt_date_set = set(mkt_dates_sorted)

    hit = miss = 0

    for i, row in enumerate(rows):
        code = row["code"]
        date = row["date"]
        market = row.get("market", "")

        if code not in ohlcv or code not in date_idx:
            miss += 1
            continue

        series = ohlcv[code]
        didx = date_idx[code]
        idx = didx.get(date)
        if idx is None:
            miss += 1
            continue

        hit += 1

        # ── Factor 0: momentum_60d ──
        # 60-day return: (close[t] / close[t-60] - 1)
        lookback = 60
        if idx >= lookback:
            cur_close = series[idx][1]
            past_close = series[idx - lookback][1]
            if past_close > 0:
                factors[i, 0] = (cur_close / past_close - 1.0) * 100  # in %

        # ── Factor 1: beta_60d ──
        # Rolling 60-day beta = cov(stock_ret, mkt_ret) / var(mkt_ret)
        if idx >= lookback:
            stock_rets = []
            mkt_rets_aligned = []
            for j in range(max(1, idx - lookback + 1), idx + 1):
                dt_j = series[j][0]
                dt_prev = series[j - 1][0]
                if series[j - 1][1] > 0 and dt_j in mkt_returns:
                    sr = (series[j][1] - series[j - 1][1]) / series[j - 1][1]
                    stock_rets.append(sr)
                    mkt_rets_aligned.append(mkt_returns[dt_j])

            if len(stock_rets) >= 20:
                sr_arr = np.array(stock_rets)
                mr_arr = np.array(mkt_rets_aligned)
                var_mkt = np.var(mr_arr, ddof=1)
                if var_mkt > 1e-12:
                    cov_sm = np.cov(sr_arr, mr_arr, ddof=1)[0, 1]
                    factors[i, 1] = cov_sm / var_mkt

        # ── Factor 2: value_inv_pbr ──
        # 1/PBR = total_equity / marketCap (in same units)
        mcap = index_info.get(code, {}).get("marketCap", 0)
        equity = financials.get(code)
        if mcap > 0 and equity and equity > 0:
            # marketCap is in 억원, equity is in raw KRW
            mcap_krw = mcap * 1e8  # convert 억원 → KRW
            pbr = mcap_krw / equity
            if pbr > 0.01:
                factors[i, 2] = 1.0 / pbr

        # ── Factor 3: log_size ──
        if mcap > 0:
            factors[i, 3] = math.log(mcap)

        # ── Factor 4: liquidity_20d ──
        # 20-day avg volume / marketCap
        vol_lookback = 20
        if idx >= vol_lookback and mcap > 0:
            vols = [series[j][2] for j in range(idx - vol_lookback + 1, idx + 1)]
            avg_vol = np.mean(vols) if vols else 0
            # Turnover: avg daily volume * price / marketCap
            cur_price = series[idx][1]
            if cur_price > 0 and avg_vol > 0:
                # avg_vol * cur_price = daily traded value (KRW)
                # mcap * 1e8 = total market cap (KRW)
                daily_turnover = (avg_vol * cur_price) / (mcap * 1e8)
                factors[i, 4] = daily_turnover * 100  # in %

    print(f"  -> APT factors computed: {hit} hit, {miss} miss ({hit/(hit+miss)*100:.1f}% coverage)")
    return factors


# ══════════════════════════════════════════════════════
#  4. Cross-sectional Z-score Normalization
# ══════════════════════════════════════════════════════

def zscore_by_date(factors, dates):
    """
    Cross-sectional z-score normalization per date.
    Standard in factor models to ensure comparability across time.
    NaN values are imputed with 0 (cross-sectional median after z-scoring).
    """
    result = factors.copy()
    unique_dates = sorted(set(dates))
    date_to_indices = defaultdict(list)
    for i, d in enumerate(dates):
        date_to_indices[d].append(i)

    for dt in unique_dates:
        idxs = date_to_indices[dt]
        if len(idxs) < 5:
            continue
        for col in range(factors.shape[1]):
            vals = factors[idxs, col]
            valid = ~np.isnan(vals)
            if valid.sum() < 3:
                continue
            valid_vals = vals[valid]
            mu = np.median(valid_vals)
            # Robust scale: MAD * 1.4826
            mad = np.median(np.abs(valid_vals - mu))
            scale = mad * 1.4826 if mad > 1e-10 else np.std(valid_vals, ddof=1)
            if scale < 1e-10:
                continue
            for idx in idxs:
                if np.isnan(factors[idx, col]):
                    result[idx, col] = 0.0  # median imputation
                else:
                    z = (factors[idx, col] - mu) / scale
                    result[idx, col] = np.clip(z, -3, 3)  # winsorize

    # Remaining NaN → 0
    result = np.nan_to_num(result, nan=0.0)
    return result


# ══════════════════════════════════════════════════════
#  5. Data Loading from CSV (reused from mra_extended.py)
# ══════════════════════════════════════════════════════

def load_csv_data(horizon):
    """Load CSV, derive 12 features + metadata. Returns rows list."""
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
            tier = 1.0 if ptype in TIER1 else (3.0 if ptype in TIER3 else 2.0)

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

    return rows


def rows_to_arrays(rows):
    """Convert rows list → X (n×12), y (n,), dates, meta."""
    n = len(rows)
    X = np.zeros((n, len(FEATURE_NAMES_12)))
    y = np.zeros(n)
    dates = []
    meta = []

    for i, r in enumerate(rows):
        for j, fname in enumerate(FEATURE_NAMES_12):
            X[i, j] = r[fname]
        y[i] = r["ret"]
        dates.append(r["date"])
        meta.append({"code": r["code"], "type": r["type"],
                      "signal": r["signal"], "market": r["market"]})

    return X, y, dates, meta


# ══════════════════════════════════════════════════════
#  6. Regression Functions (from mra_extended.py)
# ══════════════════════════════════════════════════════

def ols_fit(X, y):
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    try:
        XtX = X1.T @ X1
        beta = np.linalg.solve(XtX, X1.T @ y)
    except np.linalg.LinAlgError:
        beta = np.linalg.lstsq(X1, y, rcond=None)[0]

    y_hat = X1 @ beta
    ss_res = np.sum((y - y_hat) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    dof = n - p - 1
    sigma2 = ss_res / dof if dof > 0 else 0
    try:
        cov = sigma2 * np.linalg.inv(XtX)
        se = np.sqrt(np.maximum(np.diag(cov), 0))
        t_stats = beta / np.where(se > 0, se, 1e-10)
        p_values = 2 * sp_stats.t.sf(np.abs(t_stats), df=dof)
    except np.linalg.LinAlgError:
        t_stats = np.zeros_like(beta)
        p_values = np.ones_like(beta)

    return {"beta": beta, "r2": r2, "t_stats": t_stats, "p_values": p_values}


def ols_predict(X, beta):
    n = X.shape[0]
    X1 = np.column_stack([np.ones(n), X])
    return X1 @ beta


def ridge_fit(X, y, lam):
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    XtX = X1.T @ X1
    penalty = lam * np.eye(p + 1)
    penalty[0, 0] = 0  # Don't penalize intercept
    beta = np.linalg.solve(XtX + penalty, X1.T @ y)
    return beta


def calc_ic(y_pred, y_actual):
    if len(y_pred) < 30:
        return None
    corr, pval = sp_stats.spearmanr(y_pred, y_actual)
    return {"ic": round(float(corr), 6), "p_value": round(float(pval), 6), "n": len(y_pred)}


def fama_macbeth_ic(y_pred, y_actual, dates):
    by_date = defaultdict(lambda: ([], []))
    for i, d in enumerate(dates):
        by_date[d][0].append(y_pred[i])
        by_date[d][1].append(y_actual[i])

    daily_ics = []
    for d in sorted(by_date.keys()):
        preds, actuals = by_date[d]
        if len(preds) < 20:
            continue
        p_arr, a_arr = np.array(preds), np.array(actuals)
        if np.std(p_arr) < 1e-10:
            continue
        corr, _ = sp_stats.spearmanr(p_arr, a_arr)
        if np.isfinite(corr):
            daily_ics.append(float(corr))

    if len(daily_ics) < 5:
        return None

    ics = np.array(daily_ics)
    mean_ic = float(np.mean(ics))
    std_ic = float(np.std(ics, ddof=1))
    n = len(ics)
    t_stat = mean_ic / (std_ic / np.sqrt(n)) if std_ic > 0 else 0.0
    p_value = float(2 * sp_stats.t.sf(abs(t_stat), df=n - 1))

    return {
        "n_days": n,
        "mean_ic": round(mean_ic, 6),
        "std_ic": round(std_ic, 6),
        "t_stat": round(t_stat, 4),
        "p_value": round(p_value, 6),
        "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
    }


def walk_forward_ic(X, y, dates, train_days=60, test_days=20, method="ridge", lam=2.0):
    unique_dates = sorted(set(dates))
    date_to_idx = defaultdict(list)
    for i, d in enumerate(dates):
        date_to_idx[d].append(i)

    n_dates = len(unique_dates)
    results = []
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

        if method == "ridge":
            beta = ridge_fit(X_tr, y_tr, lam)
        else:
            res = ols_fit(X_tr, y_tr)
            beta = res["beta"]

        y_hat = ols_predict(X_te, beta)
        if np.std(y_hat) < 1e-10 or np.std(y_te) < 1e-10:
            start += test_days
            continue

        corr, pval = sp_stats.spearmanr(y_hat, y_te)
        if np.isfinite(corr):
            results.append({
                "period": f"{test_dates[0]}~{test_dates[-1]}",
                "ic": round(float(corr), 6),
                "n": len(test_idx),
            })
        start += test_days

    if not results:
        return None

    ics = np.array([r["ic"] for r in results])
    mean_ic = float(np.mean(ics))
    std_ic = float(np.std(ics, ddof=1)) if len(ics) > 1 else 0.0
    t_stat = mean_ic / (std_ic / np.sqrt(len(ics))) if std_ic > 0 else 0.0

    return {
        "n_periods": len(results),
        "mean_ic": round(mean_ic, 6),
        "std_ic": round(std_ic, 6),
        "t_stat": round(t_stat, 4),
        "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
        "periods": results,
    }


# ══════════════════════════════════════════════════════
#  7. JSON Serialization
# ══════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════

def main():
    t0 = time.time()
    args = sys.argv[1:]
    horizon = 5
    quick = False
    for i, a in enumerate(args):
        if a == "--horizon" and i + 1 < len(args):
            horizon = int(args[i + 1])
        if a == "--quick":
            quick = True

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest first.")
        sys.exit(1)

    # ── Step 1: Load base CSV data ──
    print(f"[1/8] Loading CSV (horizon={horizon})...")
    rows = load_csv_data(horizon)
    X12, y, dates, meta = rows_to_arrays(rows)
    n = len(rows)
    print(f"  -> {n:,} samples, {len(FEATURE_NAMES_12)} base features")

    # ── Step 2: Load auxiliary data for APT factors ──
    print("[2/8] Loading auxiliary data (index, financials, OHLCV)...")
    index_info = load_index()
    financials = load_financials()
    print(f"  -> Index: {len(index_info)} stocks, Financials: {len(financials)} stocks")

    ohlcv = load_ohlcv_all(index_info)
    date_idx = build_date_index(ohlcv)

    # ── Step 3: Compute market returns for Beta ──
    print("[3/8] Computing cap-weighted market returns (top 100)...")
    mkt_returns = compute_market_returns_fast(ohlcv, index_info, top_n=100)

    # ── Step 4: Compute APT factors per sample ──
    print("[4/8] Computing 5 APT factors per sample...")
    apt_raw = compute_apt_factors(rows, ohlcv, date_idx, mkt_returns, index_info, financials)

    # Per-factor coverage
    for j, fname in enumerate(APT_FACTOR_NAMES):
        valid = np.sum(~np.isnan(apt_raw[:, j]))
        print(f"  -> {fname}: {valid:,}/{n:,} ({valid/n*100:.1f}%)")

    # Cross-sectional z-score normalization
    print("  -> Z-scoring (cross-sectional, MAD-robust, winsorized ±3)...")
    apt_z = zscore_by_date(apt_raw, dates)

    # ── Step 5: Combine 12-col + 5 APT = 17-col ──
    X17 = np.column_stack([X12, apt_z])
    print(f"  -> Combined design matrix: {X17.shape[0]:,} x {X17.shape[1]}")

    # ── Step 6: Model comparison ──
    print("[5/8] Running model comparison...")

    # 12-col baseline (Ridge λ=2.0)
    ridge12_beta = ridge_fit(X12, y, 2.0)
    y_hat_12 = ols_predict(X12, ridge12_beta)
    ic_12 = calc_ic(y_hat_12, y)
    fm_12 = fama_macbeth_ic(y_hat_12, y, dates)

    # 17-col Ridge (same λ=2.0)
    ridge17_beta = ridge_fit(X17, y, 2.0)
    y_hat_17 = ols_predict(X17, ridge17_beta)
    ic_17 = calc_ic(y_hat_17, y)
    fm_17 = fama_macbeth_ic(y_hat_17, y, dates)

    # 17-col OLS (for t-stats)
    ols17 = ols_fit(X17, y)

    print(f"\n  12-col Ridge: IC={ic_12['ic']:.6f}, FM mean_IC={fm_12['mean_ic']:.6f} (t={fm_12['t_stat']:.2f})" if ic_12 and fm_12 else "")
    print(f"  17-col Ridge: IC={ic_17['ic']:.6f}, FM mean_IC={fm_17['mean_ic']:.6f} (t={fm_17['t_stat']:.2f})" if ic_17 and fm_17 else "")

    # APT factor significance (from 17-col OLS)
    print(f"\n  17-col OLS coefficients:")
    print(f"  {'Feature':<20} {'beta':>10} {'t-stat':>10} {'p-value':>10} {'sig':>5}")
    names_17_with_int = ["intercept"] + FEATURE_NAMES_17
    for j in range(len(ols17["beta"])):
        sig = "***" if ols17["p_values"][j] < 0.001 else "**" if ols17["p_values"][j] < 0.01 else "*" if ols17["p_values"][j] < 0.05 else ""
        print(f"  {names_17_with_int[j]:<20} {ols17['beta'][j]:>10.6f} {ols17['t_stats'][j]:>10.3f} {ols17['p_values'][j]:>10.6f} {sig:>5}")

    # Highlight APT factor contribution
    print(f"\n  APT Factor Summary:")
    apt_start = len(FEATURE_NAMES_12) + 1  # +1 for intercept
    for j, fname in enumerate(APT_FACTOR_NAMES):
        idx_j = apt_start + j
        t = ols17["t_stats"][idx_j]
        p = ols17["p_values"][idx_j]
        b = ols17["beta"][idx_j]
        sig = "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "n.s."
        print(f"    {fname:<18} t={t:>8.3f}  p={p:.4f}  beta={b:>10.6f}  {sig}")

    # ── Step 7: Ridge λ CV for 17-col ──
    print("\n[6/8] Ridge CV for 17-col...")
    lambdas = [0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0]
    best_lam = 2.0
    best_mse = float("inf")
    n_folds = 5
    indices = np.arange(n)
    np.random.seed(42)
    np.random.shuffle(indices)
    folds = np.array_split(indices, n_folds)

    cv_results = {}
    for lam in lambdas:
        mses = []
        for k in range(n_folds):
            test_idx = folds[k]
            train_idx = np.concatenate([folds[j] for j in range(n_folds) if j != k])
            beta = ridge_fit(X17[train_idx], y[train_idx], lam)
            y_hat = ols_predict(X17[test_idx], beta)
            mses.append(np.mean((y[test_idx] - y_hat) ** 2))
        mean_mse = np.mean(mses)
        cv_results[lam] = round(float(mean_mse), 6)
        if mean_mse < best_mse:
            best_mse = mean_mse
            best_lam = lam
        print(f"    lambda={lam:>5}: MSE={mean_mse:.6f}")

    print(f"  -> Best lambda for 17-col: {best_lam}")

    # Re-fit with best lambda
    ridge17_best = ridge_fit(X17, y, best_lam)
    y_hat_17_best = ols_predict(X17, ridge17_best)
    ic_17_best = calc_ic(y_hat_17_best, y)

    # ── Step 8: Walk-Forward IC ──
    wf_12 = None
    wf_17 = None
    if not quick:
        print("[7/8] Walk-Forward IC comparison...")
        wf_12 = walk_forward_ic(X12, y, dates, method="ridge", lam=2.0)
        wf_17 = walk_forward_ic(X17, y, dates, method="ridge", lam=best_lam)

        if wf_12:
            print(f"  -> 12-col Ridge WF: mean_IC={wf_12['mean_ic']:.6f}, t={wf_12['t_stat']:.2f}, "
                  f"positive={wf_12['ic_positive_pct']}%")
        if wf_17:
            print(f"  -> 17-col Ridge WF: mean_IC={wf_17['mean_ic']:.6f}, t={wf_17['t_stat']:.2f}, "
                  f"positive={wf_17['ic_positive_pct']}%")
        if wf_12 and wf_17:
            delta = wf_17["mean_ic"] - wf_12["mean_ic"]
            print(f"  -> Delta IC (OOS): {delta:+.6f}")
    else:
        print("[7/8] Walk-Forward skipped (--quick)")

    # ── IC delta summary ──
    print("\n[8/8] Incremental APT factor contribution...")
    # Sequential addition test: add each APT factor one at a time
    print(f"  Sequential factor addition (Ridge lambda={best_lam}):")
    for j, fname in enumerate(APT_FACTOR_NAMES):
        X_plus = np.column_stack([X12, apt_z[:, :j + 1]])
        beta_plus = ridge_fit(X_plus, y, best_lam)
        y_hat_plus = ols_predict(X_plus, beta_plus)
        ic_plus = calc_ic(y_hat_plus, y)
        delta = ic_plus["ic"] - ic_12["ic"] if ic_plus and ic_12 else 0
        print(f"    +{fname:<18} IC={ic_plus['ic']:.6f} (delta={delta:+.6f})")

    # ── Final Summary ──
    elapsed = time.time() - t0
    print("\n" + "=" * 65)
    print("  PHASE 4-1 APT FACTOR EXTENSION SUMMARY")
    print("=" * 65)
    print(f"  {'Model':<25} {'In-sample IC':>15} {'FM mean IC':>15} {'FM t':>8}")
    models = [
        ("12-col Ridge (λ=2.0)", ic_12, fm_12),
        (f"17-col Ridge (λ={best_lam})", ic_17_best, fm_17),
    ]
    for name, ic, fm in models:
        ic_v = f"{ic['ic']:.6f}" if ic else "N/A"
        fm_v = f"{fm['mean_ic']:.6f}" if fm else "-"
        fm_t = f"{fm['t_stat']:.2f}" if fm else "-"
        print(f"  {name:<25} {ic_v:>15} {fm_v:>15} {fm_t:>8}")

    if wf_12 and wf_17:
        print(f"\n  Walk-Forward (OOS):")
        print(f"  {'12-col Ridge':<25} mean_IC={wf_12['mean_ic']:.6f}, t={wf_12['t_stat']:.2f}, pos={wf_12['ic_positive_pct']}%")
        print(f"  {'17-col Ridge':<25} mean_IC={wf_17['mean_ic']:.6f}, t={wf_17['t_stat']:.2f}, pos={wf_17['ic_positive_pct']}%")
        delta = wf_17["mean_ic"] - wf_12["mean_ic"]
        print(f"  {'Delta (APT contrib.)':<25} {delta:+.6f}")

    print(f"\n  Total time: {elapsed:.1f}s")

    # ── Save results ──
    output = {
        "phase": "4-1",
        "description": "APT Factor Extension (12→17 columns)",
        "horizon": horizon,
        "n_samples": n,
        "feature_names_12": FEATURE_NAMES_12,
        "feature_names_17": FEATURE_NAMES_17,
        "apt_factors": APT_FACTOR_NAMES,
        "apt_factor_coverage": {
            fname: round(float(np.sum(~np.isnan(apt_raw[:, j])) / n * 100), 1)
            for j, fname in enumerate(APT_FACTOR_NAMES)
        },
        "models": {
            "ridge_12col": {
                "lambda": 2.0,
                "in_sample_ic": _to_native(ic_12),
                "fama_macbeth": _to_native(fm_12),
            },
            "ridge_17col": {
                "lambda": best_lam,
                "in_sample_ic": _to_native(ic_17_best),
                "fama_macbeth": _to_native(fm_17),
                "cv_results": _to_native(cv_results),
            },
        },
        "ols_17col_coefficients": {
            names_17_with_int[j]: {
                "beta": round(float(ols17["beta"][j]), 6),
                "t_stat": round(float(ols17["t_stats"][j]), 4),
                "p_value": round(float(ols17["p_values"][j]), 6),
            }
            for j in range(len(ols17["beta"]))
        },
        "walk_forward": {
            "ridge_12col": _to_native(wf_12) if wf_12 else None,
            "ridge_17col": _to_native(wf_17) if wf_17 else None,
        },
        "elapsed_seconds": round(elapsed, 1),
    }

    out_path = BACKTEST_DIR / "mra_apt_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(output), f, ensure_ascii=False, indent=2)
    print(f"\n  Results: {out_path}")

    # Save 17-col coefficients for JS runtime
    coeff_path = BACKTEST_DIR / "mra_apt_coefficients.json"
    coeff_output = {
        "model": "ridge_17col",
        "lambda": best_lam,
        "horizon": horizon,
        "n_samples": n,
        "feature_names": ["intercept"] + FEATURE_NAMES_17,
        "coefficients": [round(float(ridge17_best[j]), 8) for j in range(len(ridge17_best))],
        "apt_factors": {
            fname: {
                "description": desc,
                "z_scored": True,
                "coverage_pct": round(float(np.sum(~np.isnan(apt_raw[:, j])) / n * 100), 1),
            }
            for j, (fname, desc) in enumerate(zip(APT_FACTOR_NAMES, [
                "60-day return (Jegadeesh & Titman 1993)",
                "60-day rolling beta vs market (Sharpe 1964)",
                "1/PBR value factor (Fama & French 1993)",
                "log(marketCap) size factor (Fama & French 1993)",
                "20-day avg turnover (Amihud 2002)",
            ]))
        },
    }
    with open(coeff_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(coeff_output), f, ensure_ascii=False, indent=2)
    print(f"  Coefficients: {coeff_path}")


if __name__ == "__main__":
    main()
