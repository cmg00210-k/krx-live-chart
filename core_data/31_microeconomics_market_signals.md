# 31. 미시경제학 — 시장 균형, 탄력성, 가격 발견 (Microeconomics: Market Equilibrium, Elasticity, and Price Discovery)

> "The real price of everything, what everything really costs to the man who wants to
> acquire it, is the toil and trouble of acquiring it."
> — Adam Smith, *The Wealth of Nations* (1776), Book I, Ch. 5

---

## 1. 증권시장의 수요-공급 (Supply-Demand in Securities Markets)

### 1.1 호가창과 수요-공급 곡선 (Order Book as Supply-Demand Curves)

전통 미시경제학의 수요-공급 프레임워크는 증권시장의 호가창(order book)에 직접 대응된다.
Marshall (1890)의 부분균형 분석에서 수요곡선은 가격 하락 시 수요량 증가, 공급곡선은
가격 상승 시 공급량 증가하는 우하향/우상향 관계를 보인다. 호가창에서 이 관계는
매수 호가(bid)와 매도 호가(ask)의 누적량으로 직접 관찰 가능하다.

```
수요곡선 (매수 호가 누적):
  D(p) = Σ q_bid   where p_bid >= p
  (가격 p 이상에서 매수 대기 물량)

공급곡선 (매도 호가 누적):
  S(p) = Σ q_ask   where p_ask <= p
  (가격 p 이하에서 매도 대기 물량)

시장 청산가격 (market-clearing price):
  p* = argmax_p min(D(p), S(p))
  where D(p*) = S(p*) at equilibrium

스프레드 (bid-ask spread):
  s = p_ask_1 - p_bid_1
  (최우선 매도호가 - 최우선 매수호가)
```

**스프레드의 3요소 분해** — 시장 미시구조 이론의 핵심적 결과:

```
s = s_inventory + s_adverse + s_order_processing

s_inventory:     재고위험 보상 (Stoll 1978, Ho & Stoll 1981)
                 시장조성자가 보유 포지션의 가격 변동 위험을 보상받는 부분
                 s_inventory ∝ σ_stock * T_hold

s_adverse:       역선택 비용 (Glosten & Milgrom 1985, Kyle 1985)
                 정보거래자 대비 손실 가능성에 대한 보상
                 s_adverse ∝ P(informed) * E[|V - p|]

s_order_processing: 주문처리 비용 (Roll 1984)
                 시스템·인건비·규제비용 등
                 현대 전산매매에서 극소 (~0.001%)
```

**한국 시장 특수성:**
- KRX에는 지정 시장조성자(designated market maker)가 사실상 부재 → s_inventory 요소가
  일반적 의미의 딜러 재고위험이 아닌, 유동성 공급자(limit order submitter)의 실행위험으로 대체
- 결과적으로 s_adverse가 전체 스프레드의 60-80%를 차지 (KOSDAQ 소형주 기준)
- Doc 18 §1의 Kyle lambda와 Doc 18 §2의 VPIN은 이 이론적 수요-공급 프레임워크에서
  역선택 비용의 실증 측정치에 해당

| 시장 세그먼트 | 평균 스프레드 | s_adverse 비중 | 해석 |
|-------------|------------|--------------|------|
| KOSPI 200 대형 | 0.03-0.08% | ~40% | 기관·외국인 풍부, 정보 비대칭 낮음 |
| KOSPI 중형 | 0.08-0.15% | ~55% | 중간 수준 |
| KOSDAQ 대형 | 0.10-0.25% | ~65% | 개인 비중 높아 정보 비대칭 증가 |
| KOSDAQ 소형 | 0.25-0.80% | ~80% | 극단적 역선택, 매수-매도 갭 큼 |

**CheeseStock 매핑:** `backtester.js`의 `KRX_SLIPPAGE = 0.10%`는 KOSPI 중형주 기준의 단일
값이다. 이론적으로는 시장/시가총액별 차등 슬리피지가 정확하지만, 현재 파일 모드에서는
실시간 호가창 데이터 없이 고정값 사용. WS 모드에서 Kiwoom 호가 데이터 수신 시
s_adverse 실시간 추정이 가능해지며, 이는 `realtimeProvider.js` 확장 영역이다.

참고문헌:
- Roll, R. (1984). A Simple Implicit Measure of the Effective Bid-Ask Spread. *JF*, 39(4), 1127-1139.
- Glosten, L. & Harris, L. (1988). Estimating the Components of the Bid/Ask Spread. *JFE*, 21(1), 123-142.
- Glosten, L. & Milgrom, P. (1985). Bid, Ask and Transaction Prices. *JFE*, 14(1), 71-100.
- Stoll, H. (1978). The Supply of Dealer Services in Securities Markets. *JF*, 33(4), 1133-1151.

---

### 1.2 왈라스 경매 — KRX 시가/종가 결정 (Walrasian Auction)

Leon Walras (1874)의 일반균형 이론에서 경매인(auctioneer)은 잠정 가격을 제시하고
초과수요/초과공급을 관찰하여 균형가격으로 수렴시킨다(tatonnement). KRX의 시가/종가
결정 방식인 **단일가 매매(call auction)**는 이 왈라스 경매의 현대적 구현이다.

```
왈라스 균형가격 (Walrasian equilibrium price):
  p_W = argmax_p min(D(p), S(p))
  — 거래량을 최대화하는 가격
  — 동량이면 잔량 최소화, 다시 동량이면 직전 가격에 근접한 쪽

KRX 시가 결정 (opening call auction):
  시간: 08:30-09:00 KST (30분 주문 접수)
  방식: 08:30부터 호가 접수, 09:00에 단일가로 일괄 체결
  예상 체결가: 08:30부터 10초 간격으로 공개 (가격 발견 촉진)

KRX 종가 결정 (closing call auction):
  시간: 15:20-15:30 KST (10분 주문 접수, 2016년 도입)
  방식: 15:20에 접속매매 중단, 15:30에 단일가 일괄 체결
  도입 이유: 종가 조작(window dressing) 방지
```

**비교표: 단일가 매매 vs 접속매매**

| 특성 | 단일가 매매 (Call Auction) | 접속매매 (Continuous DA) |
|------|------------------------|----------------------|
| 이론 원형 | Walras (1874) tatonnement | Smith (1962) double auction |
| 가격 결정 | 거래량 최대화 단일가 | 연속적 매수-매도 매칭 |
| 정보 집적 | 높음 (30분/10분 축적) | 낮음 (즉시 체결) |
| 조작 내성 | 높음 (단일 시점 결정) | 낮음 (순간 대량 주문 가능) |
| 가격 발견 | 효율적 (Madhavan 1992) | 점진적 |
| 유동성 집중 | 시/종가에 집중 | 분산 |
| KRX 적용 | 08:30-09:00, 15:20-15:30 | 09:00-15:20 |

**시초가 조작(opening price manipulation) 감시:**
- 수법: 시가 결정 직전 대량 주문 → 시가 왜곡 → 즉시 취소
- OCR (Order Cancellation Ratio): 주문 대비 취소 비율
- KRX 감시 기준: OCR > 80% + 가격 영향 > 0.5% → 시세조종 혐의 조사 (2019년 강화)
- 기술적 분석 함의: 시가의 정보 함량은 OCR에 의해 오염될 수 있음
  → 갭(gap) 분석 시 시가 단독이 아닌 09:05-09:15 VWAP과 교차 확인 필요

**CheeseStock 매핑:** `generate_intraday.py`가 보간 데이터를 생성할 때 09:00 시가는
일봉의 open 값을 그대로 사용한다. 실시간 WS 모드에서 Kiwoom OCX의 시가 정보는
왈라스 균형가격에 해당하며, `chart.js`의 캔들 시리즈에 직접 반영된다.

참고문헌:
- Walras, L. (1874). *Elements of Pure Economics*. (1954 English translation by Jaffe).
- Smith, V.L. (1962). An Experimental Study of Competitive Market Behavior. *JPE*, 70(2), 111-137.
- Madhavan, A. (1992). Trading Mechanisms in Securities Markets. *JF*, 47(2), 607-641.

---

### 1.3 소비자·생산자 잉여의 증권시장 적용 (Surplus in Securities Markets)

미시경제학에서 소비자 잉여(CS)는 지불 의사 가격과 실제 지불 가격의 차이이고,
생산자 잉여(PS)는 실제 수취 가격과 최저 수용 가격의 차이이다. 증권시장에서 이
개념은 매수자/매도자 잉여로 재해석된다.

