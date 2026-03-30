# Doc 35: 채권시장 신호와 수익률 곡선 분석 (Bond Market Signals & Yield Curve Analytics)

> "수익률 곡선은 경제의 미래에 대한 채권시장의 투표 결과이다."
> "The yield curve is the bond market's vote on the future of the economy."
> -- Campbell Harvey, *Journal of Financial Economics* (1988)

---

## 1. 개요

본 문서는 채권시장에서 발생하는 신호를 주식 패턴 분석에 활용하는
이론적 기반을 제공한다. 채권-주식 교차분석(cross-asset analysis)은
단일 자산군 기술적 분석의 한계를 보완하는 핵심 경로이다.

다루는 영역은 6가지이다:

```
1. NSS 수익률 곡선 모형   → Level/Slope/Curvature 분해
2. 수익률 곡선 기울기      → 경기 선행 6-12개월, 역전 시그널
3. Fed/BOK Model          → Yield Gap = 주식 기대수익률 - 채권수익률
4. 크레딧 스프레드         → AA-/BBB- 스프레드 체제 분류
5. Merton 구조적 모형      → Distance-to-Default (개별 종목)
6. 금리 민감도 섹터 분석   → 섹터별 Rate Beta
```

**기존 문서와의 관계:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| 거시경제 금리 | 29번 §3.1 | NSS 모형, 수익률 곡선 형태 분류 |
| IS-LM 금리 채널 | 30번 §1-2 | 실물 채권수익률과의 매핑 |
| VKOSPI-크레딧 관계 | 26번 §2.3 | 크레딧 스프레드 체제 4분류 |
| VRP 리스크 레짐 | 34번 §2 | 채권-주식 상관관계 레짐 전환 |
| CAPM 무위험이자율 | 25번 §1.3 | KTB 수익률 기간구조 |
| 재무제표 부채비율 | 14번 §2 | Merton DD 구조적 활용 |

**CheeseStock 구현 경로:**

```
[데이터 수집]                    [분석]                    [신호 출력]
KOFIA NSS params (daily)    →   Level/Slope/Curvature  →  yieldCurveRegime
KOFIA AA-/BBB- 민평금리     →   크레딧 스프레드 체제    →  creditRegime
ECOS KTB10Y + DART PER      →   Yield Gap              →  yieldGapSignal
DART 재무 + ATR              →   Distance-to-Default    →  ddWarning
                                                           ↓
                                                    패턴 신뢰도 조정
```

---

## 2. NSS 수익률 곡선 모형 (Nelson-Siegel-Svensson)

### 2.1 이론적 기초

수익률 곡선(yield curve)은 만기(maturity)에 따른 채권수익률의 함수이다.
Nelson & Siegel (1987)이 3-요인 모형을, Svensson (1994)이 4-요인 확장을 제안했다.

**Nelson-Siegel (1987) 3-요인 모형:**

```
y(tau) = beta_1 + beta_2 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1)]
                + beta_3 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1) - e^(-tau/lambda_1)]
```

**Svensson (1994) 4-요인 확장:**

```
y(tau) = beta_1
       + beta_2 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1)]
       + beta_3 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1) - e^(-tau/lambda_1)]
       + beta_4 * [(1 - e^(-tau/lambda_2)) / (tau/lambda_2) - e^(-tau/lambda_2)]

where:
  y(tau) = 만기 tau년의 연속복리 수익률 (continuously compounded yield)
  beta_1 = Level factor (장기 수준, long-run level)
  beta_2 = Slope factor (기울기, short-term component)
  beta_3 = Curvature factor (곡률, medium-term hump)
  beta_4 = 2nd Curvature factor (추가 곡률, Svensson 확장)
  lambda_1, lambda_2 = 감쇠 매개변수 (decay parameters)
```

### 2.2 Level/Slope/Curvature 분해

NSS 파라미터는 경제적으로 해석 가능한 3대 요인에 매핑된다:

```
┌─────────────────────────────────────────────────────────────┐
│  Factor    │  NSS Param  │  경제적 의미                      │
├─────────────────────────────────────────────────────────────┤
│  Level     │  beta_1     │  장기 기대 인플레이션 + 실질 균형금리 │
│            │             │  lim tau→∞ y(tau) = beta_1          │
│            │             │  한국: 2.5~4.5% (2020-2026)        │
├─────────────────────────────────────────────────────────────┤
│  Slope     │  beta_2     │  통화정책 스탠스 (긴축/완화)        │
│            │             │  y(0) = beta_1 + beta_2             │
│            │             │  beta_2 < 0 → 정상 기울기 (장>단)   │
│            │             │  beta_2 > 0 → 역전 (단>장)          │
├─────────────────────────────────────────────────────────────┤
│  Curvature │  beta_3     │  중기 경기 기대, 정책 불확실성       │
│            │             │  humped curve의 높이 결정            │
│            │             │  |beta_3| 증가 = 불확실성 확대       │
└─────────────────────────────────────────────────────────────┘
```

Diebold & Li (2006)의 실증 결과:

```
Level    ↔  inflation expectations           (r ~ 0.97 with 10Y Survey)
Slope    ↔  monetary policy stance           (r ~ 0.92 with policy rate)
Curvature ↔ economic uncertainty             (r ~ 0.85 with PMI dispersion)
```

### 2.3 KOFIA 데이터와 CheeseStock 매핑

금융투자협회(KOFIA) 채권정보센터는 국고채 NSS 파라미터를 일별로 공시한다.

**데이터 소스:**

```
URL: https://www.kofiabond.or.kr
공시 항목: beta_1, beta_2, beta_3, beta_4, lambda_1, lambda_2 (매일 16시 이후)
무료 접근: 회원가입 없이 열람 가능 (API는 별도 신청)

대안: 한국은행 ECOS API
  - 통계코드: 060Y001 (국고채 수익률, 만기별)
  - KTB 1Y, 2Y, 3Y, 5Y, 10Y, 20Y, 30Y, 50Y 직접 수집 후
  - 자체 NSS fitting 가능 (비선형 최소자승법, scipy.optimize)
```

**download_bonds.py 매핑 설계:**

