# 26. 옵션 변동성과 파생상품 신호 — Options Volatility & Derivative Signals

> "옵션 시장은 주식 시장의 확률분포를 가격에 새긴 거울이다."
> "Options are the market's way of pricing its own probability distribution."
> — Nassim N. Taleb, *Dynamic Hedging* (1997)

---

## 1. Black-Scholes-Merton 모형 복습과 확장

### 1.1 BSM 공식 심층

05_finance_theory.md §5에서 BSM 공식을 소개했다. 여기서는 도출 맥락과
KRX 적용 시 가정 위배를 심층 분석한다.

Black & Scholes (1973), Merton (1973) — 1997 노벨 경제학상.

```
콜옵션: C = S·N(d₁) - K·e^(-rT)·N(d₂)
풋옵션: P = K·e^(-rT)·N(-d₂) - S·N(-d₁)

d₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ - σ√T

S: 기초자산 현재가
K: 행사가격 (strike price)
r: 무위험이자율 (risk-free rate)
T: 만기까지 잔존 기간 (연 단위)
σ: 변동성 (volatility)
N(): 표준정규분포 누적분포함수
```

**위험중립 가격결정 (Risk-Neutral Pricing) 직관:**

BSM의 핵심 통찰은 "완전 복제(perfect replication)"에 있다.
기초자산과 무위험채권의 동적 포트폴리오로 옵션 페이오프를 정확히 복제할 수 있다면,
옵션 가격은 투자자의 위험 선호와 무관하게 결정된다.

```
위험중립 측도 Q 하에서:
C = e^(-rT) · E_Q[max(S_T - K, 0)]

→ 기대값을 계산할 때 주가의 실제 드리프트(μ)가 아닌
  무위험이자율(r)로 할인하므로 "위험중립"이라 부른다.
→ 실제 확률 P와 위험중립 확률 Q는 Girsanov 정리로 연결된다.
```

**BSM 가정과 KRX에서의 위배:**

| BSM 가정 | KRX 현실 | 위배 정도 |
|----------|---------|----------|
| 연속 거래 | 09:00-15:30 KST, 야간 갭 존재 | 중간 |
| 일정한 변동성 σ | 변동성 클러스터링, GARCH 효과 | 심각 |
| 로그정규 수익률 | ±30% 가격제한으로 꼬리 절단 (20번 §2.2) | 심각 |
| 거래비용 없음 | 증권거래세 0.18% + 수수료 ~0.03% | 중간 |
| 공매도 자유 | KRX 공매도 규제 (2023-2025 금지 후 부분 해제) | 심각 |
| 일정한 r | 한국은행 기준금리 변동 (25번 §1.3) | 경미 |

참고: KRX 가격제한폭(±30%)이 옵션 가격에 미치는 영향은 20_krx_structural_anomalies.md §2를 참조.

### 1.2 Greeks 체계

Greeks는 옵션 가격의 각 변수에 대한 편미분이다.

**Delta (Δ) — 방향성 민감도:**

```
콜: Δ_C = ∂C/∂S = N(d₁)         ∈ [0, 1]
풋: Δ_P = ∂P/∂S = N(d₁) - 1     ∈ [-1, 0]

해석: S가 1원 변할 때 옵션 가격의 변화량
      콜 ATM → Δ ≈ 0.5 (50% 확률로 ITM 종료 근사)
```

**Gamma (Γ) — 가속도/볼록성:**

```
Γ = ∂²C/∂S² = ∂Δ/∂S = N'(d₁) / (S·σ·√T)

N'(x) = (1/√(2π))·e^(-x²/2)  (표준정규 밀도함수)

특성: ATM에서 최대, 만기 근접 시 급증 → "감마 리스크"
```

**Theta (Θ) — 시간가치 소멸:**

```
Θ_C = ∂C/∂T = -[S·N'(d₁)·σ / (2√T)] - r·K·e^(-rT)·N(d₂)

관계: Θ + (1/2)·σ²·S²·Γ + r·S·Δ = r·C  (BSM PDE)
→ 감마가 크면 세타 소멸도 크다 (감마-세타 트레이드오프)
```

