# 제3장: 기술적 분석 --- 이론의 실제 적용 (시트 형식)

> CheeseStock KRX 실시간 차트 시스템의 기술적 분석 계보 문서.
> 본 시스템에 구현된 모든 지표, 패턴, 신호, 신뢰도 조정은 제2장의 학술적
> 기반으로부터 도출된다. 본 장은 각 구현체의 학술적 계보(lineage)를
> 추적하고, 이론에서 코드로의 변환 과정을 문서화한다.
> Stage 색상: Emerald Teal #1A3D35 | 판본: V8 (2026-04-10) | 시트 형식 변환

---

## Sheet 1: 3.1 지표 계보 종합

`js/indicators.js`에 구현된 31개 지표는 학술적 출처, 수학적 정식화, 구현 세부,
그리고 하류 소비자(downstream consumer)와 함께 문서화된다. 각 지표 카드는
학문적 계보, 핵심 공식, 기호 주석, CheeseStock 적용을 체계적으로 기술한다.

**학문적 토대 분류**

| 학문 분야 | 지표 ID | 해당 지표 |
|-----------|---------|-----------|
| 통계학 (기술통계) | I-01, I-03 | SMA, 볼린저 밴드 |
| 통계학 (시계열 평활) | I-02 | EMA |
| 통계학 (극단값 이론) | I-03E, I-10, I-11 | EVT BB, 힐 추정량, GPD |
| 통계학 (회귀분석) | I-15, I-15a, I-16, I-17 | WLS, HC3, GCV, OLS 추세 |
| 통계학 (강건 추정) | I-25 | 틸-센 추정량 |
| 통계학 (품질관리) | I-29 | 온라인 CUSUM |
| 통계학 (구조변화) | I-30 | 이진 세분화 |
| 기술적 분석 (Wilder) | I-04, I-05, I-23 | RSI, ATR, ADX |
| 기술적 분석 (모멘텀) | I-19, I-20, I-21, I-22, I-24 | MACD, 스토캐스틱, StochRSI, CCI, Williams %R |
| 기술적 분석 (거래량) | I-06 | OBV |
| 기술적 분석 (일본) | I-07 | 일목균형표 |
| 수학/공학 (최적 제어) | I-08 | 칼만 필터 |
| 물리학/프랙탈 | I-09 | 허스트 지수 |
| 금융학 (자산가격결정) | I-12 | CAPM 베타 |
| 금융학 (변동성) | I-13, I-14, I-26, I-27 | HV Parkinson, VRP, EWMA Vol, Vol Regime |
| 금융학 (변동성 예측) | I-31 | HAR-RV |
| 시장미시구조 | I-28 | Amihud 비유동성 |

\newpage

### I-01: 단순이동평균 (Simple Moving Average, SMA)

**개요**

단순이동평균(SMA)은 수학적 기초통계학의 산술평균 개념에서 출발하여, Donchian
(1960년대)과 Murphy (1999)에 의해 시장 분석에 대중화된 가장 기본적인 기술적
지표이다. 단일 창시자가 없는 기초적 통계 개념으로, 모든 이동평균 파생 지표의
근간이 된다.

SMA는 가격 잡음을 평활화하여 기저 추세 방향을 드러낸다. 저역 통과
필터(low-pass filter)로서 고주파 변동을 제거하는 동시에 지배적 추세를
보존한다. 기간 $n$의 선택이 차단 주파수(cutoff frequency)를 결정한다.
단기(5, 10)는 최근 모멘텀을, 장기(50, 200)는 장기 추세를 추적한다.

**핵심 공식**

$$SMA(n) = \frac{1}{n} \sum_{i=0}^{n-1} P_{t-i}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 | 원 (KRW) | **Stage 1** |
| $n$ | SMA 기간 | 봉 수 | 상수 [A] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 산술 평균 평활 | `js/indicators.js` `calcMA(data, n)` L.15 | 가격 추세 추출 |
| 표준 기간 5/20/60 | 상수 [A] | S-1, S-2, BB 중심선 |

**소비자:** 신호 S-1 (이동평균 교차), S-2 (이동평균 정렬), 스토캐스틱 %D 평활,
CCI 평균편차, 복합 신호.

**참조:** 제2장 2.3절 (통계학적 기초).

\newpage

### I-02: 지수이동평균 (Exponential Moving Average, EMA)

**개요**

지수이동평균(EMA)은 통계학의 시계열 평활 이론에서 기원한다. Brown (1956)의
"Exponential Smoothing for Predicting Demand"가 지수 평활의 기초를 놓았으며,
Holt (1957)이 이를 일반화하고, Hunter (1986)가 EWMA 해석을 제시하였다.

EMA는 과거 관측치에 기하급수적으로 감소하는 가중치를 부여하여, SMA 대비
최근 가격 변화에 더 민감하게 반응한다. 이 민감성은 MACD (I-19)에서 핵심적인데,
MACD는 빠른 EMA와 느린 EMA의 차이를 통해 모멘텀 이동을 감지하기 때문이다.

**핵심 공식**

$$EMA_t = \alpha \cdot P_t + (1 - \alpha) \cdot EMA_{t-1}, \quad \alpha = \frac{2}{n + 1}$$

초기화: $EMA_0 = SMA(\text{최초 } n \text{개 관측치})$.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 | 원 (KRW) | **Stage 1** |
| $\alpha$ | 평활 계수 $= 2/(n+1)$ | 무차원 | 본 Stage |
| $n$ | EMA 기간 | 봉 수 | 상수 [A] |
| $EMA_{t-1}$ | 이전 EMA 값 | 원 (KRW) | 재귀 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다. null/NaN 방어를 포함한 SMA 초기화 적용 (P0-3 수정).

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 지수 평활 | `js/indicators.js` `calcEMA(data, n)` L.26 | MACD, EWMA Vol |
| MACD 기본값 | n = 12, 26 [A], sig = 9 [A] | Appel (1979) 표준 |

**소비자:** MACD (I-19), EWMA 변동성 (I-26), 변동성 국면 장기 EMA.

**참조:** 제2장 2.2절 (수학적 기초).

\newpage

### I-03: 볼린저 밴드 (Bollinger Bands, BB)

**개요**

볼린저 밴드는 통계학의 기술통계 분야에서 발전한 표준편차 밴드 지표이다.
Bollinger (2001) *Bollinger on Bollinger Bands*에서 공식화하였다. 주목할 점은
모집단 시그마($\div n$)를 사용하며, 베셀 보정 표본 시그마($\div(n-1)$)가
아니라는 것이다. 이는 원저의 의도적 선택이다.

볼린저 밴드는 2시그마 가격 외피(envelope)를 포착하여 과매수(상단 밴드)와
과매도(하단 밴드) 조건을 식별한다. 밴드 수축(squeeze)은 변동성 확장에
선행하며, 이는 핵심적 국면 전환 신호이다.

**핵심 공식**

$$\text{Middle} = SMA(n)$$
$$\text{Upper} = SMA(n) + k \cdot \sigma_{\text{pop}}(n)$$
$$\text{Lower} = SMA(n) - k \cdot \sigma_{\text{pop}}(n)$$
$$\sigma_{\text{pop}} = \sqrt{\frac{1}{n} \sum_{i} (P_i - SMA)^2}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_i}$ | 종가 배열 | 원 (KRW) | **Stage 1** |
| $n$ | SMA 기간 (20) | 봉 수 | 상수 [A] Bollinger (2001) |
| $k$ | 시그마 배수 (2.0) | 무차원 | 상수 [A] Bollinger (2001) |
| $\sigma_{\text{pop}}$ | 모집단 표준편차 | 원 (KRW) | 런타임 산출 ($\div n$, 베셀 미적용) |
| $EVT\ \hat{\alpha}$ | Hill 꼬리지수 | 무차원 | 런타임 산출 (I-03E) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 시계열이다.

> **학문 분류:** 통계학(기술통계 → 정규분포 신뢰구간) + 극단값 이론(EVT 보정).
> 베셀 보정을 적용하지 않는 것은 Bollinger (2001) 원저의 의도적 선택이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 표준편차 밴드 | `js/indicators.js` `calcBB(closes, n, mult)` L.50 | 가격 외피 |
| 모집단 시그마 | n=20, mult=2.0 [A] | Bollinger (2001) 원본 |

**소비자:** 신호 S-7 (BB 반등/돌파/스퀴즈), 복합 신호
(buy_hammerBBVol, sell_shootingStarBBVol), EVT 보정 확장 (I-3E).

**참조:** 제2장 2.3절 (통계학).

\newpage

### I-03E: EVT 보정 볼린저 밴드 (EVT-Adjusted Bollinger Bands)

**개요**

극단값 이론(EVT)에 기반한 꼬리 보정 밴드이다. Gopikrishnan et al. (1999)의
역세제곱 법칙과 Hill (1975)의 꼬리지수 추정에 근거한다. 금융 수익률은
두꺼운 꼬리($\alpha$가 KRX 종목에서 통상 3~5)를 보인다. 표준 2시그마
밴드는 정규성을 가정하므로, EVT 보정 밴드는 실제 꼬리 확률을 반영하도록
확장되어 허위 돌파 신호를 줄인다.

**핵심 공식**

