# 39. 투자자 수급과 정보 비대칭 신호 — Investor Flow & Information Asymmetry Signals

> "가격은 정보를 반영하지만, 정보를 가진 거래자의 행동은 가격보다 먼저 움직인다."
> "Prices reflect information, but the actions of informed traders precede the price."
> — Albert Kyle, "Continuous Auctions and Insider Trading", *Econometrica* (1985)

---

## 1. 개요 (Overview)

투자자 수급(investor flow)은 가격 형성의 근원적 동인이다. 기술적 분석이
가격과 거래량이라는 **결과**를 분석하는 것이라면, 수급 분석은 그 결과를
만들어낸 **원인** — 누가, 얼마나, 어떤 방향으로 거래했는가 — 을 직접
관찰한다. 이는 기술적 패턴의 미시적 기초(microfoundation)를 제공하며,
패턴 신호의 신뢰도를 투자자 유형별 행동 특성으로 보정할 수 있게 한다.

한국거래소(KRX)는 세계적으로 드물게 투자자 유형별 순매수/순매도 데이터를
일별·종목별로 공개한다. 이 데이터는 정보 비대칭(information asymmetry)
이론의 실증적 검증 수단이자, 기술적 분석의 예측력을 증폭하는 보조 신호원이다.

**본 문서의 위치:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| Kyle 모형, VPIN | Doc 18 §1-2 | 투자자 유형별 정보 위계, 수급 복합 신호 |
| KRX 시장 구조, 외국인 흐름 | Doc 20 §1, §4 | 외국인/기관/개인 각각의 정보 함량과 예측력 |
| 정보 폭포, 군집행동 | Doc 19 §1, §5 | LSV 군집 측정, 기관 윈도 드레싱 |
| 행동재무, 처분효과 | Doc 04 §1-3 | 개인 투자자 역발행 신호, 복권주 선호 |
| 역선택, 신호발신 | Doc 31 §3.4 | Grossman-Stiglitz 정보 역설, 수급-가격 괴리 |
| 주의 기반 매수 | Doc 32 §3 | 주의 주도 매수와 개인 수급의 교차 검증 |
| Fama-French 팩터 | Doc 23 | 팩터 통제 후 수급 알파 |

**핵심 기여:**
1. Grossman & Stiglitz (1980) 정보 역설 → 정보 비대칭의 불가피성
2. Kyle (1985) 3유형 프레임워크 → KRX 투자자 범주 매핑
3. Kang & Stulz (1997), Choe et al. (2005) → 외국인 수급의 정보 함량
4. LSV (1992) 군집 측정 → 기관 행동의 정량화
5. Barber & Odean (2000, 2008) → 개인 투자자 역발행 신호
6. 복합 수급 신호 체계 → 투자자 유형 간 합치/괴리 신호
7. Barclay & Warner (1993) 은밀 거래 → 수급-가격 괴리 알파

**CheeseStock 구현 경로:**

```
[데이터 수집]                     [분석]                      [신호 출력]
download_investor.py          →   투자자 유형별 순매수       →  foreignFlow
data/derivatives/investor/    →   누적 수급 (5/20/60일)      →  institutionalFlow
KRX KOSPI/KOSDAQ 일별 수급    →   유형 간 합치/괴리 판정     →  retailContrarian
                              →   수급-가격 괴리 탐지        →  flowAlignment
                                                               ↓
                                                        패턴 신뢰도 조정
```

참고문헌:
- Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
- Grossman, S.J. & Stiglitz, J.E. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.

---

## 2. 정보 비대칭과 투자자 분류 (Information Asymmetry & Investor Taxonomy)

### 2.1 Grossman-Stiglitz 정보 역설 (Information Paradox)

Grossman & Stiglitz (1980)는 효율적 시장 가설(EMH)의 내적 모순을 지적하였다.
만약 가격이 모든 정보를 완전히 반영한다면, 정보를 수집할 유인이 없다.
정보 수집 비용(c)이 양(+)인 이상, 균형에서 일정 수준의 정보 비대칭이
반드시 존재해야 한다.

```
GS (1980) 균형 조건:

E[U(W_informed)] - c = E[U(W_uninformed)]

여기서:
  c = 정보 수집 비용 (research cost)
  W_informed = 정보 보유 거래자의 기말 부(wealth)
  W_uninformed = 비정보 거래자의 기말 부

균형 정보 보유자 비율:
  lambda* = f(c, sigma_epsilon, sigma_v)

  c ↑ → lambda* ↓  (정보 비용 증가 → 정보 보유자 감소 → 시장 비효율성 증가)
  sigma_v ↑ → lambda* ↑  (정보 가치 증가 → 정보 탐색 유인 증가)

핵심 함의:
  완전히 효율적인 시장은 존재할 수 없다 (informational efficiency paradox)
  → 일정 수준의 예측 가능성이 균형에서 항상 존재
  → 이것이 기술적 분석과 수급 분석의 존재 근거
```

**KRX 적용:** KRX에서 정보 수집 비용의 투자자 유형별 차이가 크다:
- 외국인(foreign): 글로벌 리서치 인프라, 비용 낮음 (대형 투자은행 고용)
- 기관(institutional): 국내 리서치 센터, 비용 중간
- 개인(retail): 인터넷/유튜브/커뮤니티, 비용 높음 (노이즈 비율 높음)

이 비용 구조가 투자자 유형별 정보 위계(information hierarchy)를 결정한다.

### 2.2 Kyle (1985) 3유형 프레임워크

Doc 18 §1에서 다룬 Kyle 모형을 투자자 유형 매핑으로 확장한다.

```
Kyle (1985) 3유형 거래자:

1. 정보 거래자 (Informed Trader):
   - 자산의 진정한 가치(v)에 대한 사적 정보 보유
   - 수익 극대화: max E[pi] = E[(v - p) * x]
   - 전략적 거래: 자신의 정보가 가격에 반영되는 속도를 최적화

2. 잡음 거래자 (Noise Trader):
   - 유동성, 세금, 행동적 편향 등 비정보적 동기로 거래
   - 거래량: u ~ N(0, sigma_u^2)
   - 시장에 유동성을 제공하나, 체계적으로 손실

3. 시장조성자 (Market Maker):
   - 총 주문흐름(x + u)만 관찰 가능
   - 가격 설정: p = mu + lambda * (x + u)
   - lambda = 가격 충격 계수 (Kyle's lambda)
```

### 2.3 KRX 투자자 범주와 Kyle 매핑

KRX는 투자자를 5대 범주로 구분하여 일별 순매수 데이터를 공개한다.
이를 Kyle 프레임워크에 매핑하면 각 범주의 정보 함량을 이론적으로 평가할 수 있다.

```
┌─────────────────────────────────────────────────────────────────────┐
│  KRX 투자자 범주     │  Kyle 매핑          │  정보 위계  │  정보 유형     │
├─────────────────────────────────────────────────────────────────────┤
│  외국인 (Foreign)    │  Informed (Type A)  │  1위 (최고) │  글로벌 매크로  │
│  기관 (Institution)  │  Informed (Type B)  │  2위        │  로컬 펀더멘털  │
│   ├ 투신 (Trust)     │    Semi-informed    │  2-A        │  섹터 분석     │
│   ├ 연기금 (Pension) │    Policy-informed  │  2-B        │  정책 신호     │
│   ├ 보험 (Insurance) │    Liability-driven │  2-C        │  ALM 매칭      │
│   └ 은행 (Bank)      │    Hedging          │  2-D        │  유동성 관리    │
│  개인 (Retail)       │  Noise Trader       │  3위 (최저) │  주의/감정     │
│  기타법인 (Corp)     │  Mixed              │  N/A        │  자사주/경영    │
│  기타금융 (Fin)      │  Mixed              │  N/A        │  프롭 트레이딩  │
└─────────────────────────────────────────────────────────────────────┘
```

**정보 위계의 실증 근거:**

```
투자자 유형별 수익률 성과 (선행 연구 종합):

외국인 (Foreign):
  - Kang & Stulz (1997): 일본 시장에서 대형주 선호, 정보 우위 확인
  - Choe, Kho & Stulz (1999): 한국 위기 시 외국인이 정보 우위
  - KRX 실증: 외국인 순매수 20일 누적 → 20일 후 수익률 +1.2~2.5% (연율)

기관 (Institutional):
  - Nofsinger & Sias (1999): 기관 순매수와 동기간 수익률 양의 상관
  - 한국: 연기금 매수 시 12개월 정(+) 수익률, 그러나 리드 기간 불확실

개인 (Retail):
  - Barber & Odean (2000): 과잉거래로 연 3.7% 수익률 손실
  - 한국: 개인 순매수 상위 10% 종목 → 20일 후 수익률 -0.8~-1.5%
  - 역발행 신호로서의 가치 (contrarian indicator)
```

### 2.4 정보 비대칭 측정

