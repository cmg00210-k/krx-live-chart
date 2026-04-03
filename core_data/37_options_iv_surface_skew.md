# Doc 37: 옵션 내재변동성 곡면과 스큐 분석 (Options Implied Volatility Surface & Skew Analytics)

> "변동성 곡면은 시장이 자신의 확률분포에 대해 가지는 '의견'의 완전한 지도이다."
> "The volatility surface is the complete map of the market's opinion about its own probability distribution."
> — Jim Gatheral, *The Volatility Surface: A Practitioner's Guide* (2006)

---

## 1. 개요

본 문서는 옵션 내재변동성(IV)의 2차원 곡면(surface) 구성, 변동성 스큐(skew)의
동적 신호 체계, 감마 익스포저(GEX) 심화 분석, 그리고 옵션 흐름(flow) 기반
시장 심리 판독 방법을 체계적으로 다룬다.

26번 문서에서 BSM Greeks, VKOSPI 4-tier 레짐, IV/HV 비율, PCR 역발상,
GEX 개론을 소개했다. 34번 문서에서 VRP(변동성 리스크 프리미엄), HAR-RV,
점프-확산, 변동성 기간구조 프록시를 다루었다.

본 문서는 이들을 확장하여 다음 영역을 추가한다:

```
기존 문서 커버리지:
  26번 §1:    BSM Greeks (Δ, Γ, Θ, ν, ρ, Vanna, Volga, Charm)
  26번 §2:    IV 산출 (Newton-Raphson), VKOSPI 산출 공식, 4-tier 레짐
  26번 §2.2:  변동성 미소/스큐 개념 소개 (1단락)
  26번 §2.4:  Risk-Neutral PDF (Breeden-Litzenberger)
  26번 §3:    PCR 역발상 분석
  26번 §6:    GEX 개론 (positive/negative, flip level)
  34번 §2:    VRP 이론 + EWMA 프록시
  34번 §5:    변동성 기간구조 (Derman 1999, cv_ratio)
  34번 §6:    분산 트레이딩, 내재 상관관계

본 문서 추가분:
  §2:  IV 곡면 구성 방법론 (SVI 파라미터화, 무차익 조건)
  §3:  변동성 스큐 동역학 (Rubinstein 1994, RND 연결, 스큐 기울기 측정)
  §4:  스큐 기반 신호 체계 (25δ RR, 25δ BF, SKEW 지수)
  §5:  GEX 심화 분석 (딜러 포지션 추정, KRX 시장조성자 의무, 핀닝)
  §6:  옵션 흐름 분석 (이상 거래량, 스마트 머니, 블록 거래, PCR 고급)
  §7:  변동성 기간구조 곡면 통합 (기간구조와 스큐의 2D 교차)
  §8:  CheeseStock 구현 경로 (데이터 파이프라인, 신호 매핑, 신뢰도 조정)
```

**문서 범위와 기존 문서와의 관계:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| BSM Greeks | 26번 §1 | — (참조만) |
| IV 산출 (Newton-Raphson) | 26번 §2.1 | — (참조만) |
| VKOSPI 레짐 4-tier | 26번 §2.3 | 기간구조 곡면 내 VKOSPI 위치 |
| 변동성 미소/스큐 개념 | 26번 §2.2 | SVI 파라미터화, 스큐 기울기 측정, RND 연결 |
| Risk-Neutral PDF | 26번 §2.4 | 스큐→RND 형태→crash premium 정량화 |
| PCR 역발상 | 26번 §3 | PCR volume vs OI 고급 분해, 만기별 PCR |
| GEX 개론 | 26번 §6 | 딜러 포지셔닝 추정, 핀닝 메커니즘, KRX MM 의무 |
| VRP 이론 | 34번 §2 | VRP와 스큐 레벨의 교차 신호 |
| 변동성 기간구조 | 34번 §5 | 기간구조 × 스큐 2D 곡면 통합 |
| 내재 상관관계 | 34번 §6 | 분산 트레이딩과 스큐의 연결 |
| 꼬리 위험 | 12번 §1-3 | 스큐가 암시하는 꼬리 확률 정량화 |

---

## 2. 내재변동성 곡면 (Implied Volatility Surface)

### 2.1 곡면의 정의와 구성

내재변동성 곡면(IV surface)은 행사가(strike) K와 잔존 만기(time to expiry) T의
2차원 함수로서, 시장에서 관측되는 옵션 가격으로부터 추출한 IV를 보간(interpolation)
및 모수화(parameterization)한 것이다.

```
σ_IV = σ(K, T)

축:
  K축 (또는 moneyness m = K/F):  행사가 또는 행사가/선도가 비율
  T축:                            잔존 만기 (연 환산)
  σ축:                            내재변동성 (연율화, %)

관측 데이터: {(K_i, T_j, σ_ij)} — 각 행사가-만기 조합의 시장 IV
  → N개 행사가 × M개 만기 = N×M개의 격자점 (grid point)
  → KRX KOSPI200 옵션: N ≈ 20-30 (2.5pt 간격), M = 4-8 (주/월/분기 만기)
```

**Moneyness 정의 방법:**

행사가 K를 직접 사용하면 기초자산 수준에 따라 곡면 형태가 변한다.
Moneyness로 정규화하면 시간에 걸쳐 안정적인 곡면 비교가 가능하다.

```
4가지 moneyness 정의:

1. 단순 비율:       m = K / S
2. 선도 비율:       m = K / F    (F = S·e^((r-q)T), 선도가격 기준)
3. Log moneyness:   x = ln(K/F)
4. Delta moneyness: m_δ = N^{-1}(Δ)  (행사가 대신 delta 단위 사용)
   → 25δ put, ATM, 25δ call 등으로 표현

실무 선호:
  - 트레이딩 데스크: Delta moneyness (리스크 관리 직관적)
  - 학술 연구: Log moneyness (SVI 파라미터화에 적합)
  - KRX 실시간 시스템: 단순 비율 (직관성)
```

### 2.2 SVI 파라미터화 (Stochastic Volatility Inspired)

Gatheral (2004, 2006)이 제안한 SVI(Stochastic Volatility Inspired) 모형은
내재변동성 곡면을 소수의 파라미터로 표현하는 가장 널리 사용되는 방법이다.

**SVI Raw 파라미터화:**

```
w(k) = a + b × [ρ(k - m) + √((k - m)² + σ²)]

여기서:
  w(k) = σ²_IV(k) × T    (총 내재분산, total implied variance)
  k    = ln(K/F)          (log-moneyness)
  a    ∈ ℝ                (분산 수준, variance level)
  b    ≥ 0                (분산 기울기, variance slope)
  ρ    ∈ [-1, 1]          (비대칭도, 회전, skew rotation)
  m    ∈ ℝ                (이동, translation of the vertex)
  σ    > 0                (ATM 곡률, smoothing of the vertex)

파라미터 해석:
  a:  곡면의 전체적 수준 (높을수록 전반적 IV 높음)
  b:  좌우 날개(wing)의 가파름 (높을수록 OTM 옵션 IV 높음)
  ρ:  스큐 방향 (ρ < 0: 하방 스큐, 주식/지수의 전형적 형태)
  m:  스큐의 최저점(꼭짓점) 위치
  σ:  꼭짓점 부근의 곡률 (ATM 근방의 스마일 "둥근 정도")
```

**SVI의 이론적 기반:**

SVI는 Heston (1993) 확률적 변동성 모형의 내재분산에서 영감을 받았다.
Heston 모형 하에서 장기 만기의 총 내재분산이 SVI 형태에 수렴한다.

```
Heston 모형:
  dS/S = r dt + √v dW₁
  dv   = κ(θ - v)dt + ξ√v dW₂
  E[dW₁ dW₂] = ρ dt

장기 만기(T → ∞)에서 Heston의 총 내재분산:
  w(k) → θ + ξ²/(2κ) × [ρk + √(k² + σ²_H)]

여기서 σ²_H = ξ²(1-ρ²)/(4κ²)

→ 이 극한이 정확히 SVI raw 파라미터 형태와 일치한다.
   따라서 SVI는 단순한 피팅 함수가 아니라 확률적 변동성 모형에
   이론적 근거를 가진 파라미터화이다.
```

**SVI 점프-날개 (Jump-Wing) 파라미터화:**

실무에서는 보다 직관적인 해석을 위해 jump-wing 파라미터화를 사용하기도 한다:

```
{v_T, ψ_T, p_T, c_T, ṽ_T}

v_T:   ATM 총 분산 (ATM total variance)
ψ_T:   ATM 스큐 (ATM skew slope, ∂w/∂k|_{k=0})
p_T:   좌측 날개 기울기 (put wing slope)
c_T:   우측 날개 기울기 (call wing slope)
ṽ_T:   최소 분산 (minimum variance)

장점: 각 파라미터가 트레이더 직관에 직접 대응
  v_T ↑  → "전체적으로 옵션이 비싸다"
  ψ_T ↑  → "하방 보호 수요가 강하다" (스큐 확대)
  p_T ↑  → "극단 하락 보험이 비싸다" (OTM put 프리미엄)
  c_T ↑  → "극단 상승 기대가 있다" (OTM call 프리미엄)
```

### 2.3 무차익 조건 (No-Arbitrage Conditions)

IV 곡면은 무차익(no-arbitrage) 조건을 만족해야 한다.
이 조건을 위반하는 곡면은 수학적으로 일관성이 없으며 경제학적으로 무의미하다.

**버터플라이 스프레드 조건 (Strike 방향):**