**Vega (ν) — 변동성 민감도:**

```
ν = ∂C/∂σ = S·√T·N'(d₁)

특성: ATM에서 최대, 장기 옵션일수록 큼
     동일 행사가에서 콜과 풋의 베가는 동일 (put-call parity)
```

**Rho (ρ) — 금리 민감도:**

```
ρ_C = ∂C/∂r = K·T·e^(-rT)·N(d₂)

KRX 실용: 단기(1-3개월) 패턴 분석에서 ρ의 영향은 무시 가능.
          25번 §1.3에서 확인했듯이 r_f의 일별 기여 ≈ 0.013%.
```

**고차 Greeks (Higher-Order, 간략):**

```
Vanna  = ∂Δ/∂σ = ∂ν/∂S    — 변동성 변화에 대한 델타의 민감도
Volga  = ∂²C/∂σ² = ∂ν/∂σ  — 변동성의 변동성 민감도 (vol-of-vol)
Charm  = ∂Δ/∂T              — 시간 경과에 따른 델타 변화
```

고차 Greeks는 KOSPI200 옵션 시장 조성자의 리스크 관리에 핵심적이나,
CheeseStock의 주식 패턴 분석 수준에서는 직접 산출할 필요 없다.

### 1.3 Greeks의 주식 분석 활용

Greeks는 옵션 트레이더만의 도구가 아니다.
주식 시장의 방향성과 변동성을 읽는 간접 지표로 활용된다.

**Delta as 방향성 확률 프록시:**

```
콜 OI-가중 Delta = Σ(OI_call_i × Δ_call_i) / Σ(OI_call_i)

0.60 이상: 시장 참여자 다수가 상승에 베팅
0.40 이하: 시장 참여자 다수가 하락 또는 헤지
```

**감마 노출 (Gamma Exposure, GEX) — §6에서 상세:**

```
시장 조성자의 총 감마 포지션이 시장의 "점성(viscosity)"을 결정한다.
Positive GEX → 시장 안정화 (mean-reversion 강화)
Negative GEX → 시장 불안정화 (momentum 강화)
```

---

## 2. 내재변동성과 VKOSPI

### 2.1 내재변동성 (Implied Volatility) 산출

내재변동성(IV)은 시장 가격이 주어졌을 때 BSM 공식을 역산하여 추출하는 σ이다.
해석적 역함수가 존재하지 않으므로 수치 반복법을 사용한다.

**Newton-Raphson 반복법:**

```
σ_{n+1} = σ_n - [C_BSM(σ_n) - C_market] / ν(σ_n)

ν(σ_n) = S·√T·N'(d₁)  — BSM 베가

초기값: σ_0 = √(2π/T) · C_market/S  (Brenner-Subrahmanyam 근사)
수렴 조건: |C_BSM(σ_n) - C_market| < 1e-8
보통 3-5회 반복으로 수렴
```

**IV vs HV (Historical Volatility) 해석:**

```
HV = σ_realized = √(252 · Var(r_daily))   — 과거 실현 변동성
IV = σ_implied                              — 시장이 예측하는 미래 변동성

IV/HV 비율 해석:
  IV/HV > 1.3: 시장이 미래 변동성을 과대 평가 (공포 프리미엄)
                → 옵션 매도 전략 유리, 평균 회귀 패턴 유리
  IV/HV ≈ 1.0: 균형 상태
  IV/HV < 0.8: 시장이 변동성을 과소 평가 (안일)
                → 돌파 패턴 대비, 옵션 매수 전략 유리
```

참고: 05_finance_theory.md §5.2에서 IV/HV 괴리의 기본 개념을 소개했다.
05_finance_theory.md §8에서 EWMA 변동성(λ=0.94)의 HV 추정을 상세 설명한다.

### 2.2 변동성 미소와 스큐 (Volatility Smile & Skew)

BSM은 모든 행사가에서 동일한 σ를 가정하지만, 현실 시장의 IV는 행사가별로 다르다.

