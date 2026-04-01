# Doc 34: 변동성 리스크 프리미엄과 HAR-RV 모형 (Volatility Risk Premium & HAR-RV)

> "변동성을 예측하는 최선의 방법은 변동성의 이질적 성분을 분해하는 것이다."
> "The best way to forecast volatility is to decompose its heterogeneous components."
> — Fulvio Corsi, *Journal of Financial Econometrics* (2009)

---

## 1. 개요

본 문서는 변동성 분석의 3대 핵심 이론을 통합적으로 다룬다:

1. **변동성 리스크 프리미엄 (VRP)** — Bollerslev, Tauchen & Zhou (2009)
2. **이질적 자기회귀 실현변동성 (HAR-RV)** — Corsi (2009)
3. **점프-확산 모형 (Jump-Diffusion)** — Merton (1976)

세 이론은 독립적으로 발전했지만, 변동성의 서로 다른 측면을 포착한다:

```
VRP:          시장이 변동성에 부여하는 "보험 프리미엄"
              → 내재변동성(IV)과 실현변동성(RV)의 괴리
              → 1-3개월 수익률 예측력 보유

HAR-RV:       변동성의 "장기 기억(long memory)" 특성 분해
              → 일/주/월 성분으로 실현변동성 예측
              → 변동성 수준 자체의 최적 예측

Jump-Diffusion: 정상적 확산과 "불연속적 점프"의 분리
              → 연속 변동성과 점프 위험의 구별
              → 극단 사건 빈도 추정
```

이 세 이론의 교집합이 CheeseStock의 변동성 기반 신호 체계를 구성한다.

**문서 범위와 기존 문서와의 관계:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| BSM + Greeks | 26번 §1 | — (참조만) |
| VKOSPI 레짐 | 26번 §2.3 | VRP 이론, VKOSPI-RV 스프레드 |
| IV/HV 비율 | 26번 §2.1 | HAR-RV 기반 HV 예측 고도화 |
| EWMA 변동성 | 05번 §8 | VRP 프록시 연결, Student-t CI |
| GEX | 26번 §6 | 이론적 배경 심화, 레짐 연동 |
| 가격제한 truncation | 20번 §2 | 점프 빈도 추정에 미치는 영향 |

---

## 2. 변동성 리스크 프리미엄 (Volatility Risk Premium, VRP)

### 2.1 이론적 기초

변동성 리스크 프리미엄은 옵션 시장에서 관측되는 내재변동성(IV)과
실제로 실현되는 변동성(RV) 사이의 체계적 괴리이다.

Bollerslev, Tauchen & Zhou (2009) "Expected Stock Returns and Variance Risk Premia":

```
VRP ≡ E^Q[σ²] - E^P[σ²]
    = IV² - RV²    (분산 기준)

또는 변동성 기준:
VRP_vol ≡ IV - RV  (변동성 수준 기준)

E^Q[·]: 위험중립 측도(risk-neutral measure) 하의 기대값
E^P[·]: 실물 측도(physical measure) 하의 기대값

IV ≈ VKOSPI / 100          (연율화 내재변동성)
RV ≈ HAR_RV_forecast / 100  (HAR-RV 예측값, 연율화)
```

**경제학적 직관:**

투자자는 변동성 자체의 변동(vol-of-vol)에 대해 위험 회피적이다.
변동성이 예상보다 급등할 때 포트폴리오 손실이 급격히 커지므로,
이 위험에 대한 보상으로 VRP가 양수(positive)로 유지된다.

```
VRP > 0 (정상 상태):
  시장이 미래 변동성을 실제보다 과대 평가
  → 옵션 매도자(보험 제공자)에게 프리미엄 지급
  → 이 프리미엄이 주식 수익률의 예측력을 가짐

VRP < 0 (비정상 상태):
  실현 변동성이 내재변동성을 초과
  → 시장이 꼬리위험(tail risk)을 과소 평가
  → 위기의 전조 신호 또는 위기 진행 중
```

### 2.2 VRP의 수익률 예측력

Bollerslev, Tauchen & Zhou (2009)의 핵심 실증 결과:

```
예측 회귀:
  r_{t+h} = α + β · VRP_t + ε_{t+h}

h = 1개월:  β > 0, R² ≈ 0.04   (t-stat ≈ 2.3)
h = 3개월:  β > 0, R² ≈ 0.08   (t-stat ≈ 3.1)
h = 6개월:  β > 0, R² ≈ 0.05   (t-stat ≈ 2.0)

해석: VRP가 높을 때 향후 1-3개월 수익률이 높다
      → 시장이 과도하게 보험료를 지불하고 있으며,
        이는 이후 리스크 해소(risk-on)로 이어진다
```

Bekaert & Hoerova (2014)는 VRP 분해를 통해 예측력을 더욱 정밀화했다:

```
VRP = VRP_continuous + VRP_jump

VRP_continuous: 연속적 변동성에 대한 프리미엄
  → 중기(1-6개월) 수익률 예측

VRP_jump: 점프 위험에 대한 프리미엄
  → 단기(1주-1개월) 급등 후 반전 예측
```

### 2.3 VKOSPI vs 실현변동성 스프레드

KRX에서 VRP를 산출하는 가장 직접적인 방법은 VKOSPI와 실현변동성의 차이이다.

```
VRP_KOSPI = VKOSPI - RV_realized_30d

RV_realized_30d = √[252 × (1/22) × Σ_{i=t-21}^{t} r²_i] × 100

여기서 r_i = ln(Close_i / Close_{i-1})
22 = 30 캘린더일 ÷ 1.36 ≈ 영업일 수
252 = 연간 영업일 수 (연환산 계수)
```

**VKOSPI VRP 역사적 분포 (2009-2026):**

| VRP 수준 | 빈도 | 시장 상태 | 향후 1개월 평균 수익률 |
|----------|------|----------|---------------------|
| VRP > 10%p | ~8% | 과도한 공포 프리미엄 | +2.8% |
| VRP 5-10%p | ~22% | 정상적 공포 프리미엄 | +1.2% |
| VRP 0-5%p | ~40% | 균형 상태 | +0.3% |
| VRP -5~0%p | ~20% | 경미한 역전 | -0.5% |
| VRP < -5%p | ~10% | 위기 국면, RV >> IV | -1.8% |

참고: 2020년 3월 COVID 시 VRP ≈ -25%p (VKOSPI 67, RV_30d 92),
2008년 10월 금융위기 시 VRP ≈ -35%p로 극단적 역전 관측.

### 2.4 VRP 프록시 — 주식 단위 EWMA 비율 (CheeseStock 구현)

VKOSPI 데이터는 지수 수준이며, 개별 종목에는 IV가 존재하지 않는다.
CheeseStock은 개별 종목의 EWMA 변동성 비율로 VRP를 대용(proxy)한다.

**이론적 근거:**

EWMA 장기(λ=0.97)는 변동성의 구조적 수준을, 단기(λ=0.86)는 현재의 급변을 포착한다.
이 비율은 VRP의 "부호(sign)"와 "레짐(regime)"을 대리한다.

```
vrp_proxy = σ_EWMA(λ=0.97) / σ_EWMA(λ=0.86)

σ_EWMA(λ):  EWMA 조건부 변동성 (indicators.js calcEWMAVol)
  σ²_t = λ · σ²_{t-1} + (1-λ) · r²_{t-1}

λ=0.97: 반감기 ≈ ln(2)/ln(1/0.97) ≈ 23 거래일 (~1개월)
λ=0.86: 반감기 ≈ ln(2)/ln(1/0.86) ≈ 4.6 거래일 (~1주)
```

**반감기 도출:**

