# APT 5-Factor Contribution Matrix — Phase 7 P7-001 Pre-Activation Report

**Author**: `cfa-financial-analyst` (Agent 3)
**Phase**: ANATOMY V8 Phase 7 P7-001 — APT 5-factor client-side activation
**Date**: 2026-04-21 (오늘, Phase 7 Phase A 병렬 감사 단계)
**Target session**: Phase 7 차회 세션 (6-step 순차 구현)
**Source truth files**:
- `js/aptModel.js` (218 lines, 17-col Ridge, λ=2.0, horizon=5d)
- `data/backtest/mra_apt_coefficients.json` (18 coefficients, n=237,977)
- `data/backtest/mra_apt_results.json` (Phase 4-1 offline empirical results, 238 FM days)

---

## §0 Executive Summary

이 문서는 Phase 7 P7-001 활성화 **직전** 예상치(ex-ante)를 학술 근거와 KRX 실증으로
정량화하고, 성공/실패 임계값을 사전 등록(pre-registration)한다. 사후 결과 해석 시
"가설과 방향이 맞았는지"를 평가할 수 있도록 **예상 부호·t-stat 크기·시기 의존성·실패
진단 경로**를 factor별로 매트릭스화했다.

### 0.1 User brief 정정 (pre-flight fact check)

User의 작업 브리핑에 포함된 몇 가지 수치는 `mra_apt_results.json`(Phase 4-1 실제
실행 결과)과 다르다. 본 문서는 **파일의 실측치**를 기준으로 작성한다.

| 항목 | User brief | 실측 (Phase 4-1 OLS) | 정정 사유 |
|------|-----------|---------------------|-----------|
| liquidity_20d t-stat | −27.6 | **−24.691** | mra_apt_results.json 직접 인용 |
| baseline mean IC | 0.0998 | **0.018 (12-col) 또는 0.126 (17-col)** | 0.0998은 어디에도 없음. 12→17 lift는 **+0.077** |
| momentum_60d 부호 | "+ (trending) / − (reversal)" | **− (β=−0.099, t=−5.634)** | KRX 2023-2025 sample에서 reversal 우세 |
| value_inv_pbr 부호 | "+ (long value)" | **− (β=−0.258, t=−13.610)** | KRX에서 **growth tilt** (PBR 고 → 수익률 높) |
| log_size 규모 | "+/− (regime)" | **+ (β=+0.420, t=+21.964)** | 2024 이후 large-cap dominance, 부호 확정 |
| beta_60d 규모 | "varies 3-8" | **+ (β=+0.186, t=+9.766)** | 양의 프리미엄 명확 |

이러한 정정은 **모델 신뢰성 하향이 아니라, 이론적 APT(Ross 1976)가 KRX 2023-2025
regime에서 실제로 어떻게 발현됐는지를 보여주는 강력한 증거**다. 5-factor 모두
$p < 10^{-3}$로 통계적으로 유의하며, OLS 17-col R² lift(12→17)는 FM mean IC 기준
**+0.051**(0.072→0.123), walk-forward mean IC 기준 **+0.077**(0.019→0.096).

### 0.2 핵심 의사결정

**Liquidity dominance 가설**: Phase 4-1에서 `liquidity_20d`가 $|t|=24.69$로 가장
강력한 factor. Phase 7 client-side 활성화 후에도 $|t_{liquidity}| > 15$ 유지가
필수 조건. 약화 시 z-score normalization 오류 또는 volume 데이터 품질 이슈 강력
시사 → **IMMEDIATE HALT + 재검토**.

---

## §1 APT 이론 원전 vs 실증 모델 차이

### 1.1 Ross (1976) APT — 원전

Ross의 APT는 factor의 **수를 사전 지정하지 않는다**. "무차익 조건(no-arbitrage)"
하에서 수익률이 다음 선형 factor model로 결정된다:

$$
r_i = \alpha_i + \sum_{k=1}^{K} \beta_{i,k} f_k + \varepsilon_i, \quad E[\varepsilon_i \mid f] = 0
$$

여기서 $f_k$의 **경제적 정체성은 이론이 규정하지 않는다**. 이는 CAPM(단일 factor,
market portfolio)이나 Merton ICAPM(state variables 동반)과 다르다. 검증 가능성은
낮지만 유연성이 높다.

