\newpage

### 3.3.1 신호 체계 (Signal System)

**개요**

기술적 지표의 수학적 출력은 그 자체로는 매매 의사결정에 직접 사용될 수 없다.
RSI가 28을 기록하거나 MACD 히스토그램이 음에서 양으로 전환되는 것은 숫자에 불과하다.
이를 '매수', '매도', '중립'이라는 이산적 행동 신호(discrete action signal)로 변환하는
규칙 체계가 필요하며, 이 변환 과정에서 각 임계값의 학술적 정당성이 확보되어야 한다.
본 절은 CheeseStock 시스템이 20개 이상의 기술적 지표와 11개 파생상품/교차자산
데이터 원천으로부터 총 31개의 독립 신호를 도출하고, 이를 다시 31개의 복합 신호로
결합하는 전체 신호 계보(signal genealogy)를 기술한다.

개별 신호에서 복합 신호로의 결합은 다중 출처 확인(multi-source confirmation)의
원칙에 기반한다. Murphy (1999, Ch.1)는 "단일 지표만으로는 시장의 복잡성을 포착할 수
없으며, 서로 다른 지표군(추세, 오실레이터, 거래량)의 동시 확인이 신호의 신뢰도를
기하급수적으로 증가시킨다"고 강조하였다. Pring (2002)은 이를 '무게 증거(weight of
evidence)' 접근법으로 체계화하였으며, 독립적 지표 2개가 동일 방향을 확인할 때
위양성(false positive) 확률이 개별 지표 대비 제곱에 비례하여 감소함을 실증하였다.

본 시스템의 신호 체계는 3-Tier 구조를 취한다. Tier 1 복합(10개)은 3개 이상의 독립
조건이 동시 충족되는 가장 강한 확인 수준이며, Tier 2 복합(17개)은 2개 조건의 보통
수준 확인, Tier 3 복합(4개)은 단일 핵심 조건에 보조 확인이 붙는 약한 수준이다.
모든 복합 신호는 window=$W$=5봉(KRX 1거래주) 이내의 동시 발생(coincidence)을
요구하며, 이는 Nison (1991)의 "수 봉 내 확인" 원칙과 KRX 거래 주기에 부합한다.

**핵심 공식**

개별 신호는 각 지표의 임계값 규칙에 따라 이산적으로 발생한다. 대표적 변환 규칙은
다음과 같다.

$$s_{\text{RSI}}(t) = \begin{cases} \text{buy} & \text{if } \text{RSI}(t-1) < 30 \text{ and } \text{RSI}(t) \geq 30 \\ \text{sell} & \text{if } \text{RSI}(t-1) > 70 \text{ and } \text{RSI}(t) \leq 70 \\ \text{inactive} & \text{otherwise} \end{cases}$$

복합 신호는 윈도우 내 동시 발생 방식으로 다수의 개별 신호를 결합한다. $n$개의
필수(required) 조건 $\{s_1, s_2, \ldots, s_n\}$과 $m$개의 선택(optional) 조건
$\{o_1, o_2, \ldots, o_m\}$에 대해:

$$\text{Composite}(t) = \begin{cases} \text{active} & \text{if } \forall\, s_i,\; \exists\, t_i \in [t - W,\, t + W] \text{ s.t. } s_i(t_i) = \text{active} \\ \text{inactive} & \text{otherwise} \end{cases}$$

활성화된 복합 신호의 기본 신뢰도(base confidence)에 선택 조건 보너스가 가산된다:

$$C_{\text{composite}} = C_{\text{base}} + \sum_{j=1}^{m} \mathbb{1}[o_j \text{ active in } W] \cdot \Delta_{\text{opt}}$$

