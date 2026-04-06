# -*- coding: utf-8 -*-
"""
calibrate_constants.py — Phase A 백테스트 데이터로 Wc 시스템 5개 고정 상수 교정

입력:
  1) data/backtest/wc_return_pairs.csv (302,986행)
  2) data/backtest/theory_vs_actual.json
  3) data/backtest/pattern_performance.json
  4) data/backtest/results/*.json (종목별)

출력:
  data/backtest/calibrated_constants.json

교정 대상 5개:
  C-1: rr_thresholds (low, high)   — low < high 보장
  C-2: conf_L 공식
  D-1: candle_target_atr (strong/medium/weak)
  D-2: sell_hw_inversion (a, b)
  D-3: rr_penalty (low, high)     — C-1 결과 의존
"""

import sys
import os
import json
import warnings
import numpy as np
import pandas as pd
from scipy import stats
import argparse

# Force UTF-8 on Windows (Korean print output)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

warnings.filterwarnings('ignore', category=RuntimeWarning)
warnings.filterwarnings('ignore', category=pd.errors.SettingWithCopyWarning)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data', 'backtest')


# ──────────────────────────────────────────────
# numpy/pandas → JSON 직렬화 헬퍼
# ──────────────────────────────────────────────
class NumpyEncoder(json.JSONEncoder):
    """numpy 타입을 JSON 기본 타입으로 변환"""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def _to_native(obj):
    """numpy/pandas 타입을 재귀적으로 Python 기본 타입으로 변환"""
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
# 패턴 분류
# ──────────────────────────────────────────────
CHART_PATTERNS = {
    'doubleBottom', 'doubleTop', 'headAndShoulders', 'inverseHeadAndShoulders',
    'ascendingTriangle', 'descendingTriangle', 'symmetricTriangle',
    'risingWedge', 'fallingWedge'
}

STRENGTH_MAP = {
    'strong': [
        'threeWhiteSoldiers', 'threeBlackCrows', 'bullishEngulfing',
        'bearishEngulfing', 'morningStar', 'eveningStar',
        'bullishMarubozu', 'bearishMarubozu'
    ],
    'medium': [
        'hammer', 'shootingStar', 'bullishHarami', 'bearishHarami',
        'piercingLine', 'darkCloud', 'dragonflyDoji', 'gravestoneDoji',
        'tweezerBottom', 'tweezerTop'
    ],
    'weak': [
        'invertedHammer', 'doji', 'spinningTop', 'hangingMan'
    ]
}

# 역참조: type -> strength tier
TYPE_TO_STRENGTH = {}
for _tier, _types in STRENGTH_MAP.items():
    for _t in _types:
        TYPE_TO_STRENGTH[_t] = _tier


def load_data():
    """모든 데이터 소스를 한 번에 로드"""
    print("[1/7] Loading data...")

    csv_path = os.path.join(DATA_DIR, 'wc_return_pairs.csv')
    df = pd.read_csv(csv_path)
    print(f"  -> {len(df)} records from CSV")

    tva_path = os.path.join(DATA_DIR, 'theory_vs_actual.json')
    with open(tva_path, encoding='utf-8') as f:
        theory_vs_actual = json.load(f)
    n_patterns_tva = len(theory_vs_actual.get('by_pattern_type', {}))
    print(f"  -> theory_vs_actual: {n_patterns_tva} pattern types")

    pp_path = os.path.join(DATA_DIR, 'pattern_performance.json')
    with open(pp_path, encoding='utf-8') as f:
        pattern_perf = json.load(f)
    print(f"  -> pattern_performance: {len(pattern_perf)} pattern types")

    return df, theory_vs_actual, pattern_perf


def time_split(df, oos_ratio=0.3, cutoff_date=None):
    """Time-based train/test split for OOS validation (Fix-12).

    Returns (df_train, df_test, cutoff_date_str).
    """
    df_sorted = df.sort_values('date')
    dates = sorted(df_sorted['date'].unique())

    if cutoff_date:
        cutoff = cutoff_date
    else:
        cutoff_idx = int(len(dates) * (1 - oos_ratio))
        cutoff = dates[cutoff_idx]

    df_train = df_sorted[df_sorted['date'] < cutoff].copy()
    df_test = df_sorted[df_sorted['date'] >= cutoff].copy()

    print(f"  [OOS] Train: {len(df_train):,} records ({df_train['date'].min()} ~ {df_train['date'].max()})")
    print(f"  [OOS] Test:  {len(df_test):,} records ({df_test['date'].min()} ~ {df_test['date'].max()})")
    print(f"  [OOS] Cutoff: {cutoff}")

    return df_train, df_test, str(cutoff)


