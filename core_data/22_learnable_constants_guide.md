# 22. Learnable Constants Classification Guide

> 2026-03-29 Academic-Code Linkage Audit (10-agent Phase 1-3) 결과물

## 1. Tier Classification System

모든 수치 상수는 5-Tier로 분류된다. 각 Tier에는 기호(symbol)를 부여하여
코드 주석, calibration script, 가이드 문서에서 일관되게 참조할 수 있다.

| Tier | Symbol | Name | Definition | Learning Allowed? |
|------|--------|------|------------|-------------------|
| **A** | `🔒` / `[A]` | Academic Fixed | 원저자(Wilder, Appel, Hosoda 등) 표준값. 변경 시 지표 정의 자체가 변질됨 | **NO** — 절대 자동 변경 금지 |
| **B** | `🔧` / `[B]` | Academic Tunable | 학술 근거 있으나 허용 범위 내 조정 가능 | **YES** — GCV, walk-forward, sensitivity analysis |
| **C** | `📊` / `[C]` | KRX Adapted | KRX 시장 특성(가격제한, 연속매매, 소매투자자)에 맞춘 보정값 | **YES** — backtest recalibration |
| **D** | `⚠️` / `[D]` | Heuristic | 학술 근거 없는 경험적 값. 검증 필수 | **MUST** — 검증 또는 대체 필수 |
| **E** | `❌` / `[E]` | Deprecated | 사용 중단 또는 대체 필요 | **REMOVE** |

### Tier Namespace Convention

본 문서의 5-Tier (A/B/C/D/E)는 **상수의 학술적 근거 수준**을 분류합니다.
프로젝트 내 다른 tier 시스템과 혼동을 방지하기 위해 다음 접두사를 사용합니다:

| Prefix | System | File | Tiers | Purpose |
|--------|--------|------|-------|---------|
| `[A-const]` ~ `[E-const]` | Constants | Doc 22 (본 문서) | A/B/C/D/E | 상수의 학술 근거 수준 |
| `[A-rel]` ~ `[D-rel]` | Reliability | backtester.js | A/B/C/D | 백테스트 통계적 유의성 |
| `[S-ver]` ~ `[D-ver]` | Verification | app.js | S/A/B/C/D | TA 컴포넌트 이론 검증 상태 |

예: RSI period=14는 `[A-const]` (학술 고정) 이면서 RSI 신호의 reliability는 `[B-rel]` (양호한 통계적 유의성)일 수 있음.

### ASCII 기호 규칙 (코드 주석용)

코드 주석에서는 emoji 대신 `[A]`~`[E]` 태그를 사용한다:
```javascript
static RSI_PERIOD = 14;           // [A] Wilder (1978) — 절대 변경 금지
static ENGULF_BODY_MULT = 1.5;    // [C] KRX 과감지 방지 (T-4), range [1.0, 2.0]
static Q_WEIGHT = { body: 0.25 }; // [D] Nison 질적 근거만, WLS refit 대상
```

---

## 2. Learning Mechanism Classification

상수가 learnable이라 하더라도, **어떤 메커니즘**으로 학습하는지 구분해야 한다.

| Mechanism | Symbol | Description | Applicable Tiers | Update Frequency |
|-----------|--------|-------------|------------------|------------------|
| **WLS** | `[L:WLS]` | WLS regression refit (coefficients from 5-col design matrix) | B, C, D | Monthly batch |
| **BAY** | `[L:BAY]` | Bayesian posterior update (Beta-Binomial α/β) | B, C, D | Daily batch |
| **GS** | `[L:GS]` | Grid search / cross-validation | B, C, D | Quarterly |
| **GCV** | `[L:GCV]` | Generalized Cross-Validation (leave-one-out) | B, C, D | Quarterly |
| **RL** | `[L:RL]` | LinUCB reward update (via rl_policy.json) | C, D | When gate passes |
| **MAN** | `[L:MAN]` | Manual calibration only (expert judgment) | A, B | As needed |

