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

$$E[R_{N}] = \alpha_p + \beta_1 \cdot \text{conf} + \beta_2 \cdot \text{trend} + \beta_3 \cdot \ln(\text{volRatio}) + \beta_4 \cdot \text{atrNorm}$$

여기서:
- $R_N$ = 패턴 완성 후 N일 수익률 (%)
- $\alpha_p$ = 패턴 유형별 절편 (기본 수익률)
- $\text{conf}$ = 패턴 신뢰도 / 100 (0-1)
- $\text{trend}$ = 직전 추세 강도 (0-1, ATR 정규화)
- $\ln(\text{volRatio})$ = 거래량비 자연로그 (우편향 안정화)
- $\text{atrNorm}$ = ATR / 종가 (변동성 체제 보정)

### 가중치 체계

$$w_i = \lambda^{T - t_i}, \quad \lambda = 0.995$$

- 반감기 ≈ 139 거래일 (~7개월)
- 최신 패턴에 더 높은 가중치 → 시장 체제 변화 반영
- Lo(2004) AMH: 시장 효율성은 시간에 따라 변동

### 정규방정식 (Normal Equation)

$$\hat{\beta} = (X^T W X)^{-1} X^T W y$$

여기서:
- $X$ = 설계 행렬 [1, conf, trend, lnVol, atrNorm] (n × 5)
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

### Ridge 회귀 (다변수 확장용)

$$\hat{\beta} = (X^T X + \lambda I)^{-1} X^T y$$

8개 예측 변수: conf, trend, lnVol, atrNorm + rsi_z, macdNorm, bbPosition, patternDuration
장점: 다중공선성 처리, λ는 LOOCV로 선택

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