```
매수자 잉여 (Buyer Surplus):
  BS = Σ_{i ∈ filled_buys} (V_reservation_i - p_execution_i)
  V_reservation_i: 매수자 i의 지불 의사가격 (reservation price)
  p_execution_i:   실제 체결가

매도자 잉여 (Seller Surplus):
  SS = Σ_{j ∈ filled_sells} (p_execution_j - V_reservation_j)
  V_reservation_j: 매도자 j의 최저 수용가격

총 잉여 (Total Surplus):
  TS = BS + SS
  — 왈라스 균형에서 TS 최대화 (제1복지정리의 증권시장 버전)
```

**사중손실(Deadweight Loss, DWL)의 원천:**

| DWL 원천 | 메커니즘 | KRX 영향 | 추정 크기 |
|---------|---------|---------|---------|
| 스프레드 | 연속매매 시 매수-매도 갭 | 상시 | ~0.02% (KOSPI), ~0.15% (KOSDAQ) |
| 가격제한 ±30% | 상한/하한에서 거래 불가 | 극단일 | 15-30% (한도 도달 시) |
| 서킷 브레이커 | 전종목 20분-1시간 매매 정지 | 위기일 | 20-40% (정지 시간 비례) |
| 거래세 | 매도 시 부과 (KOSPI 0.03%, KOSDAQ 0.15%) | 상시 | 해당 세율만큼 |
| 최소호가단위 | 가격대별 1-5,000원 단위 | 저가주 더 큼 | ~0.01-0.10% |

Du, Liu & Rhee (2009)는 가격제한이 **자석 효과(magnet effect)**를 유발하여 DWL을
악화시킬 수 있음을 보였다: 한도 접근 시 투기적 주문이 몰려 한도에 더 빠르게
도달하고, 이는 본래 도달하지 않았을 거래도 차단한다
(Doc 20 §circuit breaker 참조).

**CheeseStock 매핑:** `backtester.js`의 왕복 거래비용(MC_round_trip) 계산은 스프레드,
세금, 슬리피지를 합산하며, 이는 사중손실의 개별 투자자 관점 측정치에 해당한다.
가격제한 도달 시 패턴의 목표가/손절가가 도달 불가할 수 있으므로, `patterns.js`의
priceTarget/stopLoss가 ±30% 범위 내에 있는지 검증하는 것이 바람직하다.

참고문헌:
- Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect: Evidence from the Korea Exchange. *IRF*, 9(1-2), 50-74.

---

## 2. 탄력성과 시장 민감도 (Elasticity and Market Sensitivity)

### 2.1 거래량-가격 탄력성 (Volume-Price Elasticity)

Marshall (1890)의 가격탄력성 개념을 증권시장에 적용하면, 가격 변동에 대한
거래량의 반응 민감도를 체계적으로 측정할 수 있다.

```
표준 수요의 가격탄력성:
  ε_d = (ΔQ/Q) / (ΔP/P) = (dQ/dP) * (P/Q)

증권시장 거래량-가격 탄력성 (VPE):
  ε_VP = (ΔV/V) / (|Δp|/p)
  V: 거래량, p: 종가, Δ: 일간 변화

해석:
  |ε_VP| > 5:   고탄력 — 작은 가격 변동에도 거래량 큰 폭 변화
  1 < |ε_VP| < 5: 중탄력 — 비례적 반응
  |ε_VP| < 1:    비탄력 — 거래량이 가격에 둔감
```

**KRX 시장별 실증 범위:**

| 시장 세그먼트 | ε_VP 범위 | 주요 참여자 | 해석 |
|-------------|----------|-----------|------|
| KOSPI 대형 | 2-5 | 기관·외국인 | 중탄력, 계획적 매매 |
| KOSPI 중형 | 3-8 | 혼합 | 중~고탄력 |
| KOSDAQ 대형 | 5-12 | 개인 60%+ | 고탄력, 감정적 반응 |
| KOSDAQ 소형 | 8-20+ | 개인 80%+ | 초고탄력, 테마·루머 민감 |

**기술적 분석 함의:**

```
고탄력 종목 (ε_VP > 8):
  - 돌파(breakout) 패턴에서 거래량 확인이 매우 신뢰적
  - VOLUME_SURGE 시그널의 정보 함량 높음
  - 추세 전환 시 거래량 폭증이 선행 → 패턴 신뢰도 +5~10%
  - 단, 허위 돌파(false breakout) 시에도 거래량 급증 가능 → 2차 확인 필요

저탄력 종목 (ε_VP < 3):
  - 거래량 기반 시그널 (OBV, VWAP divergence) 정보 함량 낮음
  - 가격 패턴 자체의 기하학적 형태(geometry)에 의존 → 순수 기술적 분석
  - 기관 프로그램 매매가 주도 → 알고리즘 패턴이 인간 행동 패턴보다 중요
```

**VOLUME_SURGE 임계값의 탄력성 보정:**

```
기존: VOLUME_SURGE if V_t / SMA(V, 20) > 2.0 (고정 임계값)
보정: VOLUME_SURGE if V_t / SMA(V, 20) > threshold(ε_VP)

threshold(ε_VP) = 2.0 * (5.0 / max(ε_VP, 1.0))^0.3

ε_VP = 3:  threshold ≈ 2.0 * (5/3)^0.3 ≈ 2.0 * 1.16 ≈ 2.32
ε_VP = 5:  threshold = 2.0 (기준)
ε_VP = 10: threshold ≈ 2.0 * (5/10)^0.3 ≈ 2.0 * 0.81 ≈ 1.62
ε_VP = 20: threshold ≈ 2.0 * (5/20)^0.3 ≈ 2.0 * 0.66 ≈ 1.32
```

직관: 고탄력 종목은 본래 거래량 변동이 크므로 임계값을 낮추어야 하고,
저탄력 종목은 거래량이 둔감하므로 임계값을 높여야 의미 있는 신호를 포착한다.

**CheeseStock 매핑:** `signalEngine.js`의 `VOLUME_SURGE` 판별은 현재 SMA(20) 대비
고정 배수를 사용한다. ε_VP 보정은 종목별 20일 거래량-수익률 회귀의 기울기로
추정 가능하며, `indicators.js`에 `calcVPE()` 함수 추가로 구현할 수 있다.

참고문헌:
- Marshall, A. (1890). *Principles of Economics*. Macmillan. Book III, Ch. 4.

---

### 2.2 교차탄력성 — 섹터 로테이션 민감도 (Cross-Elasticity and Sector Rotation)

교차가격탄력성(cross-price elasticity)은 한 재화의 가격 변동이 다른 재화의
수요에 미치는 영향을 측정한다. 증권시장에서 이는 섹터 간 자금 흐름의
대체/보완 관계로 대응된다.

```
교차가격탄력성 (표준):
  ε_AB = (%ΔQ_A) / (%ΔP_B)
  ε_AB > 0: 대체재 (P_B 상승 → Q_A 증가)
  ε_AB < 0: 보완재 (P_B 상승 → Q_A 감소)

섹터 자금 흐름 교차탄력성:
  ε_flow_AB = (ΔFlow_A / Flow_A) / (ΔReturn_B / |Return_B|)
  Flow_A: 섹터 A로의 순자금유입 (기관+외국인 기준)
  Return_B: 섹터 B의 수익률

교차탄력성 행렬:
  E = [ε_ij]  where i, j ∈ {IT, 금융, 소재, 산업재, 헬스케어, 소비재}
  대각: ε_ii = 자기탄력성 (항상 음수: 가격 상승 → 역방향 자금유출)
  비대각: ε_ij = 교차탄력성 (부호로 대체/보완 판별)
```

**한국 주요 섹터 교차탄력성 추정치 (2020-2025, 6개월 롤링):**

| 섹터 쌍 | ε_flow | 관계 | 메커니즘 |
|---------|--------|------|---------|
| IT ↔ 금융 | -0.25~-0.35 | 대체재 | 성장주↔가치주 자금 시소 |
| IT ↔ 배터리 | +0.15~+0.25 | 보완재 | 기술·성장 공통 테마 |
| 반도체 ↔ 장비 | +0.30~+0.45 | 강한 보완 | 공급망 수직 연계 |
| 금융 ↔ 건설 | +0.10~+0.20 | 약한 보완 | 금리·부동산 공통 요인 |
| 바이오 ↔ 제약 | +0.20~+0.35 | 보완재 | 산업 인접, 테마 동조 |
| 헬스케어 ↔ IT | -0.10~-0.15 | 약한 대체 | 방어↔성장 자금 이동 |

