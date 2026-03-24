#!/usr/bin/env python3
"""
KRX LIVE — Backtest Orchestrator + Aggregator

Node backtest_runner.js --batch 실행 후 결과를 집계하여
Stage 5 분석용 JSON 파일 6종을 생성한다.

Usage:
    python scripts/backtest_all.py               # Full run
    python scripts/backtest_all.py --skip-run     # Aggregate existing raw_results.ndjson
    python scripts/backtest_all.py --code 005930  # Single stock test

Output files (data/backtest/):
    1. results/{market}_{code}.json   — 종목별 원시 데이터
    2. aggregate_stats.json           — 전체 통계
    3. pattern_performance.json       — 30패턴별 WLS beta + t-stat
    4. theory_vs_actual.json          — 이론 목표가 vs 실제 달성률
"""

import json
import os
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BACKTEST_DIR = DATA_DIR / "backtest"
RESULTS_DIR = BACKTEST_DIR / "results"
RAW_NDJSON = BACKTEST_DIR / "raw_results.ndjson"

HORIZONS = [1, 3, 5, 10, 20]


def run_node_batch():
    """Node backtest_runner.js --batch 실행"""
    runner = ROOT / "scripts" / "backtest_runner.js"
    if not runner.exists():
        print(f"[ERROR] {runner} not found")
        sys.exit(1)

    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)

    print("[1/4] Running Node backtest_runner.js --batch ...")
    start = time.time()

    with open(RAW_NDJSON, "w", encoding="utf-8") as out_f, \
         open(BACKTEST_DIR / "batch_log.txt", "w", encoding="utf-8") as log_f:
        proc = subprocess.run(
            ["node", str(runner), "--batch"],
            stdout=out_f,
            stderr=log_f,
            timeout=600,
        )

    elapsed = time.time() - start
    if proc.returncode != 0:
        print(f"[ERROR] Node process exited with code {proc.returncode}")
        sys.exit(1)

    line_count = sum(1 for _ in open(RAW_NDJSON, encoding="utf-8"))
    print(f"  -> {line_count} stocks processed in {elapsed:.1f}s")
    return line_count


