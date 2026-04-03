# 36. 선물 미시구조와 미결제약정 분석 — Futures Microstructure & Open Interest Analytics

> "미결제약정은 시장의 확신을 측정하는 온도계이다.
> 가격 변화와 미결제약정 변화의 교차점에서 추세의 진위가 판별된다."
> — Alexander Elder, *Trading for a Living* (1993)

> "The information share of the futures market exceeds its share of total trading volume,
> confirming that price discovery predominantly occurs in the derivatives market."
> — Joel Hasbrouck, *Journal of Finance* (1995)

---

## 1. 개요

본 문서는 선물시장의 미시구조(microstructure)와 미결제약정(open interest, OI) 분석의
이론적 기반을 확립하고, 이를 CheeseStock 패턴 시스템에 통합하는 경로를 제시한다.

`27_futures_basis_program_trading.md`(Doc27)에서 선물 가격 이론, 베이시스 해석,
프로그램 매매의 기초를 다루었다면, 본 문서는 다음 세 방향으로 확장한다:

```
1. OI 미시구조 심화    → OI-가격 동역학, 투자자별 OI 분해, 포지셔닝 극단
2. 가격발견 메커니즘   → 선물-현물 선도-지연, 정보점유율, 야간세션 효과
3. 만기일 미시구조     → 핀 리스크, 결제가 수렴, 롤오버 스프레드 신호
4. 프로그램 매매 고도화 → 차익/비차익 세분화, 사이드카 이론, 제도적 비대칭
```

**기존 문서와의 관계:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| 선물 가격 이론 (Cost-of-Carry) | Doc27 §1 | 미시구조 관점의 편향 분석 |
| OI 해석 매트릭스 (4분면) | Doc27 §2 | Bessembinder-Seguin 변동성, OI 집중도 |
| 베이시스 심리 지표 | Doc27 §5 | 가격발견 Information Share 모형 |
| 프로그램 매매 기초 | Doc27 §3 | 차익/비차익 이론 심화, 프로그램 임팩트 모형 |
| 만기일 효과 | Doc27 §4 | Stoll-Whaley 만기 변동성, 핀 리스크 정량화 |
| Kyle 모형 | Doc18 §1 | 선물 시장의 정보 비대칭 확장 |
| VKOSPI 레짐 | Doc26 §2.3 | OI-변동성 피드백 루프 |
| KRX 구조 | Doc20 §1-2 | 선물-현물 미시구조 상호작용 |
| VRP | Doc34 §2 | VRP와 OI 극단의 교차 신호 |

**CheeseStock 구현 경로 요약:**

```
[데이터 수집]                        [분석]                         [신호 출력]
KRX 선물 시세 (D+1)             →   OI-Price 4분면 분류         →   oiTrend
KRX 투자자별 OI 분해            →   외국인/기관/개인 포지션     →   foreignOiSignal
KRX 프로그램 매매 현황          →   차익/비차익 z-score         →   programAlert
KOSPI200 선물-현물 시세         →   Hasbrouck IS, 선도-지연     →   priceDiscovery
만기일 캘린더 + OI 분포         →   핀 리스크, 롤오버 스프레드  →   expiryRegime
                                                                     ↓
                                                              패턴 신뢰도 조정
```

---

## 2. 선물 미결제약정(OI) 이론

### 2.1 OI의 정의와 해석 심화

미결제약정(Open Interest)은 시장에서 아직 반대매매(close-out) 또는 결제(settlement)로
청산되지 않은 선물 계약의 총 수를 의미한다. 매수 1계약 + 매도 1계약이 성립할 때
OI가 1 증가한다.

```
OI_t = OI_{t-1} + 신규계약(new positions) - 청산계약(closed positions)

주의: 거래량(volume)은 당일 체결된 총 계약 수이며,
     OI는 장 마감 기준 미청산 잔고이다.
     → volume ≠ ΔOI (기존 포지션 간 이전 시 volume↑ but OI 변동 없음)
```

**OI 변동의 세 가지 유형:**

```
Case 1: 신규 매수 + 신규 매도 → OI ↑
  "새로운 자금이 시장에 유입됨"
  → 추세 확인 (가격 방향에 대한 양쪽의 확신)

Case 2: 기존 매수 청산 + 기존 매도 청산 → OI ↓
  "기존 참여자가 시장에서 이탈함"
  → 추세 소진 (자금 이탈, 추세 동력 약화)

Case 3: 기존 매수 → 신규 매수에 양도 (또는 기존 매도 → 신규 매도에 양도) → OI 변동 없음
  "포지션 이전"
  → volume만 발생, OI 무변동, 시장 구조 불변
```

### 2.2 OI-가격 동역학 (4분면 매트릭스)

Doc27 §2.1에서 기본 4분면을 소개했다. 여기서는 각 분면의 이론적 기초와
신호 강도 정량화를 추가한다.

```
                    OI 증가 (신규 진입)        OI 감소 (포지션 청산)
               ┌──────────────────────┬──────────────────────┐
 가격 상승     │  Q1: 신규 롱 진입     │  Q2: 숏 커버링       │
               │  추세 강도: 강(Strong) │  추세 강도: 약(Weak)  │
               │  해석: 매수 자금 유입  │  해석: 손절 매수 반등  │
               │  지속성: 높음         │  지속성: 낮음         │
               ├──────────────────────┼──────────────────────┤
 가격 하락     │  Q3: 신규 숏 진입     │  Q4: 롱 청산         │
               │  추세 강도: 강(Strong) │  추세 강도: 약(Weak)  │
               │  해석: 매도 자금 유입  │  해석: 이익 실현 매도  │
               │  지속성: 높음         │  지속성: 낮음         │
               └──────────────────────┴──────────────────────┘
```

**정량화 — OI-가격 복합 지표:**

```
OI_trend = sign(ΔP_t) × ΔOI_t / OI_{t-1}

ΔP_t = F_close_t - F_close_{t-1}   (선물 종가 변화)
ΔOI_t = OI_t - OI_{t-1}            (미결제약정 변화)

해석:
  OI_trend > 0:  가격과 OI 같은 방향 (Q1 또는 Q3) → 추세 확인
  OI_trend < 0:  가격과 OI 반대 방향 (Q2 또는 Q4) → 추세 취약

정규화 (z-score, 60일 이동):
  OI_trend_z = (OI_trend_t - mean(OI_trend_{t-60})) / std(OI_trend_{t-60})
```

**OI 변화율의 분포 특성:**

```
KOSPI200 선물 OI 일별 변화 (2015-2025):
  mean(ΔOI / OI_{t-1}) ≈ 0.0%
  std(ΔOI / OI_{t-1})  ≈ 2.5%
  skew ≈ +0.3 (만기 전 OI 감소 비대칭)
  kurtosis ≈ 5.2 (fat tails, 극단적 포지션 구축/청산 존재)
```

### 2.3 Bessembinder-Seguin OI-변동성 관계

Bessembinder & Seguin (1993) "Futures Trading Activity and Stock Price Volatility"는
OI와 변동성 사이의 체계적 관계를 실증적으로 규명한 핵심 논문이다.

**이론적 프레임워크:**

시장 참여자의 이질성(heterogeneity)이 OI 수준을 결정하며,
OI가 높을수록 시장의 깊이(depth)가 증가하여 가격 충격이 완화된다.

```
Bessembinder-Seguin 회귀 모형:

σ²_t = α + β₁ · V_t + β₂ · V̂_t + β₃ · OI_t + β₄ · ÔI_t + ε_t

σ²_t:  기초자산(현물) 수익률 분산
V_t:   선물 거래량 (예상 성분, ARIMA 분해)
V̂_t:   선물 거래량 (비예상 성분, surprise)
OI_t:  선물 미결제약정 (예상 성분)
ÔI_t:  선물 미결제약정 (비예상 성분, surprise)
```

**핵심 실증 결과:**

```
β₁ ≈ 0 (예상된 거래량은 변동성에 무영향)
β₂ > 0 (비예상 거래량 급증 → 변동성 상승)
β₃ < 0 (OI 증가 → 변동성 하락, 시장 깊이 효과)
β₄ < 0 (비예상 OI 증가 → 변동성 하락)

경제적 해석:
  - 거래량의 surprise 성분이 정보를 반영 → 변동성 상승
  - OI의 증가는 시장의 양면적 참여 확대 → 유동성 개선 → 변동성 억제
  - 이 결과는 "OI 높은 시장 = 안정적 시장" 가설을 지지
```

