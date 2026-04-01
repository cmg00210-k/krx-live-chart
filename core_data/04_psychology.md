# 04. 행동경제학과 시장 심리학 — Behavioral Finance & Market Psychology

> "시장은 단기적으로 투표 기계이고, 장기적으로 저울이다."
> — Benjamin Graham, *The Intelligent Investor* (1949)

---

## 1. 전망이론 (Prospect Theory)

### 1.1 기대효용이론의 한계

Von Neumann & Morgenstern (1944), *Theory of Games and Economic Behavior*
→ 합리적 행위자는 기대효용을 최대화한다는 가정

Daniel Kahneman & Amos Tversky (1979), *Prospect Theory: An Analysis
of Decision under Risk*, Econometrica — 이 가정을 실험적으로 반증

### 1.2 전망이론의 핵심 요소

**가치함수 (Value Function)**:
```
v(x) = x^α           (x ≥ 0, 이득)
v(x) = -λ(-x)^β      (x < 0, 손실)

실험적 추정:
α ≈ 0.88,  β ≈ 0.88,  λ ≈ 2.25
```

※ 파라미터 업데이트 (Post-2010 메타분석):
  Kahneman & Tversky (1979) 원본: α ≈ 0.88, β ≈ 0.88, λ ≈ 2.25

  Stott (2006) 메타분석: α ∈ [0.6, 1.0], β ∈ [0.6, 1.0]
  Wakker (2010) 종합:    λ ∈ [1.5, 3.5] (맥락에 따라 변동)
  Abdellaoui et al. (2008): λ ≈ 1.5~2.0 (금융 의사결정)

  → 알고리즘적 행동 모형에서는 단일 값보다 범위를 사용하고,
    시장 국면(상승/하락/횡보)에 따라 λ를 적응적으로 추정 권장

핵심 특성:
1. **참조점 의존**: 절대적 부가 아닌 변화(이득/손실)로 평가
2. **손실 회피 (Loss Aversion)**: λ ≈ 2.25 → 손실이 이득보다 2.25배 아프다
3. **체감 민감도**: 이득과 손실 모두에서 한계효용 체감
4. **오목(이득)/볼록(손실)**: 이득 영역에서 위험 회피, 손실 영역에서 위험 추구

**확률 가중 함수 (Probability Weighting)**:

※ 확률 가중 함수는 **누적 전망이론(Cumulative Prospect Theory)**의 핵심 요소로,
  원본 전망이론(Kahneman & Tversky, 1979)이 아닌 **Tversky & Kahneman (1992),
  "Advances in Prospect Theory: Cumulative Representation of Uncertainty",
  Journal of Risk and Uncertainty**에서 도입되었다.
  1979년 논문은 원본 전망이론(가치함수 + 결정 가중치),
  1992년 논문은 누적 확률 가중과 순위 의존 효용으로의 확장이다.

```
w(p) = p^γ / (p^γ + (1-p)^γ)^(1/γ)

γ ≈ 0.61 (Tversky & Kahneman, 1992 — 누적 전망이론)
```

- 낮은 확률 과대평가 → 복권 효과 (급등 기대)
- 높은 확률 과소평가 → 확실성 효과

금융 적용:
- 투자자가 손실 종목을 너무 오래 보유 (disposition effect)
- 적삼병 같은 강세 패턴에서도 "이 정도면 충분히 올랐다"며 조기 매도
- 하락 중 손절 기피 → 손실 확대

### 1.3 처분효과 (Disposition Effect)

Shefrin & Statman (1985), *The Disposition to Sell Winners Too Early
and Ride Losers Too Long*, Journal of Finance

```
PGRL(매도 비율) = 실현 이익 / (실현 이익 + 미실현 이익)
PLRL(매도 비율) = 실현 손실 / (실현 손실 + 미실현 손실)

실증: PGRL > PLRL (이익은 빨리, 손실은 늦게 실현)
```

기술적 분석 함의:
- 지지선에서 매물 압력 = 손실 종목 보유자의 손절 저항
- 저항선에서 매도 압력 = 이익 실현 욕구
- 적삼병 후 저항선 돌파 = 처분효과를 극복한 강한 매수세

---

## 2. 인지편향 (Cognitive Biases)

### 2.1 확증편향 (Confirmation Bias)

Peter Wason (1960), 2-4-6 Task

자신의 기존 믿음을 확인하는 정보만 선택적으로 수용.

금융 적용:
- 매수 포지션 → 강세 패턴만 보임
- 매도 포지션 → 약세 패턴만 보임
- 기술적 분석 도구가 중립적 시그널을 제공하는 것이 중요

### 2.2 닻 효과 (Anchoring)

Tversky & Kahneman (1974), *Judgment under Uncertainty: Heuristics
and Biases*, Science

```
조정 불충분: 초기 정보(닻)에서 충분히 벗어나지 못함
```