```
EWMA에서 t일 전 수익률의 가중치: w(t) = (1-λ) · λ^t
반감기(half-life): w(h) = w(0)/2 → λ^h = 1/2 → h = ln(2)/ln(1/λ)

λ=0.97: h = 0.693/0.0305 ≈ 22.7일
λ=0.94: h = 0.693/0.0619 ≈ 11.2일  (RiskMetrics 기본값)
λ=0.86: h = 0.693/0.151  ≈ 4.6일
```

**VRP 프록시 해석:**

```
vrp_proxy > 1.2:  장기 vol > 단기 vol (변동성 감소 추세)
  → 현재 시장이 과거 대비 안정
  → risk-on 레짐: 추세 추종 패턴 신뢰도 +5%
  → 경제적 의미: 시장이 과거의 공포를 해소 중

vrp_proxy < 0.8:  단기 vol >> 장기 vol (변동성 급등)
  → 현재 시장이 과거 대비 불안정
  → risk-off 레짐: 방향성 패턴 신뢰도 -5%
  → 경제적 의미: 새로운 위험 요인이 가격에 반영되는 중

0.8 ≤ vrp_proxy ≤ 1.2:  중립
  → 표준 신뢰도 적용
```

**구현 매핑 — `signalEngine.calcVolRegime()`:**

```javascript
// signalEngine.js (line ~1887)
calcVolRegime(candles, cache) {
  // 1. EWMA 변동성 추출: 장기(λ=0.97), 단기(λ=0.86)
  volLong  = cache.ewmaVol(0.97);   // IndicatorCache 접근자
  volShort = cache.ewmaVol(0.86);

  // 2. 최근 유효값 추출
  lastLong  = volLong[last_valid_index];
  lastShort = volShort[last_valid_index];

  // 3. VRP 프록시 계산
  ratio = lastLong / lastShort;

  // 4. 레짐 분류 및 신뢰도 승수
  if (ratio > 1.2) → regime='risk-on',  multiplier=1.15  (Phase0-#6 확대)
  if (ratio < 0.8) → regime='risk-off', multiplier=0.85
  else             → regime='neutral',  multiplier=1.00

  return { regime, ratio, multiplier };
}
```

**반환값 활용 경로:**

```
signalEngine.analyze()
  → calcVolRegime() 호출 (line ~426)
  → stats.vrpRegime 저장
  → app.js _lastVrpRegime 업데이트 (line ~128)
  → 패턴 신뢰도 조정 시 multiplier 적용
```

### 2.5 VRP 프록시의 이론적 한계

```
1. 개별 종목 EWMA 비율 ≠ IV-RV 스프레드
   → 부호(sign)는 일치하지만 크기(magnitude)는 왜곡
   → 레짐 분류에는 적합, 연속적 VRP 추정에는 부적합

2. IV 정보 부재
   → KOSPI200 옵션 IV(VKOSPI)만 존재
   → 개별 종목의 IV는 대형주 85종 이외 불가 (26번 §4.1)

3. 비대칭 반응
   → EWMA는 양의 수익률과 음의 수익률에 동일 가중
   → GJR-GARCH의 레버리지 효과 미반영
   → 하방 변동성 급등 시 과소 반응 가능

4. 구조적 변환점 민감도
   → CUSUM(indicators.js cache.cusum()) 감지 변환점에서
     VRP 프록시가 오도될 수 있음
   → 변환점 직후 60봉 이내에서는 VRP 신호 무시 권장
```

### 2.6 VRP와 기존 변동성 레짐의 관계

indicators.js의 `classifyVolRegime()`은 EWMA 변동성 수준 자체를 분류한다.
VRP 프록시는 변동성의 "변화 방향"을 분류한다. 두 신호는 직교적(orthogonal)이다.

```
   ┌────────────────────────────────────────────────┐
   │          변동성 레짐 (classifyVolRegime)         │
   │            low      mid       high              │
   ├──────────────────────────────────────────────────┤
   │ VRP       │ 안정+저vol │ 균형    │ 위기 해소 중  │
   │ risk-on   │ → breakout │ → trend │ → recovery   │
   │           │ 패턴 강화  │ 기본값  │ reversal 유리 │
   ├──────────────────────────────────────────────────┤
   │ VRP       │ 저vol→폭풍 │ 전이    │ 위기 심화    │
   │ risk-off  │ 전야      │ 초기    │ → panic       │
   │           │ 주의 경보  │ 경계    │ 패턴 무력화  │
   └────────────────────────────────────────────────┘
```

---

## 3. HAR-RV 모형 (Heterogeneous Autoregressive Realized Volatility)

### 3.1 이질적 시장 가설 (Heterogeneous Market Hypothesis)

Corsi (2009)의 HAR-RV 모형은 Muller et al. (1997)의 이질적 시장 가설(HMH)에 기반한다.

**핵심 명제:** 금융 시장의 참여자는 서로 다른 투자 시계(time horizon)를 가지며,
이 이질성이 변동성의 장기 기억(long memory) 특성을 만든다.

```
시장 참여자의 시계 계층:

단기 (1일): 일중 트레이더, 스캘퍼, 시장 조성자
  → 일별 실현변동성 RV_d에 반응
  → 뉴스, 유동성 충격에 민감

중기 (1주): 스윙 트레이더, 기관 트레이더
  → 주간 실현변동성 RV_w에 반응
  → 기술적 패턴, 실적 시즌에 민감

장기 (1개월): 포트폴리오 매니저, 연기금, 외국인
  → 월간 실현변동성 RV_m에 반응
  → 거시경제, 통화정책에 민감

각 계층의 행동이 변동성에 누적적으로 기여하며,
이것이 변동성의 장기 의존성(long-range dependence)을 생성한다.
```

**장기 기억 현상과 HAR의 관계:**

변동성 시계열은 느린 자기상관 감소(slow autocorrelation decay)를 보인다.
이는 분수 적분 과정(fractionally integrated process)과 유사하며,
Hurst 지수 H > 0.5로 측정된다.

```
분수 적분 과정: (1-L)^d X_t = ε_t,  0 < d < 0.5
자기상관:       ρ(h) ~ C · h^{2d-1}  (power-law decay)

HAR-RV는 이 장기 기억을 3개 성분으로 이산적 근사한다:
  → ARFIMA(d) 대비 추정 용이, 해석 명확
  → 예측력도 ARFIMA(d)와 경쟁적 (Andersen et al. 2007)
```

### 3.2 실현변동성 (Realized Volatility) 산출

HAR-RV 모형의 종속변수이자 핵심 입력은 실현변동성이다.

```
이론적 정의 (고빈도 데이터):

RV_t = Σ_{i=1}^{M} r²_{t,i}

r_{t,i}: 일중 i번째 구간의 로그수익률
M:       일중 구간 수 (5분봉: M ≈ 78 for KRX 09:00-15:30)

RV는 적분 변동성(Integrated Volatility)의 일치 추정량(consistent estimator):
plim_{M→∞} RV_t = IV_t = ∫₀¹ σ²_{t,s} ds

Barndorff-Nielsen & Shephard (2002)
```

**CheeseStock 일봉 근사:**

고빈도 데이터 없이 일봉만으로 RV를 근사해야 한다.
이 경우 제곱 로그수익률을 일별 RV 프록시로 사용한다.