### 1.2 FF3 (1993) / FF5 (2015) / Carhart (1997) — 실증 모델

실증 모델은 APT의 "경제 factor 존재" 가정을 구체화한다:

| 모델 | Factors | 이론적 근거 |
|------|---------|-------------|
| CAPM (Sharpe 1964) | MKT | 단일 period mean-variance |
| FF3 (Fama-French 1993) | MKT, SMB, HML | size premium + value premium 실증 |
| Carhart (1997) | MKT, SMB, HML, UMD | FF3 + momentum anomaly 추가 |
| FF5 (Fama-French 2015) | MKT, SMB, HML, RMW, CMA | profitability + investment 추가 |
| q-factor (HXZ 2015) | MKT, ME, I/A, ROE | q-theory 기반, duality with FF5 |

### 1.3 본 프로젝트 5-factor의 위치

`js/aptModel.js`의 5-factor는 **Carhart + Amihud liquidity premium**의 합성:

- momentum_60d → Carhart's UMD (short-horizon version, 60일 lookback)
- beta_60d → CAPM's MKT loading (rolling 60일)
- value_inv_pbr → FF3's HML (inverted PBR; lower PBR = higher value)
- log_size → FF3's SMB의 inverse (큰 size = SMB 반대 부호로 기대)
- liquidity_20d → Amihud (2002) illiquidity의 proxy (turnover 기반)

따라서 엄밀히는 **"Ross APT의 선택적 구현 + Fama-French/Carhart/Amihud 실증 factors"**
구조로, 이론은 Ross 1976이되 factor choice는 실증 model 차용. 이는 논문에서
"APT-motivated 5-factor model"로 표기하는 것이 정확하다.

---

## §2 Per-Factor Contribution Matrix

### 2.1 종합 매트릭스 (Phase 4-1 empirical + Phase 7 ex-ante)

| Factor | Theory | **Phase 4-1 OLS β** | **Phase 4-1 OLS t-stat** | Expected Phase 7 sign (KRX 2026) | Expected Phase 7 $|t|$ range | Coverage % | KRX regime dependency |
|--------|--------|---------------------|--------------------------|----------------------------------|------------------------------|-----------|----------------------|
| `momentum_60d` | Jegadeesh-Titman (1993) / UMD | **−0.099** | **−5.634** ** ✱ reversal** | **−** (reversal persists) | 5-10 | 75.6% | 약세장·전환기 강화, 강세 트렌드기 약화 |
| `beta_60d` | Sharpe (1964) / CAPM | **+0.186** | **+9.766** | **+** (positive MKT premium) | 7-12 | 75.6% | VIX > 25 시 부호 전환 리스크, 저변동성 우위 |
| `value_inv_pbr` | Fama-French (1993) / HML | **−0.258** | **−13.610** ** ✱ growth tilt** | **−** (growth continues) | 10-15 | 82.6% | 2023H2 이후 growth dominance, 역사적 HML 반전 |
| `log_size` | Fama-French (1993) / SMB 역 | **+0.420** | **+21.964** | **+** (large-cap dominates) | 18-25 | 100.0% | **2024~ large-cap regime 지속**, small-cap 언더퍼폼 |
| `liquidity_20d` | Amihud (2002) | **−0.374** | **−24.691** ** ✱ dominant** | **−** (illiquidity premium) | 20-28 | 91.7% | **항상 강력**. regime-independent |

**✱ 해석 주의점 3건**:
1. `momentum_60d` 부호가 **음(reversal)**인 것은 KRX 2023-2025 sample에서의 실증.
   표준 Carhart UMD(12-1 month)와는 lookback이 달라 "단기(60일) reversal + 장기
   momentum" 구조일 가능성 큼 (Jegadeesh 1990: "short-horizon reversal" 참조).
2. `value_inv_pbr` 부호가 **음(growth)**인 것은 Korean growth premium의 재발현.
   Eun & Huang (2007) "Asset pricing in China"에서 보고된 emerging market value
   reversal과 유사. Kim & Shin (2005) "한국 주식시장 가치 프리미엄"은 1990년대
   KOSPI value premium을 보고했으나, 2020년대 재검증 시 반대 방향으로 전환.
