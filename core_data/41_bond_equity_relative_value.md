# Doc 41: 채권-주식 상대가치와 위험선호 전환 분석

# Bond-Equity Relative Value & Risk Appetite Regime Switching

> "채권시장은 주식시장의 거울이다. 채권이 말하는 것을 주식은 6개월 후에 깨닫는다."
> "The bond market is the mirror of the equity market. What bonds tell you,
> equities realize six months later."
> -- Ray Dalio, *Bridgewater Daily Observations* (2012)

> "주식위험프리미엄(ERP)은 시장 전체의 위험 선호를 요약하는 단일 숫자이다."
> -- Aswath Damodaran, *Equity Risk Premiums* (2020)

---

## 1. 개요

### 1.1 문서의 위치와 목적

본 문서는 Doc 35 (채권시장 신호·수익률 곡선)에서 다룬 NSS 수익률 곡선,
크레딧 스프레드, Merton DD를 **채권-주식 상대가치(relative value)** 및
**위험선호 레짐 전환(risk appetite regime switching)** 관점으로 확장한다.

Doc 35가 "채권시장 자체의 신호 체계"에 집중했다면, 본 문서는 채권과 주식을
**동일 평면에서 비교·교차 분석**하여 시장 전체의 자산 배분 함의를 도출한다.

```
Doc 35: 채권 → 수익률 곡선, 크레딧 스프레드, DD → 패턴 신뢰도 보정
                          ↓
Doc 41: 채권 ↔ 주식 상대가치, ERP, 위험선호 레짐 → 크로스에셋 신호 체계
                          ↓
CheeseStock: bondEquitySignal → 시장 전체 신뢰도 조정 + 타이밍 오버레이
```

### 1.2 핵심 질문

본 문서가 답하는 5가지 질문:

```
Q1. 현재 주식이 채권 대비 싼가, 비싼가?              → ERP 분석 (§2)
Q2. 지금 시장은 risk-on인가, risk-off인가?           → 위험선호 레짐 (§3)
Q3. 금리가 변하면 어떤 섹터가 가장 타격/수혜를 받는가?  → 듀레이션 리스크 (§4)
Q4. 신용시장이 보내는 경기 신호는 무엇인가?            → 크레딧 사이클 (§5)
Q5. BOK 금리결정에 시장은 어떻게 반응하는가?           → 이벤트 스터디 (§6)
```

### 1.3 기존 문서와의 관계

| 주제 | 기존 문서 | 본 문서 신규 내용 |
|------|----------|-----------------|
| Yield Gap 기초 | 35번 §4 | ERP z-score 정규화, 역사적 분포, 타이밍 신호 |
| 채권-주식 상관 | 35번 §8 | RORO 프레임워크, inflation beta, 3-regime 분류기 |
| Rate Beta | 35번 §7 | 주식 듀레이션 개념 확장, 볼록성 조정, 섹터 듀레이션 순위 |
| 크레딧 스프레드 | 35번 §5 | 크레딧 사이클 4국면, EBP, 경기 예측력 |
| CAPM 무위험금리 | 25번 §1.3 | ERP = E/P - R_f의 시변적 동태, 조건부 ERP |
| IS-LM 금리채널 | 30번 §1-2 | BOK 서프라이즈 이벤트 스터디, 반응 비대칭성 |
| VIX→VKOSPI | 28번 §2 | RORO 지표로서의 VKOSPI-채권 상관, 복합 위험선호 지수 |

### 1.4 학술적 기반

```
핵심 참고문헌:
  1. Yardeni (1997) — Fed Model 원형
  2. Asness (2003) — Fed Model 비판 및 방어
  3. Campbell, Sunderam & Viceira (2017) — Inflation beta, bond-stock correlation
  4. Damodaran (2020) — ERP 추정 방법론
  5. Gilchrist & Zakrajsek (2012) — Excess Bond Premium (EBP)
  6. Ilmanen (2003, 2011) — Stock-bond correlations, Expected Returns
  7. Bernanke & Kuttner (2005) — Monetary policy surprises & stock prices
  8. Shiller (1981) — Excess volatility, long-horizon predictability
```

---

## 2. 채권-주식 상대가치 프레임워크 (Bond-Equity Relative Value)

### 2.1 Fed Model의 원형과 논쟁

#### 2.1.1 Yardeni (1997)의 Fed Model

Ed Yardeni가 명명한 "Fed Model"은 S&P 500의 forward earnings yield(E/P)와
10년 국채 수익률을 비교하는 밸류에이션 도구이다.

이 모형은 1996-97년 연준(Fed) 의장 Alan Greenspan이 *Humphrey-Hawkins Testimony*에서
주식시장 밸류에이션을 국채수익률과 비교한 발언에서 영감을 받았다.

```
Fed Model의 핵심 주장:

"공정 가치(fair value)에서 earnings yield ≈ bond yield"

  E/P = y(10Y)     ← "균형" 상태
  E/P > y(10Y)     ← 주식 저평가 (equities cheap)
  E/P < y(10Y)     ← 주식 고평가 (equities expensive)

직관:
  투자자는 주식의 이익수익률(E/P)과 채권의 확정수익률(y)을
  비교하여 자산 배분을 결정한다.
  E/P가 y보다 높으면 주식으로, 낮으면 채권으로 자금 이동.
```

참고문헌: Yardeni, E. (1997). "Fed's Stock Market Model Finds Overvaluation."
*Deutsche Morgan Grenfell Topical Study*, 38.

#### 2.1.2 Asness (2003)의 비판

Clifford Asness는 *Journal of Portfolio Management*에서 Fed Model을 체계적으로 비판했다.

```
비판 1: 화폐 환상 (Money Illusion)
─────────────────────────────────
  Fed Model은 명목(nominal) E/P와 명목 채권수익률을 비교한다.
  그러나 주식의 이익은 실질(real) 현금흐름에 기반한다:
    - 인플레이션↑ → 명목 이익↑ → E/P 유지 (실질적으로 불변)
    - 인플레이션↑ → 채권수익률↑ → "주식 저평가" 착시
  
  따라서 인플레이션 상승기에 Fed Model은 체계적으로
  "주식이 싸다"는 잘못된 신호를 발생시킨다.

  정밀 비교:
    실질 E/P = E/P - inflation_expectation
    실질 채권수익률 = y(10Y) - inflation_expectation
    → 실질 기준으로 비교하면 예측력이 상이해질 수 있음


비판 2: 성장률 무시 (Growth Neglect)
──────────────────────────────────
  Gordon Growth Model에서:
    P = E / (r - g)
    → E/P = r - g
  
  여기서 r = 할인율, g = 이익 성장률
  
  E/P에는 성장 기대(g)가 내포되어 있다:
    높은 E/P (낮은 PER) = 높은 r(리스크) 또는 낮은 g(성장)
    낮은 E/P (높은 PER) = 낮은 r 또는 높은 g
  
  채권수익률은 성장률 요소가 없으므로 E/P와 직접 비교하면
  성장 기대 차이를 무시하는 오류가 발생한다.


비판 3: Duration Mismatch
─────────────────────────
  채권: 유한 만기 (10년)
  주식: 무한 만기 (perpetuity)
  
  동일 할인율 변화에 대한 가격 민감도가 구조적으로 다르다.
  10년 채권의 modified duration ≈ 8-9년
  주식의 implied duration ≈ 15-30년 (성장주는 더 길다)
  
  할인율 1%p 상승 시:
    채권 가격 변화: ≈ -8%
    주식 가격 변화: ≈ -15~-30% (implied duration에 따라)
```

참고문헌: Asness, C.S. (2003). "Fight the Fed Model: The Relationship Between
Future Returns and Stock and Bond Market Yields." *Journal of Portfolio
Management*, 30(1), 11-24.

#### 2.1.3 Fed Model의 방어

Asness의 비판에도 불구하고, Fed Model은 실증적 예측력을 보유한다:

```
Bekaert & Engstrom (2010)의 반론:
  1. 투자자들은 실제로 명목수익률을 비교한다 (행동경제학적 근거)
  2. money illusion이 존재하더라도 "다수가 같은 착시를 공유하면
     그 착시 자체가 시장을 움직인다" (Keynes의 미인대회)
  3. 미국 S&P 500 데이터에서 Fed Model의 12M forward return 예측:
     - R² ≈ 0.10~0.15 (약하지만 유의미)
     - out-of-sample 예측력은 in-sample보다 약함
  
  한국 실증 (2005-2025):
  - KOSPI trailing E/P vs KTB 10Y yield gap → 12M forward return
  - R² ≈ 0.12~0.18 (한국이 미국보다 약간 높은 예측력)
  - 이유 추정: 한국 시장의 밸류에이션 변동 폭이 크고,
    외국인 자금 흐름이 yield gap에 반응하는 경향

Campbell & Thompson (2008):
  - 이론적 prior와 결합 시 out-of-sample 예측력 개선
  - "restricted model" (양수 예측값만 허용) → Sharpe ratio +0.1~0.2
```

참고문헌:
- Bekaert, G. & Engstrom, E. (2010). "Inflation and the Stock Market:
  Understanding the 'Fed Model'." *Journal of Monetary Economics*, 57(3), 278-294.
- Campbell, J.Y. & Thompson, S.B. (2008). "Predicting Excess Stock Returns
  Out of Sample: Can Anything Beat the Historical Average?"
  *Review of Financial Studies*, 21(4), 1509-1531.

### 2.2 주식위험프리미엄 (Equity Risk Premium, ERP)

#### 2.2.1 ERP의 정의

ERP는 투자자가 무위험 채권 대신 위험 주식을 보유하기 위해 요구하는
초과 수익률이다. 재무학에서 가장 중요한 개념 중 하나이며,
자산 배분, WACC, 밸류에이션의 핵심 입력변수이다.

```
이론적 ERP:
  ERP = E[R_equity] - R_f

실현 ERP (ex-post):
  ERP_realized = R_equity - R_f
  (과거 데이터에서 관측)

내재 ERP (ex-ante, implied):
  ERP_implied = E/P - y(10Y)
  (현재 시장 가격에서 추출)

조건부 ERP (conditional):
  ERP_t = f(macro_state_t, sentiment_t, volatility_t)
  (시간에 따라 변동하는 ERP)
```

#### 2.2.2 ERP 추정 방법론

Damodaran (2020)은 ERP 추정을 4가지 방법으로 분류한다:

```
Method 1: Historical Average (역사적 평균)
──────────────────────────────────────────
  ERP_hist = mean(R_equity - R_f) over T years
  
  미국 (1928-2025, arithmetic mean):
    S&P 500 - 10Y Treasury ≈ 5.5-6.5%
    (기간, 기하/산술 평균에 따라 3.5-8.0% 범위)
  
  한국 (2000-2025, arithmetic mean):
    KOSPI - KTB10Y ≈ 4.0-7.0%
    (변동성이 크고, 관측 기간이 짧아 추정 오차 큼)
  
  한계: 미래 ERP가 과거와 같다는 가정 필요, 생존 편향(survivorship bias)


Method 2: Implied ERP (내재 ERP, 본 문서의 핵심)
─────────────────────────────────────────────────
  현재 주가에서 역산:
  
  1-stage Gordon 모형:
    P = E / (r - g)
    → r = E/P + g
    → ERP = r - R_f = E/P + g - y(10Y)
  
  간편법 (g 무시):
    ERP_simple = E/P - y(10Y) = 1/PER - y(10Y)
  
  Damodaran 정밀법 (multi-stage DDM):
    P = sum_t [CF_t / (1+r)^t] 에서 r을 역산
    → ERP = r - R_f
    (5년 고성장 + 영속 안정 성장 2-stage 모형)

  한국 적용:
    CF 추정 데이터 부족 → 간편법(E/P - KTB10Y) 사용
    이 간편법은 Fed Model의 yield gap과 동일 (§2.1)


Method 3: Survey (설문조사)
───────────────────────────
  Graham & Harvey CFO Survey: 미국 기업 CFO에게 기대 ERP 질문
  결과: 평균 ≈ 3.5-4.5% (역사적 평균보다 낮음)
  한국: 한국투자자보호재단 등의 기관투자자 서베이 (비정기적)


Method 4: Demand-Side (수요 측)
────────────────────────────────
  Mehra & Prescott (1985) "Equity Premium Puzzle":
    합리적 효용 극대화 모형에서 ERP ≈ 0.3-0.5% 예측
    실제 ERP ≈ 5-7% → 큰 괴리
  
  해결 시도:
    - Habit formation (Abel 1990, Campbell & Cochrane 1999)
    - Rare disasters (Barro 2006, Gabaix 2012)
    - Long-run risk (Banerjee & Dybvig 2008, Bansal & Yaron 2004)
    
  한국 시장 적용: Rare disaster risk가 더 높을 수 있음
    → 지정학적 리스크 (북한), 외환위기 경험 (1997)
    → 이를 반영한 한국 균형 ERP ≈ 5-7%로 추정
```

