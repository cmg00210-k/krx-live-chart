# 05. Confidence Adjustment Chain — 신뢰도 조정 파이프라인

> `js/appWorker.js`의 10-function 신뢰도 조정 체인 전수 문서화.
> 패턴 감지 후 거시/미시/파생/신용/수급/레짐 데이터를 기반으로
> confidence를 순차 승수 조정하는 전체 파이프라인.

---

## Overview

### Entry Point

`_applyPhase8ConfidenceToPatterns(patterns)` — appWorker.js line 554.
단, 이 함수는 체인의 **7번째** 호출이며 "Phase 8" 이름은 역사적 명명이다.
실제 체인은 10개 함수가 **고정 순서로 순차 실행**된다.

### 호출 위치

Worker 결과 수신 시 (appWorker.js line 105~124) 및 메인 스레드 폴백 (line 1659~1677):

```
detectedPatterns = msg.patterns;
_applyMarketContextToPatterns(detectedPatterns);      // 1. 시장 맥락
_classifyRORORegime();                                 //    (RORO 스코어 산출)
_applyRORORegimeToPatterns(detectedPatterns);          // 2. RORO 체제
_applyMacroConfidenceToPatterns(detectedPatterns);     // 3. 매크로 11팩터
_updateMicroContext(candles);                           //    (미시 지표 계산)
_applyMicroConfidenceToPatterns(detectedPatterns, _microContext);  // 4. 미시 ILLIQ/HHI
_applyDerivativesConfidenceToPatterns(detectedPatterns);           // 5. 파생 7팩터
_calcNaiveDD(candles.map(c => c.close));               //    (DD 계산)
_applyMertonDDToPatterns(detectedPatterns);            // 6. Merton DD
_applyPhase8ConfidenceToPatterns(detectedPatterns);    // 7. MCS+HMM+수급+옵션
_applySurvivorshipAdjustment(detectedPatterns);        // 8. 생존편향 할인
_applyMacroConditionsToSignals(detectedSignals);       // 9. 시그널 매크로
_injectWcToSignals(detectedSignals, detectedPatterns); // 10. Wc 주입
```

### 핵심 메커니즘

- 모든 조정은 **곱셈(multiplicative)** 방식: `p.confidence *= adj`
- 각 함수는 독립적인 **clamp 범위**를 가짐 (이중 감산 방지)
- 최종 confidence는 항상 `[10, 100]`, confidencePred는 `[10, 95]`
- `p.signal === 'buy'` / `'sell'`로 방향 구분, 대부분 비대칭 조정

---

## 1. `_applyMarketContextToPatterns(patterns)` — 시장 맥락 조정

**appWorker.js line 1016~1051**

### Purpose

CCSI(소비자심리지수), 외국인 순매수, 어닝시즌 데이터로 패턴 신뢰도를 조정한다.

### Input Data Source

| Item | Source |
|------|--------|
| Global variable | `_marketContext` (appState.js line 253) |
| JSON file | `data/market_context.json` |
| Python script | `scripts/download_market_context.py` |
| Load location | `app.js` line 116~129 (init 시 1회 fetch) |

### Adjustment Formula

| Condition | Multiplier | Direction | Academic Reference |
|-----------|-----------|-----------|-------------------|
| CCSI < 85 | ×0.88 | buy only | Lemmon & Portniaguina (2006) |
| CCSI > 108 | ×1.06 | buy only | Lemmon & Portniaguina (2006) |
| net_foreign_eok > 1000억 | ×1.08 | buy only | Richards (2005), ~$75M threshold |
| earning_season = 1 | ×0.93 | both | 실적 불확실성 감산 |

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| CCSI_BEAR_THRESHOLD | 85 | [C] | 소비심리 악화 기준점 |
| CCSI_BULL_THRESHOLD | 108 | [B] | 소비심리 호전 기준점 (Lemmon&Portniaguina 2006) |
| NET_FOREIGN_THRESHOLD | 1000 (억원) | [B] | 외국인 유의미 순매수 (Richards 2005: ~$75M) |
| CCSI_BEAR_MULT | 0.88 | [D] | 소비심리 악화 시 매수 감산율 |
| CCSI_BULL_MULT | 1.06 | [D] | 소비심리 호전 시 매수 부스트율 |
| FOREIGN_BUY_MULT | 1.08 | [D] | 외국인 순매수 매수 부스트율 |
| EARNING_SEASON_MULT | 0.93 | [D] | 어닝시즌 전체 감산율 |

### Edge Cases

- `_marketContext === null`: 함수 즉시 반환 (no-op)
- `_marketContext.source === 'demo'`: 데모 데이터 → 조정 미적용 (line 1018)
- VKOSPI 제거됨 (line 1021): `patterns.js` regimeWeight가 권위적 소스

### Clamp Range

`[0.55, 1.35]` — 3개 팩터 동시 적용 시 최대 승수:
- 최대 boost: CCSI>108 × foreign>1000 = 1.06 × 1.08 = 1.145
- 최대 dampen: CCSI<85 × earning_season = 0.88 × 0.93 = 0.818

### Expected Effect Range

- Typical: 0.88x ~ 1.08x (단일 팩터)
- Maximum compounded: 0.818x ~ 1.145x (all conditions hit)

---

## 2. `_applyRORORegimeToPatterns(patterns)` — RORO 체제 편향

**appWorker.js line 1455~1477** (분류: line 1339~1450)

### Purpose

Risk-On / Risk-Off / Neutral 3체제를 5개 팩터 복합스코어로 분류하고,
체제에 따라 패턴 방향 편향을 적용한다.

### Input Data Source (5-Factor Composite)

| Factor | Weight | Source Variable | JSON File |
|--------|--------|----------------|-----------|
| VKOSPI/VIX 수준 | 0.30 | `_marketContext.vkospi` → `_macroLatest.vkospi` → `_macroLatest.vix × VIX_VKOSPI_PROXY` | vkospi.json / macro_latest.json |
| AA- 신용스프레드 | 0.10 | `_bondsLatest.credit_spreads.aa_spread` | bonds_latest.json |
| US HY 스프레드 | 0.10 | `_macroLatest.us_hy_spread` | macro_latest.json |
| USD/KRW 수준 | 0.20 | `_macroLatest.usdkrw` | macro_latest.json |
| MCS v1 | 0.15 | `_macroLatest.mcs` | macro_latest.json |
| 투자자 정렬 | 0.15 | `_investorData.alignment` | investor_summary.json |

