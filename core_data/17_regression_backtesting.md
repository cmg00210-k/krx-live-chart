# 17. 패턴 수익률 회귀분석 (Regression-Based Return Prediction)

## 17.1 개요

기술적 패턴 감지 후 N일 기대수익률을 통계적으로 예측하는 프레임워크.
단순 과거 평균이 아닌, 패턴 품질·추세·거래량·변동성을 독립변수로 한 회귀 모델.

## 17.2 학술 근거

### 핵심 논문

| 저자 | 연도 | 제목 | 핵심 발견 |
|------|------|------|----------|
| Lo, Mamaysky & Wang | 2000 | Foundations of Technical Analysis (MIT) | 커널 회귀로 기술적 패턴의 통계적 유의성 증명 |
| Caginalp & Laurent | 1998 | The Predictive Power of Price Patterns | S&P500 캔들패턴 2일 수익률 ~1%, 36σ 유의 |
| Park & Irwin | 2007 | Profitability of Technical Analysis (메타분석) | 95개 현대 연구 중 56개 기술적 분석 유효 |
| Lo | 2004 | The Adaptive Markets Hypothesis | 시장 효율성 시변 → 최신 데이터 가중 정당화 |
| Reschenhofer et al. | 2021 | Time-dependent WLS for Stock Returns | WLS가 OLS보다 "훨씬 강한" 예측력 |
| Bulkowski | 2005, 2012 | Encyclopedia of Candlestick/Chart Patterns | 패턴별 통계 DB (승률, 평균 수익률) |
| Yildiz et al. | 2018 | KRX Price Limit Change Effects | 30% 제한폭 → 변동성 3.6-9.3% 증가 |
| Park, Kang & Lee | 2025 | Retail Investor Heterogeneity in Korea | 개인투자자 60-70% → 군집행동 |

### R² 해석 (금융 수익률 맥락)

Lo & MacKinlay (1999) "A Non-Random Walk Down Wall Street":
- R² = 0.02-0.03 → **경제적으로 유의미** (연간 수백 bp 차이)
- R² = 0.05+ → 실전 트레이딩 전략 수준
- 금융 수익률 예측에서 R² > 0.10은 극히 드묾

## 17.3 KRX 시장 특수 요인

### 가격제한폭 (30%)
- 2015.06.15 ±15% → ±30% 확대
- 수익률 분포 절단 (bounded Y) → ATR 정규화로 변동성 체제 보정 필요
- 갭 패턴 (abandoned baby, star) 빈도 감소

### 개인투자자 비중 (60-70%)
- 미국(~20%) 대비 3배 → 군집행동 증폭
- 거래량 확인(volume confirmation)이 미국보다 더 강한 예측 변수
- 캔들패턴 매수/매도 신호에 대한 집단 반응 강화

### 삼성전자 집중도 (KOSPI 20%+)
- 반도체 사이클 → 시장 전체 패턴에 체계적 영향
- 향후 β_samsung (삼성 베타) 통제 변수 고려

## 17.4 권장 모델: 가중 다중 선형 회귀 (WLS)

### 모델 사양

$$E[R_{N}] = \alpha_p + \beta_1 \cdot \text{conf} + \beta_2 \cdot \text{trend} + \beta_3 \cdot \ln(\text{volRatio}) + \beta_4 \cdot \text{atrNorm} + \beta_5 \cdot \text{wc}$$

여기서:
- $R_N$ = 패턴 완성 후 N일 수익률 (%)
- $\alpha_p$ = 패턴 유형별 절편 (기본 수익률)
- $\text{conf}$ = 패턴 신뢰도 / 100 (0-1)
- $\text{trend}$ = 직전 추세 강도 (0-1, ATR 정규화)
- $\ln(\text{volRatio})$ = 거래량비 자연로그 (우편향 안정화)
- $\text{atrNorm}$ = ATR / 종가 (변동성 체제 보정)
- $\text{wc}$ = 적응형 가중치 hw * mw (시장 미시구조 보정, §17.14 참조)

### 가중치 체계

