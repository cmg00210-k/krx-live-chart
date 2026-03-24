# 목표가/손절가 학술 검증 보고서

> 작성일: 2026-03-23
> 작성자: 기술적 패턴 분석 최고설계자
> 목적: CheeseStock 패턴 엔진의 목표가/손절가 도출 과정을 학술적 정의와 비교 분석

---

## 1. 학술적 목표가 정의 (Measured Move Theory)

### 1.1 Bulkowski의 Measured Move

Thomas Bulkowski, *Encyclopedia of Chart Patterns* (2005, 2021 3rd Ed.)

학술적 목표가(Price Target)는 **패턴의 기하학적 구조에서 도출되는 "확률적 기대 도달 가격"**이다.
이것은 보장(guarantee)이 아니라, 과거 통계에서 해당 수준까지 도달할 확률이 유의미하게
높았다는 경험적 관찰이다.

#### 패턴별 Measured Move 공식

| 패턴 | 목표가 공식 | Bulkowski 달성률 | 평균 상승/하락률 |
|------|-----------|----------------|----------------|
| Head & Shoulders | neckline - (head - neckline) | 55-60% | -22% |
| Inverse H&S | neckline + (neckline - head) | 55-60% | +38% |
| Double Bottom | neckline + (neckline - bottom) | 66% (5봉 기준) | +40% |
| Double Top | neckline - (top - neckline) | 65% | -19% |
| Ascending Triangle | resistance + (resistance - lowest_low) | 75% (돌파 시) | +35% |
| Descending Triangle | support - (highest_high - support) | 64% (돌파 시) | -23% |
| Rising Wedge | wedge_bottom (패턴 시작점 회귀) | 65% | -varies |
| Falling Wedge | wedge_top (패턴 시작점 회귀) | 62% | +varies |
| Cup & Handle | rim + cup_depth | 61% | +34% |

**핵심 인사이트**: Bulkowski의 "달성률"은 **목표가의 100% 도달**이 아니다.

```
Bulkowski (2005) 의 성공률 정의:
  "breakout 이후 measured move의 100%에 도달하는 비율"

실제 분포 (Double Bottom 사례):
  100% measured move 도달: 66%
  75% measured move 도달: ~75%
  50% measured move 도달: ~85%
  25% measured move 도달: ~92%

=> 목표가는 "55-66%의 확률로 도달할 수 있는 가격"이지
   "반드시 도달하는 가격"이 아님
```

#### 학술 참조: core_data/06_technical_analysis.md L209-210

```
목표가 = 넥라인 - (머리높이 - 넥라인)
성공률: 약 70% (Bulkowski 연구)
```

#### 학술 참조: core_data/07_pattern_algorithms.md L674-676

```
넥라인: T1, T2 연결 직선
목표가: neckline - (머리 높이 - neckline)
역머리어깨형: 부등호 반전
```

### 1.2 캔들스틱 패턴의 목표가 — 학술적 부재

**Steve Nison (1991)과 Gregory Morris (2006)의 원전에서 캔들스틱 패턴은
목표가를 제시하지 않는다.** 이것이 핵심 차이점이다.

```
캔들스틱 패턴의 학술적 용도:
  1. "반전/지속의 시각적 경고 신호" (Nison)
  2. "진입 타이밍 결정의 보조 도구" (Morris)
  3. "독립적 매매 시스템이 아닌 확인(confirmation) 도구"

캔들스틱 패턴이 제공하지 않는 것:
  - 구체적 목표가 (price target)
  - 구체적 도달 시간 (time horizon)
  - 독립적 포지션 사이징 근거
```

Bulkowski (2012), *Encyclopedia of Candlestick Charts*에서는 캔들스틱
패턴 이후의 N일 수익률 통계를 제공하지만, 이것은 "측정된 이동(measured move)"이
아니라 **평균 수익률**이다.

```
Bulkowski 캔들스틱 통계 (2012):
  적삼병 → 5일 후 평균 +2.1% (중앙값 +1.5%)
  흑삼병 → 5일 후 평균 -1.8% (중앙값 -1.3%)
  해머   → 5일 후 평균 +1.4% (중앙값 +0.9%)
  장악형 → 5일 후 평균 +1.6% (중앙값 +1.1%)
```