### RORO Score Classification

| Score Range | Regime |
|-------------|--------|
| >= +0.25 | risk-on |
| <= -0.25 | risk-off |
| -0.25 ~ +0.25 | neutral |

히스테리시스 적용: 진입 ±0.25, 이탈 ±0.10 (잦은 체제 전환 방지)

### Adjustment Formula

| Regime | Buy Adj | Sell Adj |
|--------|---------|----------|
| risk-on | ×1.06 | ×0.94 |
| risk-off | ×0.92 | ×1.08 |
| neutral | no-op | no-op |

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| VOL_WEIGHT | 0.30 | [C] | VKOSPI 팩터 가중치 |
| CREDIT_AA_WEIGHT | 0.10 | [C] | AA- 스프레드 가중치 |
| CREDIT_HY_WEIGHT | 0.10 | [C] | US HY 스프레드 가중치 |
| FX_WEIGHT | 0.20 | [C] | USD/KRW 가중치 |
| MCS_WEIGHT | 0.15 | [C] | MCS 가중치 |
| FLOW_WEIGHT | 0.15 | [C] | 투자자 정렬 가중치 |
| ENTER_ON | +0.25 | [D] | risk-on 진입 임계값 |
| ENTER_OFF | -0.25 | [D] | risk-off 진입 임계값 |
| EXIT_ON | +0.10 | [D] | risk-on 이탈 임계값 |
| EXIT_OFF | -0.10 | [D] | risk-off 이탈 임계값 |
| RISK_ON_BUY | 1.06 | [D] | risk-on 매수 승수 |
| RISK_OFF_BUY | 0.92 | [D] | risk-off 매수 승수 |
| VIX_VKOSPI_PROXY | 1.12 | [B] | VIX→VKOSPI 환산 (Whaley 2009) |

### Edge Cases

- `count === 0` (모든 데이터 없음): regime='neutral', score=0, 조정 없음
- `count < 3`: 비례 할인 적용 `normalizedScore = score × min(count/3, 1.0)`
- `p.signal !== 'buy' && p.signal !== 'sell'`: neutral 패턴 스킵 (line 1468)

### Clamp Range

`[0.92, 1.08]` — VIX(Factor 8)/credit(Factor 3) 이중 적용 방지 목적으로 좁게 설정

### Expected Effect Range

- risk-on: buy ×1.06, sell ×0.94
- risk-off: buy ×0.92, sell ×1.08
- neutral: 1.00 (no-op)

### Academic Reference

Baele, Bekaert & Inghelbrecht (2010) "The Determinants of Stock and Bond Return Comovements", RFS 23(6)

---

## 3. `_applyMacroConfidenceToPatterns(patterns)` — 매크로 11팩터 조정

**appWorker.js line 1071~1328**

### Purpose

ECOS/FRED/KRX 매크로 경제지표 11개 독립 팩터를 곱셈 결합하여
패턴 신뢰도를 경기국면/금리/신용/수급에 따라 차등 조정한다.
시스템 내 **가장 복잡한** 단일 조정 함수 (258 lines).