$$\text{EVT\_mult} = \begin{cases} k \cdot (1 + 0.45 \cdot (4 - \hat{\alpha})) & \hat{\alpha} < 4 \text{ (두꺼운 꼬리)} \\ k & \text{그 외 (표준 볼린저)} \end{cases}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $k$ | 볼린저 시그마 배수 (2.0) | 무차원 | 상수 [A] I-03 |
| $\hat{\alpha}$ | 힐 꼬리지수 추정량 | 무차원 | 본 Stage (I-10) |
| $0.45$ | EVT 보정 계수 | 무차원 | 상수 [D] 경험적 |

> **이전 Stage 데이터:** $\hat{\alpha}$는 본 Stage I-10 (힐 추정량)의 산출물이며, I-10 자체는 $\textcolor{stageOneMarker}{OHLCV}$ 수익률(Stage 1)로부터 도출된다. $k$는 I-03에서 계승한 상수이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 꼬리 보정 밴드 | `js/indicators.js` `IndicatorCache.bbEVT()` (지연 평가) | 극단 사건 필터 |
| 0.45 계수 | 상수 [D] | 정확한 분위수 매핑이 아닌 경험적 값 |

**참조:** 제2장 2.3.2절 (극단값 이론).

\newpage

### I-04: RSI (Relative Strength Index, 상대강도지수)

**개요**

RSI는 기술적 분석의 모멘텀 오실레이터 계열로, Wilder (1978)
*New Concepts in Technical Trading Systems*에서 창안되었다. RSI는 방향성
가격 움직임의 속도와 크기를 측정하여 0~100으로 진동한다. 70 이상은
과매수(매도 압력 축적), 30 이하는 과매도(매수 기회)를 나타낸다.
심리학적으로 RSI는 공포-탐욕 스펙트럼에 대응한다 (제2장 2.7절).

**핵심 공식**

$$RS = \frac{AvgGain(n)}{AvgLoss(n)}, \quad RSI = 100 - \frac{100}{1 + RS}$$

와일더 평활: $AvgGain_t = (AvgGain_{t-1} \cdot (n-1) + Gain_t) / n$.
이는 $\alpha = 1/n$인 지수이동평균과 동치이다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열 | 원 (KRW) | **Stage 1** |
| $n$ | RSI 기간 (14) | 봉 수 | 상수 [A] Wilder (1978) |
| $AvgGain$, $AvgLoss$ | 와일더 평활 평균 | 원 (KRW) | 재귀 산출 |
| $70 / 30$ | 과매수/과매도 경계 | 무차원 (0--100) | 상수 [A] Wilder (1978) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder RSI | `js/indicators.js` `calcRSI(closes, period)` L.63 | 과매수/과매도 |
| 표준 기간 14 | period = 14 [A] | Wilder (1978) 원본 |

**소비자:** 신호 S-5 (RSI 영역), S-6 (RSI 괴리), StochRSI (I-21),
복합 신호 (strongBuy_hammerRsiVolume, buy_bbBounceRsi 등).

**참조:** 제2장 2.7절 (심리학 --- 공포/탐욕 대리변수).

\newpage

### I-05: ATR (Average True Range, 평균진폭)

**개요**

ATR은 Wilder (1978) *New Concepts in Technical Trading Systems*에서 창안된
변동성 측정 지표이다. ATR은 CheeseStock의 보편적 정규화 단위이다. 모든
패턴 임계값, 손절매, 목표가를 ATR 배수로 표현함으로써 가격 수준 독립성을
달성한다. 삼성전자(60,000원)와 1,000원 소형주의 패턴이 변동성 상대적으로
동일하게 평가되는 것이다. 이것이 패턴 엔진의 가장 핵심적 설계 결정이다.

**핵심 공식**

$$TR_t = \max(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|)$$
$$ATR_t = \frac{ATR_{t-1} \cdot (n-1) + TR_t}{n}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{H_t}$ | 당일 고가 | 원 (KRW) | **Stage 1** OHLCV |
| $\textcolor{stageOneMarker}{L_t}$ | 당일 저가 | 원 (KRW) | **Stage 1** OHLCV |
| $\textcolor{stageOneMarker}{C_{t-1}}$ | 전일 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $n$ | ATR 기간 (14) | 봉 수 | 상수 [A] Wilder (1978) |
| 폴백 0.02 | ATR 불가 시 대체 비율 | 무차원 | 상수 [C] KRX 중앙값 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_{t-1}}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder ATR | `js/indicators.js` `calcATR(candles, period)` L.87 | 보편 정규화 단위 |
| 폴백 규칙 | `close * 0.02` [C]; `ATR_FALLBACK_BY_TF` | 시간대별 적응 |

**소비자:** 모든 패턴 감지, 모든 손절/목표 산출, 지지/저항 클러스터링 허용오차,
신뢰도 조정, OLS 추세 정규화.

**참조:** 제2장 2.3절 (통계학적 기초).

\newpage

### I-06: OBV (On-Balance Volume, 누적거래량)

**개요**

OBV는 기술적 분석의 거래량 분석 계열로, Granville (1963) *New Key to Stock
Market Profits*에서 창안되었다. Murphy (1999) Ch. 7에서 재체계화되었다.
Granville의 핵심 가설은 "거래량이 가격에 선행한다"는 것이다. OBV는 가격
방향으로 거래량을 누적하여, 축적(스마트 머니 매수)이나 분배(스마트 머니
매도)가 가격 반응보다 먼저 나타나는 것을 드러낸다. OBV 추세와 가격 추세
간의 괴리(divergence)는 행동재무학 문헌에서 가장 신뢰도 높은 선행 지표
중 하나이다 (Barber-Odean 2008 관심 이론, 제2장 2.7절).

**핵심 공식**

$$OBV_t = \begin{cases} OBV_{t-1} + V_t & C_t > C_{t-1} \\ OBV_{t-1} - V_t & C_t < C_{t-1} \\ OBV_{t-1} & C_t = C_{t-1} \end{cases}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{C_t}$ | 종가 | 원 (KRW) | **Stage 1** |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량 | 주 | **Stage 1** OHLCV |
| $OBV_{t-1}$ | 이전 OBV 누적값 | 주 | 재귀 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래량이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Granville OBV | `js/indicators.js` `calcOBV(candles)` L.115 | 거래량 방향 분석 |
| 조정 상수 없음 | 순수 공식 | --- |

**소비자:** 신호 S-20 (OBV 괴리), 복합 신호 buy_volRegimeOBVAccumulation.

**참조:** 제2장 2.7절 (관심과 거래량 심리).

\newpage

### I-07: 일목균형표 (Ichimoku Kinko Hyo)

**개요**

일목균형표는 일본식 기술적 분석의 대표 지표로, 호소다 고이치(Hosoda Goichi,
1969)가 *일목균형표*에서 체계화하였다 (필명 일목산인, Ichimoku Sanjin).
일목균형표는 5개 데이터 포인트를 동시에 제공한다. 추세 방향(전환선/기준선
관계), 모멘텀(구름 위치), 지지/저항(구름 경계), 확인(후행스팬 대 가격).
"삼역호전(saneki-hoten)" --- 가격이 구름 위에 있고, 전환선이 기준선을
상향 교차하며, 후행스팬이 26기간 전 가격 위에 있는 조건 --- 은 일본 기술적
분석 전통에서 강력한 매수 신호로 간주된다.

**핵심 공식**

$$\text{전환선(Tenkan-sen)} = \frac{highest\_high(9) + lowest\_low(9)}{2}$$
$$\text{기준선(Kijun-sen)} = \frac{highest\_high(26) + lowest\_low(26)}{2}$$
$$\text{선행스팬 A} = \frac{\text{전환선} + \text{기준선}}{2}, \quad \text{+26 선행}$$
$$\text{선행스팬 B} = \frac{highest\_high(52) + lowest\_low(52)}{2}, \quad \text{+26 선행}$$
$$\text{후행스팬(Chikou)} = \text{종가}, \quad \text{-26 후행}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $9, 26, 52$ | 전환선/기준선/선행B 기간 | 봉 수 | 상수 [A] 호소다 (1969) |
| $+26$ | 선행 이동 기간 | 봉 수 | 상수 [A] 호소다 (1969) |
| $-26$ | 후행 이동 기간 | 봉 수 | 상수 [A] 호소다 (1969) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 일목 5선 체계 | `js/indicators.js` `calcIchimoku(candles, conv, base, spanBPeriod, displacement)` L.135 | 추세/구름/확인 |
| 호소다 원본 상수 | conv=9, base=26, spanB=52, displacement=26 [A] | 표준 기간 |

**소비자:** 신호 S-8 (구름 돌파, TK 교차), 복합 신호
(buy_ichimokuTriple, sell_ichimokuTriple).

\newpage

### I-08: 칼만 필터 (Kalman Filter)

**개요**