```python
# KOFIA 직접 제공 시 (파라미터 직접 사용)
bond_data = {
    "date": "2026-03-30",
    "nss": {
        "beta1": 3.45,    # Level
        "beta2": -0.82,   # Slope (negative = normal curve)
        "beta3": 0.34,    # Curvature
        "beta4": -0.12,   # 2nd Curvature
        "lambda1": 1.45,
        "lambda2": 3.20
    },
    "yields": {           # 개별 만기 수익률 (ECOS fallback)
        "1Y": 2.85,
        "3Y": 3.02,
        "5Y": 3.18,
        "10Y": 3.45,
        "20Y": 3.52,
        "30Y": 3.48
    }
}

# 출력: data/bond_market.json (daily append)
```

### 2.4 NSS 자체 피팅 (ECOS 데이터 사용 시)

KOFIA NSS 파라미터가 불가한 경우, 개별 만기 수익률로 직접 피팅한다.

```
Objective: min sum_k [y_observed(tau_k) - y_NSS(tau_k; beta, lambda)]^2

tau_k in {1, 2, 3, 5, 10, 20, 30, 50}  (8개 관측점)
Parameters: beta_1, beta_2, beta_3, beta_4, lambda_1, lambda_2  (6개)

비선형 최소자승법:
  - Levenberg-Marquardt (scipy.optimize.least_squares)
  - 초기값: beta_1 = y(30Y), beta_2 = y(1Y) - y(30Y),
            beta_3 = 2*y(5Y) - y(1Y) - y(30Y),
            lambda_1 = 1.5, lambda_2 = 3.0

수렴 조건: |residual| < 1bp (0.01%p)
```

---

## 3. 수익률 곡선 기울기와 주식시장

### 3.1 Slope 시그널의 경기 선행성

수익률 곡선 기울기(term spread)는 가장 검증된 경기 선행지표 중 하나이다.

**핵심 지표: 10Y-3Y 스프레드 (한국 기준)**

```
Spread_10Y3Y = y(10Y) - y(3Y)

해석:
  Spread > 0    → 정상(normal): 시장이 미래 성장과 금리 인상을 기대
  Spread ≈ 0    → 평탄(flat): 경기 정점 또는 불확실성 증대
  Spread < 0    → 역전(inverted): 경기 침체 선행 신호
```

Harvey (1988, 1989)의 원논문과 후속 연구 요약:

```
미국 실증 (1962-2025):
  - 10Y-2Y 역전 → 12-18개월 후 경기 침체 확률 ~70%
  - 10Y-3M 역전 → 더 높은 예측력 (~80%)
  - 위양성(false positive): 1966, 1998 (침체 없이 역전)

한국 실증 (2000-2025):
  - 10Y-3Y 역전 → 2008.Q2 (GFC), 2019.Q3 (코로나 전), 2022.Q4
  - 예측 시차: 평균 6-12개월 (미국 대비 단축)
  - 주의: 외국인 수급 왜곡으로 인한 위양성 빈도 미국 대비 높음
```

### 3.2 Bull/Bear Steepening/Flattening 체제

수익률 곡선 형태 변화는 금리 수준 변화와 결합하여 4가지 체제를 형성한다:

```
┌──────────────────────────────────────────────────────────┐
│              단기 금리 하락        단기 금리 상승          │
├──────────────────────────────────────────────────────────┤
│  장기-단기   │  Bull Steepening    │  Bear Steepening     │
│  스프레드 확대 │  (금리 인하 기대)   │  (인플레 기대 상승)  │
│             │  → 주식 긍정적       │  → 혼합 (초기 부정적) │
├──────────────────────────────────────────────────────────┤
│  장기-단기   │  Bull Flattening    │  Bear Flattening     │
│  스프레드 축소 │  (경기 둔화 기대)   │  (긴축 정책)         │
│             │  → 방어적 포지션     │  → 주식 부정적        │
└──────────────────────────────────────────────────────────┘
```

CheeseStock 매핑:

```
yieldCurveRegime 판정:

delta_short = y(3Y,t) - y(3Y,t-20)    # 20영업일 변화 (약 1개월)
delta_spread = Spread_10Y3Y,t - Spread_10Y3Y,t-20

if delta_short < 0 and delta_spread > 0:  return 'bull_steep'     # 가장 긍정적
if delta_short > 0 and delta_spread > 0:  return 'bear_steep'     # 혼합
if delta_short < 0 and delta_spread < 0:  return 'bull_flat'      # 방어적
if delta_short > 0 and delta_spread < 0:  return 'bear_flat'      # 가장 부정적
```

### 3.3 한국 수익률 곡선 역전의 주식시장 영향

2000-2025년 KRX 실증 분석:

```
10Y-3Y 역전 에피소드:

Episode 1: 2006.11 ~ 2007.08 (9개월)
  → KOSPI: +25% (역전 중 상승 지속)
  → 이후: 2008 GFC에서 -55%
  → 선행 시차: ~12개월

Episode 2: 2019.07 ~ 2019.10 (4개월)
  → KOSPI: -3% (역전 중)
  → 이후: 2020 코로나 -35% (5개월 후)
  → 선행 시차: ~6개월

Episode 3: 2022.09 ~ 2023.03 (7개월)
  → KOSPI: +8% (역전 중 반등)
  → 이후: 2023년 제조업 경기 둔화
  → 선행 시차: ~9개월

핵심 관측:
  1. 역전 시작 직후 주식 매도는 조기 — 주가는 역전 중에도 상승 가능
  2. 역전 해소(re-steepening) 시점이 더 중요한 시그널
  3. 한국은 외국인 국채 수요로 인한 구조적 기울기 압축이 존재
```

### 3.4 패턴 신뢰도 조정

```
// yield curve regime → pattern confidence multiplier
function calcYCRegimeMultiplier(regime) {
    switch(regime) {
        case 'bull_steep':   return 1.05;   // 매수 패턴 보강
        case 'bear_steep':   return 1.00;   // 중립
        case 'bull_flat':    return 0.95;   // 약간 감쇠
        case 'bear_flat':    return 0.90;   // 매수 패턴 감쇠, 매도 패턴 보강
        case 'inverted':     return 0.85;   // 역전 시 매수 패턴 강한 감쇠
        default:             return 1.00;
    }
}

// 매도 패턴의 경우 역수 관계:
// inverted → 매도 패턴 multiplier = 2.0 - 0.85 = 1.15
```

---

## 4. Fed/BOK Model (Yield Gap)

### 4.1 이론적 기초

