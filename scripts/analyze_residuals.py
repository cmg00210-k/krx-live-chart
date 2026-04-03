#!/usr/bin/env python3
"""
KRX LIVE — Stage 5 Phase C: Residual Analysis

wc_return_pairs.csv에서 잔존변수 분석을 수행하여
residual_analysis.json을 생성한다.

분석 항목:
  1. 첨도 (Kurtosis) + 왜도 (Skewness) — 정규분포 이탈 측정
  2. Jarque-Bera 검정 — 정규분포 가설 검정
  3. 극단 잔차 클러스터링 — |e| > 3sigma 시간 인접성
  4. GARCH(1,1) 근사 — 변동성 군집 (numpy 기반)
  5. 이벤트 유형 분류 — A(패닉셀링), B(정책충격), C(섹터회전)

Usage:
    python scripts/analyze_residuals.py
    python scripts/analyze_residuals.py --horizon 5  (default: 5)

Output: data/backtest/residual_analysis.json

References:
  - core_data/02_statistics.md (첨도, 왜도, JB)
  - core_data/12_extreme_value_theory.md (EVT, GARCH)
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


def load_csv():
    """wc_return_pairs.csv 로드 → list of dicts"""
    rows = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def parse_returns(rows, horizon):
    """horizon별 수익률 추출, 날짜 기준 정렬"""
    col = f"ret_{horizon}"
    pairs = []
    for r in rows:
        val = r.get(col)
        if val is None or val == "":
            continue
        try:
            ret = float(val)
        except ValueError:
            continue
        pairs.append({
            "code": r["code"],
            "market": r.get("market", ""),
            "type": r.get("type", ""),
            "date": r.get("date", ""),
            "wc": float(r["wc"]) if r.get("wc") else 1.0,
            "ret": ret,
        })
    pairs.sort(key=lambda x: x["date"])
    return pairs


def distribution_stats(returns):
    """첨도, 왜도, JB 검정"""
    arr = np.array(returns)
    n = len(arr)
    if n < 20:
        return None

    mean = np.mean(arr)
    std = np.std(arr, ddof=1)
    skewness = float(sp_stats.skew(arr, bias=False))
    kurtosis = float(sp_stats.kurtosis(arr, bias=False, fisher=True))  # excess kurtosis

    # Jarque-Bera test
    jb_stat, jb_pvalue = sp_stats.jarque_bera(arr)

    return {
        "n": n,
        "mean": round(mean, 4),
        "std": round(std, 4),
        "skewness": round(skewness, 4),
        "kurtosis_excess": round(kurtosis, 4),
        "jarque_bera_stat": round(float(jb_stat), 2),
        "jarque_bera_p": round(float(jb_pvalue), 6),
        "normal_rejected": bool(jb_pvalue < 0.05),
    }


def extreme_residual_clusters(pairs, sigma_threshold=3.0):
    """극단 잔차(|e|>3sigma) 시간 클러스터링"""
    if len(pairs) < 30:
        return {"clusters": [], "total_extremes": 0}

    returns = np.array([p["ret"] for p in pairs])
    mean = np.mean(returns)
    std = np.std(returns, ddof=1)
    if std < 1e-10:
        return {"clusters": [], "total_extremes": 0}

    threshold = sigma_threshold * std

    # 극단 잔차 위치 추출
    extremes = []
    for i, p in enumerate(pairs):
        residual = abs(p["ret"] - mean)
        if residual > threshold:
            extremes.append({
                "index": i,
                "date": p["date"],
                "code": p["code"],
                "type": p["type"],
                "ret": p["ret"],
                "sigma": round(residual / std, 2),
            })

    # 시간 클러스터 감지: 같은 날짜에 3건 이상 → 클러스터
    by_date = defaultdict(list)
    for e in extremes:
        by_date[e["date"]].append(e)

    clusters = []
    for date, events in sorted(by_date.items()):
        if len(events) >= 3:
            # 이벤트 유형 추론
            avg_ret = np.mean([e["ret"] for e in events])
            markets = set(e.get("code", "")[:3] for e in events)

            if avg_ret < -2:
                event_type = "A"  # 패닉셀링
            elif len(markets) <= 2:
                event_type = "C"  # 섹터회전
            else:
                event_type = "B"  # 정책충격

            clusters.append({
                "date": date,
                "count": len(events),
                "avg_return": round(avg_ret, 3),
                "event_type": event_type,
                "event_label": {"A": "panic_selling", "B": "policy_shock", "C": "sector_rotation"}[event_type],
            })

    return {
        "total_extremes": len(extremes),
        "extreme_rate": round(len(extremes) / len(pairs) * 100, 2) if pairs else 0,
        "expected_rate_normal": round((1 - sp_stats.norm.cdf(sigma_threshold) * 2) * 100, 4),
        "clusters": clusters[:50],  # 최대 50개
        "cluster_count": len(clusters),
    }


def garch_proxy(returns, window=20):
    """GARCH(1,1) 근사 — numpy 기반 (arch 패키지 불필요)

    RiskMetrics/EWMA 방식으로 변동성 군집도를 추정.
    alpha + beta ≈ 1에 가까울수록 변동성 군집이 강함.
    """
    arr = np.array(returns)
    n = len(arr)
    if n < 50:
        return None

    mean = np.mean(arr)
    resid = arr - mean
    resid_sq = resid ** 2

    # EWMA 변동성 (lambda=0.94, RiskMetrics standard)
    lam = 0.94
    ewma_var = np.zeros(n)
    ewma_var[0] = np.var(resid[:window])
    for t in range(1, n):
        ewma_var[t] = lam * ewma_var[t - 1] + (1 - lam) * resid_sq[t - 1]

    # 변동성 군집도: corr(|resid_t|, |resid_t+1|)
    abs_resid = np.abs(resid)
    if n > 2:
        vol_cluster = float(np.corrcoef(abs_resid[:-1], abs_resid[1:])[0, 1])
    else:
        vol_cluster = 0

    # 유사 alpha+beta: EWMA에서 alpha = 1-lambda, beta = lambda
    alpha_proxy = round(1 - lam, 4)
    beta_proxy = round(lam, 4)

    return {
        "method": "EWMA_RiskMetrics",
        "lambda": lam,
        "alpha_proxy": alpha_proxy,
        "beta_proxy": beta_proxy,
        "alpha_plus_beta": round(alpha_proxy + beta_proxy, 4),
        "volatility_clustering_corr": round(vol_cluster, 4),
        "mean_ewma_vol": round(float(np.sqrt(np.mean(ewma_var))), 4),
        "interpretation": "strong" if vol_cluster > 0.3 else "moderate" if vol_cluster > 0.15 else "weak",
    }


def analyze_by_market(pairs):
    """KOSPI vs KOSDAQ 비교 분석"""
    by_market = defaultdict(list)
    for p in pairs:
        by_market[p["market"]].append(p["ret"])

    result = {}
    for market, rets in sorted(by_market.items()):
        if not market:
            continue
        result[market] = distribution_stats(rets)
    return result


def analyze_by_pattern(pairs):
    """패턴 유형별 분포 분석"""
    by_type = defaultdict(list)
    for p in pairs:
        by_type[p["type"]].append(p["ret"])

    result = {}
    for ptype, rets in sorted(by_type.items()):
        stats = distribution_stats(rets)
        if stats:
            result[ptype] = stats
    return result


def main():
    args = sys.argv[1:]
    horizon = 5
    for i, a in enumerate(args):
        if a == "--horizon" and i + 1 < len(args):
            horizon = int(args[i + 1])

    if not CSV_PATH.exists():
        print(f"[ERROR] {CSV_PATH} not found. Run backtest_all.py first.")
        sys.exit(1)

    print(f"[1/5] Loading wc_return_pairs.csv (horizon={horizon})...")
    rows = load_csv()
    pairs = parse_returns(rows, horizon)
    print(f"  -> {len(pairs)} return observations loaded")

    returns = [p["ret"] for p in pairs]

    print("[2/5] Distribution analysis (kurtosis, skewness, JB)...")
    dist = distribution_stats(returns)
    print(f"  -> skew={dist['skewness']}, kurtosis={dist['kurtosis_excess']}, "
          f"JB p={dist['jarque_bera_p']} ({'reject H0' if dist['normal_rejected'] else 'fail to reject'})")

    print("[3/5] Extreme residual clustering...")
    extremes = extreme_residual_clusters(pairs)
    print(f"  -> {extremes['total_extremes']} extremes ({extremes['extreme_rate']}%), "
          f"{extremes['cluster_count']} date clusters")

    print("[4/5] GARCH proxy (EWMA volatility clustering)...")
    garch = garch_proxy(returns)
    if garch:
        print(f"  -> vol_cluster_corr={garch['volatility_clustering_corr']}, "
              f"interpretation={garch['interpretation']}")

    print("[5/5] Market/pattern breakdown...")
    by_market = analyze_by_market(pairs)
    by_pattern = analyze_by_pattern(pairs)

    # Build output
    output = {
        "horizon": horizon,
        "total_observations": len(pairs),
        "distribution": dist,
        "extreme_residuals": extremes,
        "garch_proxy": garch,
        "by_market": by_market,
        "by_pattern": by_pattern,
    }

    out_path = BACKTEST_DIR / "residual_analysis.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n  Output: {out_path}")
    print("  Done.")


if __name__ == "__main__":
    main()