```
변동성 미소 (Volatility Smile):
  OTM Put IV > ATM IV > OTM Call IV  (주식/지수 옵션의 전형적 형태)

이를 "스큐(skew)"라 부르며, 하방 꼬리 위험에 대한 보험 프리미엄을 반영:
  1987 Black Monday 이후 OTM Put의 프리미엄이 영구적으로 상승
  → "crash fear premium" (Bates 2000)

스큐 측정:
  Skew_25d = IV(25Δ Put) - IV(25Δ Call)

  KRX 정상 범위: Skew_25d ≈ 3-7%p
  위기 시:       Skew_25d > 15%p (2020.03 COVID, 2026.03 지정학 위기)
```

**변동성 기간구조 (Term Structure):**

```
단기 IV vs 장기 IV:
  정상: 단기 < 장기 (contango) — 불확실성 프리미엄
  위기: 단기 > 장기 (backwardation) — 즉각적 공포

기간구조 기울기:
  slope = (IV_3M - IV_1M) / IV_1M

  slope > 0: 정상 → 패턴 신호 표준 적용
  slope < -0.1: 역전 → 단기 위기 → 방향성 신호 신뢰도 -15%
```

### 2.3 VKOSPI — 한국의 공포 지수

VKOSPI는 KOSPI200 옵션의 30일 내재변동성을 지수화한 것으로,
CBOE VIX 방법론을 KRX에 적용한 한국의 "공포 지수"이다.

KRX (2009) 도입, CBOE VIX White Paper (2003) 기반.

**산출 공식:**

```
VKOSPI = 100 × √[(2/T) × Σᵢ (ΔKᵢ/Kᵢ²) × e^(rT) × Q(Kᵢ) - (1/T)(F/K₀ - 1)²]

T    : 만기까지 시간 (연 환산)
F    : 선도가격 = K₀ + e^(rT) × [C(K₀) - P(K₀)]
K₀   : 선도가격 바로 아래 행사가
Kᵢ   : i번째 행사가
ΔKᵢ  : (K_{i+1} - K_{i-1}) / 2  (행사가 간격의 평균)
Q(Kᵢ): K < K₀이면 풋 중간가격, K > K₀이면 콜 중간가격, K = K₀이면 평균
r    : 무위험이자율
```

근월물과 차월물 두 만기의 가중평균으로 정확히 30일 IV를 산출한다.
이는 모형-비의존적(model-free) 방법으로, BSM 가정에 기대지 않는다.

**VKOSPI 역사적 범위 (2009-2026):**

| 구간 | VKOSPI 범위 | 빈도 | 시장 상태 |
|------|------------|------|----------|
| 극저변동성 | < 12% | ~5% | 과도한 안일, 돌파 대비 |
| 저변동성 | 12-15% | ~15% | 안정적, 추세 추종 유리 |
| 정상 | 15-22% | ~45% | 표준 상태 |
| 경계 | 22-30% | ~20% | 불확실성 증가, 경계 |
| 고변동성 | 30-40% | ~10% | 위기 초기 |
| 극단 | > 40% | ~5% | 시장 패닉 (COVID: 67%, 금융위기: 89%) |

**VKOSPI vs VIX 상관과 선행-후행:**

```
상관계수: ρ(VKOSPI, VIX) ≈ 0.85 (일별, 2009-2026)

선행-후행 관계:
  - VIX 급등 → 1-2 거래일 후 VKOSPI 반응 (글로벌 위기 전파)
  - VKOSPI 독자 급등: KRX 고유 이벤트 (계엄, 탄핵, 지정학)
  - 2026.03 사례: VIX 37 → VKOSPI 48 (2일 후행, 배율 1.3x)
```

**패턴 신뢰도 레짐 분류:**