```
PIN (Probability of Informed Trading) — Easley et al. (1996):

  PIN = alpha * mu / (alpha * mu + 2 * epsilon)

  alpha = 정보 이벤트 발생 확률
  mu = 정보 거래자 도착률
  epsilon = 비정보 거래자 도착률 (매수/매도 각각)

  PIN > 0.30: 높은 정보 비대칭 → 수급 신호의 정보 함량 높음
  PIN < 0.10: 낮은 정보 비대칭 → 수급 신호의 노이즈 비율 높음
```

> **DATA REQUIREMENT WARNING:** PIN 모형은 tick-level 체결 데이터와 매수/매도
> 분류(buy/sell classification)를 필요로 한다. OHLCV + 투자자별 순매수 데이터만으로는
> PIN 직접 계산이 불가능하다. 향후 Koscom 실시간 체결 데이터 전환 시 구현 가능한
> 목표(aspirational target)로 기재한다. Doc 18 §2의 VPIN 제약과 동일한 맥락이다.

참고문헌:
- Grossman, S.J. & Stiglitz, J.E. (1980). Informationally Efficient Markets. *AER*, 70(3), 393-408.
- Kyle, A.S. (1985). Continuous Auctions. *Econometrica*, 53(6), 1315-1335.
- Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity, Information, and Infrequently Traded Stocks. *JF*, 51(4), 1405-1436.
- Kang, J.-K. & Stulz, R. (1997). Why Is There a Home Bias? *JFE*, 46(1), 3-28.
- Choe, H., Kho, B.-C. & Stulz, R. (1999). Do Foreign Investors Destabilize Stock Markets? *JFE*, 54(2), 227-264.
- Nofsinger, J. & Sias, R. (1999). Herding and Feedback Trading by Institutional and Individual Investors. *JF*, 54(6), 2263-2295.
- Barber, B.M. & Odean, T. (2000). Trading Is Hazardous to Your Wealth. *JF*, 55(2), 773-806.

---

## 3. 외국인 투자자 흐름 분석 (Foreign Investor Flow Analysis)

### 3.1 이론적 기초: 외국인의 정보 우위

외국인 투자자의 정보 우위에 대해서는 두 가지 상반된 가설이 존재한다.

```
가설 A: 정보 우위 (Informational Advantage)
  - 글로벌 분석 인프라, 교차시장 경험
  - Grinblatt & Keloharju (2000): 핀란드 시장에서 외국인 > 국내 개인
  - Choe et al. (2005): 한국 시장에서 외국인의 패턴 기반 거래 수익성 확인

가설 B: 정보 열위 (Informational Disadvantage)
  - 언어·문화·규제 장벽, 원격 모니터링의 한계
  - Hau (2001): 독일 시장에서 외국인 딜러의 열위
  - Dvorak (2005): 인도네시아에서 외국인 < 국내 기관

합의: 외국인은 "매크로/글로벌" 정보에 강하고, "로컬/기업 특수" 정보에 약하다.
      KRX에서는 시가총액 상위 대형주에서 외국인 정보 우위가 강하게 나타난다.
```

### 3.2 외국인 보유비율과 주식 수익률 예측

```
외국인 보유비율 변화(Delta_FOR)와 후속 수익률:

회귀 모형:
  r_{t+k} = alpha + beta_f * Delta_FOR_t + Controls + epsilon

  여기서:
    r_{t+k} = t+k일 후 수익률 (k = 5, 20, 60)
    Delta_FOR_t = t일의 외국인 순매수 / 시가총액
    Controls = size, value, momentum, volatility

한국 실증 (Choe et al. 2005, 업데이트):
  k = 5일:  beta_f = +0.032 (t = 3.4, p < 0.001)
  k = 20일: beta_f = +0.068 (t = 4.1, p < 0.001)
  k = 60일: beta_f = +0.085 (t = 2.8, p < 0.005)

해석: 외국인 순매수 1 표준편차 증가 → 20일 후 약 +6.8bp 초과 수익
      (경제적으로 의미 있으나, 거래비용 차감 후 축소)
```

### 3.3 외국인 순매수 누적 지표

실무적 수급 분석에서는 단일 일자보다 누적 순매수가 중요하다.

```
외국인 N일 누적 순매수:

  CumNetBuy_FOR(t, N) = Σ_{i=0}^{N-1} NetBuy_FOR(t-i)

표준화 (평균 일거래대금 대비):
  NormCumFlow_FOR(t, N) = CumNetBuy_FOR(t, N) / AvgDailyTurnover(t, 20)

신호 임계값 (KRX KOSPI 실증):
  | 기간 | 강한 매수 | 보통 매수 | 중립 | 보통 매도 | 강한 매도 |
  |------|----------|----------|------|----------|----------|
  | 5일  | > +2.0σ  | +1.0~2.0σ | ±1.0σ | -1.0~-2.0σ | < -2.0σ |
  | 20일 | > +1.5σ  | +0.75~1.5σ | ±0.75σ | -0.75~-1.5σ | < -1.5σ |
  | 60일 | > +1.0σ  | +0.5~1.0σ | ±0.5σ | -0.5~-1.0σ | < -1.0σ |

  σ = 해당 기간 누적 순매수의 역사적 표준편차 (rolling 250일)
```

### 3.4 MSCI 리밸런싱 효과

MSCI 지수의 분기별(2/5/8/11월) 리밸런싱은 외국인 수급의 비정보적 충격을 생성한다.

```
MSCI 리밸런싱 이벤트:

시점:
  발표일: 리밸런싱 약 2주 전 (사전 공시)
  효력일: 분기 마지막 영업일 종가
  실제 체결: 효력일 종가 단일가 매매에 집중

가격 영향:
  편입 (inclusion):  발표~효력일 CAR ≈ +3~8%
                     효력일 이후 60일: 부분 반전 (-2~4%)
  편출 (exclusion):  발표~효력일 CAR ≈ -4~10%
                     효력일 이후 60일: 부분 반전 (+1~3%)

핵심 원리:
  - 패시브 펀드(ETF/인덱스)의 기계적 매수/매도 → 가격 충격
  - 정보 함량 없음 (비정보적 수급, uninformed demand)
  - 기술적 패턴의 왜곡 원인: 편입 종목의 거짓 상승 돌파, 편출 종목의 거짓 하락 돌파
  - MSCI 리밸런싱 기간(발표~효력일+5영업일)에는 수급 신호를 비활성화하거나
    가중치를 감산해야 한다

MSCI 한국 관련 주요 사건:
  - 2024.02: MSCI EM → DM 승격 검토 (Korea Discount 논란)
  - 한국의 MSCI DM 편입 시: 외국인 순매수 약 40-60조원 유입 추정
  - 공매도 재개(2025.03.31)가 MSCI DM 편입 전제 조건
```

### 3.5 외국인 흐름과 환율의 교호작용

```
외국인 순매수와 원/달러 환율의 관계:

동시적 관계:
  외국인 순매수 ↑ → 달러 매도/원화 매수 → 원화 강세 (USD/KRW ↓)
  외국인 순매도 ↑ → 원화 매도/달러 매수 → 원화 약세 (USD/KRW ↑)

이중 효과 (double hit):
  외국인 매도 시: 주가 하락 + 원화 약세 → 외화 기준 수익률 이중 타격
  → 추가 매도 유발 (양의 피드백 루프)
  → 위기 시 외국인 자금 유출의 가속화 메커니즘

환율 조건부 수급 신호:
  foreignFlowSignal_adj = foreignFlowSignal × (1 - rho_fx × Delta_FX / sigma_fx)

  rho_fx = 외국인 순매수-환율 상관계수 (통상 -0.3 ~ -0.6)
  Delta_FX = 원/달러 환율 변동
  sigma_fx = 환율 변동성

  환율 급등(원화 약세) 시 외국인 매수 신호의 신뢰도 할인
```

참고문헌:
- Kang, J.-K. & Stulz, R. (1997). Why Is There a Home Bias? *JFE*, 46(1), 3-28.
- Choe, H., Kho, B.-C. & Stulz, R. (2005). Do Domestic Investors Have an Edge? *RFS*, 18(3), 795-829.
- Grinblatt, M. & Keloharju, M. (2000). The Investment Behavior and Performance of Various Investor Types. *JFE*, 55(1), 43-67.
- Hau, H. (2001). Location Matters: An Examination of Trading Profits. *JF*, 56(5), 1959-1983.
- Dvorak, T. (2005). Do Domestic Investors Have an Information Advantage? *JF*, 60(2), 817-839.
- Chen, L.W., Johnson, S.A. & Lin, J.C. (2014). MSCI Standard Index Reconstitutions. *PBFJ*, 29, 53-71.

---

## 4. 기관 투자자 행동 패턴 (Institutional Investor Behavior)

### 4.1 윈도 드레싱 (Window Dressing)

