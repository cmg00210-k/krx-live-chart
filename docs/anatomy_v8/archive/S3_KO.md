# 제3장: 기술적 분석 --- 이론의 실제 적용

> CheeseStock KRX 실시간 차트 시스템의 기술적 분석 계보 문서.
> 본 시스템에 구현된 모든 지표, 패턴, 신호, 신뢰도 조정은 제2장의 학술적
> 기반으로부터 도출된다. 본 장은 각 구현체의 학술적 계보(lineage)를
> 추적하고, 이론에서 코드로의 변환 과정을 문서화한다.
> Stage 색상: Emerald Teal #1A3D35 | 판본: V8 (2026-04-08)

---

## 3.1 지표 계보 카드

`js/indicators.js`에 구현된 각 지표는 학술적 출처, 수학적 정식화, 구현 세부,
그리고 하류 소비자(downstream consumer)와 함께 문서화된다.

---

### I-01: 단순이동평균 (SMA)

**학술적 계보:** 수학 -> 기술통계학 -> 산술평균
**핵심 논문:** 단일 창시자 없음. 기초적 통계 개념. Donchian (1960년대)과
Murphy (1999)에 의해 시장 분석에 대중화.
**수식:**

$$SMA(n) = \frac{1}{n} \sum_{i=0}^{n-1} P_{t-i}$$

**주식 차트에서의 의의:** SMA는 가격 잡음을 평활화하여 기저 추세 방향을
드러낸다. 저역 통과 필터(low-pass filter)로서 고주파 변동을 제거하는 동시에
지배적 추세를 보존한다. 기간 $n$의 선택이 차단 주파수(cutoff frequency)를
결정한다. 단기(5, 10)는 최근 모멘텀을, 장기(50, 200)는 장기 추세를 추적한다.

**구현:** `js/indicators.js` `calcMA(data, n)`, line 15.
상수: n = 5 [A], 20 [A], 60 [A] (표준 기간).

**소비자:** 신호 S-1 (이동평균 교차), S-2 (이동평균 정렬), 스토캐스틱 %D 평활,
CCI 평균편차, 복합 신호.

**참조:** 제2장 2.3절 (통계학적 기초).

---

### I-02: 지수이동평균 (EMA)

**학술적 계보:** 통계학 -> 시계열 평활 -> 지수 평활
**핵심 논문:** Brown (1956) "Exponential Smoothing for Predicting Demand";
Holt (1957) 일반화; Hunter (1986) EWMA 해석.
**수식:**

$$EMA_t = \alpha \cdot P_t + (1 - \alpha) \cdot EMA_{t-1}, \quad \alpha = \frac{2}{n + 1}$$

초기화: $EMA_0 = SMA(\text{최초 } n \text{개 관측치})$.

**주식 차트에서의 의의:** EMA는 과거 관측치에 기하급수적으로 감소하는 가중치를
부여하여, SMA 대비 최근 가격 변화에 더 민감하게 반응한다. 이 민감성은
MACD (I-19)에서 핵심적인데, MACD는 빠른 EMA와 느린 EMA의 차이를 통해 모멘텀
이동을 감지하기 때문이다.

**구현:** `js/indicators.js` `calcEMA(data, n)`, line 26.
상수: n = 12 [A], 26 [A] (MACD 기본값), 9 [A] (시그널 선).
P0-3 수정: null/NaN 방어를 포함한 SMA 초기화.

**소비자:** MACD (I-19), EWMA 변동성 (I-26), 변동성 국면 장기 EMA.

**참조:** 제2장 2.2절 (수학적 기초, Doc 01).

---

### I-03: 볼린저 밴드 (BB)

**학술적 계보:** 통계학 -> 기술통계 -> 표준편차 밴드
**핵심 논문:** Bollinger (2001) *Bollinger on Bollinger Bands*. 모집단 시그마
($\div n$)를 사용하며, 베셀 보정 표본 시그마($\div(n-1)$)가 아니다. 이는
원저의 의도적 선택이다.
**수식:**

$$\text{Middle} = SMA(n)$$
$$\text{Upper} = SMA(n) + k \cdot \sigma_{\text{pop}}(n)$$
$$\text{Lower} = SMA(n) - k \cdot \sigma_{\text{pop}}(n)$$
$$\sigma_{\text{pop}} = \sqrt{\frac{1}{n} \sum_{i} (P_i - SMA)^2}$$

**주식 차트에서의 의의:** 볼린저 밴드는 2시그마 가격 외피(envelope)를 포착하여
과매수(상단 밴드)와 과매도(하단 밴드) 조건을 식별한다. 밴드 수축(squeeze)은
변동성 확장에 선행하며, 이는 핵심적 국면 전환 신호이다.

**구현:** `js/indicators.js` `calcBB(closes, n, mult)`, line 50.
상수: n = 20 [A], mult = 2.0 [A]. Bollinger (2001)에 따른 모집단 시그마.

**소비자:** 신호 S-7 (BB 반등/돌파/스퀴즈), 복합 신호
(buy_hammerBBVol, sell_shootingStarBBVol), EVT 보정 확장 (I-3E).

**참조:** 제2장 2.3절 (통계학, Doc 02).

---

### I-03E: EVT 보정 볼린저 밴드

**학술적 계보:** 통계학 -> 극단값 이론 -> 꼬리 보정 밴드
**핵심 논문:** Gopikrishnan et al. (1999); Hill (1975) 꼬리지수.
**수식:**

$$\text{EVT\_mult} = \begin{cases} k \cdot (1 + 0.45 \cdot (4 - \hat{\alpha})) & \hat{\alpha} < 4 \text{ (두꺼운 꼬리)} \\ k & \text{그 외 (표준 볼린저)} \end{cases}$$

**주식 차트에서의 의의:** 금융 수익률은 두꺼운 꼬리($\alpha$가 KRX 종목에서
통상 3~5)를 보인다. 표준 2시그마 밴드는 정규성을 가정하므로, EVT 보정 밴드는
실제 꼬리 확률을 반영하도록 확장되어 허위 돌파 신호를 줄인다.

**구현:** `js/indicators.js` `IndicatorCache.bbEVT()`, 지연 평가(lazy evaluation).
상수: 0.45 계수 [D] 경험적 (정확한 분위수 매핑이 아님).

**참조:** 제2장 2.3.3절 (극단값 이론, Doc 12).

---

### I-04: RSI (상대강도지수)

**학술적 계보:** 기술적 분석 -> 모멘텀 오실레이터 -> Wilder
**핵심 논문:** Wilder (1978) *New Concepts in Technical Trading Systems*.
**수식:**

$$RS = \frac{AvgGain(n)}{AvgLoss(n)}, \quad RSI = 100 - \frac{100}{1 + RS}$$

와일더 평활: $AvgGain_t = (AvgGain_{t-1} \cdot (n-1) + Gain_t) / n$.
이는 $\alpha = 1/n$인 지수이동평균과 동치이다.

**주식 차트에서의 의의:** RSI는 방향성 가격 움직임의 속도와 크기를 측정하여
0~100으로 진동한다. 70 이상은 과매수(매도 압력 축적), 30 이하는 과매도(매수
기회)를 나타낸다. 심리학적으로 RSI는 공포-탐욕 스펙트럼에 대응한다
(제2장 2.6절).

**구현:** `js/indicators.js` `calcRSI(closes, period)`, line 63.
상수: period = 14 [A] (Wilder 원본).

**소비자:** 신호 S-5 (RSI 영역), S-6 (RSI 괴리), StochRSI (I-21),
복합 신호 (strongBuy_hammerRsiVolume, buy_bbBounceRsi 등).

**참조:** 제2장 2.6절 (심리학 -- 공포/탐욕 대리변수).

---

### I-05: ATR (평균진폭)

**학술적 계보:** 기술적 분석 -> 변동성 측정 -> Wilder
**핵심 논문:** Wilder (1978) *New Concepts in Technical Trading Systems*.
**수식:**