```
RV_d(t) = r²_t                                  (1일 실현분산)
         = [ln(Close_t / Close_{t-1})]²

RV_w(t) = (1/5) × Σ_{i=0}^{4} r²_{t-i}         (5일 평균 실현분산)

RV_m(t) = (1/M) × Σ_{i=0}^{M-1} r²_{t-i}        (M일 평균 실현분산)

KRX 캘린더 보정:
  M = 21 (KRX 월간 영업일 수, 22가 아님)
  KRX 연간 영업일: ~250일 (미국 252일과 상이)
  연환산 계수: √250 (√252가 아님)
  사유: KRX 공휴일(설날, 추석, 한글날 등)로 미국 대비 연간 2-3일 적음.
  Corsi (2009) 원논문은 미국 시장 기준(M=22, √252)이므로
  KRX 적용 시 반드시 보정해야 한다.

한계: 일봉 기반 RV는 일중 변동성을 과소 추정
     Parkinson (1980) estimator로 개선 가능:
     RV^P_t = [ln(High_t / Low_t)]² / (4 × ln(2))

CheeseStock은 현재 close-to-close 방식을 사용한다.
Parkinson 확장은 향후 과제로 남겨둔다.
```

### 3.3 HAR-RV 예측 모형

**기본 모형 (Corsi 2009):**

```
RV_{t+1} = β₀ + β_d · RV_d(t) + β_w · RV_w(t) + β_m · RV_m(t) + ε_{t+1}

β₀:  절편 (intercept)
β_d: 일별 실현분산 계수 — 단기 반응
β_w: 주간 실현분산 계수 — 중기 관성
β_m: 월간 실현분산 계수 — 장기 평균회귀

ε_{t+1}: 예측 오차 (잔차)
```

**OLS 추정:**

```
행렬 표기: y = Xβ + ε

y = [RV_d(M+1), RV_d(M+2), ..., RV_d(T)]'     (n×1)
X = [1, RV_d(t), RV_w(t), RV_m(t)]_{t=M..T-1}  (n×4)

β̂ = (X'X)^{-1} X'y

정규방정식:
  ┌ Σ1     ΣRV_d   ΣRV_w   ΣRV_m   ┐   ┌β₀┐   ┌ Σy      ┐
  │ ΣRV_d  ΣRV²_d  ΣRV_d·w ΣRV_d·m │   │β_d│   │ ΣRV_d·y │
  │ ΣRV_w  ΣRV_d·w ΣRV²_w  ΣRV_w·m │ × │β_w│ = │ ΣRV_w·y │
  └ ΣRV_m  ΣRV_d·m ΣRV_w·m ΣRV²_m  ┘   └β_m┘   └ ΣRV_m·y ┘

4×4 연립방정식 → Gauss-Jordan 역행렬로 해석
```

**전형적 추정 결과 (문헌 보고값):**

```
Corsi (2009), S&P 500, 1990-2005:
  β₀ ≈ 0.02 × 10^{-4}
  β_d ≈ 0.36      (단기 충격 반영)
  β_w ≈ 0.28      (중기 관성)
  β_m ≈ 0.32      (장기 평균회귀)

KOSPI200 (예상, 일봉 기반):
  β_d ≈ 0.20-0.40
  β_w ≈ 0.20-0.35
  β_m ≈ 0.25-0.40

특성: β_d + β_w + β_m ≈ 0.8-1.0
     → 합이 1에 가까울수록 변동성 지속성(persistence)이 높음
     → 합 > 1이면 변동성 폭발(explosive), 합 < 0.8이면 빠른 평균회귀
```

### 3.4 HAR-RV 확장 모형

기본 HAR-RV에 비대칭성과 점프를 추가한 확장 모형이 존재한다.

**HAR-RV-J (점프 포함, Andersen, Bollerslev & Diebold 2007):**

```
RV_{t+1} = β₀ + β_d·RV_d + β_w·RV_w + β_m·RV_m + β_J·J_t + ε_{t+1}

J_t = max(RV_t - BV_t, 0)  (점프 변동성)
BV_t: 이중 제곱 변동성 (Bipower Variation)
    = (π/2) × Σ |r_{t,i}| × |r_{t,i-1}|
    (주: 유한 표본 보정 M/(M-1) 생략 — 고빈도(M ≫ 1) 점근 근사 기준. 일별 데이터에서는 M/(M-1) 보정이 필요할 수 있음.)

β_J는 보통 음수: 점프 발생 후 변동성이 빠르게 소멸
→ 점프는 연속 변동성과 다른 동역학을 가짐
```

**HAR-RV-CJ (연속+점프 분리, Corsi, Pirino & Reno 2010):**

```
RV_{t+1} = β₀ + β_Cd·C_d + β_Cw·C_w + β_Cm·C_m
              + β_Jd·J_d + β_Jw·J_w + β_Jm·J_m + ε

C_t = BV_t (연속 성분)
J_t = max(RV_t - BV_t, 0) (점프 성분)
```

**HAR-RV-SJ (부호별 점프, Patton & Sheppard 2015):**

```
RV_{t+1} = β₀ + ... + β_J+·J_t^+ + β_J-·J_t^- + ε

J^+: 양의 점프 (급등) → β_J+ > 0 (미래 변동성 증가)
J^-: 음의 점프 (급락) → β_J- < 0 (미래 변동성 더 크게 증가)
→ 비대칭성: |β_J-| > |β_J+| (레버리지 효과)
(주: J⁻는 음의 점프의 절대 크기로 정의하므로 β_J⁻ > 0이면 음의 점프가
미래 변동성을 증가시킴. 기호 정의에 따라 부호 해석이 달라짐.)
```

**CheeseStock 현재 구현:** 기본 HAR-RV만 구현 (확장 모형은 향후 과제).
고빈도 데이터 없이 Bipower Variation 산출이 불안정하므로,
확장 모형은 인트라데이 데이터(5m/1m) 도입 시 검토한다.

### 3.5 `IndicatorCache.harRV()` 구현 매핑

CheeseStock의 HAR-RV 구현은 `indicators.js`의 `IndicatorCache.harRV(idx)`에 있다.

**알고리즘 상세:**

```
입력: candles 배열 (OHLCV)
상수: D=1, W=5, M=22, MIN_FIT=60
최소 데이터: M + MIN_FIT = 82봉

Step 1: 로그수익률 제곱 산출
  r²[i] = [ln(close[i] / close[i-1])]²     for i = 1..N-1

Step 2: RV 성분 산출 (i = M..N-1)
  RV_d[i] = r²[i]                           (일별 실현분산)
  RV_w[i] = mean(r²[i-4..i])                (5일 평균, 최소 3일 유효)
  RV_m[i] = mean(r²[i-21..i])               (22일 평균, 최소 10일 유효)

Step 3: Rolling OLS (i = MIN_BARS..N-1)
  피팅 윈도우: [i-60, i-1]
  y[t] = RV_d[t+1],  X[t] = [1, RV_d[t], RV_w[t], RV_m[t]]
  최소 30개 유효 관측 필요

Step 4: 4×4 정규방정식 해석
  X'X (대칭 행렬) 구성
  Gauss-Jordan 역행렬 (피벗 선택 포함, 특이 행렬 방어)

Step 5: 예측
  RV_hat = β₀ + β₁·RV_d[i] + β₂·RV_w[i] + β₃·RV_m[i]
  if RV_hat < 0 → RV_hat = 0  (비음 분산 가드)

Step 6: 연환산
  HAR_RV_ann = √(RV_hat × 252) × 100  (%)

반환: { harRV: HAR_RV_ann, rv_d: RV_d[i], rv_w: RV_w[i], rv_m: RV_m[i] }
```

**독립 래퍼 함수:**

```javascript
// indicators.js (line ~2022)
function calcHAR_RV(candles) {
  if (!candles || candles.length === 0) return [];
  const cache = new IndicatorCache(candles);
  return candles.map((_, i) => cache.harRV(i));
}
```

### 3.6 HAR-RV 예측 성능과 벤치마크

HAR-RV의 표본 외(out-of-sample) 예측 성능 비교:

```
변동성 예측 모형 비교 (문헌 기반, 일별 RV 예측, 1일 앞):

| 모형          | RMSE(×10⁴) | MAE(×10⁴) | QLIKE | R²_OOS |
|---------------|------------|-----------|-------|--------|
| GARCH(1,1)    | 5.82       | 3.14      | 0.742 | 0.22   |
| EWMA(λ=0.94)  | 5.45       | 2.98      | 0.721 | 0.28   |
| HAR-RV        | 4.38       | 2.31      | 0.683 | 0.43   |
| HAR-RV-J      | 4.12       | 2.18      | 0.671 | 0.47   |
| HAR-RV-CJ     | 4.05       | 2.12      | 0.665 | 0.49   |

QLIKE: Quasi-Likelihood loss — 변동성 예측의 표준 손실함수
  QLIKE = (1/T) Σ [RV_t / σ̂²_t - ln(RV_t / σ̂²_t) - 1]

→ HAR-RV는 GARCH/EWMA 대비 ~50% R² 개선
→ 점프 확장(HAR-RV-J, CJ)은 추가 5-15% 개선
```

**CheeseStock 실용 성능 (일봉 기반):**

```
일봉 기반 HAR-RV는 고빈도 기반 대비 성능이 저하된다:
  R²_OOS(일봉) ≈ 0.25-0.35  vs  R²_OOS(5분봉) ≈ 0.43

이유:
  1. 일별 RV = r² (단일 관측) → 잡음이 크다
  2. 일중 변동 정보 손실 → close-to-close 편향
  3. KRX 야간 갭(overnight gap)이 RV_d를 왜곡

보완:
  - Parkinson 추정량으로 일중 변동 일부 복구 (High/Low 활용)
  - RV_w, RV_m의 평활화 효과로 개별 RV_d 잡음 완화
  - MIN_FIT=60은 OLS 안정성과 적시성(timeliness) 간 균형
```

### 3.7 HAR-RV의 금융공학적 해석

```
HAR-RV 계수의 경제학적 의미:

β_d (단기):
  → 뉴스 충격에 대한 즉각적 반응 강도
  → β_d가 높은 종목: 뉴스 민감, 일중 변동 큼
  → 테마주, 소형주에서 β_d > 0.40 빈출

β_w (중기):
  → 기술적 분석 패턴이 작동하는 시계
  → β_w가 높은 종목: 기관 참여도 높음
  → KOSPI200 대형주에서 β_w > 0.30 빈출

β_m (장기):
  → 변동성의 구조적 수준 (regime level)
  → β_m이 높은 종목: 변동성 지속성 강, 레짐 전환 느림
  → 업종 대표주, 시가총액 상위에서 β_m > 0.35 빈출

패턴 신뢰도 연결:
  HAR_RV_ann > EWMA_vol_ann × 1.3:
    → 변동성 상승 예상 → 방향성 패턴 신뢰도 하향 -10%
  HAR_RV_ann < EWMA_vol_ann × 0.7:
    → 변동성 하강 예상 → 평균 회귀 패턴 신뢰도 상향 +5%
```

---

## 4. Merton 점프-확산 모형 (1976)

### 4.1 이론적 배경

Black-Scholes 모형은 주가가 기하 브라운 운동(GBM)을 따른다고 가정한다:

```
BSM:  dS/S = μdt + σdW

μ: 기대수익률 (드리프트)
σ: 변동성 (확산 계수)
W: 위너 과정 (표준 브라운 운동)
```

Merton (1976)은 이 연속적 모형에 불연속적 점프 성분을 추가했다:

```
Merton Jump-Diffusion:
  dS/S = (μ - λk̄)dt + σdW + JdN(λ)

λ:    Poisson process의 강도 (연간 점프 빈도)
N(λ): Poisson counting process (단위 시간당 평균 λ회 점프)
J:    점프 크기 (확률변수)
k̄:    E[J-1] = 점프의 기대 상대 변화
      (드리프트 보정: 점프가 포함된 총 기대수익률을 μ로 유지)
```

**점프 크기의 분포:**

```
Merton (1976)의 원래 가정:
  ln(1 + J) ~ N(μ_J, σ²_J)

μ_J: 점프 크기의 로그 평균
σ_J: 점프 크기의 로그 표준편차

점프의 기대 상대 변화:
  k̄ = E[J] = exp(μ_J + σ²_J/2) - 1
```

**점프 모형이 필요한 이유:**

```
1. 수익률 분포의 첨도(kurtosis):
   정규분포: κ = 3
   실제 관측: κ = 5-15 (fat tails)
   → 점프가 초과 첨도의 주요 원인

2. 변동성 미소(volatility smile):
   BSM → 모든 행사가에서 동일한 IV
   점프 모형 → OTM 옵션에서 높은 IV
   → 점프 위험 프리미엄이 스마일을 생성

3. 단기 옵션 가격:
   BSM → 만기 1주 이하 ATM 옵션을 저평가
   점프 모형 → 단기 점프 리스크를 반영하여 적정 가격 산출
```

### 4.2 점프 감지 알고리즘

CheeseStock은 ATR 기반 임계값으로 점프를 감지한다.

**이론적 근거 — Barndorff-Nielsen & Shephard (2006):**

```
비모수적 점프 검정:

z_t = |r_t| / σ̂_t

σ̂_t: 국소 변동성 추정치 (ATR 기반)

점프 판정: z_t > c_α  (c_α = 임계값)

정규분포 하에서:
  P(z > 3) ≈ 0.0027 (99.73% 신뢰수준)
  → 3σ 초과 수익률은 점프로 간주
```

**CheeseStock ATR 기반 점프 감지:**

```
임계값: |r_t| > JUMP_ATR_MULTIPLIER × ATR_return(t)

r_t:                  로그수익률 = ln(Close_t / Close_{t-1})
ATR_return(t):        수익률의 Wilder ATR (14기간)
JUMP_ATR_MULTIPLIER:  3.0 (상수 #123)

ATR_return(t) 산출:
  |r_t|의 Wilder 방식 이동평균:
  ATR_ret(t) = [ATR_ret(t-1) × (14-1) + |r_t|] / 14

초기값: 첫 14개 |r_t|의 단순평균
```

**왜 ATR 기반인가 (고정 σ 대비 장점):**

```
고정 σ 기반 (예: 3σ):
  → σ가 일정하다고 가정 → 변동성 클러스터링 무시
  → 고변동성 국면에서 과다 점프 감지 (위양성)
  → 저변동성 국면에서 과소 감지 (위음성)

ATR 기반:
  → ATR이 자동으로 변동성 수준에 적응
  → 고변동성 시 임계값 상향 → 위양성 감소
  → 저변동성 시 임계값 하향 → 감도 유지
  → project 원칙 "No magic numbers, ATR-based dynamic thresholds" 준수
```

### 4.3 점프 강도 추정 — `IndicatorCache.jumpIntensity()`

**알고리즘 상세:**

```
입력: candles, lookback (기본 252 = ~1년)
최소 시작 인덱스: atrPeriod + 1 = 15

Step 1: 로그수익률 산출
  logReturns[i] = ln(close[i] / close[i-1])

Step 2: |r_t|의 Wilder ATR (14기간)
  atrReturns[i] = Wilder smoothing of |logReturns[i]|

Step 3: 점프 판정
  threshold[i] = JUMP_MULT(=3) × atrReturns[i]
  isJump[i] = |logReturns[i]| > threshold[i]

Step 4: 롤링 점프 카운트
  windowStart = max(minStart, i - lookback + 1)
  jumpCount = Σ isJump[j]  for j ∈ [windowStart, i]

Step 5: 연율화 점프 빈도 (λ)
  λ = (jumpCount / windowLen) × 252

반환: { lambda, isJump, jumpCount }
```