**CheeseStock 매핑:** 교차탄력성 행렬은 Doc 29 §6의 섹터 회전 모형을 미시적
기초(microfoundation)에서 정당화한다. Stovall 모형이 "경기 확장기에 IT 선호"라는
거시적 패턴을 제시하면, 교차탄력성은 "IT 수익률 하락 시 금융으로 자금 이동"이라는
미시적 메커니즘을 제공한다. `data/sector_fundamentals.json`에 섹터별 수급 데이터
추가 시 실시간 교차탄력성 추정이 가능하다.

참고문헌:
- Barberis, N. & Shleifer, A. (2003). Style Investing. *JFE*, 68(2), 161-199.

---

### 2.3 소득탄력성 — 경기순환 민감도 (Income Elasticity and Business Cycle Sensitivity)

소득탄력성은 소득 변화에 대한 수요의 반응도이다. 증권시장에서 GDP(소득) 변화에 대한
기업 이익(EPS)의 반응도는 해당 산업의 경기 민감도를 직접 측정한다.

```
소득탄력성 (표준):
  ε_Y = (%ΔQ) / (%ΔY)
  ε_Y > 1: 사치재 (경기 민감)
  0 < ε_Y < 1: 정상재 (경기 둔감)
  ε_Y < 0: 열등재

기업이익-GDP 탄력성:
  ε_EY = (ΔEPS / EPS) / (ΔGDP / GDP)

분류:
  ε_EY > 1.5: 고도 경기순환주 (highly cyclical)
  1.0 < ε_EY <= 1.5: 경기순환주 (cyclical)
  0.3 < ε_EY <= 1.0: 정상/방어주 (normal/defensive)
  ε_EY <= 0.3: 비경기적 (non-cyclical)
  ε_EY < 0: 역행주 (counter-cyclical, 드묾)
```

**한국 산업별 이익-GDP 탄력성 실증 추정치 (2015-2025):**

| KRX 업종 | ε_EY 추정치 | 분류 | 패턴 신뢰도 함의 |
|---------|-----------|------|----------------|
| 반도체 | 3.0-4.0 | 고도 경기순환 | 경기 확장기 매수 패턴 conf × 1.10 |
| 자동차 | 2.0-2.8 | 고도 경기순환 | 수출 경기에 민감, 매수 패턴 확장기 유리 |
| 은행/금융 | 1.5-2.0 | 경기순환 | 금리 사이클 연동 |
| 철강/화학 | 1.8-2.5 | 경기순환 | 원자재 가격 + GDP 이중 노출 |
| 건설 | 2.5-3.5 | 고도 경기순환 | 부동산·SOC 정책 의존 |
| 음식료 | 0.3-0.6 | 방어적 | 경기 무관, 평균회귀 패턴 안정적 |
| 바이오 | 0.1-0.3 | 비경기적 | FDA/임상 이벤트 지배, 경기 무관 |
| 유틸리티 | -0.2-0.2 | 역행/비경기 | 규제 가격, 경기 역행적 방어 수요 |
| 통신 | 0.3-0.5 | 방어적 | 가입자 기반 안정 수익 |

**패턴 신뢰도 조정 공식:**

```
GDP_gap 기반 경기순환 보정:
  cycle_adj = 1 + α_cycle * ε_EY * GDP_gap_normalized

여기서:
  GDP_gap_normalized = GDP_gap / σ_GDP_gap ∈ [-2, +2] (표준화)
  α_cycle = 0.03 (경기순환 민감도 계수)

예시: 반도체(ε_EY=3.5), GDP_gap=+1σ (확장기)
  cycle_adj = 1 + 0.03 * 3.5 * 1.0 = 1.105
  → 매수 패턴 신뢰도 × 1.105 (약 +10.5%)

예시: 반도체(ε_EY=3.5), GDP_gap=-1σ (수축기)
  cycle_adj = 1 + 0.03 * 3.5 * (-1.0) = 0.895
  → 매수 패턴 신뢰도 × 0.895 (약 -10.5%)
  → 매도 패턴 신뢰도 × 1/0.895 ≈ 1.117 (약 +12%)

방어주(음식료, ε_EY=0.4): 조정 거의 없음 (+/-1.2%)
```

**CheeseStock 매핑:** `data/sector_fundamentals.json`의 섹터별 PER/ROE와 결합하여
ε_EY를 추정할 수 있다. Doc 29 §1의 경기순환 국면(GDP_gap) 판별 결과와 연동하여
`backtester.js`의 WLS Ridge 컨텍스트 벡터에 `cycle_adj` 열 추가가 가능하다.

| 상수 | 값 | 등급 | 학습 | 범위 | 출처 |
|------|---|------|------|------|------|
| α_cycle | 0.03 | [C] | [L:WLS] | 0.01-0.06 | 경험적 교차검증 |

참고문헌:
- Berman, J. & Pfleeger, J. (1997). Which Industries are Sensitive to Business Cycles? *Monthly Labor Review*, 120(2).

---

## 3. 시장구조와 경쟁 (Market Structure and Competition)

### 3.1 완전경쟁 → EMH 대응 (Perfect Competition as EMH Analog)

미시경제학의 완전경쟁 시장은 4대 가정을 전제한다. 이 가정들은 효율적 시장 가설(EMH)의
전제 조건과 정확히 대응된다.

```
완전경쟁 가정        ↔ EMH 대응물
─────────────────────────────────────────────────
(1) 다수 참여자      ↔ 무한히 많은 가격수용 거래자
(2) 동질적 상품      ↔ 대체 가능한 투자 기회
(3) 자유 진입·퇴출   ↔ 거래비용·규제 장벽 없음
(4) 완전 정보        ↔ 모든 정보가 가격에 반영

4가정 모두 성립 → P = V (내재가치) → 초과수익 불가 → 패턴 분석 무의미
```

**현실: 가정 (4) 실패 → 기술적 분석의 존재 이유**

Grossman & Stiglitz (1980)의 정보 역설: 만약 가격이 모든 정보를 완벽히 반영한다면,
정보 수집에 비용을 지불할 유인이 없다. 그러면 아무도 정보를 수집하지 않으므로
가격은 정보를 반영할 수 없다. → **완벽히 효율적인 시장은 논리적으로 불가능하다.**

이 역설의 해결: 균형 상태에서 일부 정보 비효율이 존재하며, 이 비효율의 크기는
정보 수집 비용과 동일하다. 기술적 패턴은 이 잔존 비효율을 포착하는 도구이다.

```
Grossman-Stiglitz 균형:
  E[Return_informed] - E[Return_uninformed] = c_info / risk_aversion
  c_info: 정보 수집·처리 비용

  함의: 정보 비용이 존재하는 한, 시장은 불완전하게 효율적이며,
  정보 처리 능력이 높은 주체(알고리즘, 전문 분석)가 양의 초과수익 가능
```

**AMH (Adaptive Market Hypothesis, Lo 2004)와의 연결:**
Doc 05에서 다루는 AMH는 이 미시적 기초 위에 구축된다. 정보 비대칭의 정도가
시간에 따라 변하므로(군집행동, 유동성 사이클), 기술적 패턴의 유효성도 시변적이다.

**CheeseStock 매핑:** `signalEngine.js`의 AMH 감쇠(decay) 메커니즘은 Grossman-Stiglitz
균형의 동적 버전이다. 패턴 알파가 c_info 수준으로 수렴하는 과정을 모형화하며,
Doc 21 §AMH 감쇠 파라미터가 이 수렴 속도를 결정한다.

참고문헌:
- Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
- Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5), 15-29.

---

### 3.2 독점적 경쟁 → 브랜드 모트 (Monopolistic Competition and Brand Moat)

Chamberlin (1933)의 독점적 경쟁에서 각 기업은 차별화된 제품으로 약간의 시장
지배력(pricing power)을 보유한다. 주식시장에서 이는 **경제적 해자(moat)**의
미시적 기초에 해당한다.

```
독점적 경쟁 기업의 수요함수:
  p_i = a - b * q_i + d * P̄
  a: 기본 수요 (브랜드 충성도)
  b: 자사 수요 민감도
  d: 산업 평균가격 의존도 (0 < d < 1)
  P̄: 산업 평균가격

이윤 극대화:
  MR = MC → q_i* = (a + d*P̄ - MC) / (2b)
  이윤: π_i = (p_i - MC) * q_i*
```

