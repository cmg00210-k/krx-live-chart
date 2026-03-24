#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mra_extended.py — Stage A-1: 12-Column Extended MRA + LASSO/Ridge + Walk-Forward IC

Input:  data/backtest/wc_return_pairs.csv (302,986 rows)
Output: data/backtest/mra_extended_results.json

Analysis Pipeline:
  1. Derive 6 new features from existing CSV columns (total 12 regressors)
  2. OLS baseline (6-col vs 12-col IC comparison)
  3. Ridge CV (manual λ grid search, 5-fold)
  4. LASSO CV (coordinate descent, 5-fold)
  5. Stepwise BIC forward selection
  6. Walk-Forward rolling IC (60-day train, 20-day test)
  7. vw sign-reversal partial regression test
  8. Export optimal coefficients to mra_coefficients.json

References:
  - core_data/17_regression §17.7 (Ridge 8-var)
  - project_mra_rl_roadmap.md (Stage A-1 spec)
  - project_vw_root_cause_analysis.md (vw defect)

Usage:
    python scripts/mra_extended.py
    python scripts/mra_extended.py --horizon 5    (default: 5)
    python scripts/mra_extended.py --quick         (skip walk-forward, faster)
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

# Tier classification from Phase A findings
TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers", "invertedHammer"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

# 12 feature names (6 original + 6 derived)
FEATURE_NAMES = [
    # Original 6
    "hw", "vw", "mw", "rw", "confidence_norm", "signal_dir",
    # Derived 6
    "market_type", "log_confidence", "pattern_tier",
    "hw_x_signal", "vw_x_signal", "conf_x_signal",
]


# ──────────────────────────────────────────────
# 1. Data Loading + Feature Engineering
# ──────────────────────────────────────────────

def load_and_engineer(horizon):
    """Load CSV, derive 6 new features, return X (n×12), y (n,), metadata."""
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
                tier = 2.0  # default mid-tier

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
        meta.append({"code": r["code"], "type": r["type"], "signal": r["signal"]})

    return X, y, dates, meta


# ──────────────────────────────────────────────
# 2. OLS (closed-form)
# ──────────────────────────────────────────────