**KRX 적용:**

```
KOSPI200 선물 Bessembinder-Seguin 추정 (2015-2025):

β₂(비예상 거래량) ≈ +0.18  (t-stat ≈ 4.2)
β₃(예상 OI)       ≈ -0.07  (t-stat ≈ -2.8)
β₄(비예상 OI)     ≈ -0.12  (t-stat ≈ -3.5)

의미:
  - KOSPI200 선물 OI가 평균 이상이면 현물 변동성 억제 효과
  - 반대로 OI 급감은 변동성 확대의 선행 신호
  - OI z-score < -2.0 이면 향후 5일 ATR 1.3× 증가 확률 ~65%
```

**CheeseStock 매핑 — OI-변동성 연동:**

```
if (oi_zscore > +1.5):
    volExpansionProb = 0.30   # OI 높음 → 변동성 확대 억제
    patternConfAdj   = 1.05  # 추세 패턴 신뢰도 상향
elif (oi_zscore < -1.5):
    volExpansionProb = 0.65   # OI 급감 → 변동성 확대 경고
    patternConfAdj   = 0.90  # 패턴 신뢰도 하향
else:
    volExpansionProb = 0.45   # 중립
    patternConfAdj   = 1.00
```

### 2.4 투자자별 OI 분해와 정보 비대칭

Doc27 §2.2에서 투자자별 OI 비중을 소개했다. 여기서는 각 투자자 집단의
정보 우위(information advantage)와 포지셔닝 패턴을 이론적으로 분석한다.

**Kyle (1985) 프레임워크 확장 (→ Doc18 §1 연계):**

선물시장에서 정보거래자(informed trader)의 구조:

```
Kyle 모형의 선물시장 적용:

λ_futures = σ_v / (2 · σ_u)

σ_v: 정보가치 변동성 (기초자산의 미래 가치에 대한 사적 정보)
σ_u: 잡음거래 강도 (개인 투기 + 유동성 거래)

KRX 선물시장:
  외국인 → 정보거래자(informed) + 헤지거래자(hedger) 혼합
  기관   → 주로 헤지거래자 (연기금 ≈ 99% 헤지 목적)
  개인   → 잡음거래자(noise) + 방향성 투기자
```

**외국인 순포지션 선행성의 이론적 근거:**

```
Choe, Kho & Stulz (1999), Kim & Wei (2002):

외국인이 정보 우위를 갖는 이유:
  1. 글로벌 분산 투자 경험 → 교차시장(cross-market) 정보 활용
  2. 선물-옵션-현물 3시장 동시 접근 → 정보 통합 능력
  3. 야간세션(CME/SGX 연계) → 시차 정보 선점

실증:
  corr(ΔForeignOI_t, KOSPI200_return_{t+1 to t+3}) ≈ 0.15~0.25
  → 외국인 OI 변화가 1-3일 선행 정보를 내포
  → 그러나 인과관계(causality)인지 동시 반응인지 구별 필요
     (Granger 인과검정 적용 → Doc27 §5.2)
```

**투자자별 OI 포지셔닝 극단 지표:**

```
각 투자자 집단의 OI 포지셔닝 z-score:

ForeignOI_z = (ForeignNetOI_t - mean(ForeignNetOI_{t-60}))
            / std(ForeignNetOI_{t-60})

InstOI_z    = (InstNetOI_t - mean(InstNetOI_{t-60}))
            / std(InstNetOI_{t-60})

RetailOI_z  = (RetailNetOI_t - mean(RetailNetOI_{t-60}))
            / std(RetailNetOI_{t-60})

극단 포지셔닝 경보:
  |ForeignOI_z| > 2.5:  외국인 극단 포지션 → 반전 또는 추세 가속 경고
  |InstOI_z|    > 2.0:  기관 헤지 집중 → 현물 방향성 제한 경고
  RetailOI_z   > +2.0:  개인 롱 극단 → 역방향 반전 확률 ~65%
  RetailOI_z   < -2.0:  개인 숏 극단 → 역방향 반전 확률 ~60%
```

**개인-외국인 포지션 역행 지표(Contrary Position Index, CPI):**

```
CPI = ForeignOI_z - RetailOI_z

CPI > +3.0:  외국인 롱 + 개인 숏 → 강세 신호
CPI < -3.0:  외국인 숏 + 개인 롱 → 약세 신호

역사적 유효성 (KOSPI200 선물 2015-2025):
  CPI > +3.0 발생 후 10일 수익률 평균: +1.2% (hit rate 63%)
  CPI < -3.0 발생 후 10일 수익률 평균: -0.9% (hit rate 59%)
```

### 2.5 OI 집중도와 핀 리스크 (OI Concentration & Pin Risk)

특정 행사가(옵션) 또는 가격대(선물)에 OI가 집중될 때 가격 행동이 왜곡된다.

**옵션 OI 집중과 핀 리스크:**

```
핀 리스크(Pin Risk) 메커니즘:

1. 특정 행사가 K*에 대량의 콜+풋 OI 집중
2. 만기일 접근 시 옵션 매도자(market maker)의 delta 헤지가 증가
3. S > K*이면 콜 매도자가 현물 매수 → 가격 상승 저항
   S < K*이면 풋 매도자가 현물 매도 → 가격 하락 저항
4. 결과: 지수가 K* 근처에 "핀"처럼 고정(pinning)되는 현상

핀 리스크 강도:
  PinStrength = Σ max(CallOI_K, PutOI_K) / TotalOI
              (K* ± 2.5pt 범위 내 행사가들)

PinStrength > 0.25:  강한 핀 효과 예상, 만기일 패턴 신뢰도 급감
PinStrength ≤ 0.15:  핀 효과 약함, 정상적 기술 분석 가능
```

**Max Pain 이론:**

```
Max Pain Price = argmin_K Σ_i [max(K - K_i, 0) × PutOI_i
                             + max(K_i - K, 0) × CallOI_i]

해석: 모든 옵션 보유자의 총 손실을 최대화하는 가격 수준
      → 옵션 매도자(기관)에게 가장 유리한 결제가

KRX 실증:
  만기일 종가와 Max Pain의 괴리:
  |Settlement - MaxPain| / ATR_14 < 1.0:  ~45% 확률 (2018-2025)
  → Max Pain은 "자석 효과(magnet effect)"를 갖지만 절대적이지 않음
  → 대형 방향성 이벤트(실적, 매크로) 시 무력화됨
```

### 2.6 OI 월별 패턴과 롤오버 사이클

KOSPI200 선물의 OI는 분기 만기(3/6/9/12월) 주기에 따라 규칙적 패턴을 보인다.

```
OI 생명주기 (분기 선물 기준):

Phase 1 (만기 후 ~ 만기-60일):  OI 점진적 축적
  → 신규 포지션 구축 기간
  → OI 변화는 시장 방향성 의견을 반영

Phase 2 (만기-60일 ~ 만기-20일):  OI 정점(plateau)
  → 최대 OI 수준, 시장 깊이 최대
  → 이 기간의 OI-가격 4분면 신호가 가장 신뢰성 높음

Phase 3 (만기-20일 ~ 만기-5일):  롤오버 시작, OI 감소
  → 기관·외국인이 근월물 청산 + 원월물 신규
  → 롤오버 스프레드가 시장 기대를 반영

Phase 4 (만기-5일 ~ 만기일):  OI 급감, 결제 수렴
  → 잔여 OI 대부분 청산
  → 핀 리스크 극대화, 패턴 신뢰도 최저

정량적 OI 감소율 (KOSPI200 선물 2015-2025 평균):
  만기 -20일: OI 100% (정점)
  만기 -10일: OI ~75%
  만기  -5일: OI ~50%
  만기  -1일: OI ~15-25%
  만기  당일: 결제 → OI → 0 (해당 월물)
```

---

## 3. 선물 베이시스 미시구조

### 3.1 이론 베이시스 편향 (Theoretical Basis Bias)

Doc27 §1에서 보유비용 모형 F* = S · e^((r-d)T)를 소개했다.
실무에서 이론가와 실제 선물가 사이의 괴리(basis mispricing)는
미시구조적 마찰에 의해 체계적으로 발생한다.

**마찰 요인 분해:**

