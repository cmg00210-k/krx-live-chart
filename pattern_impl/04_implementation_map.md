# 04. 구현 위치 매핑 (Implementation Map)

> 학술 문서(core_data/) -> 패턴 정의(pattern_impl/) -> 코드 구현(js/) 전체 추적 가능한 매핑.
> 마지막 갱신: 2026-03-15

---

## 현재 스크립트 로드 순서 (index.html L203-215)

```
colors.js -> data.js -> api.js -> realtimeProvider.js -> indicators.js -> patterns.js -> signalEngine.js -> chart.js -> patternRenderer.js -> signalRenderer.js -> backtester.js -> sidebar.js -> app.js
```

> colors.js가 최선두: 모든 JS 파일에서 KRX_COLORS 참조 가능.
> indicators.js가 patterns.js보다 먼저 로드되므로 PatternEngine에서 calcMA, calcRSI 등 전역 함수 참조 가능.
> signalEngine.js는 indicators.js(IndicatorCache)와 patterns.js(patternEngine) 양쪽에 의존.

---

## 섹션 1: 캔들/차트 패턴 -> patterns.js 매핑

### js/patterns.js (1,488행) -- PatternEngine v2.0

#### 유틸리티 메서드

| 줄 번호 | 메서드 | 역할 |
|---------|--------|------|
| L18-34 | `_calcATR(candles, period=14)` | ATR Wilder 평활 |
| L37-53 | `_detectTrend(candles, endIndex, lookback=10)` | 선형 회귀 기울기로 추세 판별 |
| L56-64 | `_calcVolumeMA(candles, period=20)` | 거래량 SMA(20) |
| L67-70 | `_volRatio(candles, idx, vma)` | 거래량 / VMA 배수 |
| L73-76 | `_quality({body, volume, trend, shadow, extra})` | 다요인 품질 점수 (0-100) |
| L79-84 | `_stopLoss(candles, idx, signal, atr, mult=2)` | ATR 기반 손절가 |
| L87-94 | `_target(candles, si, ei, signal)` | 패턴 높이 기반 목표가 |
| L97-99 | `_atr(atr, idx, candles)` | ATR fallback (null일 때 range 사용) |

#### 진입점: analyze() -- L106-146

| 줄 번호 | 동작 |
|---------|------|
| L106 | `analyze(candles)` 시작 |
| L108 | ctx 생성: ATR + VMA |
| L111-128 | 캔들 패턴 17종 호출 |
| L130-132 | 스윙 포인트 계산 (`_findSwingHighs`, `_findSwingLows`) |
| L133-140 | 차트 패턴 8종 호출 |
| L142-144 | 지지/저항 계산 + 컨플루언스 적용 |
| L146 | 중복 제거 후 반환 |

#### 구현된 캔들 패턴 (17종)

| # | 패턴명 (한국) | 메서드 | 줄 번호 | 봉수 | 방향 |
|---|--------------|--------|---------|------|------|
| 1 | 적삼병 | `detectThreeWhiteSoldiers()` | L152-190 | 3봉 | 강세 |
| 2 | 흑삼병 | `detectThreeBlackCrows()` | L192-226 | 3봉 | 약세 |
| 3 | 해머 | `detectHammer()` | L228-266 | 1봉 | 강세 |
| 4 | 역해머 | `detectInvertedHammer()` | L268-305 | 1봉 | 강세 |
| 5 | 교수형 | `detectHangingMan()` | L307-350 | 1봉 | 약세 |
| 6 | 유성형 | `detectShootingStar()` | L352-390 | 1봉 | 약세 |
| 7 | 도지 | `detectDoji()` | L392-427 | 1봉 | 중립 |
| 8 | 상승 장악형 | `detectEngulfing()` (buy) | L429-465 | 2봉 | 강세 |
| 9 | 하락 장악형 | `detectEngulfing()` (sell) | L429-481 | 2봉 | 약세 |
| 10 | 잉태형 | `detectHarami()` | L483-537 | 2봉 | 양방향 |
| 11a | 샛별형 | `detectMorningStar()` | L539-575 | 3봉 | 강세 |
| 11b | 석별형 | `detectEveningStar()` | L577-618 | 3봉 | 약세 |
| 12 | 관통형 | `detectPiercingLine()` | L620-673 | 2봉 | 강세 |
| 13 | 먹구름형 | `detectDarkCloud()` | L682-735 | 2봉 | 약세 |
| 14 | 잠자리 도지 | `detectDragonflyDoji()` | L744-790 | 1봉 | 강세 |
| 15 | 비석 도지 | `detectGravestoneDoji()` | L799-845 | 1봉 | 약세 |
| 16 | 족집게 바닥 | `detectTweezerBottom()` | L854-898 | 2봉 | 강세 |
| 17 | 족집게 천장 | `detectTweezerTop()` | L908-951 | 2봉 | 약세 |