$$TR_t = \max(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|)$$
$$ATR_t = \frac{ATR_{t-1} \cdot (n-1) + TR_t}{n}$$

**주식 차트에서의 의의:** ATR은 CheeseStock의 보편적 정규화 단위이다. 모든
패턴 임계값, 손절매, 목표가를 ATR 배수로 표현함으로써 가격 수준 독립성을
달성한다. 삼성전자(60,000원)와 1,000원 소형주의 패턴이 변동성 상대적으로
동일하게 평가되는 것이다. 이것이 패턴 엔진의 가장 핵심적 설계 결정이다.

**구현:** `js/indicators.js` `calcATR(candles, period)`, line 87.
상수: period = 14 [A] (Wilder 원본).
폴백: ATR(14) 불가 시 `close * 0.02`; 시간대별 폴백
`PatternEngine.ATR_FALLBACK_BY_TF`.

**소비자:** 모든 패턴 감지, 모든 손절/목표 산출, 지지/저항 클러스터링 허용오차,
신뢰도 조정, OLS 추세 정규화.

**참조:** 제2장 2.3절 (Doc 06, 기술적 분석).

---

### I-06: OBV (누적거래량)

**학술적 계보:** 기술적 분석 -> 거래량 분석 -> Granville
**핵심 논문:** Granville (1963) *New Key to Stock Market Profits*;
Murphy (1999) Ch. 7.
**수식:**

$$OBV_t = \begin{cases} OBV_{t-1} + V_t & C_t > C_{t-1} \\ OBV_{t-1} - V_t & C_t < C_{t-1} \\ OBV_{t-1} & C_t = C_{t-1} \end{cases}$$

**주식 차트에서의 의의:** Granville의 핵심 가설은 "거래량이 가격에 선행한다"는
것이다. OBV는 가격 방향으로 거래량을 누적하여, 축적(스마트 머니 매수)이나
분배(스마트 머니 매도)가 가격 반응보다 먼저 나타나는 것을 드러낸다. OBV 추세와
가격 추세 간의 괴리(divergence)는 행동재무학 문헌에서 가장 신뢰도 높은 선행
지표 중 하나이다 (Barber-Odean 2008 관심 이론, 제2장 2.6절).

**구현:** `js/indicators.js` `calcOBV(candles)`, line 115.
조정 가능한 상수 없음 (순수 공식).

**소비자:** 신호 S-20 (OBV 괴리), 복합 신호 buy_volRegimeOBVAccumulation.

**참조:** 제2장 2.6절 (관심과 거래량 심리).

---

### I-07: 일목균형표 (Ichimoku Kinko Hyo)

**학술적 계보:** 기술적 분석 -> 일본식 기술적 분석 -> 호소다
**핵심 논문:** 호소다 고이치(Hosoda Goichi, 1969) *일목균형표*. 필명 일목산인
(Ichimoku Sanjin).
**수식:**

$$\text{전환선(Tenkan-sen)} = \frac{highest\_high(9) + lowest\_low(9)}{2}$$
$$\text{기준선(Kijun-sen)} = \frac{highest\_high(26) + lowest\_low(26)}{2}$$
$$\text{선행스팬 A} = \frac{\text{전환선} + \text{기준선}}{2}, \quad \text{+26 선행}$$
$$\text{선행스팬 B} = \frac{highest\_high(52) + lowest\_low(52)}{2}, \quad \text{+26 선행}$$
$$\text{후행스팬(Chikou)} = \text{종가}, \quad \text{-26 후행}$$

**주식 차트에서의 의의:** 일목균형표는 5개 데이터 포인트를 동시에 제공한다.
추세 방향(전환선/기준선 관계), 모멘텀(구름 위치), 지지/저항(구름 경계),
확인(후행스팬 대 가격). "삼역호전(saneki-hoten)" --- 가격이 구름 위에 있고,
전환선이 기준선을 상향 교차하며, 후행스팬이 26기간 전 가격 위에 있는 조건 ---
은 일본 기술적 분석 전통에서 강력한 매수 신호로 간주된다.

**구현:** `js/indicators.js` `calcIchimoku(candles, conv, base, spanBPeriod,
displacement)`, line 135.
상수: conv=9, base=26, spanB=52, displacement=26 [A] (호소다 원본).

**소비자:** 신호 S-8 (구름 돌파, TK 교차), 복합 신호
(buy_ichimokuTriple, sell_ichimokuTriple).

---

### I-08: 칼만 필터

**학술적 계보:** 수학/공학 -> 최적 제어 -> 상태 추정
**핵심 논문:** Kalman (1960); Mohamed and Schwarz (1999) 적응형 Q (INS/GPS).
**수식:**

$$\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1}), \quad K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

적응형 Q: $Q_t = Q_{\text{base}} \times (ewmaVar_t / meanVar)$

**주식 차트에서의 의의:** 칼만 필터는 가우시안 잡음 가정 하에서 최적 상태
추정을 제공한다. 가격 시계열에 적용하면, 잡음-신호 비율에 따라 반응성을 자동
조절하는 평활 추정치를 산출한다. 이동평균(고정 시차)과 달리 칼만 이득 $K$가
자동 조정된다. 높은 잡음 -> 낮은 이득(더 많은 평활), 낮은 잡음 -> 높은 이득
(더 민감한 반응). 적응형 Q 확장은 변동성 국면에 추가적 민감도를 부여한다.

**구현:** `js/indicators.js` `calcKalman(closes, Q, R)`, line 170.
상수: Q=0.01 [B], R=1.0 [B], ewmaAlpha=0.06 [B] (~30봉 EWMA).

**소비자:** 신호 S-12 (칼만 전환 -- 기울기 방향 전환).

**참조:** 제2장 2.2.6절 (최적 제어, Doc 10).

---

### I-09: 허스트 지수 (R/S 분석)

**학술적 계보:** 물리학/프랙탈 -> 장기 의존성 -> Mandelbrot
**핵심 논문:** Mandelbrot (1963); Peters (1994) *Fractal Market Analysis* Ch. 4;
Mandelbrot and Wallis (1969) R/S 관례.
**수식:**

1. 가격을 로그수익률로 변환: $r_t = \ln(P_{t+1}/P_t)$
2. 윈도우 크기 $w = [minWindow, 1.5w, 2.25w, \ldots]$에 대해:
   블록별 $R/S = (\max(\text{cumDev}) - \min(\text{cumDev})) / S$ 계산
3. 회귀: $\log(R/S) = H \cdot \log(w) + c$, $H$ = 회귀 기울기

**주식 차트에서의 의의:** $H > 0.5$는 추세 지속성(모멘텀 국면),
$H < 0.5$는 평균회귀, $H = 0.5$는 랜덤워크를 나타낸다. 이는 현재 국면에서
추세추종 전략과 평균회귀 전략 중 어느 것이 성공할 가능성이 높은지를 직접
알려준다. R/S는 수익률(정상 과정)로 계산해야 하며, 가격 수준(I(1))으로
계산하면 $H$가 ~0.4만큼 상향 편향된다.

**구현:** `js/indicators.js` `calcHurst(closes, minWindow)`, line 212.
상수: minWindow=10 [C]. Mandelbrot-Wallis (1969)에 따른 모집단 시그마.
$R^2$ 보고로 회귀 품질 표시. S=0 블록 제외 (M-9 수정).

**소비자:** 신호 S-11 (허스트 국면: H > 0.6 추세, H < 0.4 평균회귀).

**참조:** 제2장 2.2.4절 (프랙탈 수학), 2.1절 (경제물리학).

---

### I-10: 힐 꼬리 추정량

**학술적 계보:** 통계학 -> 극단값 이론 -> 꼬리지수
**핵심 논문:** Hill (1975); Drees and Kaufmann (1998) 자동 k-선택.
**수식:**