Fed Model (Yardeni 1997, Estrada 2006의 비판적 검토)은 주식시장의
기대수익률(earnings yield)과 채권수익률을 비교하여 상대적 밸류에이션을 판단한다.

```
Yield Gap = EY - y(10Y)

where:
  EY = Earnings Yield = 1/PER = E/P
  y(10Y) = 10년 국고채 수익률

해석:
  Gap > 0 → 주식이 채권 대비 저평가 (주식 선호)
  Gap < 0 → 주식이 채권 대비 고평가 (채권 선호)
  Gap ≈ 0 → 균형 상태
```

**학술적 배경과 한계:**

Fed Model은 학술적으로 논쟁이 있다. Asness (2003)의 비판:

```
비판 1: 화폐 환상 (money illusion)
  - 명목 EY와 명목 채권수익률 비교는 인플레이션 착시
  - 실질 EY vs 실질 금리 비교가 이론적으로 정확

비판 2: 성장률 무시
  - Gordon Growth: P/E = 1/(r-g), 따라서 E/P = r-g
  - EY에는 성장 기대(g)가 내포 → 채권과 직접 비교 불가

비판 3: Duration mismatch
  - 주식 = perpetual (무한 만기), 채권 = 유한 만기
  - 할인율 비교의 구조적 불일치

반론 (Bekaert & Engstrom 2010):
  - 비판에도 불구, 실증적 예측력은 유의미
  - 행동경제학적 근거: 투자자는 실제로 명목수익률을 비교
  - 한국 데이터에서 12M forward return 예측 R² ~ 0.12~0.18
```

### 4.2 한국 적용: BOK Model

```
한국 버전 (BOK Model):

Yield_Gap_KR = (1/PER_KOSPI) - KTB_10Y

where:
  PER_KOSPI = KOSPI 시장 평균 PER (또는 개별 종목 PER)
  KTB_10Y = 국고채 10년 수익률 (연율, 소수점)

예시 (2026-03):
  PER_KOSPI ≈ 12.5   →  EY = 1/12.5 = 0.080 = 8.0%
  KTB_10Y   ≈ 3.45%
  Yield_Gap = 8.0% - 3.45% = +4.55%
  → 주식이 채권 대비 양(+)의 프리미엄 → 주식 선호 영역
```

### 4.3 Yield Gap 체제 분류

```
Historical percentile 기반 분류 (한국 2005-2025):

  Gap > +5.0%     → VERY_CHEAP   (주식 극단적 저평가, 하위 10%)
  +3.0% < Gap     → CHEAP        (주식 저평가)
  +1.0% < Gap     → FAIR         (정상 범위)
  -1.0% < Gap     → EXPENSIVE    (주식 고평가)
  Gap < -1.0%     → VERY_EXPENSIVE (상위 10%)

주의: 구조적 변화 (structural break)
  2000-2010: Gap 평균 +4.0% (고금리 시대)
  2010-2020: Gap 평균 +5.5% (저금리 시대)
  2020-2025: Gap 평균 +3.5% (금리 정상화)
  → 고정 임계값보다 이동 평균 대비 편차가 더 적절
```

### 4.4 financials.js 구현 매핑

```
// 현재 CheeseStock에서 사용 가능한 데이터:
// - PER: DART 재무제표 → getFinancialData() → per_ttm
// - KTB10Y: bond_market.json → yields["10Y"]
//   (미수집 시 YIELD_GAP_FALLBACK_KTB = 3.5% 사용)

function calcYieldGap(per, ktb10y) {
    if (!per || per <= 0) return null;  // 적자 기업 제외
    const ey = 1 / per;                 // Earnings Yield (소수점)
    const gap = ey - ktb10y / 100;      // ktb10y: 3.45 → 0.0345
    return gap;
}

// 개별 종목 Yield Gap:
//   gapSignal = calcYieldGap(stock.per, bondData.yields["10Y"])
// 시장 전체 Yield Gap:
//   marketGap = calcYieldGap(marketAvgPER, bondData.yields["10Y"])
```

### 4.5 Yield Gap의 패턴 신뢰도 연동

```
// 개별 종목의 Yield Gap이 시장 Yield Gap 대비 높으면
// → 해당 종목 매수 패턴의 기대수익률이 더 높을 수 있음

relativeGap = stockGap - marketGap

if relativeGap > +0.02:  patternMult *= 1.03   // 밸류에이션 할인 종목
if relativeGap < -0.02:  patternMult *= 0.97   // 밸류에이션 프리미엄 종목
```

---

## 5. 크레딧 스프레드 분석

### 5.1 정의와 측정

크레딧 스프레드(credit spread)는 동일 만기의 국고채 대비 회사채 수익률 차이이다.

```
Credit_Spread(rating, tau) = y_corp(rating, tau) - y_gov(tau)

주요 지표 (한국):
  AA- 스프레드 (3Y) = AA-등급 3년 회사채 - 국고채 3년
  BBB- 스프레드 (3Y) = BBB-등급 3년 회사채 - 국고채 3년

AA- 스프레드:  투자등급 크레딧 리스크의 핵심 지표
BBB- 스프레드: 하이일드 경계, 경기 민감도 높음
```

### 5.2 한국 크레딧 스프레드의 역사적 범위

```
AA- 스프레드 (3Y), 2005-2025:
  최소:   0.20%p (2021.Q2, 유동성 장세)
  평균:   0.55%p
  최대:   2.80%p (2008.Q4, GFC)
  표준편차: 0.35%p

BBB- 스프레드 (3Y), 2005-2025:
  최소:   2.50%p (2021.Q2)
  평균:   4.20%p
  최대:  12.50%p (2009.Q1, GFC)
  표준편차: 1.80%p

신용등급별 스프레드 중앙값 (2020-2025 평균):
  AAA:   0.15%p
  AA+:   0.25%p
  AA0:   0.35%p
  AA-:   0.50%p
  A+:    0.70%p
  A0:    0.95%p
  A-:    1.20%p
  BBB+:  2.80%p
  BBB0:  3.50%p
  BBB-:  4.50%p
```

### 5.3 크레딧 스프레드 체제 분류 (Credit Regime)

크레딧 스프레드의 절대 수준으로 시장의 신용 리스크 선호도를 4단계로 분류한다:

```
AA- 스프레드 기준:

  Spread < 0.50%p  → COMPRESSED  (과도한 리스크 테이킹, risk-on 극단)
  0.50 <= Spread < 1.00%p → NORMAL   (정상적 크레딧 프리미엄)
  1.00 <= Spread < 1.50%p → ELEVATED (스트레스 초기, 경계)
  Spread >= 1.50%p → STRESS    (신용 경색, risk-off 극단)

상수 정의:
  CREDIT_COMPRESSED_THRESHOLD = 0.50  (상수 #131)
  CREDIT_ELEVATED_THRESHOLD   = 1.00  (상수 #132)
  CREDIT_STRESS_THRESHOLD     = 1.50  (상수 #133)
```

### 5.4 크레딧 스프레드와 주식시장 상관관계

```
실증 상관관계 (한국 2005-2025, 월별 변화):

  AA- Spread vs KOSPI 수익률:     r ≈ -0.42
  BBB- Spread vs KOSPI 수익률:    r ≈ -0.55
  AA- Spread vs VKOSPI:           r ≈ +0.68
  BBB- Spread vs VKOSPI:          r ≈ +0.72
  AA- Spread 변화 vs KOSPI 12M:   r ≈ -0.45

해석:
  - 크레딧 스프레드 확대 → 주식시장 하락 선행
  - VKOSPI와 높은 양의 상관 → 위험회피 공통 요인
  - 스프레드 변화(delta)가 수준(level)보다 높은 예측력
```

### 5.5 크레딧 모멘텀 시그널

```
Credit Momentum = MA(Spread, 20) - MA(Spread, 60)

  Momentum > 0  → 크레딧 악화 추세 (risk-off 가속)
  Momentum < 0  → 크레딧 개선 추세 (risk-on 가속)
  Momentum ≈ 0  → 전환점 탐색

패턴 신뢰도 조정:
  creditRegime = 'compressed' → patternMult *= 1.02  (리스크 선호 환경)
  creditRegime = 'normal'     → patternMult *= 1.00
  creditRegime = 'elevated'   → patternMult *= 0.95  (매수 패턴 감쇠)
  creditRegime = 'stress'     → patternMult *= 0.85  (강한 감쇠)
```

### 5.6 BBB-AA 스프레드 (High-Yield Spread)

```
HY_Spread = BBB-_Spread - AA-_Spread

이 차이는 "신용등급 간 스프레드"로, 투자등급과 투기등급 경계의
리스크 프리미엄 차이를 나타낸다.

HY_Spread 해석:
  확대 → 저등급 기업의 부도 위험 인식 증가 → 소형주/테마주 주의
  축소 → "reach for yield" (수익률 추구 행태) → 중소형주 선호
  급격 확대 → 시장 패닉 초기 신호 (GFC, 코로나 초기)

한국 특수성:
  - BBB 이하 회사채 유통이 극히 제한적 (발행시장 중심)
  - 실제 거래 스프레드보다 민평(mark-to-model) 스프레드가 주로 사용
  - KOFIA 민평금리 제공사: 한국자산평가, KIS자산평가, 나이스P&I, FN자산평가
```

---

## 6. Merton 구조적 모형 (Distance-to-Default)

### 6.1 이론적 기초

Merton (1974)은 기업의 자기자본(equity)을 기업자산(firm asset)에 대한
콜옵션으로 해석했다. 부채의 만기일에 자산가치가 부채 미만이면 부도(default)이다.

```
Black-Scholes-Merton 구조 모형:

E = V * N(d1) - D * e^(-rT) * N(d2)

where:
  E = 자기자본 시장가치 (시가총액)
  V = 기업 자산가치 (관측 불가 → 추정 필요)
  D = 부채 원리금 (= 단기부채 + 0.5 * 장기부채, KMV 관행)
  r = 무위험이자율
  T = 시간 수평 (통상 1년)
  N(.) = 표준정규 누적분포
  d1 = [ln(V/D) + (mu + sigma_V^2/2) * T] / (sigma_V * sqrt(T))
  d2 = d1 - sigma_V * sqrt(T)
```

### 6.2 Distance-to-Default (DD)

DD는 기업 자산가치가 부도 경계(default point)로부터 몇 표준편차
떨어져 있는지를 측정한다.

```
DD = [ln(V/D) + (mu - sigma_V^2/2) * T] / (sigma_V * sqrt(T))

where:
  V = 기업 자산가치
  D = Default Point (부도 경계)
  mu = 자산 기대수익률
  sigma_V = 자산 변동성
  T = 시간 수평

DD 해석:
  DD > 4.0  → 매우 안전 (부도 확률 < 0.003%)
  DD > 2.0  → 안전 (부도 확률 < 2.3%)
  DD > 1.5  → 경계 (MERTON_DD_WARNING = 1.5, 상수 #134)
  DD < 1.5  → 위험 (부도 확률 > 6.7%)
  DD < 1.0  → 매우 위험 (부도 확률 > 15.9%)

기대 부도확률 (EDF):
  EDF = N(-DD)    (이론적)
  EDF = f(DD)     (경험적 매핑, Moody's KMV)
```

### 6.3 DART 재무제표 활용한 DD 추정

CheeseStock은 DART 재무제표 데이터를 보유하고 있어 DD를 추정할 수 있다.

```
DART → DD 매핑:

1. E = 시가총액 (data/index.json의 marketCap)
2. D = Default Point
     = 유동부채 + 0.5 * 비유동부채
     = (DART "부채총계" 근사 — 세부 분류 가용 시 KMV 공식 적용)
3. sigma_E = 주가 변동성 (ATR 기반 또는 수익률 표준편차)
     = calcATR(14) / close * sqrt(252)  (연율화)
4. V, sigma_V: 반복법(iterative) 풀이
     E = V * N(d1) - D * e^(-rT) * N(d2)
     sigma_E = (V/E) * N(d1) * sigma_V
     → 2개 방정식, 2개 미지수 → Newton-Raphson

간편법 (Bharath & Shumway 2008):
  sigma_V ≈ sigma_E * E/(E+D) + 0.05 * D/(E+D)
  V ≈ E + D
  DD_naive = [ln((E+D)/D) + (r - sigma_V^2/2)] / sigma_V
  → 반복법 대비 상관관계 r > 0.90, 실용적 근사
```

### 6.4 DD의 패턴 분석 활용

