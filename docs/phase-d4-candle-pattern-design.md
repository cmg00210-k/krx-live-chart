# Phase D-4: 미구현 캔들스틱 패턴 5종 설계 문서

> 작성일: 2026-03-26
> 작성자: Technical Pattern Architect
> 상태: 설계 완료 (코드 미적용)

---

## 개요

기존 21종 캔들스틱 패턴에 5종(실제 7개 타입)을 추가하여 총 28종으로 확장.
모든 패턴은 ATR(14) 정규화를 사용하며, 하드코딩된 % 임계값을 사용하지 않음.

### 추가 패턴 요약

| # | 영문명 | 한국명 | 봉 수 | 방향 | strength | type key |
|---|--------|--------|-------|------|----------|----------|
| 1 | Three Inside Up | 상승삼내형 | 3 | bullish | strong | `threeInsideUp` |
| 2 | Three Inside Down | 하락삼내형 | 3 | bearish | strong | `threeInsideDown` |
| 3 | Bullish Abandoned Baby | 강세버림받은아기 | 3 | bullish | strong | `bullishAbandonedBaby` |
| 4 | Bearish Abandoned Baby | 약세버림받은아기 | 3 | bearish | strong | `bearishAbandonedBaby` |
| 5 | Long-Legged Doji | 긴다리도지 | 1 | neutral | weak | `longLeggedDoji` |
| 6 | Bullish Belt Hold | 강세띠두름 | 1 | bullish | medium | `bullishBeltHold` |
| 7 | Bearish Belt Hold | 약세띠두름 | 1 | bearish | medium | `bearishBeltHold` |

---

## 1. Three Inside Up (상승삼내형)

### 1.1 학술 정의

**출처**: Nison (1991) pp.79-80, Bulkowski (2008) pp.601-614

Harami(잉태형) + 확인봉의 확장 패턴. 하락 추세에서 큰 음봉 이후 작은 양봉이 음봉 몸통 내에 포함되고(잉태), 세 번째 봉이 양봉으로 마감하며 첫째 봉의 시가(고가 쪽)를 상회하여 반전을 확인.

Nison: "The three inside up pattern is a confirmation version of the harami. The third candle's close above the first candle's open confirms the bullish reversal."

Bulkowski 통계: 승률 65%, 평균 수익 4.01% (5일 보유 기준).

### 1.2 시장 심리 (시장 심리)

```
하락 추세 진행 중
   ↓
[1봉] 큰 음봉: 매도세가 여전히 시장 지배
   ↓
[2봉] 작은 양봉 (1봉 몸통 내): 매도세 약화, 변동성 축소,
      매수자가 조심스럽게 진입 시작 (잉태형 완성)
   ↓
[3봉] 양봉, 1봉 시가 돌파: 매수세가 매도세를 완전히 압도.
      잉태형의 '미확인' 상태가 '확인'으로 전환.
      매도자의 심리적 항복 + 숏 커버링 유발.
```

### 1.3 감지 조건 (ATR 기반)

```
전제: i >= 5 (추세 감지용 최소 lookback)
c0 = candles[i-2], c1 = candles[i-1], c2 = candles[i]
a  = this._atr(atr, i, candles)

조건 1 (c0: 큰 음봉):
  c0.close < c0.open                           // 음봉
  body0 = c0.open - c0.close
  body0 >= a * HARAMI_PREV_BODY_MIN (= 0.3)    // ATR 대비 유의미한 크기

조건 2 (c1: 작은 양봉, c0 몸통 내 포함):
  c1.close > c1.open                           // 양봉
  body1 = c1.close - c1.open
  body1 < body0 * HARAMI_CURR_BODY_MAX (= 0.5) // 이전 봉 대비 작음
  body1 >= a * HARAMI_CURR_BODY_MIN (= 0.05)   // 도지 아닌 실체 존재
  c1.open > c0.close && c1.close < c0.open     // c0 몸통 내 포함

조건 3 (c2: 확인 양봉):
  c2.close > c2.open                           // 양봉
  body2 = c2.close - c2.open
  body2 >= a * THREE_INSIDE_CONFIRM_MIN (= 0.2)// 유의미한 크기 (새 상수)
  c2.close > c0.open                           // 1봉 시가 돌파 (핵심!)

조건 4 (추세 맥락):
  trend = _detectTrend(candles, i-2, 10, a)
  trend.direction === 'down'                   // 하락 추세에서만 유효
```

**새 상수**:
```javascript
/** Three Inside Up/Down 확인봉(3봉) body/ATR 하한 */
static THREE_INSIDE_CONFIRM_MIN = 0.2;
```

### 1.4 품질 점수

```javascript
bodyScore   = Math.min((body0 + body2) / 2 / a, 1)   // 1봉+3봉 평균 body 크기
haramiScore = Math.min(1 - body1 / body0, 1)          // 잉태 비율 (작을수록 높음)
volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1)
trendScore  = Math.min(trend.strength, 1)

// 3봉 돌파 깊이 보너스 (c0.open 대비 c2.close의 초과분)
breakScore  = Math.min((c2.close - c0.open) / a, 1)
extraScore  = Math.min((haramiScore + breakScore) / 2, 1)

confidence = this._quality({
  body: bodyScore,
  shadow: haramiScore,
  volume: volumeScore,
  trend: trendScore,
  extra: extraScore
})
```

### 1.5 출력

```javascript
{
  type: 'threeInsideUp',
  name: '상승삼내형 (Three Inside Up)',
  nameShort: '상승삼내',
  signal: 'buy',
  strength: 'strong',           // 잉태형+확인 = strong (잉태형 단독은 medium)
  confidence,
  stopLoss: this._stopLoss(candles, i, 'buy', atr),
  priceTarget: this._candleTarget(candles, i, 'buy', 'strong', atr),
  description: `잉태형 + 확인 양봉 돌파 — 강한 상승 반전. 형태 점수 ${confidence}%`,
  startIndex: i - 2,
  endIndex: i,
  marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' }
}
```

### 1.6 KRX 특수 사항