> 장악형은 하나의 함수에서 buy/sell 양방향 감지. 잉태형도 동일 구조.
> Phase 8에서 6종 추가: 관통형, 먹구름형, 잠자리도지, 비석도지, 족집게바닥, 족집게천장.

#### 구현된 차트 패턴 (8종 + 지지/저항)

| # | 패턴명 (한국) | 메서드 | 줄 번호 | 방향 |
|---|--------------|--------|---------|------|
| 18 | 상승 삼각형 | `detectAscendingTriangle()` | L956-1013 | 강세 |
| 19 | 하락 삼각형 | `detectDescendingTriangle()` | L1015-1072 | 약세 |
| 20 | 상승 쐐기 | `detectRisingWedge()` | L1074-1132 | 약세 |
| 21 | 하락 쐐기 | `detectFallingWedge()` | L1134-1192 | 강세 |
| 22 | 이중 바닥 | `detectDoubleBottom()` | L1194-1231 | 강세 |
| 23 | 이중 천장 | `detectDoubleTop()` | L1233-1270 | 약세 |
| 24 | 머리어깨형 | `detectHeadAndShoulders()` | L1272-1323 | 약세 |
| 25 | 역머리어깨형 | `detectInverseHeadAndShoulders()` | L1325-1374 | 강세 |
| -- | 지지/저항선 | `detectSupportResistance()` | L1376-1414 | -- |

#### 보조 유틸리티

| 줄 번호 | 메서드 | 역할 |
|---------|--------|------|
| L1416-1446 | `_applyConfluence()` | S/R 근접 패턴 confidence 보정 |
| L1448-1460 | `_findSwingHighs()` | 스윙 고점 탐색 |
| L1462-1474 | `_findSwingLows()` | 스윙 저점 탐색 |
| L1476-1486 | `_dedup()` | type+endIndex 기준 중복 제거 |
| L1488 | `patternEngine` | 전역 인스턴스 |

#### 미구현 캔들 패턴 (42종 기준 16종)

**1봉 미구현 (5종)**:
긴다리 도지, 팽이형, 양봉 마루보주, 음봉 마루보주, 띠형

**2봉 미구현 (3종)**:
잉태 십자형, 스틱 샌드위치, (관통형/먹구름/족집게는 구현 완료)

**3봉 미구현 (8종)**:
샛별 도지형, 석별 도지형, 강세 버림받은 아기, 약세 버림받은 아기, 상승 삼내형, 하락 삼내형, 갭상 쌍까마귀, 타스키 갭

> 상세 알고리즘 정의와 우선순위는 `02_candle_patterns.md` 참조.

---

## 섹션 2: 지표 시그널 -> signalEngine.js 매핑

### js/signalEngine.js (1,129행) -- SignalEngine

#### 메인 분석: analyze() -- L133-167

```
analyze(candles, candlePatterns=[])
  -> IndicatorCache 생성 (L139)
  -> 5카테고리 시그널 감지 (L142-147)
  -> 캔들 패턴 -> 시그널 맵 변환 (L150)
  -> 복합 시그널 매칭 (L153-155)
  -> 시장 심리 계산 (L164)
  -> { signals, cache, stats } 반환 (L166)
```

#### 카테고리 1: MA 크로스 시그널

| 줄 번호 | 메서드 | 감지 시그널 |
|---------|--------|-----------|
| L174-251 | `_detectMACross(candles, cache)` | 골든크로스, 데드크로스 |
| L258-320 | `_detectMAAlignment(candles, cache)` | MA 정배열 진입, MA 역배열 진입 |