칼만 필터는 수학/공학의 최적 제어 분야에서 발전한 상태 추정 기법이다.
Kalman (1960)이 기초를 놓았으며, Mohamed and Schwarz (1999)가 적응형 Q
확장을 INS/GPS 분야에서 제안하였다. 칼만 필터는 가우시안 잡음 가정 하에서
최적 상태 추정을 제공한다. 가격 시계열에 적용하면, 잡음-신호 비율에 따라
반응성을 자동 조절하는 평활 추정치를 산출한다. 이동평균(고정 시차)과 달리
칼만 이득 $K$가 자동 조정된다. 높은 잡음 → 낮은 이득(더 많은 평활), 낮은
잡음 → 높은 이득(더 민감한 반응). 적응형 Q 확장은 변동성 국면에 추가적
민감도를 부여한다.

**핵심 공식**

$$\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1}), \quad K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

적응형 Q: $Q_t = Q_{\text{base}} \times (ewmaVar_t / meanVar)$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{z_t}$ | 관측값 (종가) | 원 (KRW) | **Stage 1** |
| $\hat{x}_t$ | 추정 상태 (필터링된 가격) | 원 (KRW) | 본 Stage |
| $K_t$ | 칼만 이득 | 무차원 | 런타임 산출 |
| $P_{t|t-1}$ | 사전 오차 공분산 | 원$^2$ | 런타임 산출 |
| $Q$ | 프로세스 노이즈 (0.01) | 무차원 | 상수 [B] |
| $R$ | 관측 노이즈 (1.0) | 무차원 | 상수 [B] |
| $ewmaAlpha$ | EWMA 평활 계수 (0.06) | 무차원 | 상수 [B] ~30봉 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{z_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 칼만 | `js/indicators.js` `calcKalman(closes, Q, R)` L.170 | 적응 평활 |
| 프로세스/관측 노이즈 | Q=0.01, R=1.0, ewmaAlpha=0.06 [B] | 자동 조정 |

**소비자:** 신호 S-12 (칼만 전환 --- 기울기 방향 전환).

**참조:** 제2장 2.2.6절 (최적 제어).

\newpage

### I-09: 허스트 지수 (Hurst Exponent, R/S Analysis)

**개요**

허스트 지수는 물리학/프랙탈 분야의 장기 의존성 이론에 근거한다.
Mandelbrot (1963)이 금융시장에의 적용을 처음 제안하였으며, Peters (1994)
*Fractal Market Analysis* Ch. 4에서 체계화하였다. Mandelbrot and Wallis
(1969)가 R/S 관례를 확립하였다.

$H > 0.5$는 추세 지속성(모멘텀 국면), $H < 0.5$는 평균회귀,
$H = 0.5$는 랜덤워크를 나타낸다. 이는 현재 국면에서 추세추종 전략과
평균회귀 전략 중 어느 것이 성공할 가능성이 높은지를 직접 알려준다.
R/S는 수익률(정상 과정)로 계산해야 하며, 가격 수준(I(1))으로 계산하면
$H$가 ~0.4만큼 상향 편향된다.

**핵심 공식**

1. 가격을 로그수익률로 변환: $r_t = \ln(P_{t+1}/P_t)$
2. 윈도우 크기 $w = [minWindow, 1.5w, 2.25w, \ldots]$에 대해:
   블록별 $R/S = (\max(\text{cumDev}) - \min(\text{cumDev})) / S$ 계산
3. 회귀: $\log(R/S) = H \cdot \log(w) + c$, $H$ = 회귀 기울기

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 시계열 | 원 (KRW) | **Stage 1** |
| $r_t$ | 로그수익률 | 무차원 | 본 Stage |
| $w$ | 윈도우 크기 | 봉 수 | 기하급수적 확장 |
| $R/S$ | 조정 범위 / 표준편차 | 무차원 | 런타임 산출 |
| $H$ | 허스트 지수 | 무차원 (0--1) | 회귀 기울기 |
| $minWindow$ | 최소 윈도우 (10) | 봉 수 | 상수 [C] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다. Mandelbrot-Wallis (1969)에 따른 모집단 시그마 적용. S=0 블록 제외 (M-9 수정).

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| R/S 분석 | `js/indicators.js` `calcHurst(closes, minWindow)` L.212 | 국면 분류 |
| $R^2$ 보고 | 회귀 품질 표시 | 추정 신뢰도 |

**소비자:** 신호 S-11 (허스트 국면: H > 0.6 추세, H < 0.4 평균회귀).

**참조:** 제2장 2.2.4절 (프랙탈 수학), 2.1절 (경제물리학).

\newpage

### I-10: 힐 꼬리 추정량 (Hill Tail Estimator)

**개요**

힐 추정량은 통계학의 극단값 이론(EVT) 분야에서 발전한 꼬리지수 추정 도구이다.
Hill (1975)이 원래 추정량을 제안하였으며, Drees and Kaufmann (1998)이
자동 $k$-선택 기법을 제공하였다. $\hat{\alpha} < 4$이면 수익률 분포의
꼬리가 두꺼워(멱법칙 감쇠) 정규분포의 제4적률(첨도)이 이론적으로 무한이다.
이 경우 표준 볼린저 밴드의 신뢰구간이 과소추정되므로 EVT 보정 밴드가
활성화된다.

**핵심 공식**

$$\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}, \quad SE = \frac{\hat{\alpha}}{\sqrt{k}}$$

여기서 $X_{(i)}$는 순서통계량(절대수익률, 내림차순),
$k = \lfloor\sqrt{n}\rfloor$ (Drees-Kaufmann 규칙).

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{X_{(i)}}$ | 절대수익률 순서통계량 | 무차원 | **Stage 1** 가격 데이터 |
| $k$ | 상위 순서통계량 개수 $\lfloor\sqrt{n}\rfloor$ | 무차원 | 상수 [A] Drees-Kaufmann |
| $\hat{\alpha}$ | 꼬리지수 추정값 | 무차원 | 본 Stage |
| $SE$ | 추정량 표준오차 | 무차원 | 본 Stage |
| 최소 $n$ | 최소 관측 수 (10) | 개 | 상수 [A] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{X_{(i)}}$는 Stage 1의 OHLCV 데이터로부터 산출된 절대수익률 순서통계량이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Hill 추정 | `js/indicators.js` `calcHillEstimator(returns, k)` L.276 | 꼬리 두께 측정 |
| Drees-Kaufmann k | 최소 n=10 [A], k=floor(sqrt(n)) [A] | 자동 k 선택 |

**소비자:** I-3E (EVT 볼린저), 백테스터 꼬리위험 평가.

**참조:** 제2장 2.3.2절 (극단값 이론).

\newpage

### I-11: GPD 꼬리 적합 (Generalized Pareto Distribution)

**개요**

GPD는 통계학의 극단값 이론(EVT) 중 임계값 초과(Peaks Over Threshold, POT)
접근법에 해당한다. Pickands (1975)와 Balkema-de Haan (1974)이 이론적 토대를
놓았으며, Hosking and Wallis (1987)가 확률가중적률(PWM) 추정법을 제안하였다.
GPD는 이론적으로 정당화된 극단 위험 분위수를 제공한다. 표준 VaR은 정규성을
가정하지만, GPD 기반 VaR은 KRX 수익률의 실제 꼬리 행태
($\alpha \sim 3$--$4$, 스튜던트-t 유사)를 포착한다.

**핵심 공식**

임계값: $u$ = 절대수익률 상위 5%, 초과량: $y_i = |r_i| - u$

PWM: $b_0 = \bar{y}$, $b_1 = \bar{y \cdot rank/(N_u-1)}$

$\hat{\xi} = 2 - b_0/(b_0 - 2b_1)$, $\hat{\sigma} = 2b_0 b_1/(b_0 - 2b_1)$

$VaR_p = u + (\sigma/\xi)[((n/N_u)(1-p))^{-\xi} - 1]$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{r_i}$ | 수익률 시계열 | 무차원 | **Stage 1** OHLCV |
| $u$ | POT 임계값 (상위 5%) | 무차원 | 상수 [B] |
| $y_i$ | 초과량 | 무차원 | 런타임 산출 |
| $\hat{\xi}$ | 형상 모수 (< 0.499 제한) | 무차원 | 본 Stage |
| $\hat{\sigma}$ | 스케일 모수 | 무차원 | 본 Stage |
| $p$ | 분위수 (0.99) | 무차원 | 상수 [A] |
| 최소 $n$ | 최소 관측 수 (500) | 개 | 상수 [B] |
| 최소 초과 | 최소 초과 관측 수 (20) | 개 | 상수 [B] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_i}$는 Stage 1의 OHLCV 데이터로부터 산출된 수익률 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| POT-GPD | `js/indicators.js` `calcGPDFit(returns, quantile)` L.323 | 극단 VaR |
| PWM 추정 | quantile=0.99 [A], 임계=상위 5% [B] | 꼬리 확률 산출 |

**소비자:** EVT 기반 손절매 최적화 (백테스터).

\newpage

### I-12: CAPM 베타 (Capital Asset Pricing Model Beta)

**개요**

CAPM 베타는 금융학의 자산가격결정 이론에서 도출된 체계적 위험 측정치이다.
Sharpe (1964), Lintner (1965)가 이론을 체계화하였으며, Fama-MacBeth (1973)가
횡단면 검증 방법론을 확립하였다. Scholes-Williams (1977)는 비유동성 보정
방법을 제안하였다.