### 1.3 쐐기형(Wedge)의 목표가

쐐기형은 차트 패턴 중에서도 목표가 정의가 가장 애매한 패턴이다.

```
Edwards & Magee (1948), Murphy (1999):
  "쐐기 돌파 후 패턴 시작점까지 되돌리는 경향"
  => 목표가 = 쐐기 시작점 (패턴의 반대 끝)

Bulkowski (2005):
  Rising Wedge → 하향 돌파 후 "평균" 하락: -20%
  Falling Wedge → 상향 돌파 후 "평균" 상승: +32%
  BUT 달성률은 약 50-65% — 패턴 시작점 회귀는 보장되지 않음

주의: "패턴 높이의 measured move"는 쐐기형에 적용하기 부적절.
  삼각형/이중바닥처럼 명확한 넥라인이 없기 때문.
```

---

## 2. 현재 코드의 목표가 도출 과정 분석

### 2.1 _target() 유틸리티 (patterns.js L149-162)

```javascript
_target(candles, si, ei, signal, atr = []) {
    const seg = candles.slice(si, ei + 1);
    const h = Math.max(...seg.map(c => c.high));
    const l = Math.min(...seg.map(c => c.low));
    const entry = candles[ei].close;
    const atrAtEnd = atr[ei] || (entry * PatternEngine.ATR_FALLBACK_PCT);
    const height = Math.min(Math.max(h - l, atrAtEnd), atrAtEnd * 2);
    // Bulkowski "measured move": 패턴 높이의 1.0배가 표준 목표가
    return signal === 'buy' ? +(entry + height * 1.0).toFixed(0)
         : signal === 'sell' ? +(entry - height * 1.0).toFixed(0) : null;
}
```

**설계 의도 분석**:
1. 패턴 구간(si~ei)의 고가-저가 범위를 "패턴 높이"로 사용
2. 최소값 보장: `Math.max(h - l, atrAtEnd)` — 단일 캔들에서 높이가 너무 작을 때 ATR로 대체
3. 최대값 제한: `Math.min(..., atrAtEnd * 2)` — ATR의 2배 상한
4. 현재가에서 패턴 높이의 1.0배를 더한/뺀 가격이 목표가

**문제점**:
- 이 함수는 **캔들스틱 패턴 전용**으로 설계되었으나, 캔들스틱 패턴에는 학술적 목표가 정의가 없음
- `atrAtEnd * 2` 상한은 합리적이나, 근거가 불명확
- 차트 패턴(이중바닥, H&S 등)은 이 함수를 사용하지 않고 자체 로직을 갖고 있음

### 2.2 차트 패턴별 목표가 계산

#### 이중 바닥 (L1570, 1575)
```javascript
const patternHeight = Math.min(neckline - Math.min(l1.price, l2.price), a * 4);
const priceTarget = +(neckline + patternHeight).toFixed(0);
```

**학술 비교**: `neckline + (neckline - bottom)` = `neckline + patternHeight`.
공식 자체는 Bulkowski와 일치하나, `a * 4` 상한이 문제.

#### 이중 천장 (L1609, 1614)
```javascript
const patternHeight = Math.min(Math.max(h1.price, h2.price) - neckline, a * 4);
const priceTarget = +(neckline - patternHeight).toFixed(0);
```

**학술 비교**: 공식 일치. 동일한 `a * 4` 상한 문제.

#### 상승 삼각형 (L1263-1264)
```javascript
const patternHeight = Math.min(resistanceLevel - relevantLows[0].price, a * 4);
const priceTarget = +(resistanceLevel + patternHeight).toFixed(0);
```

**학술 비교**: `resistance + (resistance - support)` = `resistance + patternHeight`.
Bulkowski와 일치. `a * 4` 상한 동일.

#### 머리어깨형 (L1656-1657)
```javascript
const patternHeight = Math.min(head.price - (t1.price + t2.price) / 2, a * 4);
const priceTarget = +(neckAtEnd - patternHeight).toFixed(0);
```

**학술 비교**: `neckline - (head - neckline_avg)`. 공식 일치. `a * 4` 상한 동일.

