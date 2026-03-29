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
| 25 | entropy floor | 0.80 | D | GS | [0.70, 0.95] | Shannon (1948) basis |
| 26 | HMM vol floor | 0.85 | D | GS | [0.70, 0.85] | Hamilton (1989) |
| 27 | MAX_CUMULATIVE_ADJ | 15 | D | GS | [10, 20] | No basis |
| 28 | composite window | 5 | C | GS | [3, 7] | 1 KRX week |
| 29 | StochRSI COOLDOWN | 7 | D | GS | [5, 10] | Empirical |
| 30 | vol z-score threshold | 2.0 | B | GS | [1.5, 2.5] | Ane & Geman (2000) |

### Indicators (indicators.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 31 | RSI period | 14 | A | MAN | fixed | Wilder (1978) |
| 32 | MACD fast/slow/sig | 12/26/9 | A | MAN | fixed | Appel (1979) |
| 33 | BB period/mult | 20/2 | A | MAN | fixed | Bollinger (1992) |
| 34 | ATR period | 14 | A | MAN | fixed | Wilder (1978) |
| 35 | Ichimoku 9/26/52/26 | std | A | MAN | fixed | Hosoda (1968) |
| 36 | Kalman Q | 0.01 | B | GS | [0.001, 0.1] | Mehra (1970) |
| 37 | Kalman R | 1.0 | B | GS | [0.1, 10] | Mehra (1970) |
| 38 | bbEVT factor | 0.15 | D | GS | [0.05, 0.30] | No published source |
| 39 | Hurst minWindow | 10 | B | GS | [8, 20] | Di Matteo (2005) |
| 40 | CCI constant | 0.015 | A | MAN | fixed | Lambert (1980) |

### Backtester (backtester.js)

| # | Constant | Value | Tier | Learn | Range | Academic Source |
|---|----------|-------|------|-------|-------|----------------|
| 41 | Ridge lambda | 2.0 | C | GS | [0.5, 10] | Hoerl & Kennard (1970) |
| 42 | WLS decay lambda | 0.995 | C | GS | [0.990, 0.999] | Lo (2004) AMH |
| 43 | KRX_COMMISSION | 0.03% | A | MAN | fixed | KRX regulation |
| 44 | KRX_TAX | 0.18% | A | MAN | fixed | KRX regulation |
| 45 | KRX_SLIPPAGE | 0.10% | C | BAY | [0.04, 0.50] | Amihud (2002) |
| 46 | CANDLE_TARGET_ATR.strong | 1.88 | C | BAY | [1.0, 3.0] | Theil-Sen calibrated |
| 47 | CANDLE_TARGET_ATR.medium | 2.31 | C | BAY | [1.5, 3.5] | Theil-Sen calibrated |
| 48 | CANDLE_TARGET_ATR.weak | 2.18 | C | BAY | [1.5, 3.5] | Theil-Sen calibrated |
| 49 | N0 (shrinkage denom) | 35 | C | GS | [20, 50] | Efron & Morris (1975) |
| 50 | BH FDR q | 0.05 | A | MAN | fixed | Benjamini & Hochberg (1995) |

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
| A (Fixed) | 37 | 15% | No |
| B (Tunable) | 61 | 25% | Yes (GS, BAY) |
| C (KRX) | 69 | 28% | Yes (all mechanisms) |
| D (Heuristic) | 46 | 19% | Must validate |
| E (Deprecated) | 0 | 0% | Remove |
| **Uncategorized** | 35 | 14% | Pending audit |
| **Total** | **248** | 100% | |

### By Learning Mechanism

| Mechanism | Eligible Count | Top Priority Targets |
|-----------|----------------|---------------------|
| WLS Refit | ~25 | Q_WEIGHT (5), signal weights (10) |
| Bayesian | ~40 | baseConfidence, CANDLE_TARGET_ATR |
| Grid Search | ~55 | body/shadow ratios, Ridge/WLS λ |
| LinUCB | ~15 | ADX/CCI isotonic (when gate passes) |
| Manual | ~37 | All Tier A |