- **갭 불요**: 잉태형 기반이므로 갭 조건 없음. KRX 시장 특성에 적합.
- **가격제한폭 30%**: body0이 ATR*0.3 이상이면 충분. 가격제한폭 내에서 정상 감지.
- **기존 잉태형과의 중복**: detectHarami()에서 동일 c0-c1 쌍이 잉태형으로도 감지됨. 이는 의도적 -- 잉태형(미확인)과 삼내형(확인)은 별개 시그널. patternRenderer의 MAX_PATTERNS=3 밀도 제한이 과다 표시 방지.

---

## 2. Three Inside Down (하락삼내형)

### 2.1 학술 정의

**출처**: Nison (1991) pp.79-80, Bulkowski (2008) pp.591-600

Three Inside Up의 약세 대칭. 상승 추세에서 큰 양봉 이후 작은 음봉이 양봉 몸통 내에 포함되고(잉태), 세 번째 봉이 음봉으로 마감하며 첫째 봉의 시가(저가 쪽)를 하회하여 반전을 확인.

Bulkowski 통계: 승률 68%, 평균 수익 -3.88% (5일 보유 기준, 하락 측).

### 2.2 시장 심리

```
상승 추세 진행 중
   ↓
[1봉] 큰 양봉: 매수세가 여전히 시장 지배
   ↓
[2봉] 작은 음봉 (1봉 몸통 내): 매수세 약화, 이익 실현 시작
   ↓
[3봉] 음봉, 1봉 시가 하회: 매도세가 매수세를 완전히 압도.
      잉태형의 '미확인' 약세 신호가 '확인'으로 전환.
      매수자의 손절 + 추가 매도 유입.
```

### 2.3 감지 조건 (ATR 기반)

```
c0 = candles[i-2], c1 = candles[i-1], c2 = candles[i]
a  = this._atr(atr, i, candles)

조건 1 (c0: 큰 양봉):
  c0.close > c0.open
  body0 = c0.close - c0.open
  body0 >= a * HARAMI_PREV_BODY_MIN (= 0.3)

조건 2 (c1: 작은 음봉, c0 몸통 내 포함):
  c1.close < c1.open
  body1 = c1.open - c1.close
  body1 < body0 * HARAMI_CURR_BODY_MAX (= 0.5)
  body1 >= a * HARAMI_CURR_BODY_MIN (= 0.05)
  c1.open < c0.close && c1.close > c0.open    // c0 몸통 내 포함

조건 3 (c2: 확인 음봉):
  c2.close < c2.open
  body2 = c2.open - c2.close
  body2 >= a * THREE_INSIDE_CONFIRM_MIN (= 0.2)
  c2.close < c0.open                          // 1봉 시가 하회 (핵심!)

조건 4 (추세 맥락):
  trend.direction === 'up'                    // 상승 추세에서만 유효
```

### 2.4 구현 방식

Three Inside Up과 동일 함수 `detectThreeInside(candles, ctx)`에서 양방향 감지.
또는 별도 함수 `detectThreeInsideUp()`/`detectThreeInsideDown()` 분리.

**권고**: 단일 함수 `detectThreeInside()` — Engulfing, Harami와 동일한 양방향 패턴 함수 관례 따름.

### 2.5 출력

```javascript
{
  type: 'threeInsideDown',
  name: '하락삼내형 (Three Inside Down)',
  nameShort: '하락삼내',
  signal: 'sell',
  strength: 'strong',
  confidence,
  stopLoss: this._stopLoss(candles, i, 'sell', atr),
  priceTarget: this._candleTarget(candles, i, 'sell', 'strong', atr),
  description: `잉태형 + 확인 음봉 하향돌파 — 강한 하락 반전. 형태 점수 ${confidence}%`,
  startIndex: i - 2,
  endIndex: i,
  marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' }
}
```

### 2.6 KRX 특수 사항

Three Inside Up과 동일. 추가로:
- KRX 약세 삼내형은 상한가(+30%) 도달 후 출현 시 특히 유효 (과열 후 반전 심리).

---

## 3. Abandoned Baby (버려진 아기형) — Bullish + Bearish

### 3.1 학술 정의

**출처**: Nison (1991) pp.85-87, Bulkowski (2008) pp.23-36

Morning Star/Evening Star의 극단적 변형. 가운데 봉(2봉)이 양쪽 봉과 **완전한 갭**으로 분리된 도지(또는 극소형 봉). 서양 차트의 Island Reversal과 유사한 개념.

Nison: "The abandoned baby is a very rare pattern. It is the Western equivalent of a doji star in which the doji gaps away from the prior and following candles (including shadows)."

Bulkowski 통계:
- Bullish Abandoned Baby: 승률 70%, 평균 수익 3.74% (5일 기준). 매우 희귀.
- Bearish Abandoned Baby: 승률 68%, 평균 수익 -3.50% (5일 기준). 매우 희귀.

### 3.2 시장 심리

#### Bullish Abandoned Baby (강세)
```
강한 하락 추세
   ↓
[1봉] 큰 음봉: 하락 모멘텀 극대화
   ↓
[2봉] 갭다운 도지: 매도세 완전 소진. 시장이 "얼어붙은" 상태.
      매수도 매도도 하지 않는 극단적 망설임.
      ★ 1봉 low보다 2봉 high가 낮음 (완전 갭)
   ↓
[3봉] 갭업 양봉: 매수세가 폭발적으로 유입.
      ★ 2봉 high보다 3봉 low가 높음 (완전 갭)
      도지가 "고립된 섬"처럼 남겨짐 → "버림받은 아기"
```

#### Bearish Abandoned Baby (약세)
```
강한 상승 추세
   ↓
[1봉] 큰 양봉: 상승 모멘텀 극대화
   ↓
[2봉] 갭업 도지: 매수세 완전 소진. 극단적 우유부단.
      ★ 1봉 high보다 2봉 low가 높음 (완전 갭)
   ↓
[3봉] 갭다운 음봉: 매도세가 폭발적으로 유입.
      ★ 2봉 low보다 3봉 high가 낮음 (완전 갭)
```

### 3.3 감지 조건 (ATR 기반)

#### 새 상수