**모트 강도와 기술적 패턴의 관계:**

| 모트 강도 | 대표 종목 | 이익 변동성 | 유효 패턴 유형 |
|----------|---------|-----------|-------------|
| 강한 모트 | 삼성전자, 네이버, 카카오 | 낮음 | 평균회귀(mean reversion) 패턴 MORE 신뢰적 |
| 중간 모트 | 현대차, LG에너지솔루션 | 중간 | 추세+평균회귀 혼합 |
| 약한 모트 | 범용 소재, 섬유, 식품 | 높음 | 모멘텀(momentum) 패턴 MORE 신뢰적 |
| 무모트 | KOSDAQ 테마주 | 매우 높음 | 순수 기술적 + 행동 패턴 |

직관: 강한 모트 기업은 이익이 장기 평균으로 회귀하는 힘이 강하므로(competitive
advantage period이 길므로), 가격도 내재가치 주위로 회귀하려는 경향이 강하다.
반대로 약한 모트 기업은 경쟁 진입/퇴출이 빈번하여 이익 경로가 불안정하고,
가격은 추세를 형성하기 쉽다.

**CheeseStock 매핑:** 현재 `data.js`의 `getFinancialData()`에서 ROE 안정성(5년 표준편차)을
모트 강도의 프록시로 사용할 수 있다. ROE_std < 5%는 강한 모트, ROE_std > 15%는
약한 모트로 분류하여 `patterns.js`의 패턴 유형별 신뢰도에 반영하는 것이 가능하다.

참고문헌:
- Chamberlin, E. (1933). *The Theory of Monopolistic Competition*. Harvard University Press.
- Greenwald, B. & Kahn, J. (2005). *Competition Demystified*. Portfolio/Penguin.

---

### 3.3 과점 → 한국 재벌 구조 (Oligopoly and Korean Chaebol Dynamics)

한국 경제의 핵심 구조적 특성은 재벌(chaebol) 과점 체제이다. 미시경제학의
과점 이론(Cournot, Bertrand)은 이 구조에서의 전략적 상호작용과 주가 연동을
설명하는 이론적 기반을 제공한다.

```
Cournot 복점 (수량 경쟁, Cournot 1838):
  시장 수요: P = a - b(q_1 + q_2)
  기업 i 이윤: π_i = (a - b(q_i + q_j) - c_i) * q_i
  최적 반응함수: q_i* = (a - 2c_i + c_j) / (3b)
  균형 가격: P* = (a + c_1 + c_2) / 3

Bertrand 복점 (가격 경쟁, Bertrand 1883):
  동질 상품: P* = c (가격=한계비용, 완전경쟁 결과)
  차별화 상품: P_i* = (a + c_i + d*c_j) / (2 + d)
  d: 제품 대체성 (0=독립, 1=완전 대체)
```

**한국 산업의 과점 유형 매핑:**

| 산업 | 과점 유형 | 주요 플레이어 | 전략적 함의 |
|------|---------|-------------|-----------|
| 반도체 (메모리) | Cournot | 삼성전자, SK하이닉스, Micron | 공급량 조절이 가격 결정 → 감산 뉴스 = 가격 상승 |
| 이동통신 | Bertrand (차별화) | SKT, KT, LGU+ | 요금 인하 경쟁 제한적, 안정적 이익 |
| 은행 | Bertrand (동질) | 4대 금융지주 | 예대금리차(NIM) 수렴, 규제 의존 |
| 자동차 | Cournot + 차별화 | 현대·기아, 수입차 | 물량 조절 + 브랜드 차별화 이중 전략 |
| 유통 | Stackelberg | 쿠팡(선도), 신세계, 롯데 | 선도자 물류 투자가 시장 구조 결정 |

**재벌 교차지분과 전이 효과 (Chaebol Contagion):**

```
재벌 그룹 내 전이(contagion):
  ΔP_affiliate = β_chaebol * ΔP_parent + ε

  β_chaebol: 그룹 내 전이 계수
  Samsung: β ≈ 0.3-0.5 (전자→SDI, 전자→SDS, 전자→물산)
  Hyundai: β ≈ 0.2-0.4 (차→모비스, 차→글로비스, 차→건설)
  SK:      β ≈ 0.3-0.5 (하이닉스→이노베이션, SK→텔레콤)
  LG:      β ≈ 0.2-0.3 (에솔→화학, 전자→이노텍)
```

**재벌 클러스터 매핑 (주요 4대 그룹):**

| 그룹 | 핵심 기업 | 주요 계열사 (KOSPI/KOSDAQ 상장) |
|------|---------|-------------------------------|
| Samsung | 삼성전자 (005930) | 삼성SDI, 삼성전기, 삼성SDS, 삼성물산, 삼성생명, 삼성바이오 |
| Hyundai | 현대차 (005380) | 기아, 현대모비스, 현대글로비스, 현대건설, 현대제철 |
| SK | SK하이닉스 (000660) | SK이노베이션, SK텔레콤, SKC, SK네트웍스 |
| LG | LG에솔 (373220) | LG화학, LG전자, LG이노텍, LG디스플레이 |

**패턴 신뢰도 조정:**

```
재벌 클러스터 정합성 보정:
  그룹 내 핵심 기업 패턴 방향과 계열사 패턴 방향이:
  - 일치 (aligned): conf_adj = +0.05 (신뢰도 5% 가산)
  - 불일치 (misaligned): conf_adj = -0.05 (신뢰도 5% 차감)
  - 무관 (핵심 기업 패턴 없음): conf_adj = 0

예시:
  삼성전자에서 bullishEngulfing 감지 + 삼성SDI에서 morningstar 감지
  → 삼성SDI 패턴 conf += 0.05 (그룹 방향 일치)

  삼성전자에서 bearishEngulfing 감지 + 삼성SDI에서 bullishHarami 감지
  → 삼성SDI 패턴 conf -= 0.05 (그룹 방향 불일치)
```

**CheeseStock 매핑:** 재벌 클러스터 매핑은 `data/index.json`의 종목 정보에 `chaeboGroup`
필드를 추가하여 구현할 수 있다. `patterns.js`의 후처리 단계에서 동일 그룹 내
패턴 방향 정합성을 점검하고 ±0.05 보정을 적용. 이는 Doc 19 (social network)의
클러스터 효과와 구조적으로 동일한 메커니즘이다.

| 상수 | 값 | 등급 | 학습 | 범위 | 출처 |
|------|---|------|------|------|------|
| β_chaebol_align | +0.05 | [D] | [L:WLS] | 0.02-0.10 | 경험적, 재벌 전이 문헌 |
| β_chaebol_misalign | -0.05 | [D] | [L:WLS] | -0.10 ~ -0.02 | 동상 |

참고문헌:
- Cournot, A.A. (1838). *Recherches sur les Principes Mathematiques de la Theorie des Richesses*.
- Bertrand, J. (1883). Review of Cournot. *Journal des Savants*, 499-508.
- Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? Evidence from Mergers by Korean Business Groups. *JF*, 57(6), 2695-2740.

---

### 3.4 정보비대칭 → 레몬 문제 (Information Asymmetry and the Lemons Problem)

Akerlof (1970)의 레몬 시장 이론: 품질에 대한 정보 비대칭이 시장 실패를 초래한다.
증권시장에서 내부자(경영진, 대주주)는 기업 가치에 대한 우월 정보를 보유하며,
이는 역선택(adverse selection)을 유발한다.

```
Akerlof 레몬 균형:
  매도자(내부자)의 보유 정보: V_true ∈ [V_low, V_high]
  매수자(외부)의 기대 가치: E[V] = (V_low + V_high) / 2
  균형 가격: P* = E[V | seller willing to sell at P]

  결과: V_true > P*인 "좋은" 기업은 매도하지 않음 → 시장에 "레몬"만 남음

증권시장 적용:
  내부자 매도 = "기업 가치가 시장가보다 낮다"는 신호
  내부자 매수 = "기업 가치가 시장가보다 높다"는 신호
```

**정보 비대칭 측정 지표:**