def ols_fit(X, y):
    """OLS with intercept: β = (XᵀX)⁻¹Xᵀy"""
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    try:
        XtX = X1.T @ X1
        Xty = X1.T @ y
        beta = np.linalg.solve(XtX, Xty)
    except np.linalg.LinAlgError:
        beta = np.linalg.lstsq(X1, y, rcond=None)[0]

    y_hat = X1 @ beta
    ss_res = np.sum((y - y_hat) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    adj_r2 = 1 - (1 - r2) * (n - 1) / (n - p - 2) if n > p + 2 else r2

    # t-statistics
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

    return {
        "beta": beta,
        "r2": r2,
        "adj_r2": adj_r2,
        "t_stats": t_stats,
        "p_values": p_values,
        "sigma2": sigma2,
    }


def ols_predict(X, beta):
    """Predict with intercept."""
    n = X.shape[0]
    X1 = np.column_stack([np.ones(n), X])
    return X1 @ beta


# ──────────────────────────────────────────────
# 3. Ridge Regression (closed-form)
# ──────────────────────────────────────────────

def ridge_fit(X, y, lam):
    """Ridge: β = (XᵀX + λI)⁻¹Xᵀy (with intercept unpenalized)"""
    n, p = X.shape
    X1 = np.column_stack([np.ones(n), X])
    XtX = X1.T @ X1
    # Don't penalize intercept
    penalty = lam * np.eye(p + 1)
    penalty[0, 0] = 0
    beta = np.linalg.solve(XtX + penalty, X1.T @ y)
    return beta


def ridge_cv(X, y, lambdas, n_folds=5):
    """K-fold CV for Ridge, returns best lambda + all MSEs."""
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
            X_tr, y_tr = X[train_idx], y[train_idx]
            X_te, y_te = X[test_idx], y[test_idx]
            beta = ridge_fit(X_tr, y_tr, lam)
            y_hat = ols_predict(X_te, beta)
            mses.append(np.mean((y_te - y_hat) ** 2))
        results[lam] = {"mean_mse": float(np.mean(mses)), "std_mse": float(np.std(mses))}

    best_lam = min(results, key=lambda l: results[l]["mean_mse"])
    return best_lam, results


# ──────────────────────────────────────────────
# 4. LASSO (Coordinate Descent)
# ──────────────────────────────────────────────

def lasso_fit(X, y, lam, max_iter=1000, tol=1e-6):
    """LASSO via coordinate descent (intercept unpenalized)."""
    n, p = X.shape
    # Standardize X for coordinate descent (keep track for de-standardization)
    X_mean = X.mean(axis=0)
    X_std = X.std(axis=0)
    X_std[X_std < 1e-10] = 1.0
    Xs = (X - X_mean) / X_std
    y_mean = y.mean()
    ys = y - y_mean

    beta = np.zeros(p)
    for _ in range(max_iter):
        beta_old = beta.copy()
        for j in range(p):
            r_j = ys - Xs @ beta + Xs[:, j] * beta[j]
            rho = Xs[:, j] @ r_j / n
            beta[j] = _soft_threshold(rho, lam)
        if np.max(np.abs(beta - beta_old)) < tol:
            break

    # De-standardize
    beta_orig = beta / X_std
    intercept = y_mean - X_mean @ beta_orig
    full_beta = np.concatenate([[intercept], beta_orig])
    return full_beta


def _soft_threshold(rho, lam):
    if rho > lam:
        return rho - lam
    elif rho < -lam:
        return rho + lam
    return 0.0


def lasso_cv(X, y, lambdas, n_folds=5):
    """K-fold CV for LASSO."""
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
            X_tr, y_tr = X[train_idx], y[train_idx]
            X_te, y_te = X[test_idx], y[test_idx]
            beta = lasso_fit(X_tr, y_tr, lam)
            y_hat = ols_predict(X_te, beta)
            mses.append(np.mean((y_te - y_hat) ** 2))
        results[lam] = {"mean_mse": float(np.mean(mses)), "std_mse": float(np.std(mses))}

    best_lam = min(results, key=lambda l: results[l]["mean_mse"])
    return best_lam, results


# ──────────────────────────────────────────────
# 5. Stepwise BIC Forward Selection
# ──────────────────────────────────────────────

def stepwise_bic(X, y):
    """Forward stepwise selection by BIC."""
    n, p = X.shape
    remaining = set(range(p))
    selected = []
    best_bic = _calc_bic(X[:, []], y, n, 0)  # intercept-only
    history = [{"step": 0, "features": [], "bic": best_bic}]

    for step in range(p):
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
        history.append({
            "step": step + 1,
            "added": FEATURE_NAMES[best_feat],
            "features": [FEATURE_NAMES[s] for s in selected],
            "bic": best_bic,
        })

    return selected, history


def _calc_bic(X_sub, y, n, k):
    """BIC = n*ln(SSR/n) + (k+1)*ln(n)"""
    if k == 0:
        ss_res = np.sum((y - np.mean(y)) ** 2)
    else:
        X1 = np.column_stack([np.ones(n), X_sub])
        try:
            beta = np.linalg.lstsq(X1, y, rcond=None)[0]
            y_hat = X1 @ beta
            ss_res = np.sum((y - y_hat) ** 2)
        except Exception:
            return 1e18
    if ss_res <= 0:
        ss_res = 1e-10
    return n * np.log(ss_res / n) + (k + 1) * np.log(n)


# ──────────────────────────────────────────────
# 6. Walk-Forward Rolling IC
# ──────────────────────────────────────────────

def walk_forward_ic(X, y, dates, train_days=60, test_days=20, method="ridge", lam=1.0):
    """
    Rolling walk-forward: train on T days, predict next T' days, measure IC.
    Returns list of {period, ic, n} + summary stats.
    """
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
                "p_value": round(float(pval), 6),
            })

        start += test_days

    if not results:
        return None

    ics = np.array([r["ic"] for r in results])
    mean_ic = float(np.mean(ics))
    std_ic = float(np.std(ics, ddof=1)) if len(ics) > 1 else 0.0
    t_stat = mean_ic / (std_ic / np.sqrt(len(ics))) if std_ic > 0 else 0.0
    p_value = float(2 * sp_stats.t.sf(abs(t_stat), df=len(ics) - 1)) if len(ics) > 1 else 1.0

    return {
        "n_periods": len(results),
        "mean_ic": round(mean_ic, 6),
        "std_ic": round(std_ic, 6),
        "t_stat": round(t_stat, 4),
        "p_value": round(p_value, 6),
        "ic_positive_pct": round(float(np.mean(ics > 0) * 100), 1),
        "sharpe_of_ic": round(mean_ic / std_ic, 4) if std_ic > 0 else 0.0,
        "periods": results,
    }