**독립 래퍼 함수:**

```javascript
// indicators.js (line ~2011)
function calcJumpIntensity(candles, lookback = 252) {
  if (!candles || candles.length === 0) return [];
  const cache = new IndicatorCache(candles);
  return candles.map((_, i) => cache.jumpIntensity(i, lookback));
}
```

### 4.4 점프 강도의 경제학적 해석

```
λ (연율화 점프 빈도) 해석:

λ = 0:     점프 없음 → 순수 GBM 근사 유효
λ < 2:     저빈도 점프 → 정상 시장, BSM 적합
λ = 2-4:   중빈도 점프 → 주의 구간, 패턴 신뢰도 유지
λ > 4:     고빈도 점프 → 패턴 신뢰도 × 0.85 (26번 §2.3 경계 레짐과 유사)
λ > 10:    극단 점프 레짐 → 패턴 분석 의미 없음 (위기 국면)
```

**KRX 특수 사항 — 가격제한폭(±30%)과 점프 감지:**

```
KRX 가격제한폭: ±30% (2015.06 확대, 이전 ±15%)
가격제한에 걸린 수익률: |r_t| = ln(1.30) ≈ 0.263 또는 ln(0.70) ≈ -0.357

문제:
  1. 점프 truncation: 실제 점프 크기가 ±30% 초과여도 관측 불가
     → 점프 크기(J) 분포의 우측이 절단됨
     → λ 추정은 영향 적음 (빈도는 관측 가능), 점프 크기 추정은 하향 편향

  2. 연속 한도 도달 (2일 연속 상/하한):
     → |r_total| > 30% 가능 (복리)
     → 개별 일의 점프로 감지되나 총 점프 크기는 과소 추정

  3. 장 중 가격제한 도달 후 거래 정지 유사 효과:
     → 거래량 급감, 호가 스프레드 확대
     → 다음 날 갭으로 이연된 점프 가능

KRX에서 λ > 8은 대부분 다음 이벤트에 기인:
  - 지정학적 충격 (계엄, 탄핵, 북한 미사일)
  - 기업 고유 이슈 (상장폐지 결정, 분식회계 적발)
  - COVID-19급 글로벌 팬데믹

20_krx_structural_anomalies.md §2 참조.
```

### 4.5 점프-확산과 옵션 가격

Merton (1976) 점프-확산 모형의 옵션 가격:

```
C_Merton = Σ_{n=0}^{∞} [e^{-λ'T} (λ'T)^n / n!] × C_BSM(σ_n, r_n)

λ' = λ(1 + k̄)
σ²_n = σ² + nσ²_J / T
r_n = r - λk̄ + n·ln(1+k̄) / T

해석: 점프가 0, 1, 2, ... n번 발생할 확률(Poisson)로 가중한
     BSM 가격의 무한 급수

실용: n=0..10 정도로 truncate해도 충분한 정밀도
```

이 가격 공식은 CheeseStock에서 직접 구현하지 않지만,
점프 강도 λ가 높은 종목에서 왜 옵션 IV가 BSM 기반보다 높은지를 설명한다.
VKOSPI가 BSM 가정 대비 높게 유지되는 구조적 원인 중 하나가 점프 위험 프리미엄이다.

---

## 5. 변동성 기간구조 (Volatility Term Structure)

### 5.1 이론적 배경

변동성 기간구조(term structure)는 만기별 내재변동성의 관계이다.

```
IV_T: 만기 T의 내재변동성

정상 기간구조 (contango):
  IV_1M < IV_2M < IV_3M
  → 장기 불확실성 > 단기 불확실성
  → 정상적 시장, 시간 프리미엄 존재

역전 기간구조 (backwardation):
  IV_1M > IV_2M > IV_3M
  → 단기 불확실성 > 장기 불확실성
  → 즉각적 공포, 위기 신호
```

**수학적 모형 — Derman (1999):**

```
변동성 기간구조의 모수적 모형:

σ(T) = σ_∞ + (σ_0 - σ_∞) × e^{-κT}

σ_0:   초단기(instantaneous) 변동성
σ_∞:   장기(asymptotic) 변동성
κ:     평균회귀 속도 (mean-reversion speed)

κ > 0: 정상 (σ_0 < σ_∞ → contango)
κ > 0이면서 σ_0 > σ_∞: backwardation (위기 시)
```

### 5.2 VKOSPI 기간구조 프록시

VKOSPI는 30일 IV를 산출하지만, 근월물(1M)과 차월물(2M)의 개별 IV를
계산 과정에서 추출할 수 있다.

```
cv_ratio = IV_1M / IV_2M

cv_ratio ≈ 1.00-1.05:  정상 (약한 contango)
cv_ratio > 1.15:        강한 contango (안일/과도한 장기 불안)
cv_ratio < 0.95:        약한 backwardation (단기 불안 시작)
cv_ratio < 0.90:        강한 backwardation (위기 국면)
```

**패턴 신뢰도 연동:**

```
cv_ratio > 1.00 (contango):
  → 정상 시장, 패턴 신뢰도 유지
  → 평균 회귀 패턴 효과적 (VRP 양수와 일치)

cv_ratio < 0.90 (강한 backwardation):
  → 위기 국면, 방향성 패턴 자동 차단 권장
  → 상수 #125 VOL_TERM_BACKWARDATION = 0.90
  → 패턴 신뢰도 × 0.85 (26번 §2.3 경계 레짐과 동시 적용 가능)

이중 조건:
  VKOSPI > 30 AND cv_ratio < 0.90:
    → 가장 강력한 위기 신호
    → 모든 방향성 패턴 비활성화 권장
```

### 5.3 개별 종목 기간구조 대리 (EWMA 기반)

개별 종목의 IV 기간구조는 직접 관측할 수 없다.
EWMA 변동성의 다중 반감기 비율로 대리한다.

```
종목별 기간구조 프록시:

ts_ratio = σ_EWMA(λ=0.94, h≈11d) / σ_EWMA(λ=0.97, h≈23d)

ts_ratio > 1.1: 단기 vol > 장기 vol → 종목 수준 backwardation
                → 최근 급변 이벤트 존재, 패턴 노이즈 증가
ts_ratio < 0.9: 단기 vol < 장기 vol → 종목 수준 contango
                → 안정적, 패턴 신뢰도 높음

이 비율은 VRP 프록시(§2.4)의 역수와 방향이 같다:
  ts_ratio ≈ 1 / vrp_proxy (근사적으로)
```

---

## 6. 분산 트레이딩과 상관관계 레짐 (Dispersion Trading)

### 6.1 이론적 배경

분산 트레이딩(Dispersion Trading)은 지수와 구성 종목 간 변동성 관계를 이용한다.

```
임의의 지수 I = Σ w_i × S_i (가중 합)

σ²_I = Σ_i Σ_j w_i w_j ρ_ij σ_i σ_j

여기서 ρ_ij: 종목 i, j 간 상관계수

등가중 단순화 (N종목, 동일 분산 σ):
  σ²_I = σ² × [1/N + (1 - 1/N) × ρ̄]

ρ̄: 평균 상관계수
```

**내재 상관관계 (Implied Correlation):**

```
ρ̄_implied = [σ²_I,implied - Σ wᵢ² σ²_i,implied] / [Σᵢ Σ_{j≠i} wᵢ wⱼ σ_i,implied σ_j,implied]

σ²_I,implied:     지수 옵션의 내재분산 (VKOSPI²)
σ²_i,implied:     개별 종목 옵션의 내재분산

실용: σ_i,implied 데이터 부재 시 EWMA 분산으로 대용
```