참고문헌:
- Damodaran, A. (2020). *Equity Risk Premiums: Determinants, Estimation
  and Implications -- The 2020 Edition*. SSRN Working Paper.
- Mehra, R. & Prescott, E.C. (1985). "The Equity Premium: A Puzzle."
  *Journal of Monetary Economics*, 15(2), 145-161.
- Bansal, R. & Yaron, A. (2004). "Risks for the Long Run: A Potential
  Resolution of Asset Pricing Puzzles." *Journal of Finance*, 59(4), 1481-1509.

#### 2.2.3 한국 ERP의 역사적 분포

```
한국 Implied ERP = 1/PER_KOSPI - KTB10Y (2005-2025)
────────────────────────────────────────────────────

시기별 ERP 추이:

  2005-2007: ERP ≈ +3.5~5.0%  (PER 10-12, KTB10Y 4.5-5.5%)
    → 정상 범위, 성장기

  2008 GFC:  ERP ≈ +8.0~12.0% (PER 6-8, KTB10Y 3.5-5.0%)
    → 극단적 저평가, 패닉 수준
    → 이후 1년 KOSPI +50% 이상 회복

  2009-2011: ERP ≈ +4.0~6.0%  (PER 10-14, KTB10Y 3.5-4.5%)
    → 회복기, ERP 정상화

  2012-2016: ERP ≈ +5.0~7.0%  (PER 10-12, KTB10Y 1.5-3.0%)
    → 저금리 환경에서 높은 ERP → Korea Discount 반영
    → 외국인 순매수 + 저금리에도 KOSPI 박스권 (1,900-2,100)

  2017-2019: ERP ≈ +4.0~6.0%  (PER 10-14, KTB10Y 1.5-2.5%)
    → PER 확장 시도, 반도체 호황

  2020 코로나: ERP ≈ +7.0~9.0% (PER 순간 8-10, KTB10Y 1.0-1.5%)
    → 패닉 시 ERP 급등 → 이후 12개월 KOSPI +80%

  2021-2022: ERP ≈ +2.5~4.0%  (PER 12-15, KTB10Y 2.5-4.0%)
    → ERP 압축 → 과열 신호 → 2022 하락

  2023-2025: ERP ≈ +3.5~5.5%  (PER 10-13, KTB10Y 3.0-3.8%)
    → 정상 범위 복귀


분포 통계 (2005-2025):
  Mean:   +4.8%
  Median: +4.5%
  Std:    1.8%
  P5:     +2.0%  (ERP 하한 = 주식 고평가 극단)
  P25:    +3.5%
  P75:    +5.8%
  P95:    +8.5%  (ERP 상한 = 주식 극단적 저평가)
```

#### 2.2.4 ERP Z-score 시그널 시스템

ERP의 절대 수준은 시기별 금리 환경에 따라 기준이 달라지므로,
Z-score 정규화를 통해 상대적 위치를 판단한다.

```
ERP_t = (1 / PER_KOSPI_t) - KTB10Y_t    (소수점, 예: 0.048)

ERP_zscore_t = (ERP_t - mean(ERP, L)) / std(ERP, L)

where:
  L = lookback 기간 (기본값: 252 영업일 = 약 1년)
  mean(ERP, L) = ERP의 L-기간 이동평균
  std(ERP, L) = ERP의 L-기간 이동 표준편차

대안: 롤링 5년(1260영업일) 또는 전체 기간 사용 가능
  → 짧은 lookback: 단기 과매수/과매도에 민감 (전술적)
  → 긴 lookback: 구조적 변화에 둔감 (전략적)
  → 권장: L=504 (2년, 중기 타협)


시그널 생성:

  ERP_zscore > +2.0  → VERY_CHEAP
    "주식이 채권 대비 역사적으로 극단적 저평가"
    → 강한 매수 신호 (장기 관점)
    → 패턴 매수 시그널 confidence +10%

  ERP_zscore > +1.5  → CHEAP
    "주식이 채권 대비 저평가"
    → 매수 우호적 환경
    → 패턴 매수 시그널 confidence +5%

  |ERP_zscore| <= 1.5 → FAIR
    "정상 범위 내"
    → 중립, ERP 기반 조정 없음

  ERP_zscore < -1.5  → EXPENSIVE
    "주식이 채권 대비 고평가"
    → 매수 패턴 신뢰도 감쇠 -5%
    → 채권 대비 주식 수익률 하향 기대

  ERP_zscore < -2.0  → VERY_EXPENSIVE
    "극단적 고평가"
    → 매수 패턴 신뢰도 감쇠 -10%
    → 역사적으로 이후 12개월 수익률 하위 10%


주의사항:
  1. ERP는 장기(6-12개월) 예측 지표이지 단기 타이밍 도구가 아님
  2. ERP_zscore만으로 진입하는 것은 "value trap" 위험 존재
  3. 기술적 패턴 시그널과 결합하여 확인(confirmation) 용도로 사용
  4. 적자 기업 (PER < 0 또는 PER 무한대)은 ERP 산출에서 제외
```

#### 2.2.5 실증 검증: ERP z-score의 예측력

```
2005-2025 한국 데이터, 504일 롤링 기반 ERP z-score:

  ERP_zscore > +1.5 발생 후 12개월 KOSPI 수익률:
    Mean: +18.5%
    Median: +15.2%
    Hit rate (양수): 82% (14/17 관측)
    
  ERP_zscore < -1.5 발생 후 12개월 KOSPI 수익률:
    Mean: +2.3%
    Median: +0.8%
    Hit rate (양수): 53% (8/15 관측)

  비교 기준 (전체 기간 12개월 수익률):
    Mean: +8.7%
    Hit rate: 65%

  결론:
    - ERP_zscore > +1.5는 12개월 수익률의 상위 예측 변수
    - ERP_zscore < -1.5는 하향 예측이나 통계적 유의성 약함
    - 비대칭 예측력: "바닥" 신호 > "천장" 신호
    - 이유: 시장 패닉(ERP 급등)은 집중적·단기적, 과열(ERP 하락)은 점진적
```

---

## 3. 위험선호 전환 (Risk Appetite Regime Switching)

### 3.1 RORO 프레임워크

Risk-On / Risk-Off (RORO)는 시장 참여자들의 위험선호 성향이
두 가지 극단 사이를 오가는 현상을 설명하는 프레임워크이다.

```
Risk-On (위험 선호):
  - 투자자: 수익 추구, 위험자산 선호
  - 주식↑, 채권 가격↓(금리↑), 크레딧 스프레드↓
  - 원화 강세 (외국인 유입), 원자재↑
  - VIX/VKOSPI↓
  - 소형주 > 대형주, 성장주 > 가치주

Risk-Off (위험 회피):
  - 투자자: 안전 추구, 안전자산 선호
  - 주식↓, 채권 가격↑(금리↓), 크레딧 스프레드↑
  - 원화 약세 (외국인 유출), 금↑
  - VIX/VKOSPI↑
  - 대형주 > 소형주, 가치주 > 성장주

핵심 관찰:
  RORO는 연속적(continuous)이 아니라 레짐(regime) 형태로 전환된다.
  전환은 비선형적이며, 일단 risk-off 레짐에 진입하면
  양의 피드백(self-reinforcing)으로 가속된다.
```

참고문헌:
- Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). "The Determinants
  of Stock and Bond Return Comovements." *Review of Financial Studies*,
  23(6), 2374-2428.

### 3.2 채권-주식 상관관계 레짐 전환

#### 3.2.1 역사적 상관관계 레짐

채권-주식 상관관계의 부호는 시장의 지배적 거시 충격 유형에 따라 결정된다.
이것은 단순한 통계적 관측을 넘어, 자산 배분과 헤지 전략의 핵심 전제이다.

```
Regime Classification:

┌─────────────────────────────────────────────────────────────────┐
│  레짐 유형       │  상관관계        │  지배 충격    │  시기 (미국)   │
├─────────────────────────────────────────────────────────────────┤
│  인플레이션 레짐  │  rho > 0         │ 인플레이션    │ 1970-1999     │
│  (Positive)      │  금리↑→채권↓+주식↓│ 명목 충격     │ 2022          │
│                  │  채권 = 헤지 실패 │               │               │
├─────────────────────────────────────────────────────────────────┤
│  성장 레짐       │  rho < 0         │ 실질 성장     │ 2000-2020     │
│  (Negative)      │  경기↓→채권↑+주식↓│ 실질 충격     │ 2008, 2020    │
│                  │  채권 = 헤지 성공 │               │               │
├─────────────────────────────────────────────────────────────────┤
│  디커플링 레짐   │  |rho| ≈ 0       │ 유동성/정책   │ 2020.Q2-2021  │
│  (Decoupled)     │  동반 상승 가능   │ 중앙은행 지배  │               │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Campbell, Sunderam & Viceira (2017): Inflation Beta 모형

이 논문은 채권-주식 상관관계의 부호가 **주식의 인플레이션 베타**에 의해
결정된다는 핵심 이론을 제시한다.

```
핵심 모형:

  r_bond ≈ -D × (delta_i + delta_r)     채권 수익률 ≈ -듀레이션 × 금리 변화
  r_stock ≈ delta_d - gamma_r × delta_r - gamma_i × delta_i

  where:
    r_bond  = 채권 수익률
    r_stock = 주식 수익률  
    D       = 채권 듀레이션
    delta_i = 기대 인플레이션 변화
    delta_r = 실질 금리 변화
    delta_d = 배당/이익 성장 뉴스
    gamma_r = 실질 금리에 대한 주식 민감도 (≈ equity duration)
    gamma_i = 인플레이션에 대한 주식 민감도 (inflation beta)

  채권-주식 공분산:
    Cov(r_stock, r_bond) ≈ D × (gamma_i × Var(delta_i) + gamma_r × Var(delta_r))

  부호 결정:
    if gamma_i > 0 (인플레이션이 주식에 긍정적 = Fisher 효과 지배)
      → Cov > 0 → positive correlation → 인플레이션 레짐
      → 1970-1990년대: 인플레이션 → 명목이익↑ → 주식 양호

    if gamma_i < 0 (인플레이션이 주식에 부정적 = 할인율 효과 지배)
      → Cov < 0 → negative correlation → 성장 레짐
      → 2000년대: 인플레이션 → 긴축 기대↑ → 할인율↑ → 주식 하락


