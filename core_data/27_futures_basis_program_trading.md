# 27. 선물 베이시스와 프로그램 매매 — Futures Basis & Program Trading

> 파생상품은 현물의 그림자가 아니라 가격 발견 메커니즘의 선도자이다.
> 선물 베이시스(basis)는 시장 참여자의 합산 기대치를 실시간으로 인코딩하며,
> 프로그램 매매는 그 신호를 현물 시장으로 전파하는 전도체 역할을 한다.

---

## 1. 선물 가격 이론 (Futures Pricing Theory)

### 1.1 보유비용 모형 (Cost of Carry Model)

자산 보유비용(carrying cost)을 고려한 이론적 선물 가격:

```
F* = S · e^((r - d) · T)

S: 현물지수 (KOSPI200 spot)
r: 무위험이자율 (국고채 3개월물, 2026 기준 ~3.0-3.3% p.a.)
d: 배당수익률 (dividend yield, KOSPI200 ~1.5-2.0% p.a.)
T: 잔존 만기 (연 단위, 일 기준 T = 잔여일수 / 365)
```

이산 복리 근사 (일반적으로 사용):

```
F* ≈ S · (1 + r - d)^T    (T가 충분히 작을 때)
F* ≈ S · (1 + (r - d) · T)  (T < 0.25인 경우 1차 근사 충분)
```

**KRX 특수성:**
- KOSPI200: `r - d ≈ 1.0~1.5%` → `F* ≈ S + S · 0.015 · T` (만기 3개월 기준 ≈ +0.375%)
- KOSDAQ150: 배당수익률이 낮아(d ≈ 0.3-0.8%) 정상 고이론가(contango) 폭이 더 큼
- Fair value band: `F* ± 거래비용` (약 ±15-25 bps) 내에서 차익 거래 불발

### 1.2 베이시스 (Basis) 정의와 해석

```
Basis = F_market - S_spot

basis_pct = (F_market - S_spot) / S_spot × 100  (%)
```

| 베이시스 상태 | 시장 해석 | 전형적 범위 (KOSPI200) |
|-------------|---------|----------------------|
| Basis > F* (고베이시스) | 기관·외국인 순매수 → 강세 심리 | +0.5 ~ +2.0% |
| Basis ≈ F* | 중립, 차익 기회 없음 | ±0.3% |
| Basis < F* (저베이시스) | 헤지 매도 우세 → 약세 심리 | -0.3 ~ -2.0% |
| Basis < -5% | 위기 / 패닉 매도 국면 | 2008년 글로벌 금융위기 수준 |

**이론 베이시스 vs 실제 베이시스:**
```
이론 베이시스 = F* - S = S · (r - d) · T   (항상 양수, 양의 이자율 가정)
실제 베이시스 = F_market - S               (음수 가능)
초과 베이시스 = 실제 베이시스 - 이론 베이시스 (순수 심리 요인)
```

초과 베이시스 > 0: 시장이 이론가 대비 선물을 과대평가 → 매수 차익 거래 유인.
초과 베이시스 < 0: 시장이 이론가 대비 선물을 과소평가 → 매도 차익 거래 유인.

### 1.3 베이시스 수렴 (Basis Convergence)

만기일에는 `F → S`가 반드시 성립한다:

```
Basis_T = F_T - S_T = 0   (만기일 최종 결제 시점)
```

**KRX KOSPI200 선물 최종 결제:**
- 결제 기준: 만기일 장개시 후 **일정 시간 내 체결된 현물 구성종목 전체의 가격**
- 실무적 수렴: 만기일 오후 14:00 이후 `|Basis| < 0.3pt` 수준

수렴 속도는 잔존 만기의 함수:

```
dBasis/dt = -kappa · (Basis_t - 0)   (Ornstein-Uhlenbeck 유형)

kappa: 수렴 속도 계수 (만기 1주 이내에서 급격히 증가)
```

---

## 2. 미결제약정 분석 (Open Interest Analysis)

### 2.1 OI 해석 매트릭스

미결제약정(Open Interest, OI)은 시장에서 청산되지 않은 계약 수:

```
OI_{t} = OI_{t-1} + 신규 계약 - 청산 계약
```