### 6.2 상관관계와 패턴 신뢰도

상관관계 레짐이 개별 종목 패턴의 유효성에 미치는 영향:

```
높은 상관관계 (ρ̄ > 0.6):
  → 체계적 위험(systematic risk)이 지배
  → 개별 종목 패턴이 시장 방향에 종속
  → 패턴 신뢰도 하향 (개별 종목 고유 신호 약화)
  → "모든 배가 함께 오르내리는" 국면

낮은 상관관계 (ρ̄ < 0.3):
  → 고유위험(idiosyncratic risk)이 지배
  → 개별 종목 패턴의 독립적 유효성 증가
  → 패턴 신뢰도 상향
  → 종목 선택(stock selection) 알파가 큰 국면

중간 상관관계 (0.3 ≤ ρ̄ ≤ 0.6):
  → 표준 상태, 기본 신뢰도 유지
```

**KRX 상관관계 특성:**

```
KOSPI 평균 상관관계 (2015-2026, 60일 롤링):
  정상: ρ̄ ≈ 0.25-0.40
  위기: ρ̄ ≈ 0.60-0.85 (상관관계 1로 수렴)
  회복: ρ̄ ≈ 0.15-0.25 (분산 국면)

외국인 비중이 높은 대형주(005930, 000660 등):
  → 글로벌 시장과의 상관관계가 추가 (28번 §1-3 교차참조)
  → ρ(Samsung, S&P500) ≈ 0.45 (정상), ≈ 0.80 (위기)
```

### 6.3 CheeseStock 구현 경로

현재 CheeseStock은 개별 종목 수준의 분석에 집중하므로,
지수-종목 간 분산 트레이딩 신호는 구현하지 않는다.
그러나 향후 다음 경로로 도입 가능하다:

```
1. data/index.json에 KOSPI200 일별 수익률 포함 (download_ohlcv.py 확장)
2. 개별 종목-지수 상관관계 60일 롤링 산출
3. 상관관계 극단값에서 패턴 신뢰도 감산/가산
4. 23_apt_factor_model.md의 β와 연동 (β는 시장 민감도)
```

---

## 7. 감마 노출 (Gamma Exposure, GEX) 이론 심화

### 7.1 마켓 메이커 감마 헤지 메커니즘

26번 §6에서 GEX의 기본 개념을 소개했다. 여기서는 이론적 배경을 심화한다.

**마켓 메이커의 델타 헤지:**

```
마켓 메이커(MM)는 옵션 매매의 반대 포지션을 보유한다.
고객이 콜을 매수하면 MM은 콜을 매도(short gamma 포지션).

MM의 헤지:
  Δ_portfolio = 0 유지를 위해 기초자산을 매매

  주가 상승 시: 콜 매도자의 Δ 음수 증가 → 기초자산 매수로 헤지
  주가 하락 시: 콜 매도자의 Δ 음수 감소 → 기초자산 매도로 헤지

  → MM의 헤지 행위 = 추세에 반대 매매 (mean-reversion 유도)
  → 단, 이것은 positive GEX 일 때만 성립
```

**GEX 부호의 의미:**

```
GEX = Σ_all_strikes [OI_call(K) × Γ(K) × S × 100]
    - Σ_all_strikes [OI_put(K) × Γ(K) × S × 100]

(콜 OI × Γ의 합) - (풋 OI × Γ의 합)

Positive GEX (양의 감마 노출):
  → MM이 net short gamma 아님 (고객이 풋 더 많이 매수)
  → MM 헤지 = 추세 반대 매매
  → 시장 변동성 억제 (자동 안정화)
  → range-bound 패턴(double top/bottom) 유리

Negative GEX (음의 감마 노출):
  → MM이 net short gamma
  → MM 헤지 = 추세 강화 매매 (short gamma squeeze)
  → 시장 변동성 증폭 (자기강화 루프)
  → breakout 패턴(triangle, wedge) 유리
```

### 7.2 GEX Flip Level

```
GEX Flip Level: GEX = 0 이 되는 주가 수준

이 수준 위에서는 positive GEX, 아래에서는 negative GEX.

KOSPI200 기준: GEX flip level ≈ 기초자산 현재가 ± 3-5%
  → 지수가 flip level 아래로 하락하면 가속 하락 위험
  → 2020.03 COVID: flip level 하향 돌파 → 자기강화 매도
```

### 7.3 Charm (시간에 의한 감마 변화)

```
Charm = -∂Delta/∂T = -N'(d₁) × [2(r-q)T - d₂σ√T] / (2Tσ√T)
(정확한 closed-form은 Hull Ch.19 참조)

만기가 가까워질수록 ATM 감마가 급증:
  Γ(T→0) → ∞ at ATM

이 효과가 만기일 접근 시 감마 헤지 유동을 극대화시킨다.
KRX 옵션 만기(매월 2째 목요일)에 KOSPI200의 변동성이
당일 14:30-15:20에 급등하는 현상의 이론적 원인이다.

27번 §4.2 참조: 옵션 만기일 효과
```

---

## 8. 통합 신호 체계: VRP + HAR-RV + 점프

### 8.1 3-시그널 복합 프레임워크

```
┌──────────────────────────────────────────────────────────────┐
│                    변동성 복합 신호 체계                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [HAR-RV]          [VRP Proxy]         [Jump Intensity]      │
│  │                 │                    │                    │
│  │ RV 예측값       │ regime 분류        │ λ 추정             │
│  │ (harRV_ann%)    │ (risk-on/off)      │ (연율화 빈도)      │
│  │                 │                    │                    │
│  ├─── 비교 ────── EWMA vol ────── 비교 ─┤                    │
│  │                                      │                    │
│  │  HAR > EWMA×1.3                      │  λ > 4             │
│  │  → vol 상승 예상                      │  → 점프 레짐       │
│  │  → 방향성 신뢰도 -10%                │  → 전체 -15%       │
│  │                                      │                    │
│  │  HAR < EWMA×0.7                      │  λ < 2             │
│  │  → vol 하강 예상                      │  → 정상 레짐       │
│  │  → 평균회귀 신뢰도 +5%               │  → 기본값          │
│  │                                      │                    │
│  └──────────── Combined Score ──────────┘                    │
│                                                              │
│  Combined = base_confidence × vrp_mult × har_mult × jump_mult│
│                                                              │
│  vrp_mult:  calcVolRegime().multiplier (1.15 / 1.00 / 0.85) │
│  har_mult:  HAR/EWMA 비율 기반 (1.05 / 1.00 / 0.90)        │
│  jump_mult: λ 기반 (1.00 / 0.85 / 0.70)                    │
│                                                              │
│  최종 범위: 0.51 ~ 1.33  (0.85×0.90×0.70 ~ 1.15×1.05×1.05) │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 레짐 전이 매트릭스

```
변동성 레짐 간 전이 확률 (일별, KRX 경험적 추정):

현재\다음     risk-on    neutral    risk-off
risk-on       0.85       0.13       0.02
neutral       0.08       0.84       0.08
risk-off      0.03       0.17       0.80

특성:
  1. 높은 자기 지속성 (대각선 > 0.80)
  2. risk-off → neutral 전이가 neutral → risk-off보다 2배
     (위기 탈출이 위기 진입보다 빠름)
  3. risk-on → risk-off 직접 전이는 드물다 (0.02)
     (보통 neutral 경유)
```

### 8.3 복합 신호 해석 가이드

```
시나리오 1: VRP risk-on + HAR < EWMA + λ < 2
  해석: "안정적 변동성 감소 국면"
  패턴: 추세 추종, 삼각형 수렴, 브레이크아웃 대기
  신뢰도: × 1.05 × 1.05 × 1.00 = × 1.10