세부 시그널 타입:
- `goldenCross` (L199): MA5 > MA20 상향 돌파, EMA12/26 확인 시 strong
- `deadCross` (L227): MA5 < MA20 하향 돌파, EMA12/26 확인 시 strong
- `maAlignment_bull` (L277): MA5 > MA20 > MA60 정배열 진입 시점
- `maAlignment_bear` (L299): MA5 < MA20 < MA60 역배열 진입 시점

#### 카테고리 2: MACD 시그널

| 줄 번호 | 메서드 | 감지 시그널 |
|---------|--------|-----------|
| L327-436 | `_detectMACDSignals(candles, cache)` | MACD 골든/데드크로스, 히스토그램 전환 |
| L431-434 | 내부 호출 `_detectDivergence(macd)` | MACD 강세/약세 다이버전스 |

세부 시그널 타입:
- `macdBullishCross` (L342): MACD > Signal 상향 돌파, 0선 위면 strong
- `macdBearishCross` (L365): MACD < Signal 하향 돌파, 0선 아래면 strong
- `macdHistPositive` (L388): 히스토그램 양(+) 전환
- `macdHistNegative` (L409): 히스토그램 음(-) 전환
- `macdBullishDivergence` (L836): 가격 신저가 + MACD 상승
- `macdBearishDivergence` (L867): 가격 신고가 + MACD 하락

#### 카테고리 3: RSI 시그널

| 줄 번호 | 메서드 | 감지 시그널 |
|---------|--------|-----------|
| L443-545 | `_detectRSISignals(candles, cache)` | RSI 과매수/과매도 진입/탈출 |
| L540-542 | 내부 호출 `_detectDivergence(rsi)` | RSI 강세/약세 다이버전스 |

세부 시그널 타입:
- `rsiOversold` (L453): RSI < 30 하향 돌파 (neutral)
- `rsiOversoldExit` (L475): RSI > 30 상향 돌파 (buy)
- `rsiOverbought` (L496): RSI > 70 상향 돌파 (neutral)
- `rsiOverboughtExit` (L518): RSI < 70 하향 돌파 (sell)
- `rsiBullishDivergence` (L836): 가격 신저가 + RSI 상승
- `rsiBearishDivergence` (L867): 가격 신고가 + RSI 하락

#### 카테고리 4: 볼린저 밴드 시그널

| 줄 번호 | 메서드 | 감지 시그널 |
|---------|--------|-----------|
| L552-612 | `_detectBBSignals(candles, cache)` | BB 하단 반등, BB 상단 돌파 |
| L618-668 | `_detectBBSqueeze(candles, bb)` | BB 스퀴즈 브레이크아웃 |

세부 시그널 타입:
- `bbLowerBounce` (L566): 하단 터치 후 양봉 반등 (buy)
- `bbUpperBreak` (L587): 상단 종가 돌파 (sell)
- `bbSqueeze` (L646): 밴드 수렴 후 2배 확산 (방향별 buy/sell)

#### 카테고리 5: 거래량 시그널

| 줄 번호 | 메서드 | 감지 시그널 |
|---------|--------|-----------|
| L675-735 | `_detectVolumeSignals(candles, cache)` | 거래량 돌파, 투매 |
| L740-784 | `_detectVolumeExhaustion(candles, cache)` | 5봉 연속 거래량 감소 |

세부 시그널 타입:
- `volumeBreakout` (L689): VMA 2배 이상 + 양봉 (buy)
- `volumeSelloff` (L710): VMA 2배 이상 + 음봉 (sell)
- `volumeExhaustion` (L762): 5봉 연속 거래량 감소 (neutral)

#### 범용: 다이버전스 감지

| 줄 번호 | 메서드 | 역할 |
|---------|--------|------|
| L798-889 | `_detectDivergence(candles, indicator, name, lookback=20)` | 가격 vs 지표 다이버전스 (MACD, RSI 공용) |

- 스윙 포인트 좌우 3봉 비교 (`swingOrder = 3`, L800)
- 강세 다이버전스: 가격 신저가 + 지표 상승 (L825-853)
- 약세 다이버전스: 가격 신고가 + 지표 하락 (L857-886)

#### 보조 메서드