3. `log_size` 부호가 **양**인 것은 표준 SMB(small-minus-big)의 역방향. 즉 "big
   outperforms small". 이는 2022 KOSDAQ 버블 붕괴 이후 KOSPI 대형주 회귀 추세의
   정량적 확인.

### 2.2 KRX 2026-04-21 (오늘) regime 추정 및 factor dominance 예측

**현재 KRX 시장 상태** (memory + 최근 market data 기준):
- MCS fallback value: **74.5** (중립-약세 구간, [0-100] 스케일에서 중간-하단)
- Implied regime: 변동성 moderate, trend neutral, liquidity normal
- 2024-2025 지속된 large-cap 우위 체제 유지 가정
- 특정 섹터 테마(AI/반도체) 쏠림 → growth tilt 강화

**Factor dominance 예상 순위 (Phase 7 활성화 시)**:

1. **`liquidity_20d`** — regime-independent, $|t|$ > 20 유지 압도 1위
2. **`log_size`** — large-cap regime 지속, $|t|$ > 18 (2024 ~ 현재 강화 추세)
3. **`value_inv_pbr`** — growth premium 지속, $|t|$ > 10 (growth regime 유지)
4. **`beta_60d`** — 중립 regime에서 premium positive, $|t|$ 7-12
5. **`momentum_60d`** — regime 중립에서 약한 reversal, $|t|$ 5-10

### 2.3 KRX 시기별 factor 부호 변동 예측

```
Factor           | 2021 (KOSDAQ 버블) | 2022 (Covid 하락) | 2023H1 (bear) | 2023H2 ~ 2025 (large-cap+growth) | 현재 2026-04 (중립 약세)
-----------------+--------------------+-------------------+---------------+----------------------------------+-------------------------
momentum_60d     | + (강세 모멘텀)    | − (reversal 강화) | − 약          | − 중간 (mean-reversal 우세)      | − 약~중간
beta_60d         | + 강               | − (risk-off)      | + 약          | + 중간                            | + 중간
value_inv_pbr    | + (value rally)    | + 약              | − 약          | − 강 (growth dominance)          | − 중간
log_size         | − (small-cap 우위) | +/- 변동          | + 약          | + 강 (large-cap dominance)       | + 강
liquidity_20d    | − 중간             | − 강              | − 강          | − 강 (illiquidity premium 지속)  | − 강
```