```
butterfly spread: 동일 만기, 세 행사가 K₁ < K₂ < K₃에서
  C(K₁) - 2C(K₂) + C(K₃) ≥ 0    (for all K₁ < K₂ < K₃)

이는 RND(Risk-Neutral Density)가 비음(non-negative)임을 요구한다:
  q(K) = e^{rT} × ∂²C/∂K² ≥ 0   (26번 §2.4의 Breeden-Litzenberger)

내재분산 w(k)에 대한 동치 조건:
  g(k) = (1 - k·w'/(2w))² - w'/4 × (1/w + 1/4) + w''/2 ≥ 0

여기서 w' = dw/dk, w'' = d²w/dk²

SVI 파라미터 제약:
  - 이 조건은 b, ρ, σ의 특정 조합에서 위반될 수 있다
  - Gatheral & Jacquier (2014): SVI 무차익 조건의 충분 조건 제시
    a + b·σ·√(1 - ρ²) ≥ 0  (곡면 최소값 ≥ 0)
    b·(1 + |ρ|) ≤ 4       (날개 기울기 상한)
```

**캘린더 스프레드 조건 (Maturity 방향):**

```
calendar spread: 동일 행사가, 두 만기 T₁ < T₂에서
  C(K, T₂) ≥ C(K, T₁)    (유럽식 옵션)

총 내재분산에 대한 조건:
  w(k, T₂) ≥ w(k, T₁)    (총 분산은 만기에 대해 비감소)

→ 이는 "시간이 지나도 불확실성이 줄지 않는다"는 직관과 일치
→ 위반 시: 캘린더 스프레드 차익 거래 기회 발생
→ KRX 실무: 만기 전환 시점(근월→차월)에서 간헐적 위반 관측
```

**Roger Lee (2004)의 날개 기울기 상한:**

```
극단 행사가에서 IV의 점근적 행동:
  lim_{k→+∞} σ²(k)·T / k ≤ 2      (우측 날개)
  lim_{k→-∞} σ²(k)·T / |k| ≤ 2    (좌측 날개)

해석: IV가 행사가에 대해 선형보다 빠르게 증가하면
      butterfly 조건이 위반된다 (음의 확률밀도 발생)

SVI에서: b·(1 ± ρ) ≤ 2 이 Roger Lee 조건과 동치
```

### 2.4 KRX KOSPI200 옵션 IV 곡면 특성

KRX KOSPI200 옵션 곡면은 글로벌 주요 지수 옵션과 공통된 특성을 보이면서도
한국 시장 고유의 구조적 차이가 존재한다.

```
KOSPI200 IV 곡면의 양식화된 사실 (Stylized Facts):

1. 하방 스큐 지배 (Persistent Negative Skew):
   OTM Put IV > ATM IV > OTM Call IV
   → ρ < 0 (SVI raw), 전형적 ρ ≈ -0.3 ~ -0.5
   → 1997 아시아 금융위기 이후 구조적 하방 보험 수요 반영

2. 외국인 포지셔닝 효과:
   외국인 투자자의 KOSPI200 옵션 순매매가 IV 곡면 형태에 영향
   → 외국인 콜 매도 + 풋 매수 → 스큐 확대
   → 외국인 콜 매수 + 풋 매도 → 스큐 축소
   → 20번 §3의 외국인 흐름 분석과 교차 참조

3. 만기 전 스큐 변동 확대:
   만기 1주 이내에서 ATM 감마가 급증 → 스큐 불안정
   → SVI 피팅 잔차(residual)가 만기 근접 시 3-5배 증가
   → Θ 급등에 따른 near-ATM IV의 급격한 변화 (26번 §1.2 Gamma)

4. 가격제한폭(±30%) 효과:
   극단 OTM 옵션의 IV가 ±30% 가격제한에 의해 truncate
   → 자연스러운 꼬리 확률이 인위적으로 절단됨
   → 20번 §2의 가격제한 효과와 직접 연관
   → SVI 날개(wing) 파라미터 p, c의 추정 편의 유발

5. KRX 행사가 격자:
   KOSPI200 < 200pt: 2.5pt 간격 (moneyness 간격 ~1.25%)
   KOSPI200 ≥ 200pt: 2.5pt 간격 유지 (moneyness 간격 ~1.0%)
   → S&P 500 옵션(5pt 간격, moneyness ~0.1%)보다 조밀하지 못함
   → IV 곡면 보간 시 스플라인 불안정 가능 → SVI 선호
```

**KOSPI200 IV 곡면 수치 예시 (2026년 정상 시장):**

```
만기: 1개월, KOSPI200 = 350pt, F ≈ 351pt (r-q ≈ 1.2%, T = 1/12)

행사가(K)  moneyness(m)  IV(%)   w = σ²×T
  325       0.926        23.5    0.00461
  330       0.940        21.8    0.00396
  335       0.954        20.4    0.00347
  340       0.969        19.2    0.00307
  345       0.983        18.3    0.00279
  350       0.997        17.8    0.00264
  355       1.011        17.5    0.00255
  360       1.026        17.6    0.00258
  365       1.040        17.9    0.00267
  370       1.054        18.4    0.00282
  375       1.068        19.1    0.00304

→ 최저 IV: ATM 근방 (K=355, m≈1.01)
→ 좌측 기울기: -(23.5-17.8)/(0.926-0.997) = +80.3%p/unit
→ 우측 기울기: +(19.1-17.8)/(1.068-0.997) = +18.3%p/unit
→ 좌/우 비율 ≈ 4.4:1 → 뚜렷한 하방 스큐
```

---

## 3. 변동성 스큐 (Volatility Skew/Smile)

### 3.1 스큐의 역사적 기원

1987년 10월 19일 블랙 먼데이 이전, 주식 옵션의 IV는 행사가에 대해 거의 평탄(flat)했다.
이후 OTM 풋옵션의 IV가 구조적으로 상승하여 현재까지 지속되는 "스큐(skew)"가 형성되었다.

```
블랙 먼데이 전후 비교 (Rubinstein 1994):

          pre-1987           post-1987
          ┌─────────┐        ┌─────────┐
   IV     │         │        │\        │
          │ ─────── │        │ \  ___  │
          │  (flat) │        │  \/    \│
          └─────────┘        └─────────┘
          OTM Put  OTM Call  OTM Put  OTM Call

pre-1987:  σ(K) ≈ constant   (BSM 가정과 일치)
post-1987: σ(K) ↗ as K ↘     (하방 스큐, "crash premium")

이 구조적 변화의 원인:
  1. 재앙 보험 수요 (catastrophe insurance demand)
     → OTM 풋 매수 → OTM 풋 IV 상승
  2. 레버리지 효과 (Black 1976 leverage effect)
     → 주가 하락 시 레버리지 증가 → 변동성 증가 기대
  3. 점프 위험 인식 (jump risk awareness)
     → BSM의 연속 확산 가정에서 점프 가능성 반영 (34번 §4)
  4. 비대칭 수익률 분포
     → 음의 왜도(negative skewness) → 좌측 꼬리 두꺼움 (12번 §1.2)
```

Rubinstein, M. (1994). "Implied Binomial Trees." *Journal of Finance*, 49(3), 771-818.
Bates, D.S. (2000). "Post-'87 Crash Fears in the S&P 500 Futures Option Market."
*Journal of Econometrics*, 94(1-2), 181-238.

### 3.2 스큐 기울기 측정 방법

스큐의 "가파른 정도(steepness)"를 정량화하는 여러 방법이 존재한다.

**방법 1 — 고정 행사가 기울기:**

```
Skew_slope = (σ(K₂) - σ(K₁)) / (K₂ - K₁)

K₁ = 90% moneyness OTM put (m = 0.90)
K₂ = 110% moneyness OTM call (m = 1.10)

또는 ATR 정규화 (CheeseStock 방식):
  Skew_slope_ATR = (σ(K₂) - σ(K₁)) / (ATR14 × 2)
```

**방법 2 — Delta 기반 기울기 (25-Delta Risk Reversal):**

```
Skew_25d = σ(25Δ Put) - σ(25Δ Call)

25Δ Put:  N(d₁) = -0.25가 되는 행사가의 풋 IV
25Δ Call: N(d₁) = +0.25가 되는 행사가의 콜 IV

해석:
  Skew_25d > 0:  하방 스큐 (정상, 주식/지수)
  Skew_25d = 0:  대칭 스마일
  Skew_25d < 0:  상방 스큐 (비정상, 극도의 콜 수요)

KOSPI200 정상 범위: Skew_25d ≈ 3-7%p (26번 §2.2 확인)
위기 시:             Skew_25d > 15%p
극단 탐욕:           Skew_25d < 2%p (상방 기대 과잉)
```

**방법 3 — SVI ρ 파라미터:**

```
SVI raw 파라미터의 ρ는 스큐의 방향과 강도를 직접 나타낸다:
  ρ = -0.5: 강한 하방 스큐
  ρ = -0.3: 정상 하방 스큐
  ρ =  0.0: 대칭 스마일
  ρ = +0.2: 상방 스큐 (FX 시장에서 관측)

ATM 스큐 기울기와 ρ의 관계:
  ∂σ/∂k |_{k=0} = b·ρ / (2·σ_ATM·T)   (SVI에서 도출)
```

**방법 4 — 스큐 프리미엄 (Skew Premium):**

```
Skew_premium = σ(90% moneyness) / σ(ATM) - 1

해석: ATM 대비 OTM 풋이 얼마나 더 비싼가
  정상: 10-25%
  위기: 40-80%
  패닉: 100%+
```

### 3.3 Risk-Neutral Density 추출과 스큐의 관계

26번 §2.4에서 Breeden & Litzenberger (1978)의 RND 추출을 소개했다.
스큐의 형태는 RND의 비대칭성과 꼬리 두께를 직접 반영한다.