def load_raw_results():
    """NDJSON 파일에서 결과 로드"""
    results = []
    errors = 0
    with open(RAW_NDJSON, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                results.append(obj)
            except json.JSONDecodeError:
                errors += 1
                if errors <= 5:
                    print(f"  [WARN] JSON parse error at line {line_no}")
    if errors:
        print(f"  [WARN] {errors} total parse errors")
    return results


def save_individual_results(results):
    """종목별 원시 데이터 파일 저장"""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    for r in results:
        code = r.get("code", "")
        market = r.get("market", "").lower()
        if not code or not market:
            continue
        fname = RESULTS_DIR / f"{market}_{code}.json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False)


def aggregate_stats(results):
    """전체 통계 집계"""
    total = len(results)
    skipped = sum(1 for r in results if r.get("skipped"))
    errored = sum(1 for r in results if r.get("error"))
    analyzed = total - skipped - errored

    total_patterns = sum(r.get("patternCount", 0) for r in results)
    total_candles = sum(r.get("candleCount", 0) for r in results)

    # 패턴 타입별 발견 빈도
    type_freq = defaultdict(int)
    for r in results:
        for p in r.get("patterns", []):
            type_freq[p["type"]] += 1

    # 백테스트 가능한 종목 수
    bt_count = sum(1 for r in results if r.get("backtest") and len(r["backtest"]) > 0)

    stats = {
        "total_stocks": total,
        "analyzed": analyzed,
        "skipped": skipped,
        "errored": errored,
        "total_candles": total_candles,
        "total_patterns_detected": total_patterns,
        "avg_patterns_per_stock": round(total_patterns / max(analyzed, 1), 1),
        "stocks_with_backtest": bt_count,
        "pattern_frequency": dict(sorted(type_freq.items(), key=lambda x: -x[1])),
    }
    return stats


def aggregate_pattern_performance(results):
    """30패턴별 성과 집계 — 각 horizon별 평균 수익률, 승률, WLS beta"""
    # pattern -> horizon -> list of stats
    pool = defaultdict(lambda: defaultdict(list))

    for r in results:
        bt = r.get("backtest", {})
        for ptype, pdata in bt.items():
            horizons = pdata.get("horizons", {})
            for h_str, hstats in horizons.items():
                if hstats and hstats.get("n", 0) >= 2:
                    pool[ptype][h_str].append(hstats)

    perf = {}
    for ptype in sorted(pool.keys()):
        perf[ptype] = {}
        for h_str in sorted(pool[ptype].keys(), key=lambda x: int(x)):
            stats_list = pool[ptype][h_str]
            if not stats_list:
                continue

            # Weighted average by sample size
            total_n = sum(s["n"] for s in stats_list)
            if total_n == 0:
                continue

            w_mean = sum(s["mean"] * s["n"] for s in stats_list) / total_n
            w_winrate = sum(s["winRate"] * s["n"] for s in stats_list) / total_n
            num_significant = sum(1 for s in stats_list if s.get("significant"))
            num_adj_significant = sum(1 for s in stats_list if s.get("adjustedSignificant"))

            # Collect WLS regression coefficients
            reg_coeffs = []
            reg_r2 = []
            for s in stats_list:
                reg = s.get("regression")
                if reg and reg.get("coeffs"):
                    reg_coeffs.append(reg["coeffs"])
                    reg_r2.append(reg["rSquared"])

            horizon_perf = {
                "stock_count": len(stats_list),
                "total_occurrences": total_n,
                "weighted_mean_return": round(w_mean, 3),
                "weighted_win_rate": round(w_winrate, 1),
                "significant_count": num_significant,
                "adjusted_significant_count": num_adj_significant,
            }

            if reg_coeffs:
                # Average WLS coefficients
                n_coeffs = len(reg_coeffs[0])
                avg_coeffs = [0.0] * n_coeffs
                for c in reg_coeffs:
                    for i in range(min(len(c), n_coeffs)):
                        avg_coeffs[i] += c[i]
                avg_coeffs = [round(c / len(reg_coeffs), 6) for c in avg_coeffs]
                avg_r2 = round(sum(reg_r2) / len(reg_r2), 4)

                horizon_perf["avg_wls_coeffs"] = avg_coeffs
                horizon_perf["avg_r_squared"] = avg_r2
                horizon_perf["regression_count"] = len(reg_coeffs)

            perf[ptype][h_str] = horizon_perf

    return perf


def aggregate_theory_vs_actual(results):
    """이론 목표가 vs 실제 달성률 분석"""
    records = []

    for r in results:
        code = r.get("code")
        candle_count = r.get("candleCount", 0)
        patterns = r.get("patterns", [])

        for p in patterns:
            target = p.get("priceTarget")
            stop = p.get("stopLoss")
            end_idx = p.get("endIndex")

            if target is None or end_idx is None:
                continue

            records.append({
                "code": code,
                "type": p["type"],
                "signal": p.get("signal"),
                "confidence": p.get("confidence"),
                "endIndex": end_idx,
                "priceTarget": target,
                "stopLoss": stop,
                "riskReward": p.get("riskReward"),
                "hw": p.get("hw"),
                "vw": p.get("vw"),
                "mw": p.get("mw"),
                "rw": p.get("rw"),
                "candleCount": candle_count,
            })

    # Summary by pattern type
    by_type = defaultdict(list)
    for rec in records:
        by_type[rec["type"]].append(rec)

    summary = {}
    for ptype, recs in sorted(by_type.items()):
        hw_vals = [r["hw"] for r in recs if r.get("hw") is not None]
        vw_vals = [r["vw"] for r in recs if r.get("vw") is not None]
        mw_vals = [r["mw"] for r in recs if r.get("mw") is not None]
        rw_vals = [r["rw"] for r in recs if r.get("rw") is not None]
        conf_vals = [r["confidence"] for r in recs if r.get("confidence") is not None]
        rr_vals = [r["riskReward"] for r in recs if r.get("riskReward") is not None]

        def _stats(vals):
            if not vals:
                return None
            n = len(vals)
            mean = sum(vals) / n
            variance = sum((v - mean) ** 2 for v in vals) / max(n - 1, 1)
            return {
                "n": n,
                "mean": round(mean, 4),
                "std": round(variance ** 0.5, 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
            }

        summary[ptype] = {
            "count": len(recs),
            "confidence": _stats(conf_vals),
            "riskReward": _stats(rr_vals),
            "hw": _stats(hw_vals),
            "vw": _stats(vw_vals),
            "mw": _stats(mw_vals),
            "rw": _stats(rw_vals),
        }

    return {
        "total_targets": len(records),
        "by_pattern_type": summary,
    }


def main():
    args = sys.argv[1:]
    skip_run = "--skip-run" in args

    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Run Node batch (or skip)
    if skip_run:
        if not RAW_NDJSON.exists():
            print(f"[ERROR] {RAW_NDJSON} not found. Run without --skip-run first.")
            sys.exit(1)
        print("[1/4] Skipping Node run (using existing raw_results.ndjson)")
    else:
        run_node_batch()

    # Step 2: Load + save individual results
    print("[2/4] Loading raw results...")
    results = load_raw_results()
    print(f"  -> {len(results)} results loaded")

    print("  Saving individual result files...")
    save_individual_results(results)
    print(f"  -> {len(results)} files saved to data/backtest/results/")

    # Step 3: Aggregate
    print("[3/4] Aggregating statistics...")

    agg_stats = aggregate_stats(results)
    with open(BACKTEST_DIR / "aggregate_stats.json", "w", encoding="utf-8") as f:
        json.dump(agg_stats, f, ensure_ascii=False, indent=2)
    print(f"  -> aggregate_stats.json ({agg_stats['analyzed']} analyzed, "
          f"{agg_stats['total_patterns_detected']} patterns)")

    pattern_perf = aggregate_pattern_performance(results)
    with open(BACKTEST_DIR / "pattern_performance.json", "w", encoding="utf-8") as f:
        json.dump(pattern_perf, f, ensure_ascii=False, indent=2)
    print(f"  -> pattern_performance.json ({len(pattern_perf)} pattern types)")

    theory_actual = aggregate_theory_vs_actual(results)
    with open(BACKTEST_DIR / "theory_vs_actual.json", "w", encoding="utf-8") as f:
        json.dump(theory_actual, f, ensure_ascii=False, indent=2)
    print(f"  -> theory_vs_actual.json ({theory_actual['total_targets']} targets)")

    # Step 4: Summary
    print("[4/4] Summary:")
    print(f"  Total stocks:     {agg_stats['total_stocks']}")
    print(f"  Analyzed:         {agg_stats['analyzed']}")
    print(f"  Skipped:          {agg_stats['skipped']}")
    print(f"  Errors:           {agg_stats['errored']}")
    print(f"  Total patterns:   {agg_stats['total_patterns_detected']}")
    print(f"  Avg per stock:    {agg_stats['avg_patterns_per_stock']}")
    print(f"  Backtest-ready:   {agg_stats['stocks_with_backtest']}")

    # Top 5 patterns
    freq = agg_stats.get("pattern_frequency", {})
    top5 = list(freq.items())[:5]
    if top5:
        print(f"\n  Top 5 patterns:")
        for ptype, count in top5:
            print(f"    {ptype:30s} {count:6d}")

    print(f"\n  Output: {BACKTEST_DIR}")
    print("  Done.")


if __name__ == "__main__":
    main()
