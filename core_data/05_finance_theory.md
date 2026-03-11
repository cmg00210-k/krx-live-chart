# 05. 금융학 이론 — Finance Theory Foundations

> 기술적 분석을 이해하려면 먼저 그것이 도전하는 주류 금융 이론을 알아야 한다.

---

## 1. 효율적 시장 가설 (Efficient Market Hypothesis)

### 1.1 세 가지 형태

Eugene Fama (1970), *Efficient Capital Markets: A Review of Theory
and Empirical Work*, Journal of Finance

```
약형 효율 (Weak Form):
  현재 가격 = 모든 과거 가격 정보 반영
  → 기술적 분석 무용

준강형 효율 (Semi-Strong Form):
  현재 가격 = 모든 공개 정보 반영
  → 기술적 분석 + 기본적 분석 모두 무용

강형 효율 (Strong Form):
  현재 가격 = 모든 정보(내부 정보 포함) 반영
  → 어떤 분석도 초과 수익 불가
```

### 1.2 수학적 표현

```
Pₜ = E[Pₜ₊₁|Φₜ] / (1 + r)

여기서 Φₜ = 시점 t까지의 정보 집합
r = 요구 수익률

→ 가격 변화: Pₜ₊₁ - E[Pₜ₊₁|Φₜ] = εₜ₊₁ (마르팅게일 차분)
→ 예측 불가능한 충격만 가격 변동 유발
```

### 1.3 EMH에 대한 반론과 기술적 분석의 위치

**찬성 (EMH 지지)**:
- Burton Malkiel, *A Random Walk Down Wall Street* (1973)
- Jensen (1978): "효율적 시장 가설보다 더 많은 실증적 지지를 받은 경제학 명제는 없다"

**반대 (기술적 분석 정당화)**:
- Lo & MacKinlay (1988): 주간 수익률의 양의 자기상관 → 약형 효율 부정
- Brock, Lakonishok & LeBaron (1992): 이동평균·지지/저항 전략의 유의미한 수익
- Lo, Mamaysky & Wang (2000): 자동 패턴 인식으로 통계적으로 유의한 정보 발견
- Andrew Lo (2004): **적응적 시장 가설 (Adaptive Market Hypothesis)**
  → 시장 효율성은 고정이 아닌 진화하는 것

---

## 2. 현대 포트폴리오 이론 (Modern Portfolio Theory)

### 2.1 평균-분산 최적화

Harry Markowitz (1952), *Portfolio Selection*, Journal of Finance
(1990 노벨 경제학상)

```
포트폴리오 기대수익률:
E[Rₚ] = Σ wᵢ · E[Rᵢ]

포트폴리오 분산:
σₚ² = Σ Σ wᵢwⱼσᵢⱼ

최적화:
min σₚ²  subject to  E[Rₚ] = R*,  Σwᵢ = 1
```

효율적 프론티어: 주어진 수익률에서 최소 위험인 포트폴리오들의 집합

### 2.2 기술적 분석과의 관계

MPT는 "어떤 종목을, 얼마나" 보유할지를 결정.
기술적 분석은 "언제 매수/매도할지"를 결정.
→ 상호 보완적 관계

볼린저 밴드: 위험(σ)을 시각화
RSI/MACD: 수익률 모멘텀의 시각화

---

## 3. 자본자산 가격결정 모형 (CAPM)

### 3.1 CAPM 공식

William Sharpe (1964), John Lintner (1965)
(1990 노벨 경제학상)

```
E[Rᵢ] = Rf + βᵢ · (E[Rm] - Rf)

βᵢ = Cov(Rᵢ, Rm) / Var(Rm)

Rf: 무위험 수익률
Rm: 시장 수익률
βᵢ: 체계적 위험 (시장에 대한 민감도)
```

- β = 1: 시장과 동일한 변동
- β > 1: 시장보다 민감 (공격적)
- β < 1: 시장보다 둔감 (방어적)

### 3.2 알파 (α)

```
α = Rᵢ - [Rf + β(Rm - Rf)]

Jensen's Alpha: CAPM 예측 대비 초과 수익
```

기술적 분석의 목표: α > 0인 진입/퇴장 시점을 찾는 것.
EMH가 맞다면 기술적 분석으로 α를 얻을 수 없다.

※ CAPM의 현대적 위치:
  Fama & French (1992) 이후 CAPM의 β만으로 수익률 설명 불충분 입증.
  현대 표준:
  - Fama-French 5요인 모형 (2015): 시장 + 규모 + 가치 + 수익성 + 투자
  - Carhart 4요인 (1997): + 모멘텀
  - 머신러닝 팩터 모형 (2020+): 수백 개 팩터의 비선형 조합

  CAPM은 여전히 WACC 계산, 교육용, 개념적 프레임워크로 활용됨.
  그러나 단일 β에 기반한 투자 의사결정은 권장되지 않음.

---

## 4. Fama-French 요인 모형

### 4.1 3요인 모형

Fama & French (1993), *Common Risk Factors in the Returns on
Stocks and Bonds*, Journal of Financial Economics

```
E[Rᵢ] - Rf = βᵢ(Rm - Rf) + sᵢ·SMB + hᵢ·HML

SMB = Small Minus Big (규모 요인)
HML = High Minus Low (가치 요인)
```

### 4.2 5요인 모형 (2015 확장)

```
E[Rᵢ] - Rf = βᵢ(Rm - Rf) + sᵢ·SMB + hᵢ·HML + rᵢ·RMW + cᵢ·CMA

RMW = Robust Minus Weak (수익성)
CMA = Conservative Minus Aggressive (투자)
```