기관 투자자는 분기 말/연말 포트폴리오 보고서 작성을 위해 보유 종목을
전략적으로 조정한다. 이를 윈도 드레싱(window dressing)이라 한다.

```
Window Dressing 메커니즘:

정의:
  분기 말(3/6/9/12월) 보고일 직전 2-3주에 발생
  성과 좋은 종목 매수 + 성과 나쁜 종목 매도 → 보고서 "미화"
  보고일 이후 원위치 복귀 (reversal)

Lakonishok, Shleifer, Thaler & Vishny (1991):
  - 뮤추얼 펀드의 분기 말 매수 종목: 직전 분기 고수익 종목 편중
  - 직전 분기 저수익 종목: 분기 말 직전 매도 압력

KRX 기관 윈도 드레싱 패턴:
  시기: 분기 말 T-10일 ~ T-1일 (특히 12월 결산)
  대상: 시가총액 상위 100종목 (보고서 노출 빈도 높은 종목)
  영향:
    - 분기 말 직전: 대형주 비정상 매수 (+0.5~1.0%)
    - 분기 초(T+1 ~ T+10): 부분 반전 (-0.3~0.7%)
    - 기술적 패턴: 분기 말 돌파 신호의 신뢰도 저하
```

### 4.2 군집행동 측정: LSV 군집 지표

Lakonishok, Shleifer & Vishny (1992)의 군집 지표(herding measure)는
기관 투자자의 동조 매매를 정량화한다.

```
LSV Herding Measure:

  HM_i = |p_i - E[p_i]| - AF_i

  p_i = 종목 i를 순매수한 기관의 비율
        = B_i / (B_i + S_i)
  B_i = 종목 i를 순매수한 기관 수
  S_i = 종목 i를 순매도한 기관 수

  E[p_i] = 같은 기간 전체 종목의 평균 p
           (시장 전반적 기관 매수 경향 제거)

  AF_i = 조정 인자 (adjustment factor)
         = E[|p_i - E[p_i]|] under H0 of no herding
         (귀무가설하에서 기대되는 편차: 이항분포에서 계산)

해석:
  HM_i > 0: 종목 i에서 기관 군집행동 존재
  HM_i > 0.05: 유의한 군집행동 (5% 이상 기관이 동일 방향 편향)

한국 실증:
  Choe, Kho & Stulz (1999):
    KOSPI 기관 HM ≈ 0.02-0.04 (정상 시)
    위기 시 HM ≈ 0.06-0.10 (군집 강화)
  개인 투자자: HM ≈ 0.05-0.08 (기관보다 높은 군집)
```

### 4.3 기관 모멘텀: 선행인가 추종인가?

기관 투자자가 가격 추세를 선행(lead)하는지 추종(follow)하는지는
수급 신호의 활용 방법을 결정하는 핵심 질문이다.

```
Granger 인과 검정:

  r_t = alpha + Σ beta_j * r_{t-j} + Σ gamma_j * InstFlow_{t-j} + epsilon

  H0: gamma_j = 0 for all j  (기관 수급 → 수익률 인과관계 없음)

한국 실증 결과 (혼합):
  - KOSPI 대형주: 기관 순매수가 수익률을 1-3일 선행 (정보 거래)
  - KOSPI 중형주: 기관 순매수가 수익률을 1일 후행 (모멘텀 추종)
  - KOSDAQ: 기관 순매수가 수익률과 동시적 (유동성 공급)

결론:
  기관의 정보 함량은 시가총액 구간과 기관 유형에 따라 차등적이다.
  단일 신호로 처리하면 안 되며, 기관 세부 유형 분해가 필요하다.
```

### 4.4 국민연금(NPS)의 이중 역할

국민연금공단(National Pension Service)은 세계 3위 연기금으로,
KRX에서 특수한 위치를 차지한다.

```
국민연금의 시장 역할:

AUM: ~1,100조원 (2025년 말)
국내 주식 비중: ~15% (약 165조원)
KOSPI 시가총액 대비: ~7-8%

이중 역할:
  1. 시장 안정자 (Market Stabilizer):
     - 급락 시 대규모 매수 (역추세 매매)
     - 정부 정책 신호로 해석됨 (SOE effect)
     - 2026.03 폭락 시 약 3조원 순매수 → 시장 안정 기여

  2. 정보 신호원 (Information Source):
     - 장기 가치 투자 지향 → 저평가 종목 발굴
     - 연기금 매수 ≈ 장기 가치 인정 신호
     - 그러나: 정책적 매수(시장 안정 목적)와 정보적 매수의 구분 어려움

신호 해석 주의:
  NPS_순매수 > 0 + 시장 하락 → 안정 매수 (정보 함량 낮음, 역추세 신호)
  NPS_순매수 > 0 + 시장 횡보 → 가치 매수 (정보 함량 높음, 선행 신호)
  NPS_순매도 > 0 → 드물지만 발생 시 강한 경고 신호
```

### 4.5 기관 세부 유형별 행동 특성

```
┌──────────────────────────────────────────────────────────────────────┐
│  기관 유형      │  투자 시계  │  정보 우위     │  패턴 상호작용         │
├──────────────────────────────────────────────────────────────────────┤
│  투신 (Trust)   │  3-12개월   │  섹터 분석     │  모멘텀 신호와 동조     │
│                 │             │  리서치 리포트  │  트렌드 추종 경향       │
├──────────────────────────────────────────────────────────────────────┤
│  연기금 (Pension)│  1-5년     │  장기 가치      │  역추세 매매           │
│                 │             │  정책 내부정보  │  지지선에서 매수 집중   │
├──────────────────────────────────────────────────────────────────────┤
│  보험 (Insurance)│  5-20년    │  ALM 매칭      │  배당주/우선주 선호     │
│                 │             │  금리 연동      │  금리 레짐과 동조       │
├──────────────────────────────────────────────────────────────────────┤
│  은행 (Bank)    │  1-6개월   │  유동성 관리    │  단기 역추세 (리밸런싱) │
│                 │             │  달러/원 헤지   │  환율과 동조           │
├──────────────────────────────────────────────────────────────────────┤
│  사모펀드 (PE)  │  6-18개월  │  이벤트 드리븐  │  공시 전후 급매수/매도  │
│                 │             │  M&A 정보      │  패턴 무시 (이벤트 주도)│
└──────────────────────────────────────────────────────────────────────┘
```

참고문헌:
- Lakonishok, J., Shleifer, A. & Vishny, R. (1992). The Impact of Institutional Trading on Stock Prices. *JFE*, 32(1), 23-43.
- Lakonishok, J., Shleifer, A., Thaler, R. & Vishny, R. (1991). Window Dressing by Pension Fund Managers. *AER P&P*, 81(2), 227-231.
- Wermers, R. (1999). Mutual Fund Herding and the Impact on Stock Prices. *JF*, 54(2), 581-622.
- Sias, R. (2004). Institutional Herding. *RFS*, 17(1), 165-206.

---

## 5. 개인 투자자 역발행 신호 (Retail Investor Contrarian Signal)

### 5.1 이론적 기초: 개인 투자자의 체계적 편향

개인 투자자(소매 투자자, retail investor)는 행동재무학이 식별한
다수의 체계적 편향을 보인다. 이 편향이 개인 수급을 **역발행 신호**
(contrarian indicator)로 만든다.

```
Barber & Odean (2000, 2008) 핵심 발견:

1. 과잉거래 (Overtrading):
   - 남성 > 여성 (과신 효과): 남성 45% 더 거래, 연 2.65% 수익 손실
   - 거래 빈도 상위 20%: 하위 20% 대비 연 6.5% 수익률 열위
   - Barber & Odean (2000), "Trading Is Hazardous to Your Wealth", JF

2. 주의 기반 매수 (Attention-Driven Buying):
   - 뉴스에 등장한 종목, 거래량 급증 종목, 급등 종목 매수 편향
   - "Attention stocks" → 과매수 → 1-12개월 내 평균 회귀
   - Barber & Odean (2008), "All That Glitters", RFS

3. 처분효과 (Disposition Effect):
   - 이익 종목 조기 매도 + 손실 종목 보유 지속
   - Doc 04 §1.3 참조
   - Shefrin & Statman (1985), JF

4. 복권주 선호 (Lottery Preference):
   - 저가, 고변동성, 고왜도 종목 선호
   - Kumar (2009): 저소득·저학력·비백인·고령 투자자에서 강화
   - 한국: KOSDAQ 바이오/테마주가 전형적 복권주
   - Kumar (2009), "Who Gambles in the Stock Market?", JF
```

### 5.2 한국 "개미" 수급의 특수성

한국 개인 투자자(속칭 "개미")는 글로벌 대비 독특한 특성을 보인다.