| 줄 번호 | 메서드 | 역할 |
|---------|--------|------|
| L901-910 | `_buildCandleSignalMap(candlePatterns)` | 캔들 패턴 -> type별 인덱스 Map |
| L916-1017 | `_matchComposites(candles, indSignals, candleMap)` | 복합 시그널 매칭 |
| L1028-1087 | `_calcStats(signals, candles)` | 시장 심리 지표 (-100~+100) |
| L1092-1098 | `_signalCategory(type)` | 시그널 타입 -> 카테고리 분류 |
| L1104-1110 | `_sentimentLabel(sentiment)` | 심리 지수 -> 라벨 변환 |
| L1115-1125 | `_emptyStats()` | 빈 통계 객체 |
| L1129 | `signalEngine` | 전역 인스턴스 |

---

## 섹션 3: 복합 시그널 정의 -> signalEngine.js 매핑

### COMPOSITE_SIGNAL_DEFS (L10-94) -- 6종

| # | compositeId | nameShort | tier | signal | 줄 번호 |
|---|-------------|-----------|------|--------|---------|
| 1 | `strongBuy_hammerRsiVolume` | 강력매수: 해머+RSI+거래량 | Tier 1 | buy | L12-24 |
| 2 | `strongSell_shootingMacdVol` | 강력매도: 유성형+MACD+거래량 | Tier 1 | sell | L26-37 |
| 3 | `buy_goldenCrossRsi` | 매수: 골든크로스+RSI | Tier 2 | buy | L41-52 |
| 4 | `sell_deadCrossMacd` | 매도: 데드크로스+MACD | Tier 2 | sell | L54-65 |
| 5 | `buy_bbBounceRsi` | 매수: BB반등+RSI | Tier 3 | buy | L69-80 |
| 6 | `sell_bbBreakoutRsi` | 매도: BB상단돌파+RSI | Tier 3 | sell | L82-93 |

#### 각 복합 시그널의 조건 상세

**Tier 1 -- 강력 시그널 (baseConfidence 80-82)**

| ID | required | optional | window |
|----|----------|----------|--------|
| `strongBuy_hammerRsiVolume` | `hammer` + `rsiOversoldExit` | `volumeBreakout` (+5) | 3봉 |
| `strongSell_shootingMacdVol` | `shootingStar` + `macdBearishCross` | `volumeSelloff` (+5) | 3봉 |

**Tier 2 -- 중간 강도 (baseConfidence 70-72)**

| ID | required | optional | window |
|----|----------|----------|--------|
| `buy_goldenCrossRsi` | `goldenCross` | `rsiOversoldExit` (+4), `volumeBreakout` (+4) | 3봉 |
| `sell_deadCrossMacd` | `deadCross` | `macdBearishCross` (+4), `rsiOverboughtExit` (+4) | 3봉 |

**Tier 3 -- 약한 시그널 (baseConfidence 58-60)**

| ID | required | optional | window |
|----|----------|----------|--------|
| `buy_bbBounceRsi` | `bbLowerBounce` | `rsiOversold` (+3), `volumeBreakout` (+3) | 3봉 |
| `sell_bbBreakoutRsi` | `bbUpperBreak` | `rsiOverbought` (+3), `volumeSelloff` (+3) | 3봉 |

#### 매칭 알고리즘 (`_matchComposites`, L916-1017)

```
1. 지표 시그널 -> type별 인덱스 맵 구축 (L920-924)
2. 캔들 패턴 맵과 통합 (L927-934)
3. 각 COMPOSITE_SIGNAL_DEF에 대해:
   a. required 시그널 전부 존재 확인 (L938-941)
   b. 첫 required 인덱스를 기준점으로 window 내 나머지 required 탐색 (L944-957)
   c. optional 보너스 계산 (L960-966)
   d. confidence = min(95, base + optional * bonus) (L968-971)
   e. +-window 범위 중복 방지 (L978-982)
```

---

## 섹션 4: 지표 계산 -> indicators.js 매핑

### js/indicators.js (378행)

#### 전역 계산 함수 (9종)

