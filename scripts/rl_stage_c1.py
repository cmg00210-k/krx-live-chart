#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rl_stage_c1.py -- Stage C-1: Warm-Start LinUCB from 23-col Ridge MRA

Compares cold-start LinUCB (identity initialization) vs warm-start
LinUCB (initialized from MRA training data) on walk-forward periods.

Pipeline:
  1. Load rl_context.csv (12-dim, using 7 runtime dims) + rl_residuals.csv
  2. Warm-start: use first W periods to initialize LinUCB theta vectors
     via Ridge regression from context -> per-arm rewards
  3. Walk-forward: test on remaining periods (per-period reset with warm-start prior)
  4. Cold-start baseline: same walk-forward but with identity initialization
  5. Compare: delta_IC, action distribution, per-tier IC

Academic Basis:
  - Li et al. (2010) LinUCB: contextual bandit with warm-start from logged data
  - core_data/11_RL section 7.3: warm-start from technical analysis rules
  - core_data/14_adaptive_market: Lo (2004) AMH -- online adaptation
  - Stage B-1 baseline: 23-col Ridge WF IC = 0.1192 (t=10.04)

Usage:
    python scripts/rl_stage_c1.py
    python scripts/rl_stage_c1.py --warm-periods 2   (default: 2)
    python scripts/rl_stage_c1.py --alpha 2.0         (exploration parameter)
    python scripts/rl_stage_c1.py --window 3           (sliding window)
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rl_linucb import LinUCB, ACTION_FACTORS, ACTION_NAMES, K_ACTIONS, compute_reward

ROOT = Path(__file__).resolve().parent.parent
BACKTEST_DIR = ROOT / "data" / "backtest"
CONTEXT_CSV = BACKTEST_DIR / "rl_context.csv"
RESID_CSV = BACKTEST_DIR / "rl_residuals.csv"
OUT_RESULTS = BACKTEST_DIR / "rl_stage_c1_results.json"
OUT_POLICY = BACKTEST_DIR / "rl_policy_c1.json"

TIER1 = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers"}
TIER2 = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows",
         "hangingMan", "shootingStar", "eveningStar", "invertedHammer"}
TIER3 = {"spinningTop", "doji", "fallingWedge"}

CONTEXT_DIM = 7  # 12 -> 7: removed resid_sign/mag_z/run_len (runtime N/A)


# ──────────────────────────────────────────────
# Data Loading (same as rl_stage_b.py)
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
    if len(y_pred) < 30:
        return None, None
    if np.std(y_pred) < 1e-10 or np.std(y_actual) < 1e-10:
        return None, None
    corr, pval = sp_stats.spearmanr(y_pred, y_actual)
    if np.isfinite(corr):
        return float(corr), float(pval)
    return None, None


def compute_ic_by_group(meta_subset, y_adjusted, y_original, group_fn):
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
# Walk-Forward with Warm-Start Option
# ──────────────────────────────────────────────