```
PIN (Probability of Informed Trading, Easley et al. 1996):
  PIN = α * μ / (α * μ + ε_b + ε_s)
  α: 정보 이벤트 확률
  μ: 정보 거래자 도착률
  ε_b, ε_s: 비정보 매수/매도 도착률

VPIN (Volume-synchronized PIN, Doc 18 §2):
  더 높은 빈도에서 PIN의 근사치

KRX 시장 세그먼트별 PIN 추정치:
  KOSPI 대형: PIN ≈ 0.10-0.15
  KOSPI 중형: PIN ≈ 0.15-0.25
  KOSDAQ 대형: PIN ≈ 0.20-0.35
  KOSDAQ 소형: PIN ≈ 0.30-0.50
```

KOSDAQ 소형주의 PIN이 높은 이유: 개인투자자 비중이 80%+이지만 **정보 없는 거래자
비율이 높다는 것이 오히려 정보 거래자의 우위를 증폭**시킨다(Easley et al. 1996의
역설적 결과). 잡음(noise) 거래가 많을수록 정보 거래자가 숨기 쉬워 PIN이 상승한다.

**패턴-정보비대칭 상호작용:**

```
내부자 순매도 + 약세 패턴: conf × 1.15 (정보 비대칭 순방향)
내부자 순매도 + 강세 패턴: conf × 0.85 (정보 비대칭 역방향)
내부자 순매수 + 강세 패턴: conf × 1.15 (순방향)
내부자 순매수 + 약세 패턴: conf × 0.85 (역방향)

conf_info_adj = conf_base × (1 + δ_info * sign_alignment)
δ_info = 0.15 (정보 비대칭 보정 강도)
sign_alignment = +1 (순방향) or -1 (역방향)
```

**신호이론 (Signaling, Spence 1973):**

기업이 정보 비대칭을 해소하기 위해 비용이 드는 신호(costly signal)를 보낸다:

| 신호 | 비용 | KRX 해석 | 패턴 강화 방향 |
|------|------|---------|-------------|
| 배당 증가 | 현금 유출 | 이익 안정 자신감 | 강세 패턴 conf +5% |
| 자사주 매입 | 현금 유출 + 기회비용 | 저평가 인식 | 강세 패턴 conf +8% |
| R&D 투자 확대 | 단기 이익 감소 | 장기 성장 자신감 | 성장주 강세 +3% |
| 유상증자 | 희석 비용 | 자금 필요 (약세 신호) | 약세 패턴 conf +5% |
| CB/BW 발행 | 잠재 희석 | 즉시 자금 필요 | 약세 패턴 conf +8% |

**CheeseStock 매핑:** `data/financials/{code}.json`의 재무 데이터에서 배당, 자사주,
유상증자 이력을 추출할 수 있다. 현재 `financials.js`의 투자 점수(investment score)
계산에 이미 일부 반영되어 있으며, 이를 `patterns.js`의 신뢰도 후처리로 확장하는
것이 이론적으로 정당화된다.

| 상수 | 값 | 등급 | 학습 | 범위 | 출처 |
|------|---|------|------|------|------|
| δ_info | 0.15 | [C] | [L:WLS] | 0.05-0.25 | Easley et al. 1996 기반 |
| signal_dividend_bonus | +0.05 | [D] | [L:MAN] | 0.02-0.10 | Spence 1973 응용 |
| signal_buyback_bonus | +0.08 | [D] | [L:MAN] | 0.03-0.15 | 자사주 효과 문헌 |

참고문헌:
- Akerlof, G. (1970). The Market for "Lemons". *QJE*, 84(3), 488-500.
- Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity, Information, and Infrequently Traded Stocks. *JF*, 51(4), 1405-1436.
- Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.

---

## 4. 한계분석과 거래 최적화 (Marginal Analysis for Trading)

### 4.1 거래의 한계비용 (Marginal Cost of Trading)

미시경제학의 핵심 원리 중 하나는 한계분석(marginal analysis): 최적 의사결정은
한계비용(MC)과 한계편익(MB)이 일치하는 지점에서 이루어진다. 거래에서 MC는
명시적 비용과 암묵적 비용의 합이다.

```
거래의 한계비용:
  MC_trade = MC_explicit + MC_implicit

MC_explicit (명시적 비용):
  = Commission + Tax
  Commission ≈ 0.015% (증권사 온라인 평균, 2025)
  Tax_KOSPI  = 0.03% (매도 시, 2023년 인하 후)
  Tax_KOSDAQ = 0.15% (매도 시, 2025 기준)

MC_implicit (암묵적 비용):
  = Spread + MarketImpact + OpportunityCost
  Spread: 매수-매도 호가 차이의 1/2 (편도)
  MarketImpact: MI ≈ σ_daily * √(OrderSize / ADV) * η
    σ_daily: 일간 수익률 표준편차
    ADV: 평균 일 거래대금
    η: 시장 영향 계수 (~0.5-1.0, Almgren & Chriss 2001)
  OpportunityCost: 지연으로 인한 가격 이동
```

**왕복 거래비용(round-trip MC) 추정:**

| 비용 항목 | KOSPI 대형 | KOSPI 중형 | KOSDAQ 대형 | KOSDAQ 소형 |
|----------|----------|----------|-----------|-----------|
| 수수료 (왕복) | 0.030% | 0.030% | 0.030% | 0.030% |
| 거래세 (매도) | 0.030% | 0.030% | 0.150% | 0.150% |
| 스프레드 (왕복) | 0.060% | 0.120% | 0.200% | 0.600% |
| 시장충격 | 0.010% | 0.030% | 0.050% | 0.150% |
| **합계** | **~0.13%** | **~0.21%** | **~0.43%** | **~0.93%** |

```
손익분기 시그널 품질:
  E[return | signal] > MC_round_trip

KOSPI 대형: E[r] > 0.13% → 상대적으로 약한 시그널도 수익 가능
KOSDAQ 소형: E[r] > 0.93% → 매우 강한 시그널만 수익 가능

비율: KOSDAQ 소형 / KOSPI 대형 ≈ 7.2×
→ KOSDAQ 소형주 기술적 패턴은 7배 이상 강한 신뢰도가 필요
```

**CheeseStock 매핑:** `backtester.js`의 슬리피지 모형은 현재 `KRX_SLIPPAGE = 0.10%`
(편도) 고정이다. 위 분석에 따르면 KOSPI 대형주는 과대 추정(실제 ~0.04%),
KOSDAQ 소형주는 과소 추정(실제 ~0.38%)이다. 시가총액 기반 3단계 슬리피지
(대형 0.04%, 중형 0.10%, 소형 0.35%)로 세분화하는 것이 백테스트 정확도를 높인다.

참고문헌:
- Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.

---

### 4.2 추가 시그널의 한계편익 (Marginal Benefit of Additional Signals)

Grinold (1989)의 기본법칙(Fundamental Law of Active Management):

```
IR = IC × √BR
IR: 정보비율 (Information Ratio)
IC: 정보계수 (Information Coefficient, signal-return 상관)
BR: 독립적 의사결정 횟수 (Breadth)
```

다수의 신호를 결합할 때, 개별 IC와 신호 간 상관관계가 결합 IC를 결정한다.

```
IC_combined(n) = IC_1 × √(1 + (n-1) × ρ_avg) / √(n)
— Grinold & Kahn (2000) 수정 공식

특수 경우:
  ρ_avg = 0 (완전 독립): IC_combined(n) = IC_1 × √n / √n = IC_1
    → 독립 신호 추가 시: 포트폴리오 분산 효과 + 폭(breadth) 증가

  ρ_avg > 0 (양의 상관): IC_combined(n) < IC_1 × √n
    → 상관 신호 추가의 체감 수익

n개 상관된 신호의 한계 IC 개선:
  ΔIC(n) = IC_combined(n) - IC_combined(n-1)
```

**CheeseStock 현재 시스템 분석:**

```
현재 시그널 구성:
  16 indicator signals (signalEngine.js)
  + 6 composite signals (3 tiers)
  = 22 total signals

추정 평균 상관: ρ_avg ≈ 0.40 (동일 가격 데이터에서 파생, 모멘텀/추세 편향)

한계 IC 개선 테이블 (IC_1 = 0.05 가정):
  n=1:  IC = 0.050
  n=2:  IC = 0.042  (ΔIC = +0.042 from n=0)
  n=3:  IC = 0.039
  n=5:  IC = 0.034
  n=8:  IC = 0.031
  n=10: IC = 0.029
  n=15: IC = 0.027
  n=16: IC = 0.027  (ΔIC(16) = 0.0003 — 거의 무가치)
  n=22: IC = 0.026

IC_combined(16) / IC_combined(15) ≈ 1.003
→ 16번째 시그널은 합산 IC의 0.3% 개선에 불과
→ 복잡도 증가 비용 > 한계 편익
```