```
VKOSPI < 15:  저변동성 레짐
  → 돌파 패턴(ascending triangle, symmetricTriangle 등) 신뢰도 +10%
  → 볼린저 밴드 squeeze = 에너지 축적, 방향성 패턴 의미 증가
  → 평균 회귀 패턴(double bottom/top) 신뢰도 -5% (변동성 부족)

VKOSPI 15-25: 정상 레짐
  → 표준 신뢰도 적용 (조정 없음)

VKOSPI 25-35: 경계 레짐
  → 방향성 신호 신뢰도 × 0.85 (-15%)
  → 역추세 패턴(reversal) 위양성 증가 주의

VKOSPI > 35:  위기 레짐
  → 모든 방향성 신호 신뢰도 × (0.50 ~ 0.75)
  → 지지/저항선 무력화 (20번 §6 서킷브레이커 참조)
  → 캔들 패턴은 노이즈에 매몰 — 차트 패턴만 제한적 유효
```

Tier 분류: [C][L:GCV] — KRX 실측 기반 임계값, GCV로 최적화 가능.

### 2.4 리스크 중립 확률밀도 (Risk-Neutral PDF)

Breeden & Litzenberger (1978): 옵션 가격의 행사가에 대한 2차 도함수로
시장이 암묵적으로 가정하는 만기 시 주가 확률분포를 추출할 수 있다.

```
q(S_T = K) = e^(rT) × ∂²C/∂K²

이산 근사 (행사가 간격 ΔK):
q(K) ≈ e^(rT) × [C(K+ΔK) - 2C(K) + C(K-ΔK)] / (ΔK)²
```

이 확률밀도가 정규분포와 다른 정도가 시장의 비정규성(non-normality) 기대를 반영한다:
- 좌측 꼬리가 두꺼움 → 하락 위험 과대 평가 (crash premium)
- 우측 꼬리가 두꺼움 → 급등 기대 (squeeze premium)

**적용 한계:** KOSPI200 옵션에서만 산출 가능. 개별 종목 옵션은 유동성이
부족하여 행사가 격자가 조밀하지 못하므로 2차 차분이 불안정하다.

---

## 3. Put-Call Ratio (PCR) 분석

### 3.1 PCR 산출과 해석

Put-Call Ratio는 풋옵션 활동량 대비 콜옵션 활동량의 비율이다.

```
PCR_volume = Volume_put / Volume_call
PCR_OI     = OI_put / OI_call

Volume-based: 단기 심리 (일중 변동 큼)
OI-based:     중기 포지션 심리 (더 안정적)
```

**역발상(Contrarian) 해석 — KRX 임계값:**

PCR은 전형적인 역행지표(contrarian indicator)로 활용된다.
극단적 공포/탐욕 시점에서 대중과 반대 방향이 유리하다.

```
KOSPI200 옵션 PCR (OI 기준, 2015-2026 분포):

PCR > 1.2:  극단적 공포 → 역발상 매수 신호
            상위 10% 분위, 향후 20일 수익률 중위수 +1.8%
PCR 0.8-1.2: 중립대
            표준 신뢰도 적용
PCR < 0.6:  극단적 낙관 → 역발상 매도 신호
            하위 10% 분위, 향후 20일 수익률 중위수 -1.2%

5일 이동평균 PCR을 사용하여 일중 노이즈 평활화:
PCR_5d = MA(5, PCR_daily)
```

Tier 분류: [C][L:GCV] — 임계값은 KRX 실측 기반, GCV 최적화 대상.

### 3.2 PCR과 시장 전환점

PCR 극단값은 시장 전환점의 선행지표로서 학술적 근거가 있다.

```
이중 확인 조건 (PCR + VKOSPI):

매수 확인: PCR_5d > 1.2 AND VKOSPI > 25
  → "공포가 가격에 반영됨" 확률 높음
  → 24번 §1의 FearGreed < 0.3 조건과 합산 시 신뢰도 증폭

매도 확인: PCR_5d < 0.6 AND VKOSPI < 15
  → "탐욕이 극에 달함" 확률 높음
  → FearGreed > 0.7 조건과 합산 시 역추세 신호
```

학술 근거:
- Whaley (2000) "The Investor Fear Gauge": VIX 극단값이 시장 반전을 선행.
- Pan & Poteshman (2006): 옵션 거래량 비율이 주가 예측력 보유 (IC ≈ 0.03-0.05).