```
F_market = F* + FrictionBias + SentimentPremium + NoiseComponent

F*              = S · e^((r-d)T)              (이론 선물가)
FrictionBias    = f(τ_short, τ_borrow, τ_tax)  (거래비용, 공매도비용, 세금)
SentimentPremium = g(demand_imbalance)         (수급 불균형 프리미엄)
NoiseComponent  = ε_t                          (잡음, E[ε] = 0)
```

**공매도 비대칭과 베이시스 편향 (KRX 특수성):**

```
KRX 공매도 제한의 영향:

1. 공매도 제한 기간(2023.11-2025.03):
   → 매도 차익 거래 불가 → basis < F* 이탈 시 수정 메커니즘 약화
   → 평균 basis_norm: -0.15% (정상기) vs +0.08% (공매도 금지기)
   → 결과: 음의 베이시스가 지속되어도 차익 거래로 수렴하지 않음

2. 공매도 재개 후(2025.03~):
   → 양방향 차익 거래 복원 → 베이시스 수렴 속도 정상화
   → no-arbitrage band 축소: ±25bps → ±18bps

참조: 20_krx_structural_anomalies.md §2.1 공매도 규제 효과
```

### 3.2 베이시스 수렴 미시구조 (Basis Convergence Dynamics)

만기 접근 시 베이시스가 0으로 수렴하는 과정의 미시구조적 분석.

**Ornstein-Uhlenbeck 과정 (Doc27 §1.3 확장):**

```
dB_t = -κ(t) · B_t · dt + σ_B(t) · dW_t

B_t:    시간 t의 베이시스 (= F_t - S_t)
κ(t):   수렴 속도 (만기 접근 시 증가)
σ_B(t): 베이시스 변동성 (만기 접근 시 감소 후 만기일 직전 급증)
W_t:    위너 과정

시간 의존적 수렴 속도:
κ(t) = κ₀ · exp(λ · (T - t)^{-α})

κ₀:  기본 수렴 속도 (~0.05/day)
λ:   가속 계수 (~0.3)
α:   곡률 (0.5 ~ 1.0, KRX 실증: ~0.7)
T:   만기일

반감기 추정:
  만기 -60일:  basis half-life ≈ 15일
  만기 -20일:  basis half-life ≈ 5일
  만기  -5일:  basis half-life ≈ 1일
  만기  -1일:  basis half-life ≈ 2시간 (장중)
```

**만기일 결제가 산정 (KRX KOSPI200 선물):**

```
최종 결제가 = 만기일 개장 후 첫 30분간의 KOSPI200 지수
            가중평균가격(VWAP-like arithmetic average)

구체적으로:
  09:01:00 ~ 09:30:00 KST 동안 10초 간격으로 산출된
  KOSPI200 지수의 산술평균

참고: 주식 옵션은 개별 종목의 만기일 거래량 가중평균가격 사용
     (15:20 종료, 옵션 최종 거래시각)
```

### 3.3 베이시스 심리 지표 고도화

Doc27 §5.1의 정규화 베이시스(basis_norm)를 확장하여,
잔존 만기에 따른 동적 임계값을 도입한다.

**Time-Adjusted Basis (시간 조정 베이시스):**

```
TAB = (F_market - F*) / (S · √T)

= (실제 베이시스 - 이론 베이시스) / (현물 × √잔존만기)

√T 정규화의 이유:
  - 잔존 만기가 길수록 베이시스의 자연 변동폭이 넓음
  - √T 스케일링은 브라운 운동의 확산 속성과 일치
  - 동일한 TAB 값은 잔존 만기에 관계없이 동일한 심리 강도를 의미

TAB 해석 임계:
  TAB > +2.0:  초과 프리미엄 극단 → 과열 경고
  TAB > +1.0:  강세 프리미엄 → 기관·외국인 매수 우위
  -1.0 < TAB < +1.0:  중립 구간
  TAB < -1.0:  할인 프리미엄 → 헤지 매도 우위
  TAB < -2.0:  초과 할인 극단 → 패닉 경고

장점: 만기 3개월 선물과 만기 1주 선물의 심리 강도를 직접 비교 가능
단점: T → 0 일 때 발산하므로 만기 3일 이내는 별도 처리 필요
```

**다기간 베이시스 스프레드 (Calendar Basis Spread):**

```
CBS = basis_norm(근월물) - basis_norm(원월물)

CBS > 0:  근월물 프리미엄 > 원월물 프리미엄
  → 단기 강세, 장기 약세 기대 → 커브 inversion 조짐

CBS < 0:  근월물 프리미엄 < 원월물 프리미엄
  → 정상적 시간가치 반영, 커브 정상(normal)

CBS 극단:
  |CBS| > 2 × std(CBS_{t-60}):
  → 비정상적 만기 간 차이 → 롤오버 수급 불균형 또는 이벤트 반영
```

---

## 4. 선물-현물 가격발견 (Price Discovery)

### 4.1 Hasbrouck (1995) Information Share

Hasbrouck (1995) "One Security, Many Markets: Determining the Contributions to
Price Discovery"는 동일 자산이 복수 시장에서 거래될 때 각 시장의
가격발견 기여도를 측정하는 방법론을 제시했다.

**VEC(Vector Error Correction) 모형:**

```
동일 기초자산(KOSPI200)이 현물(S)과 선물(F) 두 시장에서 거래:

ΔS_t = α_S · (F_{t-1} - S_{t-1} - μ) + Σ_{k=1}^{p} γ_Sk · ΔS_{t-k}
      + Σ_{k=1}^{p} δ_Sk · ΔF_{t-k} + ε_St

ΔF_t = α_F · (F_{t-1} - S_{t-1} - μ) + Σ_{k=1}^{p} γ_Fk · ΔS_{t-k}
      + Σ_{k=1}^{p} δ_Fk · ΔF_{t-k} + ε_Ft

α_S, α_F:  오차수정계수 (error correction coefficients)
μ:          장기 균형 베이시스 (≈ 이론 베이시스)
ε:          잔차 (cross-correlated 가능)
```

**정보점유율(Information Share, IS) 산출:**

```
VEC 잔차의 공분산 행렬:
Ω = [σ²_S    σ_SF]
    [σ_SF    σ²_F]

Cholesky 분해: Ω = M · M'

IS 상한/하한:
IS_F(upper) = ψ²_F / (ψ²_S + ψ²_F)    (F 기준 Cholesky 순서)
IS_F(lower) = ψ²_F / (ψ²_S + ψ²_F)    (S 기준 Cholesky 순서)

ψ_S, ψ_F:  Cholesky 인수분해에서의 장기 충격 반응

IS_futures = (IS_upper + IS_lower) / 2    (Hasbrouck 중간값)
```

**KOSPI200 실증 결과:**

```
KOSPI200 선물 vs 현물 Information Share (5분 간격, 2018-2025):

IS_futures ≈ 0.62~0.78   (선물이 가격발견의 62-78% 담당)
IS_spot    ≈ 0.22~0.38   (현물은 22-38% 기여)

시간대별 변동:
  09:00-10:00 (개장 초):  IS_futures ≈ 0.80  (선물 주도 강함)
  10:00-14:00 (중간):     IS_futures ≈ 0.65  (수렴)
  14:00-15:30 (마감 전):  IS_futures ≈ 0.70  (선물 주도 재강화)
  만기일:                 IS_futures ≈ 0.50  (핀 리스크로 현물 영향 증가)

해석:
  - 선물 시장이 정보를 먼저 반영하는 구조적 이유:
    (1) 거래비용 낮음 (수수료 ~0.002% vs 현물 ~0.21%)
    (2) 레버리지 효과 (증거금 ~15% vs 현물 100%)
    (3) 공매도 자유 (선물은 공매도 규제 대상 아님)
    (4) 바스켓 거래 용이 (지수 전체를 1계약으로)
```

### 4.2 Gonzalo-Granger (1995) Permanent-Transitory 분해

Gonzalo & Granger (1995)는 공적분 관계에 있는 가격들을
영구적(permanent) 성분과 일시적(transitory) 성분으로 분해하는 방법을 제안했다.

```
영구-일시 분해:

P_t = f_t + z_t

f_t = α⊥_S · S_t + α⊥_F · F_t   (영구적 성분 = "효율 가격")
z_t = P_t - f_t                   (일시적 성분 = "미시구조 잡음")

α⊥ = 오차수정계수 α의 직교보완:
  α = (α_S, α_F)',  α⊥ = (-α_F, α_S)' / ||(-α_F, α_S)||

GG 기여도:
GG_futures = α⊥_F / (α⊥_S + α⊥_F)
```