### Combined Notation

```javascript
// 상수에 Tier + Learning Mechanism을 태그:
static ENGULF_BODY_MULT = 1.5;    // [C][L:GS] range [1.0, 2.0], Nison basis
static Q_WEIGHT_BODY = 0.25;      // [D][L:WLS] range [0.10, 0.40], no empirical basis
static RSI_PERIOD = 14;           // [A][L:MAN] Wilder (1978), fixed
```

---

## 3. Master Constant Registry (Top 50 by Impact)

### Pattern Detection (patterns.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 1 | DOJI_BODY_RATIO | 0.05 | A | MAN | fixed | Nison (1991) |
| 2 | SHADOW_BODY_MIN | 2.0 | A | MAN | fixed | Nison (1991) |
| 3 | MAX_BODY_RANGE_HAMMER | 0.40 | C | GS | [0.33, 0.50] | Nison 0.33, KRX tick |
| 4 | COUNTER_SHADOW_MAX_STRICT | 0.15 | C | GS | [0.05, 0.25] | Morris (2006) |
| 5 | COUNTER_SHADOW_MAX_LOOSE | 0.30 | D | GS | [0.15, 0.40] | No basis for asymmetry |
| 6 | ENGULF_BODY_MULT | 1.5 | C | GS | [1.0, 2.0] | Nison 1.0, KRX T-4 |
| 7 | THREE_SOLDIER_BODY_MIN | 0.5 | C | GS | [0.3, 0.7] | Nison "long", KRX T-5 |
| 8 | STAR_BODY_MAX | 0.2 | B | GS | [0.1, 0.3] | Bulkowski (2008) |
| 9 | STAR_END_BODY_MIN | 0.5 | C | GS | [0.3, 0.7] | Nison "long", KRX T-6 |
| 10 | ABANDONED_BABY_GAP_MIN | 0.03 | C | GS | [0.01, 0.10] | KRX continuous auction |
| 11 | Q_WEIGHT.body | 0.25 | D | WLS | [0.10, 0.40] | Nison qualitative |
| 12 | Q_WEIGHT.volume | 0.25 | D | WLS | [0.10, 0.40] | Nison qualitative |
| 13 | Q_WEIGHT.trend | 0.20 | D | WLS | [0.10, 0.30] | Nison qualitative |
| 14 | Q_WEIGHT.shadow | 0.15 | D | WLS | [0.05, 0.25] | Nison qualitative |
| 15 | Q_WEIGHT.extra | 0.15 | D | WLS | [0.05, 0.25] | Nison qualitative |
| 16 | HS_WINDOW | 120 | C | GS | [60, 150] | Bulkowski median 65d |
| 17 | HS_SHOULDER_TOLERANCE | 0.15 | C | GS | [0.05, 0.20] | Bulkowski 40% >5% |
| 18 | STOP_LOSS_ATR_MULT | 2 | B | GS | [1.5, 3.0] | Wilder (1978) |
| 19 | CHART_TARGET_RAW_CAP | 2.0 | B | GS | [1.5, 3.0] | Bulkowski P80 |
| 20 | CHART_TARGET_ATR_CAP | 6 | B | GS | [4, 8] | EVT 99.5% VaR |

### Signal Engine (signalEngine.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 21 | goldenCross weight | ±3 | B | BAY | [2, 4] | MA crossover literature |
| 22 | macdCross weight | ±2 | B | BAY | [1, 3] | Appel (1979) |
| 23 | rsiOversold weight | ±1.5 | B | BAY | [1, 2.5] | Wilder (1978) |
| 24 | volumeBreakout weight | ±2 | B | BAY | [1, 3] | Caginalp (1998) |
| 25 | entropy floor | 0.80 | D | GS | [0.70, 0.95] | Heuristic, Shannon entropy concept |
| 26 | HMM vol floor | 0.70 | D | GS | [0.70, 0.85] | Hamilton (1989) |
| 27 | MAX_CUMULATIVE_ADJ | 15 | D | GS | [10, 20] | No basis |
| 28 | composite window | 5 | C | GS | [3, 7] | 1 KRX week |
| 29 | StochRSI COOLDOWN | 5 | D | GS | [3, 10] | Matched to RSI_COOLDOWN (Phase 0327). Stochastic COOLDOWN = 7 (separate) |
| 30 | vol z-score threshold | 2.0 | B | GS | [1.5, 2.5] | Ane & Geman (2000) |