```
한국 개인 투자자 특성:

참여율: 인구의 약 30% (1,500만 명, 2025년)
KOSDAQ 거래대금 비중: 60-91%
KOSPI 거래대금 비중: 30-40%

특수성:
  1. 레버리지 선호: 신용융자 잔고 KOSDAQ > KOSPI
     - 하락 시 반대매매(margin call) → 가격 하락 가속
     - Doc 20 §5 참조

  2. 동학개미 현상 (2020):
     - COVID 폭락 후 개인의 대규모 순매수
     - KOSPI 1,400 → 3,300 상승 과정에서 개인이 주도
     - "정보 없는 군중이 올바른 방향을 맞춘" 특수 사례
     - 이후 2021.06-2022: 개인 매수 종목 대부분 손실

  3. 소셜 미디어 증폭:
     - Doc 19 §2 참조: 유튜브/카카오톡 주식방의 군집 유발
     - AICA (Attention-Induced Cascade Amplifier) 효과
```

### 5.3 개인 역발행 신호 구축

```
개인 투자자 역발행 신호 (Retail Contrarian Signal):

원리:
  개인 극단 순매수 → 과매수 → 평균 회귀 (하락)
  개인 극단 순매도 → 과매도 → 평균 회귀 (상승)

수식:
  RCS_t = -1 × Rank(RetailNetBuy_t / AvgVolume_20d)

  RCS > 0: 개인 극단 매도 → 매수 신호
  RCS < 0: 개인 극단 매수 → 매도 신호

정규화:
  RetailFlowZ_t = (CumRetailNetBuy_t,N - μ_retail) / σ_retail

  μ_retail, σ_retail = 250일 rolling 평균/표준편차

역발행 신호 임계값 (KRX 실증):
  | Z-score | 해석 | 후속 20일 초과수익 |
  |---------|------|-------------------|
  | Z > +2.0 | 극단 개인 매수 | -1.2% ~ -2.5% (bearish) |
  | Z > +1.5 | 강한 개인 매수 | -0.5% ~ -1.0% |
  | |Z| < 0.5 | 중립 | N/A |
  | Z < -1.5 | 강한 개인 매도 | +0.5% ~ +1.2% |
  | Z < -2.0 | 극단 개인 매도 | +1.0% ~ +2.0% (bullish) |
```

### 5.4 주의 주도 매수와 개인 수급의 교차 검증

Doc 32 §3의 주의 기반 가격결정과 개인 수급 데이터를 결합하면
신호의 정보 함량이 향상된다.

```
Attention-Flow 교차 신호:

  AttentionFlow_t = AttentionState_t × RetailFlowZ_t

  AttentionState (Doc 32): 거래량 급증 + 검색 관심 증가
  RetailFlowZ: 개인 순매수 Z-score

  조합 해석:
  | Attention | RetailFlow | 해석 | 신호 |
  |-----------|------------|------|------|
  | 높음 | 극단 매수 | 주의 폭포 + 개인 과매수 | 강한 매도 (bearish) |
  | 높음 | 극단 매도 | 패닉 + 개인 투매 | 강한 매수 (bullish) |
  | 낮음 | 극단 매수 | 조용한 축적 (정보 매수?) | 중립 (추가 확인 필요) |
  | 낮음 | 극단 매도 | 조용한 분산 | 약한 매수 |
```

### 5.5 KOSDAQ 개인 지배 비율과 버블 지표

```
KOSDAQ 개인 거래 비중 (RetailDominance):

  RD_t = RetailVolume_t / TotalVolume_t

  역사적 분포:
    정상: RD ≈ 0.65-0.75
    과열: RD > 0.80
    극단: RD > 0.90 (2020-2021 동학개미, 2024 2차전지 테마)

  버블 판별:
    RD > 0.85 + 개인 순매수 60일 누적 > +2σ + KOSDAQ 60일 수익률 > +20%
    → 버블 경고 발동 (기술적 매수 신호 비활성화 권장)

  실증:
    RD > 0.85 달성 후 60일: KOSDAQ 수익률 중위수 -5.2%
    RD > 0.90 달성 후 60일: KOSDAQ 수익률 중위수 -12.8%
```

참고문헌:
- Barber, B.M. & Odean, T. (2000). Trading Is Hazardous to Your Wealth. *JF*, 55(2), 773-806.
- Barber, B.M. & Odean, T. (2008). All That Glitters. *RFS*, 21(2), 785-818.
- Kumar, A. (2009). Who Gambles in the Stock Market? *JF*, 64(4), 1889-1933.
- Shefrin, H. & Statman, M. (1985). The Disposition to Sell Winners Too Early. *JF*, 40(3), 777-790.
- Bali, T., Cakici, N. & Whitelaw, R. (2011). Maxing Out: Stocks as Lotteries. *JFE*, 99(2), 427-446.
- Han, B. & Kumar, A. (2013). Speculative Retail Trading and Asset Prices. *JFQA*, 48(2), 377-404.

---

## 6. 투자자 수급 복합 신호 체계 (Composite Investor Flow Signal System)

### 6.1 수급 합치/괴리 프레임워크

단일 투자자 유형의 수급보다, 유형 간 합치(alignment) 또는 괴리(divergence)가
더 강력한 예측 신호를 제공한다.

```
투자자 유형 간 합치/괴리 매트릭스:

              외국인 매수    외국인 매도
기관 매수     [강한 매수]    [혼합-중립]
기관 매도     [혼합-중립]    [강한 매도]

6-way 세분화 (개인 포함):
  | 외국인 | 기관 | 개인 | 해석 | 강도 | 확률 |
  |--------|------|------|------|------|------|
  | 매수 | 매수 | 매도 | 최강 매수 (스마트머니 합치 + 개인 역발행) | ★★★★★ | ~8% |
  | 매수 | 매도 | 매도 | 외국인 단독 매수 (글로벌 관점) | ★★★ | ~12% |
  | 매도 | 매수 | 매도 | 기관 단독 매수 (로컬 가치) | ★★ | ~10% |
  | 매수 | 매수 | 매수 | 전원 매수 (과열 경고) | ★★ | ~5% |
  | 매도 | 매도 | 매수 | 최강 매도 (스마트머니 합치 + 개인 과매수) | ★★★★★ | ~7% |
  | 매도 | 매수 | 매수 | 외국인 매도 + 내수 매수 (지정학 리스크) | ★★ | ~8% |
```

### 6.2 가중 복합 수급 신호 (Weighted Composite Flow Signal)

```
수학적 정의:

  FlowSignal_t = Σ_k (w_k × NormNetBuy_{k,t}) / AvgVolume_20d

  k ∈ {foreign, institutional, retail}
  NormNetBuy_{k,t} = 투자자 유형 k의 t일 순매수 (원)

가중치 결정 (정보 위계 반영):

  기본 가중치:
    w_foreign       = +0.50   (정보 함량 최고, 순방향 신호)
    w_institutional = +0.30   (정보 함량 중간, 순방향 신호)
    w_retail        = -0.20   (역발행 신호, 부호 반전)

  가중치 합산: |0.50| + |0.30| + |0.20| = 1.00

  조건부 가중치 조정:
    MSCI 리밸런싱 기간: w_foreign = +0.20 (비정보적 수급 할인)
    분기 말 윈도 드레싱: w_institutional = +0.15 (기관 수급 할인)
    KOSDAQ (개인 지배): w_retail = -0.30 (역발행 신호 강화)

신호 정규화:
  FlowZ_t = (FlowSignal_t - μ_flow) / σ_flow
  μ_flow, σ_flow = 60일 rolling 평균/표준편차
```

### 6.3 연속 순매수/순매도 지속성 (Persistence Signal)

```
N일 연속 순매수/순매도 (Streak):

  Streak_k(t) = 연속 매수/매도 일수 for 투자자 유형 k

  외국인 5일 연속 순매수: Streak_FOR(t) >= 5
  기관 5일 연속 순매수: Streak_INST(t) >= 5

해석:
  | 유형 | 연속 일수 | 해석 | 실증 후속 수익 |
  |------|----------|------|---------------|
  | 외국인 매수 | 5일+ | 확신 매수 | +20일: +1.5~3.0% |
  | 외국인 매수 | 10일+ | 강한 축적 | +20일: +2.5~5.0% |
  | 외국인 매수 | 20일+ | 대규모 포지션 구축 | +60일: +3.0~8.0% |
  | 외국인 매도 | 5일+ | 포지션 축소 | +20일: -1.0~-2.0% |
  | 외국인 매도 | 10일+ | 강한 처분 | +20일: -2.0~-4.0% |
  | 개인 매수 | 10일+ | 과열 경고 | +20일: -1.5~-3.0% |

수식:
  PersistenceSignal_k(t) = sign(NetBuy_k(t)) × log(1 + |Streak_k(t)|)

  log 변환으로 연속 일수의 한계 정보 감소를 반영
```

### 6.4 거래량 가중 수급 (Volume-Weighted Flow)