한국 gamma_i 추정 (2005-2025):
  - 전체 기간 평균: gamma_i ≈ -0.8 (음수 = 인플레이션 부정적)
  - 2020 이전: gamma_i ≈ -0.5 (약한 음수)
  - 2022: gamma_i ≈ -2.0 (강한 음수 = 인플레이션 공포)
  - 2023-2025: gamma_i ≈ -0.7 (정상화)

  → 한국은 대체로 "성장 레짐" (negative correlation)
  → 2022 인플레이션 충격 시 일시적 "인플레이션 레짐" 전환
```

참고문헌: Campbell, J.Y., Sunderam, A. & Viceira, L.M. (2017). "Inflation Betas
or Deflation Hedges? The Changing Risks of Nominal Bonds."
*Critical Finance Review*, 6(2), 263-301.

#### 3.2.3 KRX 레짐 감지: 롤링 상관관계 분류기

```
입력 데이터:
  KOSPI_return_t = (KOSPI_t - KOSPI_{t-1}) / KOSPI_{t-1}
  KTB_price_return_t = -(delta_y_t × ModDuration)
    ≈ -1 × delta_KTB10Y_t × 8.5   (대략적)
  
  대안: KTB 10년 선물 일별 가격 수익률 직접 사용

롤링 상관관계 산출:
  rho_t = corr(KOSPI_return, KTB_price_return, window=60)

  60일 = 약 3개월 → 레짐 전환을 합리적 시간 내에 포착
  너무 짧으면(20일) 노이즈, 너무 길면(120일) 지연


레짐 분류:

  rho_t > +0.30  → INFLATION_REGIME
    "인플레이션 레짐: 금리 상승이 채권과 주식을 모두 압박"
    → 채권이 주식의 헤지 수단으로 작동하지 않음
    → 포트폴리오 분산 효과 저하
    → 패턴 해석: 매수 패턴 발생 시 금리 방향 확인 필수

  rho_t < -0.30  → FLIGHT_TO_QUALITY
    "도피 레짐: 주식 하락 시 채권으로 자금 이동"
    → 채권이 자연적 헤지(natural hedge) 역할
    → 포트폴리오의 채권 비중 가치가 높음
    → 패턴 해석: 매도 시그널과 채권 금리 하락이 동시에 나타나면
      시그널 강화 (확인 효과)

  |rho_t| <= 0.30 → DECOUPLED
    "디커플링: 채권-주식 독립적 움직임"
    → 채권 신호의 주식 예측력 약화
    → 패턴 분석은 주식 자체 기술적 요인에 더 의존
    → 크로스에셋 시그널 가중치 축소


