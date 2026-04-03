# Doc 42: 자산가격결정 모형의 심화 이론 — Advanced Asset Pricing Models

> "자본자산 가격결정 모형은 물리학의 뉴턴 역학과 같다.
> 틀렸다는 것을 알지만, 그것 없이는 다음 단계로 나아갈 수 없다."
> -- Fischer Black, *Beta and Return*, Journal of Portfolio Management (1993)

> "The history of asset pricing is essentially the history of trying to explain
> why the CAPM doesn't work."
> -- John Cochrane, *Asset Pricing* (2005), Princeton University Press, p. 1

---

## 1. 개요 (Overview)

### 1.1 문서의 위치와 목적

본 문서는 CheeseStock 코어 이론 체계에서 **자산가격결정 모형의 심화 이론**을
다룬다. 기존 문서들이 CAPM의 기본 공식, 실용적 베타 추정, 그리고 APT의 간략한
소개를 제공했다면, 본 문서는 그 사이에 존재하는 **이론적 간극(theoretical gap)**을
채우는 것이 목적이다.

구체적으로, 다음 질문들에 답한다:

```
Q1. CAPM 이전에 무엇이 있었는가?         → Sharpe 단일지수 모형 (§2)
Q2. 무위험자산이 없으면 어떻게 되는가?       → Zero-Beta CAPM (§3)
Q3. 투자자가 미래를 걱정하면?              → ICAPM (§4)
Q4. 소비가 자산가격을 결정한다면?           → CCAPM (§5)
Q5. APT는 정확히 어떻게 도출되는가?        → 정식 APT 도출 (§6)
Q6. FF 5-Factor의 경제적 직관은?          → FF5 심화 (§7)
Q7. 이 모형들은 어떤 관계인가?             → 통합 계보 (§8)
Q8. CheeseStock에 어떻게 적용되는가?      → 구현 경로 (§9)
```

### 1.2 기존 문서와의 관계

| 주제 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| CAPM 기본 공식, alpha, CML, SML | 05번 §3.1-3.5 | — (참조만, 중복 없음) |
| Fama-French 3/5-Factor 개요 | 05번 §4.1-4.2 | 2x3 정렬 구성법, RMW/CMA 경제적 직관 |
| APT 기본 공식, FF 연결 | 23번 전체 | 정식 차익거래 도출, CAPM vs APT 비교 |
| CAPM beta 추정 4방법 | 25번 §1.2-1.5 | 단일지수 모형(beta 이전의 이론적 기반) |
| Jensen's Alpha, Delta, Covariance | 25번 §1-6 | ICAPM의 alpha 해석, 다중 beta 체계 |
| WACC, Sharpe/Sortino/Treynor | 14번 §2.3, §7 | — (참조만) |
| BSM, IV, VKOSPI | 05번 §5, 26번 | ICAPM 상태변수로서의 변동성 |
| EMH, 적응적 시장 가설 | 05번 §1, §6 | ICAPM→APT→FF의 이론적 정당성 |
| VRP, HAR-RV | 34번 §2-4 | ICAPM 변동성 헤지 수요의 이론적 근거 |
| KRX 구조적 이상 | 20번 §1-6 | Zero-Beta CAPM의 KRX 적용 근거 |
| 공매도 제약 | 40번 §1-3 | 공매도 금지→Zero-Beta CAPM 우월성 |
| 채권-주식 ERP | 41번 §2 | ERP의 CAPM/ICAPM 이론적 기반 |
| 모멘텀, AMH | 05번 §4.3, §6 | 모멘텀의 ICAPM 상태변수 해석 |

### 1.3 핵심 주장 요약

본 문서의 핵심 주장은 다음과 같다:

```
1. CAPM은 유용하지만 불완전하다
   → 단일 시장 베타로는 KRX 수익률의 체계적 변동을 설명할 수 없다

2. Zero-Beta CAPM은 한국 시장에 더 적합하다
   → 2023-2025 공매도 금지, 차입 제약이 CAPM의 무위험 차입 가정을 위배

3. ICAPM이 다중 팩터 모형의 이론적 정당성을 제공한다
   → MRA의 17열 Ridge 회귀에 포함된 매크로 팩터(금리, 변동성, 환율)는
     ICAPM 상태변수의 경험적 대리변수(empirical proxies)이다

4. APT는 ICAPM보다 약한 가정에서 동일한 결론에 도달한다
   → 차익거래 불가 조건(no-arbitrage)만으로 다중 팩터 가격결정이 가능

5. Fama-French 요인은 APT의 특수한 경험적 구현이다
   → 요인의 정체성은 이론이 아닌 데이터에서 결정된다

결론: CheeseStock의 MRA 파이프라인은 사실상 APT의 구현이며,
     ICAPM이 그 이론적 정당성을 제공한다.
```

---

## 2. Sharpe 단일지수 모형 (Single-Index Model)

### 2.1 배경과 동기

William Sharpe (1963), *A Simplified Model for Portfolio Analysis*,
Management Science, 9(2), 277-293

Markowitz (1952)의 평균-분산 최적화는 이론적으로 완벽했지만, 실무적으로 치명적인
문제가 있었다: **N개 종목의 포트폴리오를 구성하려면 N(N-1)/2개의 공분산 추정이
필요하다.**

```
N종목 포트폴리오에 필요한 모수(parameter) 수:

  기대수익률:  N개
  분산:        N개
  공분산:      N(N-1)/2개
  ─────────────────────
  합계:        N(N+3)/2개

예시:
  N = 50   →  1,325개 모수
  N = 100  →  5,150개 모수
  N = 500  →  125,750개 모수
  N = 2,700 (KRX 전체) → 3,646,350개 모수
```

1960년대의 컴퓨팅 환경에서 이 규모의 공분산 행렬 추정은 불가능했다.
Sharpe는 이 문제를 **단일지수 모형(Single-Index Model)**으로 극적으로 단순화했다.

### 2.2 모형 정의

```
단일지수 모형 (Market Model):

  R_i,t = alpha_i + beta_i * R_m,t + epsilon_i,t

  R_i,t:      종목 i의 t기 수익률
  R_m,t:      시장 포트폴리오의 t기 수익률
  alpha_i:    종목 i의 절편 (비조건부 초과수익)
  beta_i:     종목 i의 시장 민감도 (체계적 위험 노출)
  epsilon_i,t: 종목 i의 t기 잔차 (고유 충격)
```

### 2.3 핵심 가정

```
가정 1: E[epsilon_i,t] = 0
  → 잔차의 기대값은 0이다 (평균적으로 특이 충격은 없다)

가정 2: Var(epsilon_i,t) = sigma^2_epsilon_i  (상수)
  → 각 종목의 고유 분산은 시간에 따라 일정하다 (동분산성)

가정 3: Cov(epsilon_i, epsilon_j) = 0  for all i != j
  → 종목 간 잔차는 무상관이다 (핵심 단순화 가정)
  → 모든 공변동(co-movement)은 시장 요인을 통해서만 발생한다

가정 4: Cov(epsilon_i,t, R_m,t) = 0
  → 잔차는 시장 수익률과 무상관이다
```

**가정 3이 핵심이다.** 종목 간의 공변동(co-movement)이 오직 시장 지수에 대한
공통 반응에서만 발생한다는 가정이다. 이 가정 하에서 공분산은 다음과 같이 단순화된다:

```
Cov(R_i, R_j) = beta_i * beta_j * sigma^2_m

  증명:
  Cov(R_i, R_j) = Cov(alpha_i + beta_i*R_m + eps_i,  alpha_j + beta_j*R_m + eps_j)
                = beta_i * beta_j * Var(R_m) + Cov(eps_i, eps_j)
                = beta_i * beta_j * sigma^2_m + 0   [가정 3에 의해]
                = beta_i * beta_j * sigma^2_m
```

### 2.4 총 분산 분해 (Variance Decomposition)

```
총 분산 = 체계적 분산 + 비체계적 분산

sigma^2_i = beta_i^2 * sigma^2_m + sigma^2_epsilon_i

  sigma^2_i:         종목 i의 총 분산
  beta_i^2 * sigma^2_m: 체계적 위험 (시장에서 오는 위험, 분산투자 불가)
  sigma^2_epsilon_i:   비체계적 위험 (고유 위험, 분산투자로 제거 가능)
```

이 분해는 투자 이론의 가장 중요한 통찰 중 하나를 수학적으로 표현한다:
**분산투자는 비체계적 위험만 제거할 수 있으며, 체계적 위험은 남는다.**

### 2.5 결정계수 (R-squared)

```
R^2_i = beta_i^2 * sigma^2_m / sigma^2_i

      = 체계적 분산 / 총 분산
      = 시장 요인이 설명하는 수익률 변동 비율
```

R^2 해석 가이드:

```
R^2 > 0.50: 시장 지수 추종형 (삼성전자, SK하이닉스 등 대형주)
            → beta가 수익률의 주 결정 요인
            → 패턴 분석의 부가가치가 상대적으로 낮음

R^2 = 0.20~0.50: 일반적 수준 (대부분의 KOSPI 중형주)
            → 시장 요인과 고유 요인이 혼합
            → 패턴 분석이 고유 요인을 포착할 여지 있음

R^2 < 0.20: 고유 요인 지배 (KOSDAQ 소형주, 바이오, 테마주)
            → 시장 방향과 무관하게 개별 이벤트에 좌우
            → 패턴 분석의 부가가치가 가장 높은 영역
            → 그러나 동시에 예측 자체가 가장 어려운 영역
```

### 2.6 모수 감소 효과

```
단일지수 모형에서 필요한 모수:

  alpha_i:     N개
  beta_i:      N개
  sigma^2_eps_i: N개
  E[R_m]:      1개
  sigma^2_m:   1개
  ─────────────
  합계:        3N + 2개

비교:
  완전 공분산:  N(N+3)/2 = O(N^2)
  단일지수:     3N + 2    = O(N)

  N = 2,700 (KRX):
    완전 공분산: 3,646,350개
    단일지수:    8,102개
    감소율:      99.78%
```

이 극적인 차원 감소가 Sharpe 모형의 핵심 기여이다. 현대의 컴퓨팅 환경에서도
공분산 행렬 추정의 노이즈를 줄이기 위해 단일지수 모형의 구조적 제약이
**정규화(regularization)**로서 유용하다.

### 2.7 한계

가정 3 (Cov(eps_i, eps_j) = 0)은 실제로 위배된다:

```
위배 사례:
  1. 산업 효과: 같은 업종(반도체, 자동차) 종목들은 시장과 무관한 공통 충격을 공유
  2. 규모 효과: 소형주끼리의 잔차 상관이 0이 아님 (Fama-French SMB의 근거)
  3. 스타일 효과: 가치주끼리, 성장주끼리 잔차 상관 존재

해결책:
  → 다중지수 모형 (Multi-Index Model): R_i = alpha + beta_m*R_m + beta_s*SMB + ...
  → 이것이 바로 Fama-French 모형 (§7)과 APT (§6)의 출발점
```

### 2.8 KRX 적용

**기존 구현과의 연결:**

`compute_capm_beta.py`는 Sharpe의 단일지수 모형의 직접적 구현이다. OLS 회귀로
alpha_i와 beta_i를 추정하고, R^2를 산출한다. Scholes-Williams (1977) 보정이
thin trading에 대해 적용된다.

```
코드 매핑:
  scripts/compute_capm_beta.py  → Single-Index OLS regression
  → alpha_i = Jensen's Alpha (05_finance_theory.md §3.2)
  → beta_i  = CAPM Beta (25_capm_delta_covariance.md §1.2)
  → R^2_i   = 체계적 위험 비율
```