여기서 $\Delta_{\text{opt}}$는 각 복합 정의의 `optionalBonus` 값(3--5)이다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $s_i(t)$ | 개별 신호 $i$의 시점 $t$ 상태 | {buy, sell, neutral, inactive} | 본 Stage |
| $W$ | 동시발생 윈도우 | 5봉 [D 경험적] | 본 Stage |
| $C_{\text{base}}$ | 복합 신호 기본 신뢰도 | 무차원 (0--100) | 본 Stage |
| $\Delta_{\text{opt}}$ | 선택 조건 보너스 | 무차원 (3--5) | 본 Stage |
| $\textcolor{stageOneMarker}{P_{\text{close}}}$ | 종가 | KRW | **Stage 1** |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량 | 주 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{VKOSPI}}$ | 변동성 지수 | 무차원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{투자자수급}}$ | 외국인/기관 순매수 | 억원 | **Stage 1** |
| $\textcolor{stageTwoMarker}{\text{RSI}(n)}$ | 상대강도지수 | 무차원 (0--100) | **Stage 2** |
| $\textcolor{stageTwoMarker}{\text{MACD}}$ | 이동평균 수렴확산 | KRW | **Stage 2** |
| $\textcolor{stageTwoMarker}{\text{BB}(\mu,\sigma)}$ | 볼린저 밴드 | KRW | **Stage 2** |
| $\textcolor{stageTwoMarker}{H}$ | 허스트 지수 | 무차원 (0--1) | **Stage 2** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_{\text{close}}}$, $\textcolor{stageOneMarker}{V_t}$, $\textcolor{stageOneMarker}{\text{VKOSPI}}$, $\textcolor{stageOneMarker}{\text{투자자수급}}$ 등은 Stage 1(Ch1) 데이터 계층에서 수집된 원시 시계열이다. $\textcolor{stageTwoMarker}{\text{RSI}}$, $\textcolor{stageTwoMarker}{\text{MACD}}$, $\textcolor{stageTwoMarker}{\text{BB}}$, $\textcolor{stageTwoMarker}{H}$ 등은 Stage 2(Ch2) 이론 계층에서 정의된 수학적 지표 산출 함수이다. 본 Stage에서는 이 지표 출력을 이산 신호로 변환하고, 복합 신호로 결합한다.

---

#### 추세 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-1 | 이동평균 교차 | MA(5), MA(20) | MA(5)가 MA(20)을 교차 | Murphy (1999) Ch.9 |
| S-2 | 이동평균 정렬 | MA(5/20/60) | MA5>MA20>MA60 또는 역순 | 다중 이동평균 확인 |
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

| 신호 ID | 명칭 | 트리거 조건 | 신뢰도 | 학술 근거 |
|---------|------|-----------|--------|-----------|
| S-21 | 베이시스 | 베이시스율 절대값 > 0.5% (보통), > 2.0% (극단) | 55--72 | Working (1949) |
| S-22 | PCR 역발상 | PCR > 1.2 (공포 $\to$ 매수), < 0.6 (탐욕 $\to$ 매도) | 62 | Pan-Poteshman (2006) |
| S-23 | 수급 정렬 | 매수/매도 정렬 + 외국인 순매수 $\pm$5000억 | 58--68 | Choe-Kho-Stulz (2005) |
| S-24 | ETF 심리 | 강세 심리 + 레버리지 비율 > 3.0 $\to$ 역발상 매도 | 55 | Cheng-Madhavan (2009) |
| S-25 | 공매도 비율 | 시장 공매도 비율 > 8% $\to$ 숏커버 랠리 (매수) | 56--63 | Desai et al. (2002) |
| S-26 | ERP | ERP = $(1/\text{PER}) \times 100 - \text{KTB10Y}$; > 5.5% $\to$ 매수 | 60 | Fed 모형, Asness (2003) |
| S-27 | VKOSPI 국면 | > 30 위기(0.60$\times$), 22--30 고위(0.80$\times$) | 할인 배수 | Whaley (2009) |
| S-28 | HMM 레짐 | 강세/약세/횡보 + 외국인 모멘텀 | Phase8 적용 | Hamilton (1989) |
| S-29 | CUSUM 변화점 | 최근 20봉 내 변화점 감지 | 52 | Page (1954) |
| S-30 | 이진 세분화 | 역추세 신호 할인 (0.85$\times$) | 할인 배수 | Bai-Perron (1998) |
| S-31 | HAR-RV | **지표만 구현, 신호 미구현** | N/A | Corsi (2009) |

> **데이터 흐름 주의사항:**
> - S-29, S-30, S-31은 외부 데이터 파일을 사용하지 않고 $\textcolor{stageOneMarker}{\text{OHLCV}}$ 캔들에서 직접 산출된다.
> - S-21의 베이시스 데이터는 파생상품 요약(`derivatives_summary.json`)과 베이시스 분석(`basis_analysis.json`) 두 데이터 원천에서 병합된다.
> - 표본 데이터(`source == "sample"`)인 경우 투자자 수급 및 공매도 데이터를 분석에서 제외한다. 오류 상태(`status == "error"`)인 경우 옵션 분석 데이터를 폐기한다.