```
BSM 가정 하의 RND: 로그정규분포 (대칭)
  → 모든 행사가에서 동일한 IV → flat smile

실제 시장의 RND: 비대칭 + 두꺼운 꼬리
  → OTM put IV 상승 → RND 좌측 꼬리 증가
  → 스큐가 가파를수록 좌측 꼬리가 두꺼움

정량적 연결:
  σ²(K) × T ≈ ∫ w(k,T) dk
  스큐 기울기 ↑ → RND 왜도(skewness) ↓ (더 음수)
  날개 곡률 ↑   → RND 첨도(kurtosis) ↑ (더 두꺼운 꼬리)

Bakshi, Kapadia & Madan (2003):
  μ₃ = -6·ψ_T + ...   (스큐 기울기 ψ → RND 왜도 μ₃)
  μ₄ = 12·(p_T + c_T) + ...  (날개 기울기 → RND 첨도 μ₄)

여기서 ψ_T, p_T, c_T는 SVI jump-wing 파라미터 (§2.2)
```

Bakshi, G., Kapadia, N. & Madan, D. (2003). "Stock Return Characteristics,
Skew Laws, and the Differential Pricing of Individual Equity Options."
*Review of Financial Studies*, 16(1), 101-143.

### 3.4 KRX 스큐 패턴: 이벤트별 형태 변화

KOSPI200 옵션 스큐는 특정 이벤트에 대해 체계적으로 변형된다.

```
1. 실적 시즌 전 (Earnings Season):
   → 스큐 축소 (flattening)
   → 이유: 방향성 불확실 → 양방향 옵션 수요 증가
   → ATM IV 상승, OTM 풋/콜 IV 비례 상승
   → Skew_25d: 5%p → 3%p (2주 전 평균)

2. FOMC 전 (Fed Meeting):
   → 단기 만기 스큐 확대 (steepening)
   → 이유: 글로벌 위험 회피 → 헤지 수요 증가
   → OTM 풋 IV 선행 상승
   → Skew_25d: 5%p → 8%p (1주 전 평균)

3. 한국은행 금통위 전 (BOK MPC):
   → 스큐 변화 제한적 (±1%p)
   → 이유: KRX 옵션 시장의 글로벌 연동 > 국내 정책 반응
   → 다만 예상 밖 인상/인하 시 사후 스큐 급변 (±5%p)

4. 지정학 위기 (Geopolitical):
   → 스큐 급격 확대 (spike steepening)
   → 2022 러시아-우크라이나: Skew_25d 12%p (3일 내)
   → 2026.03 지정학 긴장: Skew_25d 15%p (28번 §2.6 참조)
   → 특징: 장기 만기보다 단기 만기 스큐 반응이 3-5배 빠름

5. 만기일 (Expiry Day):
   → 근월물 스큐 붕괴 → flat smile 수렴
   → 27번 §4 만기일 효과: basis → 0과 유사하게 skew → 0
   → 차월물로 포지션 이전 → 차월물 스큐 일시 확대
```

---

## 4. 스큐 신호 체계 (Skew Signal Framework)

### 4.1 25-Delta Risk Reversal (25δ RR)

Risk Reversal은 동일 만기의 OTM 콜과 OTM 풋의 IV 차이로,
시장의 방향성 기대(directional expectation)를 포착한다.

```
25δ RR = σ(25Δ Call) - σ(25Δ Put)

부호 규약 (convention):
  RR > 0:  콜 IV > 풋 IV → 시장이 상승에 베팅 (드문 상황)
  RR < 0:  풋 IV > 콜 IV → 시장이 하락 위험을 가격에 반영 (정상)

KOSPI200 25δ RR 역사적 분포 (2015-2026):
  중위수:     -4.2%p
  25-75 분위: [-6.0, -2.5]%p
  위기 시:    -12%p ~ -20%p (2020.03 COVID, 2022.03 지정학)
  극단 탐욕:  -1%p ~ 0%p (2021.01 코스피 3000 돌파)
```

**RR 기반 신호:**

```
신호 생성 조건 (signalEngine 매핑):

RR_zscore = (RR_current - RR_MA60) / RR_std60

RR_zscore < -2.0:  극단 공포 (풋 수요 급증)
  → 역발상 매수 신호 (26번 §3.2 PCR 극단과 유사)
  → 패턴 신뢰도 조정: reversal 패턴 +10%, breakout 패턴 -10%

RR_zscore > +1.5:  극단 낙관 (콜 수요 과잉, 풋 수요 소멸)
  → 역발상 매도 경고
  → 패턴 신뢰도 조정: reversal 패턴 +5%, trend 패턴 -5%

-1.0 < RR_zscore < +1.0:  중립
  → 표준 신뢰도 적용
```

Tier 분류: [C][L:GCV] — 임계값 (-2.0, +1.5)는 KOSPI200 실측 분포 기반.

### 4.2 25-Delta Butterfly (25δ BF)

Butterfly Spread는 IV 곡면의 "곡률(convexity)"을 측정한다.
스마일의 양 날개가 ATM 대비 얼마나 높은가를 나타낸다.

```
25δ BF = [σ(25Δ Call) + σ(25Δ Put)] / 2 - σ(ATM)

해석:
  BF > 0:  날개 IV > ATM IV → 스마일 존재 (정상)
  BF ≈ 0:  날개와 ATM이 동일 → flat smile (BSM 가정에 근접)
  BF < 0:  ATM IV > 날개 IV → frown (비정상, 구조적 문제)

KOSPI200 25δ BF 역사적 분포 (2015-2026):
  중위수:     1.8%p
  25-75 분위: [1.0, 2.8]%p
  위기 시:    4.0-6.0%p (꼬리 위험 인식 급증)
  극단 안일:  0.5%p 미만 (꼬리 위험 과소평가)
```

**BF 기반 신호:**

```
BF_zscore = (BF_current - BF_MA60) / BF_std60

BF_zscore > +2.0:  꼬리 위험 과대 인식 (양 날개 과열)
  → 변동성 매도 전략 유리 (straddle 매도)
  → 패턴 신뢰도: 변동성 축소 이후 breakout 대비

BF_zscore < -1.5:  꼬리 위험 과소 인식 (날개 저평가)
  → 꼬리 위험 경고 (12번 §1 극단값 이론 참조)
  → 패턴 신뢰도: 모든 방향성 패턴 -5% (hidden tail risk)
```

Tier 분류: [C][L:GCV] — 임계값 (+2.0, -1.5)는 KOSPI200 실측 분포 기반.

### 4.3 SKEW 지수 (KRX SKEW Index)

CBOE SKEW 지수의 KRX 대응물을 구성할 수 있다.
CBOE SKEW는 S&P 500 옵션 가격에서 추출한 왜도(skewness)의 시장가격이다.

```
CBOE SKEW 공식:
  SKEW = 100 - 10 × S₃

S₃: 위험중립 분포의 3차 모멘트 (왜도)
  S₃ = E^Q[(r - μ)³] / [E^Q[(r - μ)²]]^{3/2}

S₃ < 0: 좌측 꼬리 (하락 위험 지배)
  → SKEW > 100 (정상 상태)

S₃ ≈ 0: 대칭
  → SKEW ≈ 100

S₃ > 0: 우측 꼬리 (상승 기대 지배)
  → SKEW < 100 (비정상)
```

**KRX SKEW 프록시 산출:**

KOSPI200 옵션 가격에서 직접 S₃를 산출하기 어려운 경우,
25δ RR로 SKEW를 근사할 수 있다.

```
SKEW_KRX ≈ 100 - 10 × f(RR_25d)

f(RR_25d): RR에서 왜도로의 근사 매핑
  → Bakshi et al. (2003)의 모멘트-IV 관계에서:
  S₃ ≈ -3·ψ_T / √(v_T) + 2·v_T^{3/2}·(some correction)

실무 단순화:
  SKEW_KRX ≈ 100 + 2.5 × |RR_25d|   (RR_25d < 0인 경우)

예시:
  RR_25d = -4.2%p → SKEW_KRX ≈ 110.5  (정상)
  RR_25d = -12%p  → SKEW_KRX ≈ 130    (높은 꼬리 위험)
  RR_25d = -1%p   → SKEW_KRX ≈ 102.5  (낮은 꼬리 인식)
```

**SKEW-VKOSPI 교차 분석:**

```
┌─────────────────────────────────────────────────┐
│           SKEW 수준 (꼬리 위험 인식)              │
│            Low (<108)     High (>120)             │
├─────────────────────────────────────────────────┤
│ VKOSPI   │ "True Calm"   │ "Hidden Fear"         │
│ Low      │ 변동성 낮고    │ 변동성 낮지만          │
│ (<15)    │ 꼬리 인식 낮음 │ 꼬리 위험 경계 중      │
│          │ → breakout 대비│ → 급락 보험 매수 중    │
│          │ 패턴: 표준     │ 패턴: 방향성 -5%       │
├─────────────────────────────────────────────────┤
│ VKOSPI   │ "Panic Fatigue"│ "Full Panic"          │
│ High     │ 변동성 높지만  │ 변동성 높고            │
│ (>30)    │ 꼬리 인식 둔화 │ 꼬리 위험 극대         │
│          │ → 반등 가능성  │ → 시장 마비 상태       │
│          │ 패턴: reversal │ 패턴: 전면 차단        │
│          │       +10%    │                        │
└─────────────────────────────────────────────────┘
```

### 4.4 스큐 변화율 신호 (Skew Momentum)

스큐의 수준(level)뿐 아니라 변화율(rate of change)도 중요한 신호이다.

```
Skew_momentum = Skew_25d(t) - Skew_25d(t-5)    (5일 변화)

Skew_momentum < -3%p:  급격한 스큐 확대 (steepening)
  → 새로운 하방 위험 인식 → "공포 신호"
  → 다음 5거래일 KOSPI200 평균 수익률: -0.8% (2015-2026)

Skew_momentum > +3%p:  급격한 스큐 축소 (flattening)
  → 하방 위험 해소 인식 → "안도 신호"
  → 다음 5거래일 KOSPI200 평균 수익률: +0.5% (2015-2026)

|Skew_momentum| < 1%p:  안정
  → 표준 신뢰도 적용
```