---

## 4. 개별 주식 옵션 (Individual Stock Options on KRX)

### 4.1 KRX 개별 주식 옵션 현황

한국거래소는 KOSPI200 지수 옵션 외에 개별 주식 옵션도 상장한다.

```
개별 주식 옵션 상장 종목 수 (2026년 기준): ~85종목
  - KOSPI: Samsung(005930), SK Hynix(000660), Hyundai Motor(005380),
           POSCO Holdings(005490), KB Financial(105560) 등
  - KOSDAQ: 극소수 (셀트리온 등 대형주 한정)

유동성 집중: 상위 10-15종목이 전체 거래대금의 ~80% 차지
CheeseStock 유니버스 대비: 85/2,728 ≈ 3.1% 커버리지
```

### 4.2 대형주 IV와 소형주 대리 측정

옵션이 상장된 대형주는 IV를 직접 산출할 수 있으나,
CheeseStock이 다루는 2,728종목 중 97%는 옵션이 없다.

**직접 IV 가용 종목:** Samsung, SK Hynix, Hyundai Motor, POSCO, KB Financial 등.

**비상장 종목의 IV 대리 추정 (Proxy):**

```
IV_proxy(i) = VKOSPI × β_sector(i) × (1 + 0.3 × ln(cap_median / cap_i))

β_sector(i): 종목 i가 속한 섹터의 KOSPI200 대비 베타
             (25번 §1.2의 방법으로 산출)
cap_median:  전체 종목 시가총액 중위수
cap_i:       종목 i의 시가총액
0.3:         소형주 변동성 프리미엄 계수 [C][L:GCV]
```

직관: VKOSPI는 시장 전체 IV의 앵커. 섹터 베타로 산업별 차이를 반영하고,
시가총액 비율의 로그로 소형주의 추가 변동성을 보정한다.

```
예시:
  VKOSPI = 20%, β_sector(반도체) = 1.15
  Samsung (cap_i ≈ 400조):  IV_proxy ≈ 20 × 1.15 × (1 + 0.3 × ln(0.15/400)) ≈ 17.8%
  소형 반도체 (cap_i ≈ 500억): IV_proxy ≈ 20 × 1.15 × (1 + 0.3 × ln(0.15/0.05)) ≈ 30.3%
```

Tier 분류: [D][L:GCV] — 0.3 계수는 경험적 추정, 검증 필요.

---

## 5. 공포-탐욕 지수 V2 통합 (Fear-Greed V2 Integration)

### 5.1 기존 공포-탐욕 공식 (24번 §1 복습)

24_behavioral_quantification.md에서 정의한 CNN Fear & Greed의 KRX 버전:

```
FG_v1 = 0.30·RSI_norm + 0.30·volSurge_norm + 0.20·volRatio_norm + 0.20·newHighLow_norm
```

이 공식은 가격과 거래량 정보만 사용하며, 파생상품 시장의 정보를 반영하지 못한다.

### 5.2 확장 공식 (Fear-Greed V2)

VKOSPI와 PCR을 추가하여 6요소 공포-탐욕 지수로 확장한다:

```
FG_v2 = w₁·RSI_norm + w₂·volSurge_norm + w₃·volRatio_norm
      + w₄·newHighLow_norm + w₅·VKOSPI_norm + w₆·(1 - PCR_norm)

w₁=0.25, w₂=0.20, w₃=0.15, w₄=0.15, w₅=0.15, w₆=0.10
Σwᵢ = 1.00
```

**정규화 방법:**