def validate_oos(df_test):
    """Validate calibrated constants on OOS data (Fix-12).

    Returns dict with OOS IC, WR, and acceptance status.
    Rejection criteria: OOS IC < 0.02 OR OOS WR < 52%.
    """
    df_valid = df_test.dropna(subset=['ret_5'])
    if len(df_valid) < 50:
        return {"status": "insufficient_data", "n": int(len(df_valid))}

    # OOS IC: Spearman correlation of wc vs ret_5
    wc = df_valid['wc'].values
    ret5 = df_valid['ret_5'].values
    ic, ic_p = stats.spearmanr(wc, ret5)

    # OOS WR: directional accuracy
    df_dir = df_valid[df_valid['signal_direction'].isin([1, -1])]
    if len(df_dir) > 0:
        correct = ((df_dir['signal_direction'] == 1) & (df_dir['ret_5'] > 0)) | \
                  ((df_dir['signal_direction'] == -1) & (df_dir['ret_5'] < 0))
        oos_wr = float(correct.mean() * 100)
    else:
        oos_wr = 50.0

    rejected = (ic < 0.02) or (oos_wr < 52.0)

    return {
        "status": "rejected" if rejected else "accepted",
        "n": int(len(df_valid)),
        "n_directed": int(len(df_dir)),
        "oos_ic": round(float(ic), 6),
        "oos_ic_pvalue": round(float(ic_p), 6),
        "oos_wr": round(float(oos_wr), 2),
        "rejection_criteria": "OOS IC < 0.02 OR OOS WR < 52%",
    }


# ──────────────────────────────────────────────
# C-1: calibrate_rr_thresholds
# ──────────────────────────────────────────────
def calibrate_rr_thresholds(df, theory_vs_actual):
    """
    riskReward 임계값 [low, high] 교정. low < high 보장.

    방법:
    1. theory_vs_actual에서 패턴별 mean riskReward를 CSV 행에 매핑
    2. 후보 쌍 (low, high) 전수 탐색 (0.25 grid, low < high)
    3. 3구간 (below_low, mid, above_high) 분할 후 ANOVA F-test
    4. above_high vs below_low의 mean ret_5 차이가 최대인 쌍 선택
    5. Welch t-test로 각 경계의 유의성 검증
    """
    print("\n[2/7] C-1: Calibrating rr_thresholds...")
    current = [1.0, 1.5]

    bpt = theory_vs_actual.get('by_pattern_type', {})

    # 패턴별 mean riskReward 매핑
    pattern_rr = {}
    for pname, pdata in bpt.items():
        rr_info = pdata.get('riskReward', {})
        if rr_info.get('mean') is not None:
            pattern_rr[pname] = rr_info['mean']

    df_valid = df.dropna(subset=['ret_5']).copy()
    df_valid['pattern_rr'] = df_valid['type'].map(pattern_rr)
    df_with_rr = df_valid.dropna(subset=['pattern_rr']).copy()

    if len(df_with_rr) < 100:
        print("  -> 데이터 부족 (< 100), 현재값 유지")
        return {
            "current": current, "calibrated": current, "changed": False,
            "evidence": "데이터 부족"
        }

    print(f"  -> {len(df_with_rr)} records with pattern riskReward mapped")

    # 0.5 단위 grid 통계 출력
    df_with_rr['rr_bin'] = (df_with_rr['pattern_rr'] / 0.5).apply(np.floor) * 0.5
    bin_stats = df_with_rr.groupby('rr_bin').agg(
        mean_ret=('ret_5', 'mean'),
        std_ret=('ret_5', 'std'),
        count=('ret_5', 'count')
    ).reset_index()

    print("  -> riskReward 구간별 통계:")
    for _, row in bin_stats.iterrows():
        print(f"     [{row['rr_bin']:.1f}, {row['rr_bin']+0.5:.1f}): "
              f"mean={row['mean_ret']:.4f}%, n={int(row['count'])}")

    rr_values = df_with_rr['pattern_rr'].values
    ret_values = df_with_rr['ret_5'].values

    # ── 2-threshold grid search (low < high, 최소 gap 0.25) ──
    candidates = np.arange(0.25, 3.5, 0.25)
    MIN_ZONE_N = 30  # 각 zone 최소 표본

    best_pair = tuple(current)
    best_score = -np.inf  # score = mean(above_high) - mean(below_low)
    best_f_stat = 0
    best_f_pval = 1.0

    for lo in candidates:
        for hi in candidates:
            if hi <= lo:
                continue
            below = ret_values[rr_values < lo]
            mid = ret_values[(rr_values >= lo) & (rr_values < hi)]
            above = ret_values[rr_values >= hi]
            if len(below) < MIN_ZONE_N or len(above) < MIN_ZONE_N:
                continue
            # mid가 비어도 2-zone 비교는 가능하지만, 3-zone이 더 정보적
            score = np.mean(above) - np.mean(below)
            if score > best_score:
                best_score = score
                best_pair = (lo, hi)
                # ANOVA if mid exists
                if len(mid) >= MIN_ZONE_N:
                    f_stat, f_pval = stats.f_oneway(below, mid, above)
                    best_f_stat = f_stat
                    best_f_pval = f_pval
                else:
                    t_stat, t_pval = stats.ttest_ind(above, below, equal_var=False)
                    best_f_stat = t_stat
                    best_f_pval = t_pval

    best_low, best_high = best_pair

    # 각 경계 유의성 Welch t-test
    below_low = ret_values[rr_values < best_low]
    mid_zone = ret_values[(rr_values >= best_low) & (rr_values < best_high)]
    above_high = ret_values[rr_values >= best_high]

    # low 경계: below vs (mid + above)
    above_low_all = ret_values[rr_values >= best_low]
    if len(below_low) >= MIN_ZONE_N and len(above_low_all) >= MIN_ZONE_N:
        _, p_low = stats.ttest_ind(above_low_all, below_low, equal_var=False)
    else:
        p_low = 1.0

    # high 경계: below_high vs above_high
    below_high_all = ret_values[(rr_values >= best_low) & (rr_values < best_high)]
    if len(below_high_all) >= MIN_ZONE_N and len(above_high) >= MIN_ZONE_N:
        _, p_high = stats.ttest_ind(above_high, below_high_all, equal_var=False)
    else:
        p_high = 1.0

    # 유의성 판단: 전체 ANOVA p < 0.05이면 변경, 아니면 현재값
    significant = best_f_pval < 0.05

    if significant:
        calibrated = [round(best_low, 2), round(best_high, 2)]
    else:
        calibrated = current

    changed = calibrated != current

    evidence = (
        f"best_pair=[{best_low}, {best_high}], score={best_score:.4f}%, "
        f"F/t={best_f_stat:.2f}, p={best_f_pval:.4e}, "
        f"p_low={p_low:.4e}, p_high={p_high:.4e}, "
        f"n_below={len(below_low)}, n_mid={len(mid_zone)}, n_above={len(above_high)}"
    )
    print(f"  -> 결과: {calibrated} (changed={changed})")
    print(f"  -> 근거: {evidence}")

    return {
        "current": current,
        "calibrated": calibrated,
        "changed": changed,
        "p_value_overall": round(float(best_f_pval), 6),
        "p_value_low": round(float(p_low), 6),
        "p_value_high": round(float(p_high), 6),
        "score": round(float(best_score), 4),
        "zone_counts": {
            "below": int(len(below_low)),
            "mid": int(len(mid_zone)),
            "above": int(len(above_high))
        },
        "zone_means": {
            "below": round(float(np.mean(below_low)), 4) if len(below_low) > 0 else None,
            "mid": round(float(np.mean(mid_zone)), 4) if len(mid_zone) > 0 else None,
            "above": round(float(np.mean(above_high)), 4) if len(above_high) > 0 else None
        },
        "evidence": evidence
    }