```javascript
/** Abandoned Baby 도지(2봉) body/range 상한 — 도지에 가까워야 함 */
static ABANDONED_BABY_DOJI_MAX = 0.10;       // 도지(0.05)보다 약간 완화
/** Abandoned Baby 최소 갭 크기 (ATR 배수) */
static ABANDONED_BABY_GAP_MIN = 0.05;        // KRX 갭 최소 임계 (아래 설명)
/** Abandoned Baby 양끝 봉 body 하한 (ATR 배수) */
static ABANDONED_BABY_END_BODY_MIN = 0.3;    // STAR_END_BODY_MIN 재활용
```

#### Bullish Abandoned Baby 조건

```
c0 = candles[i-2], c1 = candles[i-1], c2 = candles[i]
a  = this._atr(atr, i, candles)

조건 1 (c0: 큰 음봉):
  c0.close < c0.open
  body0 = c0.open - c0.close
  body0 >= a * ABANDONED_BABY_END_BODY_MIN (= 0.3)

조건 2 (c1: 도지/극소형):
  body1 = Math.abs(c1.close - c1.open)
  range1 = c1.high - c1.low
  range1 > 0 && body1 <= range1 * ABANDONED_BABY_DOJI_MAX (= 0.10)

조건 3 (c2: 큰 양봉):
  c2.close > c2.open
  body2 = c2.close - c2.open
  body2 >= a * ABANDONED_BABY_END_BODY_MIN (= 0.3)

조건 4 (완전 갭 — 핵심 차별점):
  c1.high < c0.low - a * ABANDONED_BABY_GAP_MIN   // 1봉 low → 2봉 high 갭
  c1.high < c2.low - a * ABANDONED_BABY_GAP_MIN   // 2봉 high → 3봉 low 갭

  // ★ Strict 모드 (전통 정의): c1.high < c0.low && c1.high < c2.low
  // ★ Relaxed 모드 (KRX 적응): 최소 갭 = ATR * 0.05 (약 0.1% 가격 수준)

조건 5 (c2 종가가 c0 몸통 50% 이상 회복):
  c2.close >= c0.close + body0 * 0.5              // Morning Star 조건 준용

조건 6 (추세 맥락):
  trend.direction === 'down'
```

#### Bearish Abandoned Baby 조건

```
조건 1 (c0: 큰 양봉):
  c0.close > c0.open
  body0 = c0.close - c0.open
  body0 >= a * ABANDONED_BABY_END_BODY_MIN

조건 2 (c1: 도지/극소형):
  동일

조건 3 (c2: 큰 음봉):
  c2.close < c2.open
  body2 = c2.open - c2.close
  body2 >= a * ABANDONED_BABY_END_BODY_MIN

조건 4 (완전 갭):
  c1.low > c0.high + a * ABANDONED_BABY_GAP_MIN   // 1봉 high → 2봉 low 갭업
  c1.low > c2.high + a * ABANDONED_BABY_GAP_MIN   // 2봉 low → 3봉 high 갭다운

조건 5 (c2 종가가 c0 몸통 50% 이하 하락):
  c2.close <= c0.open + body0 * 0.5

조건 6 (추세 맥락):
  trend.direction === 'up'
```

### 3.4 품질 점수

```javascript
// 갭 크기가 클수록 신뢰도 높음 (완전 분리 도지의 "고립도")
const gap1 = Math.abs(c0.low - c1.high) / a;   // bullish: c0.low - c1.high
const gap2 = Math.abs(c2.low - c1.high) / a;   // bullish: c2.low - c1.high
const gapScore = Math.min((gap1 + gap2) / 2, 1);

// 도지 순도 (body가 0에 가까울수록 높음)
const dojiScore = 1 - Math.min(body1 / (range1 || 1), 1);

const bodyScore   = Math.min((body0 + body2) / 2 / a, 1);
const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
const trendScore  = Math.min(trend.strength, 1);

confidence = this._quality({
  body: bodyScore,
  shadow: gapScore,        // 갭 크기를 shadow 슬롯에 매핑
  volume: volumeScore,
  trend: trendScore,
  extra: dojiScore
});

// [ACC] 희귀 패턴 보너스: 완전 갭 형성 자체가 강력한 신호
confidence = Math.min(confidence + 5, 100);
```

### 3.5 KRX 특수 사항 -- CRITICAL

**KRX 갭 희귀성 문제**:
- KRX 주식시장은 KOSPI/KOSDAQ 모두 **틱 기반 연속 매매**로 미국 시장 대비 갭 빈도가 현저히 낮음.
- 특히 일중(intraday) 데이터에서 완전 갭은 거의 발생하지 않음.
- Daily 데이터에서도 shadow 갭(c1.high < c0.low)이 나타나는 빈도는 전체 3봉 조합의 약 0.1~0.3% 수준 (실증 추정).

**KRX 적응 전략**:
1. **GAP_MIN = 0.05 ATR**: 전통 정의(갭 > 0)보다 약간 완화된 최소 갭 크기. 그러나 0으로 설정하면 Morning Star와 구분 불가하므로 양(+) 값 유지.
2. **감지 빈도 경고**: 이 패턴은 KRX에서 극히 드물게 감지됨. 감지 시 그 자체로 강력한 신호. `description`에 "극히 희귀한 패턴" 명시.
3. **가격제한폭 +/-30%**: 상한가/하한가 근처에서 갭이 발생할 가능성이 상대적으로 높으므로, 해당 구간에서 감지 확률 약간 상승.

**틱 단위 영향**:
- 저가주 (1,000원 이하): 틱 단위가 1원이므로 최소 갭 = 1원 = 매우 미미. ATR*0.05 기준이 적절.
- 고가주 (100,000원 이상): 틱 단위 100원. ATR*0.05가 ~200원 수준으로 적절.

### 3.6 출력

```javascript
// Bullish
{
  type: 'bullishAbandonedBaby',
  name: '강세 버림받은아기 (Bullish Abandoned Baby)',
  nameShort: '강세버림아기',
  signal: 'buy', strength: 'strong', confidence,
  stopLoss: this._stopLoss(candles, i, 'buy', atr),
  priceTarget: this._candleTarget(candles, i, 'buy', 'strong', atr),
  description: `갭다운 도지 후 갭업 양봉 — 극히 희귀한 바닥 반전. 형태 점수 ${confidence}%`,
  startIndex: i - 2, endIndex: i,
  marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' }
}

// Bearish
{
  type: 'bearishAbandonedBaby',
  name: '약세 버림받은아기 (Bearish Abandoned Baby)',
  nameShort: '약세버림아기',
  signal: 'sell', strength: 'strong', confidence,
  stopLoss: this._stopLoss(candles, i, 'sell', atr),
  priceTarget: this._candleTarget(candles, i, 'sell', 'strong', atr),
  description: `갭업 도지 후 갭다운 음봉 — 극히 희귀한 천장 반전. 형태 점수 ${confidence}%`,
  startIndex: i - 2, endIndex: i,
  marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' }
}
```