시나리오 2: VRP risk-off + HAR > EWMA × 1.3 + λ > 4
  해석: "변동성 폭풍 국면"
  패턴: 대부분 무효화, 극단 역전만 제한적 유효
  신뢰도: × 0.95 × 0.90 × 0.85 = × 0.73

시나리오 3: VRP neutral + HAR ≈ EWMA + λ 2-4
  해석: "표준 시장"
  패턴: 전체 패턴 시스템 정상 작동
  신뢰도: × 1.00 × 1.00 × 1.00 = × 1.00

시나리오 4: VRP risk-on + λ > 8
  해석: "모순 신호 — 장기는 안정이나 점프 발생"
  패턴: 점프가 VRP를 override
  신뢰도: × 1.05 × 1.00 × 0.70 = × 0.74
  주의: VRP 프록시가 점프에 후행할 수 있음
```

---

## 9. Student-t 신뢰구간과 변동성 추정

### 9.1 왜 정규분포가 아닌 Student-t인가

금융 수익률은 정규분포보다 두꺼운 꼬리(fat tails)를 가진다.
이는 §4에서 논의한 점프의 존재, 변동성 클러스터링,
레버리지 효과 등에 기인한다.

```
정규분포 가정 시 신뢰구간:
  CI_95 = μ̂ ± 1.96 × σ̂/√n

문제: 꼬리 확률을 과소 추정
  P(|r| > 3σ | Normal) = 0.0027
  P(|r| > 3σ | 실제)    ≈ 0.01-0.03  (3-10배 과소)

Student-t 보정:
  CI_95 = μ̂ ± t_{0.025, ν} × σ̂/√n

ν: 자유도 (degrees of freedom)
  ν=∞: 정규분포와 동일
  ν=5: 금융 수익률에 일반적으로 적합
  ν=3: KRX 소형주, 테마주에 적합 (더 두꺼운 꼬리)

t_{0.025, 5} = 2.571  (vs z_{0.025} = 1.960)
→ Student-t 95% CI가 정규분포 대비 31% 더 넓음
```

### 9.2 자유도 추정

```
Maximum Likelihood:
  L(ν | r₁,...,r_n) = Π f_t(r_i; ν)

f_t(x; ν) = [Γ((ν+1)/2) / (Γ(ν/2)√(νπ))] × [1 + x²/ν]^{-(ν+1)/2}

실용 근사 (Hill estimator 기반):
  ν̂ ≈ 1 / ξ̂,  ξ̂ = Hill tail index (indicators.js hillEstimator)
  → IndicatorCache.hill(k).alpha 활용

KOSPI200 대형주: ν̂ ≈ 4-7
KOSDAQ 소형주:   ν̂ ≈ 2.5-4
```

### 9.3 EWMA + Student-t 복합 신뢰구간

```
변동성 적응적 신뢰구간:

CI_95(t) = μ̂_t ± t_{0.025, ν̂} × σ_EWMA(t)

μ̂_t:        단기 평균 수익률 추정 (EWMA 또는 0)
σ_EWMA(t):   calcEWMAVol(closes, λ) [i]
ν̂:          hill().alpha 기반 자유도

이 신뢰구간이 HAR-RV 예측의 불확실성 정량화에 사용된다:
  HAR_RV_ann ± t_{0.025, ν̂} × SE(HAR_RV)

SE(HAR_RV): OLS 표준오차 (잔차 분산으로부터 도출)
```

---

## 10. 변동성 리스크 프리미엄의 수확 전략 (Volatility Harvesting)

### 10.1 변동성 매도 전략의 이론

VRP가 체계적으로 양수라면, 이를 수확(harvest)하는 전략이 존재한다.

```
기본 전략: 옵션 매도 (short volatility)
  → IV > RV를 이용하여 시간가치 수취

위험: 꼬리위험(tail risk) — VRP가 음수로 반전될 때 대형 손실

Ilmanen (2011) "Expected Returns":
  변동성 매도 전략의 장기 샤프 비율 ≈ 0.3-0.5
  그러나 최대 손실(max drawdown)이 매우 큼 (~50% in 2008)
```

### 10.2 VRP와 주식 수익률의 관계 — CheeseStock 맥락

```
CheeseStock은 옵션 전략을 실행하지 않으나,
VRP 정보를 주식 패턴 분석에 활용한다:

1. VRP 양수 (risk-on):
   → 시장이 보험료를 과도하게 지불 중
   → 향후 리스크 해소 시 주가 상승 가능
   → 매수 패턴 신뢰도 +5% (vrp_mult = 1.05)

2. VRP 음수 (risk-off):
   → 실현 위험이 예상을 초과
   → 향후 추가 하락 가능
   → 매수 패턴 신뢰도 -5% (vrp_mult = 0.95)

이 로직은 Bollerslev et al. (2009)의 예측 회귀와
방향이 일치한다 (§2.2 참조).
```

---

## 11. CheeseStock 상수 매핑

### 11.1 관련 상수 레지스트리

22_learnable_constants_guide.md의 Master Registry에 등록된/등록 가능한 상수:

| # | Constant | Value | Tier | Learn | Range | Source |
|---|----------|-------|------|-------|-------|--------|
| 121 | VRP_RISK_ON_THRESHOLD | 1.20 | C | GCV | [1.05, 1.40] | §2.4 VRP 프록시 임계값 |
| 122 | VRP_RISK_OFF_THRESHOLD | 0.80 | C | GCV | [0.65, 0.95] | §2.4 VRP 프록시 임계값 |
| 123 | JUMP_ATR_MULTIPLIER | 3.0 | B | FIX | [2.5, 4.0] | §4.2 ATR 기반 점프 임계값 |
| 124 | HAR_MIN_TRAINING | 60 | B | FIX | [40, 100] | §3.5 OLS 최소 관측수 |
| 125 | VOL_TERM_BACKWARDATION | 0.90 | C | GCV | [0.85, 0.95] | §5.2 기간구조 역전 임계값 |
| 126 | HAR_VOL_UP_MULT | 1.30 | C | GCV | [1.10, 1.50] | §3.7 HAR/EWMA 비율 상한 |
| 127 | HAR_VOL_DOWN_MULT | 0.70 | C | GCV | [0.50, 0.90] | §3.7 HAR/EWMA 비율 하한 |
| 128 | JUMP_HIGH_FREQ | 4.0 | C | GCV | [3.0, 6.0] | §4.4 고빈도 점프 임계값 |
| 129 | JUMP_EXTREME_FREQ | 10.0 | C | GCV | [8.0, 15.0] | §4.4 극단 점프 임계값 |

### 11.2 상수 tier 분류 근거

```
Tier B (FIX): JUMP_ATR_MULTIPLIER, HAR_MIN_TRAINING
  → 학술 문헌에서 확립된 값
  → JUMP_ATR_MULTIPLIER=3은 3σ 규칙의 직접 적용 (§4.2)
  → HAR_MIN_TRAINING=60은 OLS 안정성 최소 조건 (4 파라미터 × 15)
  → 데이터 기반 최적화가 과적합(overfitting) 위험

Tier C (GCV): VRP 임계값, HAR 비율, 점프 빈도 임계값
  → KRX 분포 특성에 의존하는 값
  → 시장 레짐에 따라 최적값이 변동
  → Generalized Cross-Validation으로 학습 가능
```

### 11.3 기존 상수와의 관계

```
VRP 관련:
  signalEngine.calcVolRegime()의 임계값 1.2, 0.8 (하드코딩)
  → #121, #122로 외부화 권장

점프 관련:
  jumpIntensity()의 JUMP_MULT = 3 (하드코딩, line ~1776)
  → #123으로 외부화 권장