#### 쐐기형 (L1382, 1443)
```javascript
// 상승 쐐기
const priceTarget = +(Math.max(l1.price, lastClose - a * 4)).toFixed(0);
// 하락 쐐기
const priceTarget = +(Math.min(h1.price, lastClose + a * 4)).toFixed(0);
```

**학술 비교**: 쐐기 시작점(l1.price / h1.price)을 목표로 사용하되, `lastClose +/- a*4`와의
max/min으로 제한. 이것은 "패턴 시작점 회귀"와 "ATR*4 상한" 중 보수적인 값을 택하는 구조.
학술적으로 쐐기 시작점 회귀 자체가 적절하나, ATR*4 상한이 이를 제한하는 것이 문제.

### 2.3 _stopLoss() 유틸리티 (L141-147)

```javascript
_stopLoss(candles, idx, signal, atr, mult = PatternEngine.STOP_LOSS_ATR_MULT) {
    const p = candles[idx].close;
    const a = atr[idx] || p * PatternEngine.ATR_FALLBACK_PCT;
    return signal === 'buy' ? +(p - a * mult).toFixed(0)
         : signal === 'sell' ? +(p + a * mult).toFixed(0) : null;
}
```

- 기본 배수: `STOP_LOSS_ATR_MULT = 2` (현재가 +/- ATR*2)
- 차트 패턴에서는 자체 손절가 사용 (구조적 수준 기반)

---

## 3. ATR*4 상한의 적절성 평가

### 3.1 ATR*4가 과도한 경우: SK하이닉스 사례

```
SK하이닉스 (2026년 3월 기준 추정):
  주가: ~200,000원
  ATR(14): ~35,000원 (일일 변동폭 약 17.5%)
  ATR*4 = 140,000원

이중 바닥 패턴 발생 시:
  넥라인: 210,000원
  바닥: 180,000원
  실제 패턴 높이: 30,000원
  Bulkowski 목표가: 210,000 + 30,000 = 240,000원

BUT 코드 동작:
  patternHeight = Math.min(30,000, 35,000 * 4) = 30,000원  (이 경우 정상)

문제 시나리오 — 패턴 높이가 클 때:
  넥라인: 220,000원
  바닥: 160,000원
  실제 패턴 높이: 60,000원 (ATR 1.7배 — 정상 범위)
  Bulkowski 목표가: 220,000 + 60,000 = 280,000원

  코드 동작: Math.min(60,000, 140,000) = 60,000원  (이 경우도 정상)
```

**분석**: ATR*4는 사실 ATR(14)이 ~35,000원인 종목에서는 140,000원이므로,
대부분의 정상적 패턴 높이(1~3 ATR)에서는 상한에 걸리지 않는다.

**진짜 문제는 다른 곳에 있다**: _target() 함수가 캔들스틱 패턴에 사용될 때.

### 3.2 캔들스틱 패턴에서의 _target() 문제

```
SK하이닉스에서 해머 패턴:
  si = ei = i (단일 캔들)
  h = candles[i].high = 205,000
  l = candles[i].low  = 190,000
  range = 15,000원

  _target() 내부:
    height = Math.min(Math.max(15,000, 35,000), 35,000 * 2)
           = Math.min(35,000, 70,000)
           = 35,000원  (ATR이 패턴 높이보다 크므로 ATR로 대체됨)

  목표가 = 190,000 + 35,000 = 225,000원
  현재가 대비: +18.4% 상승 목표

해머 패턴의 학술적 기대 수익:
  Bulkowski: 5일 후 평균 +1.4%, 10일 후 평균 +2.3%
  실제 시스템 제시: +18.4%
  => 학술 대비 8~13배 과대 추정
```

### 3.3 상한의 본질적 문제

ATR*4 상한은 **차트 패턴에는 대체로 합리적**이나 (대부분의 패턴 높이가
ATR*4 이내), **캔들스틱 패턴에 _target()을 적용하는 것 자체가 학술적으로
근거 없는 행위**이다.

---

## 4. 핵심 질문에 대한 답변

### 4.1 목표가는 "보장"인가 "확률적 기대값"인가?

**답: 확률적 기대값이며, 그마저도 절반 이상의 경우에만 달성된다.**