베타는 체계적 위험, 즉 시장 전체 움직임에 대한 민감도를 측정한다.
$\beta = 1.5$이면 시장이 1% 움직일 때 해당 종목은 1.5% 움직인다.
젠센 알파(연율화 초과수익)는 베타를 감안한 후의 성과를 측정한다.
백테스터(B-6)에서 패턴 수익을 체계적(베타) 성분과 고유(알파) 성분으로
분해하는 데 사용된다.

**핵심 공식**

$$\beta = \frac{Cov(R_i - R_f, R_m - R_f)}{Var(R_m - R_f)}$$
$$\alpha = \overline{(R_i - R_f)} - \beta \cdot \overline{(R_m - R_f)}$$

Scholes-Williams 보정: $\beta_{SW} = (\beta_{-1} + \beta_0 + \beta_{+1}) / (1 + 2\rho_m)$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{R_i}$ | 개별 종목 수익률 | 무차원 | **Stage 1** 종가 |
| $\textcolor{stageOneMarker}{R_m}$ | 시장(KOSPI/KOSDAQ) 수익률 | 무차원 | **Stage 1** 시장지수 |
| $\textcolor{stageTwoMarker}{R_f}$ | 무위험 이자율 | 무차원 (연율) | **Stage 2** (제2장 2.5.1절 CAPM) |
| $\beta$ | 체계적 위험 | 무차원 | 본 Stage |
| $\alpha$ | 젠센 알파 (초과수익) | 무차원 (연율) | 본 Stage |
| $window$ | 추정 윈도우 (250) | 거래일 | 상수 [A] KRX_TRADING_DAYS |
| 최소 관측 | 60 | 거래일 | 상수 [B] |
| 비유동성 임계 | 10% 무거래일 | 비율 | 상수 [C] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{R_i, R_m}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가/시장지수이다. $\textcolor{stageTwoMarker}{R_f}$는 제2장 2.5.1절 CAPM 이론의 무위험 이자율 개념이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CAPM + S-W 보정 | `js/indicators.js` `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)` L.391 | 체계적 위험 |
| 비유동성 보정 | 10% 무거래일 임계 [C] | Scholes-Williams 자동 적용 |

**소비자:** 백테스터 B-6 (젠센 알파), 재무 패널 표시, 베타 로드 함수.

**참조:** 제2장 2.5.1절 (CAPM).

\newpage

### I-13: 역사적 변동성 (Historical Volatility, Parkinson)

**개요**

Parkinson (1980)이 제안한 범위 기반 변동성 추정량이다. 종가-종가 변동성
대비 약 5배 효율적이다. 고가-저가 범위는 종가-종가 변동성이 놓치는 장중
가격 변동을 포착한다. Parkinson 추정량은 통계적으로 더 효율적(동일 표본
크기에서 낮은 분산)이어서, VRP (I-14) 산출에 보다 정확한 실현 변동성
추정치를 제공한다.

**핵심 공식**

$$HV_{\text{daily}} = \sqrt{\frac{1}{4n\ln 2} \sum [\ln(H_i/L_i)]^2}$$
$$HV_{\text{annual}} = HV_{\text{daily}} \times \sqrt{\text{KRX\_TRADING\_DAYS}}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{H_i, L_i}$ | 고가, 저가 | 원 (KRW) | **Stage 1** OHLCV |
| $n$ | 추정 기간 (20) | 봉 수 | 상수 [B] |
| $\sqrt{250}$ | 연율화 계수 | 무차원 | KRX_TRADING_DAYS 관례 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_i, L_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가/저가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Parkinson HV | `js/indicators.js` `calcHV(candles, period)` L.492 | 실현 변동성 |
| 연율화 | period=20 [B], sqrt(250) | KRX 관례 적용 |

**소비자:** VRP (I-14), 변동성 국면 분류.

\newpage

### I-14: VRP (Variance Risk Premium, 분산 위험 프리미엄)

**개요**

VRP는 금융학/파생상품 분야의 변동성 위험 프리미엄 개념이다.
Bollerslev (2009) "Expected Stock Returns and Variance Risk Premia"에서
체계화되었다. 양(+)의 VRP는 옵션 시장이 실현보다 높은 변동성을 가격에
반영한다는 것을 의미하며, 불확실성 고조와 변동성 압축(평균회귀)이 임박했을
수 있다. 음(-)의 VRP는 옵션이 저평가되어 변동성 확장이 예상된다.

**핵심 공식**

$$VRP = \sigma_{IV}^2 - \sigma_{RV}^2 = (VKOSPI/100)^2 - HV_{\text{Parkinson}}^2$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{VKOSPI}$ | 내재변동성 지수 | % | **Stage 1** (vkospi.json) |
| $HV_{\text{Parkinson}}$ | 실현 변동성 (I-13) | 무차원 (연율) | 본 Stage |
| $VRP$ | 분산 위험 프리미엄 | 무차원 | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{VKOSPI}$는 Stage 1 데이터 계층에서 수집된 VKOSPI 내재변동성 지수이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Bollerslev VRP | `js/indicators.js` `calcVRP(vkospi, hvAnnualized)` L.536 | 변동성 프리미엄 |
| 조정 상수 없음 | 단위 변환 포함 순수 공식 | --- |

**소비자:** 신뢰도 요인 F8, RORO 요인 R1 (VKOSPI 경유).

**참조:** 제2장 2.6.11절 (파생상품 이론).

\newpage

### I-15: WLS 회귀 (Weighted Least Squares with Ridge, 릿지 포함)

**개요**

WLS 회귀는 통계학의 회귀분석, 구체적으로 일반화 최소제곱(GLS) 분야에
해당한다. Aitken (1935)이 GLS를, Hoerl and Kennard (1970)이 릿지 회귀를,
Reschenhofer et al. (2021)이 시간의존 WLS를 제안하였다.

지수적 감쇠 가중치를 갖는 WLS는 최근 관측치에 더 큰 영향력을 부여하여
시변적(time-varying) 관계를 포착한다. 릿지 정규화는 예측변수(품질, 추세,
거래량, 변동성)가 상관될 때 다중공선성으로 인한 불안정성을 방지한다.
Reschenhofer et al. (2021)은 WLS가 주식수익률 예측에서 OLS를 유의하게
능가한다는 것을 입증하였다.

**핵심 공식**

$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

$W = \text{diag}(\text{weights})$, $\lambda$ = 릿지 벌점 (절편 면제).

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $X$ | 설계 행렬 (품질, 추세, 거래량, 변동성) | 다양 | 본 Stage (각 지표) |
| $y$ | 반응 변수 (수익률) | 무차원 | 본 Stage |
| $W$ | 대각 가중 행렬 (지수 감쇠) | 무차원 | 본 Stage |
| $\lambda$ | 릿지 벌점 | 무차원 | GCV 선택 (I-16) |
| $\hat{\beta}$ | 회귀 계수 벡터 | 다양 | 본 Stage |
| 최소 $n$ | $p+2$ 관측 | 개 | 상수 [A] |

> **이전 Stage 데이터:** $X$의 각 열은 I-01~I-28의 지표 산출물로부터 구성되며, $y$는 Stage 1 가격 데이터로부터 산출된 수익률이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 릿지 WLS | `js/indicators.js` `calcWLSRegression(X, y, weights, ridgeLambda)` L.558 | 수익 예측 |
| GCV 람다 | I-16 자동 선택 | 정규화 최적화 |

**소비자:** 백테스터 WLS 회귀 예측, OLS 추세 (I-17).

\newpage

### I-15a: HC3 강건 표준오차 (Heteroscedasticity-Consistent Standard Errors)

**개요**

HC3 강건 표준오차는 통계학의 이분산-일치 추정 분야에 해당한다.
White (1980)이 원래의 HC0 추정량을 제안하였으며, MacKinnon and White (1985)가
HC3 변형을 개선하였다. HC3은 HC0(White 원본) 대비 선호되며, $(1-h_{ii})^2$
스케일링이 고지렛점 관측치에서의 오차분산 과소추정을 보정한다. 지렛점
상한: 0.99로 제한 (수치적 안정성).

**핵심 공식**

$$\hat{V}_{HC3}(\hat{\beta}) = (X'WX)^{-1} \left[\sum_i w_i^2 \frac{\hat{e}_i^2}{(1 - h_{ii})^2} x_i x_i' \right] (X'WX)^{-1}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $h_{ii}$ | 지렛점(hat matrix 대각 원소) | 무차원 | 본 Stage |
| $\hat{e}_i$ | 잔차 | 무차원 | 본 Stage (I-15) |
| $0.99$ | 지렛점 상한 | 무차원 | 수치적 안정성 제한 |

> **이전 Stage 데이터:** $h_{ii}$와 $\hat{e}_i$는 I-15 WLS 회귀의 산출물이다. WLS의 설계행렬 $X$와 가중행렬 $W$는 $\textcolor{stageOneMarker}{OHLCV}$ 기반 피처(품질, 추세, 거래량비, 변동성비)로 구성되며, 릿지 정규화의 이론적 기초는 $\textcolor{stageTwoMarker}{\text{Ridge}}$ (제2장 2.2.5절)에서 도출된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HC3 보정 | `js/indicators.js` WLS 내부 | t-통계량 산출 |

**소비자:** 백테스터 WLS 계수의 t-통계량.

\newpage

### I-16: GCV 람다 선택 (Generalized Cross-Validation)

**개요**

GCV는 통계학의 모형 선택 분야에서 발전한 정규화 모수 선택 기법이다.
Golub, Heath, and Wahba (1979)가 제안하였다. 릿지 회귀의 최적 벌점 $\lambda$를
데이터 주도적으로 선택하여 과적합과 과소적합 사이의 균형을 달성한다.

**핵심 공식**

$$GCV(\lambda) = \frac{RSS(\lambda)/n}{(1 - tr(H_\lambda)/n)^2}, \quad \lambda^* = \arg\min_{\lambda} GCV(\lambda)$$

그리드: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].
평탄성 검사: GCV 변동 < 1%이면 기본값 $\lambda = 1.0$.