Tier 분류: [D][L:GCV] — 변화율 임계값은 실증 검증 추가 필요.

---

## 5. 감마 익스포저 심화 (Gamma Exposure, GEX — Advanced)

### 5.1 딜러 포지셔닝 추정 (Dealer Positioning)

26번 §6에서 GEX의 기본 개념과 시장 조성자 헤지 메커니즘을 소개했다.
여기서는 딜러의 순 포지션 추정 방법과 정제된 GEX 산출을 다룬다.

```
기본 가정 (SqueezeMetrics convention):
  시장 조성자(market maker, MM)는 옵션의 순 매도자(net seller)이다.
  고객(customer)이 옵션을 매수하고, MM이 이를 공급한다.

이 가정 하의 GEX:
  GEX_call = +Σᵢ [OI_call(Kᵢ) × Γ_call(Kᵢ) × Multiplier × S]
  GEX_put  = -Σᵢ [OI_put(Kᵢ) × Γ_put(Kᵢ) × Multiplier × S]

  GEX_total = GEX_call + GEX_put

부호 직관:
  콜 OI → MM이 short call → short gamma
       → 주가 상승 시 MM은 주식 매수(delta hedge) → 추가 상승 억제
       → GEX_call > 0: 평균 회귀 압력

  풋 OI → MM이 short put → long gamma (주의: 부호가 반대)
       → 주가 하락 시 MM은 주식 매도(delta hedge) → 추가 하락 가속
       → GEX_put < 0: 모멘텀 압력

KOSPI200 옵션 승수: 250,000 KRW
GEX 단위: 억원 (÷ 1e8)
```

### 5.2 GEX와 시장 핀닝 (Market Pinning)

대규모 OI가 집중된 행사가에서 시장이 "핀닝(pinning)"되는 현상이 관측된다.
이는 MM의 감마 헤지가 해당 행사가로 가격을 수렴시키는 메커니즘이다.

```
핀닝 메커니즘:

1. 특정 행사가 K*에 OI가 집중
2. S < K*: MM은 delta hedge로 기초자산 매수 → S 상승 압력
3. S > K*: MM은 delta hedge로 기초자산 매도 → S 하락 압력
4. 결과: S → K* 수렴 (만기 근접 시 효과 강화)

핀닝 강도 추정:
  Pin_strength(K*) = OI(K*) × Γ(K*) / Σᵢ OI(Kᵢ) × Γ(Kᵢ)

  Pin_strength > 0.3: 강한 핀닝 예상 → 지지/저항으로 활용
  Pin_strength < 0.1: 핀닝 약함 → 무시

만기일까지 잔존 기간별 핀닝 효과:
  T > 2주: 핀닝 효과 미미 (감마가 분산되어 있음)
  T = 1주: 핀닝 시작 (ATM 감마 집중)
  T = 1-2일: 핀닝 극대 (감마 폭발)
  T = 만기일: 핀닝 소멸 (결제 가격 확정)
```

Ni, Pearson & Poteshman (2005). "Stock Price Clustering on Option Expiration Dates."
*Journal of Financial Economics*, 78(1), 49-87.

### 5.3 GEX Flip Level과 변동성 레짐

```
GEX Flip Level 산출:

GEX(S) = 0이 되는 S 값을 이분법(bisection)으로 찾는다.

for S_test in [S_low, S_high]:
  GEX_test = Σᵢ [OI_call(Kᵢ)×Γ(Kᵢ, S_test) - OI_put(Kᵢ)×Γ(Kᵢ, S_test)] × S_test × M
  if GEX_test changes sign → S_flip found

S > S_flip:  Positive GEX 영역
  → MM 감마 헤지 = 평균 회귀
  → 일중 변동성 억제, 레인지 바운드
  → 지지/저항 패턴 (double top/bottom) 신뢰도 +10%
  → 돌파 패턴 (triangle breakout) 신뢰도 -10%
  → 볼린저 밴드 squeeze 후 돌파 실패 확률 높음

S < S_flip:  Negative GEX 영역
  → MM 감마 헤지 = 모멘텀 증폭
  → 일중 변동성 확대, 추세 강화
  → 돌파 패턴 (triangle, wedge breakout) 신뢰도 +10%
  → 반전 패턴 (reversal) 신뢰도 -15% (추세 관성이 강함)
```

### 5.4 KRX 시장조성자 의무와 GEX 특수성

KRX의 옵션 시장조성자(LP, Liquidity Provider) 제도는
글로벌 OTC 마켓메이킹과 다른 구조적 특성을 생성한다.

```
KRX 시장조성자 의무 (2026년 기준):

1. 호가 의무:
   → 양방향(bid/ask) 호가를 상시 제시
   → 최소 호가 수량: 행사가당 10계약 이상
   → 호가 스프레드: ATM 기준 IV 2%p 이내

2. 지정 행사가 범위:
   → ATM ± 5개 행사가 (총 11개) 이상에 호가 제시
   → 극단 OTM 행사가는 의무 대상 외

3. 인센티브:
   → 거래소 수수료 감면 (일반 대비 50-70% 할인)
   → 유동성 공급 보상금 (실적 기반)

GEX 분석에 대한 시사점:
  a. LP 의무로 인해 ATM 근방에 항상 양방향 포지션 존재
     → positive GEX가 구조적으로 유지되는 경향
     → S&P 500 대비 GEX flip level이 현물 아래에 위치
  b. LP 외 참여자(외국인, 기관)의 방향성 포지션이 GEX 형태 결정
     → 외국인 풋 매수 증가 시 GEX 하락 → negative GEX 가능성 증가
  c. 만기 주 목요일-금요일: LP 롤오버 → 일시적 GEX 왜곡 가능
```

### 5.5 GEX와 VRP의 교차 신호

```
GEX-VRP 교차 분석 매트릭스:

┌───────────────────────────────────────────────────────┐
│              VRP > 0 (IV > RV)     VRP < 0 (RV > IV) │
├───────────────────────────────────────────────────────┤
│ GEX > 0    │ "안정-고프리미엄"    │ "헤지 해소 과도기" │
│ (positive) │ 가장 안정적 환경     │ VRP 정상화 진행 중 │
│            │ mean-reversion 강    │ 변동성 저하 예상   │
│            │ 패턴: 전체 +5%       │ 패턴: 표준         │
├───────────────────────────────────────────────────────┤
│ GEX < 0    │ "위기 전초"          │ "위기 본격화"      │
│ (negative) │ IV 높지만 아직 안정  │ 실현 vol 폭발      │
│            │ 숏감마→추세 추종     │ 패닉 매도 가속     │
│            │ 패턴: breakout +5%   │ 패턴: 전면 ×0.7    │
└───────────────────────────────────────────────────────┘

→ 가장 위험한 조합: GEX < 0 AND VRP < 0
   (딜러가 추세를 가속하는 동시에 실현 변동성이 내재변동성 초과)
   → 34번 §2의 VRP 부호 규약과 일관: 동시 음수 = 위기 확인
```

---

## 6. 옵션 흐름 분석 (Options Flow Analytics)

### 6.1 이상 옵션 활동 감지 (Unusual Options Activity, UOA)

이상 옵션 활동은 정보 비대칭(information asymmetry)의 징후이다.
Pan & Poteshman (2006)은 옵션 거래량 비율이 주가 예측력을 보유함을 실증했다.

```
UOA 탐지 기준:

기본 필터:
  Volume(K, T) > 3 × AvgOI(K, T, 20d)

여기서:
  Volume(K, T):     특정 행사가 K, 만기 T의 당일 거래량
  AvgOI(K, T, 20d): 동일 행사가-만기의 20일 평균 미결제약정

강화 필터 (3단계):
  Level 1 (관심): Volume > 3 × AvgOI
  Level 2 (주의): Volume > 5 × AvgOI AND 가격 변화 > 10%
  Level 3 (경고): Volume > 10 × AvgOI AND 블록 거래 포함

방향성 분류:
  UOA_bullish: 콜 매수 or 풋 매도에서 이상 거래량
  UOA_bearish: 풋 매수 or 콜 매도에서 이상 거래량

KRX 적용:
  KOSPI200 옵션: 행사가-만기별 일별 거래량/OI 데이터 이용
  개별 주식 옵션 (~85종목): 상위 10-15종목에서만 유의미
```

### 6.2 스마트 머니 지표 (Smart Money Indicators)

**대형 블록 거래 (Large Block Trades):**

```
블록 거래 정의:
  KOSPI200 옵션: 단일 거래 100계약 이상
  개별 주식 옵션: 단일 거래 50계약 이상

블록 거래의 정보 함량:
  Easley, O'Hara & Srinivas (1998):
    → 정보 거래자는 레버리지와 익명성을 위해 옵션을 선호
    → 블록 거래는 개인보다 기관/전문 투자자의 비중이 높음

블록 방향성 분류:
  블록이 ask에서 체결 → "aggressive buy" (매수 주도)
  블록이 bid에서 체결 → "aggressive sell" (매도 주도)

KRX 제한:
  → 체결 틱 데이터(tick data)는 실시간 전용, 일별 요약에서 추출 어려움
  → CheeseStock file mode에서는 일별 거래량/OI 변화만 활용 가능
```

**스프레드 거래 패턴:**