$$w_i = \lambda^{T - t_i}, \quad \lambda = 0.995$$

- 반감기 ≈ 139 거래일 (~7개월)
- 최신 패턴에 더 높은 가중치 → 시장 체제 변화 반영
- Lo(2004) AMH: 시장 효율성은 시간에 따라 변동

### 정규방정식 (Normal Equation)

$$\hat{\beta} = (X^T W X)^{-1} X^T W y$$

여기서:
- $X$ = 설계 행렬 [1, conf, trend, lnVol, atrNorm, wc] (n × 6, §17.14 참조)
- $W$ = 대각 가중 행렬 ($W_{ii} = w_i$)
- $y$ = 관측 수익률 벡터 (n × 1)

### 95% 신뢰구간

$$\text{SE}(\hat{y}_{new}) = \sqrt{\hat{\sigma}^2 \cdot (1 + x_{new}^T (X^T W X)^{-1} x_{new})}$$

$$\text{95% CI} = [\hat{y}_{new} - t_{0.025, df} \cdot \text{SE}, \quad \hat{y}_{new} + t_{0.025, df} \cdot \text{SE}]$$

### R² 계산

$$R^2 = 1 - \frac{\sum w_i (y_i - \hat{y}_i)^2}{\sum w_i (y_i - \bar{y}_w)^2}$$

여기서 $\bar{y}_w = \frac{\sum w_i y_i}{\sum w_i}$ (가중 평균)

## 17.5 예측 변수 상세

| 변수 | 범위 | 소스 코드 | 학술 근거 |
|------|------|----------|----------|
| confidence | 0-1 | `pattern.confidence / 100` | Bulkowski: 고품질 패턴 = 높은 수익률 |
| trendStrength | 0+ | `_detectTrend()` → `trend.strength` | Lo+Wang: 추세 맥락이 패턴 유효성 결정 |
| ln(volumeRatio) | -2.3+ | `Math.log(max(volRatio, 0.1))` | Caginalp: 거래량 확인 필수 |
| atrNorm | 0+ | `calcATR(candles)[i] / close[i]` | 변동성 정규화 (다중 종목 비교 가능) |
| wc | 0.36-1.40 | `occ.wc` (hw * mw) | Lo(2004) AMH: 적응형 시장 미시구조 가중치 |

### ln(거래량비) 변환 근거
- 원시 거래량비는 우편향 분포 (대부분 1-2, 간혹 10+)
- 로그 변환으로 정규분포 근사 → OLS 잔차 정규성 개선
- KRX 개인투자자 군집행동으로 극단값 빈번 → 로그 필수

## 17.6 Bulkowski 사전 기준 (n < 30 폴백)

표본이 부족한 패턴에 대해 학술 통계를 기본값으로 사용:

| 패턴 | 10일 평균 수익률 | 승률 | 출처 |
|------|----------------|------|------|
| Three White Soldiers | +3.4% | 66% | Bulkowski 2012 |
| Bullish Engulfing | +2.8% | 63% | Bulkowski 2005 |
| Hammer | +2.2% | 60% | Bulkowski 2005 |
| Morning Star | +3.0% | 67% | Bulkowski 2012 |
| Evening Star | -4.3% | 72% | Bulkowski 2005 |
| Shooting Star | -2.1% | 59% | Bulkowski 2005 |
| Head & Shoulders | -5.2% | 81% | Bulkowski 2005 |
| Double Bottom | +4.0% | 70% | Bulkowski 2005 |
| Ascending Triangle | +3.8% | 75% | Bulkowski 2005 |

> KRX 데이터가 30건 이상 축적되면 Bulkowski 기준 대신 실제 회귀 계수 사용

## 17.7 대안 모델 (향후 확장)

### Bayesian NIG 회귀 (희귀 패턴용)

$$\beta \sim N(\mu_0, \sigma^2 V_0), \quad \sigma^2 \sim IG(a_0, b_0)$$

사후 분포 (Conjugate update):
$$V_n = (V_0^{-1} + X^T X)^{-1}$$
$$\mu_n = V_n (V_0^{-1} \mu_0 + X^T y)$$