### Input Data Source

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_macroLatest` | `data/macro/macro_latest.json` | `scripts/download_ecos.py` |
| `_bondsLatest` | `data/macro/bonds_latest.json` | `scripts/download_ecos.py` |
| `_kosisLatest` | `data/macro/kosis_latest.json` | `scripts/download_kosis.py` |
| `_macroComposite` | `data/macro/macro_composite.json` | `scripts/compute_mcs.py` |

### 11 Factors (in execution order)

#### Factor 1: 경기국면 + Stovall(1996) 섹터 순환 (line 1095~1116)

| Phase | Buy Adj (default) | Sell Adj (default) |
|-------|------|------|
| expansion | ×1.06 | ×0.94 |
| peak | ×0.95 | ×1.08 |
| contraction | ×0.92 | ×1.08 |
| trough | ×1.10 | ×0.90 |

Stovall 차등: `_STOVALL_CYCLE[sector][phase]` → `buyMult` (appState.js line 414~432).
매핑 성공 시 default 대신 섹터별 승수 적용. 예: `semiconductor/trough = 1.14`.

#### Factor 2: 수익률곡선 4체제 (line 1118~1150)

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| Inverted (slope < 0) | ×0.88 | ×1.12 |
| Bull Steepening (gap<0, slope>0.2) | ×1.06 | ×0.95 |
| Bull Flattening (gap<0, slope≤0.2) | ×0.97 | ×1.03 |
| Bear Steepening (gap>0, slope>0.2) | ×0.95 | ×1.04 |
| Bear Flattening (gap>0, slope≤0.2) | ×0.90 | ×1.10 |
| Fallback: slope < 0.15 | ×0.96 | ×1.04 |
| Fallback: slope > 0.5 | ×1.04 | ×0.97 |

#### Factor 3: 크레딧 레짐 (line 1152~1161)

| Condition | Adj |
|-----------|-----|
| AA spread > 1.5 or stress | ×0.85 (both) |
| AA spread > 1.0 or elevated | buy ×0.93, sell ×1.04 |

#### Factor 4: 외인 시그널 (line 1163~1172)

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| foreigner_signal > +0.3 | ×1.05 | ×0.96 |
| foreigner_signal < -0.3 | ×0.95 | ×1.05 |

#### Factor 5: 패턴-특화 오버라이드 (line 1174~1210)

| Pattern | Condition | Extra Adj |
|---------|-----------|-----------|
| doubleTop (sell) | contraction/peak + inverted/flat | ×1.10 |
| doubleBottom (buy) | trough + slope > 0.3 | ×1.12 |
| bearishEngulfing (sell) | CLI delta < -0.1 | ×1.06 |
| hammer (buy) | trough/contraction | ×1.06 |
| hammer (buy) | expansion/peak | ×0.96 |
| invertedHammer (buy) | trough/contraction | ×1.05 |
| invertedHammer (buy) | expansion/peak | ×0.97 |

#### Factor 6: MCS v1 (line 1212~1226)

`_macroLatest.mcs` (0~1 범위). `_macroComposite.mcsV2`가 있으면 이중 적용 방지 차원에서 스킵.

| Condition | Formula |
|-----------|---------|
| MCS > 0.6 | `mcsAdj = 1.0 + (mcs - 0.6) × 0.25` → buy ×mcsAdj, sell ×(2-mcsAdj) |
| MCS < 0.4 | `mcsAdj = 1.0 + (0.4 - mcs) × 0.25` → buy ×(2-mcsAdj), sell ×mcsAdj |
| 0.4~0.6 | no-op |

#### Factor 7: Taylor Rule Gap (line 1228~1254)

`tgNorm = clamp(taylorGap/2, -1, +1)`. Dead band: |tgNorm| ≤ 0.25.

| Condition | Formula |
|-----------|---------|
| tgNorm < -0.25 (dovish) | `tAdj = 1 + |tgNorm| × 0.05` → buy ×tAdj, sell ×(2-tAdj) |
| tgNorm > +0.25 (hawkish) | `tAdj = 1 + |tgNorm| × 0.05` → sell ×tAdj, buy ×(2-tAdj) |

Max ±5% at full normalization.

#### Factor 8: VRP — Volatility Risk Premium (line 1256~1269)

| VIX Level | Buy Adj | Sell Adj |
|-----------|---------|----------|
| > 30 | ×0.93 | ×0.93 (both) |
| 25~30 | ×0.97 | ×1.02 |
| < 15 | ×1.03 | ×0.98 |

#### Factor 9: 한미 금리차 (line 1271~1283)

| rate_diff | Buy Adj | Sell Adj |
|-----------|---------|----------|
| < -1.5 | ×0.95 | ×1.04 |
| -1.5 ~ -0.5 | ×0.98 | ×1.02 |
| > +1.0 | ×1.03 | ×0.98 |

#### Factor 10: Rate Beta × 금리 방향 (line 1285~1301)

섹터별 금리 민감도 (`_RATE_BETA` appState.js line 472~485) × Taylor gap 방향.

```
rateDir = clamp(taylorGap / 2, -1, +1)
levelAmp = (ktb10y > 4.0) ? 1.5 : 1.0
rateAdj = rateDir × rBeta × levelAmp
adj *= isBuy ? (1 + rateAdj) : (1 - rateAdj)
```

Range: `_RATE_BETA` spans [-0.08, +0.05]. Max rateAdj: 1.0 × 0.08 × 1.5 = ±0.12.

#### Factor 11: KOSIS CLI-CCI Gap (line 1303~1316)

| cli_cci_gap | Buy Adj | Sell Adj |
|-------------|---------|----------|
| > +5 | ×1.04 | ×0.97 |
| < -5 | ×0.97 | ×1.04 |

### Constants (Summary)

| Constant | Value | Grade | Factor |
|----------|-------|-------|--------|
| Stovall cycle multipliers (48 values) | 0.88~1.14 | [B] | F1 |
| RATE_BETA (12 sectors) | -0.08~+0.05 | [B] | F10 |
| KTB10Y_HIGH_AMP | 4.0 | [C] | F10 |
| KTB10Y_AMP_MULT | 1.5 | [D] | F10 |
| AA_SPREAD_STRESS | 1.5 | [B] | F3 |
| AA_SPREAD_ELEVATED | 1.0 | [B] | F3 |
| CREDIT_STRESS_MULT | 0.85 | [D] | F3 |
| FOREIGNER_THRESHOLD | ±0.3 | [D] | F4 |
| MCS_NEUTRAL_RANGE | 0.4~0.6 | [C] | F6 |
| MCS_SENSITIVITY | 0.25 | [D] | F6 |
| TAYLOR_DEAD_BAND | 0.25 (normalized) | [B] | F7 |
| TAYLOR_MAX_ADJ | 0.05 | [D] | F7 |
| VIX_CRISIS | 30 | [A] | F8 |
| VIX_ELEVATED | 25 | [A] | F8 |
| VIX_LOW | 15 | [A] | F8 |
| RATE_DIFF_STRONG | -1.5 | [C] | F9 |
| RATE_DIFF_MILD | -0.5 | [C] | F9 |
| CLI_CCI_GAP_THRESHOLD | ±5 | [C] | F11 |

### Clamp Range

`[0.70, 1.25]`

### Expected Effect Range

- Typical (1~3 factors active): 0.85x ~ 1.15x
- Maximum theoretical (all 11 factors adverse): clamp floors at 0.70x
- Maximum boost (all 11 bullish): clamp caps at 1.25x
- Pattern-specific override can compound: doubleTop in contraction+inverted → extra ×1.10

---

## 4. `_applyMicroConfidenceToPatterns(patterns, microCtx)` — 미시경제 조정

**appWorker.js line 1523~1556** (계산: line 1482~1512)

### Purpose

종목 고유의 유동성(Amihud ILLIQ)과 업종 집중도(HHI)로 패턴 신뢰도를 보정한다.

### Input Data Source

| Item | Source |
|------|--------|
| `_microContext.illiq` | `calcAmihudILLIQ(candles)` (indicators.js line 1430) — 실시간 계산 |
| `_microContext.hhiBoost` | `ALL_STOCKS` 기반 업종별 HHI 계산 (appWorker.js line 1486~1508) |

### Adjustment Formula

#### Factor 1: Amihud ILLIQ 유동성 할인

```
adj *= microCtx.illiq.confDiscount   // 0.85 ~ 1.0 (indicators.js에서 산출)
```

`confDiscount` 산출 (indicators.js line 1430~): logIlliq 수준에 따라 0.85~1.0 사이 할인.
고비유동(logIlliq > -1) → 최대 할인 0.85. 정상 유동성(logIlliq < -3) → 할인 없음 1.0.

#### Factor 2: HHI Mean-Reversion Boost

Mean-reversion 패턴(doubleBottom, doubleTop, H&S, invH&S)에만 적용:

```
adj *= (1 + hhiBoost)
hhiBoost = 0.10 × HHI   // HHI_MEAN_REV_COEFF = 0.10
```

HHI 범위 [0, 1]. 독과점 업종(HHI=0.5) → +5%. 완전경쟁(HHI→0) → 0%.

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| ILLIQ_WINDOW | 20 | [B] | Amihud(2002) 표준 윈도우 |
| ILLIQ_CONF_DISCOUNT | 0.85 | [C] | 최대 유동성 할인 |
| LOG_ILLIQ_HIGH | -1.0 | [C] | 고비유동 임계값 |
| LOG_ILLIQ_NORMAL | -3.0 | [C] | 정상 유동성 임계값 |
| HHI_MEAN_REV_COEFF | 0.10 | [C] | HHI 평균회귀 계수 (#119, Doc33 §6.2) |

### Edge Cases

- `microCtx === null` (캔들 < 21개): no-op
- `microCtx.illiq === null`: ILLIQ 조정 스킵
- `sectorCaps.length < 2`: HHI 계산 불가 → hhiBoost = 0

### Clamp Range

`[0.80, 1.15]` — 매크로보다 좁은 범위 (종목 고유 지표)

### Expected Effect Range

- ILLIQ only: 0.85x ~ 1.00x
- HHI boost (mean-rev types): 1.00x ~ 1.10x
- Combined: 0.80x ~ 1.10x

---

## 5. `_applyDerivativesConfidenceToPatterns(patterns)` — 파생상품 7팩터 조정

**appWorker.js line 711~825**

### Purpose

선물 베이시스, PCR, 투자자 수급, ETF 센티먼트, 공매도 비율, USD/KRW 수출주 채널 등
7개 파생/수급 데이터로 패턴 신뢰도를 조정한다.

### Input Data Source

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_derivativesData` | `data/derivatives/derivatives_summary.json` | `scripts/download_derivatives.py` |
| `_investorData` | `data/derivatives/investor_summary.json` | `scripts/download_investor.py` |
| `_etfData` | `data/derivatives/etf_summary.json` | `scripts/download_etf.py` |
| `_shortSellingData` | `data/derivatives/shortselling_summary.json` | `scripts/download_shortselling.py` |
| `_derivativesData.basis` | `data/derivatives/basis_analysis.json` | `scripts/compute_basis.py` |
| `_macroLatest.usdkrw` | `data/macro/macro_latest.json` | `scripts/download_ecos.py` |