---

## 4. Long-Legged Doji (긴다리 도지)

### 4.1 학술 정의

**출처**: Nison (1991) pp.35-36, Bulkowski (2008) pp.397-410

시가와 종가가 거의 같으면서(도지), 양쪽 그림자(윗꼬리 + 아래꼬리)가 모두 매우 긴 형태. 장중 극단적인 양방향 변동 후 시작점으로 복귀. 잠자리/비석 도지와 달리 **양쪽 그림자가 모두 길다**는 것이 핵심 차별점.

Nison: "Long-legged doji reflect a market in which the forces of supply and demand are at a standstill. The market is at a critical juncture."

Bulkowski 통계: 중립 패턴, 단독 방향 예측력 약 51%. 그러나 추세 전환점에서 출현 시 반전 확률 상승.

### 4.2 시장 심리

```
[장중 흐름]
  시가 → 급등(매수세) → 급락(매도세) → 시가 근처 복귀
  또는
  시가 → 급락(매도세) → 급등(매수세) → 시가 근처 복귀

양쪽 극단으로 크게 움직인 후 원점 복귀:
  → 매수세와 매도세 모두 극단적 수준에서 대결
  → 어느 쪽도 결정적 우위를 점하지 못함
  → 강한 우유부단 + 높은 변동성 = "폭풍전야"
  → 추세 말기에 출현하면 곧 급격한 방향 전환 가능성 시사
```

### 4.3 감지 조건 (ATR 기반)

```
전제: 기존 Doji와 구분 필요 (Doji 상위분류, 하위유형 4개: 일반Doji, 잠자리, 비석, 긴다리)

c = candles[i]
body  = Math.abs(c.close - c.open)
range = c.high - c.low
a     = this._atr(atr, i, candles)

조건 1 (도지 기본):
  range > 0
  body <= range * DOJI_BODY_RATIO (= 0.05)      // body/range <= 5%

조건 2 (양쪽 긴 그림자 — 핵심 차별점):
  upperShadow = c.high - Math.max(c.open, c.close)
  lowerShadow = Math.min(c.open, c.close) - c.low

  upperShadow >= range * LONG_DOJI_SHADOW_MIN (= 0.30)  // 새 상수
  lowerShadow >= range * LONG_DOJI_SHADOW_MIN (= 0.30)  // 새 상수

조건 3 (유의미한 범위):
  range >= a * LONG_DOJI_RANGE_MIN (= 0.80)     // 새 상수: 일반 도지(0.3)보다 큰 범위 요구

조건 4 (잠자리/비석 도지 제외):
  // 잠자리: lowerShadow >= 0.70 && upperShadow <= 0.10 → 통과하지 않음
  // 비석: upperShadow >= 0.70 && lowerShadow <= 0.10 → 통과하지 않음
  // 양쪽 모두 0.30 이상이므로 자동 제외됨 (명시적 검사 불필요)
```

**새 상수**:
```javascript
/** 긴다리 도지 각 그림자/range 하한 — 양쪽 모두 30% 이상 */
static LONG_DOJI_SHADOW_MIN = 0.30;
/** 긴다리 도지 range/ATR 하한 — 일반 도지보다 큰 변동 필요 */
static LONG_DOJI_RANGE_MIN = 0.80;
```

### 4.4 품질 점수

```javascript
// 그림자 균형도: 양쪽 길이가 비슷할수록 높음
const shadowBalance = 1 - Math.abs(upperShadow - lowerShadow) / range;

// 극단 변동성: range/ATR (클수록 극적인 공방)
const rangeScore = Math.min(range / a, 1);

// 추세 맥락 (추세 말기일수록 반전 의미 강화)
const trend = this._detectTrend(candles, i, 10, a);
const signal = trend.direction === 'up' ? 'sell'
             : trend.direction === 'down' ? 'buy' : 'neutral';
const trendScore = trend.direction !== 'neutral' ? Math.min(trend.strength, 1) : 0.2;

const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);

confidence = this._quality({
  body: 0.5,                    // 도지 body는 항상 작으므로 고정
  shadow: shadowBalance,        // 균형도
  volume: volumeScore,
  trend: trendScore,
  extra: rangeScore             // 변동폭
});
```

### 4.5 기존 Doji와의 감지 순서 관계

**문제**: `detectDoji()`가 모든 도지를 감지하므로, Long-Legged Doji와 중복 감지 발생.

**해결 전략 (기존 잠자리/비석과 동일)**:
- `detectLongLeggedDoji()`를 `detectDoji()` 이후에 호출.
- 또는 analyze() 마지막의 `_dedup()` 단계에서 동일 인덱스의 `doji`와 `longLeggedDoji`가 공존하면 `longLeggedDoji`를 우선 (더 구체적인 패턴 우선 원칙).
- **권고**: `detectDoji()` 바로 뒤에 호출하고, dedup에서 하위유형 우선. 기존 dragonflyDoji/gravestoneDoji와 동일한 처리 방식.

### 4.6 출력

```javascript
{
  type: 'longLeggedDoji',
  name: '긴다리도지 (Long-Legged Doji)',
  nameShort: '긴다리도지',
  signal,                       // 추세 맥락에 따라 buy/sell/neutral
  strength: 'weak',             // 단독 방향 예측력 약함
  confidence,
  stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
  priceTarget: signal !== 'neutral' ? this._candleTarget(candles, i, signal, 'weak', atr) : null,
  description: `양쪽 극단 변동 후 원점 복귀 — 극심한 우유부단. 형태 점수 ${confidence}%`,
  startIndex: i,
  endIndex: i,
  marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' }
}
```

### 4.7 KRX 특수 사항

