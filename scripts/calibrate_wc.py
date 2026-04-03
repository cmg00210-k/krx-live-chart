#!/usr/bin/env python3
"""
KRX LIVE — Stage 5 Phase C: Wc Calibration

wc_return_pairs.csv에서 Wc 가중치 시스템의 효과를 검증하고
교정 계수를 생성하여 wc_calibration.json을 출력한다.

분석 항목:
  1. IC (Information Coefficient) — corr(Wc, future_return)
  2. A/B 검정 — Wc > median vs <= median (Welch t-test)
  3. 성분 귀속 — hw/vw/mw/rw 개별 기여도
  4. 패턴별 층화 IC — Tier 1/2/3 패턴 분류 기반
  5. Fama-MacBeth 스타일 날짜별 IC 안정성
  6. Benjamini-Hochberg FDR 보정
  7. 교정 계수 최적화 — clamp 범위 조정

Usage:
    python scripts/calibrate_wc.py
    python scripts/calibrate_wc.py --horizon 5  (default: 5)

Output: data/backtest/wc_calibration.json

References:
  - core_data/17_regression_backtesting.md (WLS 방법론)
  - core_data/04_psychology.md (전망이론 lambda=2.25)
  - project_wc_formula_chain.md (Wc 수식 체인)
"""

import csv
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import stats as sp_stats

ROOT = Path(__file__).resolve().parent.parent
BACKTEST_DIR = ROOT / "data" / "backtest"
CSV_PATH = BACKTEST_DIR / "wc_return_pairs.csv"

# Phase A에서 확인된 Tier 분류
TIER1_PATTERNS = {"doubleBottom", "doubleTop", "risingWedge", "threeWhiteSoldiers", "invertedHammer"}
TIER2_PATTERNS = {"bullishEngulfing", "hammer", "morningStar", "threeBlackCrows", "hangingMan", "shootingStar", "eveningStar"}
TIER3_PATTERNS = {"spinningTop", "doji", "fallingWedge"}


def load_data(horizon):
    """CSV 로드 + horizon 수익률 추출"""
    col = f"ret_{horizon}"
    records = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            val = row.get(col)
            if val is None or val == "":
                continue
            try:
                ret = float(val)
                wc = float(row["wc"]) if row.get("wc") else 1.0
                hw = float(row["hw"]) if row.get("hw") else 1.0
                vw = float(row["vw"]) if row.get("vw") else 1.0
                mw = float(row["mw"]) if row.get("mw") else 1.0
                rw = float(row["rw"]) if row.get("rw") else 1.0
            except ValueError:
                continue
            records.append({
                "code": row["code"],
                "market": row.get("market", ""),
                "type": row.get("type", ""),
                "signal": row.get("signal", ""),
                "date": row.get("date", ""),
                "wc": wc,
                "hw": hw,
                "vw": vw,
                "mw": mw,
                "rw": rw,
                "confidence": float(row["confidence"]) if row.get("confidence") else 50,
                "ret": ret,
            })
    return records


def calc_ic(wc_arr, ret_arr):
    """Information Coefficient: Spearman rank correlation"""
    if len(wc_arr) < 10:
        return None
    corr, pval = sp_stats.spearmanr(wc_arr, ret_arr)
    return {
        "ic": round(float(corr), 6),
        "p_value": round(float(pval), 6),
        "significant": bool(pval < 0.05),
        "n": len(wc_arr),
    }


def ab_test(records):
    """Wc > median vs <= median Welch t-test"""
    wcs = np.array([r["wc"] for r in records])
    rets = np.array([r["ret"] for r in records])
    median_wc = np.median(wcs)

    high_mask = wcs > median_wc
    low_mask = ~high_mask

    high_rets = rets[high_mask]
    low_rets = rets[low_mask]

    if len(high_rets) < 10 or len(low_rets) < 10:
        return None

    t_stat, p_value = sp_stats.ttest_ind(high_rets, low_rets, equal_var=False)

    return {
        "median_wc": round(float(median_wc), 4),
        "high_wc_group": {
            "n": int(np.sum(high_mask)),
            "mean_return": round(float(np.mean(high_rets)), 4),
            "std_return": round(float(np.std(high_rets, ddof=1)), 4),
        },
        "low_wc_group": {
            "n": int(np.sum(low_mask)),
            "mean_return": round(float(np.mean(low_rets)), 4),
            "std_return": round(float(np.std(low_rets, ddof=1)), 4),
        },
        "t_stat": round(float(t_stat), 4),
        "p_value": round(float(p_value), 6),
        "significant": bool(p_value < 0.05),
        "difference": round(float(np.mean(high_rets) - np.mean(low_rets)), 4),
    }