### 7 Factors

#### Factor 1: 선물 베이시스 (line 742~758)

| Condition | Normal (±5%) | Extreme (±8%) |
|-----------|-------------|---------------|
| basisPct ≥ 0.5 (contango) | buy +5%, sell -5% | buy +8%, sell -8% |
| basisPct < 0 (backwardation) | buy -5%, sell +5% | buy -8%, sell +8% |

Threshold: `bPct ≥ 0.5` (normal), `bPct ≥ 2.0` (extreme).
Reference: Doc27 §5.1, Bessembinder & Seguin (1993).

#### Factor 2: PCR 역발상 (line 760~769)

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| PCR > 1.3 (극공포) | ×1.08 | ×0.92 |
| PCR < 0.5 (극탐욕) | ×0.92 | ×1.08 |

Reference: Doc37 §6, Pan & Poteshman (2006).

#### Factor 3: 투자자 수급 Alignment (line 771~782)

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| aligned_buy (외국인+기관 동반매수) | ×1.08 | ×0.93 |
| aligned_sell (외국인+기관 동반매도) | ×0.93 | ×1.08 |
| divergent/neutral | no-op | no-op |

Reference: Doc39 §6, Choe/Kho/Stulz (2005).

#### Factor 4: ETF 레버리지 센티먼트 (line 784~792)

역발상(contrarian) 적용 — 극단적 센티먼트는 과열/과매도 신호.

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| strong_bullish | ×0.95 | ×1.05 |
| strong_bearish | ×1.05 | ×0.95 |

Reference: Doc38 §3, Cheng & Madhavan (2009).

#### Factor 5: 공매도 비율 (line 794~804)

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| market_short_ratio > 10% | ×1.06 | ×0.94 |
| market_short_ratio < 2% | ×0.97 | ×1.03 |

Reference: Doc40 §4, Desai et al. (2002).

#### Factor 6: ERP

코드에서 제거됨 (line 807): `signalEngine._detectERPSignal()`에서만 처리하여 이중 적용 방지.

#### Factor 7: USD/KRW 수출주 채널 (line 809~814)

수출 섹터(semiconductor, tech, cons_disc, industrial)에만 적용:

| Condition | Buy Adj | Sell Adj |
|-----------|---------|----------|
| USD/KRW > 1400 (KRW 급약세) | ×1.05 | ×0.95 |
| USD/KRW < 1300 (KRW 강세) | ×0.95 | ×1.05 |

Reference: Doc28 §3, β_FX ±5%.

### Constants

| Constant | Value | Grade | Factor |
|----------|-------|-------|--------|
| BASIS_NORMAL_THR | 0.5% | [B] | F1 |
| BASIS_EXTREME_THR | 2.0% | [C] | F1 |
| BASIS_NORMAL_MULT | 0.05 | [D] | F1 |
| BASIS_EXTREME_MULT | 0.08 | [D] | F1 |
| PCR_FEAR | 1.3 | [B] | F2 |
| PCR_GREED | 0.5 | [B] | F2 |
| PCR_MULT | ±0.08 | [D] | F2 |
| ALIGN_MULT | ±0.08/±0.07 | [D] | F3 |
| ETF_CONTRARIAN_MULT | ±0.05 | [D] | F4 |
| SHORT_HIGH | 10% | [C] | F5 |
| SHORT_LOW | 2% | [C] | F5 |
| USDKRW_WEAK | 1400 | [C] | F7 |
| USDKRW_STRONG | 1300 | [C] | F7 |
| FX_EXPORT_MULT | ±0.05 | [D] | F7 |