실증 결과 (2026-03-30, 2,628 stocks):

```
KOSPI beta 통계:
  mean:   0.75    (시장보다 평균적으로 둔감)
  median: 0.68
  std:    0.48

KOSDAQ beta 통계:
  mean:   0.83
  median: 0.77
  std:    0.55

R^2 분포 (추정):
  KOSPI 대형주 (상위 50): R^2 ≈ 0.40-0.65
  KOSPI 중형주: R^2 ≈ 0.15-0.40
  KOSDAQ: R^2 ≈ 0.05-0.25
```

KRX 시장에서 R^2가 전반적으로 낮다는 사실은, 단일지수 모형의 설명력이 제한적이며
다중 팩터 모형(APT/FF)이 필요하다는 경험적 증거이다.

교차 참조: 25_capm_delta_covariance.md §1.2-1.5 (beta 추정 4방법)

---

## 3. Zero-Beta CAPM (Black 1972)

### 3.1 배경과 동기

Fischer Black (1972), *Capital Market Equilibrium with Restricted Borrowing*,
Journal of Business, 45(3), 444-455

표준 CAPM (Sharpe-Lintner)의 가장 비현실적인 가정 중 하나는
**모든 투자자가 무위험이자율로 자유롭게 차입/대출할 수 있다**는 것이다.

```
표준 CAPM의 무위험 차입/대출 가정:

  모든 투자자 → 동일한 Rf로 차입 가능
            → 동일한 Rf로 대출(예금) 가능
            → 무제한 차입 가능
            → 공매도 자유

현실:
  차입금리 >> 예금금리 (스프레드 존재)
  신용등급에 따라 차입금리 상이
  레버리지 한도 존재 (margin requirement)
  공매도 제한/금지 (KRX 2023-2025)
```

Black (1972)은 **무위험자산의 존재를 가정하지 않고** CAPM을 도출했다.
이것이 Zero-Beta CAPM이다.

### 3.2 Zero-Beta 포트폴리오 정의

```
Zero-Beta 포트폴리오 (R_z):

  beta_z = Cov(R_z, R_m) / Var(R_m) = 0

즉, 시장 포트폴리오와 완전히 무상관인 포트폴리오이다.

구성 방법:
  min sigma^2_z
  subject to:
    beta_z = 0   (시장과 무상관)
    sum(w_i) = 1  (예산 제약)

이는 효율적 프론티어 위의 최소분산 포트폴리오 중
시장 포트폴리오와 공분산이 0인 것을 찾는 문제이다.
```

기하학적 해석:

```
E[R]
 |           / 효율적 프론티어
 |          /
 |         / ← M (시장 포트폴리오)
 |        /
 |       /
 E[Rz]──/──────── Zero-Beta CAPM의 "절편"
 |     /
 |    /  ← zero-beta portfolio z
 |   /     (M과 무상관, 최소분산)
 Rf /  ← 표준 CAPM의 절편 (Rf < E[Rz])
 └─────────────→ beta

핵심: E[Rz] > Rf
  → Zero-Beta 포트폴리오의 기대수익률은 무위험이자율보다 높다
  → 이는 위험 0이 아닌, 체계적 위험 0인 포트폴리오이기 때문이다
  → 비체계적 위험(sigma^2_epsilon)에 대한 보상이 포함됨
```

### 3.3 Zero-Beta CAPM 공식

```
Zero-Beta CAPM:

  E[R_i] = E[R_z] + beta_i * (E[R_m] - E[R_z])

  E[R_z]:    zero-beta 포트폴리오의 기대수익률
  beta_i:    종목 i의 시장 베타 (표준 CAPM과 동일한 정의)
  E[R_m]:    시장 포트폴리오의 기대수익률

비교:
  표준 CAPM:     E[R_i] = Rf      + beta_i * (E[R_m] - Rf)
  Zero-Beta:     E[R_i] = E[R_z]  + beta_i * (E[R_m] - E[R_z])

차이:
  Rf → E[R_z]로 대체
  E[R_z] > Rf이므로:
    → SML의 절편이 상승
    → SML의 기울기(시장 위험 프리미엄)가 감소
    → 고베타 종목의 기대수익률이 표준 CAPM보다 낮게 예측됨
    → 저베타 종목의 기대수익률이 표준 CAPM보다 높게 예측됨
```

### 3.4 경험적 증거

```
SML 실증 회귀: E[R_i] = gamma_0 + gamma_1 * beta_i

표준 CAPM 예측:  gamma_0 = Rf,    gamma_1 = E[R_m] - Rf
Zero-Beta 예측:  gamma_0 = E[R_z], gamma_1 = E[R_m] - E[R_z]

실증 결과 (Fama & MacBeth 1973, 미국 시장):
  gamma_0 > Rf  (절편이 무위험이자율보다 유의하게 높음)
  gamma_1 < E[R_m] - Rf  (기울기가 시장 위험 프리미엄보다 유의하게 낮음)

→ Zero-Beta CAPM과 일치
→ 표준 CAPM은 고베타를 과대보상, 저베타를 과소보상하는 경향
→ 이것이 "저변동성 이상(low-volatility anomaly)"의 이론적 근거 중 하나
```

Frazzini & Pedersen (2014), *Betting Against Beta*, Journal of Financial
Economics:

```
BAB (Betting Against Beta) 전략:
  Long: 저베타 종목 (레버리지 적용하여 beta = 1로 조정)
  Short: 고베타 종목 (디레버리지하여 beta = 1로 조정)
  → 유의한 양의 alpha 관측

이론적 설명:
  차입 제약이 있는 투자자 → 고베타 종목을 과도하게 선호
  → 고베타 종목 과대평가, 저베타 종목 과소평가
  → Zero-Beta CAPM의 예측과 일치
```

### 3.5 KRX 적용: 공매도 금지와 Zero-Beta CAPM

**한국 시장은 Zero-Beta CAPM의 교과서적 적용 사례이다.**

```
KRX 공매도 규제 역사:
  2008.10 ~ 2009.06: 전면 금지 (글로벌 금융위기)
  2011.08 ~ 2011.11: 전면 금지 (유럽 재정위기)
  2020.03 ~ 2021.05: 전면 금지 (COVID-19)
  2023.11 ~ 2025.03: 전면 금지 (무차입 공매도 적발)
  2025.03 ~ : 부분 재개 (KOSPI200, KOSDAQ150 한정)

누적 금지 기간: 2008 이후 약 5.5년 (전체의 약 30%)
```

공매도 금지가 자산가격결정에 미치는 영향:

```
1. 비관적 정보의 반영 차단
   → Miller (1977): 공매도 제약 → 낙관 편향 → 체계적 고평가
   → 40_short_selling_securities_lending.md §1 참조

2. 무위험 차입의 실질적 불가
   → 차입 매도 불가 → 레버리지 제한 → 표준 CAPM 가정 위배
   → Zero-Beta CAPM이 더 적절한 균형 모형

3. 저베타 이상 현상 강화
   → 고베타 종목의 초과수요 (대안 부재) → 과대평가
   → 저베타 종목의 상대적 과소평가 (매수 수요 부족)

4. SML 기울기 평탄화
   → 표준 CAPM 대비 고베타 보상 감소
   → 이는 한국 시장의 "코리아 디스카운트"의 일부를 설명할 수 있음
```

**구현 시사점:**

```
현행 시스템 (compute_capm_beta.py):
  alpha_i = R_i - [Rf + beta_i * (R_m - Rf)]   (표준 CAPM alpha)

Zero-Beta 보정 alpha:
  alpha_i_ZB = R_i - [E[R_z] + beta_i * (R_m - E[R_z])]

E[R_z] 추정 방법:
  1. Fama-MacBeth 횡단면 회귀에서 gamma_0 추출
  2. beta ≈ 0인 종목들의 평균 수익률 (경험적 대리변수)
  3. 국고채 3년 + spread 가산 (heuristic)

KRX 데이터로 E[R_z] 추정:
  beta < 0.1 인 종목 (약 50-80개) 의 평균 수익률
  → data/backtest/capm_beta.json에서 추출 가능
```

교차 참조:
- 05_finance_theory.md §3.5 (분리 정리의 한계 → 본 문서 §3)
- 20_krx_structural_anomalies.md §5 (개인투자자 집중)
- 40_short_selling_securities_lending.md §2-3 (KRX 공매도 제도)

---

## 4. ICAPM (Intertemporal Capital Asset Pricing Model)

### 4.1 배경과 동기

Robert C. Merton (1973), *An Intertemporal Capital Asset Pricing Model*,
Econometrica, 41(5), 867-887 (1997 노벨 경제학상)

표준 CAPM은 **단일 기간(one-period)** 모형이다:

```
CAPM의 암묵적 가정:
  - 투자자는 한 기간만 투자한다 (one-shot decision)
  - 투자 기회 집합(investment opportunity set)이 시간에 따라 변하지 않는다
  - "내일의 기대수익률/변동성은 오늘과 같다"

현실:
  - 투자자는 다기간(multi-period)에 걸쳐 연속적으로 의사결정한다
  - 금리, 변동성, 성장 전망 등이 시시각각 변한다
  - "내일 금리가 오르면 나의 미래 투자 기회가 달라진다"
```

Merton은 이 문제를 **연속시간 동적 최적화(continuous-time dynamic optimization)**로
해결했다. 투자자는 현재의 부(wealth)뿐 아니라, **미래의 투자 기회 집합 변화**에
대해서도 헤지(hedge)하고자 한다.

### 4.2 모형 구조

```
Merton의 ICAPM:

  E[R_i] - R_f = beta_{i,M} * (E[R_M] - R_f) + SUM_k beta_{i,k} * lambda_k

  beta_{i,M} = Cov(R_i, R_M) / Var(R_M)
    → 시장 베타 (표준 CAPM과 동일한 정의)

  beta_{i,k} = Cov(R_i, Delta_s_k) / Var(Delta_s_k)
    → 상태변수 k에 대한 헤지 베타 (hedging beta)
    → Delta_s_k = 상태변수 k의 혁신(innovation, 예상치 못한 변화)

  lambda_k = 상태변수 k에 대한 위험 프리미엄
    → 투자자가 해당 상태변수 노출에 대해 요구하는 보상

상태변수 (state variables):
  투자 기회 집합의 변화를 결정하는 거시경제 변수들
  s_1 = 이자율 변화 (Delta_r)
  s_2 = 변동성 변화 (Delta_sigma)
  s_3 = 소비 기회 집합의 변화
  s_4 = 인플레이션 변화 (Delta_pi)
  ...
```

### 4.3 핵심 혁신: 헤지 수요 (Hedging Demand)

```
CAPM 투자자의 행동:
  "기대수익률 대비 위험을 최적화한다"
  → mean-variance 최적화 (단일 기간)

ICAPM 투자자의 행동:
  "기대수익률 대비 위험을 최적화한다"
  + "미래 투자 기회의 악화에 대비한다"
  → mean-variance 최적화 + 헤지 수요 (다기간)

헤지 수요 예시:

  상태변수: 이자율(r)
  시나리오: 향후 이자율 상승이 예상됨

  CAPM 투자자: 현재 기대수익률/위험만 고려
  ICAPM 투자자: 이자율 상승 → 채권 가격 하락 → 미래 채권 투자 기회 악화
               → 이자율 상승에 양의 상관을 가진 자산을 현재 더 많이 보유
               → 해당 자산의 가격 상승 → 요구수익률 하락 → 음의 lambda

  결과: 이자율 변화에 민감한 종목은 추가적인 위험 프리미엄(양 또는 음)을 갖는다
        이것이 CAPM의 시장 베타만으로는 설명되지 않는 수익률 변동의 원인이다
```