| 가격 변화 | OI 변화 | 해석 | 신호 강도 |
|----------|---------|------|---------|
| 가격 ↑ | OI ↑ | 신규 롱 진입 → 추세 확인 | 강 |
| 가격 ↑ | OI ↓ | 숏 커버링 → 기술적 반등, 추세 취약 | 약 |
| 가격 ↓ | OI ↑ | 신규 숏 진입 → 하락 추세 확인 | 강 |
| 가격 ↓ | OI ↓ | 롱 청산 → 기술적 하락, 추세 취약 | 약 |

### 2.2 투자자별 OI 분석

KOSPI200 선물 미결제약정 구성(2025년 기준):

| 투자자 | OI 비중 | 주요 전략 |
|--------|--------|---------|
| 외국인 | 50-70% | 방향성 매매 + 헤지, 지수 선행 |
| 기관 (연기금·보험) | 20-30% | 헤지 주도, 만기 롤오버 규칙적 |
| 개인 | 5-15% | 방향성 투기, 극단에서 역방향 |

**외국인 선물 순포지션 선행성:**
```
corr(foreign_net_position_t, KOSPI_return_{t+k}) 최대 k ≈ 1~3일
r ≈ 0.55~0.65 (2015-2024 일별 데이터)
```

외국인이 선물 순매수를 축적하면 T+1~T+3 현물 상승 확률 증가.
단, 외국인 매도 포지션이 집중(OI 상위 10% 수준)이면 현물 패턴 신뢰도 40% 하락
(→ `20_krx_structural_anomalies.md` §4.2 외국인 흐름 영향 회귀 참조).

### 2.3 OI 극단과 가격 반전 (OI at Price Extremes)

```
OI_zscore = (OI_t - mean(OI_{t-60})) / std(OI_{t-60})

OI_zscore > +2.0: 과잉 포지셔닝 → 반전 위험 증가
OI_zscore < -2.0: 포지션 소진 → 추세 소멸 후 반전 가능
```

특정 옵션 행사가에 OI 집중 시 "핀 리스크(pin risk)" 발생:
지수가 최대 OI 행사가 근방으로 수렴하는 경향 → 만기일 패턴 분석 오염.

---

## 3. 프로그램 매매 (Program Trading)

### 3.1 차익 거래 (Arbitrage Trading)

베이시스가 거래비용 이상 이탈할 때 발동:

```
매수 차익 거래 (Buy Program):
  조건: F_market > F* + threshold
  행위: 현물 바스켓 매수 + 선물 매도
  이익: (F_market - F*) - 2 × 거래비용

매도 차익 거래 (Sell Program):
  조건: F_market < F* - threshold
  행위: 현물 바스켓 매도 + 선물 매수
  이익: (F* - F_market) - 2 × 거래비용

threshold ≈ 15~25 bps (거래비용: 위탁수수료 + 유관기관 수수료 + 세금)
```

차익 거래 프로그램의 현물 영향:
- 매수 차익: KOSPI200 구성종목 일괄 매수 → 지수 상승 압력
- 매도 차익: KOSPI200 구성종목 일괄 매도 → 지수 하락 압력
- 개별 종목 영향 크기 ∝ KOSPI200 편입 비중 (삼성전자 ~20%)

### 3.2 비차익 거래 (Non-Arbitrage Program Trading)

차익 거래와 달리 베이시스 독립적으로 발동:

| 유형 | 목적 | 현물 영향 |
|------|------|---------|
| 인덱스 복제 | ETF 설정/환매, 패시브 리밸런싱 | 구성종목 동시 매매 |
| 포트폴리오 보험 | 하락 시 동적 헤지 (선물 매도 증가) | 하락 가속 (악순환 가능) |
| TWAP/VWAP 알고리즘 | 대규모 주문 분할 집행 | 거래 시간대 균등 분산 |
| 방향성 프로그램 | 퀀트 운용사 알파 전략 | 현물 단방향 압력 강함 |

**비차익 거래의 현물 영향은 차익 거래보다 훨씬 강하다:**
- 차익 거래: 베이시스 회귀 후 반대 포지션으로 청산 → 일시적 영향
- 비차익 거래: 지속적 단방향 흐름 → 추세 형성 또는 가속

### 3.3 KRX 프로그램 매매 공시 제도