$$\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}, \quad SE = \frac{\hat{\alpha}}{\sqrt{k}}$$

여기서 $X_{(i)}$는 순서통계량(절대수익률, 내림차순),
$k = \lfloor\sqrt{n}\rfloor$ (Drees-Kaufmann 규칙).

**주식 차트에서의 의의:** $\hat{\alpha} < 4$이면 수익률 분포의 꼬리가 두꺼워
(멱법칙 감쇠) 정규분포의 제4적률(첨도)이 이론적으로 무한이다. 이 경우 표준
볼린저 밴드의 신뢰구간이 과소추정되므로 EVT 보정 밴드가 활성화된다.

**구현:** `js/indicators.js` `calcHillEstimator(returns, k)`, line 276.
상수: 최소 n = 10 [A], k = floor(sqrt(n)) [A].

**소비자:** I-3E (EVT 볼린저), 백테스터 꼬리위험 평가.

**참조:** 제2장 2.3.3절 (극단값 이론).

---

### I-11: GPD 꼬리 적합

**학술적 계보:** 통계학 -> EVT -> 임계값 초과 (POT)
**핵심 논문:** Pickands (1975); Balkema-de Haan (1974); Hosking and Wallis (1987)
확률가중적률(PWM) 추정.
**수식:**

임계값: $u$ = 절대수익률 상위 5%, 초과량: $y_i = |r_i| - u$
PWM: $b_0 = \bar{y}$, $b_1 = \bar{y \cdot rank/(N_u-1)}$
$\hat{\xi} = 2 - b_0/(b_0 - 2b_1)$, $\hat{\sigma} = 2b_0 b_1/(b_0 - 2b_1)$
$VaR_p = u + (\sigma/\xi)[((n/N_u)(1-p))^{-\xi} - 1]$

**주식 차트에서의 의의:** GPD는 이론적으로 정당화된 극단 위험 분위수를
제공한다. 표준 VaR은 정규성을 가정하지만, GPD 기반 VaR은 KRX 수익률의 실제
꼬리 행태($\alpha \sim 3$--$4$, 스튜던트-t 유사)를 포착한다.

**구현:** `js/indicators.js` `calcGPDFit(returns, quantile)`, line 323.
상수: quantile = 0.99 [A], 임계 = 상위 5% [B], 최소 n = 500 [B],
최소 초과 = 20 [B]. PWM 유효성: $\hat{\xi}$ < 0.499로 제한.

**소비자:** EVT 기반 손절매 최적화 (백테스터).

---

### I-12: CAPM 베타

**학술적 계보:** 금융학 -> 자산가격결정 -> 자본자산가격결정모형
**핵심 논문:** Sharpe (1964), Lintner (1965), Fama-MacBeth (1973);
Scholes-Williams (1977) 비유동성 보정.
**수식:**

$$\beta = \frac{Cov(R_i - R_f, R_m - R_f)}{Var(R_m - R_f)}$$
$$\alpha = \overline{(R_i - R_f)} - \beta \cdot \overline{(R_m - R_f)}$$

Scholes-Williams 보정: $\beta_{SW} = (\beta_{-1} + \beta_0 + \beta_{+1}) / (1 + 2\rho_m)$

**주식 차트에서의 의의:** 베타는 체계적 위험, 즉 시장 전체 움직임에 대한
민감도를 측정한다. $\beta = 1.5$이면 시장이 1% 움직일 때 해당 종목은 1.5%
움직인다. 젠센 알파(연율화 초과수익)는 베타를 감안한 후의 성과를 측정한다.
백테스터(B-6)에서 패턴 수익을 체계적(베타) 성분과 고유(알파) 성분으로
분해하는 데 사용된다.

**구현:** `js/indicators.js` `calcCAPMBeta(stockCloses, marketCloses, window,
rfAnnual)`, line 391.
상수: window = KRX_TRADING_DAYS=250 [A], 최소 관측 = 60 [B],
비유동성 임계 = 10% 무거래일 [C].

**소비자:** 백테스터 B-6 (젠센 알파), 재무 패널 표시, `_loadCAPMBeta()`.

**참조:** 제2장 2.5.1절 (CAPM).

---

### I-13: 역사적 변동성 (Parkinson)

**학술적 계보:** 통계학 -> 변동성 추정 -> 범위 기반
**핵심 논문:** Parkinson (1980). 종가-종가 대비 약 5배 효율적.
**수식:**

$$HV_{\text{daily}} = \sqrt{\frac{1}{4n\ln 2} \sum [\ln(H_i/L_i)]^2}$$
$$HV_{\text{annual}} = HV_{\text{daily}} \times \sqrt{\text{KRX\_TRADING\_DAYS}}$$

**주식 차트에서의 의의:** 고가-저가 범위는 종가-종가 변동성이 놓치는 장중
가격 변동을 포착한다. Parkinson 추정량은 통계적으로 더 효율적(동일 표본
크기에서 낮은 분산)이어서, VRP (I-14) 산출에 보다 정확한 실현 변동성
추정치를 제공한다.

**구현:** `js/indicators.js` `calcHV(candles, period)`, line 492.
상수: period = 20 [B], 연율화: sqrt(250) (KRX 관례).

**소비자:** VRP (I-14), 변동성 국면 분류.

---

### I-14: VRP (분산 위험 프리미엄)

**학술적 계보:** 금융학/파생상품 -> 변동성 -> 위험 프리미엄
**핵심 논문:** Bollerslev (2009) "Expected Stock Returns and Variance Risk Premia."
**수식:**

$$VRP = \sigma_{IV}^2 - \sigma_{RV}^2 = (VKOSPI/100)^2 - HV_{\text{Parkinson}}^2$$

**주식 차트에서의 의의:** 양(+)의 VRP는 옵션 시장이 실현보다 높은 변동성을
가격에 반영한다는 것을 의미하며, 불확실성 고조와 변동성 압축(평균회귀)이
임박했을 수 있다. 음(-)의 VRP는 옵션이 저평가되어 변동성 확장이 예상된다.

**구현:** `js/indicators.js` `calcVRP(vkospi, hvAnnualized)`, line 536.
조정 가능한 상수 없음 (단위 변환 포함 순수 공식).

**소비자:** 신뢰도 요인 F8, RORO 요인 R1 (VKOSPI 경유).

**참조:** 제2장 2.5.4절 (파생상품 이론).

---

### I-15: WLS 회귀 (릿지 포함)

**학술적 계보:** 통계학 -> 회귀분석 -> 일반화 최소제곱
**핵심 논문:** Aitken (1935) GLS; Hoerl and Kennard (1970) 릿지 회귀;
Reschenhofer et al. (2021) 시간의존 WLS.
**수식:**

$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

$W = \text{diag}(\text{weights})$, $\lambda$ = 릿지 벌점 (절편 면제).

**주식 차트에서의 의의:** 지수적 감쇠 가중치를 갖는 WLS는 최근 관측치에 더
큰 영향력을 부여하여 시변적(time-varying) 관계를 포착한다. 릿지 정규화는
예측변수(품질, 추세, 거래량, 변동성)가 상관될 때 다중공선성으로 인한
불안정성을 방지한다. Reschenhofer et al. (2021)은 WLS가 주식수익률 예측에서
OLS를 유의하게 능가한다는 것을 입증하였다.

**구현:** `js/indicators.js` `calcWLSRegression(X, y, weights, ridgeLambda)`,
line 558.
상수: ridgeLambda = GCV 선택 (I-16), 최소 n = p+2 [A].

**소비자:** 백테스터 WLS 회귀 예측, OLS 추세 (I-17).

---

### I-15a: HC3 강건 표준오차

**학술적 계보:** 통계학 -> 이분산-일치 추정
**핵심 논문:** White (1980); MacKinnon and White (1985) HC3 변형.

HC3은 HC0(White 원본) 대비 선호되며, $(1-h_{ii})^2$ 스케일링이 고지렛점
관측치에서의 오차분산 과소추정을 보정한다. 지렛점 상한: 0.99로 제한
(수치적 안정성).