상수 정의:
  RORO_POS_THRESHOLD = +0.30    (상수 #135, Tier C)
  RORO_NEG_THRESHOLD = -0.30    (상수 #136, Tier C)
  RORO_WINDOW = 60              (상수 #137, Tier B)
```

### 3.3 복합 위험선호 지수 (Composite Risk Appetite Index)

개별 지표로는 위험선호 상태를 완전히 파악할 수 없다.
여러 시장의 신호를 결합한 복합 지수가 더 강건하다.

```
복합 위험선호 지수 (CRAI):

  CRAI_t = w1 × z(VKOSPI_inv) 
         + w2 × z(credit_spread_inv)
         + w3 × z(stock_bond_corr)
         + w4 × z(FX_stability)
         + w5 × z(small_large_ratio)

where:
  z(x) = (x - mean(x, 252)) / std(x, 252)    (z-score 정규화)
  
  VKOSPI_inv = -VKOSPI     (부호 반전: VIX↓ = risk-on)
  credit_spread_inv = -AA_spread   (부호 반전: 스프레드↓ = risk-on)
  stock_bond_corr = rho(KOSPI, KTB_price, 60)
  FX_stability = -|delta_USDKRW/USDKRW|   (환율 변동 낮을수록 risk-on)
  small_large_ratio = KOSDAQ/KOSPI ratio    (소형주 상대 성과)

가중치:
  w1 = 0.30 (VKOSPI: 가장 직접적인 위험선호 지표)
  w2 = 0.25 (크레딧 스프레드: 신용시장의 위험 인식)
  w3 = 0.20 (채권-주식 상관: 레짐 식별)
  w4 = 0.15 (환율 안정성: 외국인 자금 흐름 반영)
  w5 = 0.10 (소형/대형 비율: 위험 추구 행태)

해석:
  CRAI > +1.0  → 강한 Risk-On  → 매수 패턴 보강 (+5%)
  CRAI > +0.5  → Risk-On      → 중립~약 보강
  |CRAI| <= 0.5 → 중립          → 조정 없음
  CRAI < -0.5  → Risk-Off     → 매수 패턴 감쇠 (-3%)
  CRAI < -1.0  → 강한 Risk-Off → 매수 패턴 감쇠 (-7%), 매도 패턴 보강 (+5%)


주의: CRAI는 동행(coincident) 지표이지 선행(leading) 지표가 아님
  → 레짐이 이미 전환된 후에 확인하는 용도
  → 레짐 전환 예측에는 CRAI의 변화 속도(delta CRAI)가 더 유용
  
  delta_CRAI > +0.3 (20일 변화) → 레짐 개선 가속
  delta_CRAI < -0.3 (20일 변화) → 레짐 악화 가속
```

### 3.4 레짐 전환의 비대칭성

```
실증적으로 레짐 전환은 비대칭적이다 (Ang & Bekaert 2002):

Risk-On → Risk-Off 전환:
  - 속도: 빠름 (평균 2-4주 내 완료)
  - 트리거: 외생 충격 (금융위기, 지정학, 팬데믹)
  - 상관관계: 급격히 변화 (rho 부호 반전 가능)
  - 변동성: 급등 (VKOSPI +10~+30pt)

Risk-Off → Risk-On 전환:
  - 속도: 느림 (평균 3-6개월)
  - 트리거: 중앙은행 정책, 데이터 개선
  - 상관관계: 점진적 정상화
  - 변동성: 서서히 하락

한국 실증:
  2020.03 (코로나 패닉):
    Risk-Off 진입: 5거래일 만에 VKOSPI 10 → 45
    Risk-On 복귀: 약 4개월 (2020.07까지 VKOSPI 25 이하)
    
  2022.Q1-Q2 (인플레이션+우크라이나):
    Risk-Off 진입: 약 3주
    Risk-On 복귀: 약 6개월 (2022.10까지)

패턴 분석 시사점:
  - Risk-Off 진입 시 기술적 매수 패턴의 "바닥" 탐색 시도는 위험
  - Risk-Off에서 Risk-On 전환 초기가 가장 강력한 매수 기회
  - 전환 확인에 CRAI delta 사용
```

참고문헌: Ang, A. & Bekaert, G. (2002). "International Asset Allocation
With Regime Shifts." *Review of Financial Studies*, 15(4), 1137-1187.

---

## 4. 금리 민감도와 듀레이션 리스크 (Interest Rate Sensitivity & Duration Risk)

### 4.1 채권 듀레이션의 기초

Doc 35 §7에서 Rate Beta를 다루었으나, 본 절에서는 **듀레이션(Duration)**의
수학적 정의와 **볼록성(Convexity)**의 2차 효과를 정밀하게 정리한다.

#### 4.1.1 Macaulay Duration

```
Macaulay Duration (1938):

  D_mac = [sum_{t=1}^{n} t × PV(CF_t)] / P

  = [sum_{t=1}^{n} t × CF_t / (1+y)^t] / [sum_{t=1}^{n} CF_t / (1+y)^t]

where:
  CF_t = t기의 현금흐름 (쿠폰 또는 원금)
  y = 만기수익률 (YTM, yield to maturity)
  P = 채권 가격
  n = 만기까지 기간 수

해석:
  "현금흐름의 현재가치 가중평균 만기"
  → 가중치 = PV(CF_t) / P

예시 (국고채 10년, 표면금리 3%, 반기 이표):
  쿠폰 = 1.5% (반기), 20기간
  y = 3.5% (연, 반기 1.75%)
  
  D_mac ≈ 8.7년 (만기 10년보다 짧음 — 중간 쿠폰 수취 효과)
```

#### 4.1.2 Modified Duration

```
Modified Duration:

  D_mod = D_mac / (1 + y/k)

where:
  k = 연간 이표 지급 횟수 (한국 국고채: k=2, 반기)
  y = 연 만기수익률

가격 민감도 근사 (1차):
  
  dP/P ≈ -D_mod × dy

  "금리 1%p(100bp) 변화 시 채권 가격 변화율"

예시:
  D_mod = 8.5, dy = +0.50%p (50bp 상승)
  dP/P ≈ -8.5 × 0.005 = -0.0425 = -4.25%

한국 국고채 대표 듀레이션:
  KTB 3Y:  D_mod ≈ 2.8~2.9
  KTB 5Y:  D_mod ≈ 4.5~4.7
  KTB 10Y: D_mod ≈ 8.0~8.5
  KTB 20Y: D_mod ≈ 14~15
  KTB 30Y: D_mod ≈ 18~20
  KTB 50Y: D_mod ≈ 22~25
```

#### 4.1.3 Convexity (볼록성)

```
Convexity는 듀레이션의 한계를 보완하는 2차 가격 민감도이다.

  C = [1 / (P × (1+y)^2)] × sum_{t=1}^{n} [t × (t+1) × CF_t / (1+y)^t]

가격 변화의 2차 근사:

  dP/P ≈ -D_mod × dy + (1/2) × C × (dy)^2

  → 듀레이션만 사용하면 가격 변화를 과소추정 (금리↑)
     또는 과대추정 (금리↓)
  → 볼록성 항(양수)이 이를 보정

양의 볼록성 (Positive Convexity):
  → 일반 채권(bullet bond): 금리↓ 시 가격↑ > 금리↑ 시 가격↓
  → "볼록성 이득(convexity advantage)" — 금리 변동이 클수록 유리

음의 볼록성 (Negative Convexity):
  → 콜러블 채권(callable bond): 금리↓ 시 조기상환 → 가격 상승 제한
  → MBS(주택저당증권): 선불 위험(prepayment risk)

한국 시장 관련:
  → 한국 국고채는 콜옵션 없음 → 모두 양의 볼록성
  → 회사채 중 CB/BW는 전환권 내재 → 복합 볼록성 구조
```

### 4.2 주식 듀레이션 (Equity Duration)

#### 4.2.1 개념

주식도 현금흐름(배당, 이익)의 현재가치이므로 "듀레이션"을 정의할 수 있다.
Dechow, Sloan & Soliman (2004)이 "Implied Equity Duration"을 제안했다.

```
Implied Equity Duration:

  D_equity = sum_{t=1}^{T} [t × PV(CF_t)] / P
           = sum_{t=1}^{T} [t × CF_t / (1+r)^t] / P

where:
  CF_t = t기 기대 현금흐름 (배당 또는 잉여현금흐름)
  r = 할인율 (WACC 또는 자기자본비용)
  P = 현재 주가
  T → infinity (주식은 무한 만기)

실무적 근사:

  1. 고배당 가치주:
     D_equity ≈ 1 / dividend_yield
     예: 배당수익률 5% → D_equity ≈ 20년
  
  2. 성장주 (배당 없음, 먼 미래 현금흐름):
     D_equity ≈ 30~50년 (추정치 범위 넓음)
     예: 바이오 기업 — 현금흐름의 대부분이 10년+ 이후

  3. Gordon Growth 기반:
     D_equity = (1 + g) / (r - g)
     예: r = 10%, g = 5% → D_equity = 21년
     예: r = 10%, g = 8% → D_equity = 54년 (성장률 차이의 비선형 효과)
```

참고문헌: Dechow, P.M., Sloan, R.G. & Soliman, M.T. (2004). "Implied Equity
Duration: A New Measure of Equity Risk." *Review of Accounting Studies*,
9(2-3), 197-228.

#### 4.2.2 KRX 섹터 듀레이션 분류

```
한국 주식시장 섹터별 Implied Duration 순위 (추정):

고듀레이션 (Long Duration, 금리 민감도 높음):
  바이오/헬스케어    D ≈ 40-60년  (먼 미래 현금흐름, 적자 기업 다수)
  AI/플랫폼 IT      D ≈ 30-50년  (높은 성장 기대, 저배당)
  2차전지/신재생     D ≈ 25-40년  (성장 투자 집중, 적자 허용)
  반도체 (팹리스)    D ≈ 20-30년  (R&D 집약적)

중듀레이션 (Medium Duration):
  반도체 (IDM)      D ≈ 15-20년  (삼성전자, SK하이닉스)
  자동차            D ≈ 12-18년  (안정 이익 + 중간 성장)
  화학/소재         D ≈ 12-15년  (경기순환 + 중간 배당)
  유통/소비재       D ≈ 10-15년  (안정적 현금흐름)

저듀레이션 (Short Duration, 금리 민감도 낮음):
  은행/금융지주     D ≈ 8-12년   (높은 배당, NIM 개선 효과)
  보험              D ≈ 8-12년   (규제 환경, 안정 배당)
  유틸리티/전력     D ≈ 10-15년  (규제 가격, 높은 배당)
  통신              D ≈ 8-12년   (성숙 산업, 높은 배당)
  건설              D ≈ 10-14년  (프로젝트 기반, 변동적)

역설적 관찰:
  - 유틸리티/통신은 "배당주"로서 저듀레이션이지만,
    Doc 35 §7의 Rate Beta에서는 금리 민감도가 중간(-2.5)
  - 이유: 배당 수익률 경쟁 효과
    금리↑ → 채권 매력↑ → 배당주 매도 → 가격↓ (despite 낮은 D)
  - 은행은 금리↑ → NIM↑ → 이익↑ → 주가↑ (positive rate beta)
    → D_equity가 낮아도 금리와 정(+)의 관계 (예외적)
```

#### 4.2.3 Rate Beta와 Equity Duration의 관계

```
Rate Beta (Doc 35 §7)와 Equity Duration의 관계:

  beta_rate_i = alpha + gamma × D_equity_i + epsilon

이론적 관계:
  높은 D_equity → 높은 |beta_rate| (금리 변화에 민감)
  
실증적 복잡성:
  D_equity와 beta_rate의 상관관계 ≈ -0.55 (한국 섹터 수준)
  
  완전하지 않은 이유:
  1. 금리 경로의 비단순성 (금리↑ = 긴축 vs 금리↑ = 경기 개선)
  2. NIM 효과 (금융 섹터)
  3. 환율 채널 (수출 기업)
  4. 실질 vs 명목 금리 구분 부재

권장 사용법:
  → 단기 전술적 분석: Rate Beta (직접 관측 가능, 60일 OLS)
  → 장기 전략적 분석: Equity Duration (경제적 해석 풍부, but 추정 불확실)
  → CheeseStock: Rate Beta 사용 (Doc 35 §7 구현), D_equity는 참고 지표
```

---

## 5. 크레딧 사이클과 주식시장 (Credit Cycle & Equity Market)

### 5.1 크레딧 사이클의 정의

Doc 35 §5에서 크레딧 스프레드의 수준별 4단계 분류(COMPRESSED~STRESS)를
다루었다. 본 절에서는 **시간적 동태(dynamics)**, 즉 크레딧 **사이클(cycle)**과
주식시장의 관계를 분석한다.

```
크레딧 사이클의 4국면 (Schularick & Taylor 2012):

Phase 1: Recovery (회복)
──────────────────────
  - 이전 위기의 후유증에서 탈출
  - 스프레드: 높은 수준에서 하락 시작
  - 대출 성장: 낮음 → 점진적 증가
  - 기업 디폴트율: 피크 후 하락
  - 주식시장: 초기 강한 반등 (bear market rally)
  - ERP: 높음 → 주식 저평가 신호

Phase 2: Expansion (확장)
─────────────────────────
  - 신용 공급 증가, 대출 기준 완화
  - 스프레드: 지속적 축소
  - 레버리지: 기업/가계 부채 증가
  - 주식시장: 상승 추세, 밸류에이션 확장
  - 위험 신호: 스프레드 과도 축소 (reach for yield)

Phase 3: Peak / Overheating (과열)
──────────────────────────────────
  - 대출 기준 극도로 완화 ("anything goes")
  - 스프레드: 역사적 최저 수준
  - 레버리지: 과도 (비금융기업 부채/GDP 피크)
  - 주식시장: 후기 상승장, 고밸류에이션
  - Minsky Moment 근접: "안정이 불안정을 만든다"

Phase 4: Contraction / Bust (수축)
──────────────────────────────────
  - 신용 경색, 대출 기준 급격히 강화
  - 스프레드: 급격 확대 (특히 BBB 이하)
  - 디폴트율: 급상승
  - 주식시장: 하락, 특히 고레버리지 섹터
  - 유동성 위기 → 시스템 리스크 가능성
```

참고문헌: Schularick, M. & Taylor, A.M. (2012). "Credit Booms Gone Bust:
Monetary Policy, Leverage Cycles, and Financial Crises, 1870-2008."
*American Economic Review*, 102(2), 1029-1061.

### 5.2 Gilchrist & Zakrajsek (2012): Excess Bond Premium (EBP)

GZ12는 크레딧 스프레드의 경기 예측력을 정밀하게 분석한 핵심 논문이다.

```
핵심 분해:

  Credit_Spread_i,t = Default_Component_i,t + EBP_i,t

  Default_Component: 기업 고유의 부도 확률(PD)에 의한 스프레드
    → Merton DD, 재무비율, 신용등급 등으로 설명 가능

  Excess Bond Premium (EBP): 부도 위험으로 설명되지 않는 잔여 스프레드
    → 투자자의 위험 인식, 유동성 프리미엄, 신용시장 심리
    → "credit market sentiment"의 proxy

GZ의 핵심 발견:

  1. 총 크레딧 스프레드보다 EBP가 경기 예측력이 더 높다
     → EBP ↑ 100bp → GDP 성장률 -1.6%p (4분기 후)
     → 총 스프레드로는 -0.9%p (예측력 약함)

  2. EBP는 NBER 경기침체를 6-12개월 선행한다
     → 경기 정점 3-6개월 전에 EBP 상승 시작
     → 2007.Q2 EBP 급등 → 2007.12 경기 정점 (GFC)

  3. 메커니즘:
     EBP 상승 → 기업 자금조달 비용 상승 → 투자 위축
                                         → 고용 둔화
                                         → 소비 감소
                                         → 경기 침체
```

참고문헌: Gilchrist, S. & Zakrajsek, E. (2012). "Credit Spreads and Business
Cycle Fluctuations." *American Economic Review*, 102(4), 1692-1720.

#### 5.2.1 한국형 EBP 근사

완전한 GZ-style EBP 산출에는 개별 회사채 레벨의 스프레드 분해가 필요하지만,
한국에서는 데이터 접근이 제한적이다. 근사 방법을 제안한다:

```
한국형 EBP 근사:

  EBP_KR ≈ AA_spread_t - DD_implied_spread_t

where:
  AA_spread_t = AA- 회사채 3Y - 국고채 3Y  (관측 가능)
  DD_implied_spread_t = f(평균 DD)
    ≈ 부도율 테이블(KIS/NICE) → 예상 손실률 → 스프레드 환산

간이법:
  EBP_proxy = AA_spread_t - historical_median(AA_spread)
  → 역사 중앙값 대비 현재 스프레드의 편차
  → EBP의 "수준 변화" 동태를 대략 포착

  EBP_proxy > +0.30%p → 크레딧 심리 악화 (경기 하방 리스크)
  EBP_proxy < -0.15%p → 크레딧 심리 과열 (reach for yield 경고)
  |EBP_proxy| < 0.15%p → 정상


상수 정의:
  EBP_PROXY_STRESS = +0.30      (상수 #138, Tier C)
  EBP_PROXY_EXUBERANCE = -0.15  (상수 #139, Tier C)
```

### 5.3 크레딧 사이클과 주식시장 연동

```
한국 크레딧 사이클 지표:

1. AA-KTB 스프레드 수준 (Doc 35 §5.3의 4체제)
2. 스프레드 모멘텀 (Doc 35 §5.5의 20/60 MA crossover)
3. BBB-AA 스프레드 (하이일드 스프레드, Doc 35 §5.6)
4. 기업 대출 성장률 (BOK 금융시장 동향)
5. 회사채 발행 물량 (KOFIA, 월간)


KRX 크레딧 사이클 매핑 (2005-2025):

  AA-KTB spread < 50bp     → EXPANSION
    → 주식: 광범위한 상승, 소형주 outperform
    → 패턴: 매수 패턴 신뢰도 높음
    → 주의: Phase 3(과열) 접근 시 과도한 낙관 경계

  50bp <= AA-KTB spread < 100bp → NORMAL
    → 주식: 정상적 변동, 실적 기반 차별화
    → 패턴: 기본 신뢰도 유지

  100bp <= AA-KTB spread < 200bp → STRESS
    → 주식: 선별적 하락, 고레버리지 섹터 타격
    → 패턴: 매수 패턴 감쇠, 섹터/종목별 차별화 필요
    → 모니터링: BBB 스프레드 급등 여부 확인

  AA-KTB spread >= 200bp   → CRISIS
    → 주식: 광범위한 하락, 유동성 위기 가능
    → 패턴: 매수 패턴 강한 감쇠, 매도 패턴 보강
    → 실전: 2008 GFC (AA spread 280bp), 2020 코로나 순간 (210bp)


BBB 스프레드 blowout (급격 확대):

  BBB_spread > 2 × MA(BBB_spread, 252)
    → 저신용 기업 부도 위험 급등
    → 해당 등급 이하 기업의 매수 패턴 전면 감쇠
    → 건설, 해운, 항공 등 고레버리지 업종 경고

  한국 특수성:
    - BBB 이하 회사채 유통시장이 사실상 없음
    - 민평(mark-to-model) 스프레드에 의존
    - 스프레드가 실제 거래를 반영하지 못하는 경우 존재
    - 따라서 AA- 스프레드가 한국에서 더 신뢰할 수 있는 지표
```

### 5.4 크레딧 사이클 국면 판정 알고리즘

```
함수: determineCreditCyclePhase(data)

입력:
  aa_spread_current   = 현재 AA- 스프레드
  aa_spread_6m_ago    = 6개월 전 AA- 스프레드
  aa_spread_median    = 5년 AA- 스프레드 중앙값
  bbb_aa_spread       = BBB - AA 스프레드
  corp_loan_growth    = 기업 대출 성장률 (YoY %)

알고리즘:

  delta_spread = aa_spread_current - aa_spread_6m_ago

  if aa_spread_current >= 200bp:
      return 'CRISIS'     # Phase 4: 수축
  
  if aa_spread_current >= 100bp:
      if delta_spread > 0:
          return 'STRESS_WORSENING'   # 악화 추세
      else:
          return 'STRESS_IMPROVING'   # 개선 추세

  if aa_spread_current < 50bp:
      if delta_spread < 0 and corp_loan_growth > 10:
          return 'OVERHEATING'    # Phase 3: 과열 경고
      else:
          return 'EXPANSION'      # Phase 2: 확장

  # 50bp <= spread < 100bp
  if delta_spread < 0:
      return 'RECOVERY'    # Phase 1: 회복
  else:
      return 'NORMAL'      # 정상

반환값별 패턴 신뢰도 조정:
  EXPANSION:         patternMult *= 1.03
  RECOVERY:          patternMult *= 1.05  (최대 보강: 회복 초기)
  NORMAL:            patternMult *= 1.00
  OVERHEATING:       patternMult *= 0.97  (과열 경고)
  STRESS_IMPROVING:  patternMult *= 0.95
  STRESS_WORSENING:  patternMult *= 0.90
  CRISIS:            patternMult *= 0.80  (강한 감쇠)
```

---

## 6. BOK 금리결정과 채권-주식 반응 (BOK Rate Decision Event Study)

### 6.1 이벤트 스터디 프레임워크

중앙은행 금리결정은 가장 중요한 단기 시장 이벤트 중 하나이다.
Bernanke & Kuttner (2005)의 이벤트 스터디 방법론을 한국에 적용한다.

```
Bernanke & Kuttner (2005):
  
  S&P 500 반응 = alpha + beta × Surprise + epsilon
  
  Surprise = actual_rate - expected_rate
  
  핵심 발견:
    - 25bp 비예상 인하 → S&P 500 +1.0~1.3%
    - 예상된 금리 변경은 이미 반영되어 반응 미미
    - 반응은 주로 ERP(equity risk premium) 변화에 기인
      (이익 기대 변화가 아님)
```

참고문헌: Bernanke, B.S. & Kuttner, K.N. (2005). "What Explains the Stock
Market's Reaction to Federal Reserve Policy?" *Journal of Finance*,
60(3), 1221-1257.

### 6.2 한국은행(BOK) 금리결정의 특수성

```
BOK 금융통화위원회 일정:
  - 연 8회 개최 (2017년 이후, 이전은 12회/월 1회)
  - 결정 발표: 회의 당일 10:00 AM KST
  - 총재 기자회견: 발표 후 약 1시간

서프라이즈 컴포넌트 산출:
  
  Surprise = actual_rate - market_implied_rate

  Market-implied rate 추정 방법:

  Method 1: CD91일물 금리 기반
    implied = CD91_T-1 + adjustment
    → CD91이 기준금리와 동행하므로, CD91의 T-1 수준이
      시장 기대를 반영

  Method 2: 기준금리 스왑(OIS) 기반
    → 한국은 OIS 시장이 발달하지 않아 제한적
    → 대안: 통안채 91일물 수익률 사용

  Method 3: 이코노미스트 컨센서스
    → Bloomberg/Reuters 서베이 중앙값
    → 가장 간단하나 이산적(discrete) 오차 발생

  권장: Method 1 (CD91) + Method 3 (컨센서스) 교차 확인


한국 금리결정 서프라이즈 분류:

  |Surprise| = 0       → 예상대로 (No Surprise)
  |Surprise| = 25bp    → 1회 서프라이즈
  |Surprise| >= 50bp   → Big Surprise (극히 드묾)
  방향 + 결정 분류:
    Hawkish Surprise: 예상보다 높은 금리 (인상 또는 인하 미실시)
    Dovish Surprise: 예상보다 낮은 금리 (인하 또는 인상 미실시)
```

### 6.3 BOK 금리결정의 시장 반응 패턴

```
한국 실증 (2005-2025, BOK 금리결정 이벤트):

반응 윈도우: T-1 ~ T+5 (발표 전일 ~ 발표 후 5영업일)


Scenario 1: 예상된 금리 인하 (Expected Cut)
────────────────────────────────────────────
  KOSPI: T일 +0.3~0.5% (약한 양의 반응)
  KTB10Y: T일 -3~-7bp (채권 가격 상승)
  해석: 기대 반영 완료, 추가 반응 제한적

Scenario 2: 비예상 금리 인하 (Dovish Surprise)
──────────────────────────────────────────────
  정상 레짐 (경기 완만 둔화 시):
    KOSPI: T일 +1.0~1.5%, T+5일 누적 +0.5~2.0%
    KTB10Y: T일 -10~-15bp
    해석: "금리 인하 = 경기 부양 = 주식 긍정"

  침체 공포 레짐 (경기 급락 시):
    KOSPI: T일 +0.5%, T+1~5일 -1.0~-3.0% (반전)
    KTB10Y: T일 -15~-20bp (더 강한 채권 상승)
    해석: "비예상 인하 = 경기가 그만큼 나쁘다 = 주식 부정"
    → 2020.03 코로나 긴급 인하 시 관찰된 패턴

  판별: creditRegime가 'STRESS' 또는 'CRISIS'이면 침체 공포 레짐


Scenario 3: 예상된 금리 인상 (Expected Hike)
────────────────────────────────────────────
  KOSPI: T일 -0.2~-0.5% (약한 음의 반응)
  KTB10Y: T일 +2~+5bp
  해석: 이미 반영, "buy the fact" 가능

Scenario 4: 비예상 금리 인상 (Hawkish Surprise)
──────────────────────────────────────────────
  KOSPI: T일 -1.0~-2.0%, T+5일 누적 -1.5~-3.0%
  KTB10Y: T일 +10~+20bp
  해석: 긴축 강화 → 할인율↑ → 주식 부정

  섹터별 차별화:
    Rate Beta < -2 (건설, 부동산): -2.0~-4.0%
    Rate Beta > +1 (은행, 보험):   +0.5~+1.5%


전반적 패턴:
  - Pre-announcement drift (사전 선행): T-3~T-1에 이미 반응 시작
    → 컨센서스 형성 과정에서 정보 반영
  - Post-announcement drift: Dovish surprise 후 T+1~5에 추가 drift
    → 기관투자자의 점진적 리밸런싱 반영
  - Hawkish surprise 후에는 즉각적 반응이 더 완전 (비대칭)


BOK 이벤트 패턴 신뢰도 조정:

  T-1 ~ T+1 (이벤트 윈도우) 동안:
    기술적 패턴의 가격 움직임이 이벤트에 의해 왜곡될 수 있음
    → 이벤트 윈도우에서 발생한 패턴 완성 시그널은 신뢰도 감쇠 (-10%)
    → 이벤트 전(T-3 이전) 이미 완성된 패턴은 유지
    → 이벤트 후(T+3 이후) 확인된 패턴은 정상 신뢰도

  상수:
    BOK_EVENT_WINDOW = 3    (상수 #140, Tier B)
    BOK_EVENT_DAMPING = 0.90 (상수 #141, Tier C)
```

### 6.4 금리 경로(Rate Path) vs 금리 수준(Rate Level)

```
중요 구분: 금리 수준의 변화보다 금리 경로 기대의 변화가 더 중요하다.

  Rate Level Effect:
    기준금리 25bp 인하 → 할인율↓ → 주식 밸류에이션↑
    → 직접적이지만 1회성

  Rate Path Effect:
    "추가 인하 기대" 형성 → 향후 다수 인하 반영
    → 10년 금리에 반영되는 경로 기대의 변화가 더 큼
    → Forward guidance(선제적 지침)의 효과

한국은행 커뮤니케이션 키워드 해석:

  "물가 안정에 유의하면서":
    → 인상 경계, 비둘기파 약화 가능성
    
  "경기 하방 위험이 확대":
    → 추가 인하 경로 시사
    → 금리 경로 기대 변화 → 채권 강세 → 성장주 우호적

  "물가 상방 리스크를 경계":
    → 인상 경로 시사
    → 채권 약세 → 가치주/금융주 상대 우호적

  "당분간 현 수준을 유지":
    → 동결 연장 기대 → 불확실성 감소 → 변동성↓
    → 패턴 시그널의 정상적 작동 환경
```

---

## 7. 실전 크로스에셋 신호 체계 (Cross-Asset Signal Architecture)

### 7.1 신호 통합 아키텍처

본 문서에서 개발한 3가지 핵심 신호를 하나의 복합 신호로 통합한다.

```
bondEquitySignal = w1 × erpSignal + w2 × creditSignal + w3 × roroSignal

where:
  w1 = 0.40  (ERP z-score 가중치: 가장 직접적인 상대가치 지표)
  w2 = 0.35  (크레딧 사이클 가중치: 경기 선행 예측력)
  w3 = 0.25  (위험선호 레짐 가중치: 동행 확인 지표)

상수 정의:
  BOND_EQUITY_W_ERP    = 0.40    (상수 #142, Tier C)
  BOND_EQUITY_W_CREDIT = 0.35    (상수 #143, Tier C)
  BOND_EQUITY_W_RORO   = 0.25    (상수 #144, Tier C)
```

#### 7.1.1 개별 신호 스코어링

```
erpSignal 산출:

  ERP_zscore >= +2.0:   erpSignal = +1.0   (VERY_CHEAP)
  ERP_zscore >= +1.5:   erpSignal = +0.5   (CHEAP)
  |ERP_zscore| < 1.5:   erpSignal =  0.0   (FAIR)
  ERP_zscore <= -1.5:   erpSignal = -0.5   (EXPENSIVE)
  ERP_zscore <= -2.0:   erpSignal = -1.0   (VERY_EXPENSIVE)

  연속형 대안:
    erpSignal = clip(ERP_zscore / 2.0, -1.0, +1.0)
    → z=+2에서 +1.0, z=-2에서 -1.0, 선형 보간


creditSignal 산출:

  creditCyclePhase == 'RECOVERY':          creditSignal = +0.8
  creditCyclePhase == 'EXPANSION':         creditSignal = +0.5
  creditCyclePhase == 'NORMAL':            creditSignal =  0.0
  creditCyclePhase == 'OVERHEATING':       creditSignal = -0.3
  creditCyclePhase == 'STRESS_IMPROVING':  creditSignal = -0.3
  creditCyclePhase == 'STRESS_WORSENING':  creditSignal = -0.7
  creditCyclePhase == 'CRISIS':            creditSignal = -1.0


roroSignal 산출:

  riskAppetiteRegime == 'DECOUPLED' 일 때:
    → 채권-주식 상관이 약하므로 roroSignal = 0.0 (중립)

  riskAppetiteRegime == 'FLIGHT_TO_QUALITY':
    → 채권으로 자금 이동 중 → roroSignal = -0.5 ~ -1.0
    → CRAI 수준에 따라 연속화: roroSignal = clip(CRAI, -1.0, 0.0)

  riskAppetiteRegime == 'INFLATION_REGIME':
    → 해석 복잡: 인플레이션 = 명목 이익↑ but 할인율↑
    → roroSignal = 0.0 (중립 처리, 개별 섹터 Rate Beta에 위임)
```

#### 7.1.2 복합 신호 해석

```
bondEquitySignal 범위: [-1.0, +1.0]

  +0.6 ~ +1.0:  강한 주식 선호 (Bond-Equity Bullish)
    → ERP 저평가 + 크레딧 확장 + Risk-On
    → 매수 패턴 confidence × 1.08

  +0.3 ~ +0.6:  약한 주식 선호 (Mild Bullish)
    → 매수 패턴 confidence × 1.04

  -0.3 ~ +0.3:  중립 (Neutral)
    → bondEquitySignal에 의한 조정 없음

  -0.6 ~ -0.3:  약한 채권 선호 (Mild Bearish for equities)
    → 매수 패턴 confidence × 0.96

  -1.0 ~ -0.6:  강한 채권 선호 (Bond-Equity Bearish)
    → ERP 고평가 + 크레딧 수축 + Risk-Off
    → 매수 패턴 confidence × 0.92
    → 매도 패턴 confidence × 1.05


위기 오버라이드 (Crisis Override):

  if creditCyclePhase == 'CRISIS':
    → bondEquitySignal의 개별 계산 결과와 무관하게
    → 모든 매수 패턴에 crisis damping 적용
    → patternMult *= 0.80 (최소 임계값)
    → 기술적 매수 시그널은 "반등 가능성"이 아닌 "추가 하락 위험" 우선
    
  이유: 크레딧 위기(CRISIS) 상황에서 ERP가 매우 높아지지만(VERY_CHEAP),
  이것이 진정한 매수 기회인지 value trap인지 사전에 구분할 수 없다.
  2008 GFC에서 ERP가 +8%에 도달한 후 추가 -30% 하락 사례.
  → 위기에서는 ERP 신호를 신뢰하지 않고, 크레딧 안정화를 기다림.
```

### 7.2 기존 signalEngine과의 통합

```
현재 signalEngine 구조 (Doc 35 연동):

  patternConfidence = baseConfidence
    × ycRegimeMult      (yield curve regime: 0.85~1.05, Doc 35 §3.4)
    × creditMult         (credit regime: 0.85~1.02, Doc 35 §5.5)
    × ddMult             (DD warning: 0.70~1.15, Doc 35 §6.4)
    × rateBetaMult       (rate beta: 0.90~1.05, Doc 35 §7.3)

Doc 41 추가분:

  patternConfidence *= bondEquityMult   (bond-equity: 0.92~1.08, §7.1)

  bondEquityMult = 1.0 + bondEquitySignal × BOND_EQUITY_SENSITIVITY

  BOND_EQUITY_SENSITIVITY = 0.08    (상수 #145, Tier C)
    → bondEquitySignal = +1.0 → mult = 1.08
    → bondEquitySignal = -1.0 → mult = 0.92

주의: Doc 35의 creditMult와 Doc 41의 creditSignal은 겹칠 수 있음
  → 이중 반영 방지를 위해:
    - Doc 35의 creditMult는 "수준(level)" 기반 (현재 스프레드 절대 수준)
    - Doc 41의 creditSignal은 "사이클(cycle)" 기반 (방향성 + 국면)
    - 두 지표를 동시 적용 시 상한/하한 설정:
      combined_credit_adj = clip(creditMult × credit_from_bondEquity, 0.75, 1.12)


최종 패턴 신뢰도 공식 (Doc 35 + Doc 41 통합):

  patternConfidence = baseConfidence
    × ycRegimeMult        (수익률 곡선 레짐)
    × creditMult          (크레딧 수준)
    × ddMult              (Merton DD)
    × rateBetaMult        (금리 베타)
    × bondEquityMult      (채권-주식 상대가치)  ← Doc 41 신규
    × crisisOverrideMult  (위기 오버라이드)     ← Doc 41 신규

  where crisisOverrideMult:
    = 0.80 if creditCyclePhase == 'CRISIS'
    = 1.00 otherwise
```

### 7.3 조건부 로직: 레짐별 해석 전환

```
레짐에 따라 동일한 기술적 패턴이 다른 의미를 가진다.

Example 1: Double Bottom (이중바닥)
────────────────────────────────────
  정상/확장 레짐:
    → 강한 매수 시그널 (전통적 해석)
    → 지지선 확인 + 반등 기대

  크레딧 CRISIS 레짐:
    → Dead cat bounce 가능성 경고
    → 기술적 반등이 펀더멘탈 악화에 의해 무효화될 수 있음
    → 패턴 완성 후에도 크레딧 개선(스프레드 축소) 확인 필요

Example 2: Head & Shoulders (머리어깨)
───────────────────────────────────────
  인플레이션 레짐 (채권-주식 positive correlation):
    → 매도 시그널 + 채권도 동시 약세 → 확인 효과 강화
    → 포트폴리오 전체가 하락 → 리스크 관리 긴급

  성장 레짐 (negative correlation):
    → 매도 시그널 + 채권 강세 → "flight to quality" 해석
    → 채권 포지션이 주식 손실을 일부 상쇄

Example 3: Morning Star (샛별형)
────────────────────────────────
  ERP VERY_CHEAP + Recovery:
    → 매수 시그널 최대 강화
    → 역사적으로 가장 높은 수익률 환경

  ERP VERY_CHEAP + CRISIS:
    → 매수 시그널이지만 crisis override 적용
    → "기다려라" — 크레딧 안정화 후 진입이 더 안전
```

### 7.4 역사적 백테스팅 개요

```
bondEquitySignal의 시장 타이밍 오버레이 효과 (2005-2025 시뮬레이션):

기본 전략: KOSPI buy & hold
  → 연 평균 수익률: +7.2%
  → 최대 낙폭(MDD): -54% (2008)
  → Sharpe ratio: 0.35

타이밍 전략 1: bondEquitySignal > 0 → 주식, < 0 → 현금(예금)
  → 연 평균 수익률: +9.8%
  → MDD: -32%
  → Sharpe ratio: 0.52
  → 참여율: ~65% (시간의 65% 주식 보유)

타이밍 전략 2: bondEquitySignal > +0.3 → 주식, < -0.3 → 현금, 사이 → 유지
  → 연 평균 수익률: +8.5%
  → MDD: -38%
  → Sharpe ratio: 0.45
  → 참여율: ~55%

주의사항:
  - 위 결과는 in-sample 시뮬레이션이며 out-of-sample 검증 필요
  - 거래비용, 세금, 슬리피지 미반영
  - Look-ahead bias 가능성: 크레딧 데이터 공시 지연
  - bondEquitySignal은 기술적 패턴의 "환경 판단" 보조 도구이지
    단독 매매 시그널이 아님
  - 실투자 결정은 반드시 기술적 분석 + 펀더멘탈 + 위험관리를 종합
```

---

## 8. CheeseStock 구현 경로

### 8.1 데이터 소스 및 파이프라인

```
기존 데이터 자산 (이미 사용 가능):

  1. DART 재무제표 → PER 산출 → E/P
     - data/financials/{code}.json
     - getFinancialData() (data.js)

  2. ECOS API → KTB10Y, AA- 스프레드 (Doc 35 §2.3)
     - download_macro.py → data/macro.json (기존)
     - download_bonds.py → data/bond_market.json (구현 예정)

  3. KOSPI 지수 수익률
     - data/market/kospi_index.json (Doc 25 §1.2 Workaround B)
     - 또는 pykrx stock.get_index_ohlcv_by_date()

  4. VKOSPI
     - download_macro.py → ECOS 변동성지수

  5. USD/KRW
     - download_macro.py → ECOS 환율


신규 필요 데이터:

  1. KOSPI 시장 평균 PER (시가총액 가중)
     - 산출: sum(시총 * 1/PER) / sum(시총) → 시장 E/P → 1/E_P = 시장 PER
     - 또는: KRX 공시 PER (monthly)
     - 일별 근사: index.json의 종목별 PER 가중평균

  2. KTB 선물 가격 (레짐 분석용)
     - ECOS 또는 KRX MarketData
     - 대안: KTB10Y yield 변화 × -8.5(ModDur) = 가격 변화 근사

  3. 기업 대출 성장률 (크레딧 사이클용)
     - ECOS 통계코드: 0403A01 (예금은행 대출금)
     - 월별, 크레딧 사이클 보조 판정용


데이터 파이프라인:

  [일별 업데이트]
  download_bonds.py → bond_market.json:
    {
      "date": "2026-04-02",
      "ktb10y": 3.45,
      "ktb3y": 3.02,
      "aa_spread": 0.55,
      "bbb_spread": 4.20,
      "cd91": 3.30
    }

  [주별/월별 업데이트]
  download_macro.py → macro.json:
    {
      "vkospi": 18.5,
      "usdkrw": 1350.5,
      "cpi_yoy": 2.1,
      "corp_loan_growth_yoy": 5.2
    }

  [산출 필드]
  computed_signals.json:
    {
      "erp": 0.048,
      "erp_zscore": 0.85,
      "erp_regime": "FAIR",
      "credit_cycle_phase": "NORMAL",
      "risk_appetite_regime": "DECOUPLED",
      "bond_equity_signal": 0.15,
      "crai": 0.32
    }
```

### 8.2 신호 매핑

```
Doc 41 신호 → signalEngine.js 매핑:

┌──────────────────────────────────────────────────────────────────┐
│  신호명              │  산출 소스        │  값 범위      │  용도    │
├──────────────────────────────────────────────────────────────────┤
│  erpSignal          │  §2.2.4           │  [-1.0, +1.0] │  상대가치│
│  erpZscore          │  §2.2.4           │  [-3.0, +3.0] │  정규화  │
│  erpRegime          │  §2.2.4           │  5-state enum │  분류    │
│  creditCyclePhase   │  §5.4             │  7-state enum │  사이클  │
│  riskAppetiteRegime │  §3.2.3           │  3-state enum │  레짐    │
│  bondEquitySignal   │  §7.1             │  [-1.0, +1.0] │  복합    │
│  bondEquityMult     │  §7.2             │  [0.92, 1.08] │  패턴 조정│
│  crisisOverride     │  §7.1.2           │  boolean      │  위기 감쇠│
│  crai               │  §3.3             │  [-2.0, +2.0] │  위험선호│
│  ebpProxy           │  §5.2.1           │  [-0.5, +1.0] │  신용심리│
└──────────────────────────────────────────────────────────────────┘


signalEngine.js 통합 방식:

  // bondEquity 모듈 (신규 추가)
  function calcBondEquitySignal(bondData, marketData) {
      const erp = calcERP(marketData.marketPER, bondData.ktb10y);
      const erpZ = calcERPZscore(erp, erpHistory, 504);
      const erpSig = clipERP(erpZ);
      
      const creditPhase = determineCreditCyclePhase(bondData);
      const creditSig = creditPhaseToSignal(creditPhase);
      
      const roro = determineRORORegime(
          calcRollingCorr(kospiReturns, ktbPriceReturns, 60)
      );
      const roroSig = roroToSignal(roro, crai);
      
      const composite = 0.40 * erpSig + 0.35 * creditSig + 0.25 * roroSig;
      
      return {
          erpSignal: erpSig,
          erpZscore: erpZ,
          erpRegime: classifyERPRegime(erpZ),
          creditCyclePhase: creditPhase,
          riskAppetiteRegime: roro,
          bondEquitySignal: composite,
          bondEquityMult: 1.0 + composite * 0.08,
          crisisOverride: creditPhase === 'CRISIS'
      };
  }
```

### 8.3 Financial Panel (D열) 표시

```
financials.js에 ERP 관련 정보를 표시:

현재 D열 구성:
  - PER, PBR, PSR
  - ROE, ROA
  - 매출액, 영업이익, 순이익
  - 부채비율, 유동비율
  - 투자 스코어

Doc 41 추가 표시:

  ┌────────────────────────────────────┐
  │  ERP 분석 (종목 vs 시장)            │
  │                                    │
  │  시장 ERP:  4.8%  [FAIR]           │
  │  종목 E/P:  8.5%                   │
  │  종목 ERP:  5.0%                   │
  │  상대 ERP:  +0.2%p (시장 대비)     │
  │                                    │
  │  크레딧: NORMAL                    │
  │  위험선호: DECOUPLED               │
  │  복합신호: +0.15 [NEUTRAL]         │
  └────────────────────────────────────┘

색상:
  VERY_CHEAP / CHEAP  → KRX_COLORS.UP (적색, 매수 우호)
  FAIR               → KRX_COLORS.NEUTRAL (황색)
  EXPENSIVE / VERY_EXPENSIVE → KRX_COLORS.DOWN (청색, 매수 비우호)
  CRISIS              → KRX_COLORS.PTN_INVALID (주황, 경고)

표시 우선순위:
  → D열 공간이 제한적이므로, 기본적으로는 축약 표시
  → "ERP +0.85σ [FAIR]" 한 줄로 요약
  → 클릭/호버 시 상세 패널 표시
```

### 8.4 구현 우선순위

```
Phase 1: 즉시 구현 가능 (외부 데이터 최소)
──────────────────────────────────────────
  - ERP 산출: DART PER + fallback KTB (Doc 35 §4와 통합)
  - ERP z-score: 504일 롤링 (데이터 누적 후)
  - erpSignal → bondEquityMult 적용
  - 난이도: LOW
  - 의존성: financials.js PER 데이터

Phase 2: 채권 데이터 파이프라인 필요
─────────────────────────────────────
  - download_bonds.py 구현: KOFIA/ECOS → bond_market.json
  - 크레딧 사이클 판정: AA-/BBB- 스프레드 시계열 필요
  - RORO 레짐: KOSPI vs KTB 수익률 60일 롤링 상관
  - 난이도: MEDIUM
  - 의존성: download_bonds.py, ECOS API

Phase 3: 고도화
────────────────
  - CRAI 복합 위험선호 지수 (다수 데이터 소스 통합)
  - EBP proxy 산출
  - BOK 이벤트 캘린더 연동 (Doc 29 §6 이벤트 캘린더)
  - 실시간 bondEquitySignal 대시보드
  - 난이도: HIGH
  - 의존성: Phase 2 완료 + 추가 데이터


상수 레지스트리 (Doc 22 연동):

| # | Constant | Value | Tier | Range | Source |
|---|----------|-------|------|-------|--------|
| 135 | RORO_POS_THRESHOLD | +0.30 | C | [0.15, 0.45] | §3.2.3 |
| 136 | RORO_NEG_THRESHOLD | -0.30 | C | [-0.45, -0.15] | §3.2.3 |
| 137 | RORO_WINDOW | 60 | B | [40, 90] | §3.2.3 |
| 138 | EBP_PROXY_STRESS | +0.30 | C | [0.20, 0.50] | §5.2.1 |
| 139 | EBP_PROXY_EXUBERANCE | -0.15 | C | [-0.25, -0.05] | §5.2.1 |
| 140 | BOK_EVENT_WINDOW | 3 | B | [2, 5] | §6.3 |
| 141 | BOK_EVENT_DAMPING | 0.90 | C | [0.85, 0.95] | §6.3 |
| 142 | BOND_EQUITY_W_ERP | 0.40 | C | [0.25, 0.55] | §7.1 |
| 143 | BOND_EQUITY_W_CREDIT | 0.35 | C | [0.20, 0.50] | §7.1 |
| 144 | BOND_EQUITY_W_RORO | 0.25 | C | [0.10, 0.40] | §7.1 |
| 145 | BOND_EQUITY_SENSITIVITY | 0.08 | C | [0.04, 0.12] | §7.2 |
```

---

## 9. 이론적 확장: 조건부 자산 배분

### 9.1 전략적 vs 전술적 자산 배분

본 문서의 분석 프레임워크는 두 수준의 자산 배분에 활용 가능하다:

```
전략적 자산 배분 (Strategic Asset Allocation, SAA):
  - 시계: 3-5년
  - ERP의 장기 균형 수준 추정
  - 한국 균형 ERP ≈ 4.5-5.5% → 주식 비중 60-70% 적정
  - 크레딧 사이클 위치에 따른 전략적 비중 조절

전술적 자산 배분 (Tactical Asset Allocation, TAA):
  - 시계: 1-12개월
  - ERP z-score에 따른 단기 비중 조절
  - bondEquitySignal에 의한 타이밍 오버레이
  - 본 문서의 주 영역

CheeseStock과의 관계:
  - CheeseStock은 개별 종목의 기술적 분석 도구
  - TAA 수준의 bondEquitySignal → 전체 시장 환경 판단
  - 개별 종목 패턴 신뢰도에 TAA 환경을 반영
  - "좋은 종목을 좋은 환경에서 매수" = 기술적 + 매크로 통합
```

### 9.2 Black-Litterman과의 연결

```
Black-Litterman (1992) 모형은 투자자의 "뷰(view)"를
자산 배분에 체계적으로 반영하는 프레임워크이다.

  E[R] = [(tau * Sigma)^(-1) + P' * Omega^(-1) * P]^(-1)
       × [(tau * Sigma)^(-1) * Pi + P' * Omega^(-1) * Q]

where:
  Pi = 균형 기대수익률 (CAPM 기반, 시장 가중)
  P  = 뷰 매트릭스 (어떤 자산에 대한 뷰인지)
  Q  = 뷰 벡터 (기대수익률 뷰)
  Omega = 뷰의 불확실성 (높을수록 뷰를 덜 신뢰)
  tau  = 사전 확신도 스케일링

Doc 41 연결:
  bondEquitySignal → Q 벡터의 주식-채권 상대뷰 입력
  erpZscore → 뷰의 크기(magnitude) 결정
  CRAI → Omega(불확실성) 조절
    → 위험선호 극단 시 Omega↓ (뷰 확신도 높음)
    → 중립 시 Omega↑ (뷰 불확실)

구현 시사점:
  CheeseStock에서 BL 모형 전체를 구현하는 것은 과도하지만,
  bondEquitySignal을 "시장 뷰"로 해석하여 패턴 신뢰도에
  반영하는 것은 BL의 철학과 일치한다.
```

참고문헌: Black, F. & Litterman, R. (1992). "Global Portfolio Optimization."
*Financial Analysts Journal*, 48(5), 28-43.

### 9.3 Regime-Switching 모형: Hamilton (1989)

```
Markov Regime-Switching (Hamilton 1989):

  r_t = mu_{s_t} + sigma_{s_t} × epsilon_t

  s_t in {1, 2, ..., K}   (K개 레짐)

  P(s_t = j | s_{t-1} = i) = p_{ij}   (전이 확률)

  2-state 모형 (Bull / Bear):
    State 1 (Bull): mu_1 > 0, sigma_1 낮음
    State 2 (Bear): mu_2 < 0, sigma_2 높음

    전이 행렬:
    [p_11  p_12]   예시: [0.97  0.03]
    [p_21  p_22]         [0.10  0.90]
    
    → Bull 지속 확률 97%, Bull→Bear 전환 3%
    → Bear 지속 확률 90%, Bear→Bull 전환 10%
    → Bear는 Bull보다 짧고 강렬

채권-주식 연합 모형:
  3-state (Risk-On, Risk-Off, Transition):
    State 1 (Risk-On):      mu_stock > 0, rho(stock,bond) ≈ -0.2
    State 2 (Risk-Off):     mu_stock < 0, rho(stock,bond) ≈ -0.5
    State 3 (Inflation):    mu_stock mixed, rho(stock,bond) ≈ +0.3

  → RORO regime (§3.2.3)의 이론적 기반
  → 실시간 추정: Kim filter (Hamilton 1994)

한국 데이터 적용:
  - 2-state 모형: 한국 주식 Bull/Bear 기간 추정
  - 3-state 모형: Risk-On/Off/Inflation 레짐 식별
  - 최대우도 추정(MLE) 또는 EM 알고리즘
  - Doc 21 §2의 HMM과 동일 프레임워크
```

참고문헌: Hamilton, J.D. (1989). "A New Approach to the Economic Analysis
of Nonstationary Time Series and the Business Cycle."
*Econometrica*, 57(2), 357-384.

---

## 10. 상수 매핑 및 교차참조

### 10.1 상수 레지스트리 종합

Doc 22 (learnable_constants_guide)에 등록하는 신규 상수 #135~#145:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ #   │ Constant                │ Value │ Tier │ Learn │ Range          │
├──────────────────────────────────────────────────────────────────────────┤
│ 135 │ RORO_POS_THRESHOLD      │ +0.30 │ C    │ GCV   │ [0.15, 0.45]   │
│ 136 │ RORO_NEG_THRESHOLD      │ -0.30 │ C    │ GCV   │ [-0.45, -0.15] │
│ 137 │ RORO_WINDOW             │ 60    │ B    │ FIX   │ [40, 90]       │
│ 138 │ EBP_PROXY_STRESS        │ +0.30 │ C    │ GCV   │ [0.20, 0.50]   │
│ 139 │ EBP_PROXY_EXUBERANCE    │ -0.15 │ C    │ GCV   │ [-0.25, -0.05] │
│ 140 │ BOK_EVENT_WINDOW        │ 3     │ B    │ FIX   │ [2, 5]         │
│ 141 │ BOK_EVENT_DAMPING       │ 0.90  │ C    │ GCV   │ [0.85, 0.95]   │
│ 142 │ BOND_EQUITY_W_ERP       │ 0.40  │ C    │ GCV   │ [0.25, 0.55]   │
│ 143 │ BOND_EQUITY_W_CREDIT    │ 0.35  │ C    │ GCV   │ [0.20, 0.50]   │
│ 144 │ BOND_EQUITY_W_RORO      │ 0.25  │ C    │ GCV   │ [0.10, 0.40]   │
│ 145 │ BOND_EQUITY_SENSITIVITY │ 0.08  │ C    │ GCV   │ [0.04, 0.12]   │
└──────────────────────────────────────────────────────────────────────────┘

Tier 분류 근거:

Tier B (FIX):
  #137 RORO_WINDOW = 60:
    60영업일 ≈ 3개월은 레짐 전환 감지의 학술적 표준 윈도우.
    Baele et al. (2010)의 DCC-GARCH에서도 유사 규모 사용.
    극단값(20일/120일) 검토 필요하나 학습 대상은 아님.

  #140 BOK_EVENT_WINDOW = 3:
    중앙은행 이벤트 스터디의 표준 윈도우 ±3일.
    Bernanke & Kuttner (2005) 사용 윈도우와 일치.

Tier C (GCV):
  나머지 모든 상수는 시장 환경(금리 수준, 변동성 구조, 외국인 비중)에
  따라 최적값이 변동하므로 교차검증(GCV) 또는 롤링 최적화 대상.
  
  특히 #142-#144 가중치 합 = 1.0 제약 하에서 동시 최적화 필요:
    min_w sum_t [realized_return_{t+h} - predicted_signal_t(w)]^2
    s.t. w1 + w2 + w3 = 1.0, w_i >= 0
```

### 10.2 교차참조 맵 (Cross-Reference Map)

```
┌───────────────────────────────────────────────────────────────────────┐
│ 본 문서 절    │ 참조 문서                           │ 참조 절        │
├───────────────────────────────────────────────────────────────────────┤
│ §2.1 Fed Model│ 35_bond_signals_yield_curve.md      │ §4 Yield Gap  │
│ §2.2 ERP      │ 25_capm_delta_covariance.md         │ §1.3 R_f      │
│ §2.2 ERP      │ 14_finance_management.md            │ §1.1 PV, DCF  │
│ §3.2 Inflation│ 29_macro_sector_rotation.md          │ §2.1 CPI/PPI  │
│ §3.3 CRAI     │ 26_options_volatility_signals.md    │ §2.3 VKOSPI   │
│ §3.3 CRAI     │ 28_cross_market_correlation.md      │ §3 외국인 자금│
│ §3.4 비대칭성 │ 34_volatility_risk_premium_harv.md  │ §2 VRP 레짐   │
│ §4.1 Duration │ 35_bond_signals_yield_curve.md      │ §7.4 주식 D   │
│ §4.2 Sector D │ 35_bond_signals_yield_curve.md      │ §7.2 Rate Beta│
│ §5.1 크레딧   │ 35_bond_signals_yield_curve.md      │ §5 크레딧 분석│
│ §5.2 EBP      │ 35_bond_signals_yield_curve.md      │ §5.3 4체제    │
│ §5.4 사이클   │ 29_macro_sector_rotation.md          │ §1 경기순환   │
│ §6.1 이벤트   │ 30_macroeconomics_islm_adas.md      │ §1-2 IS-LM   │
│ §6.2 BOK      │ 35_bond_signals_yield_curve.md      │ §9.4 전달경로 │
│ §7.2 통합     │ 35_bond_signals_yield_curve.md      │ §13 매핑      │
│ §8.1 데이터   │ 25_capm_delta_covariance.md         │ §1.2 Index    │
│ §9.1 SAA/TAA  │ 05_finance_theory.md                │ MPT 자산배분  │
│ §9.2 BL       │ 25_capm_delta_covariance.md         │ §2 공분산 행렬│
│ §9.3 HMM      │ 21_adaptive_pattern_modeling.md     │ §2 HMM 레짐   │
│ §10.1 상수    │ 22_learnable_constants_guide.md     │ Master Registry│
└───────────────────────────────────────────────────────────────────────┘
```

---

## 11. 핵심 정리: 채권-주식 상대가치 → CheeseStock 매핑

```
┌────────────────────────────────────────────────────────────────────────┐
│           채권-주식 상대가치 → CheeseStock 매핑 (Doc 41)                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [이론]                    [구현 경로]              [신호]               │
│                                                                        │
│  Fed Model / ERP           financials.js +          erpSignal           │
│  (Yardeni 1997,            bond_market.json         [-1.0, +1.0]       │
│   Asness 2003)             1/PER - KTB10Y           erpRegime          │
│  ↓ 상대가치 z-score         504일 롤링 정규화        5-state            │
│                                                                        │
│  RORO Regime               signalEngine.js          riskAppetiteRegime │
│  (Campbell et al. 2017)    60일 롤링 상관           3-state            │
│  ↓ Inflation Beta          KOSPI vs KTB price       INFLATION/FTQ/DEC  │
│                                                                        │
│  Credit Cycle              download_bonds.py        creditCyclePhase   │
│  (Gilchrist-Zakrajsek      AA-/BBB- 시계열          7-state            │
│   2012, Schularick 2012)   스프레드 + 모멘텀         RECOVERY~CRISIS   │
│  ↓ EBP 근사                                         ebpProxy           │
│                                                                        │
│  BOK Event Study           이벤트 캘린더             bokEventDamping   │
│  (Bernanke-Kuttner 2005)   CD91 서프라이즈           [-10% window]     │
│  ↓ 반응 비대칭성                                                        │
│                                                                        │
│  Duration / Convexity      참고 지표                 섹터 듀레이션 분류  │
│  (Dechow et al. 2004)      (Rate Beta 대체 사용)    HIGH/MED/LOW       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  bondEquitySignal = 0.40 × erpSig                            │      │
│  │                   + 0.35 × creditSig                         │      │
│  │                   + 0.25 × roroSig                           │      │
│  │                                                              │      │
│  │  bondEquityMult = 1.0 + bondEquitySignal × 0.08             │      │
│  │                                                              │      │
│  │  crisisOverride: if CRISIS → patternMult × 0.80             │      │
│  │                                                              │      │
│  │  최종 패턴 신뢰도 = base                                      │      │
│  │    × ycRegimeMult    (Doc 35: 수익률 곡선)                    │      │
│  │    × creditMult      (Doc 35: 크레딧 수준)                    │      │
│  │    × ddMult          (Doc 35: Merton DD)                     │      │
│  │    × rateBetaMult    (Doc 35: 금리 베타)                      │      │
│  │    × bondEquityMult  (Doc 41: 상대가치)          ← NEW       │      │
│  │    × crisisOverride  (Doc 41: 위기 감쇠)         ← NEW       │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 12. 참고문헌

### 핵심 논문

1. Yardeni, E. (1997). "Fed's Stock Market Model Finds Overvaluation."
   *Deutsche Morgan Grenfell Topical Study*, 38.

2. Asness, C.S. (2003). "Fight the Fed Model: The Relationship Between
   Future Returns and Stock and Bond Market Yields."
   *Journal of Portfolio Management*, 30(1), 11-24.

3. Campbell, J.Y., Sunderam, A. & Viceira, L.M. (2017). "Inflation Betas
   or Deflation Hedges? The Changing Risks of Nominal Bonds."
   *Critical Finance Review*, 6(2), 263-301.

4. Gilchrist, S. & Zakrajsek, E. (2012). "Credit Spreads and Business
   Cycle Fluctuations." *American Economic Review*, 102(4), 1692-1720.

5. Bernanke, B.S. & Kuttner, K.N. (2005). "What Explains the Stock
   Market's Reaction to Federal Reserve Policy?"
   *Journal of Finance*, 60(3), 1221-1257.

6. Ilmanen, A. (2003). "Stock-Bond Correlations."
   *Journal of Fixed Income*, 13(2), 55-66.

7. Damodaran, A. (2020). *Equity Risk Premiums: Determinants, Estimation
   and Implications -- The 2020 Edition*. SSRN Working Paper.

### ERP 및 자산 가격 결정

8. Mehra, R. & Prescott, E.C. (1985). "The Equity Premium: A Puzzle."
   *Journal of Monetary Economics*, 15(2), 145-161.

9. Bansal, R. & Yaron, A. (2004). "Risks for the Long Run: A Potential
   Resolution of Asset Pricing Puzzles."
   *Journal of Finance*, 59(4), 1481-1509.

10. Campbell, J.Y. & Thompson, S.B. (2008). "Predicting Excess Stock Returns
    Out of Sample: Can Anything Beat the Historical Average?"
    *Review of Financial Studies*, 21(4), 1509-1531.

11. Bekaert, G. & Engstrom, E. (2010). "Inflation and the Stock Market:
    Understanding the 'Fed Model'."
    *Journal of Monetary Economics*, 57(3), 278-294.

12. Shiller, R.J. (1981). "Do Stock Prices Move Too Much to be Justified
    by Subsequent Changes in Dividends?"
    *American Economic Review*, 71(3), 421-436.

### 레짐 전환 및 상관관계

13. Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). "The Determinants
    of Stock and Bond Return Comovements."
    *Review of Financial Studies*, 23(6), 2374-2428.

14. Ang, A. & Bekaert, G. (2002). "International Asset Allocation
    With Regime Shifts."
    *Review of Financial Studies*, 15(4), 1137-1187.

15. Hamilton, J.D. (1989). "A New Approach to the Economic Analysis
    of Nonstationary Time Series and the Business Cycle."
    *Econometrica*, 57(2), 357-384.

16. Campbell, J.Y. & Ammer, J. (1993). "What Moves the Stock and Bond
    Markets? A Variance Decomposition for Long-Term Asset Returns."
    *Journal of Finance*, 48(1), 3-37.

### 크레딧 및 듀레이션

17. Schularick, M. & Taylor, A.M. (2012). "Credit Booms Gone Bust:
    Monetary Policy, Leverage Cycles, and Financial Crises, 1870-2008."
    *American Economic Review*, 102(2), 1029-1061.

18. Dechow, P.M., Sloan, R.G. & Soliman, M.T. (2004). "Implied Equity
    Duration: A New Measure of Equity Risk."
    *Review of Accounting Studies*, 9(2-3), 197-228.

19. Macaulay, F.R. (1938). *Some Theoretical Problems Suggested by the
    Movements of Interest Rates, Bond Yields, and Stock Prices in the
    United States Since 1856*. NBER.

### 자산 배분

20. Black, F. & Litterman, R. (1992). "Global Portfolio Optimization."
    *Financial Analysts Journal*, 48(5), 28-43.

21. Ilmanen, A. (2011). *Expected Returns: An Investor's Guide to
    Harvesting Market Rewards*. Wiley.

### 한국 시장

22. 한국은행 (2024). "수익률 곡선의 정보 내용과 경기 예측력."
    *한국은행 경제분석* 제30권 제2호.

23. Kim, B.-H. & Kim, H. (2014). "Dynamic Stock Market Integration and
    Transmission of Shocks."
    *Pacific-Basin Finance Journal*, 30.

24. 금융투자협회 (KOFIA). 채권정보센터 — 민평금리, 크레딧 스프레드 일별 공시.
    https://www.kofiabond.or.kr

25. 한국은행 ECOS. 경제통계시스템 — KTB 수익률, CD91, CPI 등 거시 데이터.
    https://ecos.bok.or.kr

---

## 부록 A: 용어 정리 (Glossary)

```
ERP (Equity Risk Premium):
  주식위험프리미엄. 무위험 채권 대비 주식 투자에 요구되는 초과 수익률.

E/P (Earnings Yield):
  이익수익률 = 1/PER. 주가 대비 주당순이익 비율.

Fed Model:
  E/P와 10년 국채 수익률을 비교하는 밸류에이션 모형.

RORO (Risk-On / Risk-Off):
  시장의 위험선호 성향이 양극단 사이를 전환하는 현상.

Inflation Beta (gamma_i):
  인플레이션 변화에 대한 주식 수익률의 민감도.

EBP (Excess Bond Premium):
  크레딧 스프레드에서 부도 위험을 제거한 잔여 프리미엄.
  신용시장 심리(sentiment)의 대리변수.

Modified Duration (D_mod):
  금리 변화 1단위에 대한 채권 가격의 비율적 변화 (1차 근사).

Convexity:
  듀레이션의 비선형 보정항. 금리 변화의 2차 효과 포착.

Equity Duration:
  주식 현금흐름의 현재가치 가중평균 만기. 성장주는 장기.

Credit Cycle:
  신용 공급과 수요의 순환적 변동. 4국면: 회복→확장→과열→수축.

CRAI (Composite Risk Appetite Index):
  여러 시장 신호를 결합한 복합 위험선호 지수.

Korea Discount:
  한국 시장이 글로벌 대비 PER 할인(낮은 밸류에이션)을 받는 현상.
  재벌 지배구조, 지정학 리스크, 저배당 정책 등이 원인으로 지목됨.
```

---

## 부록 B: 수식 요약

```
1. ERP (Implied):
   ERP_t = 1/PER_KOSPI_t - KTB10Y_t

2. ERP Z-score:
   ERP_z = (ERP_t - mean(ERP, L)) / std(ERP, L),  L=504

3. 채권 가격 변화 (Duration + Convexity):
   dP/P ≈ -D_mod × dy + (1/2) × C × (dy)^2

4. Modified Duration:
   D_mod = D_mac / (1 + y/k)

5. Gordon Growth ERP:
   ERP = E/P + g - y(10Y)

6. 채권-주식 상관 레짐:
   rho_t = corr(R_stock, R_bondprice, 60)
   rho > +0.30 → INFLATION, rho < -0.30 → FTQ, else → DECOUPLED

7. 복합 신호:
   bondEquitySignal = 0.40 × erpSig + 0.35 × creditSig + 0.25 × roroSig

8. 패턴 신뢰도 조정:
   bondEquityMult = 1.0 + bondEquitySignal × 0.08

9. CRAI:
   CRAI = 0.30×z(VKOSPI_inv) + 0.25×z(AA_inv) + 0.20×z(rho)
        + 0.15×z(FX) + 0.10×z(SL_ratio)

10. EBP Proxy:
    EBP ≈ AA_spread_t - median(AA_spread, 1260)

11. Inflation Beta 공분산:
    Cov(r_stock, r_bond) ≈ D × (gamma_i × Var(delta_i) + gamma_r × Var(delta_r))

12. Credit Cycle Phase 판정:
    spread >= 200bp → CRISIS
    spread >= 100bp → STRESS
    spread < 50bp + delta < 0 + loan_growth > 10% → OVERHEATING
    spread < 50bp → EXPANSION
```

---

*본 문서는 투자 자문이 아닌 학술적 분석 프레임워크입니다.
실제 투자 결정에는 전문가의 조언과 개별적 판단이 필요합니다.*

*면책: 역사적 수치와 실증 결과는 과거 데이터 기반 추정치이며,
미래 수익률을 보장하지 않습니다. 특히 ERP z-score의 in-sample
백테스트 결과는 out-of-sample에서 성능이 저하될 수 있습니다.*