장점: n=5-10에서도 안정적 추정 (사전분포가 정규화)

### Ridge 회귀 (현재 적용 중)

$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

현행: 6변수 WLS + Ridge lambda=2.0 (§17.13 상세). 절편은 페널티 미적용.
향후: 8변수 확장 시 rsi_z, macdNorm, bbPosition, patternDuration 추가 가능.
장점: 다중공선성 처리 (mw의 75%가 1.0으로 절편과 공선성)

## 17.8 구현 사양 (JavaScript)

### 4×4 행렬 역행렬 (Gauss-Jordan)

```
function invertMatrix(m) {
  // 4×4 → ~50줄 JS
  // Cramer's rule 또는 Gauss-Jordan 소거법
}
```

### WLS 회귀 함수 시그니처

```
function wlsRegression(X, y, weights) {
  // Input: X (n×p), y (n×1), weights (n×1)
  // Output: { coeffs, rSquared, stdError, tStats, pValues, ci95 }
}
```

### 기대수익률 예측

```
function predictReturn(pattern, coeffs) {
  // Input: 새 패턴의 특성 벡터, 회귀 계수
  // Output: { expected, ci95Lower, ci95Upper, rSquared }
}
```

## 17.9 검증 체크리스트

- [ ] 각 패턴 유형별 최소 30건 표본 확보
- [ ] 잔차 정규성 검정 (Shapiro-Wilk 또는 시각적)
- [ ] 다중공선성 VIF < 5 확인
- [ ] 시계열 교차검증 (무작위 분할 금지 — look-ahead bias 방지)
- [ ] 전진 보행 (walk-forward) 테스트로 과적합 검증
- [ ] Bulkowski 폴백과 실제 회귀 결과 비교

## §17.10 HC3 이분산-견고 표준오차 (Heteroskedasticity-Consistent SE)

> 코드 매핑: indicators.js:273-311 (calcWLSRegression 내 HC3 블록)

### 학술 기반

**HC0 — White (1980) 샌드위치 추정량:**

White, H. (1980). "A Heteroskedasticity-Consistent Covariance Matrix Estimator
  and a Direct Test for Heteroskedasticity." Econometrica, 48(4), 817-838.

White는 OLS 잔차의 이분산성(heteroskedasticity)이 존재하더라도
점근적으로 유효한 공분산 추정량을 제안했다:

```
Cov_HC0(beta) = (X'X)^{-1}  [sum_i e_i^2 * x_i x_i']  (X'X)^{-1}

e_i = y_i - x_i' beta  (잔차)
```

**HC3 — MacKinnon & White (1985) 유한표본 보정:**

MacKinnon, J. G., & White, H. (1985). "Some heteroskedasticity-consistent
  covariance matrix estimators with improved finite sample properties."
  Journal of Econometrics, 29(3), 305-325.

HC0는 고레버리지(high leverage) 관측치에서 유한표본 size distortion이 크다.
HC3는 모자 행렬(hat matrix) 대각 원소로 레버리지를 보정한다:

```
Cov_HC3(beta) = (X'WX)^{-1}  [sum_i w_i^2 * e_i^2 / (1 - h_ii)^2 * x_i x_i']  (X'WX)^{-1}

h_ii  : hat matrix 대각 원소 (leverage) = w_i * x_i' (X'WX)^{-1} x_i
w_i   : WLS 관측 가중치
(1 - h_ii)^2 : 레버리지 패널티 — h_ii가 클수록 해당 잔차의 영향력 강화
```

**HC 변형들의 비교 (Long & Ervin 2000):**

Long, J. S., & Ervin, L. H. (2000). "Using Heteroscedasticity Consistent
  Standard Errors in the Linear Regression Model."
  The American Statistician, 54(3), 217-224.

```
HC0:  e_i^2                    — 원본 White(1980). 소표본 편향 과소
HC1:  n/(n-p) * e_i^2          — 자유도 보정
HC2:  e_i^2 / (1 - h_ii)      — leverage 1차 보정
HC3:  e_i^2 / (1 - h_ii)^2   -- leverage 2차 보정 (삭제 잔차 근사)
```