**소비자:** 백테스터 WLS 계수의 t-통계량.

---

### I-16: GCV 람다 선택

**학술적 계보:** 통계학 -> 모형 선택 -> 일반화 교차검증
**핵심 논문:** Golub, Heath, and Wahba (1979).
**수식:**

$$GCV(\lambda) = \frac{RSS(\lambda)/n}{(1 - tr(H_\lambda)/n)^2}, \quad \lambda^* = \arg\min_{\lambda} GCV(\lambda)$$

그리드: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].
평탄성 검사: GCV 변동 < 1%이면 기본값 $\lambda = 1.0$.

야코비 고유분해(I-16a)를 사용하여 효율적 트레이스 계산.

**구현:** `js/indicators.js` `selectRidgeLambdaGCV(X, y, w, p)`, line 826.

---

### I-17: OLS 추세선

**학술적 계보:** 통계학 -> 회귀분석 -> 추세 감지
**핵심 논문:** Lo and MacKinlay (1999): $R^2 > 0.15$이면 추세 존재,
$> 0.50$이면 강한 추세.
**수식:**

$$P_t = a + bt + \varepsilon, \quad slopeNorm = b / ATR(14)$$

direction = 'up' if slopeNorm > 0.05, 'down' if < -0.05, 'flat' 그 외.

**구현:** `js/indicators.js` `calcOLSTrend(closes, window, atr14Last)`, line 912.
상수: window = 20 [B], slopeNorm 임계 = 0.05 [D].

---

### I-19: MACD (이동평균수렴확산)

**학술적 계보:** 기술적 분석 -> 모멘텀 -> Appel
**핵심 논문:** Appel (1979) *The Moving Average Convergence-Divergence Trading Method*.
**수식:**

$$\text{MACD Line} = EMA(12) - EMA(26)$$
$$\text{Signal Line} = EMA(9, \text{MACD Line})$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

**주식 차트에서의 의의:** MACD는 두 EMA의 수렴과 발산을 통해 모멘텀을 포착한다.
MACD 선이 시그널 선을 상향 교차(강세 교차)하면 모멘텀이 상승으로 전환되고,
하향 교차(약세 교차)하면 하락으로 전환된다. 히스토그램은 모멘텀 변화의 속도를
시각화한다.

**구현:** `js/indicators.js` `calcMACD(closes, fast, slow, sig)`, line 993.
상수: fast=12, slow=26, sig=9 [A] (Appel 원본).

**소비자:** 신호 S-3 (MACD 교차), S-4 (MACD 괴리), 복합 신호.

---

### I-20: 스토캐스틱 오실레이터

**학술적 계보:** 기술적 분석 -> 모멘텀 -> Lane
**핵심 논문:** Lane (1984) "Lane's Stochastics."
**수식:**

$$Raw \%K = \frac{Close - LL(k)}{HH(k) - LL(k)} \times 100$$
$$\%K = SMA(Raw \%K, smooth), \quad \%D = SMA(\%K, dPeriod)$$

**구현:** `js/indicators.js` `calcStochastic(candles, kPeriod, dPeriod, smooth)`,
line 1028. 상수: kPeriod=14, dPeriod=3, smooth=3 [A].

**소비자:** 신호 S-10, 복합 buy_wrStochOversold.

---

### I-21: 스토캐스틱 RSI

**학술적 계보:** 기술적 분석 -> 복합 오실레이터 -> Chande-Kroll
**핵심 논문:** Chande and Kroll (1994) *The New Technical Trader*.

RSI에 스토캐스틱 공식을 적용한 것으로, RSI의 과매수/과매도 영역 내에서도
더 세밀한 타이밍 신호를 제공한다.

**구현:** `js/indicators.js` `calcStochRSI(...)`, line 1085.
상수: rsiPeriod=14, kPeriod=3, dPeriod=3, stochPeriod=14 [A].

---

### I-22: CCI (상품채널지수)

**학술적 계보:** 기술적 분석 -> 편차 기반 오실레이터 -> Lambert
**핵심 논문:** Lambert (1980) "Commodity Channel Index."
**수식:**

$$TP = \frac{High + Low + Close}{3}, \quad CCI = \frac{TP - SMA(TP, n)}{0.015 \times MeanDev}$$

상수 0.015는 CCI 값의 ~70~80%가 -100~+100 사이에 위치하도록 보장한다.

**구현:** `js/indicators.js` `calcCCI(candles, period)`, line 1158.
상수: period=20 [A], 0.015 [A] (Lambert 원본).

**소비자:** 신호 S-13, 복합 buy_cciRsiDoubleOversold.

---

### I-23: ADX / +DI / -DI

**학술적 계보:** 기술적 분석 -> 추세 강도 -> Wilder
**핵심 논문:** Wilder (1978) -- 방향성 움직임 시스템(Directional Movement System).
**수식:**

$$ADX = Wilder\_Smooth(DX, n), \quad DX = \frac{|+DI - (-DI)|}{+DI + (-DI)} \times 100$$

**주식 차트에서의 의의:** ADX는 추세의 강도(방향이 아님)를 측정한다.
ADX > 25는 강한 추세, ADX < 20은 횡보장을 나타낸다. 추세추종 패턴은
ADX > 20일 때 더 높은 신뢰도를 받는다.

**구현:** `js/indicators.js` `calcADX(candles, period)`, line 1187.
상수: period=14 [A] (Wilder 원본).

**소비자:** 신호 S-14, 복합 buy_adxGoldenTrend, sell_adxDeadTrend.

---

### I-24: Williams %R

**학술적 계보:** 기술적 분석 -> 모멘텀 오실레이터 -> Williams
**핵심 논문:** Williams (1979) *How I Made One Million Dollars*.

범위: -100(과매도)~0(과매수). 스토캐스틱과 구조적으로 동일하나 스케일이 반전.

**구현:** `js/indicators.js` `calcWilliamsR(candles, period)`, line 1262.
상수: period=14 [A].

---

### I-25: 틸-센 추정량

**학술적 계보:** 강건 통계학 -> 비모수 회귀 -> 중앙값 기울기
**핵심 논문:** Theil (1950), Sen (1968).

$$slope = \text{median}\left\{\frac{y_j - y_i}{x_j - x_i} : i < j\right\}$$

**주식 차트에서의 의의:** 29.3%의 붕괴점(breakdown point)으로, 데이터의 29.3%
까지 이상치가 존재해도 추정이 파괴되지 않는다. 삼각형, 쐐기형 등의 추세선
적합에서 스파이크 캔들에 의한 OLS 왜곡을 방지한다. 캔들 목표가 교정(ATR
배수)에도 사용된다.

**구현:** `js/indicators.js` `calcTheilSen(xValues, yValues)`, line 1287.
조정 가능한 상수 없음 (순수 중앙값 계산).

---

### I-26: EWMA 변동성

**학술적 계보:** 금융학/위험 -> 조건부 변동성 -> RiskMetrics
**핵심 논문:** J.P. Morgan RiskMetrics (1996); Bollerslev (1986) GARCH(1,1).

$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

IGARCH의 특수 경우($\omega=0$, $\alpha+\beta=1$). 통계역학의 "시장 온도" 개념의
직접적 조작화이다.

**구현:** `js/indicators.js` `calcEWMAVol(closes, lambda)`, line 1336.
상수: lambda=0.94 [B] (RiskMetrics 일별 기본값).

**소비자:** 변동성 국면 분류 (I-27), RORO 복합.

---

### I-27: 변동성 국면 분류

**학술적 계보:** 금융학/국면 -> 변동성 비율 분류
**수식:**

$$ratio = \sigma_t / longRunEMA, \quad \text{국면} = \begin{cases} \text{'low'} & ratio < 0.75 \\ \text{'high'} & ratio > 1.50 \\ \text{'mid'} & \text{그 외} \end{cases}$$