### Clamp Range

`[0.70, 1.30]`

### Expected Effect Range

- Typical (2~3 factors): 0.85x ~ 1.15x
- Maximum (all 6 active factors aligned): theoretical ~0.66x (clamped to 0.70) ~ ~1.46x (clamped to 1.30)

---

## 6. `_applyMertonDDToPatterns(patterns)` — Merton DD 신용위험 조정

**appWorker.js line 923~951** (계산: line 850~915)

### Purpose

Merton(1974) Distance-to-Default 모델로 부도 위험이 높은 비금융주의
매수 패턴 신뢰도를 할인하고, 매도 패턴을 부스트한다.

### Input Data Source

| Item | Source |
|------|--------|
| `_currentDD` | `_calcNaiveDD(candleCloses)` — 실시간 계산 |
| 시총 (E) | `sidebarManager.MARKET_CAP[code]` or `currentStock.marketCap` |
| 부채 (D) | `_financialCache[code]` → `total_liabilities × 0.75` (KMV 관행) |
| σ_E | `calcEWMAVol(closes)` × √252 (연율화) |
| r (무위험이자율) | `_bondsLatest.yields.ktb_3y` → fallback 3.5% |

### DD Formula (Bharath & Shumway 2008 Naive DD)

```
V = E + D                                    // 자산가치 근사
σ_V = σ_E × (E/V) + 0.05 × (D/V)           // 자산변동성 근사
DD = [ln(V/D) + (r - 0.5σ_V²) × T] / (σ_V × √T)
EDF = Φ(-DD)                                 // 기대 부도확률
```

### Adjustment Formula