금융 적용:
- 52주 최고가/최저가가 심리적 닻 → 지지/저항선
- 이전 종가가 다음 날의 기준점(참조점) 역할
- 이동평균선이 심리적 닻으로 작용

### 2.3 대표성 편향 (Representativeness)

작은 표본에서 모집단의 특성을 추론하는 오류.

금융 적용:
- 3연속 양봉(적삼병)만으로 "상승 추세"를 확신
- 패턴의 통계적 유의성 검증 없이 시각적 유사성에 의존
- → 패턴 인식의 한계: 충분한 백테스팅이 필요

### 2.4 최신편향 (Recency Bias)

최근 정보에 과도한 가중치를 부여.

금융 적용:
- 최근 급등 → "계속 오를 것" (추세 추종)
- 최근 급락 → "더 떨어질 것" (공포)
- EMA가 SMA보다 인기 있는 이유: 최신편향의 수학적 표현

### 2.5 후견편향 (Hindsight Bias)

Fischhoff (1975), *Hindsight ≠ Foresight*

사후에 "그때 알았어야 했는데"라고 느끼는 편향.

금융 적용:
- 과거 차트에서 패턴은 쉽게 보이지만, 실시간에서는 불확실
- 백테스팅의 과최적화(overfitting) 위험과 연결

---

## 3. 군중심리 (Herd Behavior)

### 3.1 정보 폭포 (Information Cascade)

Bikhchandani, Hirshleifer & Welch (1992), *A Theory of Fads, Fashion,
Custom, and Cultural Change as Informational Cascades*, JPE

```
개인 i의 의사결정:
- 자신의 사적 정보 sᵢ
- 이전 참여자들의 행동 관찰 (a₁, a₂, ..., aᵢ₋₁)

충분히 많은 선행자가 같은 방향 → 자신의 정보 무시 → 폭포
```

금융 적용:
- 거래량 급증 + 추세 = 정보 폭포 진행 중
- 적삼병 패턴 = 매수 폭포의 시각적 표현
- 흑삼병 패턴 = 매도 폭포의 시각적 표현

### 3.2 군중의 지혜와 광기

James Surowiecki, *The Wisdom of Crowds* (2004):
- 독립적 의사결정 → 정확한 집단 추정
- 상관된 의사결정 → 버블과 붕괴

Charles Mackay, *Extraordinary Popular Delusions and the Madness
of Crowds* (1841):
- 남해 버블, 튤립 광풍 등 역사적 사례

### 3.3 사회적 학습과 모방

Cont & Bouchaud (2000), *Herd Behavior and Aggregate Fluctuations
in Financial Markets*, Macroeconomic Dynamics

에이전트 모형에서 모방(imitation) 확률이 임계값을 초과하면
가격 변동의 분포가 정규분포에서 멱법칙으로 전이.
→ 물리학의 상전이와 동일한 수학 구조

---

## 4. 시장 심리 사이클

### 4.1 시장 감정 사이클 (Market Emotion Cycle)

```
낙관 → 흥분 → 행복감 → 불안 → 부정 → 공포 → 절망 → 낙담
→ 희망 → 안도 → 낙관 (반복)
```

각 단계의 기술적 지표 대응:
| 감정 단계 | RSI | MACD | 볼린저 | 패턴 |
|-----------|-----|------|--------|------|
| 낙관/흥분 | 60-80 | 양(+) 확대 | 상단 접근 | 적삼병 |
| 행복감 | 80+ | 최대 | 상단 돌파 | — |
| 불안/부정 | 70→50 | 양(+) 축소 | 중간 복귀 | 도지 |
| 공포/절망 | 20-30 | 음(-) 확대 | 하단 돌파 | 흑삼병 |
| 낙담 | 20 이하 | 최소 | 하단 | 해머 |
| 희망/안도 | 30→50 | 음(-) 축소 | 중간 복귀 | 상승장악 |

### 4.2 공포-탐욕 지수 (Fear-Greed Index)

CNN Money의 Fear & Greed Index 구성:
1. 주가 모멘텀 (S&P 500 vs 125일 MA)
2. 주가 강도 (52주 최고 vs 최저)
3. 주가 폭 (McClellan 지표)
4. 풋/콜 비율
5. 정크본드 수요
6. VIX (변동성 지수)
7. 안전자산 수요

※ 주의: 공포-탐욕 지수의 한계
  - 학술적 도구가 아닌 CNN의 마케팅 지표
  - 구성 요소 가중치 비공개 (투명성 부족)
  - McClellan 지표는 현대 퀀트 연구에서 거의 사용되지 않음
  - 현대 대안:
    1) VIX + VIX 기간구조 (학술적으로 검증된 공포 지표)
    2) NLP 기반 뉴스 감성분석 (FinBERT, 2019+)
    3) 옵션 풋/콜 비율 + 스큐 (정보 내용이 높음)
    4) 소셜미디어 감성 (Twitter/Reddit 감성 스코어)