---

#### Tier 1 복합 (10개 정의 --- 가장 강한 확인)

Tier 1은 3개 이상의 독립적 조건(캔들 패턴 + 지표 신호 + 거래량/추세 확인)이
동시에 충족되는 최고 신뢰 수준의 복합 신호군이다. 각 복합의 기본 신뢰도는
KRX 5개년 실증 승률(Win Rate)에 조건부 배수를 적용하여 교정(calibration)한
값이며, 학술적 연결 고리는 두 개 이상의 독립 학파에서 비롯된다.

| ID | 구성 요소 | 학술적 연결 고리 | 기본 신뢰도 |
|----|-----------|------------------|-------------|
| strongBuy\_hammerRsiVolume | 해머 + RSI 과매도 이탈 | Nison (1991) + Wilder (1978) | 61 |
| strongSell\_shootingMacdVol | 유성 + MACD 약세 | Nison (1991) + Appel (1979) | 69 |
| buy\_doubleBottomNeckVol | 이중바닥 + 거래량 돌파 | Edwards-Magee (1948) + Granville (1963) | 68 |
| sell\_doubleTopNeckVol | 이중천장 + 거래량 매도 | Edwards-Magee (1948) | 75 |
| buy\_ichimokuTriple | 구름 돌파 + TK 교차 | Hosoda (1969) 삼역호전 | 60 |
| sell\_ichimokuTriple | 구름 하향 + TK 교차 | Hosoda (1969) 삼역역전 | 60 |
| buy\_goldenMarubozuVol | 골든크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 65 |
| sell\_deadMarubozuVol | 데드크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 68 |
| buy\_adxGoldenTrend | 골든크로스 + ADX 강세 | Murphy (1999) + Wilder (1978) | 67 |
| sell\_adxDeadTrend | 데드크로스 + ADX 약세 | Murphy (1999) + Wilder (1978) | 67 |

#### Tier 2 복합 (17개 정의 --- 보통 수준 확인)

Tier 2는 2개의 필수 조건이 윈도우 내에서 동시 충족되는 중간 신뢰 수준의
복합 신호군이다. 패턴+지표, 오실레이터+오실레이터, 교차자산+수급 등 다양한
조합 방식이 포함되며, 캘리브레이션 기반 신뢰도 또는 이론 추정치를 사용한다.

| ID | 구성 요소 | 학술적 연결 고리 |
|----|-----------|------------------|
| buy\_goldenCrossRsi | 골든크로스 + RSI 과매도 | Murphy (1999) + Wilder (1978) |
| sell\_deadCrossMacd | 데드크로스 + MACD 약세 | Murphy (1999) + Appel (1979) |
| buy\_hammerBBVol | 해머 + BB 하단 반등 | Nison + Bollinger |
| sell\_shootingStarBBVol | 유성 + BB 상단 돌파 | Nison + Bollinger |
| buy\_morningStarRsiVol | 샛별 + RSI 과매도 | Nison + Wilder |
| sell\_eveningStarRsiVol | 석별 + RSI 과매수 | Nison + Wilder |
| buy\_engulfingMacdAlign | 장악형 + MACD 교차 | Nison + Appel |
| sell\_engulfingMacdAlign | 역장악형 + MACD 약세 | Nison + Appel |
| buy\_cciRsiDoubleOversold | CCI 이탈 + RSI 이탈 | Lambert + Wilder |
| sell\_cciRsiDoubleOverbought | CCI 과매수 + RSI 과매수 | Lambert + Wilder |
| neutral\_squeezeExpansion | BB 스퀴즈 + ATR 확장 | Bollinger (2001) |
| buy\_cusumKalmanTurn | CUSUM 이탈 + 칼만 상승 | Page (1954) + Kalman (1960) |
| sell\_cusumKalmanTurn | CUSUM 이탈 + 칼만 하향 | Page (1954) + Kalman (1960) |
| buy\_volRegimeOBVAccumulation | 변동성 고국면 + OBV 괴리 | RiskMetrics + Granville |
| buy\_flowPcrConvergence | 수급 정렬 매수 + PCR/베이시스 | Choe-Kho-Stulz + Pan-Poteshman |
| sell\_flowPcrConvergence | 수급 정렬 매도 + PCR/베이시스 | Choe-Kho-Stulz + Pan-Poteshman |
| buy\_shortSqueezeFlow | 공매도 스퀴즈 + 외국인 수급 | Lamont-Thaler + Kang-Stulz |