### 4.3 모멘텀 요인

Carhart (1997), 4요인 모형에 모멘텀 추가:
```
+ uᵢ·UMD

UMD = Up Minus Down (모멘텀)
= 최근 승자 - 최근 패자
```

금융 적용: 기술적 분석의 추세 추종 전략이
모멘텀 요인에 대한 노출(exposure)로 해석될 수 있다.

---

## 5. 옵션 가격 결정과 Black-Scholes

### 5.1 Black-Scholes-Merton 공식

Black & Scholes (1973), Merton (1973)
(1997 노벨 경제학상)

```
콜옵션: C = S·N(d₁) - K·e^(-rT)·N(d₂)
풋옵션: P = K·e^(-rT)·N(-d₂) - S·N(-d₁)

d₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ - σ√T

S: 기초자산 가격
K: 행사가
r: 무위험이자율
T: 만기까지 시간
σ: 변동성 (implied volatility)
N(): 표준정규분포 누적분포함수
```

### 5.2 내재 변동성과 기술적 분석

```
내재 변동성 (IV): BSM 공식에서 시장 가격이 주어졌을 때 역산되는 σ

VIX 지수: S&P 500 옵션의 30일 내재 변동성
  → "공포 지수"로 불림

변동성 미소 (Volatility Smile):
행사가별 IV가 U자 형태
→ 시장이 정규분포보다 극단적 사건을 높게 평가
→ 두꺼운 꼬리의 시장가 반영
```

기술적 분석 연결:
- 볼린저 밴드의 σ = 역사적 변동성 (HV)
- IV vs HV 괴리 = 시장의 기대 변동성 vs 과거 변동성
- IV > HV: 시장이 미래 불확실성을 높게 평가 (공포)
- IV < HV: 시장이 안정을 기대 (안도)

---

## 6. 적응적 시장 가설 (Adaptive Market Hypothesis)

Andrew Lo (2004), *The Adaptive Markets Hypothesis: Market Efficiency
from an Evolutionary Perspective*

### 6.1 핵심 주장

```
시장 효율성은 고정된 상태가 아니라
시장 참여자들의 적응과 진화에 따라 변동하는 동적 과정이다.
```

진화 생물학의 개념을 금융에 적용:
1. **경쟁**: 투자자들이 제한된 수익 기회를 놓고 경쟁
2. **적응**: 성공적인 전략이 모방되고 확산
3. **자연선택**: 비효율적인 전략은 도태
4. **혁신**: 새로운 분석 기법과 기술의 등장

### 6.2 기술적 분석에 대한 함의

```
전통적 EMH: 기술적 분석은 원칙적으로 무용
적응적 가설: 기술적 분석은 때로 유효하고 때로 무효

- 효율적 시기: 많은 참여자가 같은 전략 사용 → 수익 소멸
- 비효율적 시기: 새로운 환경/위기 → 과거 패턴이 다시 유효
```

이는 기술적 분석의 유효성이 왜 시장 환경에 따라 달라지는지 설명한다.

※ AMH의 실전적 한계:
  - "때로 유효하고 때로 무효"는 반증 불가능(unfalsifiable)한 주장
  - 효율성 수준의 정량적 측정 방법이 부재
  - 현대 접근법:
    1) 자기상관 계수의 시변 추정 (rolling ACF)
    2) Hurst 지수의 시변 추정 (rolling H)
    3) 전략 수익률의 구조 변화 검정 (Bai-Perron test)
    → 이러한 정량적 도구로 "시장 효율성의 변동"을 측정 가능

---

## 7. 위험 측정 (Risk Measures)

### 7.1 VaR (Value at Risk)

```
VaR: 주어진 신뢰수준(α)에서의 최대 예상 손실
  P(Loss > VaR_α) = 1 - α
```

### 7.2 CVaR / Expected Shortfall

```
CVaR_α = E[Loss | Loss > VaR_α]
→ VaR을 초과하는 손실의 평균 크기 (꼬리 위험 측정)
```

VaR/CVaR 산출 방법(역사적 시뮬레이션, 분산-공분산, 몬테카를로)의
상세 내용은 12_extreme_value_theory.md 및 14_finance_management.md를 참조.

### 7.3 샤프 비율 (Sharpe Ratio)

William Sharpe (1966)

```
SR = (E[Rₚ] - Rf) / σₚ  — 위험 단위당 초과 수익
```

샤프 비율의 변형(Sortino, Calmar, 연환산 등)과 전략 성과 평가 프레임워크의
상세 내용은 14_finance_management.md §5를 참조.

### 7.4 최대 낙폭 (Maximum Drawdown)

```
MDD = max_t [max_{s≤t} P(s) - P(t)] / max_{s≤t} P(s)

고점 대비 최대 하락 비율
```

기술적 분석의 실전적 위험 지표:
전략의 "최악의 순간"을 정량화

---

## 핵심 이론 vs 기술적 분석 매핑

| 금융 이론 | 기술적 분석 입장 | 타협점 |
|-----------|-----------------|--------|
| EMH (효율적 시장) | 반대 (패턴에 정보가 있다) | 적응적 시장 가설 |
| CAPM (β 위험) | 무관 (시점 선택에 집중) | α = 기술적 분석의 가치 |
| MPT (분산 투자) | 보완적 (타이밍 도구) | 포트폴리오 + 타이밍 |
| Black-Scholes (σ) | 활용 (내재변동성 분석) | IV/HV 비교 전략 |
| 행동금융학 | 지지 (비합리적 패턴 존재) | 심리적 패턴 = 기술적 패턴 |