**구현:** `js/indicators.js` `classifyVolRegime(ewmaVol)`, line 1385.
상수: VOL_REGIME_LOW=0.75 [D], VOL_REGIME_HIGH=1.50 [D], alpha=0.01 [B].

---

### I-28: Amihud 비유동성

**학술적 계보:** 시장미시구조 -> 유동성 측정 -> Amihud
**핵심 논문:** Amihud (2002) "Illiquidity and Stock Returns."
**수식:**

$$ILLIQ = \frac{1}{D} \sum_{t=1}^{D} \frac{|r_t|}{DVOL_t}$$

높은 비유동성은 가격충격이 크다는 것을 의미하며, 패턴 신뢰도를 할인한다
(미시 요인 M1, 최대 -15%).

**구현:** `js/indicators.js` `calcAmihudILLIQ(candles, window)`, line 1430.
상수: window=20 [B], CONF_DISCOUNT=0.85 [C], LOG_HIGH=-1.0 [C], LOG_LOW=-3.0 [C].

---

### I-29: 온라인 CUSUM

**학술적 계보:** 통계학 -> 품질관리 -> 순차분석
**핵심 논문:** Page (1954); Roberts (1966).

변동성 적응형 임계값으로 확장: 고변동성 -> h=3.5, 저변동성 -> h=1.5.

**구현:** `js/indicators.js` `calcOnlineCUSUM(returns, threshold, volRegime)`,
line 1493. 상수: threshold=2.5 [B], slack=0.5 [B], warmup=30 [B].

**소비자:** 신호 S-17, 복합 buy_cusumKalmanTurn.

---

### I-30: 이진 세분화

**학술적 계보:** 통계학 -> 구조변화 감지 -> BIC 기반
**핵심 논문:** Bai and Perron (1998). 탐욕적 이진 세분화 근사.

**구현:** `js/indicators.js` `calcBinarySegmentation(returns, maxBreaks,
minSegment)`, line 1586. 상수: maxBreaks=3 [B], minSegment=30 [B].

---

### I-31: HAR-RV (이질적 자기회귀 실현 변동성)

**학술적 계보:** 금융학 -> 변동성 예측 -> 이질적 시장 가설
**핵심 논문:** Corsi (2009).

$$HAR\text{-}RV = \beta_0 + \beta_1 RV_d + \beta_2 RV_w + \beta_3 RV_m$$

시장참여자의 이질적 시간 지평(일/주/월)에서 발생하는 다중척도 변동성 동역학을
포착한다.

**구현:** `js/indicators.js` `calcHAR_RV(candles)` via `IndicatorCache.harRV(idx)`,
line 2213. KRX 월간 윈도우 $M = 21$.

---

## 3.2 패턴 학술적 도출

### 3.2.1 일본 캔들스틱 전통 (Nison 1991, Morris 2006)

`js/patterns.js`에 구현된 21개 이상의 캔들스틱 패턴은 일본 쌀 거래 전통에서
기원하며, 다음의 저서에 의해 체계화되었다.

- **Nison (1991)** *Japanese Candlestick Charting Techniques* --- 캔들스틱 분석을
  서양 시장에 도입한 기념비적 영문 저서
- **Morris (2006)** *Candlestick Charting Explained* --- 추가 패턴 상세
- **Bulkowski (2008)** *Encyclopedia of Candlestick Charts* --- 경험적 성과 통계

#### 단봉 패턴 (9종)

| 패턴 | 학술 근거 | 핵심 임계값 | ATR 역할 | KRX 5년 승률 |
|------|-----------|-------------|----------|-------------|
| 도지 (P-1) | Nison (1991) | DOJI_BODY_RATIO=0.05 [A] | 범위 유의성 | 42.0% |
| 해머 (P-2) | Morris (2006) | SHADOW_BODY_MIN=2.0 [A] | ATR 정규화 | 45.2% |
| 역해머 (P-3) | Morris (2006) | 동일 | 동일 | 48.9% |
| 교수형 (P-4) | Nison (1991) | 동일 + 추세 맥락 | 동일 | 59.4% |
| 유성 (P-5) | Morris (2006) | 동일 + 추세 | 동일 | 59.2% |
| 잠자리형 도지 (P-6) | Nison (1991) | SPECIAL_DOJI_SHADOW_MIN=0.70 [B] | 동일 | 45.0% |
| 비석형 도지 (P-7) | Nison (1991) | 동일 | 동일 | 62.0% |
| 강세 마루보즈 (P-8) | Nison (1991) | MARUBOZU_BODY_RATIO=0.85 [A] | 동일 | 41.8% |
| 약세 마루보즈 (P-9) | 동일 | 동일 | 동일 | 57.7% |

모든 임계값은 ATR 정규화된다 (Wilder 1978): `actual_threshold = constant * ATR(14)`.

**전망이론 통합**: 손절매는 `PROSPECT_STOP_WIDEN = 1.12` (K&T 1979 손실회피,
$\lambda=2.25$)로 확대, 목표가는 `PROSPECT_TARGET_COMPRESS = 0.89`
(민감도 체감)로 압축.

#### 쌍봉 패턴 (6종)

| 패턴 | 학술 근거 | 핵심 상수 | KRX 5년 승률 |
|------|-----------|-----------|-------------|
| 강세 장악형 (P-10) | Nison (1991) | ENGULF_BODY_MULT=1.5 [C] | 41.3% |
| 약세 장악형 (P-11) | 동일 | 동일 | 57.2% |
| 강세 잉태형 (P-12) | Nison (1991) | HARAMI_CURR_BODY_MAX=0.5 [B] | 44.1% |
| 약세 잉태형 (P-13) | 동일 | 동일 | 58.7% |
| 관통형 (P-14) | Nison (1991) | PIERCING_BODY_MIN=0.3 [B] | 50.2% |
| 먹구름형 (P-15) | Nison (1991) | 동일 | 58.5% |

#### 삼봉 패턴 (4종 이상)

| 패턴 | 학술 근거 | 핵심 상수 | KRX 5년 승률 |
|------|-----------|-----------|-------------|
| 적삼병 (P-16) | Nison (1991) | THREE_SOLDIER_BODY_MIN=0.5 [B] | 47.6% |
| 흑삼병 (P-17) | 동일 | 동일 | 57.5% |
| 샛별형 (P-18) | Nison (1991) | STAR_BODY_MAX=0.12 [A] | 40.5% |
| 저녁별형 (P-19) | 동일 | 동일 | 56.7% |

**KRX 경험적 발견**: 매도 패턴이 매수 패턴을 승률에서 10~15%p 지속적으로
상회한다. 이 매도 편향은 전망이론의 손실회피(제2장 2.6절) 및 KRX 구조적
특징(T+2 결제, 가격제한폭, 개인투자자 주도 거래)과 부합한다.

### 3.2.2 서양 차트 패턴 이론 (Edwards-Magee 1948, Bulkowski 2005)

9개 이상의 차트 패턴은 다음으로부터 도출된다.

- **Edwards and Magee (1948)** *Technical Analysis of Stock Trends* --- 원래의 차트
  패턴 분류
- **Bulkowski (2005)** *Encyclopedia of Chart Patterns* --- 20년 이상 데이터의
  경험적 성과 통계