Long & Ervin(2000)은 소표본(n < 250)에서 HC3가 가장 낮은 size distortion을
보임을 시뮬레이션으로 확인했다. 패턴 표본이 30-200건인 CheeseStock에서 HC3가
HC0보다 적합하다.

### WLS에서의 레버리지 보정 (가중 hat matrix)

WLS(Weighted Least Squares)에서 hat matrix는 가중치를 포함한다:

```
H = W^{1/2} X (X'WX)^{-1} X' W^{1/2}

h_ii = w_i * x_i' (X'WX)^{-1} x_i

여기서:
  w_i = lambda^(T - t_i)  -- 시간 감쇠 가중치 (17.4절)
  x_i = [1, conf_i, trend_i, ln(volRatio_i), atrNorm_i]  -- 설계행렬 행
  (X'WX)^{-1}  -- _invertMatrix()로 Gauss-Jordan 소거법 계산 (indicators.js:333+)
```

### 샌드위치 추정량 계산 (JavaScript 구현)

```
// meat matrix B = sum_i w_i^2 * e_i^2 / (1-h_ii)^2 * x_i x_i'
//
// 코드에서:
//   h_ii = sum_j sum_k X[i][j] * inv[j][k] * X[i][k] * w  (backtester.js 동일 패턴)
//   denom = 1 - min(h_ii, 0.99)           -- h_ii = 1.0 방지 (완전 레버리지)
//   eScaled = w * residuals[i] / denom^2  -- HC3 분자
//   meat[j][k] += X[i][j] * w * eScaled * residuals[i] * X[i][k]
//
// sandwich: Cov_HC3 = inv * meat * inv
// HC3 표준오차: hcStdErrors[j] = sqrt(max(0, [inv * meat * inv]_jj))
// HC3 t-통계량: hcTStats[j] = coeffs[j] / hcStdErrors[j]
```

### 왜 금융 수익률에 HC3가 필수인가

금융 수익률은 구조적으로 이분산적이다:

1. **GARCH 효과**: 변동성이 시간에 따라 변동 (고변동성 기간 vs 저변동성 기간)
2. **KRX 가격제한폭 절단**: 극단 수익률이 ±30%로 잘려 분포 왜곡
3. **패턴별 이질성**: 삼선홍기(threeWhiteSoldiers) 패턴 발생 시점은
   특정 상승 체제에 집중 → 표본 내 분산이 불균등

이 상황에서 표준 OLS/WLS 표준오차는 t-통계량을 과대추정하여
유의하지 않은 계수를 유의하다고 판단할 수 있다(Type I error 증가).
HC3는 이분산성에도 불구하고 t-통계량의 신뢰도를 유지한다.

### 엔진 적용 효과

calcWLSRegression()의 반환값:
```
{
  tStats    : OLS 표준오차 기반 t-통계량 (이분산 존재 시 부정확)
  hcTStats  : HC3 표준오차 기반 t-통계량 (이분산 견고)
  hcStdErrors: HC3 표준오차 벡터
}
```

사용처: backtester.js의 WLS 회귀 후 패턴별 계수 유의성 판단.
hcTStats를 사용하면 변동성이 높은 종목군(KOSDAQ 소형주 등)에서도
과대 신뢰를 방지하여 패턴 예측의 정확도를 유지한다.

코드 매핑: indicators.js:273-311

---

## §17.11 Holm-Bonferroni Step-Down 다중비교 보정

> 코드 매핑: backtester.js:227-317 (_applyHolmBonferroni, _tCriticalForAlpha)

### 문제: 다중비교에서의 거짓 발견

27개 패턴 x 5개 기간(horizon) = 135건의 동시 가설 검정.
alpha = 0.05 수준에서 개별 검정 시, 하나 이상 거짓 양성(false positive) 확률:

```
P(하나 이상 거짓 양성) = 1 - (1 - 0.05)^135 ≈ 0.999

-> 보정 없이는 거의 확실히 하나 이상의 무효 패턴이 "유의"로 판정됨
```

### 보정 방법 비교표

| 방법 | 통제 대상 | 검정력 | 보수성 | 적합 상황 |
|------|----------|--------|--------|----------|
| **Bonferroni** (1936) | FWER | 낮음 | 매우 보수적 | 검정 수 적을 때 |
| **Holm step-down** (1979) | FWER | 중간 | 덜 보수적 | 범용 (코드 채택) |
| **BH-FDR** (1995) | FDR | 높음 | 관대 | 탐색적 분석 |
| **Sidak** (1967) | FWER | 낮음 | 약간 덜 보수적 | 독립 검정 |

FWER = Family-Wise Error Rate (한 건이라도 거짓 기각할 확률)
FDR = False Discovery Rate (기각 중 거짓 비율의 기대값)

### Holm 선택 이유

Holm, S. (1979). "A Simple Sequentially Rejective Multiple Test Procedure."
  Scandinavian Journal of Statistics, 6(2), 65-70.

1. **FWER 통제**: 패턴 매매 전략에서 거짓 양성은 실질적 손실로 이어지므로
   FDR보다 엄격한 FWER 통제가 적절.
2. **Bonferroni보다 높은 검정력**: Holm은 Bonferroni의 "균일하게 더 강력한(uniformly
   more powerful)" 개선판. 동일한 FWER 보장 하에서 더 많은 진양성을 탐지.
   135건 검정에서 Bonferroni는 alpha/135 = 0.00037이 모든 검정에 적용되나,
   Holm은 가장 유의한 검정에만 alpha/135를 적용하고 이후 점진 완화.
3. **분포 무가정**: 검정 간 독립성을 요구하지 않음. 패턴 수익률 간의 상관
   (같은 종목에서 여러 패턴 동시 출현)에도 FWER가 보장됨.

### Holm Step-Down 절차

```
1. m개 검정의 p-value(또는 |t-stat|)를 유의도 순으로 정렬
2. rank k (0-indexed)에서 adjusted alpha_k = alpha / (m - k)
3. 가장 유의한 검정(k=0)부터 순차 검증:
   |t_stat| > t_critical(alpha/(m-k), df)이면 기각하고 다음으로 진행
4. 처음으로 기각에 실패하면, 해당 검정과 이후 모든 검정을 기각하지 않음

예시 (m=135, alpha=0.05):
  k=0:   adjusted alpha = 0.05/135 = 0.000370  (가장 엄격)
  k=1:   adjusted alpha = 0.05/134 = 0.000373
  ...
  k=134: adjusted alpha = 0.05/1   = 0.050000  (가장 관대)
```

BH-FDR을 채택하지 않은 이유:
  FDR은 "기각 중 5%가 거짓"을 허용하므로, 135건 중 20건 기각 시
  1건의 거짓 양성을 허용함. 패턴 기반 매매에서 1건의 거짓 양성도
  해당 패턴에 의존한 거래 전체에 영향을 미치므로 FWER 통제가 바람직.

### Cornish-Fisher + Abramowitz-Stegun 근사 (t-분포 역함수)

Holm 절차에서 각 단계별 adjusted alpha에 대응하는 t-임계값이 필요.
정확한 t-분포 역함수(qt) 없이 JavaScript에서 근사하는 2단계 절차:

**Step 1: 표준정규 분위수 (Abramowitz & Stegun 26.2.23)**

Abramowitz, M. & Stegun, I.A. (1972). *Handbook of Mathematical Functions
  with Formulas, Graphs, and Mathematical Tables*. NBS Applied Mathematics
  Series 55, 10th printing. Eq. 26.2.23.

```
유리 근사 (Rational Approximation):
  t = sqrt(-2 * ln(1 - p))     (p = 1 - alpha/2, upper tail)

  z_p = t - (c0 + c1*t + c2*t^2) / (1 + d1*t + d2*t^2 + d3*t^3)

  계수:
    c0 = 2.515517,  c1 = 0.802853,  c2 = 0.010328
    d1 = 1.432788,  d2 = 0.189269,  d3 = 0.001308

  정확도: |오차| < 4.5e-4 (모든 p에 대해)
```