```
거래량 대비 수급 비율 (Flow Intensity):

  FI_{k,t} = NetBuy_{k,t} / Volume_t

  FI > 0.30: 특정 유형이 전체 거래의 30% 이상을 순매수 → 강한 신호
  FI > 0.50: 거래의 절반 이상이 순매수 → 극단 신호

N일 평균 거래량 대비 정규화:
  NormFI_{k,t} = NetBuy_{k,t} / AvgVolume(t, 20)

  이 정규화는 비정상적 거래량 일에 수급 신호가 과대평가되는 것을 방지한다.
```

### 6.5 복합 신호의 통합 점수

```
최종 투자자 수급 점수 (Investor Flow Score):

  IFS_t = w1 × FlowZ_t           (가중 복합 수급)
        + w2 × PersistenceZ_t     (지속성 신호)
        + w3 × AlignmentScore_t   (합치/괴리 점수)
        + w4 × AttentionFlowZ_t   (주의-수급 교차)

  기본 가중치:
    w1 = 0.40 (주요 신호)
    w2 = 0.25 (지속성 보정)
    w3 = 0.25 (유형 간 합치)
    w4 = 0.10 (주의 교차 — 보조)

  IFS 해석:
    IFS > +1.5: 강한 매수 수급
    IFS > +0.5: 약한 매수 수급
    |IFS| < 0.5: 수급 중립
    IFS < -0.5: 약한 매도 수급
    IFS < -1.5: 강한 매도 수급

패턴 신뢰도 조정 (pattern confidence modifier):
  flowMult = 1 + alpha_flow × clip(IFS_t, -2, +2) × signal_direction

  alpha_flow = 0.05 (수급 1σ당 패턴 신뢰도 5% 조정)
  signal_direction = +1 (매수 패턴) 또는 -1 (매도 패턴)

  합산 범위: 0.90 ~ 1.10
  → 수급이 패턴 방향을 확인하면 최대 +10%, 반대하면 최대 -10%
```

참고문헌:
- Froot, K., O'Connell, P. & Seasholes, M. (2001). The Portfolio Flows of International Investors. *JFE*, 59(2), 151-193.
- Griffin, J., Harris, J. & Topaloglu, S. (2003). The Dynamics of Institutional and Individual Trading. *JF*, 58(6), 2285-2320.
- Richards, A. (2005). Big Fish in Small Ponds: The Trading Behavior and Price Impact of Foreign Investors in Asian Emerging Equity Markets. *JFQA*, 40(1), 1-27.

---

## 7. 수급-가격 괴리와 알파 (Flow-Price Divergence & Alpha)

### 7.1 은밀 거래 가설 (Stealth Trading Hypothesis)

Barclay & Warner (1993)는 정보 거래자가 탐지를 회피하기 위해
중간 크기의 주문을 사용한다는 "은밀 거래 가설"을 제시하였다.

```
Barclay & Warner (1993) 핵심 발견:

NYSE 데이터:
  - 전체 가격 변동의 주요 원인: 중간 크기 거래 (500-10,000주)
  - 소규모 거래 (<500주): 약 15% of cumulative price change
  - 중규모 거래 (500-10,000주): 약 65% of cumulative price change
  - 대규모 거래 (>10,000주): 약 20% of cumulative price change

은밀 거래의 동기:
  대규모 주문 → 가격 충격(price impact) 증가 → 수익 감소
  → 정보 거래자는 주문을 분할하여 "군중에 숨는다" (hide in the crowd)

KRX 적용:
  외국인/기관의 프로그램매매 제외 순매수가 은밀 거래의 프록시
  프로그램매매(차익/비차익): 기계적, 공개적 → 정보 함량 낮음
  비프로그램 기관 순매수: 은밀 정보 거래 포함 가능성 높음
```

### 7.2 수급-가격 괴리 (Flow-Price Divergence)

가격이 하락하는데 스마트머니(외국인+기관)가 순매수하는 상황은
**축적(accumulation)** 국면을 시사한다. 반대 상황은 **분산(distribution)**
국면이다.

```
수급-가격 괴리 지표:

  FPD_t = sign(SmartMoneyFlow_t) × sign(-PriceChange_t)

  SmartMoneyFlow_t = w_f × NormNetBuy_FOR_t + w_i × NormNetBuy_INST_t

  괴리 판정:
    FPD = +1: 가격 하락 + 스마트머니 매수 → 축적 (Accumulation)
    FPD = -1: 가격 상승 + 스마트머니 매도 → 분산 (Distribution)
    FPD = 0:  가격과 수급 방향 일치 → 추세 확인 (Trend Confirmation)

강도 가중:
  FPD_strength = |SmartMoneyFlow_t| × |PriceReturn_t| × FPD_t

N일 누적 괴리:
  CumFPD(t, N) = Σ_{i=0}^{N-1} FPD_strength(t-i)

  CumFPD(t, 20) > +2σ: 강한 축적 (향후 상승 가능성)
  CumFPD(t, 20) < -2σ: 강한 분산 (향후 하락 가능성)
```

### 7.3 Wyckoff 축적/분산 이론과의 연결

Richard Wyckoff의 고전적 축적/분산 이론은 수급-가격 괴리의
원조적(proto-) 프레임워크이다.

```
Wyckoff 축적 4단계:

Phase A: 하락 종료 (Selling Climax + Automatic Rally)
  → 높은 거래량 + 가격 반등
  → 스마트머니: 초기 매수 시작

Phase B: 축적 (Building a Cause)
  → 횡보, 거래량 감소
  → 스마트머니: 지속 매수, 개인 무관심/매도
  → FPD > 0이 반복적으로 관찰되는 구간

Phase C: 스프링 (Spring/Test)
  → 지지선 일시 하향 돌파 (마지막 약세 함정)
  → 개인 패닉 매도, 스마트머니 최종 매수
  → FPD 극대: 가격 최저 + 수급 최고

Phase D: 마크업 (Mark-Up)
  → 상승 시작, 거래량 증가
  → FPD = 0 (가격과 수급 동조)

수급 데이터로 Wyckoff 단계 추정:
  Phase B 탐지: 20일 가격 변동률 < ±3% + 외국인 누적 순매수 상승
  Phase C 탐지: 5일 가격 신저가 + 외국인 1일 순매수 > 2σ
```

### 7.4 시계열 vs 횡단면 수급 신호

수급 신호는 두 가지 차원에서 활용할 수 있다.

```
시계열 수급 신호 (Time-Series Flow Signal):
  개별 종목의 수급 시계열을 자기 역사와 비교
  "이 종목에서 외국인이 평소보다 많이 매수하고 있는가?"
  FlowTS_t = (NetBuy_FOR_t - μ_own) / σ_own

횡단면 수급 신호 (Cross-Sectional Flow Signal):
  같은 시점에서 종목 간 수급을 비교
  "이 종목이 다른 종목보다 외국인 매수가 집중되고 있는가?"
  FlowCS_t = Rank(NormNetBuy_FOR_t across all stocks)

결합:
  DualFlowSignal = 0.6 × FlowTS + 0.4 × FlowCS

  시계열이 더 높은 가중치: 종목 고유의 수급 패턴이 더 안정적
  횡단면은 상대 비교로 시장 전반의 자금 이동을 포착
```

### 7.5 팩터 통제 후 수급 알파

수급 신호가 기존 팩터(size, value, momentum)와 독립적인
알파를 보유하는지 검증해야 한다.

```
Fama-MacBeth (1973) 회귀:

  r_{i,t+1} = alpha + beta_1 × ForeignFlow_i,t
            + beta_2 × InstitutionalFlow_i,t
            + beta_3 × RetailFlow_i,t
            + gamma_1 × log(Size_i,t)
            + gamma_2 × BM_i,t           (Book-to-Market)
            + gamma_3 × MOM_i,t          (12-1 month momentum)
            + gamma_4 × ILLIQ_i,t         (Amihud illiquidity)
            + epsilon_i,t

Doc 23 연결: APT 팩터 모형에서 수급 변수는 추가적 비시장 팩터로 기능.
  → 기존 MRA 12열 회귀에 수급 팩터 3열 추가 → 15열 확장 가능.

기대 결과 (선행 연구 기반):
  beta_1 (외국인): +0.02~0.04 (p < 0.01) — size, value 통제 후에도 유의
  beta_2 (기관): +0.01~0.02 (p < 0.05) — momentum과 일부 중첩
  beta_3 (개인): -0.01~-0.03 (p < 0.01) — 역발행 효과 강건

다중공선성 주의:
  외국인 순매수 ≈ -(기관 + 개인) 순매수 (항등식)
  → 3변수 동시 투입 시 다중공선성 → VIF 체크 필수
  → 실무: 외국인 + 개인을 투입, 기관은 제외 (또는 PCA 후 직교 성분 사용)
```