- **변동성 레짐**: KRX 저유동성 종목에서 range가 ATR*0.8 미만인 경우가 많아, LONG_DOJI_RANGE_MIN = 0.80은 이런 종목에서 과도하게 필터링할 수 있음. 그러나 변동성이 낮은 환경에서의 긴다리도지는 의미가 약하므로 0.80 유지가 적절.
- **장 시작/마감 변동**: KRX 09:00 동시호가 이후 급변동이 잦아 5분봉에서 긴다리도지가 비교적 빈번. Daily에서는 적절한 빈도.

---

## 5. Belt Hold (띠두름) — Bullish + Bearish

### 5.1 학술 정의

**출처**: Nison (1991) pp.48-50 ("Yorikiri" — 스모 용어에서 유래), Bulkowski (2008) pp.85-98

하락 추세 말기(강세) 또는 상승 추세 말기(약세)에 출현하는 긴 실체 봉으로, **시가 쪽 그림자가 거의 없는** 것이 특징. 마루보주와 유사하지만 종가 쪽 그림자는 허용.

**Bullish Belt Hold (강세 띠두름)**: 하락 추세에서 갭다운(또는 저가) 시작 후 강하게 반등하여 양봉 마감. 시가 = 저가 근처 (아래꼬리 거의 없음). 윗꼬리는 허용.

**Bearish Belt Hold (약세 띠두름)**: 상승 추세에서 갭업(또는 고가) 시작 후 강하게 하락하여 음봉 마감. 시가 = 고가 근처 (윗꼬리 거의 없음). 아래꼬리는 허용.

Nison: "The bullish belt hold is a long white candlestick that opens on the low of the day. It is called a White Opening Shaven Bottom in Japanese."

Bulkowski 통계:
- Bullish Belt Hold: 승률 56%, 평균 수익 1.76% (5일 기준).
- Bearish Belt Hold: 승률 54%, 평균 수익 -1.62% (5일 기준).

### 5.2 시장 심리

#### Bullish Belt Hold
```
하락 추세 진행 중
   ↓
[시가] 저가 수준에서 시작 (또는 갭다운 시가)
   ↓
[장중] 매수세가 시가부터 지속적으로 가격을 끌어올림.
      아래꼬리가 없음 = 시가 이후 하락 시도 없음.
      매도세가 장 시작부터 완전히 제압당함.
   ↓
[종가] 고가 근처에서 마감 (윗꼬리 약간 허용).
      → 시가=저가인 양봉: 강한 매수 의지의 표현.
      → "개장 순간부터 매수세가 장악" = belt hold의 핵심 의미.
```

#### Bearish Belt Hold
```
상승 추세 진행 중
   ↓
[시가] 고가 수준에서 시작 (또는 갭업 시가)
   ↓
[장중] 매도세가 시가부터 지속적으로 가격을 끌어내림.
      윗꼬리가 없음 = 시가 이후 추가 상승 시도 없음.
      매수세가 장 시작부터 완전히 제압당함.
   ↓
[종가] 저가 근처에서 마감 (아래꼬리 약간 허용).
      → 시가=고가인 음봉: 강한 매도 의지의 표현.
```

### 5.3 마루보주와의 차이점

| 특성 | Marubozu | Belt Hold |
|------|----------|-----------|
| 시가 쪽 그림자 | 거의 없음 (body*0.02) | 거의 없음 (body*0.05) |
| 종가 쪽 그림자 | 거의 없음 (body*0.02) | **허용** (body*0.30) |
| body/range | >= 85% | >= 60% |
| 추세 요구 | 추세 방향 일치 (지속) | **반대 추세** (반전) |
| 기능 | 지속 (Continuation) | **반전 (Reversal)** |
| strength | strong | medium |

핵심 차이: 마루보주는 양끝 꼬리 모두 없고 추세 지속, Belt Hold는 시가 쪽만 꼬리 없고 추세 반전.

### 5.4 감지 조건 (ATR 기반)

#### 새 상수

```javascript
/** Belt Hold body/range 하한 — 마루보주(0.85)보다 완화 */
static BELT_BODY_RATIO_MIN = 0.60;
/** Belt Hold 시가쪽 그림자/body 상한 — 시가 쪽 꼬리 거의 없음 */
static BELT_OPEN_SHADOW_MAX = 0.05;
/** Belt Hold 종가쪽 그림자/body 상한 — 종가 쪽 꼬리 허용 */
static BELT_CLOSE_SHADOW_MAX = 0.30;
/** Belt Hold body/ATR 하한 — 유의미한 몸통 크기 */
static BELT_BODY_ATR_MIN = 0.40;
```

#### Bullish Belt Hold 조건

```
c = candles[i]
body  = Math.abs(c.close - c.open)
range = c.high - c.low
a     = this._atr(atr, i, candles)

조건 1 (양봉):
  c.close > c.open

조건 2 (body/range 비율):
  body >= range * BELT_BODY_RATIO_MIN (= 0.60)

조건 3 (시가 쪽 = 저가 쪽 그림자 거의 없음):
  openShadow = c.open - c.low       // 양봉: open이 low 쪽
  openShadow <= body * BELT_OPEN_SHADOW_MAX (= 0.05)

조건 4 (종가 쪽 = 고가 쪽 그림자 허용):
  closeShadow = c.high - c.close    // 양봉: close가 high 쪽
  closeShadow <= body * BELT_CLOSE_SHADOW_MAX (= 0.30)

조건 5 (유의미한 body 크기):
  body >= a * BELT_BODY_ATR_MIN (= 0.40)

조건 6 (마루보주 배제 — 마루보주 조건 충족하면 Belt Hold 아님):
  // 마루보주는 body >= range * 0.85 && 양끝 꼬리 <= body * 0.02
  // Belt Hold는 body < range * 0.85 또는 종가쪽 꼬리 > body * 0.02
  // → 자동 배제: 마루보주 감지되면 Belt Hold 조건의 body/range >= 0.85 + 종가꼬리 <= 0.02를 동시 충족하지 않음
  // → 실제로는 마루보주 우선 감지 후 dedup에서 처리

조건 7 (추세 맥락 — 반전 패턴):
  trend = _detectTrend(candles, i, 10, a)
  trend.direction === 'down'       // 하락 추세에서만 강세 Belt Hold 유효
```