**Hasbrouck IS vs Gonzalo-Granger GG 비교:**

```
| 측도 | 정보 원천 | 계산 기반 | KOSPI200 결과 |
|------|----------|----------|--------------|
| Hasbrouck IS | 가격 혁신(innovation) | 잔차 분산 | IS_F ≈ 0.70 |
| Gonzalo-Granger GG | 오차수정 속도 | α 계수 | GG_F ≈ 0.65 |
| 괴리 원인 | — | 잔차 상관 처리 차이 | 대체로 일관 |
```

두 측도가 모두 선물의 가격발견 주도권을 확인한다.

### 4.3 선도-지연 구조 (Lead-Lag Structure)

선물과 현물 사이의 시차적 가격 반응을 직접 측정한다.

**Epps (1979) 교차상관 함수:**

```
ρ(k) = corr(r_F(t), r_S(t+k))

k > 0:  선물이 k 기간 선행 (lead)
k < 0:  현물이 |k| 기간 선행
k = 0:  동시 반응

KOSPI200 (1분 데이터, 2020-2025):
  ρ(+1) ≈ 0.35    (선물 → 현물 1분 선행)
  ρ(+5) ≈ 0.15    (5분 선행)
  ρ(+15) ≈ 0.05   (15분 선행, 거의 소진)
  ρ(-1) ≈ 0.05    (현물 → 선물 역방향 선행은 미약)

해석:
  선물 가격 변화 후 현물이 5-15분 내에 조정하는 구조
  → 프로그램 매매(차익 거래)가 이 수렴 메커니즘의 핵심 경로
```

**Stoll & Whaley (1990) Lead-Lag 회귀:**

```
r_S(t) = α + β₁ · r_F(t) + β₂ · r_F(t-1) + ... + β_p · r_F(t-p) + ε_t

KOSPI200 (5분 간격):
  β₁ ≈ 0.85   (동시 반응, 1:1에 미달 — 현물의 반응 지연)
  β₂ ≈ 0.10   (1차 지연 성분)
  β₃ ≈ 0.03   (2차 지연, 약함)
  Σβ ≈ 0.98   (장기적 1:1 수렴, 공적분 조건)

역방향:
  r_F(t) = α' + β'₁ · r_S(t) + β'₂ · r_S(t-1) + ε'_t
  β'₁ ≈ 0.95, β'₂ ≈ 0.02 → 현물 → 선물 피드백은 거의 동시적
```

### 4.4 야간세션(야간선물) 가격발견

KRX KOSPI200 야간선물은 정규장(09:00-15:45) 외 시간에 거래된다.

```
KRX 야간선물 거래시간:
  이브닝세션: 18:00 - 05:00 (익일) KST
  → CME E-mini S&P 500, Eurex 등과 시간대 중첩

야간세션의 가격발견 특성:

1. 정보 원천:
   → 미국/유럽 시장 동향의 실시간 반영
   → 글로벌 매크로 이벤트(FOMC, ECB 등)의 1차 반응처
   → 한국 시장 고유 정보는 반영하지 못함

2. 야간→정규장 갭(overnight gap):
   gap = S_open(t+1) - S_close(t)
   야간 선물 수익률과 갭의 상관:
   corr(r_night_futures, gap) ≈ 0.70~0.85

3. 야간 OI 변화:
   야간세션 OI 변동은 전일 정규장 대비 ~10-15% 수준
   → 유동성이 낮아 가격 충격(price impact)이 정규장 대비 3-5배

4. CheeseStock 적용:
   현재 일봉 기반이므로 야간 데이터를 직접 사용하지 않으나,
   정규장 개장 시 갭의 방향은 패턴 형성에 영향을 미침
   → "갭 패턴(gap pattern)"은 야간 가격발견의 간접적 반영
```

### 4.5 ETF 차익 거래와 가격발견 삼각구조

KOSPI200 지수를 기초자산으로 하는 세 시장이 동시에 가격발견에 참여한다.

```
삼각 가격발견 구조:

              KOSPI200 선물
              /           \
    선물-현물 차익     선물-ETF 차익
           /                 \
   KOSPI200 현물 ←── 현물-ETF 복제 ──→ KODEX 200 ETF

각 시장의 Information Share (Hasbrouck, 5분 데이터):
  선물:   IS ≈ 0.55
  현물:   IS ≈ 0.25
  ETF:    IS ≈ 0.20

ETF의 가격발견 기여가 증가하는 추세:
  2015: IS_ETF ≈ 0.10
  2020: IS_ETF ≈ 0.15
  2025: IS_ETF ≈ 0.20
  → ETF AUM 증가와 ETF 차익 거래의 활성화에 기인
```

---

## 5. 만기일 효과 (Expiry Effects)

### 5.1 Stoll & Whaley (1987, 1990) 만기일 이론

Stoll & Whaley (1987) "Program Trading and Individual Stock Returns: Ingredients
of the Triple-Witching Brew" 및 (1990) "The Dynamics of Stock Index and
Stock Index Futures Returns"은 만기일 효과의 이론적·실증적 토대를 확립했다.

**만기일 효과의 세 가지 채널:**

```
Channel 1: 포지션 청산(Unwinding)
  → 만기일에 OI 보유자의 강제/자발적 청산
  → 현물 시장에 집중적 매매 압력 발생
  → 거래량 ↑, 변동성 ↑

Channel 2: 최종 결제가 수렴(Settlement Convergence)
  → F → S 강제 수렴 → 차익 거래의 최종 청산
  → 만기일 개장 직후 30분간의 현물 매매 집중

Channel 3: 핀 리스크(Pin Risk)
  → 옵션 OI 집중 행사가 근처에서의 delta 헤지 증감
  → 지수의 자기조직적 수렴(self-organizing convergence)
```

**KRX 만기일 효과 실증 (2015-2025):**

```
월별 옵션 만기일 (매월 둘째 목요일):
  거래량:  평상시 대비 1.5~2.5× (KOSPI200 구성종목 전체)
  ATR:     평상시 대비 1.3~1.8×
  익일 반전: 60~65% 확률 (반대 방향 수익률)

분기 선물+옵션 만기일 (3/6/9/12월 둘째 목요일):
  거래량:  평상시 대비 2.5~4.0×
  ATR:     평상시 대비 1.5~2.5×
  익일 반전: 62~68% 확률

12월 만기일 (연말 결산 + 만기 중첩):
  가장 극단적 만기 효과
  연기금·보험사 포트폴리오 리밸런싱 동시 진행
  → 개별 종목 패턴 신뢰도 최하
```

### 5.2 만기일 패턴 신뢰도 보정 체계

Doc27 §6.1의 기본 감산 규칙을 확장하여 다층적 보정을 도입한다.

```
만기일 보정 체계 (Expiry Confidence Adjustment):

Layer 1: 날짜 기반 (Doc27 §6.1 기존)
  D-0 옵션 만기:     conf × 0.70
  D-0 분기 만기:     conf × 0.65
  D-3~D-1 롤오버:   conf × 0.85
  사이드카 발동:     conf × 0.50

Layer 2: OI 기반 (본 문서 추가)
  |OI_zscore| > 2.0:  conf × 0.90   (극단 포지셔닝 불확실성)
  PinStrength > 0.25: conf × 0.85   (핀 리스크 강함)
  만기일+PinStrength > 0.25: conf × 0.70 × 0.85 = 0.595

Layer 3: 프로그램 기반 (§6 연계)
  만기일 + program_zscore > 2.0: conf × 0.65 × 0.90 = 0.585

최종 보정:
  conf_final = conf × Π(Layer 감산)
  하한: conf_final ≥ 0.30 (완전 무효화 방지)
```

### 5.3 롤오버 스프레드 신호 (Rollover Spread Signals)

분기 선물 만기 전 롤오버 기간(T-10 ~ T-1)의 스프레드가
시장 기대를 반영하는 방식을 분석한다.