야코비 고유분해(I-16a)를 사용하여 효율적 트레이스 계산.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $RSS(\lambda)$ | 잔차 제곱합 | 무차원 | 본 Stage |
| $H_\lambda$ | 영향력 행렬 (hat matrix) | 무차원 | 본 Stage |
| $\lambda$ | 릿지 벌점 후보 | 무차원 | 그리드 탐색 |
| $n$ | 관측 수 | 개 | 본 Stage |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| GCV 선택 | `js/indicators.js` `selectRidgeLambdaGCV(X, y, w, p)` L.826 | 최적 $\lambda$ |
| 야코비 고유분해 | I-16a 내부 | 효율적 트레이스 |

\newpage

### I-17: OLS 추세선 (Ordinary Least Squares Trend)

**개요**

OLS 추세선은 통계학의 회귀분석에서 가장 기본적인 추세 감지 도구이다.
Lo and MacKinlay (1999)는 $R^2 > 0.15$이면 추세가 존재하고,
$> 0.50$이면 강한 추세로 판단할 수 있다고 하였다. ATR(14) 정규화된
기울기(slopeNorm)를 사용하여 가격 수준 독립적 추세 강도를 산출한다.

**핵심 공식**

$$P_t = a + bt + \varepsilon, \quad slopeNorm = b / ATR(14)$$

direction = 'up' if slopeNorm > 0.05, 'down' if < -0.05, 'flat' 그 외.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 | 원 (KRW) | **Stage 1** |
| $b$ | 회귀 기울기 | 원/봉 | 본 Stage |
| $ATR(14)$ | 평균진폭 (I-05) | 원 (KRW) | 본 Stage |
| $slopeNorm$ | 정규화 기울기 | 무차원 | 본 Stage |
| $window$ | 추정 윈도우 (20) | 봉 수 | 상수 [B] |
| $0.05$ | 방향 판단 임계값 | 무차원 | 상수 [D] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| OLS 추세 | `js/indicators.js` `calcOLSTrend(closes, window, atr14Last)` L.912 | 추세 감지 |
| 방향 분류 | window=20 [B], slopeNorm 임계=0.05 [D] | up/down/flat |

> **주:** I-18은 의도적 결번이다. 초기 설계에서 예약되었으나 최종 구현에 포함되지 않았으며, 기존 ID 체계의 연속성을 유지하기 위해 재배정하지 않았다.

\newpage

### I-19: MACD (Moving Average Convergence Divergence, 이동평균수렴확산)

**개요**

MACD는 기술적 분석의 모멘텀 지표로, Appel (1979)
*The Moving Average Convergence-Divergence Trading Method*에서 창안되었다.
MACD는 두 EMA의 수렴과 발산을 통해 모멘텀을 포착한다. MACD 선이 시그널 선을
상향 교차(강세 교차)하면 모멘텀이 상승으로 전환되고, 하향 교차(약세 교차)하면
하락으로 전환된다. 히스토그램은 모멘텀 변화의 속도를 시각화한다.

**핵심 공식**

$$\text{MACD Line} = EMA(12) - EMA(26)$$
$$\text{Signal Line} = EMA(9, \text{MACD Line})$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열 | 원 (KRW) | **Stage 1** |
| $fast$ | 빠른 EMA 기간 (12) | 봉 수 | 상수 [A] Appel (1979) |
| $slow$ | 느린 EMA 기간 (26) | 봉 수 | 상수 [A] Appel (1979) |
| $sig$ | 시그널 EMA 기간 (9) | 봉 수 | 상수 [A] Appel (1979) |
| $EMA(n)$ | 지수이동평균 | 원 (KRW) | 재귀 산출, SMA 초기화 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

> **의존 체인:** OHLCV close → calcEMA(12) → calcEMA(26) → MACD Line →
> calcEMA(9, MACD) → Signal Line → Histogram → 신호 S-3, S-4.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Appel MACD | `js/indicators.js` `calcMACD(closes, fast, slow, sig)` L.993 | 모멘텀 교차 |
| 표준 파라미터 | fast=12, slow=26, sig=9 [A] | Appel 원본 |

**소비자:** 신호 S-3 (MACD 교차), S-4 (MACD 괴리), 복합 신호.

\newpage

### I-20: 스토캐스틱 오실레이터 (Stochastic Oscillator)

**개요**

스토캐스틱 오실레이터는 기술적 분석의 모멘텀 계열로, Lane (1984)
"Lane's Stochastics"에서 창안되었다. 현재 종가의 최근 $k$ 기간
고가-저가 범위 내 상대 위치를 측정하여, 가격이 범위의 상단에서
마감하는 경향(상승 추세)과 하단에서 마감하는 경향(하락 추세)을 포착한다.

**핵심 공식**

$$Raw\ \%K = \frac{Close - LL(k)}{HH(k) - LL(k)} \times 100$$
$$\%K = SMA(Raw\ \%K, smooth), \quad \%D = SMA(\%K, dPeriod)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가 | 원 (KRW) | **Stage 1** OHLCV |
| $k$ | 룩백 기간 (14) | 봉 수 | 상수 [A] |
| $smooth$ | %K 평활 기간 (3) | 봉 수 | 상수 [A] |
| $dPeriod$ | %D 기간 (3) | 봉 수 | 상수 [A] |
| $LL(k)$, $HH(k)$ | 최근 $k$봉 최저가/최고가 | 원 (KRW) | 런타임 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lane 스토캐스틱 | `js/indicators.js` `calcStochastic(candles, kPeriod, dPeriod, smooth)` L.1028 | 상대 위치 |
| 표준 파라미터 | kPeriod=14, dPeriod=3, smooth=3 [A] | Lane 원본 |

**소비자:** 신호 S-10, 복합 buy_wrStochOversold.

\newpage

### I-21: 스토캐스틱 RSI (Stochastic RSI)

**개요**

스토캐스틱 RSI는 기술적 분석의 복합 오실레이터 계열로, Chande and Kroll
(1994) *The New Technical Trader*에서 창안되었다. RSI에 스토캐스틱 공식을
적용한 것으로, RSI의 과매수/과매도 영역 내에서도 더 세밀한 타이밍 신호를
제공한다. RSI 자체가 0~100 범위로 제한되므로, 이를 스토캐스틱으로 재정규화하면
더 민감한 극단 감지가 가능해진다.

**핵심 공식**