### Indicators (indicators.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 31 | RSI period | 14 | A | MAN | fixed | Wilder (1978) |
| 32 | MACD fast/slow/sig | 12/26/9 | A | MAN | fixed | Appel (1979) |
| 33 | BB period/mult | 20/2 | A | MAN | fixed | Bollinger (2001) |
| 34 | ATR period | 14 | A | MAN | fixed | Wilder (1978) |
| 35 | Ichimoku 9/26/52/26 | std | A | MAN | fixed | Hosoda (1968) |
| 36 | Kalman Q | 0.01 | D | GS | [0.001, 0.1] | Heuristic defaults, Mehra (1970) adaptive framework |
| 37 | Kalman R | 1.0 | D | GS | [0.1, 10] | Heuristic defaults, Mehra (1970) adaptive framework |
| 38 | bbEVT factor | 0.45 | D | GS | [0.15, 0.60] | Phase0-#7 recalibrated (was 0.15) |
| 39 | Hurst minWindow | 10 | B | GS | [8, 20] | Di Matteo (2005) |
| 40 | CCI constant | 0.015 | A | MAN | fixed | Lambert (1980) |

### Backtester (backtester.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 41 | Ridge lambda | GCV auto | B | GCV | [0.1, 50] | GCV auto-select (Golub et al. 1979), fallback 1.0 |
| 42 | WLS decay lambda | 0.995 | C | GS | [0.990, 0.999] | Lo (2004) AMH |
| 43 | KRX_COMMISSION | 0.03% | A | MAN | fixed | KRX regulation |
| 44 | KRX_TAX | 0.18% | C | MAN | [0.15, 0.30] | KRX regulation. Tax rates change by legislation. KOSPI: 0.03%+농특세0.15%=0.18%, KOSDAQ: 0.18% (2025). 2026 예정: 0.15%. |
| 45 | KRX_SLIPPAGE | 0.10% | C | BAY | [0.04, 0.50] | Amihud (2002) |
| 46 | CANDLE_TARGET_ATR.strong | 1.88 | C | BAY | [1.0, 3.0] | Theil-Sen calibrated |
| 47 | CANDLE_TARGET_ATR.medium | 2.31 | C | BAY | [1.5, 3.5] | Theil-Sen calibrated |
| 48 | CANDLE_TARGET_ATR.weak | 2.18 | C | BAY | [1.5, 3.5] | Theil-Sen calibrated |
| 49 | N0 (shrinkage denom) | 35 | D | GS | [20, 50] | Heuristic, Efron & Morris (1975) shrinkage framework |
| 50 | BH FDR q | 0.05 | A | MAN | fixed | Benjamini & Hochberg (1995) |