| # | 함수명 | 줄 번호 | 입력 | 출력 | 비고 |
|---|--------|---------|------|------|------|
| 1 | `calcMA(data, n)` | L9-16 | 종가 배열, 기간 | 배열 | 단순 이동평균 SMA |
| 2 | `calcEMA(data, n)` | L19-36 | 종가 배열, 기간 | 배열 | 지수 이동평균, 첫 N개 SMA 초기값 |
| 3 | `calcBB(closes, n=20, mult=2)` | L39-47 | 종가, 기간, 배수 | {upper, lower, mid}[] | 볼린저 밴드 |
| 4 | `calcRSI(closes, period=14)` | L50-71 | 종가, 기간 | 배열 | RSI Wilder 방식 |
| 5 | `calcATR(candles, period=14)` | L74-90 | OHLCV, 기간 | 배열 | ATR Wilder 평활 |
| 6 | `calcIchimoku(candles, ...)` | L93-125 | OHLCV, 4개 파라미터 | {tenkan, kijun, spanA, spanB, chikou} | 일목균형표 |
| 7 | `calcKalman(closes, Q=0.01, R=1.0)` | L128-146 | 종가, Q, R | 배열 | 칼만 필터 평활 |
| 8 | `calcHurst(closes, minWindow=10)` | L149-181 | 종가, 최소 윈도우 | 스칼라 or null | 허스트 지수 R/S 분석 |
| 9 | `calcMACD(closes, fast=12, slow=26, sig=9)` | L184-208 | 종가, 3개 기간 | {macdLine, signalLine, histogram} | MACD |

#### IndicatorCache 클래스 (L215-378)

| 줄 번호 | 메서드/속성 | 역할 |
|---------|-----------|------|
| L219-224 | `constructor(candles)` | 캔들 저장, 캐시 초기화 |
| L227-232 | `setCandles(candles)` | 캔들 교체 + 캐시 전부 무효화 |
| L235-239 | `get closes` | 종가 배열 (lazy) |
| L243-248 | `get volumes` | 거래량 배열 (lazy) |
| L253-259 | `ma(n)` | SMA 캐시 접근자 |
| L262-268 | `ema(n)` | EMA 캐시 접근자 |
| L271-277 | `bb(n=20, mult=2)` | BB 캐시 접근자 |
| L280-286 | `rsi(period=14)` | RSI 캐시 접근자 |
| L289-295 | `atr(period=14)` | ATR 캐시 접근자 |
| L298-304 | `macd(fast=12, slow=26, sig=9)` | MACD 캐시 접근자 |
| L307-313 | `ichimoku(conv=9, base=26, ...)` | 일목균형표 캐시 접근자 |
| L316-322 | `kalman(Q=0.01, R=1.0)` | 칼만 필터 캐시 접근자 |
| L325-331 | `hurst(minWindow=10)` | 허스트 지수 캐시 접근자 |
| L336-342 | `vma(n=20)` | 거래량 이동평균 캐시 접근자 |
| L352-357 | `volRatio(idx, n=20)` | 거래량 비율 (vol / VMA) |
| L362-372 | `invalidate(keyPrefix)` | 특정 또는 전체 캐시 무효화 |
| L375-377 | `get cachedKeys` | 캐시된 키 목록 |

> IndicatorCache 설계 원칙: Lazy Evaluation -- 각 지표를 최초 접근 시에만 계산하고 캐시.
> 캔들 데이터 변경 시 `setCandles()` 또는 `invalidate()`로 캐시 무효화.

---

## 섹션 5: 시각화 렌더러 매핑

### js/patternRenderer.js (405행) -- 패턴 시각화

| 역할 | 방식 |
|------|------|
| ISeriesPrimitive | Canvas2D 직접 그리기 (`attachPrimitive`/`detachPrimitive`) |
| 도형 | 직사각형(패턴 영역), 폴리라인(차트 패턴 추세선), 수평선(S/R, 손절/목표) |
| 제한 | 차트 위 최대 3개 (`MAX_PATTERNS`), 나머지 사이드 패널 |
| 색상 | KRX_COLORS 참조 (UP/DOWN/NEUTRAL) |

### js/signalRenderer.js (469행) -- 시그널 시각화

| 역할 | 방식 |
|------|------|
| ISeriesPrimitive | Dual PaneViews (bg zOrder='bottom', fg zOrder='top') |
| 마커 | 다이아몬드(MA/MACD 크로스), 별(복합 시그널), 수직 밴드(영역) |
| 다이버전스 | 가격 고/저점 연결 점선 |
| 거래량 | volumeSeries 색상 강조 (breakout bars) |
| 최근 제한 | `RECENT_BAR_LIMIT = 50` 봉 이내만 표시 |