```
DD가 낮은 종목 (DD < MERTON_DD_WARNING):
  → 매수 패턴 신뢰도 강한 감쇠 (patternMult *= 0.70)
  → 매도 패턴 신뢰도 보강 (patternMult *= 1.15)
  → 반전 패턴 (double bottom 등) 해석 주의:
    - 기술적 반전 시그널이 있어도 펀더멘탈 악화 중이면
    - "dead cat bounce" 가능성 경고

DD 추세 변화:
  delta_DD = DD(t) - DD(t-60)   # 3개월 변화
  delta_DD < -0.5 → 신용 악화 가속 → 경고 (매수 패턴 신뢰도 추가 감쇠)
  delta_DD > +0.5 → 신용 개선 → 기술적 매수 시그널 보강
```

### 6.5 KRX 특수성과 한계

```
한국 시장에서의 DD 추정 한계:

1. 부채 분류:
   - DART "부채총계"는 금융부채+운영부채 혼합
   - KMV의 Default Point = 단기차입금 + 0.5*장기차입금에 정확히 매핑 어려움
   - 근사: Default Point ≈ 부채총계 * 0.75 (보수적)

2. 자산 가치 관측:
   - 비상장 자회사 지분 → 시가 평가 불가
   - 재벌 그룹 교차보증 → 개별 기업 DD가 그룹 리스크 반영 못함
   - 상호출자제한기업집단은 그룹 DD 별도 산출 필요

3. ±30% 가격제한:
   - 주가 변동성(sigma_E) 측정에 truncation bias
   - Doc 20 §2의 보정 방법론 참조

4. 업종별 적합도:
   - 제조업/일반기업: DD 적합도 높음
   - 금융업/은행/보험: 부채=영업자산 → DD 부적합 → 별도 금융기관 모형 필요
```

---

## 7. 금리 민감도 섹터 분석 (Rate Beta)

### 7.1 개념

금리 민감도(Rate Beta)는 금리 변화에 대한 주가의 민감도를 측정한다.

```
r_i,t = alpha + beta_rate * delta_y_t + epsilon_t

where:
  r_i,t = 섹터/종목 i의 일별 수익률
  delta_y_t = KTB 10Y (또는 3Y) 수익률의 일별 변화 (%p)
  beta_rate = 금리 베타 (금리 1%p 변화당 주가 변화율)
```

### 7.2 한국 섹터별 금리 베타 (실증)

2015-2025년 KOSPI 업종별 금리 베타 추정 (KTB 10Y 기준):

```
┌───────────────────────────────────────────────────────────┐
│  섹터              │ beta_rate │ 해석                      │
├───────────────────────────────────────────────────────────┤
│  건설업             │  -3.2    │ 강한 역관계 (금리↑→주가↓)  │
│  부동산             │  -2.8    │ 차입 의존도 높음           │
│  유틸리티/전력      │  -2.5    │ 배당주 성격, 할인율 민감    │
│  음식료/생활소비재   │  -1.8    │ 안정적 현금흐름, 금리 민감  │
│  IT/반도체          │  -1.2    │ 성장주, DCF 할인 효과      │
│  헬스케어/바이오     │  -1.5    │ 먼 미래 현금흐름 할인      │
├───────────────────────────────────────────────────────────┤
│  은행/금융          │  +1.8    │ NIM(순이자마진) 개선       │
│  보험               │  +1.5    │ 운용자산 수익률 개선       │
│  증권               │  +0.5    │ 거래 수수료 vs 채권 손실   │
├───────────────────────────────────────────────────────────┤
│  철강/화학          │  -0.3    │ 경기 민감 > 금리 민감      │
│  자동차             │  -0.8    │ 할부금융 금리 영향         │
│  조선               │  -0.2    │ 금리보다 수주에 민감       │
└───────────────────────────────────────────────────────────┘

주의: beta_rate는 시간 가변적 — 금리 수준, 경기 국면에 따라 변동.
60일 롤링 추정이 고정 베타보다 유의미.
```

### 7.3 Rate Beta의 패턴 분석 활용

```
금리 변화 환경에서 패턴 필터링:

금리 상승기 (delta_y > +0.20%p over 20 days):
  → beta_rate < -2.0 섹터: 매수 패턴 감쇠 (patternMult *= 0.90)
  → beta_rate > +1.0 섹터: 매수 패턴 보강 (patternMult *= 1.05)

금리 하락기 (delta_y < -0.20%p over 20 days):
  → beta_rate < -2.0 섹터: 매수 패턴 보강 (patternMult *= 1.05)
  → beta_rate > +1.0 섹터: 매수 패턴 감쇠 (patternMult *= 0.95)

구현:
  // sector_fundamentals.json 또는 index.json의 업종 코드 활용
  // 개별 종목 → 업종 매핑 → 업종 beta_rate 적용
  // 또는 종목별 직접 추정 (250일 OLS, KTB10Y delta 대비)
```

### 7.4 Duration 효과 (주식 Duration)

주식도 "듀레이션"을 가진다 — 현금흐름의 가중평균 시점이다.

```
Equity Duration ≈ 1/dividend_yield + growth_duration

저듀레이션 주식 (high dividend yield, stable cash flow):
  → 은행, 유틸리티, 통신
  → 금리 상승에 상대적으로 둔감 (역설적)
  → 실제 메커니즘: NIM 개선 효과 > 할인율 효과

고듀레이션 주식 (no dividend, distant cash flows):
  → 바이오, AI, 성장 IT
  → 금리 1%p 상승 시 이론적 가치 -10~-20% 감소 가능
  → DCF 할인 효과 지배적

Implied equity duration (Dechow, Sloan & Soliman 2004):
  D_equity = sum_t [t * CF_t / (1+r)^t] / sum_t [CF_t / (1+r)^t]

  한계: CF_t 추정 필요 → 실무적으로 beta_rate가 대안
```

---

## 8. 채권-주식 상관관계 체제 변환

### 8.1 이론적 프레임워크

채권-주식 상관관계는 고정된 값이 아니라, 거시경제 레짐에 따라 부호가 변한다.

```
Historical correlation regimes:

Regime 1: Positive correlation (rho > 0)
  → 인플레이션 충격 지배
  → 금리↑ → 채권 가격↓, 주식↓ (동반 하락)
  → 1970-1990년대 미국, 2022 한국
  → "nowhere to hide" 환경

Regime 2: Negative correlation (rho < 0)
  → 성장 충격 지배
  → 경기 악화 → 채권 가격↑ (안전자산), 주식↓
  → 2000-2020년대 미국, 2008/2020 한국
  → 채권이 "포트폴리오 보험" 역할

Regime 3: Decoupling (rho ≈ 0)
  → 유동성/통화정책 지배
  → 중앙은행 양적완화 → 채권↑, 주식↑ (동반 상승)
  → 2020.Q2-2021 한국
```