| 패턴 | 학술 근거 | 감지 방법 | 핵심 상수 |
|------|-----------|-----------|-----------|
| 이중바닥 (P-20) | Edwards-Magee (1948) | 두 스윙 저점 + 넥라인 돌파 | NECKLINE_BREAK_ATR_MULT=0.5 [B] |
| 이중천장 (P-21) | 동일 | 두 스윙 고점 + 넥라인 돌파 | 동일 |
| 머리어깨 (P-22) | Bulkowski (2005) | 좌측 어깨 + 머리 + 우측 어깨 | HS_WINDOW=120 [C], HS_SHOULDER_TOLERANCE=0.15 [B] |
| 역머리어깨 (P-23) | 동일 (반전) | 동일 (반전) | 동일 |
| 상승삼각형 (P-24) | Edwards-Magee (1948) | 수평 저항 + 상승 지지 | TRIANGLE_BREAK_ATR_MULT=0.3 [B] |
| 하강삼각형 (P-25) | 동일 | 수평 지지 + 하락 저항 | 동일 |
| 대칭삼각형 (P-26) | 동일 | 수렴 추세선 | 동일 |
| 상승쐐기 (P-27) | Bulkowski (2005) | 수렴 상향 추세선 | 동일 |
| 하락쐐기 (P-28) | 동일 | 수렴 하향 추세선 | 동일 |

**돌파 확인**: Bulkowski (2005)는 확인된 머리어깨 패턴의 성공률이 83%인 반면,
미확인 패턴은 35%에 불과하다고 문서화하였다. CheeseStock는 미확인 패턴에
`NECKLINE_UNCONFIRMED_PENALTY = 15` [B]를 적용한다.

**목표가 산출**: 차트 패턴 목표가는 측정 이동(measured move) 방법을 사용한다:
`target = breakout_price +/- pattern_height`. 상한은 다음으로 제한된다.
- `CHART_TARGET_ATR_CAP = 6` [B] --- EVT 99.5% VaR 경계 (Doc 12)
- `CHART_TARGET_RAW_CAP = 2.0` [B] --- Bulkowski P80

### 3.2.3 다우 이론: 지지와 저항

**Dow (1900년대)**, Hamilton (1922)과 Rhea (1932)에 의해 체계화.

가격은 이전에 유의했던 가격 수준에서 지지(매수 관심)와 저항(매도 관심)을
형성하는 경향이 있다. CheeseStock는 지지/저항 감지를 다음과 같이 구현한다.

1. **가격 클러스터링**: ATR*0.5 허용오차, 최소 2회 접촉, 최대 10 수준
2. **접촉 강도**: 더 많은 접촉 -> 높은 강도 (0~1.0 척도)
3. **합류(confluence)**: 패턴 손절/목표가 지지/저항의 ATR 이내 ->
   신뢰도 +3*strength

**밸류에이션 지지/저항**: 기본적 분석 밸류에이션 임계(PER/PBR 기반 목표가)가
행동적 앵커로 작용. 강도 = 0.6, 범위 = +/-30% (KRX 일일 가격제한폭 일치).

**52주 신고/신저 지지/저항** (George-Hwang 2004): 강도 = 0.8, 가상 접촉 = 3.
George and Hwang은 52주 신고가 근접성이 모멘텀 수익률의 70%를 앵커링 편향을
통해 설명한다는 것을 보였다.

### 3.2.4 패턴 감지의 수학적 기법

**ATR 정규화** (Wilder 1978): 모든 임계값이 ATR(14) 배수로 표현된다.
폴백: `close * 0.02` (KRX 대형주 중앙값 일별 ATR/종가 비율).

**틸-센 추세선 적합** (Theil 1950, Sen 1968): 이상치 캔들에 대한 붕괴점
저항으로, 차트 패턴 추세선 적합(삼각형, 쐐기, 채널)에 사용.

**품질 점수** (PCA 가중, V6-FIX 교정):
$$Q = 0.30 \times body + 0.22 \times volume + 0.21 \times trend + 0.15 \times shadow + 0.12 \times extra$$
가중치는 PCA 분산설명 + KRX 데이터에 대한 로지스틱 회귀에서 도출.
Nison (1991): "실체(real body)가 가장 중요한 요소" (body = PC1 최대 적재).

**베타-이항 사후 승률** (Efron-Morris 1975):
$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$
$N_0 = 35$ (5년 545K 관측의 경험적 베이즈 최적값). 캔들(~43%)과 차트(~45%)
범주별 별도 총평균.

**AMH 시간 감쇠** (Lo 2004, McLean-Pontiff 2016):
$$decay = \exp(-\lambda \cdot daysSince)$$
KOSDAQ: $\lambda=0.00367$ (반감기 189일). KOSPI: $\lambda=0.00183$ (반감기 378일).
소형주 시장에서 알파 감쇠가 더 빠르다.

---

## 3.3 신호 및 복합 신호 계보

### 3.3.1 개별 지표 신호 (31개)

각 신호는 특정 지표에서 도출되며 명확한 학술적 근거를 갖는다.

#### 추세 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-1 | 이동평균 교차 | MA(5), MA(20) | MA(5)가 MA(20)을 교차 | Murphy (1999) Ch.9 |
| S-2 | 이동평균 정렬 | MA(5/20/60) | MA(5)>MA(20)>MA(60) 또는 역순 | 다중 이동평균 확인 |
| S-3 | MACD 교차 | MACD, 시그널 | MACD가 시그널을 교차 | Appel (1979) |
| S-4 | MACD 괴리 | MACD, 가격 | 가격 신고가 + MACD 낮은 고점 | Murphy (1999) Ch.10 |
| S-8 | 일목 신호 | 구름, TK | 가격 구름 돌파; TK 교차 | Hosoda (1969) 삼역호전/역전 |
| S-14 | ADX 교차 | +DI, -DI, ADX | ADX>20일 때 +DI가 -DI 교차 | Wilder (1978) |
| S-17 | CUSUM 이탈 | 수익률 | CUSUM이 적응형 임계 초과 | Page (1954), Roberts (1966) |
| S-18 | 변동성 국면 전환 | EWMA 변동성 | 국면 전이 감지 | RiskMetrics (1996) |

#### 오실레이터 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-5 | RSI 영역 | RSI(14) | RSI <30 이탈(매수) 또는 >70(매도) | Wilder (1978) |
| S-6 | RSI 괴리 | RSI, 가격 | 가격-RSI 괴리 | Murphy (1999) |
| S-9 | StochRSI | StochRSI(14) | K가 과매도/과매수 이탈 | Chande-Kroll (1994) |
| S-10 | 스토캐스틱 | %K, %D | 극단에서 %K가 %D 교차 | Lane (1984) |
| S-13 | CCI 이탈 | CCI(20) | CCI <-100 이탈(매수) 또는 >100 | Lambert (1980) |
| S-15 | Williams %R | %R(14) | %R < -80 (과매도) | Williams (1979) |

#### 변동성 및 거래량 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-7 | BB 신호 | BB(20,2) | 하단 반등 / 상단 돌파 / 스퀴즈 | Bollinger (2001) |
| S-11 | 허스트 국면 | Hurst(R/S) | H>0.6 추세, H<0.4 평균회귀 | Mandelbrot (1963), Peters (1994) |
| S-12 | 칼만 전환 | 칼만 필터 | 기울기 방향 전환 | Kalman (1960) |
| S-16 | ATR 확장 | ATR(14) | ATR 비율 > 1.5 vs 20봉 EMA | Wilder (1978) |
| S-19 | 거래량 돌파 | 거래량, MA(20) | Volume/MA > 임계 | Granville (1963) |
| S-20 | OBV 괴리 | OBV, 가격 | 가격-OBV 괴리 | Granville (1963), Murphy (1999) |

#### 파생상품 및 교차자산 신호