| DD Range | Buy Adj | Sell Adj |
|----------|---------|----------|
| DD ≥ 2.0 | no-op | no-op |
| 1.5 ≤ DD < 2.0 | ×0.95 | ×1.02 |
| 1.0 ≤ DD < 1.5 | ×0.82 | ×1.12 |
| DD < 1.0 | ×0.75 | ×1.15 |

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| DD_SAFE | 2.0 | [A] | 안전 경계 (조정 없음) |
| DD_WARNING | 1.5 | [A] | 경계 (#134, Doc35 §6.4) |
| DD_DANGER | 1.0 | [C] | 위험 |
| DEFAULT_POINT_RATIO | 0.75 | [B] | KMV 관행 (D = total_liab × 0.75) |
| EWMA_LAMBDA | 0.94 | [B] | RiskMetrics(1996) |
| FALLBACK_RISK_FREE | 0.035 | [C] | KTB3Y 미로드 시 폴백 금리 |
| DD_SAFE_BUY | 0.95 | [D] | DD 경계 매수 할인 |
| DD_DANGER_BUY | 0.82 | [D] | DD 위험 매수 할인 |
| DD_CRITICAL_BUY | 0.75 | [D] | DD 매우 위험 매수 할인 |

### Edge Cases

- `currentStock` 없음 or `candleCloses.length < 60`: DD 계산 스킵
- 금융주 (`sector === 'financial'`): DD 해석 무의미 → 제외 (line 857)
- seed 재무 데이터: DD 계산 금지 (line 863)
- `_currentDD === null`: no-op (line 924)

### Clamp Range

`[0.75, 1.15]` — 종목 고유 지표이므로 제한적 범위

### Expected Effect Range

- DD ≥ 2.0: 1.00 (no-op, 대부분의 정상 기업)
- DD 1.5~2.0: buy ×0.95, sell ×1.02
- DD 1.0~1.5: buy ×0.82, sell ×1.12
- DD < 1.0: buy ×0.75, sell ×1.15

---

## 7. `_applyPhase8ConfidenceToPatterns(patterns)` — MCS+HMM+수급+옵션 통합

**appWorker.js line 554~637**

### Purpose

MCS v2, HMM 레짐, 종목별 수급 방향, 옵션 Implied Move를 통합 적용하는
최종 통합 조정 레이어. 이름과 달리 체인의 7번째 함수.

### Input Data Source

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_macroComposite.mcsV2` | `data/macro/macro_composite.json` | `scripts/compute_mcs.py` |
| `_flowSignals.stocks[code]` | `data/backtest/flow_signals.json` | `scripts/compute_hmm_regimes.py` |
| `_optionsAnalytics.analytics.straddleImpliedMove` | `data/derivatives/options_analytics.json` | `scripts/download_options.py` |

### Adjustment Formula

#### Sub-function A: MCS v2 (line 560~571)

| Condition | Adj |
|-----------|-----|
| mcsV2 ≥ 70 (strong_bull) AND signal=buy | ×1.05 |
| mcsV2 ≤ 30 (strong_bear) AND signal=sell | ×1.05 |

`MCS_THRESHOLDS` 정의: appState.js line 403.

#### Sub-function B: HMM 레짐 + 수급 (line 573~609)

Quality gate: `_flowSignals.flowDataCount > 0` (line 578). 0이면 전체 스킵.

HMM regime multiplier (시장 전체):

| Regime | Buy Mult | Sell Mult |
|--------|----------|-----------|
| bull | ×1.10 | ×0.85 |
| bear | ×0.85 | ×1.10 |
| sideways | ×1.00 | ×1.00 |
| null | ×1.00 | ×1.00 |

`REGIME_CONFIDENCE_MULT` 정의: appState.js line 394~399.

외국인 방향 일치 보너스 (per-stock data 있을 때만):

| Condition | Adj |
|-----------|-----|
| foreignMomentum=buy AND signal=buy | ×1.03 |
| foreignMomentum=sell AND signal=sell | ×1.03 |

#### Sub-function C: 옵션 Implied Move (line 612~623)

| Condition | Adj |
|-----------|-----|
| straddleImpliedMove > 3.0% | ×0.95 (all patterns) |

높은 Implied Move = 이벤트 기간 → 불확실성 증가 → 전반적 감산.

#### Sub-function D: DD 페널티 (제거됨, line 625~626)

이전에 DD < 2 시 매수 ×0.90 적용했으나, `_applyMertonDDToPatterns()`와 이중 적용 방지를 위해 제거.

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| MCS_THRESHOLDS.strong_bull | 70 | [C] | MCS v2 강세 임계값 |
| MCS_THRESHOLDS.strong_bear | 30 | [C] | MCS v2 약세 임계값 |
| MCS_BOOST | 1.05 | [D] | MCS 방향 일치 부스트 |
| REGIME_CONFIDENCE_MULT.bull.buy | 1.10 | [C] | 강세 레짐 매수 승수 |
| REGIME_CONFIDENCE_MULT.bull.sell | 0.85 | [C] | 강세 레짐 매도 승수 |
| REGIME_CONFIDENCE_MULT.bear.buy | 0.85 | [C] | 약세 레짐 매수 승수 |
| REGIME_CONFIDENCE_MULT.bear.sell | 1.10 | [C] | 약세 레짐 매도 승수 |
| FOREIGN_ALIGN_BONUS | 1.03 | [D] | 외국인 방향 일치 보너스 |
| IMPLIED_MOVE_THRESHOLD | 3.0% | [C] | 이벤트 기간 임계값 |
| IMPLIED_MOVE_DISCOUNT | 0.95 | [D] | 이벤트 기간 감산율 |

### Edge Cases

- `_macroComposite === null` or `mcsV2 === null`: MCS 조정 스킵
- `_flowSignals === null` or `flowDataCount === 0`: HMM + 수급 전체 스킵 (P0-fix quality gate)
- `_flowSignals.stocks[code]` 없음: 해당 종목 HMM/수급 스킵
- per-stock flow data 없음 (`foreignMomentum === null`): foreignMomentum 보너스만 스킵, HMM regime 승수는 적용 (line 588~590)
- `_optionsAnalytics === null`: 옵션 조정 스킵

### Final Clamp

confidence: `[10, 100]`, confidencePred: `[10, 95]` (line 628~636)

### Expected Effect Range

- MCS only: ×1.05 (one direction)
- HMM bull + foreign aligned: buy ×1.10 × 1.03 = ×1.133
- HMM bear + implied move: sell ×1.10 × 0.95 = ×1.045
- Maximum compound (bull + MCS + foreign + implied): buy ×1.05 × 1.10 × 1.03 × 0.95 = ×1.130

---

## 8. `_applySurvivorshipAdjustment(patterns)` — 생존편향 할인

**appWorker.js line 959~979**

### Purpose

상장폐지된 종목의 매수 패턴 실패를 반영하여 생존 편향을 보정한다.
매수 패턴만 할인, 매도 패턴은 조정하지 않음 (상폐 종목의 하락 = 매도 패턴 성공).

### Input Data Source

| Item | Source |
|------|--------|
| `backtester._survivorshipCorr` | `backtester.js` 내부 계산 |
| `corr.global.delta_wr_median` | 전체 매수 패턴 승률 중앙값 편차 (pp) |

### Adjustment Formula

```
adj = max(0.92, min(1.0, 1 - (globalDelta / 200)))
```

Only applied when `globalDelta > 1` (1pp 이상 차이 시).

| globalDelta | adj |
|-------------|-----|
| 1pp | 0.995 |
| 2.8pp | 0.986 |
| 5pp | 0.975 |
| ≥16pp | 0.92 (clamp floor) |

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| SURVIVORSHIP_MIN_DELTA | 1 (pp) | [D] | 적용 최소 편차 |
| SURVIVORSHIP_DIVISOR | 200 | [D] | WR delta → confidence 환산 |
| SURVIVORSHIP_CLAMP | [0.92, 1.0] | [C] | D-2 RORO band와 일관 |

### Edge Cases

- `backtester._survivorshipCorr` 미로드: no-op
- `globalDelta ≤ 1`: no-op (미미한 편차)
- Sell patterns: 조정 안 함 (line 974)

### Clamp Range

`[0.92, 1.0]`

### Expected Effect Range

- Typical: ×0.975 ~ ×0.995 (2~5pp delta)
- Maximum: ×0.92 (극단적 생존편향)

---

## 9. `_applyMacroConditionsToSignals(signals)` — 복합시그널 매크로 조정

**appWorker.js line 1565~1626**

### Purpose

5개 S/A-tier 복합 시그널에 매크로 상태 기반 특화 조정을 적용한다.
패턴이 아닌 **시그널(compositeId)**을 대상으로 한다.

### Input Data Source

패턴 조정과 동일한 `_macroLatest`, `_bondsLatest` 사용.

### Adjustment Rules (per compositeId)

#### sell_doubleTopNeckVol (baseConf=75)

| Condition | Extra Adj |
|-----------|-----------|
| phase = contraction or peak | ×1.08 |
| inverted or slope < 0 | ×1.10 |
| credit_regime = stress | ×1.06 |

Max compound: 1.08 × 1.10 × 1.06 = 1.260

#### buy_doubleBottomNeckVol (baseConf=72)

| Condition | Extra Adj |
|-----------|-----------|
| phase = trough | ×1.12 |
| phase = contraction | ×0.90 |
| slope > 0.3 | ×1.05 |
| foreigner_signal > 0.3 | ×1.06 |

Max compound (trough): 1.12 × 1.05 × 1.06 = 1.247

#### strongSell_shootingMacdVol (baseConf=69)

| Condition | Extra Adj |
|-----------|-----------|
| phase = peak or contraction | ×1.06 |
| inverted | ×1.08 |

Max compound: 1.06 × 1.08 = 1.145

#### sell_shootingStarBBVol (baseConf=69)

| Condition | Extra Adj |
|-----------|-----------|
| credit = elevated or stress | ×1.05 |
| phase = peak | ×1.04 |

Max compound: 1.05 × 1.04 = 1.092

#### sell_engulfingMacdAlign (baseConf=66)

| Condition | Extra Adj |
|-----------|-----------|
| phase = peak or contraction | ×1.06 |
| foreigner_signal < -0.3 | ×1.05 |

Max compound: 1.06 × 1.05 = 1.113

### Clamp Range

`[0.70, 1.25]`

### Expected Effect Range

- Most composites: 1.04x ~ 1.12x (single condition)
- Maximum: 1.25x (clamp cap, sell_doubleTopNeckVol in full crisis)
- buy_doubleBottomNeckVol in contraction: ×0.90 (only dampening case)

---

## 10. `_injectWcToSignals(signals, patterns)` — Wc 가중치 주입

**appWorker.js line 1632~1643**

### Purpose

패턴의 평균 Wc(composite weight) 값을 모든 시그널에 매칭한다.
이것은 confidence 조정이 아닌 **Wc 필드 주입**이지만, 체인의 마지막 단계로
시그널 렌더링/스코어링에서 Wc를 참조할 수 있게 한다.

### Formula

```javascript
avgWc = sum(patterns[i].wc) / count   // wc가 null인 패턴은 제외
signals[i].wc = avgWc                  // 모든 시그널에 동일 값 주입
```

### Edge Cases

- `patterns.length === 0` or `signals.length === 0`: 즉시 반환
- 모든 패턴의 `wc === null` (seed 데이터): `avgWc = 1` (기본값)

### Expected Effect

Confidence를 직접 수정하지 않음. 시그널의 `.wc` 필드만 설정.

---

## Cumulative Effect Analysis — 누적 효과 분석

### Theoretical Compound Range

10개 함수가 순차 곱셈되므로 이론적 누적 범위:

```
최대 dampen (all adverse, buy pattern):
  0.818 × 0.92 × 0.70 × 0.80 × 0.70 × 0.75 × (MCS/HMM compound) × 0.92 × ...
  → 실질적으로 confidence 10 (absolute floor)에 도달

최대 boost (all favorable, sell pattern):
  1.145 × 1.08 × 1.25 × 1.15 × 1.30 × 1.15 × (MCS/HMM compound) × 1.00 × ...
  → 실질적으로 confidence 100 (absolute ceiling)에 도달
```

### Realistic Effect Range

실제 환경에서는 모든 팩터가 동시에 극단값을 취하지 않으므로:

| Scenario | Typical Adjustment |
|----------|-------------------|
| Normal market, most data available | 0.90x ~ 1.10x |
| Macro stress (contraction + inverted + high VIX) | 0.70x ~ 0.80x for buy |
| Strong bull (expansion + steep + aligned + MCS high) | 1.15x ~ 1.25x for buy |
| Crisis (DD<1.0 + bear regime + high credit spread) | Buy may hit floor 10 |

### Individual Clamp Ranges (Summary)

| Function | Clamp Range | Purpose |
|----------|-------------|---------|
| 1. MarketContext | [0.55, 1.35] | 시장 맥락 (CCSI/외국인/어닝시즌) |
| 2. RORO Regime | [0.92, 1.08] | 체제 편향 (VIX/credit 이중 적용 방지) |
| 3. Macro 11-Factor | [0.70, 1.25] | 거시 경제 (가장 넓은 범위) |
| 4. Micro | [0.80, 1.15] | 미시 유동성/집중도 |
| 5. Derivatives 7-Factor | [0.70, 1.30] | 파생/수급 |
| 6. Merton DD | [0.75, 1.15] | 신용위험 |
| 7. Phase8 (MCS+HMM+Flow+Options) | [10, 100] abs | 통합 최종 clamp |
| 8. Survivorship | [0.92, 1.0] | 생존편향 (매수만) |
| 9. Macro→Signals | [0.70, 1.25] | 시그널 전용 |
| 10. Wc Inject | n/a | confidence 미변경 |

---

## Data Dependency Map — 데이터 의존성 맵

```
data/market_context.json ──── _marketContext ──── 1. MarketContext
                                                  2. RORO (vkospi fallback)

data/macro/macro_latest.json ── _macroLatest ──── 2. RORO (vkospi/vix/mcs/usdkrw)
                                                  3. Macro (cycle/slope/fSignal/vix/rateDiff/taylorGap/mcs)
                                                  5. Derivatives (usdkrw for FX channel)
                                                  6. Merton DD (ktb3y for risk-free rate)

data/macro/bonds_latest.json ── _bondsLatest ──── 2. RORO (aa_spread)
                                                  3. Macro (slope/inverted/aaSpread/creditRegime)
                                                  6. Merton DD (ktb_3y)
                                                  9. MacroSignals (same as Macro)

data/macro/kosis_latest.json ── _kosisLatest ──── 3. Macro (cli_cci_gap, Factor 11)

data/macro/macro_composite.json ── _macroComposite ── 3. Macro (mcsV2 이중적용 방지 체크)
                                                       7. Phase8 (mcsV2)

data/vkospi.json ────────────── _macroLatest.vkospi ── 2. RORO (Factor 1)

data/derivatives/derivatives_summary.json ── _derivativesData ── 5. Derivatives (basis/PCR)
data/derivatives/basis_analysis.json ──────  (→ merged into _derivativesData.basis)
data/derivatives/investor_summary.json ───── _investorData ───── 2. RORO (Factor 5)
                                                                  5. Derivatives (alignment)
data/derivatives/etf_summary.json ─────────  _etfData ────────── 5. Derivatives (leverage)
data/derivatives/shortselling_summary.json ─ _shortSellingData ── 5. Derivatives (shortRatio)
data/derivatives/options_analytics.json ──── _optionsAnalytics ── 7. Phase8 (impliedMove)

data/backtest/flow_signals.json ──────────── _flowSignals ─────── 7. Phase8 (HMM regime + flow)

_financialCache (data.js) ────────────────── 6. Merton DD (total_liabilities)
sidebarManager.MARKET_CAP ────────────────── 6. Merton DD (E = 시총)
calcEWMAVol(closes) ──────────────────────── 6. Merton DD (σ_E)
calcAmihudILLIQ(candles) ─────────────────── 4. Micro (ILLIQ)
backtester._survivorshipCorr ─────────────── 8. Survivorship
```

---

## Null Safety — 데이터 부재 처리

모든 함수는 데이터 부재 시 안전하게 no-op으로 동작한다:

| Function | Null Guard | Behavior |
|----------|-----------|----------|
| 1. MarketContext | `!_marketContext` or `source==='demo'` | 즉시 반환 |
| 2. RORO | `count===0` | regime='neutral', no-op |
| 3. Macro | `!macro && !bonds` | 즉시 반환. 개별 팩터: null 체크 후 스킵 |
| 4. Micro | `!microCtx` | 즉시 반환 |
| 5. Derivatives | `!deriv && !investor && !etf && !shorts` | 즉시 반환. 개별 팩터: null 체크 |
| 6. Merton DD | `!_currentDD` | 즉시 반환 |
| 7. Phase8 | `!_macroComposite`: MCS 스킵. `!_flowSignals` or `flowDataCount===0`: HMM 스킵 |
| 8. Survivorship | `!backtester._survivorshipCorr` | 즉시 반환 |
| 9. MacroSignals | `!macro && !bonds` | 즉시 반환 |
| 10. Wc Inject | `!patterns.length` or `!signals.length` | 즉시 반환 |

**Source guard**: `_investorData`, `_shortSellingData` source="sample" → null 처리 (line 424~434).
`_macroComposite`, `_optionsAnalytics` status="error" or source="sample"/"demo" → null 처리 (line 515~524).
`_flowSignals` flowDataCount=0 → HMM 스킵 (line 526~529).

---

## [D]-Tagged Constants Summary — 미검증 휴리스틱 상수 목록

체인 전체에서 [D] 등급(학술 근거 부재, 경험적 설정)인 상수 총 30+개:

### High Sensitivity (조정 폭 > ±5%)

| Constant | Value | Function | Impact |
|----------|-------|----------|--------|
| REGIME_MULT.bull.buy / bear.sell | 1.10 | Phase8 | +10% 매수/매도 |
| REGIME_MULT.bull.sell / bear.buy | 0.85 | Phase8 | -15% 매수/매도 |
| CCSI_BEAR_MULT | 0.88 | MarketContext | -12% 매수 |
| PCR_MULT | ±0.08 | Derivatives | ±8% |
| ALIGN_BUY_MULT | 1.08 / 0.93 | Derivatives | ±8/7% |
| CREDIT_STRESS_MULT | 0.85 | Macro | -15% 전체 |
| DD_DANGER_BUY | 0.82 | Merton DD | -18% 매수 |
| DD_CRITICAL_BUY | 0.75 | Merton DD | -25% 매수 |

### Medium Sensitivity (±3~5%)

| Constant | Value | Function | Impact |
|----------|-------|----------|--------|
| MCS_BOOST | 1.05 | Phase8 | +5% |
| FX_EXPORT_MULT | ±0.05 | Derivatives | ±5% |
| FOREIGN_ALIGN_BONUS | 1.03 | Phase8 | +3% |
| IMPLIED_MOVE_DISCOUNT | 0.95 | Phase8 | -5% |
| EARNING_SEASON_MULT | 0.93 | MarketContext | -7% |
| TAYLOR_MAX_ADJ | 0.05 | Macro | max ±5% |

### Low Sensitivity (±1~3%)

| Constant | Value | Function | Impact |
|----------|-------|----------|--------|
| SHORT_LOW_BUY | 0.97 | Derivatives | -3% |
| SURVIVORSHIP_DIVISOR | 200 | Survivorship | ~1~3% |
| CLI_CCI_MULT | ±0.04/0.03 | Macro | ±3~4% |
| KTB10Y_AMP_MULT | 1.5 | Macro | amplifier |

### Calibration Priority (recommended order)

1. **REGIME_CONFIDENCE_MULT** — IC 검증 최우선 (±10~15% 폭, 시장 전체 적용)
2. **CCSI/CREDIT multipliers** — 매크로 팩터 중 가장 큰 영향
3. **PCR/ALIGN multipliers** — 파생 팩터 ±8%
4. **DD tiers** — 신용위험 단계별 차등 검증
5. **Taylor/FX/CLI** — 소폭 조정, 상대적 낮은 우선순위

---

## Appendix: Execution Order Diagram

```
patternEngine.analyze(candles)
         │
         ▼
  ┌─── confidence (raw, from patterns.js) ───┐
  │                                           │
  │  1. _applyMarketContextToPatterns         │  ← market_context.json
  │     clamp [0.55, 1.35]                    │
  │                                           │
  │  2. _classifyRORORegime                   │  ← 5-factor composite
  │     _applyRORORegimeToPatterns            │
  │     clamp [0.92, 1.08]                    │
  │                                           │
  │  3. _applyMacroConfidenceToPatterns       │  ← macro_latest + bonds_latest
  │     clamp [0.70, 1.25]                    │     + kosis_latest
  │                                           │
  │  4. _updateMicroContext                   │  ← candles (ILLIQ, HHI)
  │     _applyMicroConfidenceToPatterns       │
  │     clamp [0.80, 1.15]                    │
  │                                           │
  │  5. _applyDerivativesConfidenceToPatterns │  ← derivatives + investor
  │     clamp [0.70, 1.30]                    │     + etf + shortselling
  │                                           │
  │  6. _calcNaiveDD                          │  ← candles + financials
  │     _applyMertonDDToPatterns              │
  │     clamp [0.75, 1.15]                    │
  │                                           │
  │  7. _applyPhase8ConfidenceToPatterns      │  ← macro_composite
  │     clamp [10, 100] abs                   │     + flow_signals
  │                                           │     + options_analytics
  │  8. _applySurvivorshipAdjustment          │  ← backtester corr
  │     clamp [0.92, 1.0]                     │
  │                                           │
  └─── confidence (final) ───────────────────┘
                                               
         │  (signals path)
         ▼
  │  9. _applyMacroConditionsToSignals        │  ← macro_latest + bonds_latest
  │     clamp [0.70, 1.25]                    │
  │                                           │
  │ 10. _injectWcToSignals                    │  ← patterns avg wc
  │     (no confidence change)                │
```

---

## Version History

| Date | Change |
|------|--------|
| 2026-04-06 | Initial creation — 10-function chain documentation |