이 근사는 Hastings (1955)의 유리 근사에 기반하며,
A&S Table 26.2에서 가장 널리 사용되는 형태.

**Step 2: Cornish-Fisher 전개 (정규→t 보정)**

Cornish, E.A. & Fisher, R.A. (1937). "Moments and Cumulants in the
  Specification of Distributions." Revue de l'Institut International
  de Statistique, 5(4), 307-320.

```
t-분위수 ≈ z + correction terms:

  1차 보정: t ≈ z + (z^3 + z) / (4 * df)
  2차 보정: t ≈ z + (z^3 + z) / (4 * df)
                  + (5*z^5 + 16*z^3 + 3*z) / (96 * df^2)

  df = n - 1 (자유도)
```

정확도 평가:
```
  df >= 30:  |오차| < 0.001  (실질적으로 정확)
  df >= 10:  |오차| < 0.01   (실용적 정확도)
  df = 5:    |오차| < 0.05   (편향 존재하나 Holm 보수성으로 상쇄)
  df < 3:    부정확 → 코드에서 Infinity 반환 (df < 1 가드)
```

패턴 백테스트에서 표본 n >= 30이 WLS 회귀 조건이므로 df >= 29.
이 범위에서 Cornish-Fisher 2차 근사는 충분한 정확도를 제공한다.

등급: **B등급** (Holm 선택 자체는 학술 표준, 수치 근사는 표준 참고서 기반)

코드 매핑: backtester.js:227-247 (Holm 절차), 334-370 (Cornish-Fisher)

---

## §17.12 시가 진입 규칙과 슬리피지=0 가정

> 코드 매핑: backtester.js:494-501

### 진입 규칙: 패턴 완성 다음 봉 시가

```
entryPrice = candles[pattern.endIndex + 1].open
exitPrice  = candles[pattern.endIndex + 1 + N].close
return     = (exitPrice - entryPrice) / entryPrice * 100 - KRX_COST
```

이 규칙은 look-ahead bias를 제거하는 백테스트 표준이다:

Aronson, D. (2007). *Evidence-Based Technical Analysis: Applying the
  Scientific Method and Statistical Inference to Trading Signals*.
  Wiley. Ch.6 "Backtesting" — "진입은 신호 발생 다음 봉의 시가를 사용해야
  한다. 신호 발생 봉의 종가로 진입하면 관찰 불가능한 미래 정보를 사용하는
  것이며, 이는 상향 편향(upward bias)을 유발한다."

### 슬리피지=0 가정의 타당성

코드에서 슬리피지(slippage)는 0으로 가정한다 (거래비용만 차감).
이는 다음 조건에서 합리적이다:

1. **일봉 백테스트**: 시가 주문(MOO, Market-on-Open)은 장 시작 시
   체결되므로 슬리피지가 최소화됨.
2. **KRX 유동성**: KOSPI 대형주의 호가 스프레드는 0.01-0.02% 수준.
   KOSDAQ 소형주는 0.05-0.2%까지 발생 가능.

한계:
```
  KRX 실무 슬리피지 추정 (일봉 시가 주문 기준):
    KOSPI 시가총액 상위 50: ~0.01-0.02%
    KOSPI 200 구성종목:     ~0.02-0.05%
    KOSDAQ 중소형:          ~0.05-0.20%
    KOSDAQ 저유동성:        ~0.20-0.50%
```

개선 권장: KOSDAQ 소형주에 대해 슬리피지 0.1% 차감 적용을 고려.
현재 코드의 KRX_COST(왕복 거래비용)에 슬리피지를 통합하면
보수적 백테스트 가능.

등급: **C등급** (슬리피지=0 가정은 대형주에 합리적이나,
소형주에서는 과대평가 위험이 있는 교정 가능 파라미터)