참고문헌:
- Barclay, M. & Warner, J. (1993). Stealth Trading and Volatility. *JFE*, 34(3), 281-305.
- Wyckoff, R. (1931). *The Richard D. Wyckoff Method of Trading and Investing in Stocks*. Wyckoff Associates.
- Fama, E. & MacBeth, J. (1973). Risk, Return, and Equilibrium. *JPE*, 81(3), 607-636.
- Campbell, J., Ramadorai, T. & Schwartz, A. (2009). Caught on Tape: Institutional Trading, Stock Returns, and Earnings Announcements. *JFE*, 92(1), 66-91.
- Kaniel, R., Saar, G. & Titman, S. (2008). Individual Investor Trading and Stock Returns. *JF*, 63(1), 273-310.

---

## 8. 수급 신호의 시장 레짐 의존성 (Regime-Dependent Flow Signals)

### 8.1 시장 레짐과 수급 정보 함량

수급 신호의 예측력은 시장 레짐(regime)에 따라 크게 변한다.
정상 시장과 위기 시장에서 동일한 수급 패턴이 정반대의 의미를 가질 수 있다.

```
레짐별 수급 신호 유효성:

1. 상승장 (Bull Market: KOSPI 60일 MA > 200일 MA, VIX < 20):
   외국인 순매수 → 순방향 신호 유효 (추세 확인)
   기관 순매수 → 순방향 신호 유효 (펀드 유입 반영)
   개인 역발행 → 약한 유효 (상승장에서 개인도 수익)

2. 하락장 (Bear Market: KOSPI 60일 MA < 200일 MA, VIX > 25):
   외국인 순매도 → 강한 하락 신호 (글로벌 리스크 오프)
   기관 순매수 → 안정 매수(NPS) vs 가치 매수 구분 필요
   개인 역발행 → 강한 유효 (패닉 매수 → 추가 하락)

3. 횡보장 (Range-Bound: ATR/close < 0.015, 20일 방향성 불명확):
   외국인 순매수 → 약한 신호 (방향성 불확실)
   기관 순매수 → 윈도 드레싱 여부 확인 필요
   개인 역발행 → 중간 유효

4. 위기 (Crisis: VKOSPI > 35, 일간 하락 > -3%):
   모든 수급 신호 → 비활성화 또는 극도의 감산
   이유: 유동성 고갈 시 모든 투자자가 비정보적 매도 (fire sale)
   Doc 20 §6 서킷브레이커 참조
```

### 8.2 레짐 조건부 가중치 조정

```
레짐 감지 함수:

  regime_t = f(MA_cross, VKOSPI, daily_return)

  MA_cross = sign(MA_60 - MA_200)     (+1: bull, -1: bear)
  VKOSPI_level:  < 15: calm, 15-25: normal, 25-35: stressed, > 35: crisis

레짐별 가중치 조정 테이블:
  | 레짐 | w_foreign | w_institutional | w_retail | flowMult_cap |
  |------|-----------|----------------|----------|-------------|
  | Bull | 0.50 | 0.30 | -0.20 | ±10% |
  | Bear | 0.60 | 0.20 | -0.30 | ±15% |
  | Range | 0.40 | 0.25 | -0.15 | ±7% |
  | Crisis | 0.20 | 0.10 | -0.05 | ±3% |

위기 레짐에서 전체 수급 신호의 영향이 극도로 감소한다.
이는 위기 시 수급 데이터의 정보 함량이 급격히 하락하기 때문이다.
```

### 8.3 외생적 충격과 수급 단절

```
외생적 충격 이벤트 (Exogenous Shock Events):

정의: 수급의 정보 함량을 단절시키는 비시장 이벤트
  - 지정학 리스크 (북한 도발, 미중 관세, 2026.03 관세 위기)
  - MSCI 리밸런싱 (§3.4)
  - 대규모 IPO (공모주 수급 왜곡)
  - 제도 변경 (공매도 재개/금지, 거래세 인하)

충격 기간 처리:
  event_window = [event_date - 5, event_date + 10]

  해당 기간 동안:
    1. 수급 신호 가중치 50% 감산
    2. 패턴 신뢰도 조정에 수급 반영 제한
    3. 충격 후 5일간 점진적 복구 (linear ramp-up)

  flowMult_shock = flowMult × max(0.5, min(1.0, (t - event_date) / 10))
```

참고문헌:
- Choe, H., Kho, B.-C. & Stulz, R. (1999). Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997. *JFE*, 54(2), 227-264.
- Boyer, B. (2011). Style-Related Comovement: Fundamentals or Labels? *JF*, 66(1), 307-332.
- Jotikasthira, C., Lundblad, C. & Ramadorai, T. (2012). Asset Fire Sales and Purchases and the International Transmission of Funding Shocks. *JF*, 67(6), 2015-2050.

---

## 9. 수급 데이터 수집과 처리 (Data Pipeline)

### 9.1 KRX 투자자별 매매 데이터 구조

```
KRX 데이터 소스:

1차 소스: KRX 정보데이터시스템 (data.krx.co.kr)
  - 투자자별 매매동향 (일별, 종목별)
  - 무료, 일 1회 업데이트 (18:00 KST 이후)

2차 소스: pykrx 라이브러리 (기존 download_ohlcv.py에서 사용)
  - pykrx.stock.get_market_trading_value_by_date()
  - 투자자 유형: 금융투자, 보험, 투신, 사모, 은행, 기타금융,
                연기금, 기타법인, 개인, 외국인, 기타외국인

3차 소스: FinanceDataReader
  - 투자자별 매매 데이터 일부 제공

데이터 구조 (JSON):
{
  "code": "005930",
  "market": "KOSPI",
  "investor_daily": [
    {
      "date": "2025-01-02",
      "foreign": { "buy": 1234567890, "sell": 987654321, "net": 246913569 },
      "institutional": { "buy": ..., "sell": ..., "net": ... },
      "retail": { "buy": ..., "sell": ..., "net": ... },
      "pension": { "buy": ..., "sell": ..., "net": ... },
      "trust": { "buy": ..., "sell": ..., "net": ... },
      "insurance": { "buy": ..., "sell": ..., "net": ... },
      "bank": { "buy": ..., "sell": ..., "net": ... }
    },
    ...
  ]
}

단위: 원(KRW). 표시 변환: toEok() (Doc financial.md 참조)
```

### 9.2 데이터 파이프라인 설계

```
다운로드 스크립트: download_investor.py (미구현, 설계)

사용법:
  python scripts/download_investor.py                    # 전체 종목
  python scripts/download_investor.py --code 005930     # 단일 종목
  python scripts/download_investor.py --market KOSPI    # 시장별
  python scripts/download_investor.py --days 250        # 기간 지정 (기본: 250일)

처리 파이프라인:
  1. pykrx API 호출 (0.5초 rate limit — Doc financial.md 참조)
  2. 투자자 유형 집계:
     - foreign = 외국인 + 기타외국인
     - institutional = 금융투자 + 보험 + 투신 + 사모 + 은행 + 기타금융 + 연기금
     - retail = 개인
     - pension = 연기금 (기관의 부분집합이나, 별도 추적)
  3. 일별 순매수 = buy - sell (각 유형별)
  4. JSON 저장: data/derivatives/investor/{code}.json
  5. 누적 지표 사전 계산: 5/20/60일 CumNetBuy, NormFlow

의존성: pykrx (이미 requirements에 포함)
저장 크기: 종목당 ~50KB (250일 × 7유형)
전체: ~2,700종목 × 50KB ≈ 135MB
```

### 9.3 데이터 품질 관리

```
품질 검증 항목:

1. 수급 합산 일관성:
   foreign_net + institutional_net + retail_net + etc_net ≈ 0
   (시장 전체 순매수 = 순매도, 오차 < 거래대금의 0.1%)

2. 결측일 처리:
   - 휴장일: 데이터 없음 (정상)
   - 거래 정지일: 모든 수급 = 0
   - API 오류: 이전 영업일 데이터로 보간하지 않음 (NaN 유지)

3. 이상치 탐지:
   |NetBuy_k| > 10 × σ_k (20일 rolling)
   → 플래그 처리, MSCI/IPO 등 이벤트 여부 확인

4. 종목 변경 이력:
   - 상장폐지: 해당일 이후 데이터 중단
   - 종목 코드 변경: 신규 코드로 연결
   - 유상증자/무상증자: 순매수 절대값 불연속 주의
```

---

## 10. CheeseStock 구현 경로 (Implementation Roadmap)

### 10.1 signalEngine.js 통합