def component_attribution(records):
    """hw/vw/mw/rw 개별 기여도 (Spearman correlation)"""
    components = ["hw", "vw", "mw", "rw", "wc"]
    rets = np.array([r["ret"] for r in records])
    result = {}

    for comp in components:
        vals = np.array([r[comp] for r in records])
        # 상수인 경우 (std=0) 건너뜀
        if np.std(vals) < 1e-10:
            result[comp] = {"ic": 0, "note": "constant_across_sample"}
            continue
        ic_result = calc_ic(vals, rets)
        if ic_result:
            result[comp] = ic_result

    return result


def fama_macbeth_ic(records):
    """날짜별 IC → 평균 IC + t-test (Fama-MacBeth 1973 방식)

    횡단면 IC를 날짜별로 계산한 후, IC의 시계열 평균이 0과 다른지 검정.
    단일 IC보다 훨씬 강건한 유의성 검정.
    """
    by_date = defaultdict(list)
    for r in records:
        by_date[r["date"]].append(r)

    daily_ics = []
    for date, recs in sorted(by_date.items()):
        if len(recs) < 20:
            continue
        wcs = np.array([r["wc"] for r in recs])
        rets = np.array([r["ret"] for r in recs])
        if np.std(wcs) < 1e-10:
            continue
        corr, _ = sp_stats.spearmanr(wcs, rets)
        if np.isfinite(corr):
            daily_ics.append({"date": date, "ic": float(corr), "n": len(recs)})

    if len(daily_ics) < 5:
        return None

    ic_values = np.array([d["ic"] for d in daily_ics])
    mean_ic = float(np.mean(ic_values))
    std_ic = float(np.std(ic_values, ddof=1))
    n_days = len(ic_values)

    # t-test: H0: mean IC = 0
    t_stat = mean_ic / (std_ic / np.sqrt(n_days)) if std_ic > 0 else 0
    p_value = float(2 * sp_stats.t.sf(abs(t_stat), df=n_days - 1))

    return {
        "n_days": n_days,
        "mean_ic": round(mean_ic, 6),
        "std_ic": round(std_ic, 6),
        "t_stat": round(t_stat, 4),
        "p_value": round(p_value, 6),
        "significant": bool(p_value < 0.05),
        "ic_positive_pct": round(float(np.mean(ic_values > 0) * 100), 1),
    }


def pattern_tier_analysis(records):
    """Tier 1/2/3 + 패턴별 IC"""
    tiers = {"tier1": [], "tier2": [], "tier3": [], "other": []}
    by_pattern = defaultdict(list)

    for r in records:
        pt = r["type"]
        by_pattern[pt].append(r)
        if pt in TIER1_PATTERNS:
            tiers["tier1"].append(r)
        elif pt in TIER2_PATTERNS:
            tiers["tier2"].append(r)
        elif pt in TIER3_PATTERNS:
            tiers["tier3"].append(r)
        else:
            tiers["other"].append(r)

    result = {"tiers": {}, "by_pattern": {}}

    # Tier-level IC
    for tier_name, recs in tiers.items():
        if len(recs) < 30:
            continue
        wcs = np.array([r["wc"] for r in recs])
        rets = np.array([r["ret"] for r in recs])
        ic = calc_ic(wcs, rets)
        ab = ab_test(recs)
        result["tiers"][tier_name] = {"ic": ic, "ab_test": ab, "n": len(recs)}

    # Pattern-level IC
    for pt, recs in sorted(by_pattern.items()):
        if len(recs) < 30:
            continue
        wcs = np.array([r["wc"] for r in recs])
        rets = np.array([r["ret"] for r in recs])
        ic = calc_ic(wcs, rets)
        if ic:
            result["by_pattern"][pt] = ic

    return result


def benjamini_hochberg(p_values, alpha=0.05):
    """Benjamini-Hochberg FDR 보정

    다중비교에서 false discovery rate를 alpha 이하로 통제.
    """
    n = len(p_values)
    if n == 0:
        return []

    # (원래 인덱스, p-value) → p-value 오름차순 정렬
    indexed = sorted(enumerate(p_values), key=lambda x: x[1])
    rejected = [False] * n
    max_k = -1

    for k, (orig_idx, p) in enumerate(indexed):
        threshold = alpha * (k + 1) / n
        if p <= threshold:
            max_k = k

    # max_k까지의 모든 검정을 기각
    if max_k >= 0:
        for k in range(max_k + 1):
            orig_idx = indexed[k][0]
            rejected[orig_idx] = True

    return rejected