---

## 4B. 교차문화 행동재무학 (Cross-Cultural Behavioral Finance)

서구 시장에서 도출된 전망이론 파라미터와 행동 편향의 강도는
문화적 맥락에 따라 상이할 수 있다. 한국 시장에의 적용 시 이를 고려해야 한다.

**한국 시장의 고유한 행동적 특성:**

1. **강한 소매 군집행동 (Retail Herding)**
   Kim & Wei (2002), "Foreign Portfolio Investors Before and During a Crisis",
   Journal of International Economics — 한국 개인투자자의 군집행동 강도가
   기관/외국인 대비 유의하게 높으며, 위기 시 증폭된다.

2. **유교적 위험 태도 (Confucian Risk Attitudes)**
   Weber & Hsee (1998), "Cross-Cultural Differences in Risk Perception,
   but Cross-Cultural Similarities in Attitudes Towards Perceived Risk",
   Management Science — 동아시아 투자자는 동일 수준의 객관적 위험에 대해
   서구 투자자 대비 낮은 위험 인식을 보이는 경향이 있다.
   이는 '쿠션 가설(cushion hypothesis)': 강한 사회적 안전망(가족, 기업집단)이
   개인의 위험 감수를 완화한다는 설명과 관련된다.

3. **재벌 지배구조와 처분효과**
   Choi & Sias (2009), "Institutional Industry Herding",
   Journal of Financial Economics — 재벌 계열사 간 지분 연결이
   기관투자자의 군집행동 패턴에 영향을 미치며,
   개인투자자의 처분효과가 대형 재벌주에서 특히 두드러진다.

**파라미터 보정 시사점:**

```
서구 기준 전망이론 파라미터: λ = 2.25, α = 0.88
한국 시장 보정 고려 사항:
  - 소매 투자자 비중이 높은 KRX에서는 군집행동 계수가
    서구 시장 대비 1.3-1.5x 클 수 있음
  - 개인투자자 거래 비중: KRX ~60-70% vs NYSE ~20-30%
  - λ, α 파라미터의 한국 특화 실증 연구는 아직 부족하며,
    알고리즘 적용 시 범위 기반 접근(Wakker 2010)을 유지하되
    한국 고유 데이터로의 재추정이 장기 과제
```

---

## 5. 행동금융학의 시장 이상 (Market Anomalies)

### 5.1 모멘텀 효과

Jegadeesh & Titman (1993):
과거 3-12개월 수익률이 높은 종목이 계속 상승.
→ 투자자의 불충분한 반응(underreaction)에서 기인

### 5.2 평균 회귀

DeBondt & Thaler (1985), *Does the Stock Market Overreact?*:
과거 3-5년 수익률이 극단적인 종목은 반전.
→ 투자자의 과잉 반응(overreaction)에서 기인

### 5.3 1월 효과, 요일 효과

- 1월에 소형주 수익률이 높음 (세금 손실 매도 후 재매수)
- 월요일 수익률이 낮음 (주말 동안의 부정적 뉴스 반영)
- 효율적 시장 가설의 반례

### 5.4 가치 효과

Fama & French (1992), *The Cross-Section of Expected Stock Returns*:
높은 장부가/시가 비율(BM ratio) 종목이 초과 수익 실현.
→ 행동금융학: 투자자가 성장주에 과대 반응하여 가치주를 저평가

---

## 6. 시장 미시구조 (Market Microstructure)

### 6.1 호가 스프레드와 유동성

```
스프레드 = 매도호가(ask) - 매수호가(bid)
중간가 = (ask + bid) / 2
```

Kyle (1985), *Continuous Auctions and Insider Trading*:
정보 비대칭이 스프레드를 결정.

### 6.2 주문 흐름과 가격 충격

```
가격 충격: ΔP ~ V^δ · sign(order)

δ ≈ 0.5 (제곱근 법칙)
```

Bouchaud et al. (2009), *How Markets Slowly Digest Changes
in Supply and Demand*

금융 적용:
- 캔들의 윗꼬리/아래꼬리 = 특정 가격대에서의 주문 불균형
- 해머 패턴의 긴 아래꼬리 = 매수 주문의 흡수력

---

## 핵심 정리: 기술적 분석의 심리학적 정당화

| 기술적 패턴 | 심리학적 메커니즘 |
|------------|-------------------|
| 지지/저항선 | 닻 효과 + 처분효과 |
| 적삼병 | 정보 폭포 (매수 연쇄) |
| 흑삼병 | 공포 연쇄 (패닉 셀링) |
| 도지 | 불확실성, 의사결정 마비 |
| 해머 | 절망 후 희망 전환점 |
| 장악형 | 감정 급변 (공포↔탐욕) |
| 이중바닥/천장 | 집단 기억과 참조점 |
| RSI 과매수/과매도 | 탐욕/공포 극단 |
| 이동평균 교차 | 추세 인식의 지연과 확인 |
