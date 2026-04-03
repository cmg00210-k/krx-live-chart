#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mra_combined.py -- MRA Stage B-1: 23-Column Combined Ridge Model

Merges technical indicators (18-col) and APT factors (17-col) into a unified
23-column model: 12 base + 6 indicators + 5 APT factors.

Input:
  data/backtest/wc_return_pairs.csv (28-column)
  data/index.json, data/financials/*.json, data/{market}/{code}.json

Output:
  data/backtest/mra_combined_results.json
  data/backtest/mra_combined_coefficients.json

Analysis Pipeline:
  1. Load CSV with 18 features (12 base + 6 indicators)
  2. Load auxiliary data, compute 5 APT factors, z-score normalize
  3. Combine into 23-feature matrix
  4. VIF + condition number diagnostics
  5. Ridge CV, LASSO CV, BIC forward selection
  6. Walk-Forward rolling IC (60d train / 20d test)
  7. Fama-MacBeth daily IC
  8. Model comparison: 6/12/18/17/23-col

Academic References:
  - Ross (1976): APT multi-factor pricing
  - Fama & French (1993): SMB, HML factors
  - Jegadeesh & Titman (1993): Momentum
  - Amihud (2002): Illiquidity factor
  - Kutner et al. (2005): VIF > 10 = severe multicollinearity
  - core_data/23_apt_factor_model.md, core_data/17_regression.md

Usage:
    python scripts/mra_combined.py
    python scripts/mra_combined.py --horizon 5    (default: 5)
    python scripts/mra_combined.py --quick         (skip walk-forward)
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
HMM_PATH = BACKTEST_DIR / "hmm_regimes.json"
INDEX_PATH = DATA_DIR / "index.json"
FIN_DIR = DATA_DIR / "financials"

# Tier classification
TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

# 12 base features
FEATURE_NAMES_12 = [
    "hw", "vw", "mw", "rw", "confidence_norm", "signal_dir",
    "market_type", "log_confidence", "pattern_tier",
    "hw_x_signal", "vw_x_signal", "conf_x_signal",
]

# 6 technical indicator features (from CSV columns)
INDICATOR_NAMES = [
    "trendStrength", "volumeRatio", "atrNorm",
    "rsi_14", "macd_hist", "bb_position",
]

# 5 APT factors
APT_FACTOR_NAMES = [
    "momentum_60d", "beta_60d", "value_inv_pbr", "log_size", "liquidity_20d",
]

# Full 23 features
FEATURE_NAMES_23 = FEATURE_NAMES_12 + INDICATOR_NAMES + APT_FACTOR_NAMES


# ================================================================
#  1. Data Loading
# ================================================================

def _safe_float(row, key, default):
    v = row.get(key)
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def load_csv_with_indicators(horizon):
    """Load CSV -> 12 base + 6 indicators + metadata. Returns rows list."""
    col = f"ret_{horizon}"
    rows = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        indicator_present = "trendStrength" in (reader.fieldnames or [])
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
            mkt_type = 1.0 if row.get("market", "") == "kosdaq" else 0.0
            ptype = row.get("type", "")
            tier = 1.0 if ptype in TIER1 else (3.0 if ptype in TIER3 else 2.0)
            log_conf = math.log(max(conf, 1.0))
            conf_norm = conf / 100.0

            rows.append({
                "hw": hw, "vw": vw, "mw": mw, "rw": rw,
                "confidence_norm": conf_norm, "signal_dir": sig_dir,
                "market_type": mkt_type, "log_confidence": log_conf,
                "pattern_tier": tier,
                "hw_x_signal": hw * sig_dir, "vw_x_signal": vw * sig_dir,
                "conf_x_signal": conf_norm * sig_dir,
                # 6 indicators
                "trendStrength": _safe_float(row, "trendStrength", 0.0),
                "volumeRatio": _safe_float(row, "volumeRatio", 1.0),
                "atrNorm": _safe_float(row, "atrNorm", 0.0),
                "rsi_14": _safe_float(row, "rsi_14", 50.0),
                "macd_hist": _safe_float(row, "macd_hist", 0.0),
                "bb_position": _safe_float(row, "bb_position", 0.5),
                # metadata
                "ret": ret, "date": row.get("date", ""), "code": row.get("code", ""),
                "type": ptype, "signal": signal, "market": row.get("market", ""),
            })
    return rows, indicator_present


def rows_to_X18(rows):
    """Convert rows -> X (n x 18), y (n,), dates, meta."""
    n = len(rows)
    names = FEATURE_NAMES_12 + INDICATOR_NAMES
    X = np.zeros((n, 18))
    y = np.zeros(n)
    dates = []
    meta = []
    for i, r in enumerate(rows):
        for j, fname in enumerate(names):
            X[i, j] = r[fname]
        y[i] = r["ret"]
        dates.append(r["date"])
        meta.append({"code": r["code"], "type": r["type"],
                      "signal": r["signal"], "market": r["market"]})
    return X, y, dates, meta


# ================================================================
#  2. APT Factor Pipeline (from mra_apt_extended.py)
# ================================================================

def load_index():
    with open(INDEX_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {s["code"]: {"marketCap": s.get("marketCap", 0),
                         "market": s.get("market", "").lower()}
            for s in data["stocks"]}


def load_financials():
    result = {}
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


def load_ohlcv_all(index_info):
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
            series = [(c.get("time", ""), c.get("close", 0), c.get("volume", 0))
                      for c in candles if c.get("time") and c.get("close", 0) > 0]
            if series:
                ohlcv[code] = series
                loaded += 1
        except Exception:
            pass
    print(f"  -> OHLCV loaded: {loaded} stocks")
    return ohlcv


def build_date_index(ohlcv):
    return {code: {s[0]: i for i, s in enumerate(series)}
            for code, series in ohlcv.items()}


def compute_market_returns(ohlcv, index_info, top_n=100):
    sorted_stocks = sorted(
        [(c, index_info[c]["marketCap"]) for c in ohlcv if c in index_info],
        key=lambda x: -x[1])[:top_n]
    top_codes = [s[0] for s in sorted_stocks]
    weights = np.array([s[1] for s in sorted_stocks], dtype=np.float64)
    weights /= (weights.sum() or 1.0)

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
        w_ret = w_sum = 0.0
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


def compute_apt_factors(rows, ohlcv, date_idx, mkt_returns, index_info, financials):
    """Compute 5 APT factors per sample. Returns (n, 5) with NaN for missing."""
    n = len(rows)
    factors = np.full((n, 5), np.nan)
    hit = miss = 0

    for i, row in enumerate(rows):
        code, date = row["code"], row["date"]
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

        # Factor 0: momentum_60d
        if idx >= 60:
            cur, past = series[idx][1], series[idx - 60][1]
            if past > 0:
                factors[i, 0] = (cur / past - 1.0) * 100

        # Factor 1: beta_60d
        if idx >= 60:
            stock_rets, mkt_rets_aligned = [], []
            for j in range(max(1, idx - 59), idx + 1):
                dt_j = series[j][0]
                if series[j - 1][1] > 0 and dt_j in mkt_returns:
                    sr = (series[j][1] - series[j - 1][1]) / series[j - 1][1]
                    stock_rets.append(sr)
                    mkt_rets_aligned.append(mkt_returns[dt_j])
            if len(stock_rets) >= 20:
                sr_arr, mr_arr = np.array(stock_rets), np.array(mkt_rets_aligned)
                var_mkt = np.var(mr_arr, ddof=1)
                if var_mkt > 1e-12:
                    factors[i, 1] = np.cov(sr_arr, mr_arr, ddof=1)[0, 1] / var_mkt

        # Factor 2: value_inv_pbr
        mcap = index_info.get(code, {}).get("marketCap", 0)
        equity = financials.get(code)
        if mcap > 0 and equity and equity > 0:
            pbr = (mcap * 1e8) / equity
            if pbr > 0.01:
                factors[i, 2] = 1.0 / pbr

        # Factor 3: log_size
        if mcap > 0:
            factors[i, 3] = math.log(mcap)

        # Factor 4: liquidity_20d
        if idx >= 20 and mcap > 0:
            vols = [series[j][2] for j in range(idx - 19, idx + 1)]
            avg_vol = np.mean(vols)
            cur_price = series[idx][1]
            if cur_price > 0 and avg_vol > 0:
                factors[i, 4] = (avg_vol * cur_price) / (mcap * 1e8) * 100

    print(f"  -> APT factors: {hit} hit, {miss} miss ({hit / (hit + miss) * 100:.1f}%)")
    return factors


def zscore_by_date(factors, dates):
    """Cross-sectional z-score per date (MAD-robust, winsorized +/-3)."""
    result = factors.copy()
    date_to_indices = defaultdict(list)
    for i, d in enumerate(dates):
        date_to_indices[d].append(i)

    for dt, idxs in date_to_indices.items():
        if len(idxs) < 5:
            continue
        for col in range(factors.shape[1]):
            vals = factors[np.array(idxs), col]
            valid = ~np.isnan(vals)
            if valid.sum() < 3:
                continue
            valid_vals = vals[valid]
            mu = np.median(valid_vals)
            mad = np.median(np.abs(valid_vals - mu))
            scale = mad * 1.4826 if mad > 1e-10 else np.std(valid_vals, ddof=1)
            if scale < 1e-10:
                continue
            for idx in idxs:
                if np.isnan(factors[idx, col]):
                    result[idx, col] = 0.0
                else:
                    result[idx, col] = np.clip((factors[idx, col] - mu) / scale, -3, 3)

    return np.nan_to_num(result, nan=0.0)


# ================================================================
#  3. Regression Functions
# ================================================================

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
    return {"beta": beta, "r2": r2, "t_stats": t_stats, "p_values": p_values, "sigma2": sigma2}


def ols_predict(X, beta):
    return np.column_stack([np.ones(X.shape[0]), X]) @ beta


def ridge_fit(X, y, lam):
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    XtX = X1.T @ X1
    penalty = lam * np.eye(p + 1)
    penalty[0, 0] = 0
    return np.linalg.solve(XtX + penalty, X1.T @ y)


def ridge_cv(X, y, lambdas, n_folds=5):
    n = X.shape[0]
    indices = np.arange(n)
    np.random.seed(42)
    np.random.shuffle(indices)
    folds = np.array_split(indices, n_folds)
    results = {}
    for lam in lambdas:
        mses = []
        for k in range(n_folds):
            test_idx = folds[k]
            train_idx = np.concatenate([folds[j] for j in range(n_folds) if j != k])
            beta = ridge_fit(X[train_idx], y[train_idx], lam)
            y_hat = ols_predict(X[test_idx], beta)
            mses.append(np.mean((y[test_idx] - y_hat) ** 2))
        results[lam] = {"mean_mse": float(np.mean(mses)), "std_mse": float(np.std(mses))}
    best_lam = min(results, key=lambda l: results[l]["mean_mse"])
    return best_lam, results


def _soft_threshold(rho, lam):
    if rho > lam:
        return rho - lam
    elif rho < -lam:
        return rho + lam
    return 0.0


def lasso_fit(X, y, lam, max_iter=200, tol=1e-5):
    n, p = X.shape
    X_mean = X.mean(axis=0)
    X_std = X.std(axis=0)
    X_std[X_std < 1e-10] = 1.0
    Xs = (X - X_mean) / X_std
    y_mean = y.mean()
    ys = y - y_mean
    # Pre-compute X'X diagonal and X'y for speed
    Xty = Xs.T @ ys / n
    beta = np.zeros(p)
    residual = ys.copy()
    for it in range(max_iter):
        beta_old = beta.copy()
        for j in range(p):
            # Update residual to exclude j-th feature
            rho = Xs[:, j] @ residual / n + beta[j]
            new_beta_j = _soft_threshold(rho, lam)
            if new_beta_j != beta[j]:
                residual += Xs[:, j] * (beta[j] - new_beta_j)
                beta[j] = new_beta_j
        if np.max(np.abs(beta - beta_old)) < tol:
            break
    beta_orig = beta / X_std
    intercept = y_mean - X_mean @ beta_orig
    return np.concatenate([[intercept], beta_orig])


def lasso_cv(X, y, lambdas, n_folds=5):
    n = X.shape[0]
    indices = np.arange(n)
    np.random.seed(42)
    np.random.shuffle(indices)
    folds = np.array_split(indices, n_folds)
    results = {}
    for lam in lambdas:
        mses = []
        for k in range(n_folds):
            test_idx = folds[k]
            train_idx = np.concatenate([folds[j] for j in range(n_folds) if j != k])
            beta = lasso_fit(X[train_idx], y[train_idx], lam)
            y_hat = ols_predict(X[test_idx], beta)
            mses.append(np.mean((y[test_idx] - y_hat) ** 2))
        results[lam] = {"mean_mse": float(np.mean(mses)), "std_mse": float(np.std(mses))}
    best_lam = min(results, key=lambda l: results[l]["mean_mse"])
    return best_lam, results


def stepwise_bic(X, y, feature_names):
    n, p = X.shape
    remaining = set(range(p))
    selected = []
    best_bic = _calc_bic(X[:, []], y, n, 0)
    for _ in range(p):
        best_feat = None
        best_bic_step = best_bic
        for feat in remaining:
            cols = selected + [feat]
            bic = _calc_bic(X[:, cols], y, n, len(cols))
            if bic < best_bic_step:
                best_bic_step = bic
                best_feat = feat
        if best_feat is None:
            break
        selected.append(best_feat)
        remaining.remove(best_feat)
        best_bic = best_bic_step
    return selected, [feature_names[s] for s in selected]


def _calc_bic(X_sub, y, n, k):
    if k == 0:
        ss_res = np.sum((y - np.mean(y)) ** 2)
    else:
        X1 = np.column_stack([np.ones(n), X_sub])
        try:
            beta = np.linalg.lstsq(X1, y, rcond=None)[0]
            ss_res = np.sum((y - X1 @ beta) ** 2)
        except Exception:
            return 1e18
    return n * np.log(max(ss_res / n, 1e-10)) + (k + 1) * np.log(n)


# ================================================================
#  4. Walk-Forward & Fama-MacBeth
# ================================================================

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
        train_idx, test_idx = [], []
        for d in train_dates:
            train_idx.extend(date_to_idx[d])
        for d in test_dates:
            test_idx.extend(date_to_idx[d])
        if len(train_idx) < 100 or len(test_idx) < 30:
            start += test_days
            continue
        if method == "ridge":
            beta = ridge_fit(X[train_idx], y[train_idx], lam)
        else:
            res = ols_fit(X[train_idx], y[train_idx])
            beta = res["beta"]
        y_hat = ols_predict(X[test_idx], beta)
        if np.std(y_hat) < 1e-10 or np.std(y[test_idx]) < 1e-10:
            start += test_days
            continue
        corr, pval = sp_stats.spearmanr(y_hat, y[test_idx])
        if np.isfinite(corr):
            results.append({"period": f"{test_dates[0]}~{test_dates[-1]}",
                            "ic": round(float(corr), 6), "n": len(test_idx)})
        start += test_days
    if not results:
        return None
    ics = np.array([r["ic"] for r in results])
    mean_ic = float(np.mean(ics))
    std_ic = float(np.std(ics, ddof=1)) if len(ics) > 1 else 0.0
    t_stat = mean_ic / (std_ic / np.sqrt(len(ics))) if std_ic > 0 else 0.0
    p_value = float(2 * sp_stats.t.sf(abs(t_stat), df=len(ics) - 1)) if len(ics) > 1 else 1.0
    return {
        "n_periods": len(results), "mean_ic": round(mean_ic, 6),
        "std_ic": round(std_ic, 6), "t_stat": round(t_stat, 4),
        "p_value": round(p_value, 6),
        "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
        "periods": results,
    }


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
        "n_days": n, "mean_ic": round(mean_ic, 6), "std_ic": round(std_ic, 6),
        "t_stat": round(t_stat, 4), "p_value": round(p_value, 6),
        "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
    }


def calc_ic(y_pred, y_actual):
    if len(y_pred) < 30:
        return None
    corr, pval = sp_stats.spearmanr(y_pred, y_actual)
    return {"ic": round(float(corr), 6), "p_value": round(float(pval), 6), "n": len(y_pred)}


# ================================================================
#  5. Collinearity Diagnostics (NEW)
# ================================================================

def compute_vif(X, feature_names):
    """
    Variance Inflation Factor: VIF_j = 1 / (1 - R^2_j)
    where R^2_j is from regressing feature j on all other features.
    Kutner et al. (2005): VIF > 5 moderate, > 10 severe.
    """
    n, p = X.shape
    vifs = {}
    for j in range(p):
        others = np.delete(X, j, axis=1)
        X1 = np.column_stack([np.ones(n), others])
        y_j = X[:, j]
        try:
            beta = np.linalg.lstsq(X1, y_j, rcond=None)[0]
            y_hat = X1 @ beta
            ss_res = np.sum((y_j - y_hat) ** 2)
            ss_tot = np.sum((y_j - np.mean(y_j)) ** 2)
            r2 = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
            vifs[feature_names[j]] = round(1.0 / (1.0 - r2) if r2 < 1.0 else 999.0, 2)
        except Exception:
            vifs[feature_names[j]] = 999.0
    return vifs


def compute_condition_number(X):
    """Condition number of X'X. Kutner: > 1000 problematic, > 10000 severe."""
    XtX = X.T @ X
    return float(np.linalg.cond(XtX))


# ================================================================
#  6. JSON Serialization
# ================================================================

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


# ================================================================
#  MAIN
# ================================================================

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

    print("=" * 70)
    print("  MRA Stage B-1: 23-Column Combined Model")
    print("  12 base + 6 indicators + 5 APT factors")
    print("=" * 70)

    # ── Step 1: Load CSV with 18 features ──
    print(f"\n[1/9] Loading CSV + 18 features (horizon={horizon})...")
    rows, indicator_present = load_csv_with_indicators(horizon)
    X18, y, dates, meta = rows_to_X18(rows)
    n = len(rows)
    print(f"  -> {n:,} samples, 18 features")
    if not indicator_present:
        print("  -> WARNING: Indicator columns missing (using defaults)")

    # ── Step 2: Load auxiliary data for APT factors ──
    print("\n[2/9] Loading auxiliary data (index, financials, OHLCV)...")
    index_info = load_index()
    financials = load_financials()
    print(f"  -> Index: {len(index_info)}, Financials: {len(financials)}")
    ohlcv = load_ohlcv_all(index_info)
    date_idx = build_date_index(ohlcv)

    # ── Step 3: Compute APT factors ──
    print("\n[3/9] Computing cap-weighted market returns + 5 APT factors...")
    mkt_returns = compute_market_returns(ohlcv, index_info, top_n=100)
    apt_raw = compute_apt_factors(rows, ohlcv, date_idx, mkt_returns, index_info, financials)

    apt_coverage = {}
    for j, fname in enumerate(APT_FACTOR_NAMES):
        valid = int(np.sum(~np.isnan(apt_raw[:, j])))
        pct = valid / n * 100
        apt_coverage[fname] = round(pct, 1)
        print(f"  -> {fname}: {valid:,}/{n:,} ({pct:.1f}%)")

    print("  -> Z-scoring (cross-sectional, MAD-robust, winsorized +/-3)...")
    apt_z = zscore_by_date(apt_raw, dates)

    # ── Step 4: Combine into 23-feature matrix ──
    X23 = np.column_stack([X18, apt_z])
    X12 = X18[:, :12]
    X6 = X18[:, :6]
    print(f"  -> Combined: {X23.shape[0]:,} x {X23.shape[1]} (23 features)")

    # ── Step 5: VIF + Condition Number diagnostics ──
    print("\n[4/9] Collinearity diagnostics...")
    vifs = compute_vif(X23, FEATURE_NAMES_23)
    cond_num = compute_condition_number(X23)
    print(f"  -> Condition number kappa(X'X): {cond_num:.1f}")
    severe = {k: v for k, v in vifs.items() if v > 10}
    moderate = {k: v for k, v in vifs.items() if 5 < v <= 10}
    if severe:
        print(f"  -> SEVERE VIF (>10): {severe}")
    if moderate:
        print(f"  -> Moderate VIF (5-10): {moderate}")
    if not severe and not moderate:
        print("  -> All VIF < 5 (acceptable)")

    # Print full VIF table
    print(f"\n  {'Feature':<20} {'VIF':>8} {'Status':>10}")
    for fname in FEATURE_NAMES_23:
        v = vifs[fname]
        status = "SEVERE" if v > 10 else ("moderate" if v > 5 else "ok")
        print(f"  {fname:<20} {v:>8.2f} {status:>10}")

    # ── Step 6: OLS baseline + Ridge CV + LASSO CV ──
    print("\n[5/9] Model fitting (OLS, Ridge CV, LASSO CV)...")

    # OLS 23-col
    ols23 = ols_fit(X23, y)
    y_hat_ols23 = ols_predict(X23, ols23["beta"])
    ic_ols23 = calc_ic(y_hat_ols23, y)

    # Print coefficient table
    print(f"\n  23-col OLS coefficients:")
    print(f"  {'Feature':<20} {'beta':>10} {'t-stat':>10} {'p-value':>10} {'sig':>5}")
    names_int = ["intercept"] + FEATURE_NAMES_23
    for j in range(len(ols23["beta"])):
        sig = "***" if ols23["p_values"][j] < 0.001 else "**" if ols23["p_values"][j] < 0.01 else "*" if ols23["p_values"][j] < 0.05 else ""
        print(f"  {names_int[j]:<20} {ols23['beta'][j]:>10.4f} {ols23['t_stats'][j]:>10.3f} {ols23['p_values'][j]:>10.4f} {sig:>5}")

    # Ridge CV (23-col)
    print("\n  Ridge CV (23-col, 5-fold)...")
    lambdas_ridge = [0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0]
    best_ridge_lam, ridge_results = ridge_cv(X23, y, lambdas_ridge)
    ridge_beta = ridge_fit(X23, y, best_ridge_lam)
    y_hat_ridge23 = ols_predict(X23, ridge_beta)
    ic_ridge23 = calc_ic(y_hat_ridge23, y)
    fm_ridge23 = fama_macbeth_ic(y_hat_ridge23, y, dates)
    for lam in lambdas_ridge:
        mark = " <-- best" if lam == best_ridge_lam else ""
        print(f"    lambda={lam:>6}: MSE={ridge_results[lam]['mean_mse']:.6f}{mark}")
    print(f"  -> Best lambda={best_ridge_lam}, IC={ic_ridge23['ic'] if ic_ridge23 else 'N/A'}")

    # LASSO CV (23-col) -- use subsample for speed
    print("\n  LASSO CV (23-col, 3-fold, subsampled 50K)...")
    y_std = np.std(y)
    lambdas_lasso = [y_std * f for f in [0.001, 0.005, 0.01]]
    # Subsample for LASSO speed (coordinate descent is O(n*p*iter))
    np.random.seed(99)
    lasso_sub = np.random.choice(n, min(50000, n), replace=False)
    best_lasso_lam, lasso_results = lasso_cv(X23[lasso_sub], y[lasso_sub], lambdas_lasso, n_folds=3)
    lasso_beta = lasso_fit(X23, y, best_lasso_lam)
    y_hat_lasso23 = ols_predict(X23, lasso_beta)
    ic_lasso23 = calc_ic(y_hat_lasso23, y)
    n_nonzero = int(np.sum(np.abs(lasso_beta[1:]) > 1e-8))
    lasso_selected = [FEATURE_NAMES_23[j] for j in range(23) if abs(lasso_beta[j + 1]) > 1e-8]
    print(f"  -> Best lambda={best_lasso_lam:.6f}, {n_nonzero}/23 features selected")
    print(f"  -> Selected: {lasso_selected}")

    # BIC forward selection (23-col)
    print("\n  BIC forward selection (23-col)...")
    bic_indices, bic_names = stepwise_bic(X23, y, FEATURE_NAMES_23)
    bic_ic = None
    if bic_indices:
        X_bic = X23[:, bic_indices]
        y_hat_bic = ols_predict(X_bic, ols_fit(X_bic, y)["beta"])
        bic_ic = calc_ic(y_hat_bic, y)
        print(f"  -> {len(bic_indices)} features: {bic_names}")
        print(f"  -> BIC IC={bic_ic['ic'] if bic_ic else 'N/A'}")

    # ── Step 7: Baseline models for comparison ──
    print("\n[6/9] Baseline model comparison...")

    # 6-col OLS
    ols6 = ols_fit(X6, y)
    y_hat_6 = ols_predict(X6, ols6["beta"])
    ic_6 = calc_ic(y_hat_6, y)
    fm_6 = fama_macbeth_ic(y_hat_6, y, dates)

    # 12-col Ridge
    ridge12_beta = ridge_fit(X12, y, 2.0)
    y_hat_12 = ols_predict(X12, ridge12_beta)
    ic_12 = calc_ic(y_hat_12, y)
    fm_12 = fama_macbeth_ic(y_hat_12, y, dates)

    # 18-col Ridge (indicators only)
    ridge18_lam, _ = ridge_cv(X18, y, [0.5, 1.0, 2.0, 5.0, 10.0])
    ridge18_beta = ridge_fit(X18, y, ridge18_lam)
    y_hat_18 = ols_predict(X18, ridge18_beta)
    ic_18 = calc_ic(y_hat_18, y)
    fm_18 = fama_macbeth_ic(y_hat_18, y, dates)

    # 17-col Ridge (APT only): 12 base + 5 APT
    X17 = np.column_stack([X12, apt_z])
    ridge17_lam, _ = ridge_cv(X17, y, [0.5, 1.0, 2.0, 5.0, 10.0])
    ridge17_beta = ridge_fit(X17, y, ridge17_lam)
    y_hat_17 = ols_predict(X17, ridge17_beta)
    ic_17 = calc_ic(y_hat_17, y)
    fm_17 = fama_macbeth_ic(y_hat_17, y, dates)

    # ── Step 8: Walk-Forward IC ──
    wf_6 = wf_12 = wf_18 = wf_17 = wf_23 = None
    if not quick:
        print("\n[7/9] Walk-Forward IC (60d train, 20d test)...")
        wf_23 = walk_forward_ic(X23, y, dates, method="ridge", lam=best_ridge_lam)
        wf_18 = walk_forward_ic(X18, y, dates, method="ridge", lam=ridge18_lam)
        wf_17 = walk_forward_ic(X17, y, dates, method="ridge", lam=ridge17_lam)
        wf_12 = walk_forward_ic(X12, y, dates, method="ridge", lam=2.0)
        wf_6 = walk_forward_ic(X6, y, dates, method="ols")

        for name, wf in [("6-col OLS", wf_6), ("12-col Ridge", wf_12),
                         ("17-col Ridge", wf_17), ("18-col Ridge", wf_18),
                         ("23-col Ridge", wf_23)]:
            if wf:
                print(f"  -> {name:<15} WF IC={wf['mean_ic']:.6f}, t={wf['t_stat']:.2f}, "
                      f"pos={wf['ic_positive_pct']}%")
    else:
        print("\n[7/9] Walk-Forward skipped (--quick)")

    # ── Step 9: Sequential APT factor contribution ──
    print("\n[8/9] Sequential factor addition (23-col Ridge)...")
    # First: 18-col baseline, then add APT factors one at a time
    print(f"  18-col baseline IC: {ic_18['ic']:.6f}")
    for j, fname in enumerate(APT_FACTOR_NAMES):
        X_plus = np.column_stack([X18, apt_z[:, :j + 1]])
        beta_plus = ridge_fit(X_plus, y, best_ridge_lam)
        y_hat_plus = ols_predict(X_plus, beta_plus)
        ic_plus = calc_ic(y_hat_plus, y)
        delta = ic_plus["ic"] - ic_18["ic"] if ic_plus and ic_18 else 0
        print(f"    +{fname:<18} IC={ic_plus['ic']:.6f} (delta={delta:+.6f})")

    # ── Stage B-2: Regime Interaction (HMM bull_prob) ──
    regime_wf = None
    regime_ic = None
    regime_fm = None
    regime_lam = best_ridge_lam
    regime_features = []
    if HMM_PATH.exists():
        print("\n[B-2] Regime-adaptive Ridge (HMM bull_prob interaction)...")
        with open(HMM_PATH, encoding="utf-8") as f:
            hmm_data = json.load(f)
        regime_map = {d["date"]: d["bull_prob"] for d in hmm_data.get("daily", [])}

        # Build regime feature vector
        bull_probs = np.array([regime_map.get(d, 0.5) for d in dates])
        # 3 interaction features: bull_prob, bull_prob * hw, bull_prob * vw
        bp_hw = bull_probs * X23[:, 0]   # hw is feature 0
        bp_vw = bull_probs * X23[:, 1]   # vw is feature 1
        X_regime = np.column_stack([X23, bull_probs, bp_hw, bp_vw])
        regime_features = FEATURE_NAMES_23 + ["bull_prob", "bull_prob_x_hw", "bull_prob_x_vw"]
        p_regime = X_regime.shape[1]
        print(f"  -> {p_regime}-col regime model ({len(regime_features)} features)")

        # Ridge CV for regime model
        regime_lam, _ = ridge_cv(X_regime, y, [0.5, 1.0, 2.0, 5.0, 10.0])
        regime_beta = ridge_fit(X_regime, y, regime_lam)
        y_hat_regime = ols_predict(X_regime, regime_beta)
        regime_ic = calc_ic(y_hat_regime, y)
        regime_fm = fama_macbeth_ic(y_hat_regime, y, dates)
        print(f"  -> Regime Ridge (lambda={regime_lam}): IC={regime_ic['ic']:.6f}, "
              f"FM IC={regime_fm['mean_ic']:.6f} (t={regime_fm['t_stat']:.2f})")

        # OLS for interaction term significance
        ols_reg = ols_fit(X_regime, y)
        reg_names_int = ["intercept"] + regime_features
        print(f"\n  Regime interaction coefficients:")
        for j in range(23 + 1, len(ols_reg["beta"])):  # +1 for intercept
            fname = reg_names_int[j]
            sig = "***" if ols_reg["p_values"][j] < 0.001 else "**" if ols_reg["p_values"][j] < 0.01 else "*" if ols_reg["p_values"][j] < 0.05 else ""
            print(f"    {fname:<20} beta={ols_reg['beta'][j]:>10.4f} t={ols_reg['t_stats'][j]:>8.3f} {sig}")

        # Walk-Forward for regime model
        if not quick:
            regime_wf = walk_forward_ic(X_regime, y, dates, method="ridge", lam=regime_lam)
            if regime_wf:
                print(f"  -> Regime WF IC={regime_wf['mean_ic']:.6f}, t={regime_wf['t_stat']:.2f}, "
                      f"pos={regime_wf['ic_positive_pct']}%")
                if wf_23:
                    delta = regime_wf["mean_ic"] - wf_23["mean_ic"]
                    print(f"  -> Delta vs 23-col: {delta:+.6f}")
    else:
        print("\n[B-2] Skipped (hmm_regimes.json not found)")

    # ── Summary ──
    elapsed = time.time() - t0
    print("\n" + "=" * 70)
    print("  MODEL COMPARISON SUMMARY (MRA Stage B-1 + B-2)")
    print("=" * 70)
    print(f"  {'Model':<22} {'In-sample IC':>14} {'FM IC':>10} {'FM t':>8} {'WF IC':>10} {'WF t':>8}")
    models_summary = [
        ("6-col OLS", ic_6, fm_6, wf_6),
        ("12-col Ridge", ic_12, fm_12, wf_12),
        ("18-col Ridge", ic_18, fm_18, wf_18),
        ("17-col Ridge (APT)", ic_17, fm_17, wf_17),
        ("23-col Ridge", ic_ridge23, fm_ridge23, wf_23),
        ("26-col Regime", regime_ic, regime_fm, regime_wf),
    ]
    for name, ic, fm, wf in models_summary:
        ic_v = f"{ic['ic']:.6f}" if ic else "N/A"
        fm_v = f"{fm['mean_ic']:.6f}" if fm else "-"
        fm_t = f"{fm['t_stat']:.2f}" if fm else "-"
        wf_v = f"{wf['mean_ic']:.6f}" if wf else "-"
        wf_t = f"{wf['t_stat']:.2f}" if wf else "-"
        print(f"  {name:<22} {ic_v:>14} {fm_v:>10} {fm_t:>8} {wf_v:>10} {wf_t:>8}")

    print(f"\n  23-col Ridge lambda: {best_ridge_lam}")
    print(f"  LASSO: {n_nonzero}/23 features survive")
    print(f"  BIC: {len(bic_indices)} features selected")
    print(f"  Condition number: {cond_num:.1f}")
    if severe:
        print(f"  WARNING: Severe VIF (>10): {list(severe.keys())}")
    print(f"\n  Total time: {elapsed:.1f}s")

    # ── Save results JSON ──
    print("\n[9/9] Saving results...")
    output = {
        "stage": "B-1",
        "description": "23-col Combined Model (12 base + 6 indicators + 5 APT)",
        "horizon": horizon,
        "n_samples": n,
        "feature_names_23": FEATURE_NAMES_23,
        "apt_factor_coverage": apt_coverage,
        "collinearity": {
            "condition_number": round(cond_num, 1),
            "vif": vifs,
            "severe_vif": list(severe.keys()) if severe else [],
            "moderate_vif": list(moderate.keys()) if moderate else [],
        },
        "models": {
            "ols_6col": {"in_sample_ic": _to_native(ic_6), "fama_macbeth": _to_native(fm_6)},
            "ridge_12col": {"lambda": 2.0, "in_sample_ic": _to_native(ic_12), "fama_macbeth": _to_native(fm_12)},
            "ridge_18col": {"lambda": ridge18_lam, "in_sample_ic": _to_native(ic_18), "fama_macbeth": _to_native(fm_18)},
            "ridge_17col": {"lambda": ridge17_lam, "in_sample_ic": _to_native(ic_17), "fama_macbeth": _to_native(fm_17)},
            "ridge_23col": {
                "lambda": best_ridge_lam,
                "in_sample_ic": _to_native(ic_ridge23),
                "fama_macbeth": _to_native(fm_ridge23),
                "cv_results": {str(k): v for k, v in ridge_results.items()},
            },
            "lasso_23col": {
                "lambda": best_lasso_lam,
                "in_sample_ic": _to_native(ic_lasso23),
                "n_selected": n_nonzero,
                "selected_features": lasso_selected,
            },
            "bic_23col": {
                "n_selected": len(bic_indices),
                "selected_features": bic_names,
                "in_sample_ic": _to_native(bic_ic),
            },
        },
        "ols_23col_coefficients": {
            names_int[j]: {
                "beta": round(float(ols23["beta"][j]), 6),
                "t_stat": round(float(ols23["t_stats"][j]), 4),
                "p_value": round(float(ols23["p_values"][j]), 6),
            }
            for j in range(len(ols23["beta"]))
        },
        "walk_forward": {
            "ols_6col": _to_native(wf_6) if wf_6 else None,
            "ridge_12col": _to_native(wf_12) if wf_12 else None,
            "ridge_18col": _to_native(wf_18) if wf_18 else None,
            "ridge_17col": _to_native(wf_17) if wf_17 else None,
            "ridge_23col": _to_native(wf_23) if wf_23 else None,
            "regime_26col": _to_native(regime_wf) if regime_wf else None,
        },
        "regime_interaction": {
            "n_features": len(regime_features),
            "feature_names": regime_features,
            "lambda": regime_lam,
            "in_sample_ic": _to_native(regime_ic) if regime_ic else None,
            "fama_macbeth": _to_native(regime_fm) if regime_fm else None,
        } if regime_features else None,
        "elapsed_seconds": round(elapsed, 1),
    }

    out_path = BACKTEST_DIR / "mra_combined_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(output), f, ensure_ascii=False, indent=2)
    print(f"  -> Results: {out_path}")

    # Save 23-col coefficients for JS runtime
    coeff_path = BACKTEST_DIR / "mra_combined_coefficients.json"
    coeff_output = {
        "model": "ridge_23col",
        "lambda": best_ridge_lam,
        "horizon": horizon,
        "n_samples": n,
        "feature_names": ["intercept"] + FEATURE_NAMES_23,
        "coefficients": [round(float(ridge_beta[j]), 8) for j in range(len(ridge_beta))],
        "apt_factors": {
            fname: {
                "description": desc,
                "z_scored": True,
                "coverage_pct": apt_coverage.get(fname, 0),
            }
            for fname, desc in zip(APT_FACTOR_NAMES, [
                "60-day return (Jegadeesh & Titman 1993)",
                "60-day rolling beta vs market (Sharpe 1964)",
                "1/PBR value factor (Fama & French 1993)",
                "log(marketCap) size factor (Fama & French 1993)",
                "20-day avg turnover (Amihud 2002)",
            ])
        },
    }
    with open(coeff_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(coeff_output), f, ensure_ascii=False, indent=2)
    print(f"  -> Coefficients: {coeff_path}")
    print("\nDone.")


if __name__ == "__main__":
    main()