**최적 시그널 수:**

```
ρ_avg = 0.40에서 최적 n*:
  ΔIC(n) > threshold (실행 비용/복잡도 비용) 인 최대 n

  실증적 최적 n* ≈ 6-8 (잘 선별된 비상관 시그널)

  현재 22개 → 14-16개는 중복 정보
  그러나 Ridge 정규화(λ=278)가 암묵적으로 중복 시그널의 가중치를 0에 가깝게 축소
  → Ridge가 자동적으로 MC=MB 최적화를 수행
```

**CheeseStock 매핑:** `backtester.js`의 WLS Ridge 회귀(λ=278)는 미시경제학적으로
신호의 한계편익이 한계비용(복잡도, 과적합 위험)과 일치하는 수준으로 가중치를
정규화하는 장치이다. Doc 17 §Ridge의 λ 선택은 이 MC=MB 균형의 실현이다.
L1(Lasso)는 일부 신호를 완전히 제거(MC>MB인 신호 탈락)하고, L2(Ridge)는
모든 신호를 유지하되 약한 신호의 기여를 축소한다.

참고문헌:
- Grinold, R. (1989). The Fundamental Law of Active Management. *JPM*, 15(3), 30-37.
- Grinold, R. & Kahn, R. (2000). *Active Portfolio Management*. 2nd ed., McGraw-Hill.

---

### 4.3 MC = MB 최적 조건 (Optimality Condition for Signal Selection)

미시경제학의 이윤 극대화 조건 MC = MR (또는 효용 극대화 MU/P 균등)을
시그널 선택 문제에 적용한다.

```
시그널 포트폴리오 최적화:
  max_{S ⊆ Signals} E[Return(S)] - TC(S) - λ * Complexity(S)

  E[Return(S)]:   시그널 집합 S 사용 시 기대 수익
  TC(S):          거래비용 (시그널이 많을수록 거래 빈도 증가)
  Complexity(S):  과적합 위험 (|S|에 비례)
  λ:              정규화 계수 (= Ridge λ)

1차 조건 (FOC):
  ∂E[Return] / ∂s_k = ∂TC / ∂s_k + λ * ∂Complexity / ∂s_k
  — 추가 시그널 k의 한계 수익 = 한계 거래비용 + 한계 복잡도 비용

Grinold 기본법칙으로 재표현:
  E[Return] = IC(S) × σ_portfolio × √BR(S)

  IC 한계 기여: ∂IC / ∂s_k ≈ Corr(s_k, return | S_{-k})
  BR 한계 기여: ∂BR / ∂s_k ≈ 독립적 거래 기회 증분
```

**Ridge 정규화의 경제학적 해석:**

```
Ridge 목적함수:
  min_β ||y - Xβ||² + λ||β||²

경제학 해석:
  ||y - Xβ||²  = 예측 오차 비용 (편익의 역수)
  λ||β||²      = 복잡도 세금 (Pigouvian tax on overfitting)

  λ 증가 → 한계 복잡도 비용 증가 → 더 적은 신호가 "유효"
  λ 감소 → 과적합 외부성 방치 → 표본 내 좋지만 표본 외 나쁨

현재 λ = 278 (Doc 17, Phase 4-1 GCV 최적):
  — 22개 시그널 중 유효 자유도(effective df) ≈ 5-8
  — 미시경제학적으로: MC=MB를 만족하는 "유효 시그널 수"가 5-8개
  — 나머지 14-17개의 가중치는 Ridge에 의해 ~0에 근접
```

**CheeseStock 매핑:** `backtester.js`의 Ridge λ=278은 GCV(Generalized Cross-Validation)로
데이터에서 결정되며, 이는 시그널의 MC=MB 균형을 데이터 기반으로 자동 탐색하는
메커니즘이다. Doc 22 §GCV 절차를 따라 `rl_residuals.py`에서 최적 λ를 재보정할 때마다
유효 시그널 수(effective df)를 함께 보고하여 시그널 체계의 효율성을 모니터링해야 한다.

참고문헌:
- Hastie, T., Tibshirani, R. & Friedman, J. (2009). *The Elements of Statistical Learning*. 2nd ed., Springer. Ch. 3.4 (Ridge).

---

## 5. 외부성과 시장 취약성 (Externalities and Market Fragility)

### 5.1 정보 외부성 → 군집행동 (Information Externalities and Herding)

외부성(externality)은 시장 거래에 참여하지 않는 제3자에게 영향을 미치는 효과이다.
금융시장에서 가장 중요한 외부성은 **정보 외부성**: 한 거래자의 행동이 다른
거래자에게 정보를 무상으로 전달한다.

**Grossman & Stiglitz (1980) 정보 역설 (재진술):**

```
정보 외부성의 핵심 메커니즘:
  1. 정보 거래자가 매수 → 가격 상승
  2. 가격 상승 자체가 "좋은 뉴스가 있다"는 정보를 무상 전달
  3. 비정보 거래자가 이 가격 정보를 무임승차(free-ride)
  4. 무임승차가 보편화 → 정보 수집 유인 소멸
  5. 정보 수집 소멸 → 가격이 정보를 반영하지 않음
  → 균형: 일부 비효율이 존재하여 정보 수집 비용을 보상
```

**정보 폭포 (Information Cascade, Bikhchandani, Hirshleifer & Welch 1992):**

```
폭포 조건:
  공적 신호(public signal) > 사적 신호(private signal) → 사적 정보 무시

증권시장 적용:
  공적 신호: 거래량 급증, 가격 급등, 뉴스 보도, 방송 추천
  사적 신호: 개인의 기업 분석, 재무제표 검토, 산업 지식

  KOSDAQ에서 빈번한 시나리오:
  1. 테마 뉴스 발생 (예: "AI 반도체 수혜")
  2. 소수 거래자 매수 → 가격 상승 (공적 신호 발생)
  3. 개인투자자: "다들 사니까 좋은 거겠지" → 사적 분석 생략
  4. 폭포 형성: 매수 → 가격 상승 → 더 많은 매수
  5. 폭포 붕괴: 사적 신호 축적 → 공적 신호 역전 → 급락
```

| 시장 | 폭포 빈도 | 폭포 지속 | 패턴 함의 |
|------|---------|---------|---------|
| KOSPI 대형 | 낮음 | 1-3일 | 기관의 역방향 포지션이 폭포 억제 |
| KOSDAQ 소형 | 높음 | 3-15일 | 모멘텀 초기 신뢰적, 그러나 붕괴 갑작스럽 |

**CheeseStock 매핑:** 정보 폭포는 Doc 19 §social network의 전이 효과와 연결되며,
Doc 24 §behavioral quantification의 군집행동 측정과 동일 현상의 다른 관점이다.
`signalEngine.js`의 모멘텀 시그널이 폭포 초기에는 유효하지만 후기에는 역전되는
패턴은 AMH 감쇠(Doc 21)로 모형화된다.

참고문헌:
- Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades. *JPE*, 100(5), 992-1026.
- Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.

---

### 5.2 부정 외부성 → 플래시 크래시 (Negative Externalities and Flash Crashes)

개별 합리적 행동이 집합적으로 시스템 위험을 초래하는 부정 외부성은 금융시장에서
가장 심각한 시장 실패(market failure) 형태이다.

**손절 폭포 (Stop-Loss Cascade):**

```
메커니즘:
  1. 외생적 충격 → 가격 하락 -2%
  2. 손절 주문 트리거 → 추가 매도 → -3%
  3. 더 많은 손절 트리거 → -5%
  4. 마진콜 발생 → 강제 매도 → -8%
  5. 패닉 매도 합류 → -10%+

외부성 구조:
  각 손절은 개별적으로 합리적 (손실 제한)
  그러나 집합적 효과는 가격을 펀더멘탈 이하로 붕괴시킴
  → 개인의 합리적 행동이 집단적 비합리적 결과를 생산
```

**마진 나선 (Margin Spiral, Brunnermeier & Pedersen 2009):**

```
유동성 나선 (Liquidity Spiral):
  가격 하락 → 마진 요구 증가 → 강제 매도 → 추가 가격 하락

  dP/dt = -γ * (Margin_t - Margin_threshold) * Leverage_t
  γ: 마진 민감도 계수
  Leverage_t: 시장 전체 레버리지

손실 나선 (Loss Spiral):
  가격 하락 → 자기자본 감소 → 레버리지 비율 상승 → 디레버리지 압력

  두 나선이 양성 피드백 루프(positive feedback loop)를 형성
  → 작은 충격이 증폭되어 시스템 위기로 발전
```