코드 매핑: backtester.js:494-501 (시가 진입), 501 (KRX_COST 차감)

---

## §17.13 Ridge 정규화 lambda=2.0

> 코드 매핑: indicators.js:199-225 (calcWLSRegression, ridgeLambda 적용)

### 학술 원전

Hoerl, A.E. & Kennard, R.W. (1970). "Ridge Regression: Biased Estimation
  for Nonorthogonal Problems." Technometrics, 12(1), 55-67.

Ridge 회귀는 정규방정식에 정규화 항을 추가하여 다중공선성(multicollinearity)
문제를 해결한다:

```
OLS:   beta = (X'WX)^{-1} X'Wy
Ridge: beta = (X'WX + lambda*I)^{-1} X'Wy

여기서:
  lambda > 0:  정규화 강도
  I:           단위 행렬 (절편 열 제외)
```

코드 구현:
```
// indicators.js:221-225
if (ridgeLambda && ridgeLambda > 0) {
  for (var j = 1; j < p; j++) {    // j=0 절편은 페널티 미적용
    XtWX[j][j] += ridgeLambda;
  }
}
```

### lambda=2.0 선택 근거

lambda = 2.0이 선택된 배경:

1. **다중공선성 실증**: mw(meanRevWeight)의 약 75%가 값 1.0 (정상 이격).
   이 경우 mw와 절편 열이 거의 선형 종속 → 공선성 지수(condition number) 증가.
   Ridge는 X'WX 대각에 lambda를 가산하여 행렬 조건수를 개선한다.

2. **lambda 크기의 직관**:
```
   lambda = 0:     OLS (정규화 없음, 과적합 위험)
   lambda = 0.01:  미약한 정규화 (다중공선성 심할 때 불충분)
   lambda = 2.0:   중간 정규화 (현재 채택)
   lambda = 10.0:  강한 정규화 (계수가 0 방향으로 과도 수축)
```

3. **GCV 미적용 이유**: Generalized Cross-Validation (Golub, Heath & Wahba 1979)으로
   최적 lambda를 데이터에서 추정할 수 있으나, 패턴별 표본이 30-200건으로
   GCV의 안정적 추정에 부족. 고정 lambda = 2.0은 보수적 선택.

4. **Calibration 가능성**: calibrate_constants.py에서 lambda를 교정 가능.
   Stage B LinUCB가 wc 계수의 중요도를 학습하면서 lambda의 최적값이
   간접적으로 반영됨.

등급: **C등급** (학술 방법론은 A등급이나, lambda=2.0 수치는 교정 가능한 실증적 선택)

참고문헌:
  Hoerl, A.E. & Kennard, R.W. (1970). Technometrics, 12(1), 55-67.
  Golub, G., Heath, M. & Wahba, G. (1979). "Generalized Cross-Validation
    as a Method for Choosing a Good Ridge Parameter." Technometrics, 21(2), 215-223.

---

## §17.14 WLS 설계행렬 6열 구조 (wc 변수 추가)

> 코드 매핑: backtester.js:590-614

### 설계행렬 변경 이력

원래 4변수(§17.4):
```
X = [1, confidence, trendStrength, lnVolumeRatio, atrNorm]  (n x 5)
```

현행 6변수 (Stage A-1 이후):
```
X = [1, confidence, trendStrength, lnVolumeRatio, atrNorm, wc]  (n x 6)
```

### 6열 변수 정의

| 열 | 변수명 | 범위 | 소스 코드 | 학술 근거 |
|----|--------|------|----------|----------|
| 0 | intercept | 1 (상수) | 직접 삽입 | OLS/WLS 기본 |
| 1 | confidence | 0-1 | occ.confidence/100 | Bulkowski: 패턴 품질→수익률 |
| 2 | trendStrength | 0+ | occ.trendStrength | Lo+Wang: 추세 맥락 |
| 3 | lnVolumeRatio | -2.3+ | ln(max(volRatio,0.1)) | Karpoff: 가격-거래량 관계 |
| 4 | atrNorm | 0+ | occ.atrNorm (ATR/close) | 변동성 체제 보정 |
| 5 | wc | 0.36-1.40 | occ.wc (hw*mw) | Lo(2004) AMH: 시장 적응형 가중치 |