### Macro — Taylor Rule / MCS (signalEngine.js, api.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 135 | TAYLOR_R_STAR | 1.0% | C | MAN | [0.5, 2.0] | BOK (2023) neutral real rate — `scripts/download_macro.py` |
| 136 | TAYLOR_PI_STAR | 2.0% | A | MAN | fixed | BOK official inflation target — `scripts/download_macro.py` |
| 137 | TAYLOR_A_PI | 0.50 | B | GS | [0.25, 1.00] | Taylor (1993) — `scripts/download_macro.py` |
| 138 | TAYLOR_A_Y | 0.50 | B | GS | [0.25, 1.00] | Taylor (1993) — `scripts/download_macro.py` |
| 139 | CLI_TO_GAP_SCALE | 0.50 | C | GS | [0.20, 0.80] | Empirical CLI→gap mapping — `scripts/download_macro.py` |
| 140 | TAYLOR_GAP_CONF_MAX_ADJ | 0.05 | D | GS | [0.02, 0.10] | Design parameter — `scripts/download_macro.py` |
| 141 | TAYLOR_GAP_DEAD_BAND | 0.25 | D | GS | [0.10, 0.50] | Rudebusch (2002) uncertainty — `scripts/download_macro.py` |
| 142 | MCS_V2_TAYLOR_WEIGHT | 0.10 | C | GCV | [0.05, 0.20] | Doc30 §4.3 MCS v2 — `scripts/download_macro.py` |
| 143 | MCS_PMI_NORM_LOW | 35 | C | GS | [30, 40] | PMI contraction zone |
| 144 | MCS_PMI_NORM_RANGE | 30 | C | GS | [25, 35] | PMI expansion range |

### CAPM / APT (backtester.js, financials.js)

**CAPM Beta R² 공식 주의사항:**
```
R²_beta = β²ᵢ × Var(R_m) / Var(R_i)

주의: Var(R_m)과 Var(R_i)는 동일 시간 단위의 수익률 분산이어야 한다.
  올바름: Var(R_i) = Var(일별 수익률)           (시간 스케일링 없음)
  오류:   Var(R_i) = Var(일별 수익률) × T       (기간 T를 곱하면 총분산이 됨)

수익률의 분산 자체가 이미 단위 기간당 측도이므로 ×T 스케일링은
R²를 과소 추정하게 만든다. 25_capm_delta_covariance.md §5 참조.
```

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 150 | VPE_MIN_QUARTERS | 3 | C | MAN | [2, 4] | Statistical minimum for trend |
| 151 | CAPM_RF_ANNUAL | 3.689% | B | MAN | [1.0, 7.0] | ECOS KTB 10Y (2025) |
| 152 | CAPM_ERP | 6.0% | B | MAN | [4.0, 9.0] | PROPOSED — NOT IMPLEMENTED. Damodaran (2025) ERP |
| 153 | WACC_TAX_RATE | 22% | A | MAN | fixed | PROPOSED — NOT IMPLEMENTED. Korean corporate tax code |
| 154 | WACC_RD_FALLBACK | 4.0% | B | MAN | [2.0, 8.0] | PROPOSED — NOT IMPLEMENTED. AA- corporate bond rate |
| 155 | CAPM_BETA_CLAMP_MAX | 3.0 | B | MAN | [2.0, 5.0] | PROPOSED — NOT IMPLEMENTED. Extreme beta outlier cap |
| 156 | CAPM_BETA_CLAMP_MIN | 0.0 | B | MAN | [-0.5, 0.0] | PROPOSED — NOT IMPLEMENTED. Negative beta floor |

### Microstructure (patterns.js, signalEngine.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 162 | ILLIQ_WINDOW | 20 | B | GS | [10, 30] | Amihud (2002) daily ILLIQ |
| 163 | ILLIQ_CONF_DISCOUNT_BASE | 0.85 | C | GS | [0.70, 0.95] | Design — max discount factor |
| 164 | ILLIQ_HIGH_THRESHOLD | 0.100 | C | GCV | [0.050, 0.200] | KRX small-cap empirical (log10 scale, code: LOG_HIGH) |
| 165 | ILLIQ_LOW_THRESHOLD | 0.010 | C | GCV | [0.005, 0.020] | KRX large-cap empirical (log10 scale, code: LOG_LOW) |