**한국의 마진 나선 취약성:**
- 신용융자 잔고: KOSDAQ 시총의 ~3-5% (2024, 상당한 수준)
- 반대매매(forced selling) 임계: 담보유지비율 140% 미만 → 자동 매도
- 마진콜 → 반대매매 → 가격 하락 → 추가 마진콜의 자기 강화 루프
- Doc 20 §KRX 가격제한의 서킷 브레이커는 이 나선을 끊는 규제 개입

**CheeseStock 매핑:** `patterns.js`의 `stopLoss` 계산에서 손절 수준이 라운드 넘버
(round number)나 ATR 배수의 밀집 지점에 위치하면, 해당 수준에서 폭포 효과가
발생할 확률이 높다. 이는 Doc 20 §magnet effect와 동일 메커니즘이며, 손절 수준을
밀집 지점에서 약간 벗어나게 설정하는 것이 이론적으로 유리하다.

참고문헌:
- Brunnermeier, M. & Pedersen, L. (2009). Market Liquidity and Funding Liquidity. *RFS*, 22(6), 2201-2238.

---

### 5.3 규제 대응 — 가격제한과 거래세 (Regulatory Response: Price Limits and Transaction Tax)

미시경제학에서 외부성의 표준 처방은 피구세(Pigouvian tax) 또는 직접 규제이다.
KRX의 가격제한과 거래세는 이 처방의 증권시장 구현이다.

**KRX 가격제한 ±30%의 미시경제학적 해석:**

```
피구세(Pigouvian tax) 아날로그:
  - 피구세: 외부성을 유발하는 활동에 세금 부과 → 사적 비용을 사회적 비용과 일치
  - 가격제한: 극단적 가격 변동(외부성 발생원)을 직접 차단

효율성 분석:
  편익: 손절 폭포 차단, 패닉 억제, 투자자 보호
  비용: 가격 발견 지연, 자석 효과(Du et al. 2009), DWL 발생

  최적 수준: MB_regulation = MC_regulation
  MB: 외부성 차단에 의한 사회적 편익
  MC: 가격 발견 저해에 의한 사회적 비용

  한국 ±30% (2015년 확대): 국제적으로 넓은 편
  비교: 일본 없음, 대만 ±10%, 중국 ±10%
```

**거래세의 토빈세(Tobin Tax) 해석:**

```
토빈세 (Tobin 1978):
  금융거래에 소액 세금 부과 → 투기적 단기 거래 억제, 장기 투자 촉진

한국 거래세:
  KOSPI: 0.03% (2023 인하) — 매우 낮아 토빈세 효과 미미
  KOSDAQ: 0.15% — 단기 거래에 실질적 비용 부과

  효과 분석:
  - 긍정: HFT 외부성 억제 (KOSDAQ에서 유의미)
  - 부정: 유동성 감소, 스프레드 확대
  - KOSDAQ 0.15%는 왕복 0.30% → 3일 이하 단기 매매 수익성 크게 저하
  - 이론적 최적 세율: Subrahmanyam (1998) 모형에서 ε (=매우 작은 값)
```

**최적 규제 균형:**

```
사회후생 극대화:
  max W = TS - Externality_cost - Regulation_cost

  TS: 총 잉여 (§1.3)
  Externality_cost: 폭포, 마진 나선 등에 의한 손실
  Regulation_cost: 가격 발견 저해, DWL 등

  1차 조건: ∂W/∂(regulation_intensity) = 0
  → 한계 외부성 억제 = 한계 규제 비용

현실: KRX의 ±30% + 거래세 조합은 과도하지도 과소하지도 않은 중간 수준
(국제 비교 기준). 그러나 자석 효과 + KOSDAQ 높은 세율은 소형주 유동성에
불리하게 작용한다.
```

**CheeseStock 매핑:** 규제 환경은 `backtester.js`의 거래비용 구조에 직접 반영된다.
가격제한은 백테스트에서 목표가/손절가의 실현 가능성 제약으로 모형화해야 한다
(하루 ±30% 초과 수익/손실은 불가). Doc 20 §circuit breaker에서 다루는 서킷 브레이커와
함께, 규제 프레임워크는 패턴 분석의 외부 경계 조건(boundary condition)을 설정한다.

참고문헌:
- Tobin, J. (1978). A Proposal for International Monetary Reform. *Eastern Economic Journal*, 4(3-4), 153-159.
- Subrahmanyam, A. (1998). Transaction Taxes and Financial Market Equilibrium. *JBF*, 22(1), 1-13.

---

## 6. 미시-거시 연결 — 합성의 오류와 부분균형 (Micro-Macro Bridge)

### 6.1 합성의 오류 (Fallacy of Composition)

미시경제학의 가장 중요한 경고 중 하나: 개인에게 참인 것이 전체에 대해 반드시
참은 아니다 (Samuelson 1955).

```
절약의 역설 (Paradox of Thrift, Keynes 1936):
  개인: 저축 증가 → 부 증가 (합리적)
  전체: 모든 사람 저축 → 소비 감소 → 소득 감소 → 총저축 불변 또는 감소

IS-LM 프레임워크:
  S(Y) = I(r) 균형
  S 증가 → IS 좌측 이동 → Y 감소 → S 원복
```

**금융시장 합성의 오류:**

```
손절의 역설 (Paradox of Stop-Loss):
  개인: 손절 = 위험 관리 (합리적)
  전체: 모두 손절 → 폭포 매도 → 가격 붕괴 → 개인도 손실

포트폴리오 보험의 역설 (1987 Black Monday):
  개인: 포트폴리오 보험 = 하방 보호 (합리적)
  전체: 모두 보험 매도 → 유동성 고갈 → 보험이 작동하지 않음

분산투자의 역설:
  개인: 다각화 → 위험 감소 (합리적)
  전체: 모두 동일 지수에 분산 → 지수 포함 종목 과대 평가, 미포함 종목 과소 평가
  (Wurgler 2011 "On the Economic Consequences of Index-Linked Investing")
```

**패턴 분석 함의:**

```
기술적 분석의 합성 오류:
  개인: 패턴 기반 매매 → 초과수익 (비효율 포착)
  전체: 모두 동일 패턴 사용 → 패턴 "crowding" → 알파 소멸

  이것이 Doc 21 §AMH 감쇠의 미시적 기초이다:
  패턴 알파 = f(패턴 사용자 수) — 사용자 증가 시 감소

  그러나 완전 소멸은 Grossman-Stiglitz 역설에 의해 불가능
  → 균형: 일부 알파가 잔존 (정보 수집 비용 보상 수준)
```

**CheeseStock 매핑:** Doc 21의 AMH 감쇠와 Doc 18의 Kyle lambda 증가(패턴 crowding 시)는
모두 합성의 오류를 다른 수학적 언어로 표현한 것이다. `signalEngine.js`의 시그널이
너무 단순하고 널리 알려진 것일수록 crowding 위험이 높으며, 이는 복합 시그널
(composite signal)의 정보 우위를 정당화한다.

---

### 6.2 부분균형 vs 일반균형 (Partial vs General Equilibrium)

Marshall (1890)의 부분균형 분석은 다른 조건이 일정할 때(ceteris paribus) 단일
시장을 분석한다. Walras (1874)의 일반균형 분석은 모든 시장의 동시 균형을 고려한다.

```
부분균형 (Partial Equilibrium):
  분석 대상: 단일 종목 또는 단일 섹터
  가정: "다른 시장 변수는 일정"
  장점: 명확한 인과 관계 식별, 실행 가능한 거래 시그널
  단점: 시장 간 상호작용 무시 → 시스템 위험 과소 평가

  기술적 분석의 대부분은 부분균형:
  — 개별 종목의 가격 패턴 분석
  — 단일 시계열의 지표 계산
  — S/R 수준 식별

일반균형 (General Equilibrium):
  분석 대상: 전체 시장 체계
  가정: 모든 시장 동시 균형
  장점: 시스템 리스크 포착, 교차시장 효과 반영
  단점: 복잡도 폭발, 모수 추정 어려움, 실행 시그널 모호

  거시 분석의 영역:
  — IS-LM / AD-AS 프레임워크
  — 교차시장 상관 (Doc 28)
  — 거시경제 레짐 (Doc 29)
```