### 8.2 레짐 결정 요인

```
Ilmanen (2003), Baele, Bekaert & Inghelbrecht (2010) 프레임워크:

rho(stock, bond) = f(inflation_regime, growth_regime, policy_regime)

핵심 변수:
  1. 인플레이션 수준 & 변동성
     - CPI > 4% & 상승 추세 → rho > 0 (positive regime)
     - CPI < 2% & 안정 → rho < 0 (negative regime)

  2. 실질 금리 수준
     - 실질금리 크게 음(-)  → rho < 0 (완화적 정책)
     - 실질금리 양(+) & 상승 → rho > 0 (긴축적 정책)

  3. VIX/VKOSPI 수준
     - VKOSPI > 25 → rho 절대값 증가 (상관관계 강화)
     - VKOSPI < 15 → rho ≈ 0 (저변동성, 낮은 상관)
```

### 8.3 한국 실증: 채권-주식 상관관계 변동

```
60일 롤링 상관관계: KOSPI 수익률 vs KTB 10Y 수익률 변화

2005-2008:  rho ≈ +0.15 (약한 양의 상관)
2008-2010:  rho ≈ -0.35 (GFC → 강한 음의 상관, flight-to-quality)
2010-2015:  rho ≈ -0.15 (약한 음의 상관)
2016-2019:  rho ≈ -0.20 (저금리 환경)
2020.Q1:    rho ≈ -0.50 (코로나 패닉, 극단적 음의 상관)
2020.Q2-21: rho ≈ +0.10 (유동성 장세, 동반 상승)
2022:       rho ≈ +0.40 (인플레이션 충격, 동반 하락)
2023-2025:  rho ≈ -0.10 (정상화 과정)
```

### 8.4 패턴 분석 시사점

```
상관관계 레짐별 패턴 해석:

Positive regime (rho > +0.15):
  → 채권 가격 하락(금리 상승) + 주식 하락: 이중 확인
  → 매도 패턴(H&S, double top)의 신뢰도 보강
  → 매수 패턴은 "금리 반전" 조건 추가 필요
  → 분산 투자 효과 저하 → 리스크 관리 강화

Negative regime (rho < -0.15):
  → 채권 가격 상승(금리 하락) + 주식 하락: 안전자산 선호
  → 매수 패턴 해석 시 "금리 하락이 지지인지 경기 침체인지" 구분 필요
  → Bull steepening과 결합 시 → 매수 패턴 보강
  → Bear flattening과 결합 시 → 매수 패턴 감쇠

Low-correlation regime (|rho| < 0.15):
  → 채권 시그널의 주식 예측력 약화
  → 패턴 분석은 개별 종목 기술적 요인에 더 의존
  → 채권-기반 multiplier 비활성화 (중립 1.0)
```

---

## 9. 한국 시장 특수성

### 9.1 외국인 국채 보유와 수익률 왜곡

```
외국인 KTB 보유 비중 추이:
  2010: ~5%
  2015: ~8%
  2020: ~15%
  2025: ~22% (추정)

영향:
  - 외국인 국채 매수 → 장기 금리 하향 압력 → 기울기 구조적 압축
  - FX 헤지 비용(basis swap)에 따라 자금 유출입 변동
  - 원화 강세 기대 시 외국인 국채 매수 가속 → 추가 금리 하락
  - "합리적" 수익률 곡선 역전이 외국인 수요에 의한 "기술적" 역전과 혼동

식별 방법:
  foreign_flow = 외국인 국채 순매수 (일별, 한국은행/금감원 공시)
  if |foreign_flow| > 2 * MA(foreign_flow, 60):
    → 수익률 곡선 시그널 신뢰도 감쇠 (수급 왜곡 경고)
```

### 9.2 KTB 선물 시장

```
KTB 선물 (Korea Exchange):
  3년 국채선물 (KTB3Y): 액면 1억원, 표면금리 5%, 주요 헤지 수단
  10년 국채선물 (KTB10Y): 액면 1억원, 표면금리 3%, 장기 금리 방향 베팅

KTB 선물 시장 참여자:
  - 외국인: 순방향 매매 (글로벌 금리 뷰 반영)
  - 증권사: 마켓메이킹 + 헤지
  - 은행/보험: ALM 헤지 (장기 선물 매수)
  - 자산운용사: 듀레이션 조절

순매매 포지션 시그널:
  외국인 KTB10Y 순매도 증가 → 금리 상승 기대 → 주식 성장주 압박
  외국인 KTB10Y 순매수 증가 → 금리 하락 기대 → 성장주 우호적
```

### 9.3 통화안정증권 (통안채)

```
한국은행이 유동성 흡수 목적으로 발행하는 통안채(MSB)는
단기 금리의 핵심 결정 요인이다.

통안채 잔액 추이:
  2010: ~170조원
  2015: ~180조원
  2020: ~160조원
  2025: ~170조원 (추정)

통안채 금리 vs 기준금리:
  - 통안채 91일물 ≈ 기준금리 ± 0.05%p (거의 고정)
  - 통안채 1년물 ≈ 기준금리 + 0.10~0.30%p (기대 반영)
  - 통안채 2년물 ≈ 국고채 2년물과 유사한 움직임

시사점:
  통안채 1년물 - 기준금리 > +0.25%p → 시장의 금리 인상 기대
  통안채 1년물 - 기준금리 < -0.05%p → 시장의 금리 인하 기대
```

### 9.4 한국은행 기준금리와 채권-주식 전달 경로

```
BOK 기준금리 → 채권시장 → 주식시장 전달:

[기준금리 결정] → [단기 금리(CD91, 통안채)] → [중기 수익률(3Y, 5Y)]
     ↓                                               ↓
[신용 대출 금리]  ←──────────────────────────── [장기 수익률(10Y, 30Y)]
     ↓                                               ↓
[기업 자금조달 비용]                             [주식 할인율]
     ↓                                               ↓
[설비투자, 고용]                                 [밸류에이션 조정]
     ↓                                               ↓
[기업 이익]  ─────────────────────────────────→ [주가]

전달 시차 (실증):
  기준금리 변경 → 단기 금리: 즉시 (0-1일)
  단기 금리 → 장기 금리: 1-4주
  금리 변경 → 기업 이익 반영: 2-4분기
  금리 변경 → 주가 반응: 즉시(기대) + 지연(실적 반영)
```