#### Bearish Belt Hold 조건

```
조건 1: c.close < c.open          // 음봉

조건 2: body >= range * BELT_BODY_RATIO_MIN

조건 3 (시가 쪽 = 고가 쪽 그림자 거의 없음):
  openShadow = c.high - c.open    // 음봉: open이 high 쪽
  openShadow <= body * BELT_OPEN_SHADOW_MAX

조건 4 (종가 쪽 = 저가 쪽 그림자 허용):
  closeShadow = c.close - c.low   // 음봉: close가 low 쪽
  closeShadow <= body * BELT_CLOSE_SHADOW_MAX

조건 5: body >= a * BELT_BODY_ATR_MIN

조건 7: trend.direction === 'up'  // 상승 추세에서만 약세 Belt Hold 유효
```

### 5.5 품질 점수

```javascript
const isBullish = c.close > c.open;
const openShadow  = isBullish ? (c.open - c.low) : (c.high - c.open);
const closeShadow = isBullish ? (c.high - c.close) : (c.close - c.low);

// 시가 쪽 꼬리 없음 정도 (없을수록 높음)
const openCleanScore = 1 - Math.min(openShadow / (body || 1), 1);

// body 크기 (ATR 대비)
const bodyScore = Math.min(body / a, 1);

const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
const trendScore  = Math.min(trend.strength, 1);

confidence = this._quality({
  body: bodyScore,
  shadow: openCleanScore,       // 시가 쪽 청결도
  volume: volumeScore,
  trend: trendScore,
  extra: 0.3                    // 기본값 (추가 확인 없음)
});
```

### 5.6 출력

```javascript
// Bullish
{
  type: 'bullishBeltHold',
  name: '강세 띠두름 (Bullish Belt Hold)',
  nameShort: '강세띠두름',
  signal: 'buy', strength: 'medium', confidence,
  stopLoss: +(c.low - a * 1.5).toFixed(0),    // 저가 하방 ATR*1.5
  priceTarget: this._candleTarget(candles, i, 'buy', 'medium', atr),
  description: `시가=저가의 긴 양봉 — 개장부터 매수 장악. 형태 점수 ${confidence}%`,
  startIndex: i, endIndex: i,
  marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' }
}

// Bearish
{
  type: 'bearishBeltHold',
  name: '약세 띠두름 (Bearish Belt Hold)',
  nameShort: '약세띠두름',
  signal: 'sell', strength: 'medium', confidence,
  stopLoss: +(c.high + a * 1.5).toFixed(0),   // 고가 상방 ATR*1.5
  priceTarget: this._candleTarget(candles, i, 'sell', 'medium', atr),
  description: `시가=고가의 긴 음봉 — 개장부터 매도 장악. 형태 점수 ${confidence}%`,
  startIndex: i, endIndex: i,
  marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' }
}
```

### 5.7 KRX 특수 사항

- **동시호가 영향**: KRX 09:00 동시호가에서 결정된 시가가 당일 저가/고가와 일치하는 경우가 종종 발생. 이런 경우 자연스럽게 Belt Hold 형태를 형성. 시가 = 저가(양봉) 또는 시가 = 고가(음봉) 빈도가 미국 시장보다 높을 수 있음.
- **Daily 데이터에서의 빈도**: 중소형주에서 급등/급락일에 비교적 빈번. BELT_BODY_ATR_MIN = 0.40이 적절한 필터.
- **마루보주와의 관계**: dedup 단계에서 마루보주가 우선 (마루보주 = Belt Hold의 극단적 형태). 동일 봉에서 마루보주 감지 시 Belt Hold는 제거.

---

## 7-Location 등록 정보 종합

### Location 1: patterns.js -- analyze() 내 감지 호출

```javascript
// 1봉 패턴 (기존 9종 뒤에 추가)
patterns.push(...this.detectLongLeggedDoji(candles, ctx));
patterns.push(...this.detectBeltHold(candles, ctx));

// 3봉 패턴 (기존 4종 뒤에 추가)
patterns.push(...this.detectThreeInside(candles, ctx));
patterns.push(...this.detectAbandonedBaby(candles, ctx));
```

**호출 순서 근거**:
- `detectLongLeggedDoji`: `detectDoji()` + `detectDragonflyDoji()` + `detectGravestoneDoji()` 뒤에 배치. dedup에서 하위유형 우선 원칙 적용.
- `detectBeltHold`: `detectMarubozu()` 뒤에 배치. 마루보주 우선 감지 후 Belt Hold 감지.
- `detectThreeInside`: `detectHarami()` 뒤, `detectMorningStar()` 뒤에 배치. 잉태형 확장.
- `detectAbandonedBaby`: `detectEveningStar()` 뒤에 배치. 샛별/석별의 극단적 변형.

### Location 2: patternRenderer.js -- ZONE_PATTERNS / SINGLE_PATTERNS

```javascript
// ZONE_PATTERNS (2봉 이상) -- 추가:
threeInsideUp:         { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
threeInsideDown:       { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
bullishAbandonedBaby:  { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
bearishAbandonedBaby:  { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },

// SINGLE_PATTERNS (1봉) -- 추가:
longLeggedDoji:   { key: 'close', color: CANDLE_NEUTRAL, direction: 'neutral' },
bullishBeltHold:  { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
bearishBeltHold:  { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
```

### Location 3: patternRenderer.js -- CANDLE_PATTERN_TYPES

```javascript
const CANDLE_PATTERN_TYPES = new Set([
  // ... 기존 21종 ...
  'threeInsideUp', 'threeInsideDown',
  'bullishAbandonedBaby', 'bearishAbandonedBaby',
  'longLeggedDoji',
  'bullishBeltHold', 'bearishBeltHold',
]);
```

### Location 4: patternRenderer.js -- BULLISH_TYPES / BEARISH_TYPES

```javascript
const BULLISH_TYPES = new Set([
  // ... 기존 ...
  'threeInsideUp', 'bullishAbandonedBaby', 'bullishBeltHold',
]);

const BEARISH_TYPES = new Set([
  // ... 기존 ...
  'threeInsideDown', 'bearishAbandonedBaby', 'bearishBeltHold',
]);

// longLeggedDoji: 양쪽 모두에 추가하지 않음 (중립 패턴, 추세 맥락에 따라 signal 변동)
```