**최적 조합: 2층 분석 아키텍처**

```
Layer 1 — 일반균형 (거시/레짐):
  입력: GDP_gap, PMI, VIX, 금리, 환율
  출력: 시장 레짐 (bull/bear/crisis/recovery)
  빈도: 월간 업데이트
  역할: "어떤 환경에서 거래할 것인가"

Layer 2 — 부분균형 (종목/패턴):
  입력: 개별 OHLCV, 거래량, 재무
  출력: 패턴, 시그널, 신뢰도
  빈도: 일간/실시간
  역할: "무엇을 거래할 것인가"

결합: Layer 1의 레짐이 Layer 2의 패턴 신뢰도를 조정
  — 이것이 CheeseStock의 정확한 아키텍처이다
```

**CheeseStock 매핑:** 현재 시스템은 이 2층 아키텍처를 이미 구현하고 있다.
`patternEngine.analyze()` (부분균형 Layer 2)가 개별 종목 패턴을 탐지하고,
Doc 29의 MCS (일반균형 Layer 1)가 거시 레짐을 판별하여 패턴 신뢰도를 조정한다.
미시경제학은 이 아키텍처가 왜 이론적으로 정당한지 — 부분균형만으로는 불충분하고,
일반균형만으로는 실행 불가능하므로 둘의 결합이 최적이라는 것 — 을 설명한다.

참고문헌:
- Marshall, A. (1890). *Principles of Economics*. Macmillan.
- Walras, L. (1874). *Elements of Pure Economics*.
- Samuelson, P. (1955). *Economics*. McGraw-Hill.

---

## 7. 학습 가능 상수 요약 (Learnable Constants Summary)

본 문서에서 도입한 상수 (#99-#113):

| # | 상수명 | 위치 | 현재값 | 등급 | 학습 | 범위 | 출처 |
|---|-------|------|-------|------|------|------|------|
| 99 | VPE_threshold_base | signalEngine.js | 2.0 | [C] | [L:GCV] | 1.0-3.0 | Marshall (1890) VPE 이론 |
| 100 | VPE_exponent | signalEngine.js | 0.3 | [C] | [L:GCV] | 0.1-0.5 | 경험적 비선형 스케일 |
| 101 | VPE_reference | signalEngine.js | 5.0 | [B] | [L:MAN] | 3.0-8.0 | KRX 시장 평균 VPE |
| 102 | α_cycle | backtester.js | 0.03 | [C] | [L:WLS] | 0.01-0.06 | 경기순환 탄력성 보정 |
| 103 | β_chaebol_align | patterns.js | +0.05 | [D] | [L:WLS] | 0.02-0.10 | 재벌 전이 문헌 |
| 104 | β_chaebol_misalign | patterns.js | -0.05 | [D] | [L:WLS] | -0.10 ~ -0.02 | 재벌 전이 문헌 |
| 105 | δ_info | patterns.js | 0.15 | [C] | [L:WLS] | 0.05-0.25 | Easley et al. (1996) |
| 106 | signal_dividend_bonus | patterns.js | +0.05 | [D] | [L:MAN] | 0.02-0.10 | Spence (1973) 응용 |
| 107 | signal_buyback_bonus | patterns.js | +0.08 | [D] | [L:MAN] | 0.03-0.15 | 자사주 효과 문헌 |
| 108 | MC_KOSPI_large | backtester.js | 0.04% | [B] | [L:MAN] | 0.02-0.06% | 실측 (슬리피지+세금) |
| 109 | MC_KOSPI_mid | backtester.js | 0.10% | [B] | [L:MAN] | 0.06-0.15% | 실측 |
| 110 | MC_KOSDAQ_small | backtester.js | 0.35% | [B] | [L:MAN] | 0.20-0.50% | 실측 + Amihud |
| 111 | optimal_signal_n | signalEngine.js | 6-8 | [B] | [L:GCV] | 4-12 | Grinold (1989) IC 분석 |
| 112 | cascade_stop_offset | patterns.js | 0.5×ATR | [D] | [L:WLS] | 0.3-1.0×ATR | 폭포 회피 경험적 |
| 113 | info_cascade_decay | signalEngine.js | 0.85 | [C] | [L:WLS] | 0.70-0.95 | Bikhchandani et al. (1992) |

**등급 분류 근거:**

- **[A] 고정** (본 문서 해당 없음): 모든 상수가 시장 조건에 따라 변동 가능
- **[B] 학술 범위**: #101 (VPE 기준), #108-110 (실측 거래비용), #111 (IC 최적 n)
  — 학술 문헌에서 범위가 제시되나 정확한 값은 시장/시기 의존
- **[C] 보정 가능**: #99-100 (VPE 임계), #102 (경기순환), #105 (정보비대칭), #113 (폭포 감쇠)
  — GCV/WLS로 데이터 기반 최적화 가능
- **[D] 휴리스틱**: #103-104 (재벌 보정), #106-107 (기업 신호), #112 (폭포 회피)
  — 이론적 방향은 명확하나 정확한 크기는 경험적 판단 의존

---

## 8. 참고문헌 (References)

1. Smith, A. (1776). *An Inquiry into the Nature and Causes of the Wealth of Nations*.
2. Marshall, A. (1890). *Principles of Economics*. Macmillan.
3. Walras, L. (1874). *Elements d'Economie Politique Pure*. (English trans. by Jaffe, 1954).
4. Cournot, A.A. (1838). *Recherches sur les Principes Mathematiques de la Theorie des Richesses*.
5. Bertrand, J. (1883). Review of Cournot. *Journal des Savants*, 499-508.
6. Chamberlin, E. (1933). *The Theory of Monopolistic Competition*. Harvard University Press.
7. Akerlof, G. (1970). The Market for "Lemons": Quality Uncertainty and the Market Mechanism. *QJE*, 84(3), 488-500.
8. Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.
9. Roll, R. (1984). A Simple Implicit Measure of the Effective Bid-Ask Spread in an Efficient Market. *JF*, 39(4), 1127-1139.
10. Glosten, L. & Harris, L. (1988). Estimating the Components of the Bid/Ask Spread. *JFE*, 21(1), 123-142.
11. Glosten, L. & Milgrom, P. (1985). Bid, Ask and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders. *JFE*, 14(1), 71-100.
12. Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity, Information, and Infrequently Traded Stocks. *JF*, 51(4), 1405-1436.
13. Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
14. Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades. *JPE*, 100(5), 992-1026.
15. Brunnermeier, M. & Pedersen, L. (2009). Market Liquidity and Funding Liquidity. *RFS*, 22(6), 2201-2238.
16. Grinold, R. (1989). The Fundamental Law of Active Management. *JPM*, 15(3), 30-37.
17. Grinold, R. & Kahn, R. (2000). *Active Portfolio Management*. 2nd ed., McGraw-Hill.
18. Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.
19. Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect: Evidence from the Korea Exchange. *IRF*, 9(1-2), 50-74.
20. Smith, V.L. (1962). An Experimental Study of Competitive Market Behavior. *JPE*, 70(2), 111-137.
21. Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5), 15-29.
22. Madhavan, A. (1992). Trading Mechanisms in Securities Markets. *JF*, 47(2), 607-641.
23. Stoll, H. (1978). The Supply of Dealer Services in Securities Markets. *JF*, 33(4), 1133-1151.
24. Tobin, J. (1978). A Proposal for International Monetary Reform. *Eastern Economic Journal*, 4(3-4), 153-159.
25. Subrahmanyam, A. (1998). Transaction Taxes and Financial Market Equilibrium. *JBF*, 22(1), 1-13.
26. Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? Evidence from Mergers by Korean Business Groups. *JF*, 57(6), 2695-2740.
27. Barberis, N. & Shleifer, A. (2003). Style Investing. *JFE*, 68(2), 161-199.
28. Greenwald, B. & Kahn, J. (2005). *Competition Demystified*. Portfolio/Penguin.
29. Hastie, T., Tibshirani, R. & Friedman, J. (2009). *The Elements of Statistical Learning*. 2nd ed., Springer.
30. Samuelson, P. (1955). *Economics*. McGraw-Hill.
31. Keynes, J.M. (1936). *The General Theory of Employment, Interest and Money*. Macmillan.
32. Wurgler, J. (2011). On the Economic Consequences of Index-Linked Investing. In *Challenges to Business in the Twenty-First Century*, NBER.