### 4.4 ICAPM과 다중 팩터 모형의 연결

ICAPM의 가장 중요한 이론적 기여는 **다중 팩터 모형에 경제적 정당성을 부여한 것**이다.

```
순서 정리:

  CAPM (1964):  E[R_i] = Rf + beta_M * MRP
                → 1 factor (market)
                → 경험적으로 불충분 (Fama & French 1992)

  FF3 (1993):   E[R_i] = Rf + b*MKT + s*SMB + h*HML
                → 3 factors (경험적으로 발견)
                → 질문: "왜 크기와 가치가 가격결정 요인인가?"

  ICAPM 답변:   SMB와 HML은 ICAPM의 상태변수에 대한 경험적 대리변수이다
                → SMB: 경기 침체 시 소형주가 더 큰 타격 → 경기 변동 상태변수
                → HML: 금리 변화 시 가치주가 더 민감 → 이자율 상태변수
                → 이들이 가격결정 요인인 이유 = 미래 투자 기회 변화를 포착

  APT (1976):   E[R_i] = Rf + SUM b_k*lambda_k
                → K factors (무차익 조건에서 도출)
                → APT는 요인의 정체성을 말하지 않음
                → ICAPM이 요인의 경제적 정체성을 제공
```

이 관계를 정리하면:

```
ICAPM = 요인이 "왜" 가격결정 요인인지 설명하는 이론
APT   = 요인이 "존재한다면" 가격결정이 "어떻게" 이루어지는지 설명하는 이론
FF    = 구체적으로 "어떤" 요인이 경험적으로 유효한지 보여주는 실증 결과

ICAPM이 동기부여 → APT가 형식 제공 → FF가 경험적 내용 채움
```

### 4.5 상태변수 식별 문제 (State Variable Identification)

ICAPM의 실무적 한계는 **상태변수의 사전 식별이 필요하다**는 것이다.

```
이론이 말하는 것:
  "투자 기회 집합의 변화를 예측하는 변수가 상태변수이다"

이론이 말하지 않는 것:
  "구체적으로 어떤 변수가 상태변수인가"

후보 상태변수 (학술 문헌에서 제안된 것들):

| 상태변수 | 학술 근거 | 경제적 직관 |
|---------|----------|-----------|
| 금리 수준 (r) | Merton (1973) 원형 | 할인율 변화 → 모든 자산 가치 재평가 |
| 금리 기간구조 (slope) | Campbell (1996) | 경기 전망 변화 신호 |
| 시장 변동성 (sigma) | Campbell (1993) | 위험 수준 변화 → 위험자산 매력도 변화 |
| 배당수익률 (D/P) | Fama-French (1988) | 장기 기대수익률 예측 |
| 소비 성장률 | Breeden (1979) | 실물 경제 상태 (§5 CCAPM 참조) |
| 크레딧 스프레드 | Fama-French (1993) | 기업 부도 위험 프리미엄 변화 |
| 인플레이션 | Campbell-Vuolteenaho (2004) | 실질 수익률 재평가 |

→ 정답은 없다. 어떤 변수가 "투자 기회 집합을 예측하는가?"는 경험적 문제이다.
```

### 4.6 KRX 적용: MRA 파이프라인의 이론적 정당성

**ICAPM은 CheeseStock의 MRA 17열 Ridge 회귀에 포함된 매크로 팩터에
이론적 정당성을 부여한다.**

```
MRA 17열의 ICAPM 해석:

열 1-12: 패턴 고유 특성 (hw, vw, mw, confidence, signal 등)
  → 비체계적 요인 (ICAPM의 epsilon에 해당)
  → APT 관점에서는 고유 팩터

열 13: momentum_60d (60일 수익률)
  → ICAPM 상태변수: 시장 모멘텀 / 추세 지속성
  → 경제적 직관: 최근 성과가 미래 기회를 예측

열 14: beta_60d (60일 롤링 베타)
  → ICAPM의 시장 베타 (beta_{i,M})
  → 경제적 직관: 시장 위험 노출의 시변적 측정

열 15: value_inv_pbr (1/PBR, 가치 요인)
  → ICAPM 상태변수: 할인율 변화에 대한 민감도
  → 경제적 직관: 가치주는 이자율 상승에 더 민감

열 16: log_size (시가총액 로그)
  → ICAPM 상태변수: 경기 변동에 대한 민감도
  → 경제적 직관: 소형주는 경기 침체에 더 취약

열 17: liquidity_20d (20일 거래 회전율)
  → ICAPM 상태변수: 시장 유동성 상태 변화
  → 경제적 직관: 비유동 자산은 유동성 위기 시 더 큰 손실

Phase 4-1 실증 (297K samples):
  17열 Ridge WF IC: 0.0998 (12열 대비 +0.0430)
  모든 APT 팩터 p < 0.001
  → ICAPM 상태변수 대리변수의 유의한 가격결정력 확인
```

추가적으로, `data/macro/` 디렉토리의 매크로 데이터는 ICAPM 상태변수의
직접적인 측정값으로 해석할 수 있다:

```
data/macro/macro_latest.json:
  BOK 기준금리 → 금리 상태변수 (s_1)
  USD/KRW 환율 → 글로벌 위험선호 상태변수

data/macro/bonds_latest.json:
  국고채 3년/10년 → 금리 기간구조 상태변수

data/macro/ff3_factors.json:
  MKT, SMB, HML → ICAPM 상태변수의 경험적 요인

VKOSPI (26_options_volatility_signals.md):
  → 변동성 상태변수 (s_2)
  → VRP = IV^2 - RV^2 (34_volatility_risk_premium_harv.md §2)
```

교차 참조:
- 05_finance_theory.md §3.1 (CAPM 기본 공식)
- 23_apt_factor_model.md (APT와의 관계)
- 25_capm_delta_covariance.md §2 (Delta = 팩터 민감도)
- 34_volatility_risk_premium_harv.md §2 (VRP = ICAPM 변동성 프리미엄)
- 41_bond_equity_relative_value.md §2 (ERP = ICAPM 시장 위험 프리미엄)

---

## 5. CCAPM (Consumption-Based CAPM)

### 5.1 배경과 동기

Douglas Breeden (1979), *An Intertemporal Asset Pricing Model with Stochastic
Consumption and Investment Opportunities*, Journal of Financial Economics,
7(3), 265-296

Robert Lucas (1978), *Asset Prices in an Exchange Economy*, Econometrica,
46(6), 1429-1445

ICAPM은 투자 기회 집합의 변화에 대한 헤지를 고려했지만, 여전히 **"부(wealth)"**를
최적화 대상으로 삼았다. 그러나 궁극적으로 투자자가 관심을 갖는 것은 부 자체가 아니라
**소비(consumption)**이다. 부는 미래 소비를 가능하게 하는 수단에 불과하다.

Breeden (1979)은 이 통찰을 수학적으로 완성했다:

```
핵심 전환:
  CAPM:   자산가격 = f(시장 포트폴리오와의 공분산)
  ICAPM:  자산가격 = f(시장 포트폴리오 + 상태변수들과의 공분산)
  CCAPM:  자산가격 = f(총소비 성장률과의 공분산)

CCAPM의 핵심 정리 (Breeden's Consumption Beta Theorem):
  Merton의 ICAPM에서 다중 베타를 하나의 소비 베타로 축약 가능
  조건: 총소비가 상태변수들의 함수인 경우
```

### 5.2 소비 베타 (Consumption Beta)

```
CCAPM 가격결정 방정식:

  E[R_i] - R_f = beta_{c,i} * lambda_c

  beta_{c,i} = Cov(R_i, Delta_c) / Var(Delta_c)
    → 소비 베타: 자산 수익률과 총소비 성장률의 공분산

  Delta_c = (C_{t+1} - C_t) / C_t
    → 총소비 성장률 (aggregate consumption growth)

  lambda_c = gamma * Var(Delta_c)
    → 소비 위험 프리미엄
    → gamma: 상대적 위험회피계수 (relative risk aversion coefficient)
```

직관:

```
높은 소비 베타 (beta_c > 0):
  자산 수익률이 소비 성장과 양의 상관
  → 소비가 높을 때 (경기 호황) 수익률도 높음
  → 소비가 낮을 때 (경기 침체) 수익률도 낮음
  → 즉, 투자자가 가장 돈이 필요할 때(침체기) 수익이 낮은 자산
  → 투자자는 이런 자산을 기피 → 높은 위험 프리미엄 요구

낮은/음의 소비 베타 (beta_c <= 0):
  소비가 낮을 때 오히려 수익률이 높음
  → "보험" 역할을 하는 자산
  → 투자자가 선호 → 낮은 위험 프리미엄 (또는 음의 프리미엄)
  → 예: 금, 국채, 변동성 (VIX/VKOSPI)
```

### 5.3 오일러 방정식 (Euler Equation)

```
기본 가격결정 방정식 (Fundamental Pricing Equation):

  1 = E[M_{t+1} * (1 + R_{i,t+1})]

  M_{t+1} = beta * (C_{t+1}/C_t)^(-gamma)
    → 확률적 할인 인자 (Stochastic Discount Factor, SDF)

  beta: 시간 할인 인자 (patience parameter, 0 < beta < 1)
  gamma: 상대적 위험회피계수 (relative risk aversion)
  C_t: t기의 총소비

전개 (로그 선형 근사):

  E[r_{i,t+1}] - r_f + sigma^2_i/2 = gamma * Cov(r_i, Delta_c)

  r_i = ln(1 + R_i)  (로그 수익률)
  Delta_c = ln(C_{t+1}/C_t)  (로그 소비 성장률)
  sigma^2_i/2: Jensen의 부등식 보정항
```

오일러 방정식은 금융학에서 가장 기본적인 가격결정 방정식이다.
모든 자산가격결정 모형은 이 방정식의 특수한 경우로 해석할 수 있다:

```
SDF의 특수 형태별 모형 도출:

  M = beta * (C_{t+1}/C_t)^(-gamma)          → CCAPM (Breeden 1979)
  M = a - b * R_m                             → CAPM (Sharpe 1964)
  M = a - b_1*F_1 - b_2*F_2 - ... - b_K*F_K  → APT (Ross 1976)
  M = beta * (C_{t+1}/C_t)^(-gamma) * theta   → Habit CCAPM (Campbell-Cochrane)

"모든 자산가격결정 모형은 SDF의 가정에서만 다르다"
  -- Cochrane (2005), Asset Pricing, Chapter 1
```

### 5.4 주식 프리미엄 퍼즐 (Equity Premium Puzzle)

Rajnish Mehra & Edward Prescott (1985), *The Equity Premium: A Puzzle*,
Journal of Monetary Economics, 15(2), 145-161

```
퍼즐의 핵심:

  관측된 주식 프리미엄 (미국, 1889-1978):
    E[R_equity] - R_f ≈ 6.2% per year

  CCAPM이 예측하는 주식 프리미엄:
    E[R_equity] - R_f = gamma * Cov(r_equity, Delta_c)

  미국 소비 성장률 통계:
    E[Delta_c] ≈ 1.8% per year
    sigma(Delta_c) ≈ 3.6% per year

  주식-소비 상관: Corr(r_equity, Delta_c) ≈ 0.40
  주식 변동성: sigma(r_equity) ≈ 16%

  Cov(r_equity, Delta_c) = 0.40 * 0.16 * 0.036 = 0.00230

  필요한 gamma:
    gamma = 0.062 / 0.00230 ≈ 27

  문제: gamma ≈ 27은 비현실적으로 높음
    합리적 gamma 범위: 1 ~ 10 (경험적 추정)
    gamma = 10이면: E[R_equity] - R_f ≈ 2.3%  (관측값의 1/3)
```