### Location 5: patternRenderer.js -- PATTERN_NAMES_KO

```javascript
const PATTERN_NAMES_KO = {
  // ... 기존 ...
  threeInsideUp: '상승삼내형',
  threeInsideDown: '하락삼내형',
  bullishAbandonedBaby: '강세버림아기',
  bearishAbandonedBaby: '약세버림아기',
  longLeggedDoji: '긴다리도지',
  bullishBeltHold: '강세띠두름',
  bearishBeltHold: '약세띠두름',
};
```

### Location 6: backtester.js -- _META

```javascript
this._META = {
  // ... 기존 31종 ...
  threeInsideUp:         { name: '상승삼내형',     signal: 'buy'     },
  threeInsideDown:       { name: '하락삼내형',     signal: 'sell'    },
  bullishAbandonedBaby:  { name: '강세버림아기',   signal: 'buy'     },
  bearishAbandonedBaby:  { name: '약세버림아기',   signal: 'sell'    },
  longLeggedDoji:        { name: '긴다리도지',     signal: 'neutral' },
  bullishBeltHold:       { name: '강세띠두름',     signal: 'buy'     },
  bearishBeltHold:       { name: '약세띠두름',     signal: 'sell'    },
};
```

### Location 7: patternPanel.js -- PATTERN_ACADEMIC_META

```javascript
threeInsideUp: {
  nameKo: '상승삼내형',
  category: '캔들스틱 (반전)',
  candles: 3,
  academicDesc: '하락 추세에서 상승 잉태형(큰 음봉 + 작은 양봉) 이후 세 번째 양봉이 첫째 봉 시가를 상회하며 반전 확인. 잉태형의 "미확인" 약점을 보완한 강화 패턴.',
  psychology: '잉태형으로 매도세 약화가 감지된 후, 확인 봉이 이전 하락분을 뒤집으며 반전을 입증. 매도자의 심리적 항복 + 숏 커버링이 동시 발생하여 매수 모멘텀 가속.',
  bulkowskiWinRate: 65,
  invalidation: '세 번째 봉의 거래량이 감소하면 돌파 지속력 의문. 다음 봉이 두 번째 봉 저가 이하로 하락하면 무효.'
},

threeInsideDown: {
  nameKo: '하락삼내형',
  category: '캔들스틱 (반전)',
  candles: 3,
  academicDesc: '상승 추세에서 하락 잉태형(큰 양봉 + 작은 음봉) 이후 세 번째 음봉이 첫째 봉 시가를 하회하며 반전 확인. 잉태형의 확인 버전.',
  psychology: '잉태형으로 매수세 약화가 감지된 후, 확인 봉이 이전 상승분을 뒤집음. 이익 실현 욕구가 추가 매수 의지를 압도하면서 하락 가속.',
  bulkowskiWinRate: 68,
  invalidation: '세 번째 봉 거래량 감소 시 하락 지속 의문. 다음 봉이 첫째 봉 종가 위로 회복하면 무효.'
},

bullishAbandonedBaby: {
  nameKo: '강세 버림받은아기',
  category: '캔들스틱 (반전)',
  candles: 3,
  academicDesc: '하락 추세에서 큰 음봉 이후 완전 갭다운된 도지, 그 후 완전 갭업된 양봉 출현. 도지가 양쪽과 갭으로 "고립"되어 극히 희귀한 강력 바닥 반전 신호.',
  psychology: '극단적 매도 후 시장이 완전히 "얼어붙는" 순간(갭 도지)을 거쳐 폭발적 매수세 전환. 공포의 극단에서 탐욕으로의 급격한 심리 반전. 서양 Island Reversal과 동일한 시장 구조.',
  bulkowskiWinRate: 70,
  invalidation: 'KRX에서 극히 드물게 발생. 갭이 부분적으로만 형성되면 Morning Star로 분류. 다음 봉이 도지 아래로 하락하면 무효.'
},

bearishAbandonedBaby: {
  nameKo: '약세 버림받은아기',
  category: '캔들스틱 (반전)',
  candles: 3,
  academicDesc: '상승 추세에서 큰 양봉 이후 완전 갭업된 도지, 그 후 완전 갭다운된 음봉 출현. 도지가 양쪽과 갭으로 "고립"되어 극히 희귀한 강력 천장 반전 신호.',
  psychology: '극단적 매수 후 시장이 완전히 "얼어붙는" 순간을 거쳐 폭발적 매도세 전환. 탐욕의 극단에서 공포로의 급격한 심리 반전.',
  bulkowskiWinRate: 68,
  invalidation: '갭 불충분 시 Evening Star로 분류. 다음 봉이 도지 위로 상승하면 무효.'
},

longLeggedDoji: {
  nameKo: '긴다리도지',
  category: '캔들스틱 (중립)',
  candles: 1,
  academicDesc: '시가와 종가가 거의 같으면서 양쪽 그림자가 모두 매우 긴 도지. 장중 극단적 양방향 변동 후 원점 복귀. 매수세와 매도세의 극단적 대결을 나타냄.',
  psychology: '장중 급등과 급락이 교차하며 어느 쪽도 결정적 우위를 점하지 못함. 일반 도지보다 변동폭이 크므로 시장 참여자의 혼란과 불확실성이 극심한 상태. 추세 전환의 전조.',
  bulkowskiWinRate: 51,
  invalidation: '횡보 구간에서 반복 출현 시 의미 없음. 추세 말기 + 거래량 급증 동반 시에만 반전 신호로 유효.'
},

bullishBeltHold: {
  nameKo: '강세 띠두름',
  category: '캔들스틱 (반전)',
  candles: 1,
  academicDesc: '하락 추세에서 시가가 저가와 거의 같은 긴 양봉. 장 시작부터 매수세가 일방적으로 가격을 끌어올리며 마감. 마루보주와 유사하나 윗꼬리 허용.',
  psychology: '개장 순간부터 매수세가 시장을 완전히 장악. 시가 이후 한 번도 하락하지 않은 채 상승만 지속. 매도세의 완전한 부재를 나타내는 강한 매수 의지의 표현 (일본어: 寄り切り, 스모의 압승 기술).',
  bulkowskiWinRate: 56,
  invalidation: '선행 추세가 하락이 아닌 경우 반전 의미 상실. 봉의 크기가 ATR 대비 작으면 무시. 마루보주 조건 충족 시 마루보주로 분류.'
},

bearishBeltHold: {
  nameKo: '약세 띠두름',
  category: '캔들스틱 (반전)',
  candles: 1,
  academicDesc: '상승 추세에서 시가가 고가와 거의 같은 긴 음봉. 장 시작부터 매도세가 일방적으로 가격을 끌어내리며 마감. 마루보주와 유사하나 아래꼬리 허용.',
  psychology: '개장 순간부터 매도세가 시장을 완전히 장악. 시가 이후 한 번도 상승하지 않은 채 하락만 지속. 매수세의 완전한 부재를 나타내는 강한 매도 의지의 표현.',
  bulkowskiWinRate: 54,
  invalidation: '선행 추세가 상승이 아닌 경우 반전 의미 상실. 봉의 크기가 ATR 대비 작으면 무시. 마루보주 조건 충족 시 마루보주로 분류.'
},
```