KRX는 D+1 기준으로 일별 프로그램 매매 현황 공시:

```
data.krx.co.kr → 통계 → 주식 → 투자자별 동향 → 프로그램매매
- 차익 순매수: 차익 매수 금액 - 차익 매도 금액
- 비차익 순매수: 비차익 매수 금액 - 비차익 매도 금액
- 합계 순매수 = 차익 + 비차익
```

삼성전자(005930) KOSPI 편입 비중 ~20% → 프로그램 매매 최대 수혜/피해 종목.
KODEX 200 ETF 설정/환매도 프로그램 매매로 집계.

---

## 4. 만기일 효과 (Expiration Effects)

### 4.1 사이드카 발동 조건 (Sidecar Triggers)

사이드카는 선물 가격 급변 시 프로그램 매매를 일시 중단하는 장치:

| 구분 | 발동 조건 | 효과 |
|------|----------|------|
| 매도 사이드카 | KOSPI200 선물 직전 가격 대비 -5% 1분 지속 | 매도 프로그램 5분 정지 |
| 매수 사이드카 | KOSPI200 선물 직전 가격 대비 +5% 1분 지속 | 매수 프로그램 5분 정지 |
| KOSDAQ 사이드카 | KOSDAQ150 선물 ±6% 1분 지속 | 동일 (KOSDAQ 대상) |
| 1일 1회 제한 | 동일 방향 사이드카 당일 1회만 발동 가능 | — |

사이드카 발동 시 기술적 패턴 신뢰도 50% 감산 (→ §6.1 참조).

### 4.2 옵션 만기일 — 매월 2째 목요일

월별 옵션 만기일 특성:

```
만기일 거래량 = 1.5~3.0 × 평상시 거래량  (2020-2025 KRX 통계)
만기일 변동성 = 1.2~1.8 × 일반일 ATR
익일 가격 반전 확률: 0.55~0.65  (Park et al. 2004)
```

**트리플 위칭(Triple Witching):** 분기별 선물·옵션·ETF 동시 만기
(3·6·9·12월 두 번째 목요일) → 영향이 배가됨.

**핀 리스크(Pin Risk):** 지수가 최대 미결제약정 행사가 ±0.5% 내에 있을 때
옵션 델타 헤지 물량이 현물에 역방향 압력을 가해 기술적 패턴 형성을 저해.

### 4.3 선물 만기일 롤오버 (Quarterly Rollover)

분기 선물(3·6·9·12월) 만기 전 T-3 ~ T-1 기간의 롤오버 특성:

```
롤오버 스프레드 = F_next_quarter - F_front_quarter

정상 롤오버: 스프레드 ≈ 이론 베이시스 차이
스프레드 급등: 기관의 롤오버 수요 집중 → 근월물 매도 + 원월물 매수 압력
```

롤오버 기간 베이시스 변동성 증가 → 패턴 신호 신뢰도 감소:

```
신뢰도 보정: pattern_conf × 0.85  (T-3 ~ T-1 기간)
```

### 4.4 만기일 캘린더 (2026)

KRX 파생상품 만기 산출 공식:

```javascript
// 매월 두 번째 목요일 산출
function getExpiryDate(year, month) {
    const d = new Date(year, month - 1, 1);
    const dayOfWeek = d.getDay(); // 0=일, 4=목
    // 첫 번째 목요일까지 이동
    const daysToThursday = (4 - dayOfWeek + 7) % 7;
    return new Date(year, month - 1, 1 + daysToThursday + 7); // +7 = 두 번째
}
```

2026년 주요 만기일:

| 월 | 옵션 만기 | 선물 만기 | 비고 |
|----|---------|---------|------|
| 3월 | 3월 12일 (목) | 3월 12일 (목) | 분기 트리플 위칭 |
| 6월 | 6월 11일 (목) | 6월 11일 (목) | 분기 트리플 위칭 |
| 9월 | 9월 10일 (목) | 9월 10일 (목) | 분기 트리플 위칭 |
| 12월 | 12월 10일 (목) | 12월 10일 (목) | 분기 트리플 위칭 |
| 기타 월 | 각 월 두 번째 목요일 | — | 옵션 전용 만기 |