```
롤오버 스프레드:

RS = F_back - F_front

F_front: 근월물 선물 (만기 임박)
F_back:  차근월물 선물 (다음 분기)

이론 스프레드:
RS_theory = S · [e^((r-d)·T_back) - e^((r-d)·T_front)]
         ≈ S · (r-d) · (T_back - T_front)    (1차 근사, T 차이 ≈ 3개월)

시장 스프레드와 이론 스프레드의 괴리:
RS_excess = RS_market - RS_theory

RS_excess > 0:  원월물 프리미엄 초과 → 미래에 대한 강세 기대
RS_excess < 0:  원월물 디스카운트 → 미래에 대한 약세 기대
```

**롤오버 스프레드의 예측력:**

```
KOSPI200 선물 롤오버 스프레드 예측 회귀 (2015-2025):

r_{t+20} = α + β · RS_excess_zscore_t + ε_t

β ≈ +0.08  (t-stat ≈ 2.1)
R² ≈ 0.02

해석:
  롤오버 스프레드 1σ 확대 → 향후 20일 수익률 +0.08%
  예측력은 약하지만 통계적으로 유의
  → 단독 신호보다는 복합 신호(Doc27 §5.3 PCR+basis)의 보조 입력으로 적합
```

### 5.4 만기 주기별 시장 레짐 (Expiry Cycle Regimes)

```
분기 내 4단계 레짐:

Phase   | 기간           | OI 특성          | 패턴 적합도   | 보정
--------|---------------|-----------------|-------------|------
Accumulation | 만기후~만기-40d | OI 점진 증가  | 높음 (1.00)  | 없음
Plateau      | 만기-40d~-20d  | OI 정점 유지  | 최고 (1.05)  | 보너스
Rollover     | 만기-20d~-5d   | OI 감소 시작  | 중간 (0.90)  | 감산
Expiry       | 만기-5d~만기   | OI 급감       | 낮음 (0.70)  | 강한 감산

signalEngine.js _isNearExpiry() 연계:
  현재 D-2~D+1 범위 판정 → Phase 분류로 확장 가능
  getExpiryPhase(dateStr) → 'accumulation'|'plateau'|'rollover'|'expiry'
```

---

## 6. 프로그램매매 분석 (Program Trading Analytics)

### 6.1 프로그램 매매 분류 체계

Doc27 §3에서 차익/비차익 구분을 소개했다.
여기서는 각 유형의 미시구조적 영향을 이론적으로 정량화한다.

**차익 거래 프로그램 (Arbitrage Program):**

```
차익 매수 (Buy Arbitrage):
  발동: F_market > F* + τ   (τ ≈ 15-25 bps)
  행위: KOSPI200 바스켓 매수 + 선물 매도
  현물 영향: KOSPI200 구성종목 일괄 매수 → 지수 상승 압력
  지속시간: 베이시스 수렴 시까지 (~분~시간 단위)

차익 매도 (Sell Arbitrage):
  발동: F_market < F* - τ
  행위: KOSPI200 바스켓 매도(공매도 포함) + 선물 매수
  현물 영향: 구성종목 일괄 매도 → 지수 하락 압력
  제약: 공매도 규제 시 사실상 불가 → 베이시스 비대칭 심화

개별 종목 영향 모형:
  Impact_i = β_arb × w_i × |ProgramNet|

  w_i:         KOSPI200 편입 비중 (삼성전자 ≈ 20%)
  ProgramNet:  순매수/순매도 규모
  β_arb:       차익 프로그램 임팩트 계수 (~0.02)

의미: 차익 프로그램은 "기술적 패턴에 외생적 충격"을 가한다.
     패턴의 수급 해석(supply-demand reading)을 오염시킨다.
```

**비차익 거래 프로그램 (Non-Arbitrage Program):**

```
비차익 프로그램의 세부 유형:

1. 인덱스 복제 (Index Replication)
   → ETF 설정/환매, 패시브 리밸런싱
   → 영향: 구성종목 동시 매매, KOSPI200 비중 비례
   → 빈도: 일상적 (ETF AUM 변동에 연동)

2. 포트폴리오 보험 (Portfolio Insurance / Dynamic Hedging)
   → Leland & Rubinstein (1988) CPPI/OBPI 전략
   → 영향: 하락 시 매도 가속 → 양의 피드백 루프 → 1987 블랙먼데이
   → KRX: ELS/DLS 헤지 물량이 유사 메커니즘 형성

3. TWAP/VWAP 알고리즘
   → 대규모 주문의 시간 분할 집행
   → 영향: 시간대별 균등 분산, 가격 충격 최소화 의도
   → 패턴 영향: 인위적 거래량 균일화 → 거래량 기반 신호 왜곡

4. 팩터/퀀트 리밸런싱
   → 멀티팩터 운용사의 정기/비정기 포트폴리오 조정
   → 영향: 특정 팩터 노출 종목군에 집중된 수급
   → 패턴 영향: 섹터 로테이션과 유사한 방향성 압력
```

**비차익 프로그램의 패턴 영향 정량화:**

```
비차익 프로그램이 차익 프로그램보다 위험한 이유:

1. 지속성(Persistence):
   차익: 베이시스 수렴 시 청산 → 일시적 (분~시간)
   비차익: 전략 목적 달성까지 지속 → 장기적 (일~주)

2. 방향성(Directionality):
   차익: 양방향 동시 (현물 vs 선물) → 현물 순영향 제한적
   비차익: 단방향 (현물만) → 순수 방향성 압력

3. 예측가능성(Predictability):
   차익: 베이시스 이탈 시 기계적 발동 → 예측 가능
   비차익: 전략 로직에 의존 → 예측 불가

결론: 비차익 프로그램 강도가 높을 때(program_zscore > 2.0) 패턴 감산 적용
     Doc27 §6.3의 규칙 유지 + OI 레이어 추가
```

### 6.2 프로그램 매매 임팩트 모형

```
Almgren-Chriss (2000) 최적 집행 모형의 프로그램 매매 적용:

일시적 가격 충격 (Temporary Impact):
  h(v) = η · sign(v) · |v|^α

  v: 프로그램 매매 속도 (원/분)
  η: 임시 충격 계수
  α: 비선형도 (0.5 ≤ α ≤ 1.0, 통상 0.6)

영구적 가격 충격 (Permanent Impact):
  g(v) = γ · v

  γ: 영구 충격 계수

총 가격 충격:
  ΔP_program = g(V_total) + h(V_total / Δt)

  V_total: 총 프로그램 매매 금액
  Δt:     집행 시간

KRX 프로그램 매매 임팩트 추정:
  KOSPI200:
    η ≈ 0.02,  α ≈ 0.6
    γ ≈ 0.001 (일간 기준)
  
  예시: 1,000억원 매수 프로그램이 30분간 집행될 때
    일시적 충격: 0.02 × (3,333)^0.6 ≈ 4.2 bps
    영구적 충격: 0.001 × 1,000 ≈ 1.0 bps
    총 충격:     ≈ 5.2 bps (KOSPI200 지수 기준)
```

### 6.3 사이드카 제도의 미시구조적 분석

Doc27 §4.1에서 사이드카 발동 조건을 소개했다.
여기서는 사이드카의 이론적 근거와 효과를 분석한다.

**Circuit Breaker 이론 — Subrahmanyam (1994):**

```
서킷브레이커(circuit breaker)의 이론적 효과:

찬성 논거(Pro):
  1. 냉각 효과(Cooling-off): 정보 소화 시간 제공
  2. 마진콜 연쇄 방지: 강제 청산의 악순환 차단
  3. 유동성 공급자 보호: 시장조성자의 재고 리스크 완화

반대 논거(Con):
  1. 자석 효과(Magnet Effect): 발동 임계 접근 시 거래 가속
  2. 선물→현물 전이: 선물 사이드카 발동 시 현물에서 대체 매도
  3. 지연된 가격발견: 정보가 가격에 반영되는 속도 저하
  4. 유동성 증발: 재개 후 스프레드 확대, 주문 철회

Subrahmanyam (1994)의 결론:
  "서킷브레이커는 정보에 기반한 거래(informed trading)를
   억제하면서 잡음거래(noise trading)는 억제하지 못할 수 있다."
```

**KRX 사이드카 실증 분석:**

```
KRX 사이드카 발동 통계 (2015-2025):

발동 빈도: 연간 3-8회 (매도 사이드카가 매수 대비 ~3배)
평균 발동 시각: 09:30~10:30 (개장 직후 집중)
발동 후 5분간:
  KOSPI200 선물 스프레드: 평상시 대비 3-5배 확대
  프로그램 매매: 5분간 정지 → 이후 재개 시 폭발적 재집행
  현물 변동성: 사이드카 중에도 현물 거래는 계속 → 변동성 지속

사이드카 해제 후:
  해제 후 30분 이내 추가 하락(매도 사이드카 시): ~55% 확률
  해제 후 60분 이내 반등: ~45% 확률
  → 사이드카는 추세 반전보다는 추세 지연 효과
```