$$StochRSI = \frac{RSI - LL(RSI, n)}{HH(RSI, n) - LL(RSI, n)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $RSI$ | 상대강도지수 (I-04) | 무차원 (0--100) | 본 Stage |
| $n$ | 스토캐스틱 기간 (14) | 봉 수 | 상수 [A] |
| $rsiPeriod$ | RSI 기간 (14) | 봉 수 | 상수 [A] |
| $kPeriod$, $dPeriod$ | %K, %D 기간 (3, 3) | 봉 수 | 상수 [A] |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Chande-Kroll | `js/indicators.js` `calcStochRSI(...)` L.1085 | 극단 감지 |
| 표준 파라미터 | rsiPeriod=14, kPeriod=3, dPeriod=3, stochPeriod=14 [A] | Chande-Kroll 원본 |

\newpage

### I-22: CCI (Commodity Channel Index, 상품채널지수)

**개요**

CCI는 기술적 분석의 편차 기반 오실레이터 계열로, Lambert (1980)
"Commodity Channel Index"에서 창안되었다. 전형가(Typical Price)의
이동평균 대비 편차를 측정하며, 상수 0.015는 CCI 값의 ~70~80%가
-100~+100 사이에 위치하도록 보장한다.

**핵심 공식**

$$TP = \frac{High + Low + Close}{3}, \quad CCI = \frac{TP - SMA(TP, n)}{0.015 \times MeanDev}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{High, Low, Close}$ | 고가, 저가, 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $n$ | CCI 기간 (20) | 봉 수 | 상수 [A] |
| $0.015$ | 정규화 상수 | 무차원 | 상수 [A] Lambert (1980) |
| $TP$ | 전형가 | 원 (KRW) | 런타임 산출 |
| $MeanDev$ | 평균편차 | 원 (KRW) | 런타임 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{High, Low, Close}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lambert CCI | `js/indicators.js` `calcCCI(candles, period)` L.1158 | 편차 오실레이터 |
| 표준 파라미터 | period=20 [A], 0.015 [A] | Lambert 원본 |

**소비자:** 신호 S-13, 복합 buy_cciRsiDoubleOversold.

\newpage

### I-23: ADX / +DI / -DI (Average Directional Index)

**개요**

ADX는 기술적 분석의 추세 강도 측정 계열로, Wilder (1978)의 방향성 움직임
시스템(Directional Movement System)에서 창안되었다. ADX는 추세의
강도(방향이 아님)를 측정한다. ADX > 25는 강한 추세, ADX < 20은 횡보장을
나타낸다. 추세추종 패턴은 ADX > 20일 때 더 높은 신뢰도를 받는다.

**핵심 공식**

$$ADX = Wilder\_Smooth(DX, n), \quad DX = \frac{|+DI - (-DI)|}{+DI + (-DI)} \times 100$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $n$ | ADX 기간 (14) | 봉 수 | 상수 [A] Wilder (1978) |
| $+DI$, $-DI$ | 양/음 방향지수 | 무차원 (0--100) | 런타임 산출 |
| $DX$ | 방향 지수 | 무차원 (0--100) | 런타임 산출 |
| $ADX$ | 평균 방향 지수 | 무차원 (0--100) | Wilder 평활 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder DMS | `js/indicators.js` `calcADX(candles, period)` L.1187 | 추세 강도 |
| 표준 기간 14 | period=14 [A] | Wilder 원본 |

**소비자:** 신호 S-14, 복합 buy_adxGoldenTrend, sell_adxDeadTrend.

\newpage

### I-24: Williams %R

**개요**

Williams %R은 기술적 분석의 모멘텀 오실레이터 계열로, Williams (1979)
*How I Made One Million Dollars*에서 소개되었다. 범위는
-100(과매도)~0(과매수)이다. 스토캐스틱 오실레이터와 구조적으로 동일하나
스케일이 반전되어 있다.

**핵심 공식**

$$\%R = \frac{HH(n) - Close}{HH(n) - LL(n)} \times (-100)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가 | 원 (KRW) | **Stage 1** OHLCV |
| $n$ | 룩백 기간 (14) | 봉 수 | 상수 [A] |
| $HH(n)$, $LL(n)$ | 최근 $n$봉 최고가/최저가 | 원 (KRW) | 런타임 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Williams %R | `js/indicators.js` `calcWilliamsR(candles, period)` L.1262 | 과매도/과매수 |
| 표준 기간 14 | period=14 [A] | Williams 원본 |

\newpage

### I-25: 틸-센 추정량 (Theil-Sen Estimator)

**개요**

틸-센 추정량은 강건 통계학의 비모수 회귀 분야에서 발전한 중앙값 기울기
추정 기법이다. Theil (1950)과 Sen (1968)이 제안하였다. 29.3%의
붕괴점(breakdown point)으로, 데이터의 29.3%까지 이상치가 존재해도 추정이
파괴되지 않는다. 삼각형, 쐐기형 등의 추세선 적합에서 스파이크 캔들에 의한
OLS 왜곡을 방지한다. 캔들 목표가 교정(ATR 배수)에도 사용된다.

**핵심 공식**

$$slope = \text{median}\left\{\frac{y_j - y_i}{x_j - x_i} : i < j\right\}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{y_i}$ | 가격 관측치 (고가 또는 저가) | 원 (KRW) | **Stage 1** OHLCV |
| $x_i$ | 시간 인덱스 | 봉 번호 | 본 Stage |
| $slope$ | 중앙값 기울기 | 원/봉 | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{y_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가 또는 저가이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 강건 중앙값 기울기 | `js/indicators.js` `calcTheilSen(xValues, yValues)` L.1287 | 추세선 적합 |
| 조정 상수 없음 | 순수 중앙값 계산 | --- |

\newpage

### I-26: EWMA 변동성 (Exponentially Weighted Moving Average Volatility)

**개요**

EWMA 변동성은 금융학/위험 관리 분야의 조건부 변동성 모형이다. J.P. Morgan
RiskMetrics (1996)에서 실무 표준으로 확립되었으며, Bollerslev (1986)의
GARCH(1,1)와 이론적 연결을 갖는다. IGARCH의 특수 경우($\omega=0$,
$\alpha+\beta=1$)이며, 통계역학의 "시장 온도" 개념의 직접적 조작화이다.

**핵심 공식**

$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 | 무차원 | **Stage 1** 종가 |
| $\sigma_t^2$ | 조건부 분산 | 무차원 | 본 Stage |
| $\lambda$ | 감쇠 계수 (0.94) | 무차원 | 상수 [B] RiskMetrics |
| $\textcolor{stageTwoMarker}{\text{GARCH}}$ | 일반화 조건부 이분산 모형 | --- | **Stage 2** (제2장 2.3절) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다. $\textcolor{stageTwoMarker}{\text{GARCH}}$ 이론 체계는 제2장 2.3절에서 도출된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| RiskMetrics EWMA | `js/indicators.js` `calcEWMAVol(closes, lambda)` L.1336 | 조건부 변동성 |
| 감쇠 계수 | lambda=0.94 [B] | RiskMetrics 일별 기본값 |

**소비자:** 변동성 국면 분류 (I-27), RORO 복합.

\newpage

### I-27: 변동성 국면 분류 (Volatility Regime Classification)

**개요**

변동성 국면 분류는 금융학의 국면 전환 이론에 기반한 변동성 비율 분류기이다.
단기 EWMA 변동성과 장기 EWMA의 비율로 현재 시장 국면을 저변동/중변동/고변동으로
분류한다. 국면에 따라 패턴 신뢰도 조정, 전략 선택, 리스크 관리 파라미터가
달라진다.

**핵심 공식**

$$ratio = \sigma_t / longRunEMA, \quad \text{국면} = \begin{cases} \text{'low'} & ratio < 0.75 \\ \text{'high'} & ratio > 1.50 \\ \text{'mid'} & \text{그 외} \end{cases}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\sigma_t$ | 단기 EWMA 변동성 (I-26) | 무차원 | 본 Stage |
| $longRunEMA$ | 장기 변동성 평활 | 무차원 | 본 Stage |
| $0.75$ | 저변동성 경계 | 무차원 | 상수 [D] VOL_REGIME_LOW |
| $1.50$ | 고변동성 경계 | 무차원 | 상수 [D] VOL_REGIME_HIGH |
| $\alpha$ | 장기 EMA 평활 계수 (0.01) | 무차원 | 상수 [B] |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 변동성 비율 분류 | `js/indicators.js` `classifyVolRegime(ewmaVol)` L.1385 | 국면 판별 |
| 경계값 | LOW=0.75 [D], HIGH=1.50 [D], alpha=0.01 [B] | 3-국면 체계 |

\newpage

### I-28: Amihud 비유동성 (Amihud Illiquidity)

**개요**

Amihud 비유동성은 시장미시구조 분야의 유동성 측정치이다. Amihud (2002)
"Illiquidity and Stock Returns"에서 제안되었다. 수익률 절대값 대비 거래금액의
비율로, 가격충격(price impact)의 대리변수이다. 높은 비유동성은 가격충격이
크다는 것을 의미하며, 패턴 신뢰도를 할인한다 (미시 요인 M1, 최대 -15%).

**핵심 공식**

$$ILLIQ = \frac{1}{D} \sum_{t=1}^{D} \frac{|r_t|}{DVOL_t}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 | 무차원 | **Stage 1** 종가 |
| $\textcolor{stageOneMarker}{DVOL_t}$ | 일별 거래금액 | 원 (KRW) | **Stage 1** OHLCV |
| $D$ | 추정 윈도우 (20) | 거래일 | 상수 [B] |
| $CONF\_DISCOUNT$ | 신뢰도 할인 하한 (0.85) | 무차원 | 상수 [C] |
| $LOG\_HIGH$ | 로그 비유동성 상한 (-1.0) | 무차원 | 상수 [C] |
| $LOG\_LOW$ | 로그 비유동성 하한 (-3.0) | 무차원 | 상수 [C] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t, DVOL_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래금액이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ | `js/indicators.js` `calcAmihudILLIQ(candles, window)` L.1430 | 유동성 측정 |
| 미시 요인 M1 | window=20 [B], DISCOUNT=0.85 [C] | 신뢰도 할인 |

\newpage

### I-29: 온라인 CUSUM (Cumulative Sum Control Chart)

**개요**

CUSUM은 통계학의 품질관리 및 순차분석 분야에서 발전한 변화점 감지 기법이다.
Page (1954)가 원래 CUSUM 차트를 제안하였으며, Roberts (1966)이 확장하였다.
CheeseStock에서는 변동성 적응형 임계값으로 확장하였다:
고변동성 → h=3.5, 저변동성 → h=1.5.

**핵심 공식**

$$S_t^+ = \max(0, S_{t-1}^+ + r_t - k), \quad S_t^- = \max(0, S_{t-1}^- - r_t - k)$$

$S^+$ 또는 $S^-$가 임계 $h$를 초과하면 구조변화 감지.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 | 무차원 | **Stage 1** 종가 |
| $k$ | 여유(slack) 파라미터 (0.5) | 무차원 | 상수 [B] |
| $h$ | 결정 임계값 (2.5, 적응형) | 무차원 | 상수 [B] |
| $warmup$ | 워밍업 기간 (30) | 봉 수 | 상수 [B] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 CUSUM | `js/indicators.js` `calcOnlineCUSUM(returns, threshold, volRegime)` L.1493 | 변화점 감지 |
| 변동성 적응 | threshold=2.5 [B], slack=0.5 [B], warmup=30 [B] | 국면별 임계 조정 |

**소비자:** 신호 S-17, 복합 buy_cusumKalmanTurn.

\newpage

### I-30: 이진 세분화 (Binary Segmentation)

**개요**

이진 세분화는 통계학의 구조변화 감지 분야에서 발전한 BIC 기반 기법이다.
Bai and Perron (1998)이 다중 구조변화 검정의 이론적 토대를 놓았으며,
탐욕적(greedy) 이진 세분화는 이의 계산 효율적 근사이다. 수익률 시계열의
구조적 변화점(structural break)을 감지하여 국면 분류에 활용한다.

**핵심 공식**

각 분할에서 BIC 감소가 최대인 지점을 선택:

$$BIC = n \cdot \ln(\hat{\sigma}^2) + k \cdot \ln(n)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 시계열 | 무차원 | **Stage 1** 종가 |
| $maxBreaks$ | 최대 변화점 수 (3) | 개 | 상수 [B] |
| $minSegment$ | 최소 세그먼트 길이 (30) | 봉 수 | 상수 [B] |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 탐욕적 이진 세분화 | `js/indicators.js` `calcBinarySegmentation(returns, maxBreaks, minSegment)` L.1586 | 변화점 감지 |
| BIC 기반 | maxBreaks=3 [B], minSegment=30 [B] | 구조변화 검정 |

\newpage

### I-31: HAR-RV (Heterogeneous Autoregressive Realized Volatility)

**개요**

HAR-RV는 금융학의 변동성 예측 분야에서 발전한 이질적 시장 가설에 기반한
모형이다. Corsi (2009)가 제안하였다. 시장참여자의 이질적 시간
지평(일/주/월)에서 발생하는 다중척도 변동성 동역학을 포착한다.

**핵심 공식**

$$HAR\text{-}RV = \beta_0 + \beta_1 RV_d + \beta_2 RV_w + \beta_3 RV_m$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격 시계열 | 원 (KRW) | **Stage 1** |
| $RV_d$ | 일별 실현 변동성 | 무차원 | 본 Stage |
| $RV_w$ | 주간 실현 변동성 (5일 평균) | 무차원 | 본 Stage |
| $RV_m$ | 월간 실현 변동성 (21일 평균) | 무차원 | 본 Stage |
| $M$ | KRX 월간 윈도우 (21) | 거래일 | 상수 |
| $\beta_0, \beta_1, \beta_2, \beta_3$ | HAR 계수 | 무차원 | 회귀 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격 시계열이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Corsi HAR-RV | `js/indicators.js` `calcHAR_RV(candles)` via `IndicatorCache.harRV(idx)` L.2213 | 다중척도 변동성 |
| KRX 월간 | $M = 21$ 거래일 | KRX 관례 |

---

\newpage

## Sheet 2: 3.2.1 캔들스틱 패턴 이론

### 3.2.1 일본 캔들스틱 전통 (Nison 1991, Morris 2006, Bulkowski 2008)

**개요**

`js/patterns.js`에 구현된 21개 이상의 캔들스틱 패턴은 일본 쌀 거래
전통에서 기원한다. 혼마 무네히사(Homma Munehisa, 18세기)가 오사카 도지마
미곡 거래소에서 발전시킨 캔들 차트 기법이 현대 기술적 분석의 기초가 되었으며,
다음의 저서에 의해 체계화되었다.

- **Nison (1991)** *Japanese Candlestick Charting Techniques* --- 캔들스틱 분석을
  서양 시장에 도입한 기념비적 영문 저서. 패턴의 심리학적 해석 체계 확립.
- **Morris (2006)** *Candlestick Charting Explained* --- 추가 패턴 상세 및
  확인 규칙(confirmation rules) 정교화.
- **Bulkowski (2008)** *Encyclopedia of Candlestick Charts* --- 20년 이상
  미국 주식 데이터에 대한 경험적 성과 통계 (승률, 기대 수익률).

모든 임계값은 ATR 정규화된다 (Wilder 1978): `actual_threshold = constant * ATR(14)`.
이로써 가격 수준 독립성이 보장된다.

*승률 데이터: KOSPI+KOSDAQ 2,704종목, 2020--2025, n=545,307건.*

**핵심 공식 --- ATR 정규화 임계값**

$$threshold_{actual} = constant \times ATR(14)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$ | 시가, 고가, 저가, 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량 | 주 | **Stage 1** OHLCV |
| $ATR(14)$ | 평균진폭 (I-05) | 원 (KRW) | 본 Stage |
| $body$ | 실체 크기 $= |C_t - O_t|$ | 원 (KRW) | 런타임 산출 |
| $range$ | 캔들 범위 $= H_t - L_t$ | 원 (KRW) | 런타임 산출 |
| $upperShadow$ | 윗그림자 | 원 (KRW) | 런타임 산출 |
| $lowerShadow$ | 아래그림자 | 원 (KRW) | 런타임 산출 |
| $DOJI\_BODY\_RATIO$ | 도지 실체 비율 (0.05) | 무차원 | 상수 [A] Nison |
| $SHADOW\_BODY\_MIN$ | 그림자/실체 최소 비율 (2.0) | 무차원 | 상수 [A] Morris |
| $MARUBOZU\_BODY\_RATIO$ | 마루보즈 실체 비율 (0.85) | 무차원 | 상수 [A] Nison |
| $SPECIAL\_DOJI\_SHADOW\_MIN$ | 특수 도지 그림자 비율 (0.70) | 무차원 | 상수 [B] |
| $ENGULF\_BODY\_MULT$ | 장악형 실체 배수 (1.5) | 무차원 | 상수 [C] |
| $HARAMI\_CURR\_BODY\_MAX$ | 잉태형 현재 실체 상한 (0.5) | 무차원 | 상수 [B] |
| $PIERCING\_BODY\_MIN$ | 관통형 실체 하한 (0.3) | 무차원 | 상수 [B] |
| $THREE\_SOLDIER\_BODY\_MIN$ | 적삼병 실체 하한 (0.5) | 무차원 | 상수 [B] |
| $STAR\_BODY\_MAX$ | 별형 실체 상한 (0.12) | 무차원 | 상수 [A] Nison |
| $PROSPECT\_STOP\_WIDEN$ | 전망이론 손절 확대 (1.12) | 무차원 | 상수 [B] K&T (1979) |
| $PROSPECT\_TARGET\_COMPRESS$ | 전망이론 목표 압축 (0.89) | 무차원 | 상수 [B] K&T (1979) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

> **전망이론 통합 (제2장 2.7절):** 손절매는 $PROSPECT\_STOP\_WIDEN = 1.12$
> (Kahneman-Tversky 1979, 손실회피 $\lambda=2.25$)로 확대하고, 목표가는
> $PROSPECT\_TARGET\_COMPRESS = 0.89$ (민감도 체감)로 압축한다. 이는 투자자의
> 비대칭적 손실회피 행태를 반영한 교정이다.

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
상회한다. 이 매도 편향은 전망이론의 손실회피(제2장 2.7절) 및 KRX 구조적
특징(T+2 결제, 가격제한폭, 개인투자자 주도 거래)과 부합한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 21종 캔들 감지 | `js/patterns.js` `_detectSingleCandle()`, `_detectDoubleCandle()`, `_detectTripleCandle()` | 패턴 엔진 |
| ATR 정규화 | `PatternEngine._getATR()` | 임계값 보정 |
| 전망이론 교정 | PROSPECT_STOP_WIDEN=1.12, PROSPECT_TARGET_COMPRESS=0.89 | 손절/목표 조정 |
| 품질 점수 | `_calcCandleQuality()` PCA 가중 | 신뢰도 산출 |

---

\newpage

## Sheet 3: 3.2.2 차트 패턴 이론

### 3.2.2 서양 차트 패턴 이론 (Edwards-Magee 1948, Bulkowski 2005)

**개요**

9개 이상의 차트 패턴은 서양 기술적 분석의 두 기념비적 저서로부터 도출된다.

- **Edwards and Magee (1948)** *Technical Analysis of Stock Trends* --- 원래의 차트
  패턴 분류. 이중바닥/천장, 삼각형, 지지/저항의 원형적 정의.
- **Bulkowski (2005)** *Encyclopedia of Chart Patterns* --- 20년 이상 데이터의
  경험적 성과 통계. 패턴별 성공률, 측정 이동(measured move) 검증.

차트 패턴은 수십~수백 봉에 걸쳐 형성되는 거시적 가격 구조물이다. 캔들스틱
패턴이 시장 심리의 순간적 포착이라면, 차트 패턴은 수급의 구조적 전환을
포착한다. 형성 과정에서의 거래량 변화가 확인 요소로서 핵심적이다.

**3.2.3 다우 이론: 지지와 저항** (Dow, Hamilton 1922, Rhea 1932)

가격은 이전에 유의했던 가격 수준에서 지지(매수 관심)와 저항(매도 관심)을
형성하는 경향이 있다. George and Hwang (2004)은 52주 신고가 근접성이
모멘텀 수익률의 70%를 앵커링 편향을 통해 설명한다는 것을 보였다.

**핵심 공식 --- 목표가 산출**

$$target = breakout\_price \pm pattern\_height$$

상한 제한:
$$|target - entry| \leq CHART\_TARGET\_ATR\_CAP \times ATR(14)$$
$$|target - entry| / entry \leq CHART\_TARGET\_RAW\_CAP$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가 | 원 (KRW) | **Stage 1** OHLCV |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량 | 주 | **Stage 1** OHLCV |
| $ATR(14)$ | 평균진폭 (I-05) | 원 (KRW) | 본 Stage |
| $pattern\_height$ | 패턴 높이 (피크-트로프) | 원 (KRW) | 런타임 산출 |
| $breakout\_price$ | 돌파 가격 (넥라인) | 원 (KRW) | 런타임 산출 |
| $neckline$ | 넥라인 수준 | 원 (KRW) | 런타임 산출 |
| $NECKLINE\_BREAK\_ATR\_MULT$ | 넥라인 돌파 ATR 배수 (0.5) | 무차원 | 상수 [B] |
| $TRIANGLE\_BREAK\_ATR\_MULT$ | 삼각형 돌파 ATR 배수 (0.3) | 무차원 | 상수 [B] |
| $HS\_WINDOW$ | H&S 탐색 윈도우 (120) | 봉 수 | 상수 [C] |
| $HS\_SHOULDER\_TOLERANCE$ | H&S 어깨 허용오차 (0.15) | 무차원 | 상수 [B] |
| $NECKLINE\_UNCONFIRMED\_PENALTY$ | 미확인 패턴 감산 (15) | 점 | 상수 [B] Bulkowski |
| $CHART\_TARGET\_ATR\_CAP$ | 목표가 ATR 상한 (6) | ATR 배수 | 상수 [B] EVT 99.5% |
| $CHART\_TARGET\_RAW\_CAP$ | 목표가 비율 상한 (2.0) | 무차원 | 상수 [B] Bulkowski P80 |
| $SR\_tolerance$ | S/R 클러스터링 허용오차 | ATR*0.5 | 상수 |
| $SR\_strength$ | 접촉 강도 | 무차원 (0--1) | 런타임 산출 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

#### 차트 패턴 목록 (9종)

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
$NECKLINE\_UNCONFIRMED\_PENALTY = 15$ [B]를 적용한다.

**목표가 산출**: 차트 패턴 목표가는 측정 이동(measured move) 방법을 사용한다:
$target = breakout\_price \pm pattern\_height$. 상한은 다음으로 제한된다.
- $CHART\_TARGET\_ATR\_CAP = 6$ [B] --- EVT 99.5% VaR 경계 (Doc 12)
- $CHART\_TARGET\_RAW\_CAP = 2.0$ [B] --- Bulkowski P80

#### 지지와 저항 (S/R)

1. **가격 클러스터링**: ATR*0.5 허용오차, 최소 2회 접촉, 최대 10 수준
2. **접촉 강도**: 더 많은 접촉 → 높은 강도 (0~1.0 척도)
3. **합류(confluence)**: 패턴 손절/목표가 지지/저항의 ATR 이내 →
   신뢰도 +3*strength

**밸류에이션 지지/저항**: 기본적 분석 밸류에이션 임계(PER/PBR 기반 목표가)가
행동적 앵커로 작용. 강도 = 0.6, 범위 = +/-30% (KRX 일일 가격제한폭 일치).

**52주 신고/신저 지지/저항** (George-Hwang 2004): 강도 = 0.8, 가상 접촉 = 3.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 9종 차트 패턴 감지 | `js/patterns.js` `_detectDoubleBottom()`, `_detectDoubleTop()`, `_detectHS()`, `_detectInvHS()`, `_detectTriangle()`, `_detectWedge()` | 패턴 엔진 |
| 측정 이동 목표가 | `_doubleBottom_target()`, `_hs_target()`, `_triangle_target()` 등 | 목표가 산출 |
| S/R 클러스터링 | `_detectSR()` | 지지/저항 수준 |
| 밸류에이션 S/R | PER/PBR 기반 | 행동적 앵커 |
| 52주 S/R | George-Hwang (2004) | 앵커링 편향 |

---

\newpage

## Sheet 4: 3.2.4 패턴 감지의 수학적 기법

### 3.2.4 패턴 감지 수학 (ATR 정규화, 틸-센, 품질 점수, 베타-이항, AMH)

**개요**

패턴 감지 시스템의 수학적 기반은 다섯 가지 핵심 기법으로 구성된다.
(1) ATR 정규화를 통한 가격 수준 독립성, (2) 틸-센 강건 추세선 적합,
(3) PCA 가중 품질 점수, (4) 베타-이항 사후 승률 추정, (5) AMH 시간 감쇠.
이들은 각각 독립적 학술 기반을 가지면서도 패턴 엔진 내에서 유기적으로
통합되어 작동한다.

#### ATR 정규화 (Wilder 1978)

모든 임계값이 ATR(14) 배수로 표현된다.
폴백: $close \times 0.02$ (KRX 대형주 중앙값 일별 ATR/종가 비율).

#### 틸-센 추세선 적합 (Theil 1950, Sen 1968)

이상치 캔들에 대한 붕괴점 저항으로, 차트 패턴 추세선 적합(삼각형, 쐐기, 채널)에 사용.

#### 품질 점수 PCA 가중 (V6-FIX 교정)

**핵심 공식**

$$Q = 0.30 \times body + 0.22 \times volume + 0.21 \times trend + 0.15 \times shadow + 0.12 \times extra$$

#### 베타-이항 사후 승률 (Efron-Morris 1975)

**핵심 공식**

$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

#### AMH 시간 감쇠 (Lo 2004, McLean-Pontiff 2016)

**핵심 공식**

$$decay = \exp(-\lambda \cdot daysSince)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격/거래량 시계열 | 원/주 | **Stage 1** |
| $ATR(14)$ | 평균진폭 (I-05) | 원 (KRW) | 본 Stage |
| $0.02$ | ATR 폴백 비율 | 무차원 | 상수 [C] KRX 중앙값 |
| $Q$ | 품질 점수 | 무차원 (0--1) | 본 Stage |
| $0.30$ | body 가중치 (PC1) | 무차원 | PCA + 로지스틱 회귀 |
| $0.22$ | volume 가중치 | 무차원 | PCA + 로지스틱 회귀 |
| $0.21$ | trend 가중치 | 무차원 | PCA + 로지스틱 회귀 |
| $0.15$ | shadow 가중치 | 무차원 | PCA + 로지스틱 회귀 |
| $0.12$ | extra 가중치 | 무차원 | PCA + 로지스틱 회귀 |
| $\theta_{\text{post}}$ | 사후 승률 | 무차원 (0--1) | 본 Stage |
| $\theta_{\text{raw}}$ | 원시 승률 | 무차원 (0--1) | 본 Stage |
| $\mu_{\text{grand}}$ | 총평균 승률 | 무차원 | 캔들 ~43%, 차트 ~45% |
| $N_0$ | 경험적 베이즈 사전 강도 (35) | 관측 수 | 5년 545K 관측 최적값 |
| $n$ | 해당 패턴 관측 수 | 개 | 런타임 산출 |
| $\textcolor{stageTwoMarker}{\lambda_{\text{KOSDAQ}}}$ | KOSDAQ 감쇠율 (0.00367) | 일$^{-1}$ | **Stage 2** (제2장 AMH) |
| $\textcolor{stageTwoMarker}{\lambda_{\text{KOSPI}}}$ | KOSPI 감쇠율 (0.00183) | 일$^{-1}$ | **Stage 2** (제2장 AMH) |
| $daysSince$ | 패턴 감지 후 경과일 | 일 | 런타임 산출 |
| $decay$ | 시간 감쇠 배수 | 무차원 (0--1) | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격/거래량 시계열이다. $\textcolor{stageTwoMarker}{\lambda}$ 감쇠율은 제2장의 적응적 시장 가설(Adaptive Market Hypothesis, Lo 2004)에서 도출된 시장별 알파 반감기이다.

> **학문 분류:** 품질 점수의 가중치는 PCA 분산설명 + KRX 데이터에 대한 로지스틱 회귀에서 도출되었다. Nison (1991)은 "실체(real body)가 가장 중요한 요소"라 하였으며, body = PC1 최대 적재로 이를 통계적으로 확인하였다.

> **시장별 감쇠 차이:** KOSDAQ 반감기 189일, KOSPI 반감기 378일. McLean-Pontiff (2016)이 보인 바와 같이 소형주 시장에서 알파 감쇠가 더 빠르다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ATR 정규화 | `PatternEngine._getATR()`, 폴백 0.02 [C] | 모든 패턴 임계값 |
| 틸-센 적합 | `calcTheilSen()` (I-25) | 삼각형/쐐기 추세선 |
| PCA 품질 점수 | `_calcCandleQuality()` | 패턴 신뢰도 산출 |
| 베타-이항 축소 | `_betaBinomialPosterior()` | 사후 승률 추정 |
| AMH 감쇠 | `_applyAMHDecay()` | 시간 경과 신뢰도 조정 |
| 시장별 람다 | KOSDAQ=0.00367, KOSPI=0.00183 | 시장 구조 반영 |

---