---

## 10. CheeseStock 상수 매핑

### 10.1 관련 상수 레지스트리

22_learnable_constants_guide.md의 Master Registry에 등록하는 신규 상수 #130~#134:

| # | Constant | Value | Tier | Learn | Range | Source |
|---|----------|-------|------|-------|-------|--------|
| 130 | YIELD_GAP_FALLBACK_KTB | 3.5 | B | FIX | [2.5, 5.0] | §4.2 KTB10Y 미수집 시 기본값 |
| 131 | CREDIT_COMPRESSED_THRESHOLD | 0.50 | C | GCV | [0.30, 0.70] | §5.3 AA- 스프레드 compressed |
| 132 | CREDIT_ELEVATED_THRESHOLD | 1.00 | C | GCV | [0.80, 1.20] | §5.3 AA- 스프레드 elevated |
| 133 | CREDIT_STRESS_THRESHOLD | 1.50 | C | GCV | [1.20, 2.00] | §5.3 AA- 스프레드 stress |
| 134 | MERTON_DD_WARNING | 1.5 | B | FIX | [1.0, 2.0] | §6.2 DD 경계 임계값 |

### 10.2 상수 tier 분류 근거

```
Tier B (FIX): YIELD_GAP_FALLBACK_KTB, MERTON_DD_WARNING
  → YIELD_GAP_FALLBACK_KTB = 3.5: 2020-2025 KTB 10Y 평균 근사값.
    데이터 미수집 시 fallback이므로 학습 대상이 아닌 보수적 기본값.
    금리 환경의 구조적 변화(예: 장기 저금리 → 고금리) 시 수동 조정.
  → MERTON_DD_WARNING = 1.5: 표준정규분포에서 1.5σ는 약 6.7% 확률.
    Moody's KMV의 실무 관행에서 DD < 1.5을 "speculative grade"
    경계로 사용. 학술적으로 확립된 범위이나, 한국 부도율 데이터에
    의한 정밀 교정은 향후 가능 (한국신용평가 부도율 DB 활용).

Tier C (GCV): CREDIT_COMPRESSED/ELEVATED/STRESS_THRESHOLD
  → KRX 크레딧 스프레드 분포에 의존하는 임계값
  → 시장 레짐(완화/긴축), 유동성 환경에 따라 최적값 변동
  → 2005-2025 AA- 스프레드 분위수 기반:
    - COMPRESSED < P25 (0.40~0.55%p)
    - ELEVATED > P75 (0.80~1.10%p)
    - STRESS > P95 (1.30~1.80%p)
  → GCV 또는 rolling percentile로 적응적 학습 가능
```

### 10.3 기존 상수와의 관계

```
Yield Gap 관련:
  financials.js의 PER 계산은 DART 데이터 기반 (Doc 14 §1)
  → #130 YIELD_GAP_FALLBACK_KTB는 bond_market.json 미존재 시 사용
  → 향후 download_bonds.py 구현 시 fallback 빈도 감소

크레딧 관련:
  Doc 34 §2의 VRP 레짐 (risk-on/off)과 creditRegime는 상호 보완적
  → VRP: 옵션 시장의 변동성 프리미엄
  → Credit: 채권 시장의 신용 프리미엄
  → 두 레짐이 동시에 stress → 패턴 신뢰도 강한 감쇠

Merton DD 관련:
  Doc 25 §1.2의 CAPM beta와 DD는 독립적 리스크 지표
  → beta: 시장 리스크 (체계적)
  → DD: 신용 리스크 (비체계적)
  → 두 지표 결합 = 종목별 총 리스크 프로파일
```

### 10.4 구현 우선순위

```
Phase 1 (즉시, 외부 데이터 불필요):
  - Yield Gap: DART PER + fallback KTB 활용
  - DD 간편법: DART 부채 + ATR 변동성

Phase 2 (데이터 파이프라인 필요):
  - download_bonds.py: KOFIA/ECOS → data/bond_market.json
  - NSS 파라미터 수집 → yieldCurveRegime
  - AA-/BBB- 스프레드 → creditRegime

Phase 3 (고도화):
  - 종목별 Rate Beta (OLS, 250일 롤링)
  - 채권-주식 상관관계 레짐 실시간 산출
  - DD 반복법 (Newton-Raphson) 정밀 추정
```

---

## 11. 참고문헌

1. Nelson, C.R. & Siegel, A.F. (1987). "Parsimonious Modeling of Yield Curves." *Journal of Business*, 60(4), 473-489.

2. Svensson, L.E.O. (1994). "Estimating and Interpreting Forward Interest Rates: Sweden 1992-1994." *NBER Working Paper* No. 4871.

3. Diebold, F.X. & Li, C. (2006). "Forecasting the Term Structure of Government Bond Yields." *Journal of Econometrics*, 130(2), 337-364.

4. Harvey, C.R. (1988). "The Real Term Structure and Consumption Growth." *Journal of Financial Economics*, 22(2), 305-333.

5. Harvey, C.R. (1989). "Forecasts of Economic Growth from the Bond and Stock Markets." *Financial Analysts Journal*, 45(5), 38-45.

6. Estrella, A. & Mishkin, F.S. (1998). "Predicting U.S. Recessions: Financial Variables as Leading Indicators." *Review of Economics and Statistics*, 80(1), 45-61.

7. Merton, R.C. (1974). "On the Pricing of Corporate Debt: The Risk Structure of Interest Rates." *Journal of Finance*, 29(2), 449-470.

8. Bharath, S.T. & Shumway, T. (2008). "Forecasting Default with the Merton Distance to Default Model." *Review of Financial Studies*, 21(3), 1339-1369.

9. Asness, C.S. (2003). "Fight the Fed Model: The Relationship Between Future Returns and Stock and Bond Market Yields." *Journal of Portfolio Management*, 30(1), 11-24.

10. Bekaert, G. & Engstrom, E. (2010). "Inflation and the Stock Market: Understanding the 'Fed Model'." *Journal of Monetary Economics*, 57(3), 278-294.