KOSDAQ150 선물: 매월 두 번째 목요일 만기 (KOSPI200 선물과 동일 일정).

---

## 5. 선물 기반 시장 심리 지표 (Futures-Based Sentiment Indicators)

### 5.1 정규화 베이시스 (Normalized Basis)

원시 베이시스를 현물 수준 대비 정규화:

```
basis_norm = (F_market - S_spot) / S_spot

해석 임계값:
  basis_norm > +0.005 (+0.5%): 기관·외국인 강세 포지셔닝 → 시장 강세 신호
  -0.005 < basis_norm < +0.005: 중립 구간
  basis_norm < -0.005 (-0.5%): 헤지 매도 우세 → 약세 압력

위기 수준:
  basis_norm < -0.02 (-2.0%): 패닉 신호, 급락 이후 또는 직전
  basis_norm > +0.02 (+2.0%): 과열 신호, 선물 투기 집중
```

APT 팩터 확장 후보: `23_apt_factor_model.md`의 현재 17열 Ridge 모델에
`basis_norm`을 18번째 팩터로 추가 시 IC +0.003~0.008 개선 예상.

### 5.2 외국인 선물 누적 순포지션 (Foreign Futures Net Position)

```
FF_cum(t, n) = sum_{k=t-n+1}^{t} (외국인 선물 순매수량_k)

n = 20일 기준 누적
```

방향성 지표로서의 활용:

```
FF_zscore = (FF_cum(t,20) - mean(FF_cum_{t-60})) / std(FF_cum_{t-60})

FF_zscore > +1.5: 외국인 롱 축적 → T+1~T+3 현물 상승 편향
FF_zscore < -1.5: 외국인 숏 축적 → T+1~T+3 현물 하락 편향
```

`20_krx_structural_anomalies.md` §4.2의 외국인 흐름 회귀 계수(`beta_f`)를
선물 포지션 기반으로 대체할 경우 예측력 향상 가능:

```
r_t = alpha + beta_f * FF_zscore_{t-1} + beta_d * DF_t + epsilon
```

### 5.3 풋콜비율과 베이시스 복합 신호

풋콜비율(PCR, → `26_options_implied_volatility.md` §2 참조 예정)과
베이시스를 결합한 복합 심리 지표:

```
극단 공포 신호 (역추세 매수 후보):
  조건: PCR_norm > 0.75 AND basis_norm < -0.005
  해석: 옵션 시장 패닉 + 선물 매도 우세 → 단기 과매도 반전 가능성

극단 탐욕 신호 (역추세 매도 후보):
  조건: PCR_norm < 0.25 AND basis_norm > +0.005
  해석: 옵션 콜 집중 + 선물 매수 우세 → 단기 과매수 반전 가능성
```

`24_behavioral_quantification.md` §1의 FearGreed 지수에 `basis_norm`을
추가 가중치(w5 = 0.15)로 편입 가능:

```
FearGreed_v2 = w1*RSI_norm + w2*volSurge_norm + w3*volRatio_norm
             + w4*newHighLow_norm + w5*(1 - basis_norm_rank)

w1=0.25, w2=0.25, w3=0.20, w4=0.15, w5=0.15  (재가중)
```

---

## 6. 패턴 신뢰도 연동 (Pattern Confidence Integration)

### 6.1 만기일 / 롤오버 / 사이드카 감산 규칙

| 시장 상황 | 조건 | 신뢰도 보정 | 상수 Tier |
|----------|------|-----------|---------|
| 만기일 당일 | D-0 옵션/선물 만기일 | `conf × 0.70` | [C][L:Manual] |
| 롤오버 기간 | D-3 ~ D-1 (분기 선물) | `conf × 0.85` | [C][L:Manual] |
| 사이드카 발동 중 | 발동 후 5분 이내 | `conf × 0.50` | [A][Fixed] |
| 사이드카 발동 후 | 발동 후 5~60분 | `conf × 0.75` | [C][L:Manual] |
| 트리플 위칭 당일 | 분기 만기일 | `conf × 0.65` | [C][L:Manual] |

감산 근거: 만기일은 정상 수급이 아닌 청산·롤오버·헤지 강제 수요가 가격을 지배한다.
기술적 패턴은 자유로운 수급 형성을 전제하므로 만기일 신호는 본질적으로 오염된다.