def run_walk_forward(contexts, meta, warm_start=False, warm_periods=2,
                     alpha_init=2.0, alpha_exploit=0.5,
                     use_schedule=True, window_size=3):
    """Run walk-forward LinUCB with optional warm-start initialization.

    When warm_start=True:
      - First `warm_periods` WF periods are used for warm-start initialization
      - LinUCB theta vectors are initialized via Ridge regression from context -> reward
      - Walk-forward testing starts from period `warm_periods`
      - Each test period still resets LinUCB, but starts from warm-start prior

    When warm_start=False:
      - Standard cold-start (identity initialization)
      - Walk-forward from period 0 (first period always trust_mra)
    """
    # Group by WF period
    periods = defaultdict(list)
    for i, m in enumerate(meta):
        periods[m["wf_period"]].append(i)

    period_ids = sorted(periods.keys())
    n_periods = len(period_ids)
    mode_str = "warm-start" if warm_start else "cold-start"
    wmode = f"sliding-{window_size}" if window_size > 0 else "cumulative"
    print(f"\n  [{mode_str}] {n_periods} WF periods, {wmode}")

    # Warm-start data preparation
    warm_contexts = None
    warm_y_pred = None
    warm_y_actual = None

    if warm_start and warm_periods > 0 and warm_periods < n_periods:
        warm_indices = []
        for pid in period_ids[:warm_periods]:
            warm_indices.extend(periods[pid])
        warm_contexts = contexts[warm_indices]
        warm_y_pred = np.array([meta[i]["y_pred"] for i in warm_indices])
        warm_y_actual = np.array([meta[i]["y_actual"] for i in warm_indices])
        print(f"  -> Warm-start: {len(warm_indices):,} samples from periods 0-{warm_periods - 1}")

    all_results = []
    cumulative_train = []

    # Determine which periods to evaluate
    eval_start = warm_periods if warm_start else 0

    for p_idx, pid in enumerate(period_ids):
        test_indices = periods[pid]

        # Skip warm-start periods for evaluation (they were used for initialization)
        if p_idx < eval_start:
            cumulative_train.extend(test_indices)
            continue

        # Training data: cumulative or sliding window
        if window_size > 0 and p_idx > eval_start:
            start = max(eval_start, p_idx - window_size)
            train_indices = []
            for prev_pid in period_ids[start:p_idx]:
                train_indices.extend(periods[prev_pid])
        else:
            train_indices = cumulative_train[:]
        n_train = len(train_indices)

        print(f"  Period {pid} ({p_idx + 1}/{n_periods}): "
              f"train={n_train:,}, test={len(test_indices):,}")

        # ── Initialize LinUCB ──
        bandit = LinUCB(d=CONTEXT_DIM, K=K_ACTIONS, alpha=alpha_init)

        # Apply warm-start if enabled
        if warm_start and warm_contexts is not None:
            bandit.warm_start_from_data(warm_contexts, warm_y_pred, warm_y_actual)

        # ── TRAIN on available data ──
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

        # ── TEST: greedy ──
        test_y_adjusted = []
        test_y_original = []
        test_actions = []

        for idx in test_indices:
            ctx = contexts[idx]
            if n_train == 0 and not warm_start:
                action = 2  # trust_mra (cold-start, no data)
            else:
                action, _ = bandit.select_greedy(ctx)
            y_adj = meta[idx]["y_pred"] * ACTION_FACTORS[action]
            test_y_adjusted.append(y_adj)
            test_y_original.append(meta[idx]["y_pred"])
            test_actions.append(action)

        test_y_actual = np.array([meta[idx]["y_actual"] for idx in test_indices])
        test_y_adj_arr = np.array(test_y_adjusted)
        test_y_orig_arr = np.array(test_y_original)

        # IC
        ic_adj, _ = compute_ic(test_y_adj_arr, test_y_actual)
        ic_orig, _ = compute_ic(test_y_orig_arr, test_y_actual)

        # Action distribution
        test_action_dist = [0] * K_ACTIONS
        for a in test_actions:
            test_action_dist[a] += 1

        # Per-tier breakdown
        test_meta = [meta[idx] for idx in test_indices]
        def tier_fn(m):
            t = m["type"]
            if t in TIER1: return "tier1"
            if t in TIER3: return "tier3"
            return "tier2"
        ic_by_tier = compute_ic_by_group(
            test_meta, test_y_adj_arr, test_y_orig_arr, tier_fn)

        # Per-signal breakdown
        ic_by_signal = compute_ic_by_group(
            test_meta, test_y_adj_arr, test_y_orig_arr,
            lambda m: m["signal"])

        delta_ic = None
        if ic_adj is not None and ic_orig is not None:
            delta_ic = round(ic_adj - ic_orig, 6)

        period_result = {
            "period": pid,
            "n_trained_before": n_train,
            "n_warm_start": len(warm_contexts) if warm_contexts is not None else 0,
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
        }

        all_results.append(period_result)

        # Print summary
        ic_o = f"{ic_orig:.4f}" if ic_orig is not None else "N/A"
        ic_a = f"{ic_adj:.4f}" if ic_adj is not None else "N/A"
        d_ic = f"{delta_ic:+.4f}" if delta_ic is not None else "N/A"
        top_action = ACTION_NAMES[np.argmax(test_action_dist)]
        top_pct = max(test_action_dist) / max(len(test_actions), 1) * 100
        print(f"    IC: orig={ic_o}, adj={ic_a}, delta={d_ic}, "
              f"top_action={top_action}({top_pct:.0f}%)")

        cumulative_train.extend(test_indices)

    return all_results


# ──────────────────────────────────────────────
# Analysis
# ──────────────────────────────────────────────