### 5.5 퍼즐의 해결 시도

```
해결 시도 1: 습관 형성 (Habit Formation)
  Campbell & Cochrane (1999), "By Force of Habit"
  
  효용 함수를 U(C-X)로 변경 (X = 습관 수준, habit level)
  
  U(C_t - X_t)^(1-gamma) / (1-gamma)
  
  직관: 소비가 습관 수준에 근접할수록 위험회피가 급격히 증가
  → 경기 침체 시 실효 위험회피계수가 극단적으로 높아짐
  → 작은 소비 변동도 큰 효용 변화를 초래
  → 합리적 gamma (≈ 2)로도 관측된 프리미엄 설명 가능

해결 시도 2: 재귀적 효용 (Recursive Utility)
  Epstein & Zin (1989), "Substitution, Risk Aversion, and the
  Temporal Behavior of Consumption and Asset Returns"
  
  V_t = [(1-beta)*C_t^rho + beta*(E_t[V_{t+1}^alpha])^(rho/alpha)]^(1/rho)
  
  핵심: 위험회피 (gamma)와 시점간 대체탄력성 (1/psi)을 분리
  → 표준 효용: gamma = 1/psi (묶여 있음)
  → Epstein-Zin: gamma와 psi를 독립적으로 조절 가능
  → 높은 위험회피 + 합리적 대체탄력성 = 퍼즐 완화

해결 시도 3: 희귀 재난 (Rare Disasters)
  Robert Barro (2006), "Rare Disasters and Asset Markets in the
  Twentieth Century"
  
  소비 성장률이 정규분포가 아닌, 두꺼운 꼬리 분포를 따름
  → 작은 확률로 대규모 소비 하락 (전쟁, 대공황, 팬데믹)
  → 이 재난 위험에 대한 보상이 주식 프리미엄의 상당 부분을 설명
  → gamma ≈ 3-4로도 6%+ 프리미엄 가능
  
  12_extreme_value_theory.md와의 연결:
    극단값 이론은 이러한 꼬리 분포를 정량화하는 도구를 제공한다
```

### 5.6 KRX 적용

```
실용적 한계:
  1. 소비 데이터 빈도: 분기별 (KOSIS API)
     → 일별/주별 패턴 거래에는 직접 적용 불가
     → 월별 이동 합계로 보간 가능하나, 측정 오류 증가

  2. 한국 가계 소비 특성:
     → 저축률 높음 (OECD 평균 대비)
     → 부동산 자산 비중 높음 (소비보다 자산 효과 지배적)
     → CCAPM의 설명력이 미국 대비 낮을 가능성

  3. 간접적 적용 경로:
     → 소비자심리지수 (CCI, KOSIS 경기심리지수)를 소비 성장의 프록시로 활용
     → data/macro/kosis_latest.json에 이미 수록
     → 월별 업데이트 → MRA 파이프라인의 매크로 입력으로 활용 가능
     → 그러나 CCI는 소비의 "기대"이지 "실현"이 아님을 유의

  CheeseStock 구현 우선순위:
    CCAPM 직접 구현: LOW (데이터 빈도 제약)
    소비자심리 간접 활용: MEDIUM (이미 KOSIS 연동)
    이론적 가치: HIGH (SDF 프레임워크의 근간, 후속 연구 기반)
```

교차 참조:
- 14_finance_management.md §4 (에르고딕 경제학: 소비의 기하적 성장 해석)
- 12_extreme_value_theory.md (꼬리 위험 → 희귀 재난 모형의 정량화)
- 30_macroeconomics_islm_adas.md (거시경제 변수와 소비 연결)

---

## 6. APT 정식 도출 (Formal Arbitrage Pricing Theory)

### 6.1 배경과 동기

Stephen Ross (1976), *The Arbitrage Theory of Capital Asset Pricing*,
Journal of Economic Theory, 13(3), 341-360

APT는 CAPM과 **근본적으로 다른 논리 구조**에서 출발한다:

```
CAPM의 도출 논리:
  1. 투자자는 평균-분산 최적화를 한다 (효용 극대화)
  2. 모든 투자자가 동일한 기대를 갖는다 (동질적 기대)
  3. 무위험 차입/대출이 가능하다
  4. → 시장 균형에서 SML이 성립 (균형 논증)

APT의 도출 논리:
  1. 수익률이 팩터 구조를 따른다 (factor structure assumption)
  2. 차익거래 기회가 존재하지 않는다 (no-arbitrage condition)
  3. → (N이 충분히 클 때) 선형 가격결정이 성립 (차익거래 논증)

핵심 차이:
  CAPM = "균형" 논증 → 강한 가정, 강한 결론
  APT  = "무차익" 논증 → 약한 가정, (약간 더) 약한 결론
```

### 6.2 팩터 모형 가정

```
수익률의 팩터 구조 (Factor Structure of Returns):

  R_i = E[R_i] + SUM_{k=1}^{K} b_{i,k} * F_k + epsilon_i

  R_i:      종목 i의 (확률적) 수익률
  E[R_i]:   종목 i의 기대수익률 (사전적으로 알려져 있다고 가정)
  b_{i,k}:  종목 i의 팩터 k에 대한 민감도 (factor loading / factor beta)
  F_k:      팩터 k의 서프라이즈 (innovation)
            → E[F_k] = 0 (정의상: 기대값을 뺀 잔차)
  epsilon_i: 종목 i의 고유 충격 (idiosyncratic shock)

가정:
  (A1) E[F_k] = 0  for all k
  (A2) E[epsilon_i] = 0  for all i
  (A3) Cov(epsilon_i, F_k) = 0  for all i, k
  (A4) Cov(epsilon_i, epsilon_j) = 0  for all i != j
       → 고유 위험은 종목 간 무상관 (§2 단일지수 모형의 가정 3과 동일)
  (A5) K << N  (팩터 수가 종목 수보다 훨씬 적다)
```

가정 (A4)가 의미하는 것:

```
만약 N이 충분히 크고 가정 (A4)가 성립한다면,
N개 종목에 균등하게 투자하는 포트폴리오의 고유 위험은:

  Var(epsilon_p) = (1/N^2) * SUM_i sigma^2_{epsilon_i}
                 <= (1/N) * max_i(sigma^2_{epsilon_i})
                 → 0  as N → infinity

→ 잘 분산된(well-diversified) 포트폴리오에서 고유 위험은 소멸한다
→ 남는 것은 체계적 팩터 노출뿐이다
```

### 6.3 차익거래 논증 (Arbitrage Argument)

```
핵심 정리:
  차익거래(arbitrage) = 무비용 + 무위험 + 양의 기대이익
  효율적 시장에서는 차익거래 기회가 존재할 수 없다

차익거래 포트폴리오 구성:
  가중치 벡터 w = (w_1, w_2, ..., w_N) 를 다음 조건으로 구성:

  (C1) SUM_i w_i = 0           (무비용: 순투자 = 0, 매수와 매도가 상쇄)
  (C2) SUM_i w_i * b_{i,k} = 0  for all k = 1,...,K  (무위험: 팩터 노출 = 0)
  (C3) w_i = O(1/N)           (충분한 분산: 개별 가중치가 작음)

조건 (C3) 하에서, 이 포트폴리오의 수익률은:

  R_p = SUM_i w_i * R_i
      = SUM_i w_i * E[R_i] + SUM_k (SUM_i w_i*b_{i,k}) * F_k + SUM_i w_i*epsilon_i
      = SUM_i w_i * E[R_i] + 0 + ~0   [C2에 의해 팩터항 소멸, 분산투자로 잔차항 소멸]
      = SUM_i w_i * E[R_i]             [비확률적! 무위험 수익]
```

### 6.4 가격결정 방정식 도출

```
차익거래 불가 조건:
  R_p = SUM_i w_i * E[R_i] = 0  for all arbitrage portfolios

이것은 기대수익률 벡터 E[R] = (E[R_1], ..., E[R_N]) 가
팩터 로딩 행렬의 열공간에 놓여야 함을 의미한다.

수학적으로:
  E[R_i] = lambda_0 + SUM_{k=1}^{K} b_{i,k} * lambda_k  (for all i)

  lambda_0: "제로 팩터 가격" (모든 팩터 노출이 0인 자산의 기대수익률)
            → 무위험자산이 존재하면 lambda_0 = R_f
            → 존재하지 않으면 lambda_0 = E[R_z] (Zero-Beta CAPM과 유사)
  lambda_k: 팩터 k의 위험 프리미엄 (risk premium per unit of factor exposure)
```

최종 APT 가격결정 방정식:

```
APT Pricing Equation (무위험자산 존재 시):

  E[R_i] = R_f + SUM_{k=1}^{K} b_{i,k} * lambda_k

  → R_f: 무위험이자율
  → b_{i,k}: 종목 i의 팩터 k에 대한 민감도 (팩터 베타)
  → lambda_k: 팩터 k의 위험 프리미엄

해석:
  각 종목의 기대수익률은 무위험이자율에
  각 팩터 노출에 대한 보상을 합한 것이다.
  보상 = 노출량(b) × 단위당 가격(lambda)
```

### 6.5 APT의 정확한 vs 근사적 성립

```
엄밀하게 APT는 "근사적"으로만 성립한다:

  E[R_i] ≈ lambda_0 + SUM_k b_{i,k} * lambda_k

  오차: |E[R_i] - (lambda_0 + SUM_k b_{i,k} * lambda_k)| <= epsilon_i

이유: N개 종목에서 K개 조건 (C2)를 만족하는 차익거래 포트폴리오를 구성할 때,
잔차항 SUM w_i*epsilon_i 는 정확히 0이 아니라 N이 충분히 클 때 "거의 0"이다.

정확한 성립 조건:
  1. N → infinity (무한 종목, 엄밀한 대수법칙 적용)
  2. 또는 팩터 포트폴리오가 실제로 존재하여 직접 거래 가능할 때

실무적 의미:
  KRX 2,700+ 종목은 APT의 근사가 상당히 정확할 만큼 충분히 크다.
  개별 종목 수준에서의 가격결정 오차는 존재하지만,
  포트폴리오 수준에서는 무시할 수 있다.
```

### 6.6 CAPM을 APT의 특수 경우로

```
APT에서 K = 1이고 유일한 팩터가 시장 수익률이면:

  R_i = E[R_i] + b_{i,1} * F_1 + epsilon_i

  F_1 = R_m - E[R_m]  (시장 서프라이즈)
  b_{i,1} = beta_i     (시장 베타)

  APT: E[R_i] = R_f + beta_i * lambda_1
  CAPM: E[R_i] = R_f + beta_i * (E[R_m] - R_f)

  → lambda_1 = E[R_m] - R_f (시장 위험 프리미엄)
  → CAPM은 APT의 단일 팩터 특수 경우이다

단, 도출 논리는 다르다:
  CAPM: 시장 포트폴리오의 존재를 가정 (더 강한 가정)
  APT:  팩터 구조 + 무차익만 가정 (더 약한 가정)
```

### 6.7 CAPM vs APT 비교표