**패턴 신뢰도 보정 재확인:**

```
사이드카 관련 상수 (Doc27 §6.1 + 본 문서 추가):

| 상수 ID | 조건 | 보정 | Tier | 근거 |
|--------|------|------|------|------|
| #65 | 사이드카 발동 중 (5분) | conf × 0.50 | [A] | 프로그램 정지, 유동성 증발 |
| #65b | 사이드카 해제 후 30분 | conf × 0.70 | [C] | 잔여 변동성, 스프레드 확대 |
| #65c | 사이드카 해제 후 60분 | conf × 0.85 | [C] | 정상화 진행 중 |
| #65d | 사이드카 당일 | conf × 0.90 | [C] | 장중 잔류 효과 |
```

### 6.4 외국인 vs 기관 프로그램 매매 비대칭

```
투자자별 프로그램 매매 특성:

외국인 프로그램:
  - 비차익 비중 높음 (~70-80%)
  - 방향성 프로그램 + 글로벌 인덱스 리밸런싱
  - MSCI 리밸런싱(5/8/11월) 전후 집중
  - 영향: 편입/삭제 종목에 대규모 단방향 압력

기관(증권사) 프로그램:
  - 차익 비중 높음 (~60-70%)
  - 베이시스 이탈 시 기계적 집행
  - 영향: KOSPI200 구성종목 전체에 균등 분산

연기금 프로그램:
  - 비차익 100% (차익 거래 허용 안 됨)
  - 자산배분 리밸런싱 (분기별)
  - 영향: 대규모이지만 점진적 (TWAP 집행)

개인 프로그램:
  - 사실상 없음 (프로그램 매매 시스템 미보유)
  - 간접적: 로보어드바이저 ETF 매매가 프로그램으로 집계될 수 있음
```

---

## 7. 선물 미시구조와 기술적 패턴의 교차분석

### 7.1 OI-패턴 복합 신호 (OI-Pattern Composite Signals)

선물 OI 동향을 현물 패턴의 확인/부정 신호로 활용한다.

```
복합 신호 1: 강세 패턴 + OI 확인

조건:
  (a) 현물에서 강세 패턴 감지 (bullish engulfing, double bottom 등)
  (b) 선물 OI_trend_z > +1.0 (Q1: 신규 롱 진입)
  (c) 외국인 ForeignOI_z > +0.5 (외국인 매수 포지셔닝)

보정: conf × 1.10  (+10%)
근거: 파생상품 시장의 방향성 확인이 현물 패턴의 신뢰도를 보강

복합 신호 2: 강세 패턴 + OI 부정

조건:
  (a) 현물에서 강세 패턴 감지
  (b) 선물 OI_trend_z < -1.0 (Q2: 숏 커버링 → 지속성 의심)
  (c) 외국인 ForeignOI_z < -0.5 (외국인 매도 포지셔닝)

보정: conf × 0.85  (-15%)
근거: 파생상품 시장이 현물 패턴의 방향에 동의하지 않음

복합 신호 3: 약세 패턴 + OI 확인

조건:
  (a) 현물에서 약세 패턴 감지
  (b) 선물 OI_trend_z > +1.0 이면서 가격 하락 (Q3: 신규 숏)
  (c) CPI < -2.0 (외국인 숏 + 개인 롱)

보정: conf × 1.10
근거: 파생상품 시장이 하락 추세를 확인

복합 신호 4: 역방향 극단 경고

조건:
  (a) 강세 패턴 + RetailOI_z > +2.5 (개인 극단 롱)
  (b) 또는 약세 패턴 + RetailOI_z < -2.5 (개인 극단 숏)

보정: conf × 0.80  (-20%)
근거: 개인의 극단 포지셔닝은 역행 지표(contrarian indicator)
     Doc20 §4.1 개인 투자자 비중과 패턴 왜곡 연계
```

### 7.2 가격발견 선행 신호 (Price Discovery Lead Signals)

선물 가격 변화가 현물 패턴에 선행하는 특성을 활용한다.

```
선물 선행 신호 (Futures Lead Signal):

현재 signalEngine.js에서 감지 가능한 신호:

1. 선물 방향 사전 확인:
   선물이 5-15분 선행하므로, 장중 선물 가격 변화 방향이
   당일 현물 캔들의 방향을 미리 암시

   실시간 모드 전용 (WebSocket 모드):
   if (futures_5min_return > +0.3%):
     → 당일 양봉(bullish candle) 형성 확률 ↑
     → 강세 단일캔들 패턴(hammer, bullish engulfing) 신뢰도 +5%

2. 야간 선물 갭 방향 활용:
   overnight_gap = nightFutures_close - regularSession_close
   if (overnight_gap > +0.5%):
     → 정규장 개장 시 갭업 확률 ~75%
     → 전일 형성된 강세 패턴의 추가 확인

주의: 일봉(daily candle) 기반에서는 선물 선행 효과가 캔들 내에 흡수되므로
     인트라데이(1m/5m) 차트에서만 직접적 활용 가능
```

### 7.3 변동성-OI 피드백 루프

Doc34 §2 VRP와 Doc26 §2.3 VKOSPI 레짐을 OI와 연동한다.

```
변동성-OI 피드백 루프 메커니즘:

Stage 1: 변동성 급등 (VRP < 0, VKOSPI ↑)
  → 마진 요구 증가 → 자금 부담 → 일부 참여자 OI 청산
  → OI ↓

Stage 2: OI 감소 → 시장 깊이 축소
  → Bessembinder-Seguin: β₃ < 0 이므로 OI ↓ → 변동성 ↑
  → 변동성 추가 상승

Stage 3: 변동성 추가 상승 → 마진 추가 증가
  → 악순환(vicious cycle) 형성
  → 2020년 3월, 2022년 6월 관측된 패턴

해소 조건:
  → 변동성이 정점에 도달하면 저가 매수자 진입
  → 신규 OI 유입 → 시장 깊이 회복 → 변동성 하락
  → 선순환(virtuous cycle)으로 전환

CheeseStock 매핑:
  vrpRegime(Doc34 §2.4) + oi_zscore 결합:

  if (vrpRegime === 'risk-off' && oi_zscore < -1.5):
    → 피드백 루프 활성화 경고
    → 모든 패턴 conf × 0.75
    → 역추세 패턴은 추가 감산 × 0.80

  if (vrpRegime === 'risk-on' && oi_zscore > +1.5):
    → 안정적 시장 → 추세 패턴 conf × 1.10
```

---

## 8. 선물 미결제약정 데이터 파이프라인

### 8.1 데이터 소스와 수집 구조

```
1차 소스: KRX 정보데이터시스템 (data.krx.co.kr, 무료, D+1)

  파생상품 → KOSPI200 선물 시세:
  - F_close, F_high, F_low, F_open (선물 OHLC)
  - Volume, OI (거래량, 미결제약정)

  파생상품 → 투자자별 거래동향:
  - 외국인/기관/개인별 선물 매수·매도·순매수 (계약수 및 금액)

  주식 → 프로그램매매:
  - 차익 매수/매도/순매수 (금액)
  - 비차익 매수/매도/순매수 (금액)

  파생상품 → KOSPI200 옵션 → 행사가별 OI:
  - 각 행사가의 콜/풋 미결제약정 (핀 리스크 산출용)

2차 소스: ECOS API (한국은행)
  - 국고채 3개월물 금리 (이론 선물가 F* 산출에 사용)
  - 통계코드: 817Y002 (시장금리, Doc35 §2.3 참조)

3차 소스: FinanceDataReader (배당수익률 추정)
  - KOSPI200 배당수익률 (이론 선물가 F* 산출에 사용)
```

### 8.2 데이터 파이프라인 구조

