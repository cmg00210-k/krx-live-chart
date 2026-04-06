#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_stage_b.py — Stage B-4: Walk-Forward LinUCB Training + IC Validation

Main pipeline:
  1. Load rl_context.csv (10-dim context) + rl_residuals.csv (y_pred, y_actual)
  2. For each of 8 walk-forward periods:
     a. TRAIN: LinUCB online learning (alpha=2.0 → 0.5 schedule)
     b. TEST:  Greedy action selection (alpha=0), compute adjusted predictions
     c. EVAL:  Spearman IC (original vs adjusted), per-tier/signal breakdown
  3. Aggregate results, check abort criteria
  4. Export rl_policy.json (for JS integration) + rl_stage_b_results.json

Abort Criteria:
  - After period 4: IC_adjusted <= IC_original → STOP
  - After period 8: IC_adjusted < 0.060 → SKIP B-5
  - Any action >90% frequency → LinUCB not discriminating
  - Train IC > 2× test IC consistently → OVERFITTING

References:
  - Li et al. (2010) LinUCB
  - Stage B plan: project_stage_b_rl_plan.md
  - B-1 baseline: WF IC = 0.057

Usage:
    python scripts/rl_stage_b.py
    python scripts/rl_stage_b.py --alpha 1.5    (exploration parameter)
    python scripts/rl_stage_b.py --no-schedule   (constant alpha)
    python scripts/rl_stage_b.py --window 3      (sliding window: last 3 periods)
    python scripts/rl_stage_b.py --window 0      (cumulative: all prior periods)