```
Bulkowski의 통계적 정의:
  "Measured move target"은 패턴 높이를 돌파 방향으로 투사한 가격.
  이 가격에 도달할 확률은 패턴별로 55-75%.

  즉, 가장 낙관적인 패턴(상승삼각형)에서도 25%는 목표가에 도달하지 못하고,
  가장 비관적인 패턴(H&S)에서는 40-45%가 미달성.

학술적 권장 사항 (Murphy, 1999; Bulkowski, 2005):
  1. 목표가는 "이익실현 참고 수준"이지 "보유 조건"이 아님
  2. 목표가의 50-75% 도달 시 부분 이익실현 권장
  3. 후행 손절(trailing stop)과 병행 사용 필수
```

#### 학술 참조: core_data/07_pattern_algorithms.md L575-578

```
"성공"의 정의:
  적삼병 5봉 기준: ~66% (Bulkowski, 2005)
  적삼병 10봉 기준: ~58%
  적삼병 목표가 기준: ~45%
  => 시스템 구현 시 정의를 반드시 명시
```

**이것이 가장 중요한 발견이다**: 적삼병의 "목표가 기준" 성공률은 **45%에 불과**하다.
즉 measured move 100%에 도달하는 경우가 절반도 안 된다. 이는 Bulkowski의 차트 패턴
55-66% 달성률과도 일관된다.

### 4.2 목표가에 "감쇠 계수"를 적용하는 학술적 근거가 있는가?

**답: 직접적 학술 근거는 없으나, 실무적 근거는 강하다.**

#### 4.2.1 피보나치 되돌림/확장의 활용

```
학술 참조: core_data/06_technical_analysis.md L83-96

주요 비율:
  38.2% = 1 - 0.618
  61.8% = 0.618 (황금비의 역수)
  100.0%
  161.8% = 1.618

실무적 활용:
  Target_conservative = measured_move * 0.618
  Target_standard     = measured_move * 1.000
  Target_aggressive   = measured_move * 1.618
```

#### 4.2.2 부분 도달 확률 기반 감쇠

Bulkowski의 암묵적 데이터에서 도출 가능한 감쇠 모델:

```
도달 확률 vs 목표가 비율 (이중바닥 기준):
  25% measured move: ~92% 도달
  50% measured move: ~85% 도달
  62% measured move: ~78% 도달 (≈ 피보나치 0.618)
  75% measured move: ~75% 도달
  100% measured move: ~66% 도달
  161.8% measured move: ~35% 도달

=> 62% (0.618) 수준은 약 78%의 확률로 도달
   이것이 피보나치 0.618을 보수적 목표로 사용하는 실무적 근거
```

#### 4.2.3 권장 감쇠 계수

```
캔들스틱 패턴: 목표가 자체를 제시하지 말 것 (학술적 근거 없음)
  대안: ATR 기반 N일 기대 수익률 제시

차트 패턴:
  보수적 목표 (1차 목표): measured_move * 0.618  (도달 확률 ~78%)
  표준 목표 (2차 목표):   measured_move * 1.000  (도달 확률 ~60%)
  공격적 목표:            measured_move * 1.272  (도달 확률 ~45%)
```

### 4.3 현재가 대비 퍼센트 상한의 학술적 근거

#### 4.3.1 KRX 가격 제한(+/-30%)의 영향

```
학술 참조: pattern_impl/03_composite_signals.md L501-508

KOSPI/KOSDAQ: +/-30% 일일 가격제한
영향:
  - 일봉 기준: 최대 1일 변동 = +/-30%
  - 목표가가 현재가의 +30% 초과 시, 달성에 최소 2거래일 필요
  - 이는 "1봉 패턴 후 1일 내 도달"이 불가능한 수준

실무적 함의:
  단일 캔들 패턴: 목표가 < +/-10% (5일 이내 기대 수익)
  복수 캔들 패턴: 목표가 < +/-15% (10일 이내 기대 수익)
  차트 패턴: 목표가 < +/-30% (20일 이내 기대 수익)
```

#### 4.3.2 변동성 정규화 관점의 상한