### Location 8: app.js -- _VIZ_CANDLE_TYPES

```javascript
var _VIZ_CANDLE_TYPES = new Set([
  // ... 기존 22종 ...
  'threeInsideUp', 'threeInsideDown',
  'bullishAbandonedBaby', 'bearishAbandonedBaby',
  'longLeggedDoji',
  'bullishBeltHold', 'bearishBeltHold'
]);
```

---

## 상수 정리 (신규 6개)

```javascript
// patterns.js 클래스 상단에 추가

/** Three Inside Up/Down 확인봉(3봉) body/ATR 하한 */
static THREE_INSIDE_CONFIRM_MIN = 0.2;

/** Abandoned Baby 도지(2봉) body/range 상한 */
static ABANDONED_BABY_DOJI_MAX = 0.10;
/** Abandoned Baby 최소 갭 크기 (ATR 배수) */
static ABANDONED_BABY_GAP_MIN = 0.05;
/** Abandoned Baby 양끝 봉 body/ATR 하한 — STAR_END_BODY_MIN(0.3) 재활용 가능 */
// ABANDONED_BABY_END_BODY_MIN = STAR_END_BODY_MIN = 0.3 (별도 상수 불필요)

/** 긴다리 도지 각 그림자/range 하한 */
static LONG_DOJI_SHADOW_MIN = 0.30;
/** 긴다리 도지 range/ATR 하한 */
static LONG_DOJI_RANGE_MIN = 0.80;

/** Belt Hold body/range 하한 */
static BELT_BODY_RATIO_MIN = 0.60;
/** Belt Hold 시가쪽 그림자/body 상한 */
static BELT_OPEN_SHADOW_MAX = 0.05;
/** Belt Hold 종가쪽 그림자/body 상한 */
static BELT_CLOSE_SHADOW_MAX = 0.30;
/** Belt Hold body/ATR 하한 */
static BELT_BODY_ATR_MIN = 0.40;
```

총 신규 상수: 9개 (ABANDONED_BABY_END_BODY_MIN은 STAR_END_BODY_MIN 재활용으로 8개)

---

## dedup 규칙

기존 `_dedup()` 또는 analyze() 후처리에 추가할 중복 해소 규칙:

| 충돌 쌍 | 우선 패턴 | 근거 |
|---------|----------|------|
| `bullishHarami` + `threeInsideUp` (동일 c0-c1) | `threeInsideUp` | 확인 완료 패턴이 미확인 패턴보다 우선 |
| `bearishHarami` + `threeInsideDown` (동일 c0-c1) | `threeInsideDown` | 동일 |
| `morningStar` + `bullishAbandonedBaby` (동일 c0-c1-c2) | `bullishAbandonedBaby` | 더 엄격한 조건 (갭 요구) |
| `eveningStar` + `bearishAbandonedBaby` (동일 c0-c1-c2) | `bearishAbandonedBaby` | 동일 |
| `doji` + `longLeggedDoji` (동일 인덱스) | `longLeggedDoji` | 하위유형 우선 |
| `bullishMarubozu` + `bullishBeltHold` (동일 인덱스) | `bullishMarubozu` | 더 엄격한 형태 |
| `bearishMarubozu` + `bearishBeltHold` (동일 인덱스) | `bearishMarubozu` | 동일 |

---

## 패턴 총수 업데이트

```
구현 전: 캔들 21종 + 차트 9종 + S/R = 31종
구현 후: 캔들 28종 + 차트 9종 + S/R = 38종

카테고리별:
  1봉 패턴:  12/12 (100.0%)  -- +longLeggedDoji, +bullishBeltHold, +bearishBeltHold
  2봉 패턴:   6/10 ( 60.0%)  -- 변동 없음
  3봉 패턴:   8/12 ( 66.7%)  -- +threeInsideUp, +threeInsideDown, +bullishAbandonedBaby, +bearishAbandonedBaby
  차트 패턴:  9/9  (100.0%)  -- 변동 없음

42종 기준 전체: 33/42 (78.6%, 기존 26종 61.9%에서 대폭 향상)
```

---

## 구현 우선순위 권고

| 순위 | 패턴 | 근거 |
|------|------|------|
| 1 | Three Inside Up/Down | 기존 Harami 코드 90% 재활용 + 확인봉 추가. 높은 승률(65-68%). KRX 적합. |
| 2 | Belt Hold (Bullish/Bearish) | 단일봉 패턴으로 구현 간단. KRX 동시호가 특성에 부합. |
| 3 | Long-Legged Doji | 기존 Doji 코드 구조 재활용. 중립 패턴이므로 리스크 낮음. |
| 4 | Abandoned Baby (Bullish/Bearish) | 가장 복잡한 갭 조건. KRX 감지 빈도 극히 낮을 수 있어 실용적 가치 검증 필요. |

---

## Worker 캐시 버스트 참고

구현 시 `analysisWorker.js`의 `importScripts` 버전을 반드시 증가시킬 것.
See `js/analysisWorker.js` lines 57-61 for current `?v=N` values.
(feedback_worker_cache_busting.md 참조: Worker importScripts MUST include ?v=N)