| 비교 항목 | CAPM | APT |
|----------|------|-----|
| 도출 근거 | 균형 (mean-variance optimization) | 무차익 (no-arbitrage condition) |
| 가정 강도 | 강함 (효용 극대화, 동질적 기대) | 약함 (팩터 구조, 대수법칙) |
| 팩터 수 | 1개 (시장 포트폴리오) | K개 (미확정, 경험적으로 결정) |
| 시장 포트폴리오 | 필요 (이론적, 관측 불가) | 불필요 |
| 수익률 분포 | 정규분포 또는 2차 효용 | 팩터 구조만 필요 (분포 제약 약함) |
| 검증 가능성 | Joint hypothesis problem (Roll 1977) | 팩터 식별 문제 |
| 성립 범위 | 정확 (모든 자산에 대해) | 근사 (N이 충분히 클 때) |
| 직관 | "시장 위험에 대한 보상" | "체계적 위험에 대한 보상" |
| 실무 활용 | WACC, 교육, 베타 특성화 | MRA 파이프라인, IC 최적화, 요인 투자 |

### 6.8 KRX 적용

```
CheeseStock의 MRA 파이프라인은 사실상 APT의 구현이다:

  mra_apt_extended.py:
    R_pattern = alpha + SUM_k b_k * X_k + epsilon

  여기서 X_k는 17개 설명변수 (12개 패턴 특성 + 5개 APT 팩터)

  Ridge 회귀:
    b_hat = argmin ||R - X*b||^2 + lambda*||b||^2
    → APT의 b_{i,k} 추정에 Ridge 정규화 적용
    → James-Stein (1961) 수축 추정과 동형

  Walk-Forward IC (23_apt_factor_model.md 마지막 섹션):
    → APT의 가격결정 정확도를 OOS에서 측정
    → IC = rank_corr(predicted_return, actual_return)
    → 현재 17열 WF IC: 0.0998

APT 프레임워크의 확장 가능성:
  이론적으로 "위험 프리미엄이 0이 아닌 모든 팩터"를 추가할 수 있다.
  현재 17열에서 확장 후보:

  | 후보 팩터 | APT 근거 | 데이터 가용 | 기대 IC 기여 |
  |----------|---------|-----------|-------------|
  | 크레딧 스프레드 | 부도 위험 프리미엄 | bonds_latest.json | +0.005~0.01 |
  | VKOSPI 레벨 | 변동성 위험 프리미엄 | KOSCOM API | +0.003~0.008 |
  | 외국인 순매수 | 정보 비대칭 프리미엄 | KRX API | +0.005~0.015 |
  | Amihud ILLIQ | 비유동성 프리미엄 | OHLCV (이미 보유) | +0.003~0.008 |

  각 팩터의 추가는 반드시 Walk-Forward IC 증분으로 검증해야 한다.
  IC가 증가하지 않으면 해당 팩터의 KRX 위험 프리미엄은 경제적으로 유의하지 않다.
```

교차 참조:
- 23_apt_factor_model.md (APT 기본 공식, FF 연결, WF IC 프로토콜)
- 25_capm_delta_covariance.md §1.5 (CAPM vs APT 보완 관계)
- 17_regression_backtesting.md (Ridge 회귀, WLS 방법론)

---

## 7. Fama-French 5-Factor Model 심화

### 7.1 배경: 3-Factor에서 5-Factor로

기존 문서 참조: 05_finance_theory.md §4.1-4.3에서 FF 3-Factor와 Carhart 4-Factor의
기본 공식을 다루었다. 본 절은 **5-Factor의 경제적 직관**, **2x3 정렬 구성법**,
그리고 **KRX 데이터로의 구현 세부**를 추가한다.

Fama & French (2015), *A Five-Factor Asset Pricing Model*,
Journal of Financial Economics, 116(1), 1-22

### 7.2 5-Factor 모형 공식

```
Fama-French 5-Factor Model:

  R_i - R_f = alpha_i + b_i*(R_M - R_f) + s_i*SMB + h_i*HML + r_i*RMW + c_i*CMA + eps_i

  R_i - R_f:   종목 i의 초과수익률
  R_M - R_f:   시장 초과수익률 (MKT)
  SMB:          Small Minus Big (규모 요인)
  HML:          High Minus Low (가치 요인, BM 기준)
  RMW:          Robust Minus Weak (수익성 요인, OP 기준)
  CMA:          Conservative Minus Aggressive (투자 요인, Inv 기준)

  b_i, s_i, h_i, r_i, c_i: 각 요인에 대한 팩터 로딩

  alpha_i: 5요인으로 설명되지 않는 비정상 수익률
           → alpha_i = 0이 "효율적 시장" 가설
           → alpha_i != 0이면 가격결정 이상(anomaly) 또는 누락 요인
```

### 7.3 요인 구성: 2x3 이중 정렬 (Double Sort)

```
FF의 2x3 이중 정렬 방법론:

Step 1: 매년 6월 말에 전 종목을 정렬
  크기(Size): 시가총액 중앙값으로 2분할
    S (Small): 시총 < 중앙값
    B (Big):   시총 >= 중앙값

  가치(BM): 장부가치 대 시가 비율(BM = 자본총계/시총)의 30/70 백분위로 3분할
    H (High BM): BM > P70  (가치주)
    M (Mid BM):  P30 <= BM <= P70  (중간)
    L (Low BM):  BM < P30  (성장주)

Step 2: 6개 포트폴리오 형성

         |  Low BM  |  Mid BM  |  High BM  |
  Small  |   SL     |   SM     |    SH     |
  Big    |   BL     |   BM     |    BH     |

Step 3: 요인 수익률 계산 (시총 가중 포트폴리오 수익률)

  SMB = 1/3*(SH + SM + SL) - 1/3*(BH + BM + BL)
      = (소형주 평균) - (대형주 평균)

  HML = 1/2*(SH + BH) - 1/2*(SL + BL)
      = (가치주 평균) - (성장주 평균)
```

RMW와 CMA도 동일한 2x3 방법론:

```
수익성(OP = Operating Profitability):
  OP = (매출총이익 - 판관비 - 이자비용) / 자본총계

  2x3 정렬: Size x OP
  R (Robust): OP > P70 (높은 수익성)
  W (Weak): OP < P30 (낮은 수익성)

  RMW = 1/2*(SR + BR) - 1/2*(SW + BW)
      = (고수익성 기업 평균) - (저수익성 기업 평균)

투자(Inv = Asset Growth):
  Inv = (총자산_t - 총자산_{t-1}) / 총자산_{t-1}

  2x3 정렬: Size x Inv
  C (Conservative): Inv < P30 (보수적 투자)
  A (Aggressive): Inv > P70 (공격적 투자)

  CMA = 1/2*(SC + BC) - 1/2*(SA + BA)
      = (보수적 투자 기업 평균) - (공격적 투자 기업 평균)
```

### 7.4 각 요인의 경제적 직관

```
MKT (시장 요인): E[R_M] - R_f
  → 전체 시장 위험에 대한 보상
  → CAPM의 유일한 요인
  → 가장 큰 설명력 (R^2 기여 ~60-80%)

SMB (규모 요인):
  이론적 근거:
    - Banz (1981): 소형주가 대형주 대비 초과수익
    - ICAPM 해석: 소형주는 경기 침체에 더 취약 → 경기 상태변수 프록시
    - 정보 비대칭: 소형주는 정보가 적어 위험 프리미엄 요구
  KRX 특이사항:
    - KOSDAQ 소형주의 극단적 변동성 (20_krx_structural_anomalies.md §5)
    - 개인투자자 편중 → 소형주 프리미엄이 미국 대비 불안정

HML (가치 요인):
  이론적 근거:
    - Fama-French (1992): 높은 BM = 재무적 곤경(distress) 리스크
    - ICAPM 해석: 가치주는 이자율 변화에 더 민감 → 이자율 상태변수 프록시
    - 행동경제학: 과잉 반응 → 과소평가 → 평균 회귀
  KRX 특이사항:
    - 한국 PBR < 1.0 종목 비율 ~50% (Korea Discount)
    - 지배구조 할인이 BM에 혼입되어 순수 가치 효과 분리 어려움
    - 14_finance_management.md §2.6 참조

RMW (수익성 요인):
  이론적 근거:
    - Novy-Marx (2013), *The Other Side of Value: The Gross Profitability Premium*
    - 매출총이익률이 가장 강력한 수익률 예측 변수
    - 직관: 수익성이 높은 기업 = 지속가능한 경쟁 우위 = 낮은 위험
    - 배당할인모형: V = D/(r-g), 높은 수익성 → 높은 D → 현재 시가 정당화
  KRX 특이사항:
    - DART 연결재무제표(CFS)에서 매출총이익 확보 가능
    - K-IFRS 하 OP 정의 일관성 주의 (매출원가 분류 차이)
    - data/financials/{code}.json에서 추출 가능

CMA (투자 요인):
  이론적 근거:
    - Titman, Wei & Xie (2004): 과잉투자 기업의 저조한 수익률
    - 직관: 공격적 투자 = 경영진 과신(overconfidence) 또는 대리인 문제
    - 밸류에이션 연결: 높은 투자 → 낮은 FCF → 낮은 기대수익률
    - 33_agency_costs_industry_concentration.md §2 참조
  KRX 특이사항:
    - 한국 재벌 계열사의 공격적 투자 성향 (순환출자, 다각화)
    - CMA 구성에 재벌 더미를 추가하면 설명력 향상 가능성
```

### 7.5 HML의 중복성 논쟁

```
Fama-French (2015)의 주요 발견:

  "With the addition of profitability and investment factors,
   the value factor (HML) becomes redundant."

  즉, RMW + CMA가 HML의 수익률 변동을 거의 완전히 설명한다.

수학적 표현:
  HML ≈ a + b*RMW + c*CMA + epsilon
  → R^2가 매우 높음 (미국 데이터에서 ~0.8+)

배당할인모형 해석 (Fama-French 2015 sec 6):
  V_0 = SUM_t E[D_t] / (1+r)^t

  높은 BM (= 낮은 V/B):
    이유 1: 낮은 기대 수익성 (E[D] 낮음) → low RMW
    이유 2: 높은 기대 투자 (보수적이지 않음) → low CMA (역방향)
    이유 3: 높은 기대 수익률 (r 높음) → 위험 프리미엄

  HML ∩ RMW: 가치주 중 저수익성 → 이미 RMW에 포착
  HML ∩ CMA: 가치주 중 과잉투자 → 이미 CMA에 포착
  HML 고유: r 차이 → RMW, CMA로 설명되지 않는 순수 할인율 효과

실무적 함의:
  - 3-Factor 시대: HML이 독립적 요인
  - 5-Factor 시대: HML은 RMW + CMA의 부산물에 가까움
  - 그러나 KRX에서는 Korea Discount으로 인해 HML의 독립적 설명력이 남아있을 가능성
```

### 7.6 KRX-Specific 요인 구성 고려사항