### wc 추가의 예측 정보 기여

Stage A-1 실증 결과:
```
  wc 계수의 t-stat = 9.02 (p < 0.001)
  전체 IC 개선: 5변수 IC=0.022 → 6변수 IC=0.030
  wc가 기존 4변수(conf, trend, lnVol, atrNorm)와
  낮은 상관(VIF < 1.8)을 가지며, 독립적 예측 정보를 추가.
```

wc는 Hurst 지수(추세 지속성)와 이격도(평균 회귀 정도)를 종합한 변수로,
기존 변수가 포착하지 못하는 시장 미시구조 정보를 반영한다.

등급: **B등급** (6변수 확장은 IC 실증으로 검증됨, 변수 선택 자체는 이론적으로 지지됨)

코드 매핑: backtester.js:596-602 (X 행 구성), 611 (labels 배열)

---

## 참고문헌

1. Lo, A., Mamaysky, H., & Wang, J. (2000). Foundations of Technical Analysis. *Journal of Finance*, 55(4), 1705-1765.
2. Caginalp, G., & Laurent, H. (1998). The Predictive Power of Price Patterns. *Applied Mathematical Finance*, 5(3-4), 181-205.
3. Park, C.-H., & Irwin, S. H. (2007). What Do We Know About the Profitability of Technical Analysis? *Journal of Economic Surveys*, 21(4), 786-826.
4. Lo, A. (2004). The Adaptive Markets Hypothesis. *Journal of Portfolio Management*, 30(5), 15-29.
5. Reschenhofer, E., et al. (2021). Forecasting stock returns: A time-dependent weighted least squares approach. *International Journal of Forecasting*.
6. Bulkowski, T. (2005). *Encyclopedia of Chart Patterns*, 2nd ed. Wiley.
7. Bulkowski, T. (2012). *Encyclopedia of Candlestick Charts*. Wiley.
8. Lo, A., & MacKinlay, A. C. (1999). *A Non-Random Walk Down Wall Street*. Princeton University Press.
9. Yildiz, S., et al. (2018). Effects of Price Limit Change on Market Stability at KRX. *arXiv:1805.04728*.
10. Park, J., Kang, J., & Lee, S. (2025). Retail Investor Heterogeneity in Korean Stock Market. *SSRN*.
11. White, H. (1980). A Heteroskedasticity-Consistent Covariance Matrix Estimator and a Direct Test for Heteroskedasticity. *Econometrica*, 48(4), 817-838.
12. MacKinnon, J. G., & White, H. (1985). Some heteroskedasticity-consistent covariance matrix estimators with improved finite sample properties. *Journal of Econometrics*, 29(3), 305-325.
13. Long, J. S., & Ervin, L. H. (2000). Using Heteroscedasticity Consistent Standard Errors in the Linear Regression Model. *The American Statistician*, 54(3), 217-224.
14. Holm, S. (1979). A Simple Sequentially Rejective Multiple Test Procedure. *Scandinavian Journal of Statistics*, 6(2), 65-70.
15. Abramowitz, M. & Stegun, I.A. (1972). *Handbook of Mathematical Functions*. NBS Applied Mathematics Series 55. Eq. 26.2.23.
16. Cornish, E.A. & Fisher, R.A. (1937). Moments and Cumulants in the Specification of Distributions. *Revue de l'Institut International de Statistique*, 5(4), 307-320.
17. Aronson, D. (2007). *Evidence-Based Technical Analysis*. Wiley.
18. Hoerl, A.E. & Kennard, R.W. (1970). Ridge Regression: Biased Estimation for Nonorthogonal Problems. *Technometrics*, 12(1), 55-67.
19. Golub, G., Heath, M. & Wahba, G. (1979). Generalized Cross-Validation as a Method for Choosing a Good Ridge Parameter. *Technometrics*, 21(2), 215-223.