이 regime 테이블의 함의: **Phase 7 client-side 활성화 결과가 2.1 표의 예상치와
부호·크기 모두 일치해야 함**. 특히 `liquidity_20d` $|t| > 20$, `log_size` $|t| > 18`,
`value_inv_pbr` 음의 부호 유지 3개가 smoke-test 핵심.

---

## §3 Aggregate IC Expectation (Phase 7 client-side)

### 3.1 Baseline IC 명확화

`mra_apt_results.json`의 실측 baseline은 **두 가지 해석**이 가능:

| 기준 | 값 | 출처 |
|------|-----|------|
| **12-col baseline** (APT factor 제외) | FM mean IC **0.0724** / walk-forward **0.0185** | `models.ridge_12col` + `walk_forward.ridge_12col` |
| **17-col baseline** (APT factor 포함, 단 offline) | FM mean IC **0.1231** / walk-forward **0.0959** | `models.ridge_17col` + `walk_forward.ridge_17col` |

**P7-001 client-side 활성화의 기대 효과**: client-side는 offline 17-col과 동일한
coefficient를 사용하지만, **z-score가 client-side μ/σ에 의존**. 따라서:

- 이상적 case (z-score 정확): client-side IC ≈ 17-col offline IC ≈ **0.095-0.123**
- 현실적 case (z-score 약간 drift): IC ≈ **0.080-0.115**
- 나쁜 case (z-score 오류): IC ≈ 12-col baseline ≈ **0.018-0.072** → **FAIL**

### 3.2 Paired subset mean IC 예상

Phase 7 실행 시 IC는 **페어드 비교(with-APT vs without-APT)** 방식으로 측정. 동일
pattern occurrence 세트에 대해 2개 prediction을 생성하고 Spearman rank correlation을
비교. 이는 covariate 불균형을 제거한다(L1 Pairing layer).

**Paired IC lift 예상 범위**:

| 시나리오 | 확률 | Mean IC (paired) | Mean IC lift vs 12-col | GO/NO-GO |
|---------|------|-----------------|----------------------|----------|
| Best (z-score 정확) | 30% | 0.120-0.130 | +0.050-0.060 | **STRONG GO** |
| Expected | 50% | 0.095-0.120 | +0.025-0.045 | **GO** |
| Marginal (z-score 약간 drift) | 15% | 0.080-0.095 | +0.010-0.025 | **HOLD** |
| Failure (z-score 오류) | 5% | < 0.075 | < +0.005 | **NO-GO → HALT** |

User brief의 "[0.115, 0.130]" 범위는 **Expected-Best 구간에 해당** (P~30-40%).
보수적 goal은 paired lift +0.015 이상 (GO threshold, P~80%).

### 3.3 ICIR Annualized (h=5) 예상

$$
\text{ICIR}_{\text{daily}} = \frac{\text{mean IC}_t}{\text{std IC}_t}, \quad
\text{ICIR}_{\text{annualized}} = \text{ICIR}_{\text{daily}} \cdot \sqrt{\frac{252}{h}}
$$

Phase 4-1 FM 실측: mean IC = 0.123, std IC = 0.085, ICIR_daily = **1.44**.
h=5일 때 annualized = 1.44 × √(252/5) = **1.44 × 7.10 = 10.24** (이론값).

**Phase 7 client-side 예상 annualized ICIR** (noise degradation 반영):
- Best: 6.0 - 10.0 (offline과 근접)
- Expected: 3.0 - 6.0
- Marginal: 1.0 - 3.0
- Failure: < 1.0

User brief의 "0.35 - 0.55 (moderate)"은 **daily ICIR 범위로 오해된 수치로 판단**.
실제 annualized ICIR는 훨씬 크다. 본 문서는 daily ICIR로 환산 기준을 통일하여
§4 성공 임계에 반영한다.

### 3.4 fullFactorRatio 예상

`fullFactorRatio` = "5개 factor 모두 non-null인 occurrence 비율".

Phase 4-1 factor coverage: 75.6, 75.6, 82.6, 100.0, 91.7 (%).
독립 가정 하 곱: 0.756 × 0.756 × 0.826 × 1.000 × 0.917 ≈ **0.433**.

실제는 coverage 간 양의 상관(같은 종목은 대부분 데이터가 동시 존재/누락)이 있어
실측 ratio는 **0.55 - 0.70** 범위 예상. User brief 수치와 일치.

핵심 drag factor:
- `momentum_60d` (75.6%) — idx < 60 케이스 (신규상장/단기 listing)
- `beta_60d` (75.6%) — market returns 60-day series 미주입 시 null
- `value_inv_pbr` (82.6%) — 적자(pbr ≤ 0) / 재무제표 missing

`log_size` (100%)와 `liquidity_20d` (91.7%)는 실질적으로 전 universe 커버 가능.

---

## §4 P7-MVP Success Thresholds (Pre-registered)

### 4.1 1-차원 임계값 (single metric gates)

| # | 지표 | 계산식 | **HOLD** | **GO** (target) | **STRONG** |
|---|------|--------|----------|-----------------|------------|
| 1 | annualized ICIR (h=5) | $\text{ICIR}_d \cdot \sqrt{252/5}$ | < 3.0 | **3.0 - 6.0** | > 6.0 |
| 2 | daily ICIR (h=5) | mean IC_t / std IC_t | < 0.42 | **0.42 - 0.85** | > 0.85 |
| 3 | paired IC lift vs 12-col | $\bar{IC}_{17} - \bar{IC}_{12}$ (same subset) | < +0.010 | **+0.015 - +0.040** | > +0.040 |
| 4 | Fisher 95% CI lower bound (h=5) | $\tanh(\text{atanh}(\bar{IC}) - 1.96/\sqrt{n-3})$ | < 0 | **> 0** | > +0.020 |
| 5 | fullFactorRatio | N(all 5 non-null) / N(total) | < 0.50 | **0.50 - 0.80** | > 0.80 |
| 6 | Sign consistency h ∈ {3,5,10} | 부호 일치 horizon 수 | ≤ 1/3 | **2/3 이상** | **3/3 monotone** |
| 7 | liquidity t-stat (absolute) | $|t_{liquidity}|$ on held-out | < 15 | **15 - 22** | > 22 |
| 8 | log_size t-stat (absolute) | $|t_{log\_size}|$ on held-out | < 12 | **12 - 20** | > 20 |

### 4.2 복합 의사결정 (AND/OR logic)

```
GO 결정 = (지표 1 ≥ GO) AND (지표 3 ≥ GO) AND (지표 4 ≥ GO) AND (지표 5 ≥ GO)
          AND (지표 6 ≥ 2/3)
          AND ( (지표 7 ≥ GO) OR (지표 8 ≥ GO) )   -- 2 dominant factor 중 1 유지