# ──────────────────────────────────────────────
# 7. vw Sign-Reversal Partial Regression
# ──────────────────────────────────────────────

def vw_partial_regression(X, y):
    """
    Test vw vs vw_reversed = sqrt(ATR14/ATR50) ~ 1/vw
    Since vw = 1/sqrt(ATR14/ATR50), reversed = 1/vw (bounded).
    Compare partial IC controlling for other variables.
    """
    vw_col = FEATURE_NAMES.index("vw")
    other_cols = [j for j in range(len(FEATURE_NAMES)) if j != vw_col]

    # Partial regression: regress y on others, regress vw on others, correlate residuals
    X_others = X[:, other_cols]

    # y ~ others
    res_y = ols_fit(X_others, y)
    y_resid = y - ols_predict(X_others, res_y["beta"])

    # vw ~ others
    vw_vals = X[:, vw_col]
    res_vw = ols_fit(X_others, vw_vals)
    vw_resid = vw_vals - ols_predict(X_others, res_vw["beta"])

    # Partial IC (original vw)
    if np.std(vw_resid) > 1e-10:
        corr_orig, p_orig = sp_stats.spearmanr(vw_resid, y_resid)
    else:
        corr_orig, p_orig = 0.0, 1.0

    # vw_reversed = 1/vw (safe clamp)
    vw_reversed = np.where(vw_vals > 0.01, 1.0 / vw_vals, 1.0)
    res_vwr = ols_fit(X_others, vw_reversed)
    vwr_resid = vw_reversed - ols_predict(X_others, res_vwr["beta"])

    if np.std(vwr_resid) > 1e-10:
        corr_rev, p_rev = sp_stats.spearmanr(vwr_resid, y_resid)
    else:
        corr_rev, p_rev = 0.0, 1.0

    return {
        "original_vw": {
            "partial_ic": round(float(corr_orig), 6),
            "p_value": round(float(p_orig), 6),
        },
        "reversed_vw": {
            "partial_ic": round(float(corr_rev), 6),
            "p_value": round(float(p_rev), 6),
        },
        "recommendation": (
            "reverse_vw" if corr_rev > corr_orig + 0.005
            else "keep_original" if corr_orig > corr_rev + 0.005
            else "negligible_difference"
        ),
    }


# ──────────────────────────────────────────────
# 8. Spearman IC helper
# ──────────────────────────────────────────────

def calc_prediction_ic(y_pred, y_actual):
    """Spearman rank correlation between predicted and actual returns."""
    if len(y_pred) < 30:
        return None
    corr, pval = sp_stats.spearmanr(y_pred, y_actual)
    return {
        "ic": round(float(corr), 6),
        "p_value": round(float(pval), 6),
        "n": len(y_pred),
    }


# ──────────────────────────────────────────────
# 9. Fama-MacBeth daily IC for predictions
# ──────────────────────────────────────────────