```
연간 리밸런싱 타이밍:
  FF 원형: 매년 6월 말 리밸런싱
  근거: 3월 말 결산 기업의 재무데이터가 6월까지 공시되므로
  KRX: 12월 결산 → 3월 사업보고서 → 5-6월 데이터 확정
  → KRX에서도 6월 리밸런싱이 적절

크기 분할점 (Size Breakpoint):
  FF 원형: NYSE 중앙값 (NASDAQ, AMEX 제외)
  KRX 적용: KOSPI 중앙값 (KOSDAQ 소형주 편중 방지)
  → KOSDAQ을 KOSPI와 동일 기준으로 분류하면 거의 모든 KOSDAQ = Small

데이터 소스:
  시가총액: data/index.json → marketCap 필드
  자본총계: data/financials/{code}.json → total_equity
  매출총이익/영업이익: data/financials/{code}.json → 관련 항목
  총자산: data/financials/{code}.json → total_assets

기존 구현:
  scripts/mra_apt_extended.py:
    열 14 (value_inv_pbr): 1/PBR = 자본총계/시총 → HML 프록시
    열 16 (log_size): log(시총) → SMB 프록시
    → 현재는 개별 종목 수준의 팩터 노출만 사용
    → 정식 FF 방법론은 정렬 기반 포트폴리오 수익률을 요인으로 사용

  data/macro/ff3_factors.json:
    → MKT, SMB, HML 일별 팩터 수익률
    → 기존 데이터로 3-Factor 모형 구현 가능
    → RMW, CMA는 별도 계산 필요 (DART 데이터 활용)
```

교차 참조:
- 05_finance_theory.md §4.1-4.3 (FF 3/5-Factor 기본 공식)
- 23_apt_factor_model.md (SMB/HML 구성 개요)
- 14_finance_management.md §2.5-2.6 (PER/PBR/PSR 해석)
- 33_agency_costs_industry_concentration.md (대리인 비용 → CMA 연결)

---

## 8. 모형 간 관계 종합 (Unified Relationship)

### 8.1 자산가격결정 모형의 계보

```
[MPT]  Harry Markowitz (1952)
│  "Portfolio Selection", Journal of Finance
│  → 효율적 프론티어 (mean-variance optimization)
│  → 투자의 "수학화" 시작
│
├──→ [CAPM]  Sharpe (1964), Lintner (1965), Mossin (1966)
│    │  → E[R_i] = R_f + beta_i * (E[R_m] - R_f)
│    │  → 시장 포트폴리오라는 단일 요인으로 모든 자산 가격결정
│    │
│    ├──→ [Single-Index Model]  Sharpe (1963)
│    │    → R_i = alpha + beta*R_m + epsilon
│    │    → CAPM의 실증적 구현 (회귀 모형)
│    │    → compute_capm_beta.py
│    │
│    ├──→ [Zero-Beta CAPM]  Black (1972)
│    │    → E[R_i] = E[R_z] + beta_i * (E[R_m] - E[R_z])
│    │    → 무위험자산 불필요, 공매도 제약 시장에 적합
│    │    → KRX 공매도 금지 기간에 더 적절한 모형
│    │
│    ├──→ [ICAPM]  Merton (1973)
│    │    │  → E[R_i] = R_f + beta_M*MRP + SUM beta_k*lambda_k
│    │    │  → 다기간, 상태변수에 대한 헤지 수요
│    │    │  → 다중 팩터 모형의 이론적 정당성 제공
│    │    │
│    │    └──→ [CCAPM]  Breeden (1979), Lucas (1978)
│    │         → E[R_i] = R_f + beta_c * lambda_c
│    │         → 모든 상태변수를 소비 베타로 축약
│    │         → 가장 "근본적인" 가격결정 모형
│    │         → 그러나 실증적 성능이 약함 (Equity Premium Puzzle)
│    │
│    └──→ [SDF Framework]  Hansen-Jagannathan (1991), Cochrane (2005)
│         → 1 = E[M * (1+R)]
│         → 모든 모형을 통합하는 메타 프레임워크
│         → M의 가정에 따라 CAPM, CCAPM, APT 등으로 분화
│
└──→ [APT]  Ross (1976)
     │  → E[R_i] = R_f + SUM b_k * lambda_k
     │  → 무차익 조건에서 도출 (균형 불필요)
     │  → 요인의 정체성은 미확정 (이론의 강점이자 한계)
     │
     ├──→ [Fama-French 3-Factor]  FF (1993)
     │    → R_i - R_f = b*MKT + s*SMB + h*HML
     │    → APT의 경험적 구현 (크기, 가치 요인)
     │
     ├──→ [Carhart 4-Factor]  Carhart (1997)
     │    → + u*UMD (모멘텀)
     │    → Jegadeesh & Titman (1993) 모멘텀의 팩터화
     │
     └──→ [Fama-French 5-Factor]  FF (2015)
          → + r*RMW + c*CMA (수익성, 투자)
          → Novy-Marx (2013) 수익성, Titman et al. (2004) 투자
```

### 8.2 포함 관계 (Nesting Relationships)

```
포함 관계 (Nesting):

  CAPM ⊂ ICAPM
    → ICAPM에서 상태변수 = 0이면 CAPM
    → CAPM은 "미래 투자 기회가 변하지 않는다"는 특수 경우

  CAPM ⊂ APT (단일 팩터)
    → APT에서 K=1, F_1 = R_m - E[R_m]이면 CAPM
    → CAPM은 APT의 단일 시장 팩터 특수 경우

  FF3 ⊂ APT (3개 특정 팩터)
    → APT에서 K=3, F = {MKT, SMB, HML}이면 FF3
    → FF는 APT의 경험적 팩터 선택

  ICAPM ≈ APT (해석은 다르지만 수학적 형태 동일)
    → ICAPM: 상태변수 → 헤지 수요 → 위험 프리미엄 (경제적 동기)
    → APT: 팩터 구조 → 무차익 → 위험 프리미엄 (통계적 동기)
    → 결과: 둘 다 E[R_i] = R_f + SUM beta_k * lambda_k

  CCAPM ≠ CAPM (일반적으로)
    → CCAPM은 ICAPM의 특수 경우 (소비 = 유일한 상태변수)
    → 시장 베타와 소비 베타는 일반적으로 다른 값
    → 단, 시장 수익률과 소비 성장이 완전 상관이면 동일
```

### 8.3 수렴 지점

```
모든 모형의 수렴:

  E[R_i] = R_f + SUM_k beta_{i,k} * lambda_k

이것은 놀라운 결과이다:
  - MPT에서 출발하든, 무차익에서 출발하든, 소비 효용에서 출발하든
  - 결국 "기대수익률 = 무위험 + 체계적 위험에 대한 보상"에 수렴한다
  - 차이는 오직 "어떤 것이 체계적 위험인가?"에 대한 답뿐이다

모형별 "체계적 위험"의 정의:
  CAPM:    시장과의 공분산 (beta_M)
  ICAPM:   시장 + 상태변수들과의 공분산 (beta_M + beta_k)
  CCAPM:   소비 성장률과의 공분산 (beta_c)
  APT:     K개 팩터와의 공분산 (b_1, ..., b_K)
  FF5:     5개 특정 팩터와의 공분산 (b, s, h, r, c)
```

### 8.4 실무적 선택 기준

```
CheeseStock에서의 모형 선택 논리:

  이론적 근거: ICAPM (왜 다중 팩터가 필요한지 설명)
  형식적 틀: APT (팩터의 수와 정체를 유연하게 결정)
  팩터 선택: FF + KRX 고유 팩터 (경험적 IC 기여로 결정)
  추정 방법: Ridge 회귀 (James-Stein 수축 → 과적합 방지)
  검증: Walk-Forward IC (out-of-sample 성능)

요약:
  ICAPM이 동기(motivation)를 제공하고
  APT가 형식(formalism)을 제공하고
  FF가 경험적 내용(empirical content)을 제공하고
  Ridge/WLS가 추정(estimation)을 수행하고
  Walk-Forward IC가 검증(validation)을 수행한다
```

---

## 9. KRX 적용과 구현 경로

### 9.1 모형-코드 매핑 (Model-to-Code Mapping)

```
┌─────────────────────┬──────────────────────────┬─────────────────────────┐
│ 이론 모형            │ 구현 코드                  │ 산출물                    │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ Single-Index Model  │ compute_capm_beta.py     │ capm_beta.json          │
│ (Sharpe 1963)       │ OLS: r_i = a + b*r_m + e │ {beta, alpha, R^2}      │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ CAPM / Zero-Beta    │ compute_capm_beta.py     │ capm_beta.json          │
│ (Sharpe 1964,       │ alpha = Jensen's Alpha   │ {alpha} (market-adj     │
│  Black 1972)        │ beta → risk category     │  excess return)         │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ APT / FF Factors    │ mra_apt_extended.py      │ mra_apt_results.json    │
│ (Ross 1976,         │ 17-col Ridge regression  │ mra_apt_coefficients.json│
│  FF 1993, 2015)     │ WF IC validation         │ {coefficients, IC}      │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ ICAPM State Vars    │ appWorker.js (macro)     │ _macroLatest            │
│ (Merton 1973)       │ data/macro/*.json        │ {bok_rate, vkospi,      │
│                     │ ecos_download.py 등      │  usd_krw, credit_sprd}  │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ FF3 Daily Factors   │ (사전 계산됨)              │ ff3_factors.json        │
│ (FF 1993)           │ data/macro/ff3_factors   │ {MKT, SMB, HML daily}   │
├─────────────────────┼──────────────────────────┼─────────────────────────┤
│ CCAPM               │ (직접 구현 없음)           │ kosis_latest.json       │
│ (Breeden 1979)      │ CCI 간접 프록시           │ {consumer_confidence}   │
└─────────────────────┴──────────────────────────┴─────────────────────────┘
```

### 9.2 IC 기여 경로 (IC Contribution Pathway)

```
현재 달성된 IC (Phase 4-1 기준):

  12-col (패턴 특성만):   WF IC = 0.0567
  17-col (+ APT 5팩터):   WF IC = 0.0998  (delta: +0.0430)

APT 팩터별 기여 (t-statistics, 297K samples):
  liquidity_20d:  t = -27.6  (가장 강력)
  log_size:       t = +20.0
  value_inv_pbr:  t = -14.6
  beta_60d:       t = +11.9
  momentum_60d:   t = -6.0   (가장 약하지만 유의)

이론적 해석:
  - 유동성 팩터가 가장 강력 → Amihud (2002) ILLIQ의 KRX 적용 확인
  - 규모 팩터가 두 번째 → SMB 효과 존재하지만 방향 검증 필요
  - 가치 팩터 음의 관계 → 고PBR(저 1/PBR) 종목의 패턴이 더 정확?
    → Korea Discount으로 인한 PBR 왜곡 가능성 검토 필요
  - 베타 양의 관계 → 고베타 종목의 패턴이 더 정확?
    → 시장 추세 기간의 패턴 검출 편향 가능성
```

### 9.3 향후 확장 로드맵

```
Phase 5 (계획됨): 18-24열 확장

  추가 후보 팩터:

  열 18: credit_spread (크레딧 스프레드)
    → 이론: ICAPM 부도 위험 상태변수
    → 데이터: bonds_latest.json (AA- vs 국고채)
    → 구현: mra_apt_extended.py에 열 추가

  열 19: vkospi_level (VKOSPI 레벨)
    → 이론: ICAPM 변동성 상태변수, VRP 프록시
    → 데이터: KOSCOM API 또는 프록시 (34번 §4)
    → 구현: 일별 VKOSPI를 패턴 날짜에 매칭

  열 20: foreign_net_buy (외국인 순매수)
    → 이론: 정보 비대칭 → 가격 발견 프리미엄
    → 데이터: KRX API (39_investor_flow_information.md)
    → 구현: 종목별 외국인 순매수 비율

  열 21: amihud_illiq (Amihud 비유동성)
    → 이론: Amihud (2002), 비유동성 = 가격 영향력
    → 데이터: |r_t| / volume_t (OHLCV에서 직접 계산)
    → 구현: 20일 이동평균 ILLIQ

각 팩터의 추가 조건:
  1. 이론적 근거 (ICAPM 상태변수 또는 APT 팩터로 정당화)
  2. 데이터 가용성 (이미 보유하거나 API로 확보 가능)
  3. IC 증분 >= 0.003 (Walk-Forward 기준)
  4. t-statistic >= 3.0 (경제적으로도 유의)
```