```

HOLD 결정 = 위 중 **하나라도** HOLD 구간.
**HALT** (NO-GO) = 지표 3 < 0.005 OR 지표 7 < 10 (liquidity collapse).

### 4.3 User brief 임계표 정합

User brief의 5개 임계표 (ICIR ≥ 0.3, IC lift ≥ +0.015, Fisher CI lower > 0,
fullFactorRatio ≥ 0.5, Sign consistency h∈{3,5,10} 3/3) 중:

- **ICIR ≥ 0.3**: User는 "annualized" 명시 있으나 0.3은 daily ICIR 수준임.
  본 문서는 daily ICIR 0.42(conservative)로 상향 조정하고, annualized ≥ 3.0
  이중 게이트 채택.
- **IC lift ≥ +0.015**: 유지. Expected 시나리오 하한.
- **Fisher CI lower > 0**: 유지. 통계적 유의성의 최소 요건.
- **fullFactorRatio ≥ 0.5**: 유지. §3.4 계산과 일치.
- **Sign consistency 3/3**: 엄격. 본 문서는 **2/3 이상으로 완화** 권고
  (h=3 rapid response, h=10 drift susceptibility 고려). 3/3은 STRONG.

---

## §5 Failure Modes & Diagnostic Trees

### 5.1 4-가지 실패 모드 (user brief §4 확장)

#### (a) IC lift < +0.005 (signal extinction)

**Symptom**: paired subset IC가 baseline과 거의 동일.
**Root cause 확률**:
1. **z-score μ/σ mismatch (80%)** — `data/backtest/mra_apt_coefficients.json`의
   `apt_factors` 필드에 `mu`/`sigma` **미저장 상태** (pre-flight confirmed —
   §6 Diagnostic A 참조). Client-side에서 임시 통계 사용 시 training cohort와
   분포 불일치.
2. Ridge coefficient 부호 불일치 (10%) — offline pipeline 재실행 시 발생 가능.
3. universe shift (10%) — 2026-Q1 신규 종목 비중 증가로 training distribution
   drift.

**즉시 조치**: Phase B-3 meta injection 재검토. `financial-engineering-expert`를
재소환하여 offline backfill 1회 실행 (μ/σ 주입).

#### (b) fullFactorRatio < 0.3 (coverage collapse)

**Symptom**: 30% 미만 occurrence에서만 5-factor 모두 non-null.
**Root cause 확률**:
1. `candles.length < 60` 케이스 과다 (50%) — 단기 listed 종목 비중↑
2. `meta.pbr` 필드 주입 실패 (30%) — `financials.js`의 meta 경로 에러
3. `meta.marketCap` 누락 (15%) — `data/index.json` 결손
4. `marketReturns60d` 미주입 (5%) — `_marketIndexCloses` 누락

**즉시 조치**: Phase B-2 가드 조정. `code-audit-inspector` 재감사 후 null 경로
상세 계측 (각 factor별 null 비율 breakdown). 가드 레벨을 3/5 non-null로 완화
(대신 partial vector 지원 필요).

#### (c) ICIR < 1.0 annualized (overfitting signal)

**Symptom**: mean IC는 양수이나 std IC가 과도하게 큼.
**Root cause 확률**:
1. In-sample overfitting 유출 (60%) — training과 live의 공변량 분포 차이
2. Ridge λ 재튜닝 필요 (25%) — λ=2.0이 2026 regime에 최적 아닐 가능성
3. Factor interaction 누락 (15%) — 17-col에는 interaction term 제한적

**즉시 조치**: Phase 8 L6 block bootstrap OOS validation 이월. λ 1.5 / 2.0 / 3.0 /
5.0 grid search로 재튜닝 후 재평가.

#### (d) Sign inconsistency (h=3/5/10 중 1개 이상 반대 부호)

**Symptom**: h=5에서 positive이나 h=10에서 negative, 또는 역.
**Root cause 확률**:
1. Horizon-specific noise (40%) — h=10에서는 dividend/split 조정 영향↑
2. Mean-reversal horizon mismatch (35%) — momentum factor가 h=3에서 + / h=10에서 −
3. Regime instability (25%) — 2026-Q2 전환기 가능성

**즉시 조치**: h=10 drop하고 h∈{3,5}만 사용. 단, §6.3 horizon monotonicity
check를 재실행하여 h=3과 h=5의 비율이 이론적 √(5/3) ≈ 1.29 배 차이인지 확인
(large deviation이면 horizon scaling issue).

### 5.2 Factor별 실패 진단 트리 (null > 30% 과다 시)

각 factor에서 null 비율이 Phase 4-1 기대치(Coverage %)보다 10%p 이상 낮을 때:

```
Step 1: occ.stock code 유효성
         → stockCode regex /^[0-9A-Z]{6}$/ 통과 여부
         → data/index.json에 entry 존재 여부
         → FAIL이면 occ 생성 루프 버그 (signalEngine.js 확인)