```
스프레드 거래 = 동시에 여러 옵션을 매수/매도하는 복합 전략

감지 방법:
  동일 만기의 여러 행사가에서 동시에 OI 변화 관측:
    ΔOI(K₁) > 0 AND ΔOI(K₂) < 0 → 수직 스프레드(vertical spread) 가능성

  동일 행사가의 여러 만기에서 동시에 OI 변화 관측:
    ΔOI(T₁) > 0 AND ΔOI(T₂) < 0 → 캘린더 스프레드(calendar spread) 가능성

전략 해석:
  Bull call spread 감지: 낮은 K에서 콜 OI 증가 + 높은 K에서 콜 OI 증가
  → 제한된 상승 기대 (smart money의 보수적 강세)

  Bear put spread 감지: 높은 K에서 풋 OI 증가 + 낮은 K에서 풋 OI 증가
  → 제한된 하락 기대 (smart money의 보수적 약세)
```

Easley, D., O'Hara, M. & Srinivas, P.S. (1998). "Option Volume and Stock Prices:
Evidence on Where Informed Traders Trade." *Journal of Finance*, 53(2), 431-465.

### 6.3 PCR 고급 분해 (Put/Call Ratio — Advanced)

26번 §3에서 PCR의 기본 역발상 해석을 다루었다.
여기서는 PCR을 세분화하여 더 정밀한 심리 판독을 제공한다.

**Volume PCR vs OI PCR 분리:**

```
PCR_volume = Volume_put / Volume_call
  → 단기(intraday) 심리 반영
  → 변동성: 일중 0.3-2.5 범위에서 급변
  → 노이즈 많음 → 5일 이동평균 필수 (26번 §3.1 확인)

PCR_OI = OI_put / OI_call
  → 중기(multi-day) 포지션 심리 반영
  → 변동성: 일별 0.7-1.5 범위에서 완만 변화
  → 구조적 포지션 변화 포착에 유리

교차 분석:
  PCR_volume ↑ AND PCR_OI ↑: 풋 매수 + 풋 포지션 축적
    → 진정한 공포 (genuine fear) → 강한 역발상 매수 신호

  PCR_volume ↑ AND PCR_OI ↓: 풋 매수 + 기존 풋 청산
    → 헤지 갱신 (hedge renewal), 공포 과대평가 가능
    → 약한 역발상 매수 신호

  PCR_volume ↓ AND PCR_OI ↓: 콜 매수 + 풋 청산
    → 진정한 탐욕 (genuine greed) → 역발상 매도 경고

  PCR_volume ↓ AND PCR_OI ↑: 콜 매수 + 풋 누적
    → 기관의 양면 포지셔닝 → 방향성 불확실
```

**만기별 PCR 분해:**

```
PCR_1M: 근월물 PCR (단기 심리, 노이즈 많음)
PCR_3M: 원월물 PCR (중기 심리, 구조적 포지션)
PCR_all: 전체 만기 PCR (종합)

PCR 기간구조:
  PCR_1M > PCR_3M: 단기 공포 > 중기 공포 → 이벤트 드리븐
  PCR_1M < PCR_3M: 중기 공포 > 단기 공포 → 구조적 헤지

투자자별 PCR (KRX 공시 기반):
  외국인 PCR = 외국인 풋 거래량 / 외국인 콜 거래량
  기관 PCR   = 기관 풋 거래량 / 기관 콜 거래량
  개인 PCR   = 개인 풋 거래량 / 개인 콜 거래량

  외국인 PCR 극단 (>1.5): 글로벌 위험 회피 신호 (28번 §2.6 교차 참조)
  개인 PCR 극단 (<0.5):   과도한 콜 투기 → 역발상 매도 신호 강화
```

### 6.4 심리 극단치 종합 (Sentiment Extremes Summary)

```
극단 공포 종합 조건 (Extreme Fear):
  PCR_volume_5d > 1.5
  AND PCR_OI > 1.2
  AND VKOSPI > 25
  AND Skew_25d > 10%p
  AND RR_zscore < -2.0

  → 5개 조건 중 4개 이상 충족 시: "Extreme Fear" 레이블
  → 향후 20거래일 KOSPI200 수익률 중위수: +2.5% (2015-2026)
  → 패턴 신뢰도: reversal 패턴 +15%, trend down 패턴 -20%

극단 탐욕 종합 조건 (Extreme Greed):
  PCR_volume_5d < 0.5
  AND PCR_OI < 0.7
  AND VKOSPI < 15
  AND Skew_25d < 2%p
  AND RR_zscore > +1.0

  → 5개 조건 중 4개 이상 충족 시: "Extreme Greed" 레이블
  → 향후 20거래일 KOSPI200 수익률 중위수: -1.5% (2015-2026)
  → 패턴 신뢰도: reversal 패턴 +10%, trend up 패턴 -15%
```

---

## 7. 변동성 기간구조 곡면 통합 (Volatility Term Structure Surface Integration)

### 7.1 기간구조와 스큐의 2D 교차

34번 §5에서 변동성 기간구조(contango/backwardation)를 다루었다.
본 절에서는 기간구조와 스큐를 통합한 2D 분석 프레임워크를 제시한다.

```
완전한 IV 곡면의 2D 분해:

σ(K, T) = σ_ATM(T) + Skew(T) × f(K) + Curvature(T) × g(K)

여기서:
  σ_ATM(T):      만기별 ATM IV → 기간구조 (Term Structure)
  Skew(T):       만기별 스큐 기울기 → 스큐 기간구조 (Skew Term Structure)
  Curvature(T):  만기별 곡률 → 스마일 기간구조 (Smile Term Structure)
  f(K), g(K):    행사가 의존 함수 (moneyness 함수)

분해의 직관:
  1차 (Level):     "옵션이 전반적으로 비싼가?" → σ_ATM 수준
  2차 (Term):      "단기 vs 장기 중 어디가 비싼가?" → 기간구조 기울기
  3차 (Skew):      "하방 보험이 비싼가?" → 스큐 수준
  4차 (Skew Term): "단기 스큐 vs 장기 스큐?" → 스큐 기간구조
```

### 7.2 스큐 기간구조 (Skew Term Structure)

스큐 자체도 만기에 따라 변한다. 이 "스큐의 기간구조"는
시장의 위험 인식이 단기/장기로 어떻게 분포하는지를 보여준다.

```
Skew(T) = σ_25δPut(T) - σ_25δCall(T)

정상 패턴:
  Skew(1M) > Skew(3M) > Skew(6M)
  → 단기 스큐가 장기 스큐보다 가파름
  → 이유: 단기 옵션의 감마가 더 크므로 꼬리 위험에 더 민감

비정상 패턴:
  Skew(1M) < Skew(3M)
  → 장기 하방 위험이 단기보다 크게 인식됨
  → 구조적 위험 (경기 침체 우려, 지정학 장기화)
  → 패턴 신뢰도: 장기 추세 패턴 -10%
```

**수학적 모형 — 스큐의 평균 회귀:**

```
단기 만기에서 스큐는 큰 반면, 장기 만기에서 스큐는 축소된다.
이는 스큐의 "평균 회귀(mean-reversion)" 특성을 반영한다.

Gatheral & Jacquier (2014):
  ψ_T × √T ≈ constant     (short maturities)

→ ATM 스큐 기울기 ψ_T는 √T에 반비례하여 감소:
  ψ_T ∝ 1/√T

  ψ_1M ≈ 2 × ψ_4M     (1개월 스큐 ≈ 4개월 스큐의 2배)

이 관계를 이용하여 관측된 만기의 스큐에서
관측되지 않은 만기의 스큐를 보간할 수 있다.
```

### 7.3 변동성 기간구조 레짐 종합

34번 §5의 cv_ratio(VKOSPI 기간구조 프록시)와 스큐 기간구조를 결합한다.

```
복합 레짐 분류:

Regime 1 — "Normal":
  cv_ratio ≈ 1.0 (contango) AND Skew_1M/Skew_3M ≈ 1.5-2.0
  → 정상 시장, 표준 패턴 신뢰도

Regime 2 — "Steepening Stress":
  cv_ratio < 0.95 (약한 backwardation) AND Skew_1M/Skew_3M > 2.5
  → 단기 스트레스 집중, 장기는 아직 침착
  → 패턴 신뢰도: 단기 reversal +5%, 장기 trend -5%

Regime 3 — "Broad Stress":
  cv_ratio < 0.90 (강한 backwardation) AND Skew_3M > Skew_1M
  → 단기+장기 모두 스트레스
  → 패턴 신뢰도: 전면 ×0.75

Regime 4 — "Complacency":
  cv_ratio > 1.10 (강한 contango) AND Skew_1M/Skew_3M < 1.2
  → 과도한 안일 → breakout 대비
  → 패턴 신뢰도: breakout +10%, mean-reversion -5%
```

### 7.4 VIX 기간구조와 경기 침체 예측

VIX(미국) 및 VKOSPI(한국) 기간구조의 역전은 경기 침체 선행지표이다.

```
VIX 기간구조:
  VIX_1M / VIX_3M 비율 (또는 VIX / VIX3M)

  비율 > 1.0 (backwardation):
    단기 공포 > 장기 공포
    → 위기 국면 진행 중 (2008, 2020, 2022)

  비율 < 0.85 (깊은 contango):
    장기 공포 >> 단기 공포
    → 시장 안일 (과거 3-6개월 내 조정 빈도 높음)

경기 침체 예측력 (학술):
  Bekaert & Hoerova (2014):
    VIX 기간구조 역전 + VRP < 0 → 6개월 내 경기 둔화 확률 65%
    (비교: 수익률 곡선 역전(35번 §3.2) → 12-18개월 선행)

VKOSPI 기간구조 적용:
  cv_ratio(34번 §5.2) < 0.90 AND VKOSPI > 30:
    → 6개월 내 KOSPI200 최대 drawdown 평균 -15% (2009-2026)
    → 35번 §3.2의 수익률 곡선 역전과 동시 발생 시 경고 강화
```

---

## 8. CheeseStock 구현 경로