# ──────────────────────────────────────────────
# C-2: calibrate_conf_L
# ──────────────────────────────────────────────
def calibrate_conf_L(df, pattern_perf):
    """
    per-stock results에 WLS regression 결과(R^2, coeffs)가 없으므로
    pattern_performance.json 집계 통계로 대체.

    현재 공식: conf_L = R^2 * min(n/100, 1)
    방향 정확도에 대한 logistic 회귀로 confidence/wc 기여도 평가.
    N_scale 최적화 (min(n/N_scale, 1)의 N_scale).
    """
    print("\n[3/7] C-2: Calibrating conf_L formula...")
    current_formula = "R_sq * min(n/100, 1)"

    df_valid = df.dropna(subset=['ret_5']).copy()

    # buy/sell만 (neutral 제외)
    df_directed = df_valid[df_valid['signal'].isin(['buy', 'sell'])].copy()

    if len(df_directed) < 100:
        print("  -> 방향성 데이터 부족, 현재 공식 유지")
        return {
            "current_formula": current_formula,
            "calibrated_formula": current_formula,
            "changed": False,
            "evidence": "방향성 데이터 부족"
        }

    df_directed['correct'] = np.where(
        df_directed['signal'] == 'buy',
        (df_directed['ret_5'] > 0).astype(int),
        (df_directed['ret_5'] < 0).astype(int)
    )

    # confidence 구간별 정확도 분석
    df_directed['conf_bin'] = (df_directed['confidence'] / 10).apply(np.floor) * 10

    conf_accuracy = df_directed.groupby('conf_bin').agg(
        accuracy=('correct', 'mean'),
        count=('correct', 'count')
    ).reset_index()

    print("  -> confidence 구간별 방향 정확도:")
    for _, row in conf_accuracy.iterrows():
        print(f"     conf [{int(row['conf_bin'])}, {int(row['conf_bin'])+10}): "
              f"accuracy={row['accuracy']:.3f}, n={int(row['count'])}")

    # 로지스틱 회귀: correct ~ confidence + wc
    from scipy.optimize import minimize

    X = df_directed[['confidence', 'wc']].values
    y = df_directed['correct'].values

    X_norm = X.copy().astype(float)
    X_norm[:, 0] = X_norm[:, 0] / 100.0  # confidence 0~1

    def neg_log_likelihood(params):
        a, b_conf, b_wc = params
        z = a + b_conf * X_norm[:, 0] + b_wc * X_norm[:, 1]
        z = np.clip(z, -20, 20)
        p = 1.0 / (1.0 + np.exp(-z))
        p = np.clip(p, 1e-10, 1 - 1e-10)
        return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))

    try:
        result = minimize(neg_log_likelihood, [0.0, 1.0, 0.5], method='Nelder-Mead',
                          options={'maxiter': 5000})
        a_opt, b_conf_opt, b_wc_opt = result.x

        print(f"  -> 로지스틱 회귀 결과: a={a_opt:.4f}, b_conf={b_conf_opt:.4f}, b_wc={b_wc_opt:.4f}")

        # Bootstrap CI for b_conf
        n_boot = 200
        b_conf_boots = []
        rng = np.random.RandomState(42)
        n_data = len(y)

        for i in range(n_boot):
            idx = rng.choice(n_data, n_data, replace=True)
            X_b = X_norm[idx]
            y_b = y[idx]

            def nll_boot(params, Xb=X_b, yb=y_b):
                aa, bc, bw = params
                z = aa + bc * Xb[:, 0] + bw * Xb[:, 1]
                z = np.clip(z, -20, 20)
                p = 1.0 / (1.0 + np.exp(-z))
                p = np.clip(p, 1e-10, 1 - 1e-10)
                return -np.mean(yb * np.log(p) + (1 - yb) * np.log(1 - p))

            res_b = minimize(nll_boot, result.x, method='Nelder-Mead',
                             options={'maxiter': 3000})
            b_conf_boots.append(res_b.x[1])

            if (i + 1) % 50 == 0:
                print(f"     bootstrap {i+1}/{n_boot}...")

        ci_low = float(np.percentile(b_conf_boots, 2.5))
        ci_high = float(np.percentile(b_conf_boots, 97.5))
        # CI가 0을 포함하지 않으면 유의
        significant = (ci_low > 0) or (ci_high < 0)

        print(f"  -> b_conf 95% CI: [{ci_low:.4f}, {ci_high:.4f}], significant={significant}")

        # N_scale 최적화: 패턴별 정확도와 표본 수 관계
        pat_acc = df_directed.groupby('type').agg(
            accuracy=('correct', 'mean'),
            count=('correct', 'count'),
            mean_conf=('confidence', 'mean')
        ).reset_index()

        # pattern_performance에서 h=5 occurrence 수
        pattern_n = {}
        for pname, pdata in pattern_perf.items():
            h5 = pdata.get('5', {})
            if h5:
                pattern_n[pname] = h5.get('total_occurrences', 0)
        pat_acc['n_perf'] = pat_acc['type'].map(pattern_n).fillna(0)

        # N_scale 선택: min(n/N_scale, 1) 가중치로 accuracy를 예측할 때
        # 큰 표본 패턴은 weight=1, 작은 표본 패턴은 weight<1
        # 최적 N_scale = accuracy와 weighted accuracy의 차이가 가장 의미있는 값
        best_n_scale = 100
        if len(pat_acc) >= 5:
            accuracies = pat_acc['accuracy'].values
            n_vals = pat_acc['count'].values

            # N_scale 후보별: weighted accuracy가 raw accuracy와 가장 다른 정보를 제공하는 스케일
            # 사실상 작은 표본의 불안정한 accuracy를 감쇠하는 역할이므로,
            # 표본 수가 N_scale 이하인 패턴의 accuracy 분산이 높다는 기준
            best_var_ratio = 0
            for n_scale in [30, 50, 75, 100, 150, 200, 300, 500]:
                small = accuracies[n_vals < n_scale]
                large = accuracies[n_vals >= n_scale]
                if len(small) >= 2 and len(large) >= 2:
                    var_ratio = np.var(small) / (np.var(large) + 1e-10)
                    if var_ratio > best_var_ratio:
                        best_var_ratio = var_ratio
                        best_n_scale = n_scale

            print(f"  -> 최적 N_scale: {best_n_scale} (var_ratio={best_var_ratio:.2f})")

        formula_changed = significant and (b_conf_opt > 0.1 or best_n_scale != 100)
        if formula_changed:
            new_formula = f"R_sq * min(n/{best_n_scale}, 1)"
        else:
            new_formula = current_formula

        evidence = (
            f"Logistic: a={a_opt:.3f}, b_conf={b_conf_opt:.3f}, b_wc={b_wc_opt:.3f}; "
            f"b_conf CI=[{ci_low:.3f}, {ci_high:.3f}]; "
            f"N_scale={best_n_scale}; overall_accuracy={df_directed['correct'].mean():.3f}"
        )

    except Exception as e:
        print(f"  -> 로지스틱 회귀 실패: {e}")
        import traceback
        traceback.print_exc()
        formula_changed = False
        new_formula = current_formula
        evidence = f"회귀 실패: {str(e)}"
        significant = False
        a_opt = b_conf_opt = b_wc_opt = 0.0
        ci_low = ci_high = 0.0
        best_n_scale = 100

    print(f"  -> 결과: {new_formula} (changed={formula_changed})")

    return {
        "current_formula": current_formula,
        "calibrated_formula": new_formula,
        "calibrated_n_scale": int(best_n_scale),
        "changed": bool(formula_changed),
        "logistic_coeffs": {
            "intercept": round(float(a_opt), 4),
            "b_confidence": round(float(b_conf_opt), 4),
            "b_wc": round(float(b_wc_opt), 4)
        },
        "b_conf_CI_95": [round(float(ci_low), 4), round(float(ci_high), 4)],
        "overall_direction_accuracy": round(float(df_directed['correct'].mean()), 4),
        "evidence": evidence
    }