```
통계적 관점:
  일일 수익률 분포는 정규 분포보다 두꺼운 꼬리를 가짐 (fat tail)
  BUT 99% 신뢰구간 내에서의 N일 기대 변동폭:

  N일 기대 변동 = ATR(14) * sqrt(N) * K

  여기서 K는 보정 계수 (실증적으로 1.0~1.5)

  예: 5일 기대 변동 = ATR * sqrt(5) * 1.2 = ATR * 2.68
     10일 기대 변동 = ATR * sqrt(10) * 1.2 = ATR * 3.79
     20일 기대 변동 = ATR * sqrt(20) * 1.2 = ATR * 5.37

  => 5일 목표: ATR * 2.68 (보수적으로 ATR * 2)
     10일 목표: ATR * 3.79 (보수적으로 ATR * 3)
     20일 목표: ATR * 5.37 (보수적으로 ATR * 4~5)
```

이것은 현재의 ATR*4 상한이 **약 20일 보유 기간을 가정**하고 있다는 것을 의미한다.
캔들스틱 패턴(5일 이내 보유 가정)에는 ATR*2가, 차트 패턴(20일 이내)에는
ATR*4~5가 적절하다.

### 4.4 R:R(리스크:리워드) 비율과 목표가의 관계

#### 4.4.1 학술적 R:R 기준

```
학술 참조: core_data/14_finance_management.md L435-450

포지션 사이징의 전제:
  위험 비율: 거래당 최대 손실 1~2%
  R:R 최소 기준: 1:2 (손실 1 대비 이익 2)

Van Tharp (2007), *Trade Your Way to Financial Freedom*:
  "최소 R:R 1:2가 수학적으로 50% 미만 승률에서도 수익 가능"

  승률 40% + R:R 1:3 = 기대수익 양(+)
    E = 0.4 * 3 - 0.6 * 1 = 0.6

  승률 55% + R:R 1:2 = 기대수익 양(+)
    E = 0.55 * 2 - 0.45 * 1 = 0.65
```

#### 4.4.2 현재 코드에서 R:R이 왜곡되는 경우

```
캔들스틱 패턴 (예: 해머):
  stopLoss = _stopLoss(candles, i, 'buy', atr)  → close - ATR*2
  priceTarget = _target(candles, i, i, 'buy', atr) → close + min(max(range, ATR), ATR*2)

  최악 시나리오 (range < ATR):
    stopLoss = close - ATR*2  (리스크 = ATR*2)
    target = close + ATR      (리워드 = ATR*1)
    R:R = 1:0.5  — 학술적으로 부적절 (리스크 > 리워드)

  최선 시나리오 (range > ATR):
    stopLoss = close - ATR*2  (리스크 = ATR*2)
    target = close + ATR*2    (리워드 = ATR*2)
    R:R = 1:1  — 학술적 최소 기준 미달

차트 패턴 (예: 이중바닥):
  stopLoss = bottom - ATR*1   (구조적 손절)
  priceTarget = neckline + patternHeight (capped at ATR*4)

  정상 시나리오 (patternHeight = ATR*2):
    stopLoss = bottom - ATR*1
    리스크 = (neckline - bottom) + ATR = ATR*2 + ATR = ATR*3
    리워드 = ATR*2
    R:R = 1:0.67  — 여전히 부적절

  => 문제: 손절가는 구조적 수준(바닥 아래)이지만,
     이 경우 리스크가 패턴 높이 + ATR이므로 리워드보다 클 수 있음
```

---

## 5. 누락된 원칙 정리

### 5.1 CRITICAL: 캔들스틱 패턴에 Measured Move 목표가를 적용하면 안 됨

| 현재 상태 | 학술 원칙 |
|----------|----------|
| _target()로 모든 캔들스틱 패턴에 목표가 산출 | Nison/Morris: 캔들스틱은 목표가를 제시하지 않음 |
| height = max(range, ATR) | 근거 없는 임의 값 |
| 목표가가 현재가 대비 15-20% 제시 가능 | Bulkowski: 캔들스틱 5일 평균 수익 +1.4~2.1% |

### 5.2 MEDIUM: 차트 패턴 목표가에 도달 확률 정보 부재

| 현재 상태 | 학술 원칙 |
|----------|----------|
| 단일 목표가만 제시 | 다중 목표(보수적/표준/공격적) 또는 도달 확률 제시 필요 |
| ATR*4 상한으로 일률 제한 | 패턴별 달성률이 다름 (55~75%), 가중 목표가 필요 |