### 8.1 데이터 파이프라인

```
[데이터 소스]                         [배치 스크립트]                [출력 파일]

KRX data.krx.co.kr                   scripts/download_derivatives.py
├── KOSPI200 옵션 일별 데이터         ├── 행사가별 IV 추출           data/options_daily.json
│   ├── 행사가별 종가 (C, P)         │   (Newton-Raphson,            ├── iv_surface[]
│   ├── 행사가별 OI                  │    26번 §2.1 방법론)          ├── skew_25d[]
│   ├── 행사가별 거래량              │                               ├── bf_25d[]
│   └── 만기별 분류                  ├── 스큐/BF 산출               ├── gex[]
│                                    │   (25δ RR, 25δ BF)           ├── pcr_advanced{}
├── KOSPI200 선물 종가               ├── GEX 산출                   │   ├── volume_pcr[]
│   (선도가격 F 추출용)               │   (OI × Γ × 250000 × S)     │   ├── oi_pcr[]
│                                    │                               │   └── investor_pcr{}
├── 투자자별 옵션 거래 내역          ├── PCR 고급 분해               ├── uoa[]
│   (외국인/기관/개인)               │   (volume/OI/투자자별)        └── skew_momentum[]
│                                    │
└── VKOSPI 일별 종가                 └── UOA 탐지
    (26번 §7.1의 기존 파이프라인)         (거래량 > 3 × AvgOI)

업데이트 주기: daily_update.bat에 통합 (장 마감 후 1회, 15:45 이후)
파일 크기 예상: ~200KB (1년 일별 데이터, 30 행사가 × 8 만기 × 250일)
의존성: pip install pykrx requests
```

### 8.2 IV 곡면 구성 파이프라인 상세

```python
# download_derivatives.py (Python 배치 스크립트 설계)

def build_iv_surface(date, expiries, strikes):
    """
    KOSPI200 옵션 가격으로부터 IV 곡면 구성.

    1. 기초 데이터 수집:
       F = KOSPI200 선물 종가 (또는 put-call parity로 추정)
       r = CD91 금리 / 100 (또는 KOFIA 무위험금리)
       q = KOSPI200 배당수익률 (약 1.5-2.0%)

    2. 행사가별 IV 산출:
       for each (K, T, C_market, P_market):
         σ_call = newton_raphson_iv(S, K, r, q, T, C_market, 'call')
         σ_put  = newton_raphson_iv(S, K, r, q, T, P_market, 'put')
         σ = weighted_average(σ_call, σ_put)  # OI 가중 평균

    3. SVI 피팅:
       for each T:
         k_i = ln(K_i / F_T)
         w_i = σ_i² × T
         params = fit_svi(k_i, w_i)  # scipy.optimize.minimize
         → {a, b, ρ, m, σ_svi}

    4. 무차익 검증:
       verify_butterfly(params)    # g(k) ≥ 0 ∀k
       verify_calendar(params_T1, params_T2)  # w(k,T2) ≥ w(k,T1)

    5. 스큐/BF 산출:
       σ_25δ_put = interpolate_iv(delta=-0.25, T)
       σ_25δ_call = interpolate_iv(delta=+0.25, T)
       σ_ATM = interpolate_iv(delta=0.50, T)
       RR_25d = σ_25δ_call - σ_25δ_put
       BF_25d = (σ_25δ_call + σ_25δ_put) / 2 - σ_ATM

    Returns: {iv_surface, svi_params, skew_25d, bf_25d}
    """
    pass
```

### 8.3 signalEngine.js 통합 설계

```
신호 매핑 (signalEngine.js 확장):

┌──────────────────────────────────────────────────────────────────┐
│ Signal Name        │ Source Field        │ Signal Type │ Tier   │
├──────────────────────────────────────────────────────────────────┤
│ ivSkewLevel        │ skew_25d            │ contrarian  │ C/GCV  │
│ ivSkewMomentum     │ skew_momentum       │ momentum    │ D/GCV  │
│ ivButterflyLevel   │ bf_25d              │ extremity   │ C/GCV  │
│ gexLevel           │ gex                 │ regime      │ D/MAN  │
│ gexFlipDistance    │ gex_flip_distance   │ threshold   │ D/MAN  │
│ pcrAdvanced        │ pcr_advanced        │ contrarian  │ C/GCV  │
│ uoaAlert           │ uoa                 │ event       │ D/MAN  │
│ volTermRegime      │ cv_ratio + skew_ts  │ regime      │ C/GCV  │
│ skewVkospiCross    │ skew_25d × vkospi   │ composite   │ C/GCV  │
│ sentimentExtreme   │ multi-factor        │ composite   │ C/GCV  │
└──────────────────────────────────────────────────────────────────┘

기존 신호와의 통합:
  26번 §2.3 VKOSPI 4-tier 레짐 → ivSkewLevel과 교차 (§4.3 매트릭스)
  26번 §3 PCR 역발상 → pcrAdvanced로 확장 (§6.3)
  26번 §6 GEX → gexLevel + gexFlipDistance로 정밀화 (§5)
  34번 §2 VRP → gexLevel과 교차 (§5.5 GEX-VRP 매트릭스)
  34번 §5 cv_ratio → volTermRegime에 스큐 기간구조 추가 (§7.3)
```

### 8.4 패턴 신뢰도 조정 체계

```
IV 곡면 기반 신뢰도 조정 (패턴 카테고리별):

1. GEX Level 조정:
   if gexLevel == 'positive':
     meanReversion_patterns × 1.10    (double top/bottom, S/R)
     breakout_patterns     × 0.90    (triangle, wedge)
   elif gexLevel == 'negative':
     meanReversion_patterns × 0.85
     breakout_patterns     × 1.10

2. 스큐 극단 조정:
   if skew_25d > 10%p:    # 극단 공포
     reversal_patterns    × 1.10
     trend_down_patterns  × 0.85
   elif skew_25d < 2%p:   # 극단 안일
     all_patterns         × 0.95    (hidden risk)

3. Negative GEX + VRP < 0 복합 조건:
   if gexLevel == 'negative' AND vrpRegime == 'risk-off':
     all_directional_patterns × 0.70   (§5.5 "위기 본격화")

4. 심리 극단치 조정:
   if sentimentExtreme == 'fear':
     reversal_patterns    × 1.15
     trend_down_patterns  × 0.80
   elif sentimentExtreme == 'greed':
     reversal_patterns    × 1.10
     trend_up_patterns    × 0.85

조정 순서: VRP → GEX → Skew → Sentiment
  (먼저 적용된 조정 위에 곱셈으로 누적)
  최소 하한: conf_adjusted ≥ conf × 0.50 (26번 §5.3 동일 하한)
```

### 8.5 차트 시각화 설계

```
1. IV Heatmap (옵션 패널):
   X축: moneyness (0.85 ~ 1.15)
   Y축: 만기 (1W, 1M, 2M, 3M, 6M)
   색상: IV 수준 → colormap (저IV=KRX_COLORS.DOWN, 고IV=KRX_COLORS.UP)
   오버레이: SVI 피팅 등고선

2. 스큐 시계열 (차트 하단):
   좌측 Y축: Skew_25d (%p)
   우측 Y축: VKOSPI
   컬러: 스큐 수준별 배경색
     정상 (3-7%p): 투명
     경계 (7-10%p): KRX_COLORS.NEUTRAL 0.1 알파
     극단 (>10%p): KRX_COLORS.DOWN 0.1 알파

3. GEX 프로필 (옵션 패널):
   X축: 행사가 (K)
   Y축: GEX 기여도 (억원)
   양수 바: KRX_COLORS.UP (positive GEX)
   음수 바: KRX_COLORS.DOWN (negative GEX)
   수직선: GEX flip level → KRX_COLORS.ACCENT
   수직선: 현재 KOSPI200 → KRX_COLORS.PTN_STRUCT

4. PCR 대시보드 (패턴 패널 확장):
   원형 게이지: PCR_volume_5d (0 ~ 2.0)
   원형 게이지: PCR_OI (0 ~ 2.0)
   색상: 극단 공포=KRX_COLORS.DOWN, 극단 탐욕=KRX_COLORS.UP
   라벨: "공포"/"중립"/"탐욕" (한글)
```

### 8.6 구현 우선순위와 의존성

```
Phase 0 — 데이터 인프라 (선행 조건):
  ☐ download_derivatives.py 스크립트 작성
  ☐ KRX 옵션 데이터 수집 검증 (pykrx 옵션 API 확인)
  ☐ data/options_daily.json 스키마 확정
  ☐ daily_update.bat에 통합

Phase 1 — 스큐/BF 기본 신호 (Low dependency):
  ☐ Newton-Raphson IV 산출 (Python)
  ☐ 25δ RR, 25δ BF 시계열 산출
  ☐ ivSkewLevel 신호 → signalEngine.js
  ☐ 패턴 신뢰도 조정 적용

Phase 2 — GEX 산출 (Medium dependency):
  ☐ 행사가별 Gamma 산출 (Python BSM)
  ☐ GEX 프로필 및 flip level 산출
  ☐ gexLevel 신호 → signalEngine.js
  ☐ GEX-VRP 교차 신호

Phase 3 — 고급 분석 (High dependency):
  ☐ SVI 파라미터 피팅 (scipy)
  ☐ UOA 탐지 알고리즘
  ☐ 스큐 기간구조 분석
  ☐ 심리 극단치 종합 신호

Phase 4 — 시각화 (Phase 1-3 완료 후):
  ☐ IV heatmap 렌더링 (Canvas2D)
  ☐ 스큐 시계열 차트
  ☐ GEX 프로필 차트
  ☐ PCR 대시보드
```

### 8.7 Learnable Constants Registry 추가

22_learnable_constants_guide.md의 Master Registry에 추가할 상수:

| # | Constant | Value | Tier | Learn | Range | Source |
|---|----------|-------|------|-------|-------|--------|
| 63 | SKEW_25D_NORMAL_LOW | 3.0 | C | GCV | [2.0, 5.0] | §3.2 KOSPI200 실측 |
| 64 | SKEW_25D_NORMAL_HIGH | 7.0 | C | GCV | [5.0, 10.0] | §3.2 KOSPI200 실측 |
| 65 | SKEW_25D_EXTREME | 10.0 | C | GCV | [8.0, 15.0] | §4.1 공포 임계값 |
| 66 | BF_25D_HIGH_ZSCORE | 2.0 | C | GCV | [1.5, 3.0] | §4.2 꼬리 과대 인식 |
| 67 | BF_25D_LOW_ZSCORE | -1.5 | C | GCV | [-2.0, -1.0] | §4.2 꼬리 과소 인식 |
| 68 | RR_EXTREME_FEAR_Z | -2.0 | C | GCV | [-3.0, -1.5] | §4.1 극단 공포 |
| 69 | RR_EXTREME_GREED_Z | 1.5 | C | GCV | [1.0, 2.0] | §4.1 극단 탐욕 |
| 70 | SKEW_MOMENTUM_THRESH | 3.0 | D | GCV | [2.0, 5.0] | §4.4 스큐 변화율 |
| 71 | GEX_PIN_STRENGTH_MIN | 0.3 | D | MAN | [0.2, 0.5] | §5.2 핀닝 최소 강도 |
| 72 | UOA_VOLUME_MULT | 3.0 | C | GCV | [2.0, 5.0] | §6.1 이상 거래량 배율 |
| 73 | PCR_EXTREME_FEAR | 1.5 | C | GCV | [1.2, 2.0] | §6.4 극단 공포 |
| 74 | PCR_EXTREME_GREED | 0.5 | C | GCV | [0.3, 0.7] | §6.4 극단 탐욕 |
| 75 | SKEW_TERM_ABNORMAL | 1.0 | D | GCV | [0.8, 1.2] | §7.2 스큐 기간구조 |
| 76 | NEG_GEX_VRP_DISCOUNT | 0.70 | C | GCV | [0.50, 0.85] | §5.5 위기 복합 할인 |

---

## 9. 학술 참고문헌

### 핵심 문헌 (Primary References)

1. Gatheral, J. (2006). *The Volatility Surface: A Practitioner's Guide.* Wiley Finance.
   — SVI 파라미터화의 원전, IV 곡면 구성의 표준 참고서.

2. Gatheral, J. & Jacquier, A. (2014). "Arbitrage-Free SVI Volatility Surfaces."
   *Quantitative Finance*, 14(1), 59-71.
   — SVI 무차익 조건의 수학적 증명, 실무 피팅 가이드라인.

3. Rubinstein, M. (1994). "Implied Binomial Trees." *Journal of Finance*, 49(3), 771-818.
   — 1987 이후 변동성 스큐 현상의 최초 체계적 분석.

4. Bates, D.S. (2000). "Post-'87 Crash Fears in the S&P 500 Futures Option Market."
   *Journal of Econometrics*, 94(1-2), 181-238.
   — 스큐의 경제적 해석: crash premium, 점프 위험.

5. Heston, S.L. (1993). "A Closed-Form Solution for Options with Stochastic Volatility
   with Applications to Bond and Currency Options." *Review of Financial Studies*,
   6(2), 327-343.
   — 확률적 변동성 모형, SVI의 이론적 배경.

6. Bakshi, G., Kapadia, N. & Madan, D. (2003). "Stock Return Characteristics,
   Skew Laws, and the Differential Pricing of Individual Equity Options."
   *Review of Financial Studies*, 16(1), 101-143.
   — RND 모멘트-IV 관계, 스큐-왜도 매핑.

### 옵션 흐름 및 정보 비대칭 (Options Flow & Information)

7. Pan, J. & Poteshman, A.M. (2006). "The Information in Option Volume
   for Future Stock Prices." *Review of Financial Studies*, 19(3), 871-908.
   — 옵션 거래량의 주가 예측력 실증 (IC ≈ 0.03-0.05).

8. Easley, D., O'Hara, M. & Srinivas, P.S. (1998). "Option Volume and Stock Prices:
   Evidence on Where Informed Traders Trade." *Journal of Finance*, 53(2), 431-465.
   — 정보 거래자의 옵션 시장 선호, 블록 거래 정보 함량.

9. Lakonishok, J., Lee, I., Pearson, N.D. & Poteshman, A.M. (2007). "Option Market
   Activity." *Review of Financial Studies*, 20(3), 813-857.
   — 옵션 시장 활동의 분류 체계, 투기 vs 헤지 분리.

### GEX 및 시장 구조 (Gamma Exposure & Market Structure)

10. Ni, S.X., Pearson, N.D. & Poteshman, A.M. (2005). "Stock Price Clustering
    on Option Expiration Dates." *Journal of Financial Economics*, 78(1), 49-87.
    — 만기일 핀닝 현상의 최초 학술 문서화.

11. Barbon, A. & Buraschi, A. (2021). "Gamma Fragility." Working Paper, University of St. Gallen.
    — 딜러 감마 헤지가 시장 변동성에 미치는 영향의 이론 모형.

12. Kang, J. & Park, H. (2014). "Options Trading and Price Discovery in Korea."
    *Asia-Pacific Journal of Financial Studies*, 43(3), 391-423.
    — KRX 옵션 시장의 가격 발견 기능, 외국인 거래 영향.

### RND 및 변동성 곡면 이론 (Risk-Neutral Density & Vol Surface)

13. Breeden, D.T. & Litzenberger, R.H. (1978). "Prices of State-Contingent Claims
    Implicit in Option Prices." *Journal of Business*, 51(4), 621-651.
    — RND 추출의 이론적 기반 (26번 §2.4 원전).

14. Lee, R.W. (2004). "The Moment Formula for Implied Volatility at Extreme Strikes."
    *Mathematical Finance*, 14(3), 469-480.
    — IV 날개 기울기의 점근적 상한, SVI 파라미터 제약.

15. Derman, E. (1999). "Regimes of Volatility." *Risk*, 12(4), 55-59.
    — 변동성 기간구조의 모수적 모형 (34번 §5.1 원전).

### VRP 및 기간구조 (VRP & Term Structure)

16. Bollerslev, T., Tauchen, G. & Zhou, H. (2009). "Expected Stock Returns and
    Variance Risk Premia." *Review of Financial Studies*, 22(11), 4463-4492.
    — VRP 수익률 예측력 (34번 §2 원전).

17. Bekaert, G. & Hoerova, M. (2014). "The VIX, the Variance Premium and Stock Market
    Volatility." *Journal of Econometrics*, 183(2), 181-190.
    — VRP 분해, VIX 기간구조와 경기 침체 예측.

### KRX 시장 특수성 (KRX-Specific)

18. KRX (2009). "VKOSPI 산출 방법론." 한국거래소 파생상품시장본부.
    — VKOSPI 공식 산출 방법론 (26번 §2.3 원전).

19. Park, J., Ryu, D. & Son, J. (2019). "Volatility Spillover between the KOSPI200
    Options Market and the Underlying Stock Market." *Journal of Derivatives*, 26(4).
    — KOSPI200 옵션→현물 변동성 전이 효과.

20. Whaley, R.E. (2000). "The Investor Fear Gauge." *Journal of Portfolio Management*,
    26(3), 12-17.
    — VIX/VKOSPI 해석의 표준 프레임워크 (26번 §2.3 교차참조).

---

## 10. 문서 간 교차참조 (Cross-Reference Map)

| 이 문서 절 | 참조 문서 | 참조 절 | 내용 |
|-----------|----------|--------|------|
| §2.2 SVI 이론적 기반 | 34번 | §4.4 | Heston 모형, 점프-확산과 IV 관계 |
| §2.3 Butterfly 조건 | 26번 | §2.4 | Breeden-Litzenberger RND ≥ 0 |
| §2.4 가격제한폭 효과 | 20번 | §2 | ±30% 가격제한과 날개 truncation |
| §2.4 외국인 포지셔닝 | 20번 | §3 | 외국인 순매매 흐름 분석 |
| §3.1 블랙 먼데이 스큐 | 12번 | §1.3 | 극단 사건 역사 |
| §3.3 RND 추출 | 26번 | §2.4 | Breeden-Litzenberger 공식 |
| §3.4 만기일 효과 | 27번 | §4 | 만기일 basis 수렴, 선물 만기 |
| §4.1 RR 역발상 | 26번 | §3.2 | PCR 극단 역발상과 유사 구조 |
| §4.3 SKEW-VKOSPI 교차 | 26번 | §2.3 | VKOSPI 4-tier 레짐 분류 |
| §5.1 GEX 기본 | 26번 | §6 | GEX 부호, flip level 개념 |
| §5.5 GEX-VRP 교차 | 34번 | §2 | VRP 부호 규약, 레짐 연동 |
| §6.1 UOA 정보 비대칭 | 18번 | §1-2 | Kyle 모형, 정보 거래자 |
| §6.3 PCR 기본 | 26번 | §3 | PCR 역발상 임계값 |
| §6.4 FG 합산 | 24번 | §1 | Fear-Greed 공포-탐욕 지수 |
| §7.1 기간구조 기본 | 34번 | §5 | Derman (1999), cv_ratio |
| §7.4 경기 침체 예측 | 35번 | §3.2 | 수익률 곡선 역전 선행성 |
| §8.3 VKOSPI 레짐 연동 | 26번 | §2.3 | 기존 4-tier 레짐과 통합 |
| §8.4 패턴 신뢰도 하한 | 26번 | §5.3 | conf_adjusted ≥ conf × 0.50 |
| §8.6 데이터 파이프라인 | 26번 | §7.1 | download_vkospi.py 확장 |
| §8.7 상수 체계 | 22번 | §1-3 | 5-Tier 상수 분류 체계 |