11. Ilmanen, A. (2003). "Stock-Bond Correlations." *Journal of Fixed Income*, 13(2), 55-66.

12. Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). "The Determinants of Stock and Bond Return Comovements." *Review of Financial Studies*, 23(6), 2374-2428.

13. Dechow, P.M., Sloan, R.G. & Soliman, M.T. (2004). "Implied Equity Duration: A New Measure of Equity Risk." *Review of Accounting Studies*, 9(2-3), 197-228.

14. Yardeni, E. (1997). "Fed's Stock Market Model Finds Overvaluation." *Deutsche Morgan Grenfell Topical Study*.

15. Campbell, J.Y. & Ammer, J. (1993). "What Moves the Stock and Bond Markets? A Variance Decomposition for Long-Term Asset Returns." *Journal of Finance*, 48(1), 3-37.

16. Ang, A. & Piazzesi, M. (2003). "A No-Arbitrage Vector Autoregression of Term Structure Dynamics with Macroeconomic and Latent Variables." *Journal of Monetary Economics*, 50(4), 745-787.

17. Kim, D.H. & Wright, J.H. (2005). "An Arbitrage-Free Three-Factor Term Structure Model and the Recent Behavior of Long-Term Yields and Distant-Horizon Forward Rates." *Finance and Economics Discussion Series*, 2005-33, Federal Reserve Board.

18. Gilchrist, S. & Zakrajsek, E. (2012). "Credit Spreads and Business Cycle Fluctuations." *American Economic Review*, 102(4), 1692-1720.

19. Bae, K.H., Kang, J.K. & Kim, J.M. (2002). "Tunneling or Value Added? Evidence from Mergers by Korean Business Groups." *Journal of Finance*, 57(6), 2695-2740.

20. 한국은행 (2024). "수익률 곡선의 정보 내용과 경기 예측력." *한국은행 경제분석* 제30권 제2호.

---

## 12. 문서 간 교차참조 (Cross-Reference Map)

| 이 문서 절 | 참조 문서 | 참조 절 | 내용 |
|-----------|----------|--------|------|
| §2 NSS 모형 | 29_macro_sector_rotation.md | §3.1 | 금리·수익률곡선 거시 해석 |
| §3.1 기울기 선행성 | 30_macroeconomics_islm_adas.md | §1-2 | IS-LM 금리 결정, 통화정책 전달 |
| §4.1 Fed Model | 25_capm_delta_covariance.md | §1.3 | 무위험이자율(R_f) 정의 |
| §4.4 PER 데이터 | 14_finance_management.md | §1-2 | DART 재무제표, PER 산출 |
| §5.4 VKOSPI 상관 | 26_options_volatility_signals.md | §2.3 | VKOSPI 레짐 분류 |
| §5.4 VKOSPI 상관 | 34_volatility_risk_premium_harv.md | §2 | VRP 리스크 레짐 |
| §6.3 DART 부채 | 14_finance_management.md | §2 | 재무제표 부채비율 |
| §6.5 가격제한 | 20_krx_structural_anomalies.md | §2 | ±30% 가격제한 truncation |
| §6.5 재벌 그룹 | 33_agency_costs_industry_concentration.md | §2 | 재벌 터널링, 교차보증 |
| §7.4 주식 듀레이션 | 25_capm_delta_covariance.md | §1.2 | CAPM beta와 리스크 보완관계 |
| §8.2 인플레이션 | 29_macro_sector_rotation.md | §2.1 | CPI/PPI 거시지표 |
| §9.1 외국인 수급 | 28_cross_market_correlation.md | §3 | MSCI 리밸런싱, 외국인 자금 |

---

## 13. 핵심 정리: 채권 신호 → CheeseStock 매핑

```
┌─────────────────────────────────────────────────────────────────────┐
│                채권시장 신호 → CheeseStock 매핑                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [이론]                    [구현 경로]              [신호]            │
│                                                                     │
│  NSS 수익률 곡선           download_bonds.py        yieldCurveRegime │
│  (Nelson-Siegel 1987)      KOFIA/ECOS 일별          Level/Slope/Curv│
│  ↓ 기울기 분해              bond_market.json         bull/bear regime│
│                                                                     │
│  Fed/BOK Yield Gap         financials.js            yieldGapSignal  │
│  (Yardeni 1997)            1/PER - KTB10Y           cheap/expensive │
│  ↓ 밸류에이션               DART PER + bond data     rel. valuation │
│                                                                     │
│  Credit Spread             download_bonds.py        creditRegime    │
│  (Gilchrist-Zakrajsek 2012) KOFIA AA-/BBB-          4-state regime │
│  ↓ 신용 리스크             credit_spread.json       compressed~stress│
│                                                                     │
│  Merton DD                 financials.js            ddWarning       │
│  (Merton 1974)             DART + ATR               boolean alert  │
│  ↓ 구조적 부도 위험         DD < 1.5 → 경고          per-stock      │
│                                                                     │
│  Rate Beta                 signalEngine.js          rateBetaAdj     │
│  (섹터 OLS)                delta_y × beta_rate      sector mult     │
│  ↓ 금리 민감도              60D rolling OLS          per-sector     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  패턴 신뢰도 = base                                       │      │
│  │              × ycRegimeMult    (yield curve: 0.85~1.05)   │      │
│  │              × creditMult      (credit: 0.85~1.02)        │      │
│  │              × ddMult          (DD: 0.70~1.15)            │      │
│  │              × rateBetaMult    (rate beta: 0.90~1.05)     │      │
│  │  합산 범위 (극단): 0.46 ~ 1.29                             │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  보조 이론:                                                          │
│  - Bond-Equity Correlation Regime (§8): 상관관계 부호 변환           │
│  - 외국인 국채 포지셔닝 (§9.1): 수급 왜곡 필터                       │
│  - 통안채 기대금리 (§9.3): 단기 통화정책 기대                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*본 문서는 CheeseStock 프로젝트의 채권-주식 교차분석 이론적 기반을 제공한다.*
*Doc 29(거시경제), Doc 30(IS-LM), Doc 25(CAPM)의 금리 관련 내용을 심화·확장하며,*
*NSS 수익률 곡선, 크레딧 스프레드, Merton DD가 개별 종목 패턴 분석에*
*어떻게 매핑되는지를 명시한다.*