| 신호 ID | 명칭 | 데이터 출처 | 규칙 | 학술 근거 |
|---------|------|------------|------|-----------|
| S-21 | 베이시스 신호 | 선물 베이시스 | 초과 콘탱고/백워데이션 | Bessembinder-Seguin (1993) |
| S-22 | PCR 신호 | 풋/콜 비율 | PCR 극단 역발상 | Pan-Poteshman (2006) |
| S-23 | 수급 신호 | 투자자 데이터 | 외국인+기관 정렬 | Choe-Kho-Stulz (2005) |
| S-24 | ERP 신호 | 채권+주식 | ERP z-점수 극단 | Fed 모형, Asness (2003) |
| S-25 | ETF 심리 | ETF 데이터 | 레버리지 비율 역발상 | Cheng-Madhavan (2009) |
| S-26 | 공매도 비율 | 공매도 | 시장 공매도 비율 국면 | Desai et al. (2002) |
| S-27 | IV/HV 할인 | VKOSPI, HV | IV/HV > 1.5 신뢰도 감쇠 | Simon-Wiggins (2001) |
| S-28 | VKOSPI 국면 | VKOSPI | 위기/고위/정상/저위 | Whaley (2009) |
| S-29 | 만기 할인 | 달력 | 만기일 D-2~D+1 | Stoll-Whaley (1987) |
| S-30 | 위기 강도 | 복합 | 다요인 위기 복합 | DCC-GARCH, Engle (2002) |
| S-31 | 엔트로피 감쇠 | 신호들 | 섀넌 엔트로피 정규화 | Shannon (1948) |

### 3.3.2 복합 신호 (30개 정의)

복합 신호는 윈도우 내 동시 발생(coincidence) 방식으로 다수의 개별 신호를
결합한다. 각 복합의 학술적 정당화는 다중 출처 확인(multi-source confirmation)
이다. 두 개의 독립적 지표가 동일한 방향성 편향을 확인하면, 정확한 예측의
확률이 유의하게 증가한다.

#### Tier 1 복합 (10개 정의 --- 가장 강한 확인)

| ID | 구성 요소 | 학술적 연결 고리 | 기본 신뢰도 |
|----|-----------|------------------|-------------|
| strongBuy_hammerRsiVolume | 해머 + RSI 과매도 이탈 | Nison (1991) + Wilder (1978) | 61 |
| strongSell_shootingMacdVol | 유성 + MACD 약세 | Nison (1991) + Appel (1979) | 69 |
| buy_doubleBottomNeckVol | 이중바닥 + 거래량 돌파 | Edwards-Magee (1948) + Granville (1963) | 68 |
| sell_doubleTopNeckVol | 이중천장 + 거래량 매도 | Edwards-Magee (1948) | 75 |
| buy_ichimokuTriple | 구름 돌파 + TK 교차 | Hosoda (1969) 삼역호전 | 60 |
| sell_ichimokuTriple | 구름 하향 + TK 교차 | Hosoda (1969) 삼역역전 | 65 |
| buy_goldenMarubozuVol | 골든크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 60 |
| sell_deadMarubozuVol | 데드크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 68 |
| buy_adxGoldenTrend | 골든크로스 + ADX 강세 | Murphy (1999) + Wilder (1978) | 58 |
| sell_adxDeadTrend | 데드크로스 + ADX 약세 | Murphy (1999) + Wilder (1978) | 65 |

#### Tier 2 복합 (12개 이상 --- 보통 수준 확인)

| ID | 구성 요소 | 학술적 연결 고리 |
|----|-----------|------------------|
| buy_hammerBBVol | 해머 + BB 하단 반등 | Nison + Bollinger |
| sell_shootingStarBBVol | 유성 + BB 상단 돌파 | Nison + Bollinger |
| buy_morningStarRsiVol | 샛별 + RSI 과매도 | Nison + Wilder |
| buy_engulfingMacdAlign | 장악형 + MACD 교차 | Nison + Appel |
| buy_cciRsiDoubleOversold | CCI 이탈 + RSI 이탈 | Lambert + Wilder |
| neutral_squeezeExpansion | BB 스퀴즈 + ATR 확장 | Bollinger (2001) |
| buy_cusumKalmanTurn | CUSUM 이탈 + 칼만 상승 | Page (1954) + Kalman (1960) |
| buy_volRegimeOBVAccumulation | 변동성 고국면 + OBV 괴리 | RiskMetrics + Granville |
| buy_flowPcrConvergence | 수급 정렬 매수 + PCR/베이시스 | Choe-Kho-Stulz + Pan-Poteshman |
| buy_shortSqueezeFlow | 공매도 스퀴즈 + 외국인 수급 | Lamont-Thaler + Kang-Stulz |

**윈도우 매개변수**: 모든 복합은 window=5봉 [D 경험적]을 사용한다.
Nison (1991)의 "수 봉 내 확인" 원칙에 따른 것으로, 5봉(KRX 1거래주)은
신호 수렴에 충분하되 과도하지 않은 시간을 제공한다.

---

## 3.4 신뢰도 체인 (7개 계층)

각 신뢰도 조정 계층은 특정한 학술적 근거와 제한된 크기를 갖는다. 계층은
순차적, 승법적으로 적용된다.

### CONF-계층1: 거시 신뢰도 (11개 요인)

**학술적 기반:** IS-LM (Hicks 1937), 테일러 준칙 (Taylor 1993), 먼델-플레밍
(Mundell 1963), Stovall (1996), NSS 수익률 곡선 (Nelson-Siegel 1987),
Gilchrist-Zakrajsek (2012) 신용 스프레드.

| 요인 | 이론 | 논문 | 크기 | 등급 |
|------|------|------|------|------|
| F1 경기순환 | IS-LM 총수요 | Hicks (1937) | +/-6~10% | [B] |
| F1a Stovall 섹터 | 섹터-순환 민감도 | Stovall (1996) | 섹터별 * 0.5x | [C] |
| F2 수익률 곡선 | 기간구조 신호 | Harvey (1986) | +/-3~12% | [B] |
| F3 신용 국면 | 신용 스프레드 긴장 | Gilchrist-Zakrajsek (2012) | -7~-18% 매수 | [B] |
| F7 테일러 갭 | 통화정책 기조 | Taylor (1993) | +/-5% | [B] |
| F8 VRP/VIX | 변동성 위험 프리미엄 | Carr-Wu (2009) | -3~-7% | [B] |
| F9 금리차 | 먼델-플레밍 | Mundell (1963) | +/-5% | [B] |

**클램프:** [0.70, 1.25]. 구현: `_applyMacroConfidenceToPatterns()`.

### CONF-계층2: 미시 신뢰도 (3개 요인)

| 요인 | 이론 | 논문 | 크기 | 등급 |
|------|------|------|------|------|
| M1 Amihud ILLIQ | 유동성 할인 | Amihud (2002) | -15% 최대 | [A] |
| M2 HHI 보강 | 집중도 평균회귀 | Jensen-Meckling (1976) | +10% * HHI | [C] |
| M3 공매도 금지 | 가격발견 저해 | Miller (1977), D-V (1987) | -10~-30% | [B] |

**클램프:** [0.55, 1.15]. 구현: `_applyMicroConfidenceToPatterns()`.

### CONF-계층3: 파생상품 신뢰도 (7개 요인)

| 요인 | 이론 | 크기 |
|------|------|------|
| D1 선물 베이시스 | 보유비용 심리 | +/-4~7% |
| D2 PCR 역발상 | 풋/콜 극단 | +/-6% |
| D3 투자자 정렬 | 외국인+기관 | +/-8% |
| D4 ETF 심리 | 레버리지 비율 | +/-4% |
| D5 공매도 비율 | 시장 공매도 국면 | +6% 고비율 |
| D7 USD/KRW | 환율-수출 민감도 | +/-5% |

**클램프:** [0.70, 1.30]. 구현: `_applyDerivativesConfidenceToPatterns()`.

### CONF-계층4: 머튼 부도거리 (1개 요인)

Merton (1974) 구조 모형, Bharath-Shumway (2008) 단순화 DD.

| DD 범위 | 매수 조정 | 매도 조정 |
|---------|-----------|-----------|
| DD < 1.0 | x0.75 | 변동 없음 |
| DD 1.0~1.5 | x0.82 | 변동 없음 |
| DD 1.5~2.0 | x0.90 | 변동 없음 |
| DD 2.0~3.0 | x0.95 | 변동 없음 |
| DD > 3.0 | 변동 없음 | 변동 없음 |