def calibration_analysis(records):
    """Wc 교정 분석 — clamp 범위 최적 탐색"""
    # 현재 범위
    current_ranges = {
        "hw": [0.6, 1.4],
        "vw": [0.7, 1.4],
        "mw": [0.6, 1.0],
        "rw": [0.7, 1.0],
    }

    # 실측 분포
    observed = {}
    for comp in ["hw", "vw", "mw", "rw", "wc"]:
        vals = [r[comp] for r in records]
        arr = np.array(vals)
        observed[comp] = {
            "mean": round(float(np.mean(arr)), 4),
            "std": round(float(np.std(arr, ddof=1)), 4),
            "p5": round(float(np.percentile(arr, 5)), 4),
            "p25": round(float(np.percentile(arr, 25)), 4),
            "p50": round(float(np.percentile(arr, 50)), 4),
            "p75": round(float(np.percentile(arr, 75)), 4),
            "p95": round(float(np.percentile(arr, 95)), 4),
            "min": round(float(np.min(arr)), 4),
            "max": round(float(np.max(arr)), 4),
        }

    # 방향 정합성: buy 패턴에서 Wc 높으면 수익률도 높은가?
    direction_check = {}
    for signal in ["buy", "sell", "neutral"]:
        sig_recs = [r for r in records if r["signal"] == signal]
        if len(sig_recs) < 100:
            continue
        wcs = np.array([r["wc"] for r in sig_recs])
        rets = np.array([r["ret"] for r in sig_recs])
        # buy: Wc↑ → ret↑ (양의 상관), sell: Wc↑ → ret↓ (음의 상관)
        corr, p = sp_stats.spearmanr(wcs, rets)
        expected_sign = 1 if signal == "buy" else -1 if signal == "sell" else 0
        actual_sign = 1 if corr > 0 else -1 if corr < 0 else 0
        direction_check[signal] = {
            "n": len(sig_recs),
            "ic": round(float(corr), 6),
            "p_value": round(float(p), 6),
            "expected_direction": "positive" if expected_sign > 0 else "negative" if expected_sign < 0 else "neutral",
            "actual_direction": "positive" if actual_sign > 0 else "negative" if actual_sign < 0 else "zero",
            "consistent": bool(expected_sign == 0 or expected_sign == actual_sign),
        }

    return {
        "current_ranges": current_ranges,
        "observed_distributions": observed,
        "direction_consistency": direction_check,
    }


def main():
    args = sys.argv[1:]
    horizon = 5
    for i, a in enumerate(args):
        if a == "--horizon" and i + 1 < len(args):
            horizon = int(args[i + 1])

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest_all.py first.")
        sys.exit(1)

    print(f"[1/6] Loading data (horizon={horizon})...")
    records = load_data(horizon)
    print(f"  -> {len(records)} records")

    print("[2/6] Overall IC + A/B test...")
    wcs = np.array([r["wc"] for r in records])
    rets = np.array([r["ret"] for r in records])
    overall_ic = calc_ic(wcs, rets)
    overall_ab = ab_test(records)
    print(f"  -> IC={overall_ic['ic']}, p={overall_ic['p_value']}")
    if overall_ab:
        print(f"  -> A/B diff={overall_ab['difference']}%, t={overall_ab['t_stat']}, p={overall_ab['p_value']}")

    print("[3/6] Component attribution (hw/vw/mw/rw)...")
    components = component_attribution(records)
    for comp, data in components.items():
        ic_val = data.get("ic", 0)
        note = data.get("note", "")
        print(f"  -> {comp}: IC={ic_val}" + (f" ({note})" if note else ""))

    print("[4/6] Fama-MacBeth daily IC stability...")
    fm = fama_macbeth_ic(records)
    if fm:
        print(f"  -> mean_IC={fm['mean_ic']}, t={fm['t_stat']}, p={fm['p_value']}, "
              f"positive_days={fm['ic_positive_pct']}%")

    print("[5/6] Pattern tier analysis + BH FDR...")
    tiers = pattern_tier_analysis(records)

    # BH FDR on pattern-level ICs
    pattern_ics = tiers.get("by_pattern", {})
    if pattern_ics:
        p_vals = [v["p_value"] for v in pattern_ics.values()]
        names = list(pattern_ics.keys())
        rejected = benjamini_hochberg(p_vals)
        for i, name in enumerate(names):
            pattern_ics[name]["bh_rejected"] = rejected[i]
        n_sig = sum(rejected)
        print(f"  -> {n_sig}/{len(names)} patterns significant after BH FDR correction")

    print("[6/6] Calibration analysis...")
    calibration = calibration_analysis(records)
    for sig, check in calibration["direction_consistency"].items():
        tag = "OK" if check["consistent"] else "MISMATCH"
        print(f"  -> {sig}: IC={check['ic']}, expected={check['expected_direction']}, "
              f"actual={check['actual_direction']} [{tag}]")

    # Build output
    output = {
        "horizon": horizon,
        "total_records": len(records),
        "overall": {
            "ic": overall_ic,
            "ab_test": overall_ab,
        },
        "component_attribution": components,
        "fama_macbeth": fm,
        "pattern_tiers": tiers,
        "calibration": calibration,
    }

    out_path = BACKTEST_DIR / "wc_calibration.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n  Output: {out_path}")
    print("  Done.")


if __name__ == "__main__":
    main()