```
RSI_norm      = RSI(14) / 100                    ∈ [0, 1]
volSurge_norm = clamp(ATR14/ATR50, 0, 3) / 3     ∈ [0, 1], >1.2=공포
volRatio_norm = clamp(Vol/VMA20, 0, 5) / 5        ∈ [0, 1], >2=극단
newHighLow_norm = (신고가 - 신저가)/(전체종목) 정규화  ∈ [0, 1]

VKOSPI_norm   = clamp((VKOSPI - 10) / 50, 0, 1)  ∈ [0, 1]
                10% → 0.0 (극저변동성)
                35% → 0.5 (경계)
                60% → 1.0 (극단 공포)

PCR_norm      = clamp((PCR - 0.4) / 1.2, 0, 1)    ∈ [0, 1]
                0.4 → 0.0 (극단 낙관)
                1.0 → 0.5 (중립)
                1.6 → 1.0 (극단 공포)
(1 - PCR_norm): PCR이 높을수록 공포이므로 반전하여 FG 스케일에 맞춤
```

**가중치 선택 근거:**

| 요소 | v1 가중치 | v2 가중치 | 조정 이유 |
|------|----------|----------|----------|
| RSI | 0.30 | 0.25 | 파생상품 요소 추가로 비례 감소 |
| volSurge | 0.30 | 0.20 | VKOSPI가 변동성 정보 일부 흡수 |
| volRatio | 0.20 | 0.15 | 비례 감소 |
| newHighLow | 0.20 | 0.15 | 비례 감소 |
| VKOSPI | — | 0.15 | 시장 전체 공포 수준의 직접 측정 |
| PCR | — | 0.10 | 옵션 시장 심리, 다만 KRX 유동성 한계로 가중치 제한 |

Tier 분류: [C][L:GCV] — 가중치는 KRX 적응값, 워크포워드 GCV로 최적화 가능.

### 5.3 패턴 신뢰도 동적 조정

IV/HV 비율을 이용하여 패턴 신뢰도를 시장 체제에 맞게 동적 조정한다.

```
conf_adjusted = conf × (1 - α × max(0, IV/HV - 1))

conf:     패턴 엔진이 산출한 원래 신뢰도 (patterns.js confidence)
IV/HV:    내재변동성 / 역사적 변동성 비율
α:        IV 민감도 파라미터 ∈ [0.1, 0.3]

해석:
  IV/HV = 1.0: 조정 없음 (conf_adjusted = conf)
  IV/HV = 1.5: conf × (1 - α × 0.5)
               α=0.2이면 conf × 0.90 (-10%)
  IV/HV = 2.0: conf × (1 - α × 1.0)
               α=0.2이면 conf × 0.80 (-20%)

상한: conf_adjusted ≥ conf × 0.50 (최대 50% 감쇠)
```

α 파라미터의 Tier 분류: [C][L:GCV] — 기본값 0.2, 범위 [0.1, 0.3].

직관: IV가 HV보다 높다는 것은 시장이 앞으로 더 큰 변동성을 예상한다는 뜻이다.
이때 현재 가격 기반의 캔들/차트 패턴은 곧 올 변동성에 의해 무효화될 확률이 높으므로
신뢰도를 하향 조정하는 것이 합리적이다.

---

## 6. 감마 노출 (Gamma Exposure, GEX) 효과

### 6.1 시장 조성자 감마 헤지 메커니즘

옵션 시장 조성자(market maker)는 매도한 옵션의 감마를 기초자산 매매로 헤지한다.
이 역학이 지수 수준의 기계적 지지/저항을 생성한다.

```
GEX = Σᵢ [OI_call(Kᵢ) × Γ_call(Kᵢ) × 100 × Kᵢ]
    - Σᵢ [OI_put(Kᵢ) × Γ_put(Kᵢ) × 100 × Kᵢ]

(부호 규약: 시장 조성자가 옵션을 매도(short)한 것으로 가정)
```

**Positive GEX (GEX > 0):**

```
시장 조성자 포지션: 음의 감마 (short gamma from sold calls/puts)
→ 주가 상승 시: 델타 증가 → MM이 기초자산 매도 (delta-neutral 유지)
→ 주가 하락 시: 델타 감소 → MM이 기초자산 매수

효과: "주가가 떨어지면 사고, 올라가면 판다"
→ 시장의 평균 회귀(mean-reversion) 강화
→ 변동성 억제, 레인지 바운드
```

**Negative GEX (GEX < 0):**