Step 2: meta 필드 존재 확인
         → marketCap, pbr, volume 각각 null/undefined 체크
         → FAIL이면 financials.js의 meta 주입 경로 에러
         → 주요 의심: getFinancialData() 3-tier fallback에서 seed tier 도달

Step 3: 시계열 길이 체크
         → candles.length >= 60 (momentum_60d, beta_60d)
         → _marketIndexCloses[market].length >= 60 (beta_60d only)
         → FAIL이면 신규 상장 종목 or market index 동기화 실패

Step 4: candles[idx] index 유효성
         → idx >= 60 && idx < candles.length
         → FAIL이면 occ.barIndex 계산 오류 (pattern engine 확인)

Step 5: 내부 NaN/Infinity 체크
         → p0, pT 양수 여부 (momentum_60d)
         → pbr > 0 (value_inv_pbr; 적자/자본잠식)
         → marketCap > 0 (log_size, liquidity_20d)
         → varM > 0 (beta_60d; zero variance market)
         → FAIL이면 data quality 이슈

Step 6: computeFactors() try-catch 래핑
         → 현재 js/aptModel.js에는 try-catch 부재
         → Phase 7 구현 시 추가 권고 (Step 1-5 커버되지 않는 edge case 방어)
```

### 5.3 Liquidity Dominance Guard (HALT trigger)

**Gate 정의** (hard stop):

```
if |t_liquidity_20d| < 10 during Phase 7 client-side measurement:
    → IMMEDIATE HALT (no further Phase 7 tickets)
    → Root cause 재조사:
      (a) z-score normalization 검증 (mean/std offline vs client-side)
      (b) volume 데이터 품질 (0 거래정지 bar 포함 여부)
      (c) marketCap 단위 일관성 (억원 vs 원; aptModel.js L.181 주석 참조)