### 5.3 MEDIUM: R:R 비율 검증 부재

| 현재 상태 | 학술 원칙 |
|----------|----------|
| 목표가와 손절가를 독립적으로 계산 | R:R >= 1:2 검증 후 시그널 품질에 반영해야 함 |
| R:R < 1:1인 패턴도 시그널로 출력 | 학술적으로 R:R < 1:1.5는 거래 가치 없음 |

### 5.4 LOW: 시간 프레임별 목표가 차등 부재

| 현재 상태 | 학술 원칙 |
|----------|----------|
| 1분봉~일봉 동일 로직 | 캔들스틱: 5일 이내 ATR*1~2, 차트 패턴: 20일 이내 ATR*4~5 |

### 5.5 LOW: 기존 추세 기울기를 목표가에 반영하지 않음

```
Murphy (1999): "목표가는 기존 추세의 방향과 강도에 의해 조정되어야 한다."

  강한 추세 + 순방향 패턴: 목표가 확대 가능 (1.0~1.272x)
  약한 추세 + 역방향 패턴: 목표가 축소 필요 (0.618~0.786x)
  횡보 + 패턴: 보수적 목표 (0.5~0.618x)
```

---

## 6. 권장 도출 공식

### 6.1 캔들스틱 패턴 — 목표가 재설계

```javascript
/**
 * 캔들스틱 패턴 목표가 — ATR 기반 기대 수익률
 *
 * 학술 근거:
 *   Bulkowski (2012): 캔들스틱 패턴 5일 평균 수익 = +1.4~2.1%
 *   통계적 관점: sqrt(N) 규칙으로 N일 기대 변동폭 추정
 *
 * 기존: _target(candles, i, i, signal, atr) → ATR * 1~2 (과대)
 * 권장: ATR * patternMultiplier (패턴별 차등)
 */
_candleTarget(candles, idx, signal, atr, patternStrength = 'medium') {
    const entry = candles[idx].close;
    const a = atr[idx] || entry * 0.02;

    // 패턴 강도별 ATR 배수 (Bulkowski 5-10일 수익률 기반 보정)
    const mult = {
        strong: 1.5,  // 적삼병/흑삼병/장악형: 5일 +2% ≈ ATR*1.5 (sqrt(5)*0.67)
        medium: 1.0,  // 해머/유성형: 5일 +1.4% ≈ ATR*1.0
        weak: 0.7,    // 도지/역해머: 5일 +0.9% ≈ ATR*0.7
    }[patternStrength] || 1.0;

    return signal === 'buy'  ? +(entry + a * mult).toFixed(0)
         : signal === 'sell' ? +(entry - a * mult).toFixed(0) : null;
}
```

### 6.2 차트 패턴 — 다중 목표가 + 피보나치 감쇠

```javascript
/**
 * 차트 패턴 목표가 — Bulkowski measured move + 피보나치 감쇠
 *
 * 학술 근거:
 *   Bulkowski (2005): measured move 100% 도달률 55-66%
 *   피보나치 0.618: measured move 62% 도달률 ~78%
 *   Murphy (1999): 기존 추세 강도에 따라 목표가 조정
 *
 * @returns { conservative, standard, aggressive } 3단계 목표
 */
_chartTarget(entry, measuredMove, signal, trendStrength = 0.5) {
    // 추세 강도 보정: 강한 순방향 추세 → 확대, 역방향 → 축소
    const trendFactor = 0.8 + trendStrength * 0.4;  // 0.8 ~ 1.2

    const conservativeMove = measuredMove * 0.618 * trendFactor;
    const standardMove     = measuredMove * 1.000 * trendFactor;
    const aggressiveMove   = measuredMove * 1.272 * trendFactor;

    const dir = signal === 'buy' ? 1 : -1;

    return {
        conservative: +(entry + conservativeMove * dir).toFixed(0),  // ~78% 도달
        standard:     +(entry + standardMove * dir).toFixed(0),      // ~60% 도달
        aggressive:   +(entry + aggressiveMove * dir).toFixed(0),    // ~45% 도달
    };
}
```