def fama_macbeth_prediction_ic(y_pred, y_actual, dates):
    """Daily cross-sectional IC → time-series t-test."""
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
    quick = False
    for i, a in enumerate(args):
        if a == "--horizon" and i + 1 < len(args):
            horizon = int(args[i + 1])
        if a == "--quick":
            quick = True

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest first.")
        sys.exit(1)

    # ── Step 1: Load + Feature Engineering ──
    print(f"[1/7] Loading CSV + engineering 12 features (horizon={horizon})...")
    X, y, dates, meta = load_and_engineer(horizon)
    n, p = X.shape
    print(f"  -> {n:,} samples, {p} features")

    # ── Step 2: OLS Baseline (6-col vs 12-col) ──
    print("[2/7] OLS Baseline...")
    # 6-col: hw, vw, mw, rw, confidence_norm, signal_dir (indices 0~5)
    X6 = X[:, :6]
    ols6 = ols_fit(X6, y)
    y_hat_6 = ols_predict(X6, ols6["beta"])
    ic6 = calc_prediction_ic(y_hat_6, y)

    # 12-col: all features
    ols12 = ols_fit(X, y)
    y_hat_12 = ols_predict(X, ols12["beta"])
    ic12 = calc_prediction_ic(y_hat_12, y)

    print(f"  -> 6-col OLS: R²={ols6['r2']:.6f}, IC={ic6['ic'] if ic6 else 'N/A'}")
    print(f"  -> 12-col OLS: R²={ols12['r2']:.6f}, IC={ic12['ic'] if ic12 else 'N/A'}")

    # Feature significance table
    print("  -> 12-col OLS coefficients:")
    print(f"     {'Feature':<20} {'beta':>10} {'t-stat':>10} {'p-value':>10} {'sig':>5}")
    names_with_intercept = ["intercept"] + FEATURE_NAMES
    for j in range(len(ols12["beta"])):
        sig = "***" if ols12["p_values"][j] < 0.001 else "**" if ols12["p_values"][j] < 0.01 else "*" if ols12["p_values"][j] < 0.05 else ""
        print(f"     {names_with_intercept[j]:<20} {ols12['beta'][j]:>10.4f} {ols12['t_stats'][j]:>10.3f} {ols12['p_values'][j]:>10.4f} {sig:>5}")

    # ── Step 3: Ridge CV ──
    print("[3/7] Ridge CV (5-fold)...")
    lambdas_ridge = [0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0, 100.0, 500.0, 1000.0]
    best_ridge_lam, ridge_results = ridge_cv(X, y, lambdas_ridge)
    ridge_beta = ridge_fit(X, y, best_ridge_lam)
    y_hat_ridge = ols_predict(X, ridge_beta)
    ic_ridge = calc_prediction_ic(y_hat_ridge, y)
    print(f"  -> Best λ={best_ridge_lam}, IC={ic_ridge['ic'] if ic_ridge else 'N/A'}")

    # ── Step 4: LASSO CV ──
    print("[4/7] LASSO CV (5-fold)...")
    # Scale lambdas relative to data
    y_std = np.std(y)
    lambdas_lasso = [y_std * f for f in [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5]]
    best_lasso_lam, lasso_results = lasso_cv(X, y, lambdas_lasso)
    lasso_beta = lasso_fit(X, y, best_lasso_lam)
    y_hat_lasso = ols_predict(X, lasso_beta)
    ic_lasso = calc_prediction_ic(y_hat_lasso, y)

    # Count non-zero coefficients (excluding intercept)
    n_nonzero = np.sum(np.abs(lasso_beta[1:]) > 1e-8)
    selected_by_lasso = [FEATURE_NAMES[j] for j in range(p) if abs(lasso_beta[j + 1]) > 1e-8]
    print(f"  -> Best λ={best_lasso_lam:.6f}, IC={ic_lasso['ic'] if ic_lasso else 'N/A'}")
    print(f"  -> {n_nonzero}/{p} features selected: {selected_by_lasso}")

    # ── Step 5: Stepwise BIC ──
    print("[5/7] Stepwise BIC forward selection...")
    bic_selected, bic_history = stepwise_bic(X, y)
    bic_names = [FEATURE_NAMES[s] for s in bic_selected]
    if bic_selected:
        X_bic = X[:, bic_selected]
        ols_bic = ols_fit(X_bic, y)
        y_hat_bic = ols_predict(X_bic, ols_bic["beta"])
        ic_bic = calc_prediction_ic(y_hat_bic, y)
        print(f"  -> {len(bic_selected)} features selected: {bic_names}")
        print(f"  -> BIC model IC={ic_bic['ic'] if ic_bic else 'N/A'}")
    else:
        ic_bic = None
        ols_bic = None

    # ── Step 6: Walk-Forward IC ──
    wf_result = None
    wf_result_6col = None
    if not quick:
        print("[6/7] Walk-Forward rolling IC (60-day train, 20-day test)...")
        wf_result = walk_forward_ic(X, y, dates, train_days=60, test_days=20,
                                     method="ridge", lam=best_ridge_lam)
        if wf_result:
            print(f"  -> 12-col Ridge WF: mean_IC={wf_result['mean_ic']}, "
                  f"t={wf_result['t_stat']}, positive={wf_result['ic_positive_pct']}%")

        # Compare with 6-col OLS walk-forward
        wf_result_6col = walk_forward_ic(X6, y, dates, train_days=60, test_days=20,
                                          method="ols")
        if wf_result_6col:
            print(f"  -> 6-col OLS WF: mean_IC={wf_result_6col['mean_ic']}, "
                  f"t={wf_result_6col['t_stat']}, positive={wf_result_6col['ic_positive_pct']}%")
    else:
        print("[6/7] Walk-Forward skipped (--quick mode)")

    # ── Step 7: vw Sign-Reversal ──
    print("[7/7] vw sign-reversal partial regression...")
    vw_test = vw_partial_regression(X, y)
    print(f"  -> Original vw partial IC={vw_test['original_vw']['partial_ic']}, "
          f"p={vw_test['original_vw']['p_value']}")
    print(f"  -> Reversed vw partial IC={vw_test['reversed_vw']['partial_ic']}, "
          f"p={vw_test['reversed_vw']['p_value']}")
    print(f"  -> Recommendation: {vw_test['recommendation']}")

    # ── Fama-MacBeth for best model ──
    print("\n[Extra] Fama-MacBeth daily IC (12-col Ridge)...")
    fm_12 = fama_macbeth_prediction_ic(y_hat_ridge, y, dates)
    if fm_12:
        print(f"  -> mean_IC={fm_12['mean_ic']}, t={fm_12['t_stat']}, "
              f"positive={fm_12['ic_positive_pct']}%")

    fm_6 = fama_macbeth_prediction_ic(y_hat_6, y, dates)
    if fm_6:
        print(f"  -> 6-col OLS FM: mean_IC={fm_6['mean_ic']}, t={fm_6['t_stat']}")

    # ── Summary comparison ──
    print("\n" + "=" * 60)
    print("MODEL COMPARISON SUMMARY")
    print("=" * 60)
    models = [
        ("6-col OLS", ic6, fm_6),
        ("12-col OLS", ic12, None),
        ("12-col Ridge", ic_ridge, fm_12),
        ("12-col LASSO", ic_lasso, None),
        ("BIC-selected OLS", ic_bic, None),
    ]
    print(f"  {'Model':<20} {'In-sample IC':>15} {'FM mean IC':>15} {'FM t-stat':>12}")
    for name, ic, fm in models:
        ic_val = f"{ic['ic']:.6f}" if ic else "N/A"
        fm_ic = f"{fm['mean_ic']:.6f}" if fm else "-"
        fm_t = f"{fm['t_stat']:.2f}" if fm else "-"
        print(f"  {name:<20} {ic_val:>15} {fm_ic:>15} {fm_t:>12}")

    if wf_result and wf_result_6col:
        print(f"\n  Walk-Forward IC:")
        print(f"  {'6-col OLS':<20} mean={wf_result_6col['mean_ic']:.6f}, "
              f"t={wf_result_6col['t_stat']:.2f}, positive={wf_result_6col['ic_positive_pct']}%")
        print(f"  {'12-col Ridge':<20} mean={wf_result['mean_ic']:.6f}, "
              f"t={wf_result['t_stat']:.2f}, positive={wf_result['ic_positive_pct']}%")

    elapsed = time.time() - t0
    print(f"\n  Total time: {elapsed:.1f}s")

    # ── Build output JSON ──
    output = {
        "horizon": horizon,
        "n_samples": n,
        "n_features": p,
        "feature_names": FEATURE_NAMES,
        "models": {
            "ols_6col": {
                "r2": round(ols6["r2"], 6),
                "adj_r2": round(ols6["adj_r2"], 6),
                "in_sample_ic": ic6,
                "fama_macbeth": fm_6,
            },
            "ols_12col": {
                "r2": round(ols12["r2"], 6),
                "adj_r2": round(ols12["adj_r2"], 6),
                "in_sample_ic": ic12,
                "coefficients": {
                    names_with_intercept[j]: {
                        "beta": round(float(ols12["beta"][j]), 6),
                        "t_stat": round(float(ols12["t_stats"][j]), 4),
                        "p_value": round(float(ols12["p_values"][j]), 6),
                    }
                    for j in range(len(ols12["beta"]))
                },
            },
            "ridge_12col": {
                "best_lambda": best_ridge_lam,
                "in_sample_ic": ic_ridge,
                "fama_macbeth": fm_12,
                "coefficients": {
                    names_with_intercept[j]: round(float(ridge_beta[j]), 6)
                    for j in range(len(ridge_beta))
                },
                "cv_results": {str(k): v for k, v in ridge_results.items()},
            },
            "lasso_12col": {
                "best_lambda": round(best_lasso_lam, 8),
                "in_sample_ic": ic_lasso,
                "n_selected": int(n_nonzero),
                "selected_features": selected_by_lasso,
                "coefficients": {
                    names_with_intercept[j]: round(float(lasso_beta[j]), 6)
                    for j in range(len(lasso_beta))
                },
            },
            "bic_stepwise": {
                "selected_features": bic_names,
                "n_selected": len(bic_selected),
                "in_sample_ic": ic_bic,
                "history": bic_history,
            },
        },
        "walk_forward": {
            "ols_6col": _to_native(wf_result_6col) if wf_result_6col else None,
            "ridge_12col": _to_native(wf_result) if wf_result else None,
        },
        "vw_sign_reversal": vw_test,
        "elapsed_seconds": round(elapsed, 1),
    }

    # Save results
    out_path = BACKTEST_DIR / "mra_extended_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(output), f, ensure_ascii=False, indent=2)
    print(f"\n  Output: {out_path}")

    # Save optimal coefficients for JS runtime
    coeff_path = BACKTEST_DIR / "mra_coefficients.json"
    best_model = "ridge_12col"
    coeff_output = {
        "model": best_model,
        "lambda": best_ridge_lam,
        "horizon": horizon,
        "n_samples": n,
        "feature_names": ["intercept"] + FEATURE_NAMES,
        "coefficients": [round(float(ridge_beta[j]), 8) for j in range(len(ridge_beta))],
        "feature_engineering": {
            "signal_dir": "buy=+1, sell=-1, neutral=0",
            "market_type": "kosdaq=1, kospi=0",
            "log_confidence": "ln(max(confidence, 1))",
            "pattern_tier": "tier1=1, tier2=2, tier3=3",
            "hw_x_signal": "hw * signal_dir",
            "vw_x_signal": "vw * signal_dir",
            "conf_x_signal": "confidence_norm * signal_dir",
        },
    }
    with open(coeff_path, "w", encoding="utf-8") as f:
        json.dump(_to_native(coeff_output), f, ensure_ascii=False, indent=2)
    print(f"  Coefficients: {coeff_path}")
    print("  Done.")


if __name__ == "__main__":
    main()