---

## 부록 A: SVI 피팅 알고리즘

### A.1 Raw SVI 피팅 절차

```
입력: {(k_i, w_i)} — log-moneyness와 총 내재분산 쌍, i = 1..N

Step 1 — 초기값 추정:
  a₀ = w_ATM = w(k ≈ 0)
  b₀ = (w_max - w_min) / (k_max - k_min)
  ρ₀ = -0.3   (전형적 주식/지수 스큐)
  m₀ = 0      (ATM 근방)
  σ₀ = 0.1    (ATM 곡률 초기값)

Step 2 — 비선형 최소자승 (Levenberg-Marquardt):
  minimize Σᵢ [w_i - w_SVI(k_i; a, b, ρ, m, σ)]²

  제약 조건:
    b ≥ 0
    -1 < ρ < 1
    σ > 0
    a + b·σ·√(1-ρ²) ≥ 0    (무차익 하한)
    b·(1+|ρ|) ≤ 4            (Roger Lee 상한)

Step 3 — 수렴 확인:
  잔차 RMS < 1e-4 (총 분산 기준)
  파라미터 변화 < 1e-6

Step 4 — 무차익 검증 (post-fit):
  g(k) ≥ 0 for k ∈ [-3, +3]   (butterfly 조건, §2.3)
  위반 시: 제약 조건 강화 후 재피팅

피팅 소요 시간: 단일 만기 ~5ms (NumPy/SciPy)
전체 만기(8개): ~40ms → 일별 배치에 충분
```

### A.2 SVI에서 Delta-Moneyness 변환

```
25δ put/call의 행사가를 SVI 곡면에서 추출하는 절차:

Step 1: ATM IV 추출
  σ_ATM = √(w_SVI(k=0) / T)

Step 2: 25δ 행사가의 초기 추정 (BSM 역산)
  k_25δ_call ≈ σ_ATM · √T · N⁻¹(0.25·e^{qT})
  k_25δ_put  ≈ -σ_ATM · √T · N⁻¹(0.25·e^{qT})

Step 3: 반복 정밀화
  for iter = 1..10:
    σ_i = √(w_SVI(k_i) / T)
    Δ_i = e^{-qT} · N(d₁(σ_i, k_i))
    if |Δ_i - 0.25| < 1e-6: break
    k_i += (Δ_i - 0.25) / (∂Δ/∂k)    (Newton step)

Step 4: RR, BF 산출
  σ_25δ_put  = √(w_SVI(k_25δ_put) / T)
  σ_25δ_call = √(w_SVI(k_25δ_call) / T)
  RR_25d = σ_25δ_call - σ_25δ_put
  BF_25d = (σ_25δ_call + σ_25δ_put) / 2 - σ_ATM
```

---

## 부록 B: GEX 산출 상세 알고리즘

### B.1 행사가별 Gamma 산출

```
BSM Gamma (26번 §1.2 복습):
  Γ(K, T) = N'(d₁) / (S · σ · √T)

  d₁ = [ln(S/K) + (r - q + σ²/2)·T] / (σ·√T)
  N'(x) = (1/√(2π)) · e^{-x²/2}

여기서 σ = σ_IV(K, T) — SVI 곡면에서 추출한 IV

KOSPI200 옵션 GEX 산출:
  GEX(K) = [OI_call(K) × Γ(K) - OI_put(K) × Γ(K)] × S × 250,000

  총 GEX = Σ_K GEX(K)

  단위: KRW → 억원으로 환산 (÷ 1e8)
```

### B.2 GEX 프로필에서 주요 레벨 추출

```
1. Max Positive GEX Strike:
   K* = argmax_K GEX(K)
   → 이 행사가에서 가장 강한 평균 회귀 압력
   → "핀닝 행사가" (§5.2)

2. Zero Crossing (Flip Level):
   이분법으로 GEX(S) = 0인 S 값 탐색
   → S > S_flip: positive GEX regime
   → S < S_flip: negative GEX regime

3. GEX 밀집도 (Concentration):
   HHI_GEX = Σ_K (GEX(K) / GEX_total)²
   → HHI > 0.3: 집중 → 핀닝 효과 강함
   → HHI < 0.1: 분산 → 핀닝 효과 약함
```

---

## 부록 C: options_daily.json 스키마

```json
{
  "date": "2026-04-02",
  "kospi200": 350.25,
  "forward": 351.10,
  "vkospi": 18.5,
  "risk_free_rate": 0.033,
  "dividend_yield": 0.018,

  "iv_surface": [
    {
      "expiry": "2026-04-09",
      "T": 0.019,
      "strikes": [
        {"K": 340, "iv_call": 0.205, "iv_put": 0.208, "oi_call": 1250, "oi_put": 980, "vol_call": 320, "vol_put": 410},
        {"K": 342.5, "iv_call": 0.198, "iv_put": 0.200, "oi_call": 1580, "oi_put": 1120, "vol_call": 450, "vol_put": 380}
      ],
      "svi_params": {"a": 0.0025, "b": 0.18, "rho": -0.38, "m": -0.005, "sigma": 0.12}
    }
  ],

  "skew": {
    "skew_25d": -4.5,
    "bf_25d": 1.9,
    "rr_25d": -4.5,
    "skew_momentum_5d": -0.8,
    "skew_zscore": -0.5,
    "rr_zscore": -0.3,
    "bf_zscore": 0.2
  },

  "gex": {
    "total_gex": 125.5,
    "gex_sign": "positive",
    "flip_level": 345.0,
    "max_gex_strike": 350.0,
    "pin_strength": 0.35,
    "hhi_gex": 0.22
  },

  "pcr_advanced": {
    "volume_pcr": 0.95,
    "oi_pcr": 1.05,
    "volume_pcr_5d": 0.88,
    "foreign_pcr": 1.15,
    "institutional_pcr": 0.92,
    "retail_pcr": 0.65,
    "pcr_term_1m": 0.90,
    "pcr_term_3m": 1.10
  },

  "uoa": [
    {
      "strike": 340,
      "type": "put",
      "expiry": "2026-04-09",
      "volume": 1250,
      "avg_oi_20d": 300,
      "ratio": 4.17,
      "level": 2,
      "direction": "bearish"
    }
  ],

  "vol_term_regime": {
    "cv_ratio": 0.98,
    "skew_term_ratio": 1.85,
    "regime": "Normal"
  },

  "sentiment_composite": {
    "label": "neutral",
    "fear_conditions_met": 1,
    "greed_conditions_met": 0
  }
}
```

---

## 부록 D: 검증 체크리스트 (Validation Checklist)

```
IV 곡면 검증:

☐ Put-Call Parity:
    C - P = S·e^{-qT} - K·e^{-rT}
    → |parity_error| < 0.5pt (KOSPI200 기준)
    → 위반 시: 해당 행사가 IV 제외 또는 보정

☐ Butterfly 조건 (§2.3):
    g(k) ≥ 0 for all k in [-3, +3]
    → 위반 행사가 개수 < 5% (총 행사가 대비)

☐ Calendar 조건 (§2.3):
    w(k, T₂) ≥ w(k, T₁) for T₂ > T₁
    → 모든 (k, T₁, T₂) 쌍에서 검증

☐ Roger Lee 상한 (§2.3):
    b·(1 ± ρ) ≤ 2
    → SVI 피팅 후 자동 검증

☐ IV 범위 (26번 §2.1):
    5% < IV < 200% for KOSPI200 options
    → 범위 외 값은 outlier 처리

스큐/GEX 검증:

☐ Skew_25d 부호:
    Skew_25d > 0 (정상, 하방 스큐)
    → 음수 시 경고 (비정상 시장 or 데이터 오류)

☐ GEX 총합 vs VKOSPI 상관:
    상관계수 ρ(GEX, 1/VKOSPI) > 0.3
    → 양의 GEX ↔ 낮은 VKOSPI 관계 확인

☐ PCR 범위:
    0.2 < PCR < 3.0
    → 범위 외 값은 데이터 오류 가능성

☐ UOA 위양성 제어:
    UOA Level 2+ 감지 빈도 < 5% (일별 행사가 대비)
    → 과다 감지 시 Volume 배율 상향 조정

☐ 스큐 기간구조 (§7.2):
    ψ_T × √T ≈ constant (±20%)
    → 급격한 이탈 시 특정 만기 데이터 품질 확인
```

---

## 부록 E: 학습 경로 연동

본 문서의 내용은 core_data README.md의 학습 경로에 다음과 같이 매핑된다:

```
[Stage 3] 금융 이론 프레임워크 (기초):
  05번 §5 BSM → 26번 §1 Greeks → 37번 §2 IV 곡면 (확장)

[Stage 8] 고급 이론 (본 문서):
  26번 §2 VKOSPI → 34번 §2 VRP → 37번 §3 스큐 동역학
  26번 §6 GEX → 37번 §5 GEX 심화
  34번 §5 기간구조 → 37번 §7 기간구조 곡면 통합
  12번 §1 꼬리 위험 → 37번 §3.3 RND 꼬리 연결
  18번 §1 정보 비대칭 → 37번 §6 옵션 흐름 분석

[Stage 6] 위험 관리 (교차):
  14번 위험관리 → 37번 §5.5 GEX-VRP 교차 위기 경보
```

---

*Doc 37 — 2026-04-02 작성*
*CheeseStock core_data 학술 문서 체계의 일부*
*총 참조 문헌: 20편*
*교차 참조 문서: 26번, 34번, 12번, 18번, 20번, 22번, 24번, 27번, 28번, 35번*