### 9.4 Blume Beta 조정 (계획)

```
Blume (1971) Beta Adjustment:

  beta_adjusted = 0.33 + 0.67 * beta_raw

근거:
  raw beta는 mean-reverting (평균 회귀)하는 경향이 있다
  극단적 beta는 시간이 지나면 1.0으로 수렴
  Blume 조정은 이 회귀를 사전적으로 반영

Vasicek (1973) Bayesian Shrinkage (더 정교한 방법):
  beta_shrunk = w * beta_raw + (1-w) * beta_prior

  w = sigma^2_prior / (sigma^2_prior + sigma^2_beta)
  beta_prior = 1.0 (시장 평균으로 수축)

  직관: 추정 불확실성이 높은 종목의 beta를 1.0쪽으로 더 강하게 수축
  → James-Stein 추정의 금융 응용

현행 시스템:
  compute_capm_beta.py는 raw beta를 출력
  Blume/Vasicek 조정은 Phase 7에서 구현 예정
  25_capm_delta_covariance.md §1.4에서 Scholes-Williams 보정은 이미 구현됨
```

### 9.5 SDF 프레임워크와 장기 비전

```
SDF (Stochastic Discount Factor) 통합 프레임워크:

  모든 자산가격결정 모형의 공통 형식:
    1 = E[M_{t+1} * (1 + R_{i,t+1})]

  M = SDF = pricing kernel = state-price density

  각 모형의 SDF:
    CAPM:    M = a - b*R_m
    FF3:     M = a - b*MKT - s*SMB - h*HML
    CCAPM:   M = beta * (C_{t+1}/C_t)^(-gamma)
    APT:     M = a - SUM b_k*F_k

  CheeseStock의 SDF:
    M_CS = a - SUM_{k=1}^{17} b_k * X_k
    where X_k = 17열 MRA 설명변수

  이것은 "CheeseStock이 암묵적으로 가정하는 SDF"를 정의한다.
  Ridge 회귀의 계수 b_k는 SDF에서 각 팩터의 가격(price)에 해당한다.

장기 비전:
  SDF의 비선형 확장 (M = f(X), f는 신경망 or 커널)이
  머신러닝 자산가격결정의 최전선이다.
  
  Gu, Kelly & Xiu (2020), *Empirical Asset Pricing via Machine Learning*,
  Review of Financial Studies:
    → 수백 개 팩터의 비선형 조합으로 SDF 추정
    → 선형 모형 대비 OOS R^2 크게 향상
    → 그러나 해석가능성 상실 → CheeseStock의 투명성 원칙과 충돌

  현재 위치: 선형 APT (해석 가능 + IC 0.10)
  다음 단계: Blume 조정, 추가 팩터 (IC → 0.12+ 목표)
  장기 목표: 비선형 SDF (IC → 0.15+, 단 해석가능성 유지 조건)
```

교차 참조:
- 23_apt_factor_model.md (현재 MRA 파이프라인의 APT 해석)
- 25_capm_delta_covariance.md §1 (beta 추정 방법론)
- 17_regression_backtesting.md (Ridge, WLS, 교차검증)
- 11_reinforcement_learning.md (RL 기반 비선형 확장 가능성)

---

## 10. 수학적 부록 (Mathematical Appendix)

### 10.1 ICAPM의 연속시간 도출 스케치

```
Merton (1973)의 원형 도출:

투자자의 최적화 문제:
  max E[integral_0^T U(C_t, t) dt]
  subject to:
    dW = [SUM w_i*(R_i - R_f) + R_f]*W*dt + SUM w_i*sigma_i*W*dZ_i - C*dt

여기서 W = 부(wealth), w_i = 자산 i의 비중, C = 소비율

벨만 방정식 (Hamilton-Jacobi-Bellman):
  0 = max_{C, w} {U(C,t) + E[dJ]/dt}

  J(W, s, t) = 간접 효용 함수 (W, 상태변수 s, 시간 t의 함수)

1차 조건 (FOC):
  w_i* = -(J_W / J_WW) * mu_i/sigma_i^2  (mean-variance demand)
       + SUM_k -(J_Ws_k / J_WW) * sigma_{i,s_k}/sigma_i^2  (hedging demand)

  첫째 항: 근시안적 수요 (myopic demand) = CAPM과 동일
  둘째 항: 헤지 수요 (hedging demand) = CAPM에 없는 추가 항

균형에서:
  E[R_i] - R_f = (-J_WW/J_W)*W*Cov(R_i, R_W) + SUM_k (-J_Ws_k/J_W)*Cov(R_i, ds_k)
               = beta_{i,M} * (E[R_M]-R_f) + SUM_k beta_{i,k} * lambda_k

  → 이것이 §4.2의 ICAPM 공식이다
```

### 10.2 APT의 점근적 차익거래 논증

```
Ross (1976)의 원형 증명 (Huberman 1982 간소화 버전):

정의: N종목 경제에서 차익거래 기회란:
  가중치 w = (w_1, ..., w_N) such that:
    (i)   SUM w_i = 0         (zero cost)
    (ii)  SUM w_i^2 → 0       (diversifiable, 분산투자)
    (iii) SUM w_i * E[R_i] > 0 (positive expected payoff)

정리: 만약 차익거래 기회가 존재하지 않는다면,
  SUM_i (E[R_i] - lambda_0 - SUM_k b_{i,k}*lambda_k)^2 / N → 0 as N → infinity

이것은 "APT 가격결정 오차의 평균 제곱이 0으로 수렴"한다는 것이다.
즉, "대부분의" 종목에 대해 APT 가격결정이 성립한다 (예외 가능).

Chamberlain & Rothschild (1983): 팩터 구조를 "근사적 팩터 구조"로 완화
  → 잔차 공분산 행렬의 고유값이 유계(bounded)이면 충분
  → 실무적으로 가장 약한 조건
```

### 10.3 소비 베타 정리 (Breeden's Theorem) 도출 스케치

```
Breeden (1979)의 핵심 정리:

전제:
  ICAPM이 성립: E[R_i]-R_f = beta_{i,M}*lambda_M + SUM beta_{i,k}*lambda_k
  최적 소비: C* = C*(W, s_1, ..., s_K, t)

Ito의 보조정리 (Ito's Lemma)를 C*에 적용:
  dC* = C_W*dW + SUM_k C_{s_k}*ds_k + (drift + diffusion terms)

이를 통해:
  Cov(R_i, dC*) = C_W*Cov(R_i, dW) + SUM_k C_{s_k}*Cov(R_i, ds_k)

ICAPM의 다중 베타를 소비와의 단일 공분산으로 축약:
  E[R_i] - R_f = (gamma_C / Var(dC/C)) * Cov(R_i, dC/C)
               = beta_{c,i} * lambda_c

여기서 gamma_C = -(C*U_CC/U_C) = 상대적 위험회피계수

핵심: K+1개의 베타 (시장 + K개 상태변수) → 1개의 소비 베타로 축약 가능
      이유: 최적 소비가 모든 상태변수의 함수이므로, 소비와의 공분산이
            모든 상태변수와의 공분산 정보를 함축한다
```

---

## 11. 실증적 검증 이슈 (Empirical Testing Issues)

### 11.1 Roll의 비판 (Roll's Critique)

Richard Roll (1977), *A Critique of the Asset Pricing Theory's Tests*,
Journal of Financial Economics, 4(2), 129-176

```
Roll의 비판 핵심:

  1. CAPM은 "시장 포트폴리오가 mean-variance efficient"라는 동치 명제이다
  2. 진정한 시장 포트폴리오는 관측 불가능하다
     (모든 자산: 주식, 채권, 부동산, 인적자본, ...)
  3. 우리가 사용하는 시장 프록시 (KOSPI, S&P 500)는 진정한 시장 포트폴리오가 아니다
  4. 따라서 CAPM의 기각은 "CAPM이 틀렸다" 또는 "프록시가 부적절하다" 중
     어느 것인지 구분할 수 없다 (joint hypothesis problem)

수학적 표현:
  CAPM 검정: H0: alpha_i = 0 for all i (시장 모형 기준)
  이 검정의 유효성은 시장 프록시 M*의 선택에 의존한다

  시장 프록시 M*가 mean-variance efficient → 모든 alpha = 0 (자동)
  시장 프록시 M*가 inefficient → alpha != 0 (CAPM 탓? 프록시 탓?)
```

KRX에서의 시사점:

```
CheeseStock의 시장 프록시:
  compute_capm_beta.py: 시총 가중 합성 시장 수익률
  → KOSPI 지수 또는 전체 종목의 시총 가중 평균

Roll 비판의 함의:
  1. 이 프록시로 계산된 beta가 "진정한 시장 beta"와 다를 수 있다
  2. Jensen's Alpha가 0이 아닌 것이 진짜 alpha인지 프록시 오류인지 불확실
  3. 그러나 이것은 모든 실무에 해당하는 한계이므로 수용한다

실무적 대응:
  - 단일 시장 프록시에 과도하게 의존하지 않는다
  - 다중 팩터 모형 (APT/FF)을 사용하여 Roll 비판의 영향을 분산한다
  - alpha의 절대 크기보다 상대적 순위를 신뢰한다
```

### 11.2 팩터 동물원 문제 (Factor Zoo)

```
문제 진술:
  학술 문헌에서 제안된 "유의한" 팩터: 300개 이상 (Harvey et al. 2016)
  대부분은 다중 검정(multiple testing) 편향의 산물일 가능성

Harvey, Liu & Zhu (2016), "...and the Cross-Section of Expected Returns",
Review of Financial Studies:

  전통적 t > 2.0 기준 → t > 3.0 이상이 필요 (다중 검정 보정 후)

McLean & Pontiff (2016), "Does Academic Research Destroy Stock Return
Predictability?", Journal of Finance:

  학술 논문 발표 후 해당 이상(anomaly)의 크기가 ~58% 감소
  → 발표 편향(publication bias) + 차익거래에 의한 소멸

CheeseStock의 대응:
  1. 팩터 추가 시 t >= 3.0 기준 적용 (Harvey et al. 준수)
  2. Walk-Forward IC로 out-of-sample 유효성 검증
  3. 경제적 직관이 없는 팩터는 아무리 t-stat이 높아도 기각
  4. 기존 17열의 5개 APT 팩터는 모두 t > 3.0 및 이론적 근거 충족
```

### 11.3 시변적 위험 프리미엄 (Time-Varying Risk Premia)

```
정적 모형의 한계:
  모든 자산가격결정 모형이 가정하는 것:
    lambda_k = constant (위험 프리미엄이 시간에 따라 일정)

현실:
  위험 프리미엄은 시장 상태에 따라 변한다
  → 경기 확장기: lambda 낮음 (위험 선호)
  → 경기 침체기: lambda 높음 (위험 회피)

조건부 자산가격결정 (Conditional Asset Pricing):
  E_t[R_i] = R_f,t + SUM beta_{i,k,t} * lambda_{k,t}

  → beta도 시간에 따라 변하고 (time-varying beta)
  → lambda도 시간에 따라 변한다 (time-varying risk premia)
  → 이중의 시변성(dual time-variation)

CheeseStock의 현행 대응:
  1. Rolling beta (25_capm_delta_covariance.md §1.2 Method 2)
  2. EWMA beta (25_capm_delta_covariance.md §1.2 Method 3)
  3. 4-regime 분류 (grand audit Phase B의 레짐 분류기)
  4. MRA의 regime 교호작용 항 (mra_combined.py)

이론적 근거:
  ICAPM은 본질적으로 조건부 모형이다
  → 상태변수 s_k가 변하면 lambda_k도 변한다
  → 시변적 위험 프리미엄은 ICAPM의 자연스러운 결과
```