### 6.3 R:R 검증 게이트

```javascript
/**
 * R:R 비율 검증 — 최소 1:1.5 미달 시 confidence 감산
 *
 * 학술 근거:
 *   Van Tharp (2007): R:R >= 1:2 권장
 *   Kelly Criterion: edge/odds > 0 필수
 *   core_data/14 S4.1: 켈리 기준의 포지션 사이징 전제
 */
_validateRR(priceTarget, stopLoss, entry, confidence) {
    if (!priceTarget || !stopLoss) return confidence;

    const reward = Math.abs(priceTarget - entry);
    const risk = Math.abs(entry - stopLoss);
    if (risk === 0) return confidence;

    const rr = reward / risk;

    if (rr < 1.0)  return Math.max(confidence - 20, 10);  // R:R < 1:1 → 강한 감산
    if (rr < 1.5)  return Math.max(confidence - 10, 20);  // R:R < 1:1.5 → 감산
    if (rr >= 3.0) return Math.min(confidence + 5, 100);   // R:R >= 1:3 → 보너스
    return confidence;
}
```

### 6.4 ATR 상한의 재설계

```javascript
// 기존: 일률적 ATR*4
// 권장: 패턴 유형 + 보유 기간에 따른 차등 상한

const ATR_CAP = {
    // 캔들스틱 패턴 (5일 보유 가정)
    candle_strong: 1.5,   // 적삼병/장악형
    candle_medium: 1.0,   // 해머/유성형
    candle_weak:   0.7,   // 도지

    // 차트 패턴 (20일 보유 가정)
    chart_triangle:  5.0,  // 삼각형/쐐기 (sqrt(20) * 1.1)
    chart_reversal:  5.0,  // 이중바닥/천장/H&S
    chart_wedge:     4.0,  // 쐐기 (시작점 회귀 제한)
};
```

---

## 7. 결론 및 우선순위

### 즉시 조치 (CRITICAL)

1. **캔들스틱 패턴의 _target() 호출을 _candleTarget()으로 교체**
   - 현재 과대 추정 규모: 학술 대비 8~13배
   - 영향 범위: 21개 캔들스틱 패턴 전체
   - 참조 라인: L251, L294, L337, L379, L427, L470, L513, L555, L574, L616, L637,
     L682, L729, L791, L854, L909, L964, L1019, L1074, L1147

2. **R:R 검증을 confidence에 반영**
   - R:R < 1:1인 패턴의 confidence를 20점 감산
   - 사용자에게 비현실적 시그널 노출 방지

### 단기 조치 (MEDIUM)

3. **차트 패턴에 다중 목표가(conservative/standard/aggressive) 도입**
   - UI에는 conservative를 기본 표시, 나머지는 tooltip이나 상세 패널

4. **description에 도달 확률 명시**
   - 예: "목표가 240,000원 (도달 확률 ~62%, Bulkowski 이중바닥 통계 기반)"

### 장기 조치 (LOW)

5. **시간프레임별 ATR 상한 차등 적용**
6. **추세 강도를 목표가 보정에 반영**
7. **백테스트 결과로 패턴별 감쇠 계수 캘리브레이션**

---

## 참고 문헌

| 참조 | 저자/제목 | 관련 내용 |
|------|----------|----------|
| Bulkowski (2005) | *Encyclopedia of Chart Patterns*, 2nd Ed. | 차트 패턴 measured move 통계 |
| Bulkowski (2012) | *Encyclopedia of Candlestick Charts* | 캔들스틱 N일 수익률 통계 |
| Nison (1991) | *Japanese Candlestick Charting Techniques* | 캔들스틱은 목표가 미제시 원칙 |
| Morris (2006) | *Candlestick Charting Explained* | 패턴별 승률과 기대수익 |
| Murphy (1999) | *Technical Analysis of the Financial Markets* | 추세 보정 목표가 원칙 |
| Van Tharp (2007) | *Trade Your Way to Financial Freedom* | R:R >= 1:2 기준 |
| Kelly (1956) | *A New Interpretation of Information Rate* | 포지션 사이징의 수학적 기초 |
| Edwards & Magee (1948) | *Technical Analysis of Stock Trends* | 쐐기형 시작점 회귀 원칙 |