def analyze_mode(results, mode_name):
    """Aggregate results for a single mode (cold/warm)."""
    valid = [r for r in results if r["ic_adjusted"] is not None]
    if not valid:
        return {"status": "NO_DATA", "mode": mode_name}

    ics_orig = np.array([r["ic_original"] for r in valid])
    ics_adj = np.array([r["ic_adjusted"] for r in valid])
    deltas = ics_adj - ics_orig
    n = len(deltas)

    mean_delta = float(np.mean(deltas))
    std_delta = float(np.std(deltas, ddof=1)) if n > 1 else 0
    t_delta = mean_delta / (std_delta / np.sqrt(n)) if std_delta > 0 else 0

    mean_adj = float(np.mean(ics_adj))
    std_adj = float(np.std(ics_adj, ddof=1)) if n > 1 else 0

    # Action diversity: average max-action percentage
    max_pcts = []
    for r in valid:
        pcts = list(r["test_action_pct"].values())
        if pcts:
            max_pcts.append(max(pcts))
    avg_max_pct = float(np.mean(max_pcts)) if max_pcts else 100.0

    return {
        "mode": mode_name,
        "n_periods": n,
        "mean_ic_original": round(float(np.mean(ics_orig)), 6),
        "mean_ic_adjusted": round(mean_adj, 6),
        "std_ic_adjusted": round(std_adj, 6),
        "mean_delta_ic": round(mean_delta, 6),
        "std_delta_ic": round(std_delta, 6),
        "t_stat_delta": round(t_delta, 4),
        "ic_positive_pct": round(float(np.mean(ics_adj > 0) * 100), 1),
        "improvement_pct": round(float(np.mean(deltas > 0) * 100), 1),
        "avg_max_action_pct": round(avg_max_pct, 1),
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
    window_size = 3
    warm_periods = 2  # number of WF periods to use for warm-start

    i = 0
    while i < len(args):
        if args[i] == "--alpha" and i + 1 < len(args):
            alpha_init = float(args[i + 1]); i += 2
        elif args[i] == "--no-schedule":
            use_schedule = False; i += 1
        elif args[i] == "--window" and i + 1 < len(args):
            window_size = int(args[i + 1]); i += 2
        elif args[i] == "--warm-periods" and i + 1 < len(args):
            warm_periods = int(args[i + 1]); i += 2
        else:
            i += 1

    for path in [CONTEXT_CSV, RESID_CSV]:
        if not path.exists():
            print(f"[ERROR] {path} not found.")
            sys.exit(1)

    print("=" * 70)
    print("Stage C-1: Warm-Start LinUCB vs Cold-Start Comparison")
    print("=" * 70)
    wmode = f"sliding-{window_size}" if window_size > 0 else "cumulative"
    print(f"  alpha_init={alpha_init}, schedule={'20%->0.5' if use_schedule else 'constant'}")
    print(f"  window={wmode}, warm_periods={warm_periods}")
    print(f"  Actions: {ACTION_FACTORS}")

    # ── Load data ──
    print("\n[1/5] Loading context features + residuals...")
    contexts, meta = load_data()
    n = len(meta)
    n_periods = len(set(m["wf_period"] for m in meta))
    print(f"  -> {n:,} samples, {CONTEXT_DIM}-dim context, {n_periods} WF periods")

    # ── Cold-Start Baseline ──
    print("\n[2/5] Cold-Start Walk-Forward...")
    cold_results = run_walk_forward(
        contexts, meta,
        warm_start=False,
        alpha_init=alpha_init,
        alpha_exploit=0.5,
        use_schedule=use_schedule,
        window_size=window_size,
    )

    # ── Warm-Start Walk-Forward ──
    print("\n[3/5] Warm-Start Walk-Forward...")
    warm_results = run_walk_forward(
        contexts, meta,
        warm_start=True,
        warm_periods=warm_periods,
        alpha_init=alpha_init,
        alpha_exploit=0.5,
        use_schedule=use_schedule,
        window_size=window_size,
    )

    # ── Analysis ──
    print("\n[4/5] Comparative Analysis...")
    cold_summary = analyze_mode(cold_results, "cold_start")
    warm_summary = analyze_mode(warm_results, "warm_start")

    # Align periods for paired comparison (warm-start skips first N periods)
    warm_period_ids = {r["period"] for r in warm_results}
    cold_aligned = [r for r in cold_results if r["period"] in warm_period_ids]
    cold_aligned_summary = analyze_mode(cold_aligned, "cold_start_aligned")

    # Compute paired warm-cold delta
    paired_delta = None
    if cold_aligned and warm_results:
        cold_map = {r["period"]: r for r in cold_aligned}
        paired_deltas = []
        for wr in warm_results:
            cr = cold_map.get(wr["period"])
            if cr and wr["ic_adjusted"] is not None and cr["ic_adjusted"] is not None:
                paired_deltas.append(wr["ic_adjusted"] - cr["ic_adjusted"])
        if paired_deltas:
            pd_arr = np.array(paired_deltas)
            mean_pd = float(np.mean(pd_arr))
            std_pd = float(np.std(pd_arr, ddof=1)) if len(pd_arr) > 1 else 0
            t_pd = mean_pd / (std_pd / np.sqrt(len(pd_arr))) if std_pd > 0 else 0
            paired_delta = {
                "n_paired": len(paired_deltas),
                "mean_warm_minus_cold": round(mean_pd, 6),
                "std": round(std_pd, 6),
                "t_stat": round(t_pd, 4),
                "warm_wins_pct": round(float(np.mean(pd_arr > 0) * 100), 1),
            }

    # ── Print Summary ──
    print(f"\n{'=' * 70}")
    print("COMPARISON SUMMARY")
    print(f"{'=' * 70}")
    print(f"\n  Cold-Start (all periods):")
    print(f"    Mean IC: {cold_summary['mean_ic_adjusted']:.6f} (t={cold_summary.get('t_stat_delta', 0):.2f})")
    print(f"    Mean delta_IC: {cold_summary['mean_delta_ic']:.6f}")
    print(f"    Action diversity: top_pct={cold_summary['avg_max_action_pct']:.1f}%")

    print(f"\n  Cold-Start (aligned, periods {warm_periods}+):")
    print(f"    Mean IC: {cold_aligned_summary['mean_ic_adjusted']:.6f}")
    print(f"    Mean delta_IC: {cold_aligned_summary['mean_delta_ic']:.6f}")

    print(f"\n  Warm-Start (periods {warm_periods}+):")
    print(f"    Mean IC: {warm_summary['mean_ic_adjusted']:.6f} (t={warm_summary.get('t_stat_delta', 0):.2f})")
    print(f"    Mean delta_IC: {warm_summary['mean_delta_ic']:.6f}")
    print(f"    Action diversity: top_pct={warm_summary['avg_max_action_pct']:.1f}%")

    if paired_delta:
        print(f"\n  Paired Comparison (warm - cold, same periods):")
        print(f"    Mean IC difference: {paired_delta['mean_warm_minus_cold']:+.6f}")
        print(f"    t-stat: {paired_delta['t_stat']:.4f}")
        print(f"    Warm wins: {paired_delta['warm_wins_pct']:.1f}%")

    # Success criteria check
    print(f"\n  Success Criteria:")
    target_delta = 0.005
    warm_delta = warm_summary.get("mean_delta_ic", 0)
    cold_delta = cold_aligned_summary.get("mean_delta_ic", 0)
    warm_improvement = warm_delta - cold_delta if cold_delta is not None else warm_delta

    criteria = {
        "warm_delta_ic > cold_delta_ic": warm_delta > cold_delta if cold_delta is not None else False,
        "warm_delta_ic > 0.005": warm_delta > target_delta,
        "action_non_degenerate (<70%)": warm_summary.get("avg_max_action_pct", 100) < 70,
    }
    for name, passed in criteria.items():
        status = "PASS" if passed else "FAIL"
        print(f"    [{status}] {name}")

    # ── Save Results ──
    print(f"\n[5/5] Saving results...")
    output = _to_native({
        "config": {
            "alpha_init": alpha_init,
            "use_schedule": use_schedule,
            "window_size": window_size,
            "warm_periods": warm_periods,
            "context_dim": CONTEXT_DIM,
            "n_samples": n,
            "n_periods": n_periods,
        },
        "cold_start": {
            "summary": cold_summary,
            "periods": cold_results,
        },
        "cold_start_aligned": {
            "summary": cold_aligned_summary,
        },
        "warm_start": {
            "summary": warm_summary,
            "periods": warm_results,
        },
        "paired_comparison": paired_delta,
        "success_criteria": criteria,
        "elapsed_seconds": round(time.time() - t0, 1),
    })

    with open(OUT_RESULTS, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"  -> {OUT_RESULTS}")

    elapsed = time.time() - t0
    print(f"\n  Total time: {elapsed:.1f}s")
    print("  Done.")


if __name__ == "__main__":
    main()