금융업종 제외 (부채 = 운전자산). **클램프:** [0.75, 1.15].

### CONF-계층5: Phase 8 결합 (4개 요인)

Hamilton (1989) HMM, Kang-Stulz (1997), Simon-Wiggins (2001).
**클램프:** [10, 100].

### CONF-계층6: RORO 국면 (5요인 복합)

Baele, Bekaert, and Inghelbrecht (2010). 히스테리시스: 진입 +/-0.25, 이탈
+/-0.10. **클램프:** [0.92, 1.08].

---

## 3.5 백테스팅 방법론

### 3.5.1 WLS 회귀 예측

Reschenhofer et al. (2021)에 기반한 시간감쇠 가중 WLS.
피처: [절편, 품질, 추세, 거래량비, 변동성비]. 릿지 $\lambda$ = GCV 선택.
HC3 강건 표준오차로 유효한 추론.

### 3.5.2 IC 측정 (스피어만 순위 상관)

Grinold and Kahn (2000) *Active Portfolio Management*.

$$IC = corr(rank(\hat{y}), rank(y))$$

최소 5쌍 필요. IC > 0.02: 최소 비자명적 예측력 (Qian et al. 2007).
IC > 0.05: 운용적으로 유의. IC > 0.10: 강함.

### 3.5.3 Walk-Forward 검증 (WFE)

Pardo (2008); Bailey and Lopez de Prado (2014) 제거-갭(purge-gap) 방법론.

$$WFE = \frac{\overline{R}_{\text{OOS}}}{\overline{R}_{\text{IS}}} \times 100$$

확장 윈도우, 4~6 폴드. 제거 갭 = 2x 수평(AR(1) 반감기 방어).
WFE >= 50: 강건, 30~50: 한계, < 30: 과적합 의심.

### 3.5.4 BH-FDR 다중검정 보정

Benjamini and Hochberg (1995). 33개 이상의 패턴을 동시에 검정할 때
데이터 스누핑(data snooping)을 방지한다.

### 3.5.5 생존편향 보정

Elton, Gruber, and Blake (1996). `survivorship_correction.json`에서 로드.

### 3.5.6 거래비용 모형

Kyle (1985) $\sqrt{h}$ 미끄러짐 스케일링.
고정: (수수료 0.03% + 세금 0.18%) / h.
변동: 미끄러짐 0.10% / $\sqrt{h}$. Amihud ILLIQ 적응형 미끄러짐.

### 3.5.7 신뢰도 등급 시스템 (A/B/C/D)

IC, WFE, BH-FDR, 표본 크기를 종합하는 복합 게이팅.

| 등급 | 요건 | 해석 |
|------|------|------|
| A | IC > 0.02, alpha >= 5pp, n >= 100, PF >= 1.3, WFE >= 50, BH-FDR 통과 | 강건, 실행 가능 |
| B | IC > 0.01, alpha >= 3pp, n >= 50, WFE >= 30, BH-FDR 통과 | 보통 수준 증거 |
| C | alpha > 0, n >= 30 | 약한 증거, 탐색적 |
| D | C 미만 | 통계적 증거 불충분 |

WFE < 30이면 다른 지표와 무관하게 등급 C 상한 (과적합 의심).

---

## 3.6 학문간 계보 요약

### 제2장에서 제3장으로의 완전한 연결 고리

```
[제2장 2.4: 경제학]
  IS-LM -----------> 테일러 갭 ---------> CONF-F7
  먼델-플레밍 -----> 금리차 -----------> CONF-F9
  Stovall ---------> 섹터 회전 ---------> CONF-F1a
  HHI -------------> 평균회귀 보강 -----> CONF-M2

[제2장 2.5: 금융학]
  CAPM ------------> calcCAPMBeta() ----> 베타, 알파 (I-12)
  머튼 DD ---------> _calcNaiveDD() ---> CONF-계층4
  VRP -------------> calcVRP() --------> I-14
  BSM IV ----------> VKOSPI 국면 ------> S-28
  보유비용 --------> 베이시스 신호 -----> S-21
  카일 람다 -------> 수평 비용 --------> B-10
  아미후드 ILLIQ ---> calcAmihudILLIQ() -> I-28, CONF-M1
  RORO ------------> 5요인 복합 -------> CONF-계층6

[제2장 2.6: 행동재무학]
  전망이론 --------> 손절/목표 --------> PROSPECT_STOP_WIDEN
  처분효과 --------> 52주 지지/저항 ----> SR_52W_STRENGTH
  반예측기 --------> 승률 게이트 ------> PATTERN_WR_KRX
  군집행동 --------> CSAD 데이터 ------> (향후 능동 사용)
  손실회피 --------> KRX 매도 편향 ----> 경험적 WR 비대칭

[제3장: 내부]
  Wilder (1978) ----> ATR 정규화 ------> 모든 패턴
  Nison (1991) -----> 21+ 캔들 패턴 ----> P-1~P-19
  Edwards-Magee ----> 9 차트 패턴 -----> P-20~P-28
  Hosoda (1969) ----> 일목 신호 -------> S-8
  Appel (1979) -----> MACD 신호 -------> S-3, S-4
  Bollinger (2001) -> BB 신호 ---------> S-7
  Mandelbrot (1963) -> 허스트 국면 ----> S-11
  Page (1954) ------> CUSUM 이탈 -----> S-17
  Grinold-Kahn ----> 스피어만 IC -----> B-1
  Pardo (2008) -----> Walk-Forward ----> B-3
  BH (1995) --------> FDR 보정 -------> B-4
```

---

## 부록 3.I: 상수 분류 요약

| 등급 | 제3장 개수 | 예시 |
|------|-----------|------|
| [A] 학술적 고정 | ~40 | DOJI_BODY_RATIO=0.05, RSI period=14, MACD 12/26/9 |
| [B] 학술적 조정 가능 | ~35 | SHADOW_BODY_MIN=2.0, ATR period=14, Kalman Q=0.01 |
| [C] 교정 가능 | ~30 | ENGULF_BODY_MULT=1.5, ILLIQ 임계, CUSUM threshold=2.5 |
| [D] 경험적 | ~20 | 변동성 국면 기준, 복합 window=5, slopeNorm 임계 |
| [E] 폐기 | 0 | 현재 없음 |

## 부록 3.II: KRX 특수 적응

| 적응 사항 | 표준 | KRX 수정 | 근거 |
|-----------|------|----------|------|
| KRX_TRADING_DAYS | 252 (NYSE) | 250 | KRX 공휴일 차이 |
| VIX_VKOSPI_PROXY | --- | 1.12 | VKOSPI ~= VIX * 1.12 (Whaley 2009) |
| Stovall 감쇠 | 1.0x | 0.5x | US S&P 경험적, KRX 미검증 |
| KRX_COST | ~0.10% (US) | 0.31% | 높은 세금 0.18% + 넓은 스프레드 |
| 공매도 금지 기간 | N/A | 2020-03, 2023-11 | Miller (1977) 금지 시 과대평가 |
| ATR 일봉 폴백 | close * 0.015 | close * 0.020 | KRX 중앙값 ATR/종가 ~2.1% |
| $N_0$ (EB 축소) | --- | 35 | 545K KRX 패턴의 경험적 베이즈 |
| AMH $\lambda$ KOSDAQ | --- | 0.00367 | 소형주 시장 빠른 알파 감쇠 |
| AMH $\lambda$ KOSPI | --- | 0.00183 | 대형주 시장 느린 알파 감쇠 |

---

*본 문서는 CheeseStock 기술적 분석 계층에 구현된 모든 지표, 패턴, 신호,
신뢰도 조정, 백테스팅 기법의 완전한 학술적 계보를 제공한다. 각 수식은
제2장의 학술적 기반으로부터 역추적되며, JavaScript 구현으로 전방 연결된다.*

*판본: V8 (2026-04-08) | 제3장 | Stage 색상: Emerald Teal #1A3D35*