### js/backtester.js (497행) -- 백테스트 엔진

| 역할 | 방식 |
|------|------|
| 분석 | patternEngine.analyze() 호출 -> 패턴별 N일 후 수익률 통계 |
| HORIZONS | [1, 3, 5, 10, 20]일 |
| 캐시 | 종목코드+캔들길이 기반 결과 캐시 |
| 렌더링 | #btab-backtest 하단 패널에 테이블 출력 |
| 패턴 메타 | 26종 전체 등록 (_META 객체) |

---

## 섹션 6: Web Worker 매핑

### js/analysisWorker.js (103행)

```
importScripts: indicators.js, patterns.js, signalEngine.js, backtester.js

메시지 프로토콜:
  → { type: 'analyze', candles, realtimeMode, version }
  ← { type: 'result', patterns, signals, stats, version }

  → { type: 'backtest', candles, version }
  ← { type: 'backtestResult', results, candleLength, version }

  ← { type: 'ready' }   Worker 초기화 완료
  ← { type: 'error', message, version }   처리 중 에러
```

> Worker에서 IndicatorCache는 함수를 포함하므로 structured clone 불가 → cache 객체는 전달하지 않음.
> 실시간 모드 시 미완성(마지막) 캔들 제외하고 분석.

---

## 섹션 7: 학술 문서 -> 코드 트레이서빌리티

### core_data/ 학술 문서 -> 구현 파일 매핑

| 학술 문서 | 주요 내용 | 구현 파일 | 관련 코드 |
|----------|----------|----------|----------|
| `01_mathematics.md` | 확률과정, 이동평균 이론 | indicators.js | `calcMA()` L9, `calcEMA()` L19 |
| `02_statistics.md` | 시계열 분석, 회귀, 베이지안 | indicators.js | `calcHurst()` L149 (R/S 분석), patterns.js `_detectTrend()` L37 (선형 회귀) |
| `03_physics.md` | 물리 모델, 상태 추정 | indicators.js | `calcKalman()` L128 (칼만 필터) |
| `04_psychology.md` | 전망이론, 군중심리 | signalEngine.js | `_calcStats()` L1028 (시장 심리 지표) |
| `05_finance_theory.md` | EMH, MPT, 변동성 모델 | indicators.js | `calcATR()` L74 (변동성), `calcBB()` L39 |
| `06_technical_analysis.md` | 다우이론, 캔들스틱, 차트패턴 | patterns.js | 캔들 패턴 전체 (L152-951), 차트 패턴 전체 (L956-1374) |
| `07_pattern_algorithms.md` | 패턴 인식 수학, 품질점수, ATR 정규화 | patterns.js | `_quality()` L73, `_calcATR()` L18, `_findSwingHighs/Lows` L1448-1474 |
| `08_references.md` | 참고 문헌 목록 | (전체) | -- |
| `09_game_theory.md` | 게임이론 | -- | (미구현) |
| `10_optimal_control.md` | 최적 제어 | indicators.js | `calcKalman()` L128 |
| `11_reinforcement_learning.md` | 강화학습 | -- | (미구현) |
| `11B_rl_advanced.md` | RL 심화 | -- | (미구현) |
| `12_extreme_value_theory.md` | EVT, VaR/ES | -- | (미구현 -- 리스크 관리 향후 확장) |
| `13_information_geometry.md` | 정보 기하학 | -- | (미구현) |
| `14_finance_management.md` | 켈리, VaR, 리스크관리 | patterns.js | `_stopLoss()` L79, `_target()` L87 (리스크/리워드) |
| `15_advanced_patterns.md` | 하모닉, 엘리엇, ML | backtester.js | 백테스팅 프레임워크 (부분 구현) |
| `16_pattern_reference.md` | 42종 패턴 정의 + 시각 가이드 | patterns.js | 26종 구현, 16종 미구현 |

### 캔들 패턴 학술 근거 세부 매핑