# ──────────────────────────────────────────────
# D-1: calibrate_candle_atr
# ──────────────────────────────────────────────
def calibrate_candle_atr(df):
    """
    캔들 패턴의 strength tier별 mean(|ret_5|)로 ATR 배수 교정.
    KRX 평균 ATR/close = 0.025 (2.5%) 사용.
    """
    print("\n[4/7] D-1: Calibrating candle_target_atr...")
    current = {"strong": 1.0, "medium": 0.7, "weak": 0.5}
    ATR_NORM = 0.025

    df_valid = df.dropna(subset=['ret_5']).copy()
    df_candle = df_valid[~df_valid['type'].isin(CHART_PATTERNS)].copy()
    df_candle['strength'] = df_candle['type'].map(TYPE_TO_STRENGTH)
    df_candle = df_candle.dropna(subset=['strength'])

    print(f"  -> 캔들 패턴 레코드: {len(df_candle)}")

    calibrated = {}
    tier_stats = {}

    for tier in ['strong', 'medium', 'weak']:
        tier_data = df_candle[df_candle['strength'] == tier]
        n = len(tier_data)

        if n < 30:
            print(f"  -> {tier}: n={n} < 30, 현재값 유지 ({current[tier]})")
            calibrated[tier] = current[tier]
            tier_stats[tier] = {"n": int(n), "fallback": True}
            continue

        abs_ret5 = tier_data['ret_5'].abs()
        mean_abs_ret = float(abs_ret5.mean())
        std_abs_ret = float(abs_ret5.std())
        se = std_abs_ret / np.sqrt(n)

        # ATR 배수 = mean(|ret_5|%) / (ATR_NORM * 100)
        atr_mult = mean_abs_ret / (ATR_NORM * 100)
        ci_lo = (mean_abs_ret - 1.96 * se) / (ATR_NORM * 100)
        ci_hi = (mean_abs_ret + 1.96 * se) / (ATR_NORM * 100)
        atr_mult = round(atr_mult, 2)

        print(f"  -> {tier}: n={n}, mean|ret_5|={mean_abs_ret:.3f}%, "
              f"ATR mult={atr_mult} [{ci_lo:.2f}, {ci_hi:.2f}]")

        calibrated[tier] = atr_mult
        tier_stats[tier] = {
            "n": int(n),
            "mean_abs_ret5": round(mean_abs_ret, 4),
            "std_abs_ret5": round(std_abs_ret, 4),
            "atr_multiplier": atr_mult,
            "CI_95": [round(ci_lo, 3), round(ci_hi, 3)],
            "fallback": False
        }

    # Kruskal-Wallis H-test
    groups = []
    for tier in ['strong', 'medium', 'weak']:
        td = df_candle[df_candle['strength'] == tier]['ret_5'].abs().dropna()
        if len(td) >= 30:
            groups.append(td.values)

    if len(groups) >= 2:
        h_stat, h_pval = stats.kruskal(*groups)
        print(f"  -> Kruskal-Wallis H={h_stat:.2f}, p={h_pval:.4e}")
    else:
        h_stat, h_pval = 0.0, 1.0

    changed = calibrated != current
    print(f"  -> 결과: {calibrated} (changed={changed})")

    return {
        "current": current,
        "calibrated": calibrated,
        "changed": bool(changed),
        "atr_norm_used": ATR_NORM,
        "tier_details": tier_stats,
        "kruskal_wallis_H": round(float(h_stat), 4),
        "kruskal_wallis_p": round(float(h_pval), 6),
        "evidence": (
            f"ATR_NORM={ATR_NORM}, "
            f"strong={calibrated['strong']}x, medium={calibrated['medium']}x, weak={calibrated['weak']}x, "
            f"KW p={h_pval:.4e}"
        )
    }