HAR 관련:
  harRV()의 MIN_FIT = 60 (하드코딩, line ~1828)
  → #124로 외부화 권장

이 상수들은 현재 코드에 리터럴로 존재하며,
향후 calibrated_constants.json 또는 코드 내 상수 블록으로
통합할 때 참조한다.
```

---

## 12. 학술 참고문헌

1. Bollerslev, T., Tauchen, G., & Zhou, H. (2009). "Expected Stock Returns and Variance Risk Premia." *Review of Financial Studies*, 22(11), 4463-4492.

2. Corsi, F. (2009). "A Simple Approximate Long-Memory Model of Realized Volatility." *Journal of Financial Econometrics*, 7(2), 174-196.

3. Merton, R.C. (1976). "Option Pricing When Underlying Stock Returns Are Discontinuous." *Journal of Financial Economics*, 3(1-2), 125-144.

4. Andersen, T.G., Bollerslev, T., Diebold, F.X., & Labys, P. (2003). "Modeling and Forecasting Realized Volatility." *Econometrica*, 71(2), 579-625.

5. Barndorff-Nielsen, O.E., & Shephard, N. (2002). "Econometric Analysis of Realized Volatility and Its Use in Estimating Stochastic Volatility Models." *Journal of the Royal Statistical Society: Series B*, 64(2), 253-280.

6. Barndorff-Nielsen, O.E., & Shephard, N. (2006). "Econometrics of Testing for Jumps in Financial Economics Using Bipower Variation." *Journal of Financial Econometrics*, 4(1), 1-30.

7. Muller, U.A., Dacorogna, M.M., Dave, R.D., Olsen, R.B., Pictet, O.V., & von Weizsacker, J.E. (1997). "Volatilities of Different Time Resolutions — Analyzing the Dynamics of Market Components." *Journal of Empirical Finance*, 4(2-3), 213-239.

8. Bekaert, G., & Hoerova, M. (2014). "The VIX, the Variance Premium and Stock Market Volatility." *Journal of Econometrics*, 183(2), 181-192.

9. Patton, A.J., & Sheppard, K. (2015). "Good Volatility, Bad Volatility: Signed Jumps and the Persistence of Volatility." *Review of Economics and Statistics*, 97(3), 683-697.

10. Corsi, F., Pirino, D., & Reno, R. (2010). "Threshold Bipower Variation and the Impact of Jumps on Volatility Forecasting." *Journal of Econometrics*, 159(2), 276-288.

11. Andersen, T.G., Bollerslev, T., & Diebold, F.X. (2007). "Roughing It Up: Including Jump Components in the Measurement, Modeling, and Forecasting of Return Volatility." *Review of Economics and Statistics*, 89(4), 701-720.

12. Derman, E. (1999). "Regimes of Volatility: Some Observations on the Variation of S&P 500 Implied Volatilities." *Goldman Sachs Quantitative Strategies Research Notes*.

13. Parkinson, M. (1980). "The Extreme Value Method for Estimating the Variance of the Rate of Return." *Journal of Business*, 53(1), 61-65.

14. Ilmanen, A. (2011). *Expected Returns: An Investor's Guide to Harvesting Market Rewards.* Wiley.

15. J.P. Morgan / Reuters (1996). "RiskMetrics — Technical Document." 4th Edition.

16. Gatheral, J. (2006). *The Volatility Surface: A Practitioner's Guide.* Wiley.

17. KRX (2009). "VKOSPI 산출 방법론." 한국거래소 파생상품시장본부.

---

## 13. 문서 간 교차참조 (Cross-Reference Map)

| 이 문서 절 | 참조 문서 | 참조 절 | 내용 |
|-----------|----------|--------|------|
| §2.3 VKOSPI VRP | 26_options_volatility_signals.md | §2.3 | VKOSPI 정의, 역사적 범위, 레짐 분류 |
| §2.4 EWMA 변동성 | 05_finance_theory.md | §8 | EWMA 이론, λ=0.94 RiskMetrics 기본값 |
| §2.5 IV 부재 | 26_options_volatility_signals.md | §4.1 | KRX 개별 주식 옵션 85종 제약 |
| §3.1 이질적 시장 가설 | 18_behavioral_market_microstructure.md | §3 | 시장 참여자 이질성의 행동경제학적 근거 |
| §3.7 Hurst 지수 | 02_statistics.md | §2.3 | 장기 기억 과정, H > 0.5 특성 |
| §4.4 가격제한폭 | 20_krx_structural_anomalies.md | §2 | ±30% 제한, 점프 truncation 효과 |
| §5.2 기간구조 | 26_options_volatility_signals.md | §2.2 | 변동성 미소와 기간구조 기본 |
| §6.2 상관관계 | 28_cross_market_correlation.md | §1-3 | 글로벌-KRX 상관관계 전파 |
| §7.1 GEX | 26_options_volatility_signals.md | §6 | GEX 기본 개념, KRX 적용 |
| §7.3 만기일 효과 | 27_futures_basis_program_trading.md | §4.2 | 옵션 만기일(2째 목요일) 변동성 |
| §8.1 VRP 레짐 | signalEngine.js | line ~1887 | calcVolRegime() 구현 |
| §9.2 Hill estimator | indicators.js | hill().alpha | 꼬리 지수 산출 |
| §11.3 상수 외부화 | 22_learnable_constants_guide.md | Master Registry | 136+ 상수 통합 관리 |

---

## 14. 핵심 정리: 변동성 3대 이론과 CheeseStock 매핑

```
┌─────────────────────────────────────────────────────────────────────┐
│                  변동성 이론 → CheeseStock 매핑                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [이론]                    [구현]                    [신호]           │
│                                                                     │
│  VRP (Bollerslev 2009)     signalEngine              vrpRegime       │
│  IV - RV 스프레드          .calcVolRegime()          risk-on/off     │
│  ↓ 프록시                  EWMA(0.97)/EWMA(0.86)    mult: 0.85~1.15 │
│                                                                     │
│  HAR-RV (Corsi 2009)       IndicatorCache            harRV_ann (%)   │
│  RV_d + RV_w + RV_m        .harRV(idx)              rv_d, rv_w, rv_m│
│  ↓ OLS 예측                Rolling 60-bar OLS        비음 분산 가드  │
│                                                                     │
│  Jump-Diffusion (Merton)   IndicatorCache            lambda (연율화) │
│  Poisson + GBM             .jumpIntensity(idx)       isJump (bool)  │
│  ↓ ATR 임계값              3 × ATR_return             jumpCount      │
│                                                                     │
│  ┌───────────────────────────────────────┐                          │
│  │  패턴 신뢰도 = base × vrp × har × jump │                          │
│  │  범위: 0.57 ~ 1.16                    │                          │
│  └───────────────────────────────────────┘                          │
│                                                                     │
│  보조 이론:                                                          │
│  - Vol Term Structure: cv_ratio (§5)                                 │
│  - Dispersion/Correlation: ρ̄ (§6) — 미구현                          │
│  - GEX: 이론만 (§7) — KRX 데이터 제약                                │
│  - Student-t CI: EWMA + Hill tail (§9) — 구현 완료                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*본 문서는 CheeseStock 프로젝트의 변동성 신호 체계의 이론적 기반을 제공한다.*
*Doc 26(옵션/VKOSPI)과 Doc 27(선물/베이시스)의 변동성 분석을 심화·확장하며,*
*VRP, HAR-RV, 점프 이론이 개별 종목 패턴 분석에 어떻게 매핑되는지를 명시한다.*
*모든 상수는 22번 문서의 Master Registry와 동기화되어야 한다.*