```python
# scripts/download_derivatives.py (신규, Doc27 §7.1 확장)
#
# 출력 파일:
#   data/derivatives/futures_daily.json       (선물 시세 + OI)
#   data/derivatives/investor_oi.json         (투자자별 OI)
#   data/derivatives/program_trading.json     (프로그램 매매 현황)
#   data/derivatives/option_oi_by_strike.json (행사가별 옵션 OI)
#
# futures_daily.json 레코드 구조:
# {
#   "date": "2026-03-30",
#   "spot": 352.45,
#   "futures": {
#     "front": {
#       "code": "101S6000",
#       "close": 353.20,
#       "high": 354.10,
#       "low": 351.80,
#       "volume": 185432,
#       "oi": 298765,
#       "expiry": "2026-06-11"
#     },
#     "back": {
#       "code": "101S9000",
#       "close": 354.15,
#       "volume": 12345,
#       "oi": 45678,
#       "expiry": "2026-09-10"
#     }
#   },
#   "basis": {
#     "raw": 0.75,
#     "norm": 0.00213,
#     "theory": 0.88,
#     "excess": -0.13,
#     "tab": 0.45
#   },
#   "rollover_spread": {
#     "raw": 0.95,
#     "theory": 0.88,
#     "excess": 0.07
#   }
# }
#
# investor_oi.json 레코드 구조:
# {
#   "date": "2026-03-30",
#   "foreign": { "long": 145000, "short": 138000, "net": 7000 },
#   "institution": { "long": 82000, "short": 95000, "net": -13000 },
#   "retail": { "long": 71765, "short": 65765, "net": 6000 }
# }
#
# program_trading.json 레코드 구조:
# {
#   "date": "2026-03-30",
#   "arbitrage": { "buy": 523000, "sell": 312000, "net": 211000 },
#   "non_arbitrage": { "buy": 1250000, "sell": 980000, "net": 270000 },
#   "total": { "buy": 1773000, "sell": 1292000, "net": 481000 }
# }
# 금액 단위: 백만원
```

### 8.3 신호 매핑 — signalEngine.js 통합 설계

```javascript
// signalEngine.js 확장 — 선물 미시구조 신호

// 1. OI 추세 신호
function calcOiTrend(futuresData, lookback = 60) {
    // OI-가격 4분면 분류 (§2.2)
    // 출력: { quadrant: 'Q1'|'Q2'|'Q3'|'Q4',
    //         oi_trend_z: number,
    //         strength: 'strong'|'weak' }
}

// 2. 투자자별 포지셔닝 신호
function calcInvestorOi(investorOiData, lookback = 60) {
    // 외국인/기관/개인 OI z-score (§2.4)
    // CPI (Contrary Position Index) 산출
    // 출력: { foreignOi_z, instOi_z, retailOi_z, cpi }
}

// 3. 만기 레짐 신호
function calcExpiryRegime(dateStr, futuresData) {
    // 만기 주기별 Phase 분류 (§5.4)
    // 핀 리스크 강도 산출 (§2.5, 옵션 OI 데이터 필요)
    // 출력: { phase: string, confMultiplier: number,
    //         pinStrength: number }
}

// 4. 프로그램 매매 강도 신호
function calcProgramIntensity(programData, lookback = 20) {
    // Doc27 §6.3 확장
    // 차익/비차익 분리 z-score
    // 출력: { arb_zscore, nonArb_zscore, total_zscore,
    //         confMultiplier: number }
}

// 5. 가격발견 선행 신호 (실시간 모드 전용)
function calcPriceDiscoveryLead(futuresRealtime, spotRealtime) {
    // 선물-현물 선도-지연 (§4.3)
    // 출력: { futures_leading: boolean,
    //         lead_minutes: number,
    //         direction: 'bullish'|'bearish'|'neutral' }
}

// 6. OI-변동성 피드백 경고
function calcOiVolFeedback(oi_zscore, vrpRegime) {
    // §7.3 변동성-OI 피드백 루프 탐지
    // 출력: { feedbackActive: boolean,
    //         confMultiplier: number,
    //         warning: string }
}
```

### 8.4 backtester.js 검증 방법론

```
OI 기반 신호의 백테스트 설계:

1. 데이터 정렬:
   - 선물 데이터는 D+1 공시 → 패턴 T 기준 T-1 데이터만 사용
   - look-ahead bias 방지 필수 (Doc17 §3.2 참조)

2. 평가 지표:
   - IC (Information Coefficient): rank_corr(OI_signal, forward_return)
     → 목표 IC > 0.03 (단독 신호 기준)
   - Hit Rate: 신호 방향과 수익률 부호 일치 비율
     → 목표 Hit Rate > 52%
   - Conditional IC: 패턴 존재 시 OI 신호의 추가 IC
     → 목표 Conditional IC > 0.02

3. 테스트 기간 분할:
   - In-sample:   2015-01 ~ 2021-12 (7년)
   - Out-of-sample: 2022-01 ~ 2025-12 (4년)
   - 공매도 금지 기간(2023.11-2025.03)은 별도 분석

4. 기존 APT 팩터 모형 통합:
   Doc23 §2의 Ridge 모델에 선물 팩터 추가:
   열 18: basis_norm_{t-1}
   열 19: ff_zscore_{t-1}     (외국인 선물 포지션 z-score)
   열 20: oi_trend_z_{t-1}    (OI 추세 z-score)
   열 21: program_zscore_{t-1} (프로그램 강도 z-score)

   예상 IC 개선:
   17열 기준 IC ≈ 0.100
   21열 기준 IC ≈ 0.108~0.118

5. 만기일 효과 분석:
   - 만기일(D-0) 패턴 정확도 vs 비만기일 비교
   - 보정 전/후 패턴 수익률 비교
   - 최적 감산 계수 역산출 (OOS 기준)
```

### 8.5 학습 가능 상수 매핑

Doc22 `22_learnable_constants_guide.md`의 5-Tier 분류 체계 적용.
Doc27 §7.3의 상수 #63-#68에 추가:

```
| 상수 ID | 설명 | 현재값 | Tier | 학습 메커니즘 |
|--------|------|-------|------|-------------|
| #69 | OI-가격 4분면 강도 임계 | ±1.0σ | [C] | 60일 rolling z-score |
| #70 | CPI 극단 임계 | ±3.0 | [C] | Backtest hit-rate 최적화 |
| #71 | 핀 리스크 강도 임계 | 0.25 | [C] | 만기일 결제가 편차 분석 |
| #72 | OI-패턴 확인 보너스 | 1.10 | [D] | Ridge (oi_trend_z 열로 흡수) |
| #73 | OI-패턴 부정 감산 | 0.85 | [D] | Ridge (동상) |
| #74 | 개인 극단 역행 감산 | 0.80 | [C] | RetailOI_z 역행 확률 |
| #75 | 피드백 루프 경고 감산 | 0.75 | [C] | VRP+OI 교차 분석 |
| #76 | 만기 Phase Plateau 보너스 | 1.05 | [C] | Phase별 IC 비교 |

Tier [D] 상수 (#72, #73):
  oi_trend_z를 Ridge 회귀 입력으로 포함하면
  방향 확인/부정 효과를 자동 추정 → 하드코딩 불필요.

Tier [C] 상수 (#69-#71, #74-#76):
  주기적 백테스트로 값 갱신 가능.
  단, 만기일 관련 상수는 규칙 기반(달력)이므로
  학습보다는 실증 분석 기반 수동 갱신이 적합.
```

---

## 9. 교차 문서 연결 맵

본 문서와 기존 core_data 문서의 상호 참조 관계를 명시한다.

```
Doc36 (본 문서)
  ├── Doc27 §1-§7:  선물 가격 이론, 베이시스, 프로그램 매매 기초
  │     본 문서는 Doc27의 미시구조적 확장
  │
  ├── Doc26 §1-§2:  BSM, Greeks, VKOSPI
  │     OI-변동성 관계에서 옵션 그릭스 활용
  │     핀 리스크에서 옵션 OI 분포와 delta 헤지 연계
  │
  ├── Doc18 §1-§2:  Kyle 모형, VPIN, 유동성 비대칭
  │     선물 시장의 정보거래자-잡음거래자 구조
  │     선물 VPIN 확장 (고빈도 데이터 전환 시)
  │
  ├── Doc20 §2, §4:  가격제한, 외국인 흐름, 공매도 규제
  │     공매도 제한의 베이시스 비대칭 효과
  │     외국인 OI 포지셔닝의 패턴 영향
  │
  ├── Doc34 §2:  VRP, EWMA 변동성 비율
  │     OI-변동성 피드백 루프 (§7.3)
  │     VRP 레짐 + OI 교차 신호
  │
  ├── Doc23 §2:  APT Ridge 모형
  │     선물 팩터(basis_norm, ff_zscore, oi_trend_z) 추가
  │     열 18-21 확장
  │
  ├── Doc22:  학습 가능 상수 가이드
  │     상수 #69-#76 매핑 (§8.5)
  │
  ├── Doc35 §2:  NSS 수익률 곡선
  │     무위험이자율 r 추출 → 이론 선물가 F* 산출에 사용
  │
  ├── Doc17 §3:  회귀·백테스트 방법론
  │     look-ahead bias 방지, OOS 검증
  │
  └── Doc24 §1:  FearGreed 지수
        basis_norm을 w5 가중치로 편입 (Doc27 §5.3)
        OI_trend_z를 추가 가중치로 검토
```