```
시장 조성자 포지션: 양의 감마 (long gamma — 비전형적 상황)
또는 더 정확하게: 딜러들이 순매수 풋 포지션을 보유
→ 주가 하락 시: 풋 델타 증가 → MM이 기초자산 추가 매도 (헤지)
→ 주가 상승 시: 풋 델타 감소 → MM이 기초자산 매수 감소

효과: "주가가 떨어지면 더 팔아야 한다"
→ 시장의 모멘텀(momentum) 강화
→ 변동성 증폭, 급락/급등 가속
```

**GEX Flip Level:**

```
GEX = 0이 되는 주가 수준 = "감마 전환선"
  이 수준 위: positive GEX → 안정적
  이 수준 아래: negative GEX → 불안정

기술적 분석 관점에서 GEX flip level은
옵션 시장이 만들어내는 "구조적 지지/저항선"이다.
```

### 6.2 KRX 적용

KOSPI200 옵션 기반으로 GEX를 개략 산출할 수 있다.
다만 KRX 옵션 데이터의 공개 수준에 제약이 있다.

```
산출 가능 범위:
  - 일별 행사가별 OI: KRX 공시 (무료)
  - 감마 산출: BSM으로 각 행사가의 Γ 계산
  - GEX 근사: OI × Γ × 100 × K의 총합

GEX > 0: 레인지 바운드 패턴 (double top/bottom, rectangle) 신뢰도 +10%
GEX < 0: 돌파 패턴 (triangle, wedge breakout) 신뢰도 +10%

→ 패턴 카테고리별로 GEX 부호에 따라 신뢰도를 차등 부여
```

Tier 분류: [D][L:MAN] — KRX 데이터 접근성 확인 후 구현 우선순위 결정.

---

## 7. CheeseStock 구현 경로

### 7.1 데이터 소스와 파이프라인

```
[데이터 소스]                    [배치 처리]                 [JS 소비]

KRX data.krx.co.kr              scripts/download_vkospi.py  data/derivatives.json
├── VKOSPI 일별종가 (무료)       ├── VKOSPI 시계열           ├── vkospi[]
├── KOSPI200 옵션 OI (무료)      ├── PCR 시계열              ├── pcr[]
└── 옵션 거래량 (무료)            └── GEX 근사 (선택)         └── gex[] (optional)

업데이트 주기: daily_update.bat에 통합 (장 마감 후 1회)
파일 크기: ~50KB (1년 일별 데이터)
```

구현 난이도: LOW — Python 스크립트 1개 추가, JSON 파일 1개, JS에서 fetch.
scripts.md에 `download_vkospi.py` 항목 추가 필요.

### 7.2 APT 팩터 확장

23_apt_factor_model.md의 기존 17열 Ridge 회귀 설계에 파생상품 팩터를 추가할 수 있다:

```
기존 17열:
  [hw, vw, mw, quality, beta, momentum, value, size, liquidity, ...]

확장 후 19열:
  [..., VKOSPI_norm, PCR_norm]

VKOSPI_norm: VKOSPI z-score (§2.3의 레짐 분류 기반)
PCR_norm:    PCR z-score (§3.1의 역발상 해석 기반)

예상 IC 개선: +0.005 ~ +0.015 (시장 체제 정보의 직교적 기여)
```

이 팩터들은 종목별 고유 정보가 아닌 시장 공통(market-wide) 팩터이므로,
모든 종목에 동일한 값이 입력된다. 종목별 차별화는 기존 17열이 담당하고,
VKOSPI/PCR은 시장 레짐 조건부(conditioning) 역할을 한다.

### 7.3 Learnable Constants Registry 추가

22_learnable_constants_guide.md의 Master Registry에 추가할 상수:

| # | Constant | Value | Tier | Learn | Range | Source |
|---|----------|-------|------|-------|-------|--------|
| 57 | VKOSPI_LOW_THRESH | 15 | C | GCV | [12, 18] | KRX 분포 분석 |
| 58 | VKOSPI_HIGH_THRESH | 35 | C | GCV | [30, 40] | KRX 분포 분석 |
| 59 | PCR_FEAR_THRESH | 1.2 | C | GCV | [1.0, 1.5] | KOSPI200 OI 분포 |
| 60 | PCR_GREED_THRESH | 0.6 | C | GCV | [0.4, 0.8] | KOSPI200 OI 분포 |
| 61 | IV_SENSITIVITY_ALPHA | 0.2 | C | GCV | [0.1, 0.3] | §5.3 이론 |
| 62 | SIZE_VOL_PREMIUM | 0.3 | D | GCV | [0.1, 0.5] | §4.2 경험적 |

---

## 8. 학술 참고문헌

1. Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities." *Journal of Political Economy*, 81(3), 637-654.
2. Merton, R.C. (1973). "Theory of Rational Option Pricing." *Bell Journal of Economics and Management Science*, 4(1), 141-183.
3. Breeden, D.T. & Litzenberger, R.H. (1978). "Prices of State-Contingent Claims Implicit in Option Prices." *Journal of Business*, 51(4), 621-651.
4. CBOE (2003). "VIX White Paper: CBOE Volatility Index." Chicago Board Options Exchange.
5. Whaley, R.E. (2000). "The Investor Fear Gauge." *Journal of Portfolio Management*, 26(3), 12-17.
6. Bates, D.S. (2000). "Post-'87 Crash Fears in the S&P 500 Futures Option Market." *Journal of Econometrics*, 94(1-2), 181-238.
7. Pan, J. & Poteshman, A.M. (2006). "The Information in Option Volume for Future Stock Prices." *Review of Financial Studies*, 19(3), 871-908.
8. Brenner, M. & Subrahmanyam, M.G. (1988). "A Simple Formula to Compute the Implied Standard Deviation." *Financial Analysts Journal*, 44(5), 80-83.
9. Bollerslev, T. (1986). "Generalized Autoregressive Conditional Heteroskedasticity." *Journal of Econometrics*, 31(3), 307-327.
10. J.P. Morgan / Reuters (1996). "RiskMetrics — Technical Document." 4th Edition.
11. KRX (2009). "VKOSPI 산출 방법론." 한국거래소 파생상품시장본부.
12. Taleb, N.N. (1997). *Dynamic Hedging: Managing Vanilla and Exotic Options.* John Wiley & Sons.
13. Odean, T. (1998). "Are Investors Reluctant to Realize Their Losses?" *Journal of Finance*, 53(5), 1775-1798. (24번 문서 교차참조)
14. Sharpe, W.F. (1964). "Capital Asset Prices." *Journal of Finance*, 19(3), 425-442. (25번 문서 교차참조)

---

## 문서 간 교차참조 (Cross-Reference Map)

| 이 문서 절 | 참조 문서 | 참조 절 | 내용 |
|-----------|----------|--------|------|
| §1.1 BSM 공식 | 05_finance_theory.md | §5.1 | BSM 기본 소개 (본 문서에서 심층 확장) |
| §1.1 가격제한 위배 | 20_krx_structural_anomalies.md | §2 | ±30% 절단 수익률 |
| §1.2 Rho | 25_capm_delta_covariance.md | §1.3 | 한국 무위험이자율 수준 |
| §2.1 EWMA HV | 05_finance_theory.md | §8 | EWMA λ=0.94, z-score 정규화 |
| §3.2 FG 합산 | 24_behavioral_quantification.md | §1 | FG v1 공포-탐욕 지수 |
| §4.2 β_sector | 25_capm_delta_covariance.md | §1.2 | 베타 산출 방법론 |
| §5.1 FG v1 | 24_behavioral_quantification.md | §1 | 원본 공식, 가중치 |
| §6 서킷브레이커 | 20_krx_structural_anomalies.md | §6 | 서킷브레이커 발동 시 패턴 무효화 |
| §7.2 APT 확장 | 23_apt_factor_model.md | 전체 | 기존 17열 팩터 설계 |
| §7.3 상수 분류 | 22_learnable_constants_guide.md | §1-3 | 5-Tier 분류 체계 |