| 패턴 | 학술 근거 (core_data/) | 구현 위치 (patterns.js) |
|------|----------------------|----------------------|
| 해머/교수형/유성형/역해머 | 06 S3.3 (1봉 반전형) | L228-390 |
| 도지 | 06 S3.3 (시장 균형) | L392-427 |
| 잠자리 도지 / 비석 도지 | 06 S3.3, 16 ref (도지 세분화) | L744-845 |
| 장악형 (Engulfing) | 06 S3.4 (2봉 반전형) | L429-481 |
| 잉태형 (Harami) | 06 S3.4 (2봉 반전형) | L483-537 |
| 관통형 / 먹구름형 | 06 S3.4 (2봉 반전형, Nison 1991) | L620-735 |
| 족집게 바닥/천장 | 06 S3.4 (2봉 반전형, Bulkowski 통계) | L854-951 |
| 샛별/석별 | 06 S3.5, 07 S8.5 (3봉 반전형) | L539-618 |
| 적삼병/흑삼병 | 06 S3.5 (3봉 추세형) | L152-226 |
| 삼각형/쐐기 | 06 S4.2 (차트 패턴), 07 S2.3 (추세선 알고리즘) | L956-1192 |
| 이중 천장/바닥 | 06 S4.1 (반전 패턴) | L1194-1270 |
| 머리어깨 | 06 S4.1 (반전 패턴), 07 S1 (피봇) | L1272-1374 |
| 지지/저항 | 07 S1.3 (적응형 피봇) | L1376-1414 |
| 품질 점수 | 07 S3 (다요인 평가) | L73-76 |
| ATR 정규화 | 07 S3.1 (가격 독립 비교) | L18-34, L97-99 |

### 지표 시그널 학술 근거 매핑

| 시그널 | 학술 근거 | 구현 위치 (signalEngine.js) |
|--------|----------|--------------------------|
| 골든/데드 크로스 | 01 (이동평균 이론), 06 S2 (추세 추종) | L174-251 |
| MA 정배열/역배열 | 06 S2.3 (다중 MA 분석) | L258-320 |
| MACD 크로스 | 06 S2.4 (모멘텀 오실레이터) | L327-436 |
| RSI 과매수/과매도 | 06 S2.5 (RSI 해석) | L443-545 |
| BB 반등/돌파 | 05 (변동성), 06 S2.6 (볼린저 전략) | L552-668 |
| 거래량 시그널 | 06 S5 (거래량 분석) | L675-784 |
| 다이버전스 | 06 S2.7 (추세-오실레이터 괴리) | L798-889 |
| 복합 시그널 | 03_composite_signals.md (설계 문서) | L10-94 (정의), L916-1017 (매칭) |

---

## 부록: 구현 현황 요약

```
패턴 엔진 (patterns.js, 1,488행):
  캔들 패턴:  17종 구현 / 16종 미구현 (42종 기준)
  차트 패턴:   8종 구현 / 8종 완료
  합계:       26종 구현 (61.9%)

시그널 엔진 (signalEngine.js, 1,129행):
  개별 시그널: 16종 (5카테고리)
  복합 시그널:  6종 (3 Tier)
  다이버전스:   4종 (MACD/RSI x 강세/약세)

지표 모듈 (indicators.js, 378행):
  전역 함수:    9종
  IndicatorCache: 10개 접근자 + 유틸리티

시각화 (patternRenderer.js 405행 + signalRenderer.js 469행):
  패턴 렌더러: ISeriesPrimitive Canvas2D (rects, polylines, hlines)
  시그널 렌더러: ISeriesPrimitive Dual PaneViews (diamonds, stars, vbands, divlines)

백테스트 (backtester.js, 497행):
  패턴 메타: 26종 등록
  분석 기간: [1, 3, 5, 10, 20]일

Web Worker (analysisWorker.js, 103행):
  오프로드: 패턴 + 시그널 + 백테스트 분석

색상 관리 (colors.js, 20행):
  KRX_COLORS: 한국식 색상 상수 (UP/DOWN/NEUTRAL/ACCENT + 지표 팔레트)

스크립트 로드 순서:
  colors.js -> data.js -> api.js -> realtimeProvider.js -> indicators.js
  -> patterns.js -> signalEngine.js -> chart.js
  -> patternRenderer.js -> signalRenderer.js -> backtester.js
  -> sidebar.js -> app.js
```