---

## 12. 참고문헌 (References)

### 핵심 문헌 (Primary References)

- Sharpe, W.F. (1963). *A Simplified Model for Portfolio Analysis*. Management Science, 9(2), 277-293.
- Sharpe, W.F. (1964). *Capital Asset Prices: A Theory of Market Equilibrium Under Conditions of Risk*. Journal of Finance, 19(3), 425-442.
- Lintner, J. (1965). *The Valuation of Risk Assets and the Selection of Risky Investments in Stock Portfolios and Capital Budgets*. Review of Economics and Statistics, 47(1), 13-37.
- Mossin, J. (1966). *Equilibrium in a Capital Asset Market*. Econometrica, 34(4), 768-783.
- Black, F. (1972). *Capital Market Equilibrium with Restricted Borrowing*. Journal of Business, 45(3), 444-455.
- Merton, R.C. (1973). *An Intertemporal Capital Asset Pricing Model*. Econometrica, 41(5), 867-887.
- Ross, S.A. (1976). *The Arbitrage Theory of Capital Asset Pricing*. Journal of Economic Theory, 13(3), 341-360.
- Lucas, R.E. (1978). *Asset Prices in an Exchange Economy*. Econometrica, 46(6), 1429-1445.
- Breeden, D.T. (1979). *An Intertemporal Asset Pricing Model with Stochastic Consumption and Investment Opportunities*. Journal of Financial Economics, 7(3), 265-296.

### 실증 연구 (Empirical Studies)

- Fama, E.F. & MacBeth, J.D. (1973). *Risk, Return, and Equilibrium: Empirical Tests*. Journal of Political Economy, 81(3), 607-636.
- Fama, E.F. & French, K.R. (1992). *The Cross-Section of Expected Stock Returns*. Journal of Finance, 47(2), 427-465.
- Fama, E.F. & French, K.R. (1993). *Common Risk Factors in the Returns on Stocks and Bonds*. Journal of Financial Economics, 33(1), 3-56.
- Fama, E.F. & French, K.R. (2015). *A Five-Factor Asset Pricing Model*. Journal of Financial Economics, 116(1), 1-22.
- Carhart, M.M. (1997). *On Persistence in Mutual Fund Performance*. Journal of Finance, 52(1), 57-82.
- Jegadeesh, N. & Titman, S. (1993). *Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency*. Journal of Finance, 48(1), 65-91.
- Novy-Marx, R. (2013). *The Other Side of Value: The Gross Profitability Premium*. Journal of Financial Economics, 108(1), 1-28.
- Amihud, Y. (2002). *Illiquidity and Stock Returns: Cross-Section and Time-Series Effects*. Journal of Financial Markets, 5(1), 31-56.

### 퍼즐과 해결 (Puzzles and Resolutions)

- Mehra, R. & Prescott, E.C. (1985). *The Equity Premium: A Puzzle*. Journal of Monetary Economics, 15(2), 145-161.
- Epstein, L.G. & Zin, S.E. (1989). *Substitution, Risk Aversion, and the Temporal Behavior of Consumption and Asset Returns*. Econometrica, 57(4), 937-969.
- Campbell, J.Y. & Cochrane, J.H. (1999). *By Force of Habit: A Consumption-Based Explanation of Aggregate Stock Market Behavior*. Journal of Political Economy, 107(2), 205-251.
- Barro, R.J. (2006). *Rare Disasters and Asset Markets in the Twentieth Century*. Quarterly Journal of Economics, 121(3), 823-866.

### 비판과 검증 (Critiques and Testing)

- Roll, R. (1977). *A Critique of the Asset Pricing Theory's Tests*. Journal of Financial Economics, 4(2), 129-176.
- Blume, M.E. (1971). *On the Assessment of Risk*. Journal of Finance, 26(1), 1-10.
- Vasicek, O.A. (1973). *A Note on Using Cross-Sectional Information in Bayesian Estimation of Security Betas*. Journal of Finance, 28(5), 1233-1239.
- Scholes, M. & Williams, J. (1977). *Estimating Betas from Nonsynchronous Data*. Journal of Financial Economics, 5(3), 309-327.
- Harvey, C.R., Liu, Y. & Zhu, H. (2016). *...and the Cross-Section of Expected Returns*. Review of Financial Studies, 29(1), 5-68.
- McLean, R.D. & Pontiff, J. (2016). *Does Academic Research Destroy Stock Return Predictability?*. Journal of Finance, 71(1), 5-32.
- Huberman, G. (1982). *A Simple Approach to Arbitrage Pricing Theory*. Journal of Economic Theory, 28(1), 183-191.
- Chamberlain, G. & Rothschild, M. (1983). *Arbitrage, Factor Structure, and Mean-Variance Analysis on Large Asset Markets*. Econometrica, 51(5), 1281-1304.

### 행동/구조적 확장 (Behavioral and Structural Extensions)

- Frazzini, A. & Pedersen, L.H. (2014). *Betting Against Beta*. Journal of Financial Economics, 111(1), 1-25.
- Miller, E.M. (1977). *Risk, Uncertainty, and Divergence of Opinion*. Journal of Finance, 32(4), 1151-1168.
- Titman, S., Wei, K.C.J. & Xie, F. (2004). *Capital Investments and Stock Returns*. Journal of Financial and Quantitative Analysis, 39(4), 677-700.
- Banz, R.W. (1981). *The Relationship Between Return and Market Value of Common Stocks*. Journal of Financial Economics, 9(1), 3-18.

### 교과서 (Textbooks)

- Cochrane, J.H. (2005). *Asset Pricing* (Revised Edition). Princeton University Press.
- Campbell, J.Y., Lo, A.W. & MacKinlay, A.C. (1997). *The Econometrics of Financial Markets*. Princeton University Press.
- Back, K. (2017). *Asset Pricing and Portfolio Choice Theory* (2nd Edition). Oxford University Press.
- Gu, S., Kelly, B. & Xiu, D. (2020). *Empirical Asset Pricing via Machine Learning*. Review of Financial Studies, 33(5), 2223-2273.

### KRX 특화 참고 (KRX-Specific References)

- Park, J., Kang, J. & Lee, S. (2025). *Retail Investor Heterogeneity in Korean Stock Market*. SSRN Working Paper.
- Du, Y., Liu, Q. & Rhee, G. (2009). *An Anatomy of the Magnet Effect*. International Review of Finance, 9(1).
- Choe, H., Kho, B.-C. & Stulz, R. (1999). *Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997*. Journal of Financial Economics, 54(2), 227-264.
- KCMI (한국자본시장연구원, 2024). *공매도 제도 개선 연구*.

---

## 부록 A: 약어 및 기호 정리

```
모형 약어:
  MPT     = Modern Portfolio Theory
  CAPM    = Capital Asset Pricing Model
  APT     = Arbitrage Pricing Theory
  ICAPM   = Intertemporal CAPM
  CCAPM   = Consumption-Based CAPM
  SDF     = Stochastic Discount Factor
  FF3/FF5 = Fama-French 3-Factor / 5-Factor Model
  BAB     = Betting Against Beta

요인 약어:
  MKT = Market excess return (R_M - R_f)
  SMB = Small Minus Big
  HML = High Minus Low (Book-to-Market)
  RMW = Robust Minus Weak (Operating Profitability)
  CMA = Conservative Minus Aggressive (Investment)
  UMD = Up Minus Down (Momentum)

KRX 약어:
  KRX   = Korea Exchange (한국거래소)
  KOSPI = Korea Composite Stock Price Index
  KOSDAQ = Korea Securities Dealers Automated Quotations
  DART  = Data Analysis, Retrieval and Transfer System (전자공시시스템)
  ECOS  = Economic Statistics System (경제통계시스템, 한국은행)
  KOSIS = Korean Statistical Information Service (국가통계포털)
  BOK   = Bank of Korea (한국은행)
  KCMI  = Korea Capital Market Institute (한국자본시장연구원)

CheeseStock 약어:
  MRA  = Multi-Regression Analysis (다중 회귀 분석 파이프라인)
  IC   = Information Coefficient (정보계수)
  WF   = Walk-Forward (전진 검증)
  WLS  = Weighted Least Squares
  OLS  = Ordinary Least Squares
  CFS  = Consolidated Financial Statements (연결재무제표)
  OFS  = Original Financial Statements (별도재무제표)
```

---

## 부록 B: 교차 참조 인덱스

```
본 문서에서 참조하는 기존 문서:

  05_finance_theory.md
    §1:     EMH (효율적 시장 가설)
    §3.1-5: CAPM 기본, alpha, CML, SML, 분리 정리
    §4.1-3: FF 3/5-Factor, Carhart 4-Factor, 모멘텀
    §5:     BSM 옵션 가격결정
    §6:     적응적 시장 가설 (AMH)
    §8:     EWMA 변동성

  14_finance_management.md
    §2.3:   WACC (자기자본비용에 CAPM beta 사용)
    §4:     에르고딕 경제학 (소비의 기하적 성장)
    §7:     성과 측정 (Sharpe, Sortino, Treynor, Brinson)

  17_regression_backtesting.md
    전체:   Ridge, WLS, OLS 회귀 방법론

  20_krx_structural_anomalies.md
    §1-2:   KRX 시장 구조, 가격제한폭
    §5:     KOSDAQ 개인투자자 집중

  23_apt_factor_model.md
    전체:   APT 기본 공식, FF 연결, WF IC

  25_capm_delta_covariance.md
    §1.2-5: Beta 추정 4방법 (OLS, Rolling, EWMA, Kalman)
    §1.4:   시장 위험 프리미엄 (ERP)
    §2:     Delta = 팩터 민감도

  26_options_volatility_signals.md
    §1-2:   BSM + Greeks, VKOSPI 레짐

  30_macroeconomics_islm_adas.md
    §1-2:   IS-LM, 금리 채널

  33_agency_costs_industry_concentration.md
    §2:     대리인 비용 (CMA와의 연결)

  34_volatility_risk_premium_harv.md
    §2-4:   VRP, HAR-RV (ICAPM 변동성 프리미엄 이론)

  39_investor_flow_information.md
    전체:   투자자 수급 분석 (외국인 순매수)

  40_short_selling_securities_lending.md
    §1-3:   공매도 이론, KRX 규제 (Zero-Beta CAPM 근거)

  41_bond_equity_relative_value.md
    §2:     ERP (채권-주식 상대가치)

본 문서를 참조하는 기존 문서 (이미 forward reference 존재):

  05_finance_theory.md:
    line 227: "공매도 제약 → Zero-Beta CAPM (42_advanced_asset_pricing.md §2)"
    line 231: "CML/SML 심층 확장: 42_advanced_asset_pricing.md (시장모형, ICAPM, CCAPM)"
    → 본 문서의 §3 (Zero-Beta) 및 §4-5 (ICAPM, CCAPM)이 이 참조를 해결한다
```

---

*문서 작성: 2026-04-03, financial-theory-expert*
*학술 근거: Sharpe (1963, 1964), Black (1972), Merton (1973), Ross (1976),*
*Breeden (1979), Fama-French (1993, 2015), 총 40+ 학술 문헌 인용*
*코드 연결: compute_capm_beta.py, mra_apt_extended.py, ff3_factors.json*