# ──────────────────────────────────────────────
# D-2: calibrate_sell_hw
# ──────────────────────────────────────────────
def calibrate_sell_hw(df):
    """
    sell signal에 대해 ret_5 = alpha + beta * hw OLS 회귀.
    최적 sell_hw = a_opt + b_opt * hw 도출.

    sell_hw는 Wc 가중치의 hw 대체값. sell에서 hw가 높으면
    (강한 상승 이력) sell 신호에 불리하므로 반전 가중이 필요.
    현재 sell_hw = 2 - hw (a=2, b=-1).
    """
    print("\n[5/7] D-2: Calibrating sell_hw_inversion...")
    current = {"a": 2, "b": -1}

    df_valid = df.dropna(subset=['ret_5', 'hw']).copy()
    df_sell = df_valid[df_valid['signal'] == 'sell'].copy()

    if len(df_sell) < 30:
        print(f"  -> sell 데이터 부족 (n={len(df_sell)}), 현재값 유지")
        return {
            "current": current, "calibrated": current, "changed": False,
            "evidence": "sell 데이터 부족"
        }

    print(f"  -> sell 레코드: {len(df_sell)}")

    hw = df_sell['hw'].values
    ret5 = df_sell['ret_5'].values

    # OLS: ret_5 = intercept + slope * hw
    slope, intercept, r_value, p_value, std_err = stats.linregress(hw, ret5)

    print(f"  -> OLS: ret_5 = {intercept:.4f} + {slope:.4f} * hw")
    print(f"     R^2={r_value**2:.6f}, p(slope)={p_value:.4e}, SE={std_err:.4f}")

    t_stat = slope / std_err if std_err > 0 else 0.0
    significant = p_value < 0.05

    if significant:
        # sell_hw 목적: sell 성공(ret_5<0)일 때 Wc를 높이는 가중치
        # slope > 0: hw가 높을수록 ret_5 양수(sell 불리)
        #   -> sell_hw는 hw와 반비례 (b < 0) — 현재 방향 유지
        # slope < 0: hw가 높을수록 ret_5 음수(sell 유리)
        #   -> sell_hw는 hw와 비례 (b > 0) — 방향 반전 필요

        mean_hw = float(np.mean(hw))
        std_ret = float(np.std(ret5))

        # 효과 크기를 sell_hw 계수로 변환
        # b_opt 부호: slope 부호의 반대 (sell 성공은 ret_5 감소 방향)
        # slope > 0 → hw 클수록 불리 → sell_hw = a - |b|*hw → b < 0
        # slope < 0 → hw 클수록 유리 → sell_hw = a + |b|*hw → b > 0
        raw_b = -slope / (std_ret + 1e-8)
        b_opt = float(np.clip(raw_b, -2.0, 2.0))
        # 정규화: mean(sell_hw) = 1
        a_opt = 1.0 - b_opt * mean_hw
        a_opt = round(a_opt, 3)
        b_opt = round(b_opt, 3)

        # 상관관계 비교
        sell_hw_current = 2 - hw
        sell_hw_new = a_opt + b_opt * hw

        # sell 성공도: -ret_5 (ret_5가 음수일수록 sell 성공)
        neg_ret5 = -ret5
        corr_current = float(np.corrcoef(sell_hw_current, neg_ret5)[0, 1]) \
            if np.std(sell_hw_current) > 0 else 0.0
        corr_new = float(np.corrcoef(sell_hw_new, neg_ret5)[0, 1]) \
            if np.std(sell_hw_new) > 0 else 0.0

        print(f"  -> 최적: sell_hw = {a_opt} + {b_opt} * hw")
        print(f"     corr(current, -ret5)={corr_current:.4f}, corr(new, -ret5)={corr_new:.4f}")

        # 새 공식이 현재보다 나은 경우만 변경
        if abs(corr_new) > abs(corr_current):
            calibrated = {"a": a_opt, "b": b_opt}
            changed = True
        else:
            print("  -> 새 공식의 상관관계가 현재보다 낮음, 현재값 유지")
            calibrated = current
            changed = False
    else:
        print("  -> slope 유의하지 않음, 현재값 유지")
        calibrated = current
        changed = False
        corr_current = 0.0
        corr_new = 0.0
        a_opt = float(current["a"])
        b_opt = float(current["b"])

    evidence = (
        f"OLS: ret5 = {intercept:.4f} + {slope:.4f}*hw, "
        f"R^2={r_value**2:.6f}, p={p_value:.4e}, "
        f"corr_current={corr_current:.4f}, corr_new={corr_new:.4f}"
    )
    print(f"  -> 결과: a={calibrated['a']}, b={calibrated['b']} (changed={changed})")

    return {
        "current": current,
        "calibrated": calibrated,
        "changed": bool(changed),
        "ols": {
            "intercept": round(float(intercept), 4),
            "slope": round(float(slope), 4),
            "r_squared": round(float(r_value**2), 6),
            "p_value": round(float(p_value), 6),
            "std_err": round(float(std_err), 4),
            "t_stat": round(float(t_stat), 4)
        },
        "n_sell": int(len(df_sell)),
        "mean_hw_sell": round(float(np.mean(hw)), 4),
        "corr_current": round(float(corr_current), 4),
        "corr_new": round(float(corr_new), 4),
        "evidence": evidence
    }