### 6.2 베이시스-패턴 방향 일치 보너스

```
강세 패턴 + 양의 초과 베이시스:
  조건: pattern.direction === 'bullish' AND basis_norm > +0.003
  보정: conf × 1.05   (+5%)

약세 패턴 + 음의 초과 베이시스:
  조건: pattern.direction === 'bearish' AND basis_norm < -0.003
  보정: conf × 1.05   (+5%)

방향 불일치 (역베이시스):
  조건: bullish + basis_norm < -0.005 OR bearish + basis_norm > +0.005
  보정: conf × 0.92   (-8%, 헤징 흐름이 패턴에 역행)

중립 구간: 보정 없음
```

이 보정 논리는 `backtester.js`의 LinUCB 컨텍스트 벡터에 `basis_norm` 열을
추가하는 방식으로 데이터 기반 학습으로 전환 가능 (→ `23_apt_factor_model.md` §2 참조).

### 6.3 프로그램 매매 강도 보정

```
program_zscore = (|program_net_t| - mean(|program_net_{t-20}|))
               / std(|program_net_{t-20}|)

program_zscore > 2.0 (비정상적 대규모 프로그램):
  보정: conf × 0.90
  근거: 대규모 프로그램 매매는 개별 종목 기술적 패턴을 바스켓 압력으로 왜곡

program_zscore > 3.0 (극단):
  보정: conf × 0.80
```

차익 vs 비차익 프로그램 구분:
- 차익 프로그램: 베이시스 회귀 후 청산 → 일시적 왜곡, 단기 패턴 복구 가능
- 비차익 프로그램: 지속적 단방향 → 패턴 무력화 위험 더 높음

---

## 7. CheeseStock 구현 경로

### 7.1 데이터 소스

```
1차 소스 (무료, D+1):
  data.krx.co.kr → 파생상품 → 선물 시세 → KOSPI200 선물
  → F_market, OI, 거래량 (일별)

2차 소스 (무료, D+1):
  data.krx.co.kr → 주식 → 투자자별 동향 → 프로그램매매
  → 차익/비차익 순매수 금액

3차 소스 (무료, D+1):
  data.krx.co.kr → 파생상품 → 투자자별 → 외국인 선물 순매수
  → FF_net_t (선물 계약 단위)
```

구현 스크립트:

```python
# scripts/download_derivatives.py (신규)
# 출력: data/futures/kospi200_basis.json
# 구조:
# {
#   "date": "YYYY-MM-DD",
#   "spot": 350.00,
#   "futures": 351.50,
#   "basis_norm": 0.00429,
#   "oi": 123456,
#   "program_buy": 523000,    # 백만 원
#   "program_sell": 312000,   # 백만 원
#   "program_net": 211000,    # 백만 원
#   "foreign_net": 1234,      # 계약 단위
#   "expiry_date": "2026-03-12"
# }
```

### 7.2 APT 팩터 확장

`23_apt_factor_model.md`의 17열 Ridge 모델에 선물 파생 팩터 추가:

```
열 18: basis_norm_t-1          (베이시스 방향, 1일 선행)
열 19: ff_zscore_t-1           (외국인 선물 순포지션 z-score, 1일 선행)
열 20: program_zscore_t-1      (프로그램 강도 z-score, 1일 선행)

예상 IC 개선: +0.003~0.008 (베이시스) + 0.002~0.005 (외국인 선물)
총 기대 IC: 0.100 (현행 17열) → 0.105~0.113 (20열)
```

데이터 정렬 주의사항:
- 선물 데이터: D+1 공시 → 패턴 신호 T 기준으로 T-1 데이터만 사용 (look-ahead 방지)
- `25_capm_delta_covariance.md` §1.3 무위험이자율과 보유비용 모형 연계 필요

### 7.3 학습 가능 상수 (#63-#68)

`22_learnable_constants_guide.md`의 5-Tier 분류 체계 적용:

| 상수 ID | 설명 | 현재값 | Tier | 학습 메커니즘 |
|--------|------|-------|------|-------------|
| #63 | 만기일 당일 신뢰도 감산 | 0.70 | [C] | Manual (이벤트 캘린더) |
| #64 | 롤오버 기간 신뢰도 감산 | 0.85 | [C] | Manual (분기 주기) |
| #65 | 사이드카 발동 시 감산 | 0.50 | [A] | Fixed (규정 기반) |
| #66 | 베이시스 방향 일치 보너스 | 1.05 | [D] | Ridge (basis_norm 열로 흡수) |
| #67 | 베이시스 방향 불일치 감산 | 0.92 | [D] | Ridge (동상) |
| #68 | 비정상 프로그램 감산 임계 | 2.0σ | [C] | CUSUM (이상 탐지) |

Tier [A] 상수 (#65): 사이드카는 KRX 규정으로 정의된 5분 중단이므로 학습 대상 아님.
Tier [D] 상수 (#66, #67): `basis_norm` 열 자체를 Ridge 회귀에 포함시키면 계수가
방향 일치/불일치 효과를 데이터 기반으로 자동 추정하므로 별도 하드코딩 불필요.

---

## 8. 학술 참고문헌

1. Black, F. (1976). The Pricing of Commodity Contracts. *Journal of Financial Economics*, 3(1-2), 167-179.
2. Stoll, H.R. & Whaley, R.E. (1987). Program Trading and Individual Stock Returns: Ingredients of the Triple-Witching Brew. *Journal of Business*, 60(1), 73-109.
3. Bollen, N.P.B. & Whaley, R.E. (2004). Does Net Buying Pressure Affect the Shape of Implied Volatility Functions? *Journal of Finance*, 59(2), 711-753.
4. Chung, D.Y. & Hrazdil, K. (2010). Liquidity and Market Efficiency: A Large Sample Study. *Journal of Banking & Finance*, 34(10), 2346-2357.
5. Park, C.G., Chung, H. & Lee, J.H. (2004). An Empirical Analysis of the Expiration Day Effect of Stock Index Futures and Options in Korea. *KDI Journal of Economic Policy*, 26(1).
6. Hemler, M.L. & Longstaff, F.A. (1991). General Equilibrium Stock Index Futures Prices: Theory and Empirical Evidence. *Journal of Financial and Quantitative Analysis*, 26(3), 287-308.
7. Brennan, M.J. & Schwartz, E.S. (1990). Arbitrage in Stock Index Futures. *Journal of Business*, 63(1), S7-S31.
8. Subrahmanyam, A. (1994). Circuit Breakers and Market Volatility: A Theoretical Perspective. *Journal of Finance*, 49(1), 237-254.
   (→ `20_krx_structural_anomalies.md` §6.2와 연계)
9. Choe, H., Kho, B.-C. & Stulz, R.M. (1999). Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997. *Journal of Financial Economics*, 54(2), 227-264.
   (→ `20_krx_structural_anomalies.md` §4.2 외국인 흐름 회귀 연계)
10. KRX 한국거래소 (2025). *파생상품시장 업무규정 및 시행세칙*. 한국거래소.
11. KRX 한국거래소 (2024). *2024 파생상품시장 통계연보*. 한국거래소.

---

## 핵심 정리: 선물·베이시스와 패턴 시스템의 매핑

| 파생상품 지표 | CheeseStock 연결 | 구현 위치 |
|-------------|----------------|---------|
| 이론 선물 가격 F* | 차익 매매 임계 산출 | `scripts/download_derivatives.py` |
| basis_norm | APT 팩터 #18, 패턴 보정 #66/#67 | `backtester.js` 컨텍스트 벡터 |
| 외국인 선물 순포지션 | APT 팩터 #19, `20_krx` §4.2 보강 | 데이터 파이프라인 신규 |
| OI z-score | 패턴 추세 강도 확인 | `signalEngine.js` 복합 신호 후보 |
| 만기일 감산 | 패턴 신뢰도 ×0.70 / ×0.65 | `patterns.js` 또는 `app.js` 날짜 체크 |
| 사이드카 발동 | 패턴 신뢰도 ×0.50 즉시 | `realtimeProvider.js` 이벤트 처리 |
| 프로그램 z-score | 패턴 신뢰도 ×0.80~0.90 | `backtester.js` 컨텍스트 #68 |
| PCR + basis 복합 | FearGreed v2 w5 가중치 | `signalEngine.js` FearGreed 확장 |