"""

import csv
import datetime
import json
import math
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import stats as sp_stats

# Import LinUCB from B-3
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rl_linucb import LinUCB, ACTION_FACTORS, ACTION_NAMES, K_ACTIONS, compute_reward

ROOT = Path(__file__).resolve().parent.parent
BACKTEST_DIR = ROOT / "data" / "backtest"
CONTEXT_CSV = BACKTEST_DIR / "rl_context.csv"
RESID_CSV = BACKTEST_DIR / "rl_residuals.csv"
OUT_RESULTS = BACKTEST_DIR / "rl_stage_b_results.json"
OUT_POLICY = BACKTEST_DIR / "rl_policy.json"

TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

CONTEXT_DIM = 7  # 10→7: removed resid_sign/mag_z/run_len (runtime N/A, Li et al. regret bound)
MIN_TRAIN_FOR_EVAL = 119000  # minimum samples seen before evaluating IC (Period 5+ stable)


# ──────────────────────────────────────────────
# Data Loading
# ──────────────────────────────────────────────

def load_data():
    """Load context features and residuals, aligned by row."""
    contexts = []
    meta = []

    with open(CONTEXT_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        context_cols = [
            "ewma_vol", "pred_magnitude", "signal_dir",
            "market_type", "pattern_tier", "confidence_norm", "raw_hurst",
        ]
        for row in reader:
            ctx = np.array([float(row[c]) for c in context_cols])
            contexts.append(ctx)
            meta.append({
                "date": row["date"],
                "code": row["code"],
                "market": row["market"],
                "type": row["type"],
                "signal": row["signal"],
                "y_pred": float(row["y_pred"]),
                "y_actual": float(row["y_actual"]),
                "residual": float(row["residual"]),
                "wf_period": int(row["wf_period"]),
            })

    return np.array(contexts), meta


# ──────────────────────────────────────────────
# IC Computation
# ──────────────────────────────────────────────

def compute_ic(y_pred, y_actual):
    """Spearman IC between predicted and actual."""
    if len(y_pred) < 30:
        return None, None
    if np.std(y_pred) < 1e-10 or np.std(y_actual) < 1e-10:
        return None, None
    corr, pval = sp_stats.spearmanr(y_pred, y_actual)
    if np.isfinite(corr):
        return float(corr), float(pval)
    return None, None


def compute_ic_by_group(meta_subset, y_adjusted, y_original, group_fn):
    """Compute IC breakdown by grouping function."""
    groups = defaultdict(lambda: {"adj": [], "orig": [], "actual": []})
    for i, m in enumerate(meta_subset):
        key = group_fn(m)
        groups[key]["adj"].append(y_adjusted[i])
        groups[key]["orig"].append(y_original[i])
        groups[key]["actual"].append(m["y_actual"])

    result = {}
    for key, g in sorted(groups.items()):
        if len(g["actual"]) < 30:
            continue
        ic_adj, _ = compute_ic(np.array(g["adj"]), np.array(g["actual"]))
        ic_orig, _ = compute_ic(np.array(g["orig"]), np.array(g["actual"]))
        result[str(key)] = {
            "n": len(g["actual"]),
            "ic_original": round(ic_orig, 6) if ic_orig is not None else None,
            "ic_adjusted": round(ic_adj, 6) if ic_adj is not None else None,
            "delta_ic": round(ic_adj - ic_orig, 6) if (ic_adj is not None and ic_orig is not None) else None,
        }
    return result


# ──────────────────────────────────────────────
# Walk-Forward Training
# ──────────────────────────────────────────────

def run_walk_forward(contexts, meta, alpha_init=2.0, alpha_exploit=0.5,
                     use_schedule=True, window_size=0):
    """Run walk-forward LinUCB: per-period reset, shuffled training.

    For each period:
      1. Train fresh LinUCB on prior periods (shuffled)
      2. Test greedy on current period

    window_size: 0 = cumulative (all prior), N>0 = sliding (last N periods).
    """
    # Group by WF period
    periods = defaultdict(list)
    for i, m in enumerate(meta):
        periods[m["wf_period"]].append(i)

    period_ids = sorted(periods.keys())
    n_periods = len(period_ids)
    mode = f"sliding-{window_size}" if window_size > 0 else "cumulative"
    print(f"  -> {n_periods} walk-forward periods (per-period reset, {mode})")

    all_results = []
    cumulative_train = []

    # Final policy trained on all data
    final_bandit = LinUCB(d=CONTEXT_DIM, K=K_ACTIONS, alpha=alpha_exploit)

    for p_idx, pid in enumerate(period_ids):
        test_indices = periods[pid]

        # Sliding window: only use last N periods for training
        if window_size > 0 and p_idx > 0:
            start = max(0, p_idx - window_size)
            train_indices = []
            for prev_pid in period_ids[start:p_idx]:
                train_indices.extend(periods[prev_pid])
        else:
            train_indices = cumulative_train[:]
        n_train = len(train_indices)

        print(f"\n  Period {pid} ({p_idx + 1}/{n_periods}): "
              f"train={n_train:,}, test={len(test_indices):,}")

        # ── TRAIN: fresh LinUCB on all prior data ──
        bandit = LinUCB(d=CONTEXT_DIM, K=K_ACTIONS, alpha=alpha_init)

        if n_train > 0:
            np.random.seed(42 + pid)
            train_order = np.array(train_indices)
            np.random.shuffle(train_order)

            switch_pt = int(n_train * 0.2) if use_schedule else n_train
            for t, idx in enumerate(train_order):
                if use_schedule and t == switch_pt:
                    bandit.alpha = alpha_exploit

                ctx = contexts[idx]
                action, _ = bandit.select_action(ctx)
                reward = compute_reward(
                    meta[idx]["y_actual"], meta[idx]["y_pred"],
                    ACTION_FACTORS[action])
                bandit.update(ctx, action, reward)

        # ── TEST: greedy on current period ──
        test_y_adjusted = []
        test_y_original = []
        test_actions = []

        for idx in test_indices:
            ctx = contexts[idx]
            if n_train == 0:
                action = 2  # trust_mra
            else:
                action, _ = bandit.select_greedy(ctx)
            y_adj = meta[idx]["y_pred"] * ACTION_FACTORS[action]
            test_y_adjusted.append(y_adj)
            test_y_original.append(meta[idx]["y_pred"])
            test_actions.append(action)

        test_y_actual = np.array([meta[idx]["y_actual"] for idx in test_indices])
        test_y_adj_arr = np.array(test_y_adjusted)
        test_y_orig_arr = np.array(test_y_original)

        # Test IC
        ic_adj, pval_adj = compute_ic(test_y_adj_arr, test_y_actual)
        ic_orig, pval_orig = compute_ic(test_y_orig_arr, test_y_actual)

        # Test action distribution
        test_action_dist = [0] * K_ACTIONS
        for a in test_actions:
            test_action_dist[a] += 1

        # Per-signal breakdown
        test_meta = [meta[idx] for idx in test_indices]
        ic_by_signal = compute_ic_by_group(
            test_meta, test_y_adj_arr, test_y_orig_arr,
            lambda m: m["signal"])

        # Per-tier breakdown
        def tier_fn(m):
            t = m["type"]
            if t in TIER1: return "tier1"
            if t in TIER3: return "tier3"
            return "tier2"
        ic_by_tier = compute_ic_by_group(
            test_meta, test_y_adj_arr, test_y_orig_arr, tier_fn)

        # Per-action factor analysis
        action_factor_analysis = {}
        for a_id in range(K_ACTIONS):
            mask = [i for i, act in enumerate(test_actions) if act == a_id]
            if len(mask) >= 30:
                a_adj = test_y_adj_arr[mask]
                a_actual = test_y_actual[mask]
                a_ic, _ = compute_ic(a_adj, a_actual)
                action_factor_analysis[ACTION_NAMES[a_id]] = {
                    "n": len(mask),
                    "pct": round(len(mask) / len(test_actions) * 100, 1),
                    "ic": round(a_ic, 6) if a_ic is not None else None,
                    "mean_adj": round(float(np.mean(a_adj)), 4),
                    "mean_actual": round(float(np.mean(a_actual)), 4),
                }

        delta_ic = None
        if ic_adj is not None and ic_orig is not None:
            delta_ic = round(ic_adj - ic_orig, 6)

        period_result = {
            "period": pid,
            "n_trained_before": n_train,
            "n_test": len(test_indices),
            "ic_original": round(ic_orig, 6) if ic_orig is not None else None,
            "ic_adjusted": round(ic_adj, 6) if ic_adj is not None else None,
            "delta_ic": delta_ic,
            "test_action_dist": {
                ACTION_NAMES[a]: test_action_dist[a] for a in range(K_ACTIONS)
            },
            "test_action_pct": {
                ACTION_NAMES[a]: round(test_action_dist[a] / max(len(test_actions), 1) * 100, 1)
                for a in range(K_ACTIONS)
            },
            "by_signal": ic_by_signal,
            "by_tier": ic_by_tier,
            "by_action": action_factor_analysis,
        }

        all_results.append(period_result)

        # Print summary
        ic_o = f"{ic_orig:.4f}" if ic_orig is not None else "N/A"
        ic_a = f"{ic_adj:.4f}" if ic_adj is not None else "N/A"
        d_ic = f"{delta_ic:+.4f}" if delta_ic is not None else "N/A"
        print(f"    IC: original={ic_o}, adjusted={ic_a}, delta={d_ic}")
        action_str = ", ".join(
            f"{ACTION_NAMES[a][:6]}={test_action_dist[a]}"
            for a in range(K_ACTIONS))
        print(f"    Actions: {action_str}")

        # Add to cumulative training set for next period
        cumulative_train.extend(test_indices)

        # Also train final bandit incrementally
        for idx in test_indices:
            ctx = contexts[idx]
            action, _ = final_bandit.select_action(ctx)
            reward = compute_reward(
                meta[idx]["y_actual"], meta[idx]["y_pred"],
                ACTION_FACTORS[action])
            final_bandit.update(ctx, action, reward)

    return all_results, final_bandit


# ──────────────────────────────────────────────
# Aggregate Analysis
# ──────────────────────────────────────────────

def analyze_results(all_results, min_train_override=None):
    """Aggregate walk-forward results and check abort criteria.

    Phase 6 fix: report both filtered (trained periods only) and ALL-period stats.
    Primary metric is t_stat_delta (tests LinUCB improvement), not t_stat_adjusted
    (which only tests IC != 0, trivially true because Ridge already has IC > 0).
    """
    # ALL periods with valid IC (for honest reporting)
    all_valid = [r for r in all_results
                 if r["ic_adjusted"] is not None and r["n_trained_before"] > 0]

    # Filtered periods (sufficient training data)
    MIN_TRAIN = min_train_override if min_train_override is not None else MIN_TRAIN_FOR_EVAL
    filtered = [r for r in all_results
                if r["ic_adjusted"] is not None and r["n_trained_before"] >= MIN_TRAIN]

    # Use all_valid for primary reporting (Phase 6: no cherry-picking)
    valid = all_valid if all_valid else filtered

    if not valid:
        return {
            "status": "ABORT", "reason": "No valid periods with training data",
            "n_all_periods": 0, "n_filtered_periods": 0,
            "mean_ic_original": 0, "mean_ic_adjusted": 0,
            "mean_delta_ic": 0, "std_delta_ic": 0,
            "t_stat_delta": 0, "t_stat_ic_nonzero": 0,
            "ic_positive_pct": 0, "improvement_pct": 0,
        }

    ics_orig = np.array([r["ic_original"] for r in valid])
    ics_adj = np.array([r["ic_adjusted"] for r in valid])
    deltas = ics_adj - ics_orig

    mean_orig = float(np.mean(ics_orig))
    mean_adj = float(np.mean(ics_adj))
    mean_delta = float(np.mean(deltas))
    std_delta = float(np.std(deltas, ddof=1)) if len(deltas) > 1 else 0
    t_delta = mean_delta / (std_delta / np.sqrt(len(deltas))) if std_delta > 0 else 0

    # IC != 0 test (secondary — Ridge baseline already ensures this)
    std_adj = float(np.std(ics_adj, ddof=1)) if len(ics_adj) > 1 else 0
    t_ic_nonzero = mean_adj / (std_adj / np.sqrt(len(ics_adj))) if std_adj > 0 else 0

    # Filtered-only stats for comparison
    filt_delta_t = 0
    if filtered:
        f_orig = np.array([r["ic_original"] for r in filtered])
        f_adj = np.array([r["ic_adjusted"] for r in filtered])
        f_d = f_adj - f_orig
        f_std = float(np.std(f_d, ddof=1)) if len(f_d) > 1 else 0
        filt_delta_t = float(np.mean(f_d)) / (f_std / np.sqrt(len(f_d))) if f_std > 0 else 0

    # Abort criteria
    status = "OK"
    reason = ""

    # Check: any action >90%?
    for r in valid:
        for a_name, pct in r.get("test_action_pct", {}).items():
            if pct > 90:
                status = "WARN"
                reason += f"Period {r['period']}: {a_name} at {pct}%. "

    # Check: delta IC — LinUCB must actually improve over Ridge baseline
    if len(valid) >= 3 and mean_delta < -0.005:
        status = "STOP"
        reason = f"LinUCB degrades IC: delta={mean_delta:.4f} (all periods)"

    # Check: delta not significant → LinUCB adds no value
    if abs(t_delta) < 2.0 and mean_delta < 0.005:
        if status == "OK":
            status = "NEUTRAL"
            reason = f"LinUCB delta not significant: t={t_delta:.2f}, delta={mean_delta:.4f}"

    # Overfitting detection
    if len(valid) >= 3:
        late_ics = [r["ic_adjusted"] for r in valid[-3:]]
        if all(late_ics[i] < late_ics[i - 1] for i in range(1, len(late_ics))):
            if late_ics[-1] < 0:
                status = "OVERFIT"
                reason = f"IC monotonically declining in last 3 periods, final IC<0"

    return {
        "status": status,
        "reason": reason,
        "n_all_periods": len(valid),
        "n_filtered_periods": len(filtered),
        "mean_ic_original": round(mean_orig, 6),
        "mean_ic_adjusted": round(mean_adj, 6),
        "mean_delta_ic": round(mean_delta, 6),
        "std_delta_ic": round(std_delta, 6),
        "t_stat_delta": round(t_delta, 4),
        "t_stat_delta_filtered": round(filt_delta_t, 4),
        "t_stat_ic_nonzero": round(t_ic_nonzero, 4),
        "ic_positive_pct": round(float(np.mean(ics_adj > 0) * 100), 1),
        "improvement_pct": round(float(np.mean(deltas > 0) * 100), 1),
    }


# ──────────────────────────────────────────────
# JSON serialization
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
# Main
# ──────────────────────────────────────────────

def main():
    t0 = time.time()
    args = sys.argv[1:]
    alpha_init = 2.0
    use_schedule = True
    window_size = 3  # sliding window: last N periods (0=cumulative)

    i = 0
    while i < len(args):
        if args[i] == "--alpha" and i + 1 < len(args):
            alpha_init = float(args[i + 1]); i += 2
        elif args[i] == "--no-schedule":
            use_schedule = False; i += 1
        elif args[i] == "--window" and i + 1 < len(args):
            window_size = int(args[i + 1]); i += 2
        else:
            i += 1

    for path in [CONTEXT_CSV, RESID_CSV]:
        if not path.exists():
            print(f"[ERROR] {path} not found.")
            sys.exit(1)

    print("=" * 70)
    print("Stage B-4: Walk-Forward LinUCB Training + IC Validation")
    print("=" * 70)
    wmode = f"sliding-{window_size}" if window_size > 0 else "cumulative"
    print(f"  alpha_init={alpha_init}, schedule={'20%->0.5' if use_schedule else 'constant'}, window={wmode}")
    print(f"  Actions: {ACTION_NAMES}")
    print(f"  Factors: {ACTION_FACTORS}")

    # ── Load data ──
    print("\n[1/4] Loading context features + residuals...")
    contexts, meta = load_data()
    n = len(meta)
    print(f"  -> {n:,} samples, {CONTEXT_DIM}-dim context")

    # ── Walk-Forward Training ──
    print("\n[2/4] Walk-Forward LinUCB Training...")
    all_results, final_bandit = run_walk_forward(
        contexts, meta,
        alpha_init=alpha_init,
        alpha_exploit=0.5,
        use_schedule=use_schedule,
        window_size=window_size,
    )

    # ── Aggregate Analysis ──
    print("\n[3/4] Aggregate analysis...")
    # Sliding window: lower min_train threshold (require >=2 periods of data)
    min_train = None
    if window_size > 0 and all_results:
        avg_period_size = n // max(len(all_results), 1)
        min_train = avg_period_size * max(window_size - 1, 1)
    summary = analyze_results(all_results, min_train_override=min_train)

    print(f"\n{'=' * 70}")
    print("RESULTS SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Status:           {summary['status']}")
    if summary.get("reason"):
        print(f"  Reason:           {summary['reason']}")
    print(f"  All periods:      {summary['n_all_periods']}")
    print(f"  Filtered periods: {summary['n_filtered_periods']}")
    print(f"  IC original:      {summary['mean_ic_original']:.6f}")
    print(f"  IC adjusted:      {summary['mean_ic_adjusted']:.6f}")
    print(f"  ** Delta IC:      {summary['mean_delta_ic']:+.6f}  (PRIMARY: LinUCB contribution)")
    print(f"  ** Delta t-stat:  {summary['t_stat_delta']:.4f}  (PRIMARY: tests improvement)")
    print(f"     Delta t (filt):{summary['t_stat_delta_filtered']:.4f}  (filtered-only comparison)")
    print(f"     IC!=0 t-stat:  {summary['t_stat_ic_nonzero']:.4f}  (secondary: Ridge baseline)")
    print(f"  IC positive:      {summary['ic_positive_pct']}%")
    print(f"  Improvement wins: {summary['improvement_pct']}%")

    # Per-period table
    print(f"\n  {'Period':>6} {'Trained':>8} {'N_test':>8} {'IC_orig':>10} "
          f"{'IC_adj':>10} {'Delta':>10} {'Top Action':>15}")
    for r in all_results:
        ic_o = f"{r['ic_original']:.4f}" if r["ic_original"] is not None else "N/A"
        ic_a = f"{r['ic_adjusted']:.4f}" if r["ic_adjusted"] is not None else "N/A"
        d = f"{r['delta_ic']:+.4f}" if r["delta_ic"] is not None else "N/A"
        top_action = max(r["test_action_pct"].items(), key=lambda x: x[1])
        trained = r["n_trained_before"]
        marker = " *" if trained >= MIN_TRAIN_FOR_EVAL else ""
        print(f"  {r['period']:>6} {trained:>8,} {r['n_test']:>8,} "
              f"{ic_o:>10} {ic_a:>10} {d:>10} {top_action[0]:>10}({top_action[1]:.0f}%){marker}")

    # Signal breakdown (aggregated)
    print(f"\n  IC by Signal (aggregated from last 3 periods):")
    for sig in ["buy", "sell", "neutral"]:
        adj_ics = []
        orig_ics = []
        for r in all_results[-3:]:
            s = r.get("by_signal", {}).get(sig, {})
            if s.get("ic_adjusted") is not None:
                adj_ics.append(s["ic_adjusted"])
            if s.get("ic_original") is not None:
                orig_ics.append(s["ic_original"])
        if adj_ics:
            print(f"    {sig:>8}: IC_orig={np.mean(orig_ics):.4f} -> "
                  f"IC_adj={np.mean(adj_ics):.4f} "
                  f"(delta={np.mean(adj_ics) - np.mean(orig_ics):+.4f})")

    # Tier breakdown
    print(f"\n  IC by Tier (aggregated from last 3 periods):")
    for tier in ["tier1", "tier2", "tier3"]:
        adj_ics = []
        orig_ics = []
        for r in all_results[-3:]:
            t = r.get("by_tier", {}).get(tier, {})
            if t.get("ic_adjusted") is not None:
                adj_ics.append(t["ic_adjusted"])
            if t.get("ic_original") is not None:
                orig_ics.append(t["ic_original"])
        if adj_ics:
            print(f"    {tier:>8}: IC_orig={np.mean(orig_ics):.4f} -> "
                  f"IC_adj={np.mean(adj_ics):.4f} "
                  f"(delta={np.mean(adj_ics) - np.mean(orig_ics):+.4f})")

    # ── Save outputs ──
    print(f"\n[4/4] Saving outputs...")

    # Policy JSON (for JS integration)
    policy = final_bandit.get_policy_json()
    policy["context_names"] = [
        "ewma_vol", "pred_magnitude", "signal_dir",
        "market_type", "pattern_tier", "confidence_norm", "raw_hurst",
    ]
    policy["training_summary"] = {
        "n_samples": n,
        "n_periods": len(all_results),
        "mean_ic_adjusted": summary["mean_ic_adjusted"],
        "mean_ic_original": summary["mean_ic_original"],
        "t_stat_delta": summary["t_stat_delta"],
    }
    policy["trained_date"] = datetime.date.today().isoformat()
    policy["feature_dim"] = final_bandit.d_internal - 1
    # Load and embed context normalization stats for JS runtime parity
    ctx_stats_path = BACKTEST_DIR / "rl_context_stats.json"
    if ctx_stats_path.exists():
        with open(ctx_stats_path, encoding="utf-8") as f:
            ctx_stats = json.load(f)
        policy["normalization"] = ctx_stats.get("normalization", {})
    with open(OUT_POLICY, "w", encoding="utf-8") as f:
        json.dump(_to_native(policy), f, ensure_ascii=False, indent=2)
    print(f"  -> Policy: {OUT_POLICY}")

    # Full results JSON
    output = _to_native({
        "config": {
            "alpha_init": alpha_init,
            "alpha_exploit": 0.5,
            "use_schedule": use_schedule,
            "context_dim": CONTEXT_DIM,
            "n_actions": K_ACTIONS,
            "action_names": ACTION_NAMES,
            "action_factors": ACTION_FACTORS,
        },
        "summary": summary,
        "periods": all_results,
        "final_policy_stats": final_bandit.get_action_stats(),
        "elapsed_seconds": round(time.time() - t0, 1),
    })
    with open(OUT_RESULTS, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"  -> Results: {OUT_RESULTS}")

    elapsed = time.time() - t0
    print(f"\n  Total time: {elapsed:.1f}s")

    # Final recommendation (Phase 6: based on delta t-stat, not IC!=0 t-stat)
    print(f"\n{'=' * 70}")
    delta_t = summary["t_stat_delta"]
    if summary["status"] in ("STOP", "OVERFIT"):
        print(f"RECOMMENDATION: STOP - {summary['status']}: {summary.get('reason','')}")
    elif summary["status"] == "NEUTRAL" or abs(delta_t) < 2.0:
        print(f"RECOMMENDATION: LinUCB NOT SIGNIFICANT (delta t={delta_t:.2f})")
        print("  -> Deploy Ridge-only (disable LinUCB layer)")
    elif delta_t >= 2.0 and summary["mean_delta_ic"] > 0:
        print(f"RECOMMENDATION: LinUCB SIGNIFICANT (delta t={delta_t:.2f})")
        print("  -> Proceed to B-5 (JS integration)")
    else:
        print(f"RECOMMENDATION: Review ({summary['status']}, delta t={delta_t:.2f})")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