#### Tier 3 복합 (4개 정의 --- 약한 확인)

Tier 3은 단일 핵심 조건에 보조 오실레이터 확인이 부가되는 약한 수준의 복합
신호이다. 단독으로 높은 신뢰도를 부여하기 어려우나, 상위 Tier 신호와의
수렴(convergence) 판정 시 보조 근거로 활용된다.

| ID | 구성 요소 | 학술적 연결 고리 | 기본 신뢰도 |
|----|-----------|------------------|-------------|
| buy\_bbBounceRsi | BB 하단 반등 + RSI 과매도 | Bollinger (2001) + Wilder (1978) | 55 |
| sell\_bbBreakoutRsi | BB 상단 돌파 + RSI 과매수 | Bollinger (2001) + Wilder (1978) | 55 |
| buy\_wrStochOversold | Williams %R + 스토캐스틱 과매도 | Williams (1979) + Lane (1984) | 48 |
| sell\_wrStochOverbought | Williams %R + 스토캐스틱 과매수 | Williams (1979) + Lane (1984) | 48 |

---

**윈도우 매개변수**: 모든 복합은 window=$W$=5봉 [D 경험적]을 사용한다.
Nison (1991)의 "수 봉 내 확인" 원칙에 따른 것으로, 5봉(KRX 1거래주)은
신호 수렴에 충분하되 과도하지 않은 시간을 제공한다. 다만, RL 정책 오버라이드
(`backtester._rlPolicy.composite_windows`)가 존재할 경우, 시그널 속도 특성별
최적 윈도우(빠른 신호 3--4봉, 느린 신호 6--7봉)로 동적 대체된다.

**Anti-predictor WR Gate**: Brock-Lakonishok-LeBaron (1992)의 기술적 거래 규칙
수익성 검정에 기반하여, KRX 5개년 실증 방향성 승률(Win Rate)이 48% 미만인
캔들/차트 패턴은 역예측자(anti-predictor)로 분류된다. 48% 임계치는 50% 귀무가설에서
호가 스프레드 및 거래 비용 2pp를 차감한 값이다. 역예측자가 복합 신호의 구성 요소로
포함될 경우, 해당 복합의 신뢰도가 체계적으로 할인된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 개별 신호 생성 (7카테고리) | `signalEngine.analyze()` 내 `_detectMACross`, `_detectMACDSignals`, `_detectRSISignals`, `_detectBBSignals`, `_detectVolumeSignals`, `_detectIchimokuSignals`, `_detectHurstSignal` 등 16개 감지 함수 | 31개 독립 신호 |
| 파생상품/교차자산 신호 | `_detectBasisSignal`, `_detectPCRSignal`, `_detectFlowSignal`, `_detectERPSignal`, `_detectETFSentiment`, `_detectShortInterest` | S-21~S-26 외부 데이터 기반 |
| 캔들 패턴 $\to$ 신호 맵 | `_buildCandleSignalMap(candlePatterns)` | 패턴 $\to$ 신호 타입 인덱스 매핑 |
| 복합 신호 결합 | `_matchComposites()` + `COMPOSITE_SIGNAL_DEFS` (31개) | 3-Tier 복합 신호 매칭 |
| 동시발생 윈도우 | `COMPOSITE_SIGNAL_DEFS[*].window = 5` | Nison 원칙 기반 5봉 |
| RL 정책 윈도우 오버라이드 | `backtester._rlPolicy.composite_windows` | 시그널 속도별 동적 윈도우 |
| 선택 조건 보너스 | `COMPOSITE_SIGNAL_DEFS[*].optionalBonus` (3--5) | $C_{\text{composite}}$ 가산 |
| 역예측자 게이트 | `PATTERN_WR_KRX` + 48% 임계 | Brock-LeBaron 기반 WR 필터 |
| 신뢰도 기본값 | `baseConfidence` 필드 | Tier 1: 58--75, Tier 2: 48--69, Tier 3: 48--55 |
| VIX $\to$ VKOSPI 프록시 | `_VIX_PROXY = 1.12` [C] | Whaley (2009) KRX 스케일 |

\newpage