> **ILLIQ Scale Note:** 코드 내 ILLIQ 임계값(#164, #165)은 log-transformed 값을 사용한다.
> Amihud (2002) 원논문의 raw ILLIQ 값은 x10^6 스케일이며 직접 비교할 수 없다.
> Raw Amihud: ILLIQ_raw = (1/D) * sum(|r_d| / Vol_d) (일반적으로 10^-6 ~ 10^-3 범위).
> Code scale: log(1 + ILLIQ_raw * 10^6)을 정규화한 [0, 1] 범위 값.
> 두 스케일 간 변환 시 반드시 로그 변환 여부를 확인할 것.

---

## 4. Update Protocol

### Automated Update Pipeline (calibrate_constants.py → rl_policy.json)

```
1. Offline Python batch (daily/weekly):
   - WLS refit: Q_WEIGHT, signal weights → calibrated_constants.json
   - Bayesian: Beta(α,β) update for each pattern → rl_policy.json
   - Grid search: body/shadow ratios → calibrated_constants.json

2. Manual sync to JS (after calibration):
   - calibrated_constants.json values → patterns.js / signalEngine.js
   - rl_policy.json → backtester.js _loadRLPolicy()
   - CRITICAL: calibrated_constants.json은 offline-only, JS에 수동 반영 필요

3. Validation before deployment:
   - python scripts/verify.py --strict
   - walk-forward WFE > 50%
   - Brier score improvement
```

### Safety Rules

1. **Tier A 상수는 절대 자동 변경 금지** — grid search, RL, Bayesian 모두에서 제외
2. **Tier B/C 상수 변경 시 범위 클램프 필수** — Range 열 참조
3. **Tier D 상수 변경 시 backtest 전후 비교 필수** — Sharpe, WR, IC 3개 지표
4. **동시에 3개 이상 상수 변경 금지** — 인과관계 추적 불가
5. **변경 기록**: 모든 상수 변경은 git commit에 `[Cal]` prefix 사용

---

## 5. Agent Authority Mapping

10-agent 감사 결과에 따른 상수 도메인별 에이전트 권한:

| Agent Type | Authority Scope | Actions Allowed |
|------------|----------------|-----------------|
| `financial-theory-expert` | Tier A/B 판정, 학술 공식 검증 | 분류 변경, 범위 설정, 학술 근거 제시 |
| `technical-pattern-architect` | Tier C 보정, 패턴/시그널 임계값 | 범위 내 값 조정 제안, KRX 적응 근거 |
| `financial-systems-architect` | Tier D 검증, 파이프라인 설계 | 학습 메커니즘 설계, 성능 검증 |
| `code-audit-inspector` | 모든 Tier 검증 | 코드-이론 일치 확인, 범위 위반 탐지 |
| `self-verification-protocol` | 변경 후 검증 | 교차 검증, 회귀 탐지 |

### 에이전트 워크플로우

```
1. theory-expert: "이 상수는 Tier B, 범위 [1.5, 3.0]"
2. pattern-architect: "KRX 데이터에서 최적값은 2.1"
3. systems-architect: "WLS refit로 자동화 가능"
4. code-audit: "코드에 [B][L:WLS] 태그 + clamp 적용 확인"
5. self-verify: "변경 전후 Sharpe 비교 통과"
```

---

## 6. Summary Statistics

| Tier | Count | % | Learnable? |
|------|-------|---|------------|
| A (Fixed) | 39 | 15% | No |
| B (Tunable) | 69 | 26% | Yes (GS, BAY) |
| C (KRX) | 78 | 29% | Yes (all mechanisms) |
| D (Heuristic) | 48 | 18% | Must validate |
| E (Deprecated) | 0 | 0% | Remove |
| **Uncategorized** | 35 | 13% | Pending audit |
| **Total** | **269** | 100% | |

### By Learning Mechanism

| Mechanism | Eligible Count | Top Priority Targets |
|-----------|----------------|---------------------|
| WLS Refit | ~25 | Q_WEIGHT (5), signal weights (10) |
| Bayesian | ~40 | baseConfidence, CANDLE_TARGET_ATR |
| Grid Search | ~64 | body/shadow ratios, Ridge/WLS λ, Taylor/ILLIQ |
| GCV | ~6 | MCS weights, ILLIQ thresholds |
| LinUCB | ~15 | ADX/CCI isotonic (when gate passes) |
| Manual | ~46 | All Tier A, CAPM/WACC rates |