```

Phase 4-1에서 liquidity는 **5-factor 중 가장 강력**. 이 dominance가 붕괴하면 전체
5-factor 구조의 신뢰성 의심. 본 guard는 P7-MVP의 **최우선 sanity check**.

---

## §6 Implementation Diagnostics (Pre-flight Checks)

### 6.1 Diagnostic A: μ/σ 저장 여부 (CRITICAL)

**Finding**: `data/backtest/mra_apt_coefficients.json`의 `apt_factors` 필드는
다음 메타만 포함 (직접 확인):

```json
{
  "momentum_60d": {"description": "...", "z_scored": true, "coverage_pct": 75.6},
  "beta_60d":     {"description": "...", "z_scored": true, "coverage_pct": 75.6},
  "value_inv_pbr":{"description": "...", "z_scored": true, "coverage_pct": 82.6},
  "log_size":     {"description": "...", "z_scored": true, "coverage_pct": 100.0},
  "liquidity_20d":{"description": "...", "z_scored": true, "coverage_pct": 91.7}
}
```

**z_scored=true로 선언되어 있으나, 실제 μ/σ 값은 저장되어 있지 않다**. 이는
`financial-engineering-expert` (Agent 1)가 `zscore_design.md`에서 해결할 core
이슈이며, 본 factor contribution matrix 성공 여부의 **근본 전제조건**.

**Action 권고** (CFA 관점):
- Option (b) offline backfill 강력 권고. Client-side 임시 cohort 통계 계산은
  (a) training distribution과 다른 universe, (b) training period(2023-2025)와
  다른 regime에서 drift 큼.
- Backfill 비용: `scripts/mra_apt_extended.py` 1회 재실행 (~45초 전후).
- 주입 형태: `apt_factors[k].mu` + `apt_factors[k].sigma` 추가. 보수적으로는
  `apt_factors[k].median` + `apt_factors[k].mad` (robust z-score) 추가 권장
  (out-of-distribution defense).

### 6.2 Diagnostic B: Coverage drop-off 검증

Phase 4-1 coverage (75.6/75.6/82.6/100/91.7)가 Phase 7 client-side에서 **유지되는지**
실시간 계측:

```javascript
// appWorker.js 또는 financials.js에 추가 권고
var factorCoverage = {
  momentum60d: { total: 0, nonNull: 0 },
  beta60d:     { total: 0, nonNull: 0 },
  valueInvPbr: { total: 0, nonNull: 0 },
  logSize:     { total: 0, nonNull: 0 },
  liquidity20d:{ total: 0, nonNull: 0 }
};
// 각 occurrence마다 update
// 최종 PDF 리포트에 5-factor coverage breakdown 출력
```

**기대 drop-off**: Phase 4-1 대비 **±5%p 이내**. 더 크면 client universe와 training
universe 불일치.

### 6.3 Diagnostic C: Horizon scaling check

Multi-horizon (h=1, 3, 5, 10, 20) IC 측정 시 이론적 비율:

$$
\frac{\bar{IC}_{h_1}}{\bar{IC}_{h_2}} \approx \sqrt{\frac{h_2}{h_1}}
$$

가정: signal decay가 $\sim 1/\sqrt{h}$ (square-root rule).

| 비교 | 이론 비율 | 허용 범위 | FAIL 시 해석 |
|------|----------|----------|--------------|
| IC_3 / IC_5 | √(5/3) = 1.29 | [1.1, 1.5] | horizon decay 비정상 |
| IC_1 / IC_5 | √5 = 2.24 | [1.8, 2.8] | 단기 잔차 과다 |
| IC_10 / IC_5 | √(5/10) = 0.71 | [0.55, 0.90] | 장기 drift or stale signal |
| IC_20 / IC_5 | √(5/20) = 0.50 | [0.35, 0.70] | regime shift 내재 |

### 6.4 Diagnostic D: Contribution decomposition

Phase 7 구현 시 각 factor의 prediction 기여도 breakdown 권고:

```
contrib_k = coef_k × z_k(factor)      // 단일 occurrence
avg_contrib_k = E[|contrib_k|]         // universe 평균 기여도 (절댓값)
```

기대 분포 (Phase 4-1 coef + z-score 1.0 기준 상대 비교):
- liquidity_20d: 0.374 × σ ≈ **dominant**
- log_size: 0.420 × σ ≈ **strong secondary**
- value_inv_pbr: 0.258 × σ ≈ **meaningful**
- beta_60d: 0.186 × σ ≈ **moderate**
- momentum_60d: 0.099 × σ ≈ **minor**

Phase 7에서 **liquidity + log_size**가 총 기여도의 **>55%** 차지 예상. 만약 client-side
에서 이 비율이 30% 미만이면 z-score mismatch 강력 시사.

---

## §7 Recommendations for Phase 7 Execution

### 7.1 Pre-implementation (Agent 1 zscore_design.md 결과 대기)

1. **μ/σ offline backfill 필수** (§6.1). Agent 1의 권고 채택.
2. Robust z-score (median + MAD) 병행 저장 권고 (defense in depth).

### 7.2 Implementation order

1. Step 1: `scripts/mra_apt_extended.py` 재실행 (μ/σ backfill, ~45초)
2. Step 2: `aptModel.computeFactors()` z-score 주입 로직 추가
3. Step 3: `financials.js` meta injection (pbr, marketCap 주입 경로)
4. Step 4: Diagnostic B (coverage tracker) 추가
5. Step 5: Diagnostic C (multi-horizon IC) 추가
6. Step 6: Diagnostic D (contribution decomposition) 추가

### 7.3 Post-implementation smoke test (E3 Gate 2 확장)

기존 E3 10-item 외에 추가 체크:

```
[ ] 11. Console log: "[APT] Model loaded: 17-col Ridge..." appears
[ ] 12. Console: "fullFactorRatio" reported ≥ 0.50
[ ] 13. Console: "|t_liquidity_20d|" reported ≥ 15 (HARD GATE)
[ ] 14. Console: "|t_log_size|" reported ≥ 12
[ ] 15. PDF meta sidecar: Phase 7 icApt mean ≥ baseline + 0.015
```

### 7.4 Rollback plan

**HALT trigger (§5.3)** 발동 시:
1. `js/aptModel.js` 호출 경로 off (feature flag `aptFactorsEnabled = false`)
2. `data/backtest/mra_apt_coefficients.json` 이전 버전 rollback (불필요; client만 off)
3. `financials.js` meta injection block disable
4. 회귀 테스트: baseline 12-col 수준으로 IC 복귀 확인

Zero risk approach: feature flag 기반 off (코드 삭제 불필요).

---

## §8 References

### 8.1 APT theory origin
- Ross, S. A. (1976). "The Arbitrage Theory of Capital Asset Pricing". *Journal of Economic Theory* 13(3), 341-360.

### 8.2 Empirical factor models
- Sharpe, W. F. (1964). "Capital Asset Prices: A Theory of Market Equilibrium". *Journal of Finance* 19(3), 425-442.
- Fama, E. F., & French, K. R. (1993). "Common Risk Factors in the Returns on Stocks and Bonds". *Journal of Financial Economics* 33(1), 3-56.
- Fama, E. F., & French, K. R. (2015). "A Five-Factor Asset Pricing Model". *Journal of Financial Economics* 116(1), 1-22.
- Carhart, M. M. (1997). "On Persistence in Mutual Fund Performance". *Journal of Finance* 52(1), 57-82.
- Hou, K., Xue, C., & Zhang, L. (2015). "Digesting Anomalies: An Investment Approach". *Review of Financial Studies* 28(3), 650-705.

### 8.3 Factor-specific
- Jegadeesh, N. (1990). "Evidence of Predictable Behavior of Security Returns". *Journal of Finance* 45(3), 881-898. (short-horizon reversal)
- Jegadeesh, N., & Titman, S. (1993). "Returns to Buying Winners and Selling Losers". *Journal of Finance* 48(1), 65-91.
- Amihud, Y. (2002). "Illiquidity and stock returns: cross-section and time-series effects". *Journal of Financial Markets* 5(1), 31-56.

### 8.4 Korean market empirical
- Kim, D., & Shin, H.-H. (2005). "한국 주식시장의 가치 프리미엄에 관한 실증연구".
- Eun, C. S., & Huang, W. (2007). "Asset pricing in China's domestic stock markets: Is there a logic?". *Pacific-Basin Finance Journal* 15(5), 452-480.
- Ryu, D. (2015). "The information content of trades: An analysis of KOSPI 200 index derivatives". *Journal of Futures Markets* 35(3), 201-221.

### 8.5 Methodology
- Fama, E. F., & MacBeth, J. D. (1973). "Risk, Return, and Equilibrium: Empirical Tests". *Journal of Political Economy* 81(3), 607-636. (FM t-test)
- Fisher, R. A. (1915). "Frequency distribution of the values of the correlation coefficient in samples of an indefinitely large population". *Biometrika* 10, 507-521. (Fisher z-transform for IC CI)
- Harvey, C. R., Liu, Y., & Zhu, H. (2016). "…and the Cross-Section of Expected Returns". *Review of Financial Studies* 29(1), 5-68. (HLZ FDR — Phase 8 L10)

---

**End of Factor Contribution Matrix**

**Next agent dependency**: `financial-engineering-expert` (Agent 1) will deliver
`zscore_design.md` addressing §6.1 (μ/σ backfill). `statistical-validation-expert`
(Agent 2) will deliver `ic_precision_framework.md` defining L1-L10. These 3 agent
reports converge at Phase 7 차회 세션 start to form the implementation contract.