```
수급 신호의 signalEngine.js 통합 방안:

현재 signalEngine 구조 (Doc Architecture 참조):
  16 indicator signals + 6 composite signals
  → 수급 신호 4종 추가

추가 신호 정의:
  {
    id: 'foreignFlow',
    name: '외국인 수급',
    type: 'flow',
    category: 'investor',
    calc: function(candles, investorData) {
      // NormCumFlow_FOR(t, 20) 계산
      // Z-score 변환
      // 레짐 조건부 가중치 적용
      return { direction: +1/-1, strength: 0-1, z: float };
    }
  },
  {
    id: 'institutionalFlow',
    name: '기관 수급',
    type: 'flow',
    category: 'investor',
    // ...
  },
  {
    id: 'retailContrarian',
    name: '개인 역발행',
    type: 'contrarian',
    category: 'investor',
    // 부호 반전: 개인 매수 → 매도 신호
  },
  {
    id: 'flowAlignment',
    name: '수급 합치',
    type: 'composite',
    category: 'investor',
    // 외국인+기관+개인 3-way 합치/괴리
  }
```

### 10.2 패턴 신뢰도 연동

```
기존 패턴 신뢰도 조정 체계와의 통합:

현재 신뢰도 승수 (Doc 35 §13 참조):
  confidence = base
             × ycRegimeMult      (수익률 곡선: 0.85~1.05)
             × creditMult        (크레딧: 0.85~1.02)
             × ddMult            (DD: 0.70~1.15)
             × rateBetaMult      (금리 민감도: 0.90~1.05)

수급 승수 추가:
  confidence = base
             × ycRegimeMult
             × creditMult
             × ddMult
             × rateBetaMult
             × flowMult          (수급: 0.90~1.10) ← 신규

flowMult 산출:
  flowMult = 1 + alpha_flow × clip(IFS_t, -2, +2) × pattern_direction

  alpha_flow = 0.05
  pattern_direction = +1 (bullish pattern) / -1 (bearish pattern)

  수급이 패턴과 동일 방향 → flowMult > 1.0 (신뢰도 증가)
  수급이 패턴과 반대 방향 → flowMult < 1.0 (신뢰도 감소)

전체 합산 범위 (극단):
  0.46 × 0.90 = 0.414 (최소)
  1.29 × 1.10 = 1.419 (최대)
```

### 10.3 backtester.js 확장

```
백테스터 수급 오버레이:

현재 backtester.js 구조:
  패턴 탐지 → N일 후 수익률 → WLS 회귀 예측

수급 오버레이 추가:
  1. 패턴 발생 시점의 수급 상태 기록
  2. 수급 조건부 패턴 성과 분석
  3. WLS 회귀에 수급 변수 추가 (Doc 23 APT 확장)

조건부 백테스트:
  for each pattern:
    case A: pattern + 외국인 매수 → r_A
    case B: pattern + 외국인 매도 → r_B
    case C: pattern + 수급 중립   → r_C

    수급 필터 효과 = (r_A - r_C) / σ(r_C)
    → 유의미한 차이 시 수급 신호를 패턴 필터로 채택

WLS 확장 (Doc 23 §CZW 확장 연결):
  기존 12열 + 수급 3열 = 15열 회귀
  추가 열: foreignFlowZ, institutionalFlowZ, retailFlowZ
```

### 10.4 Worker 프로토콜 확장

```
Web Worker 메시지 프로토콜 확장:

현재 (Doc patterns.md 참조):
  → { type:'analyze', candles, realtimeMode, version }
  ← { type:'result', patterns, signals, stats, version }

확장:
  → { type:'analyze', candles, investorData, realtimeMode, version }
  ← { type:'result', patterns, signals, flowSignals, stats, version }

investorData 구조:
  {
    foreign: [{ date, net, cumNet5, cumNet20, cumNet60 }, ...],
    institutional: [{ date, net, cumNet5, cumNet20, cumNet60 }, ...],
    retail: [{ date, net, cumNet5, cumNet20, cumNet60 }, ...],
    pension: [{ date, net, cumNet5, cumNet20, cumNet60 }, ...]
  }

flowSignals 구조:
  {
    foreignFlow: { direction, strength, z, streak },
    institutionalFlow: { direction, strength, z, streak },
    retailContrarian: { direction, strength, z },
    flowAlignment: { type: 'strong_buy'|'weak_buy'|..., score },
    flowMult: 0.90~1.10,
    fpd: { phase: 'accumulation'|'distribution'|'confirmation', strength }
  }
```

### 10.5 데이터 폴백 전략

```
수급 데이터 가용성에 따른 3-tier 폴백:

Tier 1: 실시간 수급 (WS 모드 + Kiwoom 체결)
  → 가장 정확, 실시간 FlowSignal 계산
  → 현재 미구현 (Koscom 전환 후 가능)

Tier 2: 일별 수급 (파일 모드 + download_investor.py)
  → 전일 기준 수급 신호 (1일 지연)
  → data/derivatives/investor/{code}.json
  → 주요 구현 대상

Tier 3: 수급 없음 (데이터 미수집 종목)
  → flowMult = 1.00 (수급 효과 없음)
  → flowSignals = null
  → 기존 패턴 신뢰도 체계로만 운영

Tier 판별:
  if (investorData && investorData.foreign.length > 20) → Tier 2
  else → Tier 3
```

---

## 11. 문서 간 교차참조 (Cross-Reference Map)

| 이 문서 절 | 참조 문서 | 참조 절 | 내용 |
|-----------|----------|--------|------|
| §2.2 Kyle 모형 | 18_behavioral_market_microstructure.md | §1 | Kyle lambda, 가격 충격 |
| §2.4 PIN | 18_behavioral_market_microstructure.md | §2 | VPIN, 주문흐름 독성 |
| §3.4 MSCI 리밸런싱 | 28_cross_market_correlation.md | §3 | 외국인 자금 흐름, MSCI |
| §3.5 환율 교호작용 | 20_krx_structural_anomalies.md | §4 | 외국인 흐름-지정학 |
| §4.2 LSV 군집 | 19_social_network_effects.md | §5 | CSAD/Chang 군집 측정 |
| §5.1 행동 편향 | 04_psychology.md | §1-3 | 전망이론, 처분효과 |
| §5.3 복권주 | 32_search_attention_pricing.md | §3 | 주의 기반 매수 |
| §5.5 KOSDAQ 개인 | 20_krx_structural_anomalies.md | §5 | 개인 투자자 집중 |
| §6.2 가중 신호 | 31_microeconomics_market_signals.md | §1 | 스프레드 분해, 역선택 |
| §7.5 팩터 통제 | 23_apt_factor_model.md | §CZW | APT 팩터, WLS 회귀 |
| §8.1 시장 레짐 | 34_volatility_risk_premium_harv.md | §2 | VRP 레짐 분류 |
| §8.3 외생적 충격 | 20_krx_structural_anomalies.md | §6 | 서킷브레이커 |
| §10.2 신뢰도 연동 | 35_bond_signals_yield_curve.md | §13 | 채권 신호 신뢰도 승수 |

---

## 12. 핵심 정리: 투자자 수급 → CheeseStock 매핑

```
┌─────────────────────────────────────────────────────────────────────┐
│              투자자 수급 신호 → CheeseStock 매핑                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [이론]                    [구현 경로]              [신호]            │
│                                                                     │
│  Grossman-Stiglitz (1980)  정보 비대칭 불가피       이론적 기반        │
│  + Kyle (1985) 3유형       투자자 유형별 분류       information       │
│  ↓ 정보 위계                                       hierarchy         │
│                                                                     │
│  외국인 수급 분석           download_investor.py    foreignFlow       │
│  (Kang-Stulz 1997)         investor/{code}.json    5/20/60일 누적    │
│  ↓ 글로벌 정보                                     leading signal    │
│                                                                     │
│  기관 행동 패턴             투신/연기금/보험 분해    institutionalFlow │
│  (LSV 1992)                군집 측정, 윈도드레싱    herding measure   │
│  ↓ 로컬 정보                                       conditional       │
│                                                                     │
│  개인 역발행                개인 Z-score 반전       retailContrarian  │
│  (Barber-Odean 2000)       주의-수급 교차           contrarian signal │
│  ↓ 노이즈 → 역신호                                 attention cross   │
│                                                                     │
│  복합 수급 체계             3-way 합치/괴리         flowAlignment     │
│  (가중 합산)               지속성 + 강도            composite score   │
│  ↓ 정보 통합                                       IFS score         │
│                                                                     │
│  수급-가격 괴리             Wyckoff 단계 추정       fpd (flow-price   │
│  (Barclay-Warner 1993)     축적/분산 탐지           divergence)       │
│  ↓ 스마트머니 추적                                  accumulation      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  패턴 신뢰도 = base                                       │      │
│  │              × ycRegimeMult    (수익률 곡선: 0.85~1.05)   │      │
│  │              × creditMult      (크레딧: 0.85~1.02)        │      │
│  │              × ddMult          (DD: 0.70~1.15)            │      │
│  │              × rateBetaMult    (금리 민감도: 0.90~1.05)   │      │
│  │              × flowMult        (수급: 0.90~1.10)   ← 신규 │      │
│  │  합산 범위 (극단): 0.414 ~ 1.419                           │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  레짐 의존성:                                                        │
│  - Bull: 표준 가중치, flowMult ±10%                                  │
│  - Bear: 외국인 가중 ↑, 개인 역발행 ↑, flowMult ±15%               │
│  - Crisis: 전체 수급 신호 감산, flowMult ±3%                         │
│  - 외생 충격(MSCI, 지정학): 수급 가중치 50% 감산                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. 한계와 향후 과제 (Limitations & Future Work)

### 13.1 데이터 한계

```
현재 데이터 제약:

1. 일별 집계 한계:
   - 장중 수급 역전(오전 매수 → 오후 매도)이 일별 데이터에서 관측 불가
   - Intraday flow reversal: 약 15-20%의 거래일에서 발생 추정
   - 해결: Koscom 실시간 체결 데이터 전환 시 분별 수급 계산 가능

2. 매수/매도 분류 부재:
   - KRX 투자자별 매매동향은 순매수/순매도 금액만 제공
   - 체결 건수, 주문 크기 분포, 매수/매도 호가 정보 없음
   - PIN, VPIN, 은밀 거래 탐지에 필요한 tick-level 데이터 부재

3. 기관 세부 유형 제한:
   - pykrx: 투신, 보험, 은행, 연기금 등 7세부 유형 제공
   - 개별 펀드/기관 식별 불가 → LSV 군집 지표 정밀 계산 제한
   - 해결: DART 5% 보고서(대량보유 보고) 활용 가능 (주요 주주만)

4. 외국인 세부 유형 제한:
   - 패시브(ETF/인덱스) vs 액티브(헤지펀드/장기 투자자) 구분 불가
   - MSCI 리밸런싱 기간의 패시브 수급과 정보 수급 분리 어려움
```

### 13.2 이론적 한계

```
1. 인과관계 vs 상관관계:
   수급이 가격을 예측하는가, 아니면 가격이 수급을 유발하는가?
   → 내생성(endogeneity) 문제
   → Granger 인과검정으로 부분적 검증 가능하나, 진정한 인과관계 증명 어려움

2. 수급 신호의 알파 감쇠:
   수급 신호가 널리 알려지면 차익거래로 알파가 소멸 (Doc 20 §5.2)
   → 지속적 모니터링과 가중치 재보정 필요

3. 시장 구조 변화:
   - 공매도 재개(2025.03.31): 공매도 데이터와 수급 신호의 상호작용 미지수
   - 알고리즘 트레이딩 확대: 투자자 유형 경계 모호화
   - MSCI DM 편입 시: 외국인 구성 근본적 변화
```

### 13.3 향후 구현 우선순위

```
Phase 1 (단기, 2-4주):
  - download_investor.py 스크립트 작성
  - data/derivatives/investor/ 디렉토리 구조 확립
  - 외국인 5/20/60일 누적 순매수 지표 계산
  - signalEngine.js에 foreignFlow 신호 1종 추가

Phase 2 (중기, 1-2개월):
  - 기관/개인 수급 신호 추가 (institutionalFlow, retailContrarian)
  - flowAlignment 복합 신호 구현
  - 패턴 신뢰도 flowMult 연동
  - backtester.js에 수급 조건부 성과 분석

Phase 3 (장기, 3-6개월):
  - 수급-가격 괴리(FPD) 축적/분산 탐지
  - Wyckoff 단계 자동 추정
  - 레짐 조건부 가중치 동적 조정
  - WS 모드에서 실시간 수급 신호 (Koscom 전환 후)
```

---

## 참고문헌

1. Grossman, S.J. & Stiglitz, J.E. (1980). On the Impossibility of Informationally Efficient Markets. *American Economic Review*, 70(3), 393-408.
2. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
3. Kang, J.-K. & Stulz, R. (1997). Why Is There a Home Bias? An Analysis of Foreign Portfolio Equity Ownership in Japan. *Journal of Financial Economics*, 46(1), 3-28.
4. Choe, H., Kho, B.-C. & Stulz, R. (1999). Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997. *Journal of Financial Economics*, 54(2), 227-264.
5. Choe, H., Kho, B.-C. & Stulz, R. (2005). Do Domestic Investors Have an Edge? The Trading Experience of Foreign Investors in Korea. *Review of Financial Studies*, 18(3), 795-829.
6. Grinblatt, M. & Keloharju, M. (2000). The Investment Behavior and Performance of Various Investor Types. *Journal of Financial Economics*, 55(1), 43-67.
7. Barber, B.M. & Odean, T. (2000). Trading Is Hazardous to Your Wealth. *Journal of Finance*, 55(2), 773-806.
8. Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors. *Review of Financial Studies*, 21(2), 785-818.
9. Kumar, A. (2009). Who Gambles in the Stock Market? *Journal of Finance*, 64(4), 1889-1933.
10. Lakonishok, J., Shleifer, A. & Vishny, R. (1992). The Impact of Institutional Trading on Stock Prices. *Journal of Financial Economics*, 32(1), 23-43.
11. Lakonishok, J., Shleifer, A., Thaler, R. & Vishny, R. (1991). Window Dressing by Pension Fund Managers. *American Economic Review P&P*, 81(2), 227-231.
12. Wermers, R. (1999). Mutual Fund Herding and the Impact on Stock Prices. *Journal of Finance*, 54(2), 581-622.
13. Sias, R. (2004). Institutional Herding. *Review of Financial Studies*, 17(1), 165-206.
14. Nofsinger, J. & Sias, R. (1999). Herding and Feedback Trading by Institutional and Individual Investors. *Journal of Finance*, 54(6), 2263-2295.
15. Barclay, M. & Warner, J. (1993). Stealth Trading and Volatility: Which Trades Move Prices? *Journal of Financial Economics*, 34(3), 281-305.
16. Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity, Information, and Infrequently Traded Stocks. *Journal of Finance*, 51(4), 1405-1436.
17. Froot, K., O'Connell, P. & Seasholes, M. (2001). The Portfolio Flows of International Investors. *Journal of Financial Economics*, 59(2), 151-193.
18. Griffin, J., Harris, J. & Topaloglu, S. (2003). The Dynamics of Institutional and Individual Trading. *Journal of Finance*, 58(6), 2285-2320.
19. Richards, A. (2005). Big Fish in Small Ponds: The Trading Behavior and Price Impact of Foreign Investors in Asian Emerging Equity Markets. *Journal of Financial and Quantitative Analysis*, 40(1), 1-27.
20. Campbell, J., Ramadorai, T. & Schwartz, A. (2009). Caught on Tape: Institutional Trading, Stock Returns, and Earnings Announcements. *Journal of Financial Economics*, 92(1), 66-91.
21. Kaniel, R., Saar, G. & Titman, S. (2008). Individual Investor Trading and Stock Returns. *Journal of Finance*, 63(1), 273-310.
22. Hau, H. (2001). Location Matters: An Examination of Trading Profits. *Journal of Finance*, 56(5), 1959-1983.
23. Dvorak, T. (2005). Do Domestic Investors Have an Information Advantage? Evidence from Indonesia. *Journal of Finance*, 60(2), 817-839.
24. Shefrin, H. & Statman, M. (1985). The Disposition to Sell Winners Too Early and Ride Losers Too Long. *Journal of Finance*, 40(3), 777-790.
25. Bali, T., Cakici, N. & Whitelaw, R. (2011). Maxing Out: Stocks as Lotteries and the Cross-Section of Expected Returns. *Journal of Financial Economics*, 99(2), 427-446.
26. Han, B. & Kumar, A. (2013). Speculative Retail Trading and Asset Prices. *Journal of Financial and Quantitative Analysis*, 48(2), 377-404.
27. Fama, E. & MacBeth, J. (1973). Risk, Return, and Equilibrium: Empirical Tests. *Journal of Political Economy*, 81(3), 607-636.
28. Jotikasthira, C., Lundblad, C. & Ramadorai, T. (2012). Asset Fire Sales and Purchases and the International Transmission of Funding Shocks. *Journal of Finance*, 67(6), 2015-2050.
29. Boyer, B. (2011). Style-Related Comovement: Fundamentals or Labels? *Journal of Finance*, 66(1), 307-332.
30. Wyckoff, R. (1931). *The Richard D. Wyckoff Method of Trading and Investing in Stocks*. Wyckoff Associates.
31. Chen, L.W., Johnson, S.A. & Lin, J.C. (2014). The Effect of MSCI Standard Index Reconstitutions on Stock Prices and Volumes. *Pacific-Basin Finance Journal*, 29, 53-71.

---

*본 문서는 CheeseStock 프로젝트의 투자자 수급 신호 이론적 기반을 제공한다.*
*Doc 18(시장 미시구조), Doc 20(KRX 구조), Doc 04(행동재무)의 투자자 행동 관련*
*내용을 심화·확장하며, 외국인·기관·개인 수급 데이터가 개별 종목 패턴 분석에*
*어떻게 매핑되는지를 명시한다.*