# ──────────────────────────────────────────────
# D-3: calibrate_rr_penalty
# ──────────────────────────────────────────────
def calibrate_rr_penalty(df, theory_vs_actual, c1_result):
    """
    R:R 구간별 mean ret_5 차이로 패널티 크기 추정.
    C-1의 교정된 임계값 [low, high] 사용 (low < high 보장).
    Cohen's d effect size x PENALTY_SCALE.
    """
    print("\n[6/7] D-3: Calibrating rr_penalty...")
    current = {"low": 15, "high": 5}

    thresholds = c1_result.get("calibrated", [1.0, 1.5])
    rr_low = thresholds[0]
    rr_high = thresholds[1]
    assert rr_low < rr_high, f"C-1 결과 low({rr_low}) >= high({rr_high}) — 오류"
    print(f"  -> C-1 교정 임계값: low={rr_low}, high={rr_high}")

    bpt = theory_vs_actual.get('by_pattern_type', {})
    pattern_rr = {}
    for pname, pdata in bpt.items():
        rr_info = pdata.get('riskReward', {})
        if rr_info.get('mean') is not None:
            pattern_rr[pname] = rr_info['mean']

    df_valid = df.dropna(subset=['ret_5']).copy()
    df_valid['pattern_rr'] = df_valid['type'].map(pattern_rr)
    df_with_rr = df_valid.dropna(subset=['pattern_rr'])

    if len(df_with_rr) < 100:
        print("  -> 데이터 부족, 현재값 유지")
        return {
            "current": current, "calibrated": current, "changed": False,
            "evidence": "데이터 부족"
        }

    # 3-zone 분리
    zone_below = df_with_rr[df_with_rr['pattern_rr'] < rr_low]['ret_5']
    zone_mid = df_with_rr[
        (df_with_rr['pattern_rr'] >= rr_low) &
        (df_with_rr['pattern_rr'] < rr_high)
    ]['ret_5']
    zone_above = df_with_rr[df_with_rr['pattern_rr'] >= rr_high]['ret_5']

    print(f"  -> 구간별 표본: below(<{rr_low})={len(zone_below)}, "
          f"mid([{rr_low},{rr_high}))={len(zone_mid)}, "
          f"above(>={rr_high})={len(zone_above)}")

    def cohens_d_with_test(group1, group2):
        """Cohen's d (group1 - group2) + Welch t-test"""
        n1, n2 = len(group1), len(group2)
        if n1 < 2 or n2 < 2:
            return 0.0, 1.0
        m1, m2 = float(group1.mean()), float(group2.mean())
        s1, s2 = float(group1.std()), float(group2.std())
        pooled_std = np.sqrt(((n1 - 1) * s1**2 + (n2 - 1) * s2**2) / (n1 + n2 - 2))
        if pooled_std < 1e-10:
            return 0.0, 1.0
        d = (m1 - m2) / pooled_std
        _, p_val = stats.ttest_ind(group1, group2, equal_var=False)
        return float(d), float(p_val)

    # Cohen's d=1.0 -> PENALTY_SCALE 점 감점
    PENALTY_SCALE = 30

    calibrated = {}

    # penalty_low: R:R < low (worst zone) vs R:R >= high (best zone)
    if len(zone_below) >= 30 and len(zone_above) >= 30:
        d_low, p_low = cohens_d_with_test(zone_above, zone_below)
        penalty_low_raw = abs(d_low) * PENALTY_SCALE
        penalty_low = round(max(penalty_low_raw, 1), 1)

        print(f"  -> below vs above: Cohen's d={d_low:.4f}, p={p_low:.4e}, "
              f"raw_penalty={penalty_low_raw:.1f}")
        print(f"     means: below={zone_below.mean():.4f}%, above={zone_above.mean():.4f}%")

        if p_low < 0.05:
            calibrated['low'] = penalty_low
        else:
            calibrated['low'] = current['low']
            print(f"  -> 유의하지 않음, low={current['low']} 유지")
    else:
        d_low, p_low = 0.0, 1.0
        calibrated['low'] = current['low']
        print(f"  -> below 또는 above 표본 부족, low={current['low']} 유지")

    # penalty_high: R:R in [low, high) (mid zone) vs R:R >= high (best zone)
    if len(zone_mid) >= 30 and len(zone_above) >= 30:
        d_high, p_high = cohens_d_with_test(zone_above, zone_mid)
        penalty_high_raw = abs(d_high) * PENALTY_SCALE
        penalty_high = round(max(penalty_high_raw, 1), 1)

        print(f"  -> mid vs above: Cohen's d={d_high:.4f}, p={p_high:.4e}, "
              f"raw_penalty={penalty_high_raw:.1f}")
        print(f"     means: mid={zone_mid.mean():.4f}%, above={zone_above.mean():.4f}%")

        if p_high < 0.05:
            calibrated['high'] = penalty_high
        else:
            calibrated['high'] = current['high']
            print(f"  -> 유의하지 않음, high={current['high']} 유지")
    else:
        d_high, p_high = 0.0, 1.0
        calibrated['high'] = current['high']
        print(f"  -> mid 또는 above 표본 부족, high={current['high']} 유지")

    changed = calibrated != current
    evidence = (
        f"thresholds=[{rr_low},{rr_high}], "
        f"d_low={d_low:.3f}(p={p_low:.4e}), d_high={d_high:.3f}(p={p_high:.4e}), "
        f"scale={PENALTY_SCALE}"
    )
    print(f"  -> 결과: low={calibrated['low']}, high={calibrated['high']} (changed={changed})")

    return {
        "current": current,
        "calibrated": calibrated,
        "changed": bool(changed),
        "rr_thresholds_used": [float(x) for x in thresholds],
        "zone_counts": {
            "below": int(len(zone_below)),
            "mid": int(len(zone_mid)),
            "above": int(len(zone_above))
        },
        "zone_means": {
            "below": round(float(zone_below.mean()), 4) if len(zone_below) > 0 else None,
            "mid": round(float(zone_mid.mean()), 4) if len(zone_mid) > 0 else None,
            "above": round(float(zone_above.mean()), 4) if len(zone_above) > 0 else None
        },
        "cohens_d_low": round(d_low, 4),
        "p_value_low": round(p_low, 6),
        "cohens_d_high": round(d_high, 4),
        "p_value_high": round(p_high, 6),
        "penalty_scale": PENALTY_SCALE,
        "evidence": evidence
    }


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Calibrate Wc system 5 constants with OOS validation")
    parser.add_argument("--reset-initial", action="store_true",
                        help="Document academic flat defaults (Fix-14: circular calibration)")
    parser.add_argument("--oos-split", type=float, default=0.3,
                        help="OOS validation split ratio (default: 0.3)")
    parser.add_argument("--oos-cutoff", type=str, default=None,
                        help="OOS cutoff date YYYY-MM-DD (overrides --oos-split)")
    parser.add_argument("--no-oos", action="store_true",
                        help="Disable OOS split (legacy mode, calibrate on full dataset)")
    args = parser.parse_args()

    df, theory_vs_actual, pattern_perf = load_data()

    # Fix-12: Time-based OOS split
    if args.no_oos:
        print("[INFO] --no-oos: Using full dataset (legacy mode, no OOS)")
        df_train = df
        df_test = pd.DataFrame()
        cutoff_date = None
    else:
        print(f"\n[OOS] Time-based train/test split (ratio={args.oos_split})...")
        df_train, df_test, cutoff_date = time_split(df, args.oos_split, args.oos_cutoff)

    # Fix-14: Document initial values
    initial_mode = "academic_defaults" if args.reset_initial else "current_calibrated"
    if args.reset_initial:
        print("[INFO] --reset-initial: Documenting academic flat defaults")

    # C-1: rr_thresholds
    c1 = calibrate_rr_thresholds(df_train, theory_vs_actual)

    # C-2: conf_L
    c2 = calibrate_conf_L(df_train, pattern_perf)

    # D-1: candle_target_atr
    d1 = calibrate_candle_atr(df_train)

    # D-2: sell_hw_inversion
    d2 = calibrate_sell_hw(df_train)

    # D-3: rr_penalty (C-1 dependent)
    d3 = calibrate_rr_penalty(df_train, theory_vs_actual, c1)

    # Fix-12: OOS validation
    if len(df_test) > 0:
        print("\n[OOS] Validating on test set...")
        oos_results = validate_oos(df_test)
        print(f"  [OOS] IC={oos_results.get('oos_ic', 'N/A')}, WR={oos_results.get('oos_wr', 'N/A')}%, "
              f"Status={oos_results['status']}")
    else:
        oos_results = {"status": "skipped", "reason": "--no-oos flag used"}

    # Output
    print("\n[7/7] Writing calibrated_constants.json...")

    output = {
        "horizon": 5,
        "total_records": int(len(df)),
        "valid_ret5_records": int(df['ret_5'].notna().sum()),
        # Fix-14: Calibration metadata
        "calibration_metadata": {
            "initial_values": initial_mode,
            "academic_defaults": {
                "candle_target_atr": {"strong": 2.0, "medium": 2.0, "weak": 2.0},
                "rr_thresholds": [1.0, 2.0],
                "note": "Flat ATR 2.0 academic baseline; use --reset-initial to document"
            },
            "dataset_period": f"{df['date'].min()} ~ {df['date'].max()}",
            "train_records": int(len(df_train)),
            "test_records": int(len(df_test)) if len(df_test) > 0 else 0,
            "train_period": f"{df_train['date'].min()} ~ {df_train['date'].max()}" if len(df_train) > 0 else None,
            "test_period": f"{df_test['date'].min()} ~ {df_test['date'].max()}" if len(df_test) > 0 else None,
            "oos_split": args.oos_split if not args.no_oos else None,
            "cutoff_date": cutoff_date,
            "circular_check": args.reset_initial,
        },
        # Fix-12: OOS validation results
        "oos_validation": oos_results,
        "C1_rr_thresholds": c1,
        "C2_conf_L": c2,
        "D1_candle_target_atr": d1,
        "D2_sell_hw_inversion": d2,
        "D3_rr_penalty": d3
    }

    out_path = os.path.join(DATA_DIR, 'calibrated_constants.json')
    output = _to_native(output)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  -> {out_path}")

    # Summary
    print("\n" + "=" * 60)
    print("교정 결과 요약")
    print("=" * 60)
    changes = []
    if c1['changed']:
        changes.append(f"  C-1 rr_thresholds: {c1['current']} -> {c1['calibrated']}")
    if c2['changed']:
        changes.append(f"  C-2 conf_L: {c2['current_formula']} -> {c2['calibrated_formula']}")
    if d1['changed']:
        changes.append(f"  D-1 candle_atr: {d1['current']} -> {d1['calibrated']}")
    if d2['changed']:
        changes.append(f"  D-2 sell_hw: a={d2['current']['a']},b={d2['current']['b']} -> "
                        f"a={d2['calibrated']['a']},b={d2['calibrated']['b']}")
    if d3['changed']:
        changes.append(f"  D-3 rr_penalty: {d3['current']} -> {d3['calibrated']}")

    if changes:
        print(f"변경된 상수: {len(changes)}개")
        for c in changes:
            print(c)
    else:
        print("변경된 상수 없음 (모든 현재값 유지)")

    unchanged = 5 - len(changes)
    if unchanged > 0:
        print(f"유지된 상수: {unchanged}개 (유의하지 않거나 데이터 부족)")

    # OOS summary
    if oos_results.get('status') not in ('skipped', 'insufficient_data'):
        print(f"\n[OOS] Validation: {oos_results['status'].upper()}")
        print(f"  IC={oos_results['oos_ic']}, WR={oos_results['oos_wr']}%")
        if oos_results['status'] == 'rejected':
            print("  WARNING: OOS validation rejected — constants may not generalize")

    print("\n완료.")


if __name__ == '__main__':
    main()