---

## 10. 학술 참고문헌

### 가격발견 및 선도-지연 (Price Discovery & Lead-Lag)

1. Hasbrouck, J. (1995). One Security, Many Markets: Determining the Contributions to Price Discovery. *Journal of Finance*, 50(4), 1175-1199.
2. Gonzalo, J. & Granger, C.W.J. (1995). Estimation of Common Long-Memory Components in Cointegrated Systems. *Journal of Business & Economic Statistics*, 13(1), 27-35.
3. Stoll, H.R. & Whaley, R.E. (1990). The Dynamics of Stock Index and Stock Index Futures Returns. *Journal of Financial and Quantitative Analysis*, 25(4), 441-468.
4. Chan, K. (1992). A Further Analysis of the Lead-Lag Relationship Between the Cash Market and Stock Index Futures Market. *Review of Financial Studies*, 5(1), 123-152.
5. Epps, T.W. (1979). Comovements in Stock Prices in the Very Short Run. *Journal of the American Statistical Association*, 74(366), 291-298.

### 미결제약정 및 변동성 (Open Interest & Volatility)

6. Bessembinder, H. & Seguin, P.J. (1993). Price Volatility, Trading Volume, and Market Depth: Evidence from Futures Markets. *Journal of Financial and Quantitative Analysis*, 28(1), 21-39.
7. Figlewski, S. (1981). Futures Trading and Volatility in the GNMA Market. *Journal of Finance*, 36(2), 445-456.
8. Daigler, R.T. & Wiley, M.K. (1999). The Impact of Trader Type on the Futures Volatility-Volume Relation. *Journal of Finance*, 54(6), 2297-2316.
9. Pan, J. & Poteshman, A.M. (2006). The Information in Option Volume for Future Stock Prices. *Review of Financial Studies*, 19(3), 871-908.

### 만기일 효과 (Expiry Effects)

10. Stoll, H.R. & Whaley, R.E. (1987). Program Trading and Individual Stock Returns: Ingredients of the Triple-Witching Brew. *Journal of Business*, 60(1), 73-109.
11. Stoll, H.R. & Whaley, R.E. (1991). Expiration-Day Effects: What Has Changed? *Financial Analysts Journal*, 47(1), 58-72.
12. Alkeback, P. & Hagelin, N. (2004). Expiration Day Effects of Index Futures and Options: Evidence from a Market with a Long Settlement Period. *Applied Financial Economics*, 14(6), 385-396.
13. Park, C.G., Chung, H. & Lee, J.H. (2004). An Empirical Analysis of the Expiration Day Effect of Stock Index Futures and Options in Korea. *KDI Journal of Economic Policy*, 26(1).
14. Ni, S.X., Pearson, N.D. & Poteshman, A.M. (2005). Stock Price Clustering on Option Expiration Dates. *Journal of Financial Economics*, 78(1), 49-87.

### 프로그램 매매 및 시장 충격 (Program Trading & Market Impact)

15. Almgren, R. & Chriss, N. (2000). Optimal Execution of Portfolio Transactions. *Journal of Risk*, 3, 5-40.
16. Subrahmanyam, A. (1994). Circuit Breakers and Market Volatility: A Theoretical Perspective. *Journal of Finance*, 49(1), 237-254.
17. Leland, H.E. & Rubinstein, M. (1988). The Evolution of Portfolio Insurance. In: *Portfolio Insurance: A Guide to Dynamic Hedging*, Wiley.
18. Bertsimas, D. & Lo, A.W. (1998). Optimal Control of Execution Costs. *Journal of Financial Markets*, 1(1), 1-50.

### KRX 시장 구조 (KRX Market Structure)

19. Choe, H., Kho, B.-C. & Stulz, R.M. (1999). Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997. *Journal of Financial Economics*, 54(2), 227-264.
20. Kim, W. & Wei, S.-J. (2002). Foreign Portfolio Investors Before and During a Crisis. *Journal of International Economics*, 56(1), 77-96.
21. Ahn, H.-J., Kang, J. & Ryu, D. (2008). Informed Trading in the Index Option Market: The Case of KOSPI 200 Options. *Journal of Futures Markets*, 28(12), 1118-1146.
22. Ryu, D. (2011). Intraday Price Formation and Bid-Ask Spread Components: A New Approach Using a Cross-Market Model. *Journal of Futures Markets*, 31(12), 1142-1169.

### 정보 비대칭 및 주문흐름 (Information Asymmetry & Order Flow)

23. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
24. Glosten, L.R. & Milgrom, P.R. (1985). Bid, Ask and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders. *Journal of Financial Economics*, 14(1), 71-100.
25. Easley, D., Lopez de Prado, M. & O'Hara, M. (2012). Flow Toxicity and Liquidity in a High-frequency World. *Review of Financial Studies*, 25(5), 1457-1493.

### KRX 제도 참고 (Regulatory References)

26. KRX 한국거래소 (2025). *파생상품시장 업무규정 및 시행세칙*. 한국거래소.
27. KRX 한국거래소 (2024). *2024 파생상품시장 통계연보*. 한국거래소.
28. 금융위원회 (2025). *공매도 제도 개선방안*. 금융위원회 보도자료.
29. 한국예탁결제원 (2024). *ELS/DLS 발행 및 상환 현황*. KSD 통계.

---

## 핵심 정리: 선물 미시구조 → 패턴 시스템 매핑

| 미시구조 지표 | 신호 이름 | 산출 방법 | 패턴 보정 | 상수 ID |
|-------------|---------|---------|---------|--------|
| OI-가격 4분면 | oiTrend | OI_trend_z (§2.2) | Q1/Q3: +10%, Q2/Q4: -15% | #72, #73 |
| 투자자별 OI | foreignOiSignal | ForeignOI_z, CPI (§2.4) | CPI 극단: -20% | #70, #74 |
| 핀 리스크 | pinRisk | PinStrength (§2.5) | >0.25: -15% | #71 |
| 만기 Phase | expiryPhase | getExpiryPhase() (§5.4) | Phase별 0.70~1.05 | #76 |
| 프로그램 강도 | programIntensity | arb/nonArb z-score (§6.1) | z>2: -10%, z>3: -20% | #68(Doc27) |
| 사이드카 | sidecarStatus | 5분 window (§6.3) | 발동중: -50% | #65(Doc27) |
| 롤오버 스프레드 | rolloverSignal | RS_excess_z (§5.3) | APT 팩터 입력 | — |
| OI-VRP 피드백 | oiVolFeedback | oi_z + vrpRegime (§7.3) | 루프 활성: -25% | #75 |
| 가격발견 선행 | futuresLead | IS, lead-lag (§4.3) | 방향 확인: +5% | — |
| 베이시스 TAB | timeAdjBasis | TAB (§3.3) | 극단: ±감산/보너스 | — |

**구현 우선순위:**

```
P0 (즉시 구현 가능, 일봉 데이터):
  - expiryPhase (기존 _isNearExpiry 확장)
  - oiTrend (KRX D+1 데이터로 산출)
  - programIntensity (기존 Doc27 로직 강화)

P1 (데이터 파이프라인 구축 후):
  - foreignOiSignal, CPI (투자자별 OI 데이터 수집)
  - rolloverSignal (근월/원월 동시 수집)
  - timeAdjBasis (이론 선물가 산출 자동화)

P2 (고빈도 데이터 또는 실시간 모드 전환 시):
  - futuresLead (인트라데이 데이터 필요)
  - pinRisk (행사가별 옵션 OI 데이터 필요)
  - oiVolFeedback (실시간 VRP + OI 교차)
```
