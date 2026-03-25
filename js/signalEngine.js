// ══════════════════════════════════════════════════════
//  KRX LIVE — 복합 시그널 엔진 (Phase 2-3)
//  지표 기반 7카테고리 시그널 감지 + 복합 시그널 매칭
//
//  의존: indicators.js (IndicatorCache, calcMA, calcEMA 등)
//        patterns.js  (patternEngine — 캔들 패턴)
// ══════════════════════════════════════════════════════

// ── 복합 시그널 정의 ────────────────────────────────────
const COMPOSITE_SIGNAL_DEFS = [
  // Tier 1: 강력 매수/매도 (3개 이상 조건 동시 충족)
  {
    id: 'strongBuy_hammerRsiVolume',
    nameShort: '강력매수: 해머+RSI+거래량',
    signal: 'buy',
    strength: 'strong',
    tier: 1,
    baseConfidence: 82,
    required: ['hammer', 'rsiOversoldExit'],
    optional: ['volumeBreakout'],
    optionalBonus: 5,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '해머 캔들 + RSI 과매도 탈출 + 거래량 급증 — 바닥 반등 확률 높음',
  },
  {
    id: 'strongSell_shootingMacdVol',
    nameShort: '강력매도: 유성형+MACD+거래량',
    signal: 'sell',
    strength: 'strong',
    tier: 1,
    baseConfidence: 80,
    required: ['shootingStar', 'macdBearishCross'],
    optional: ['volumeSelloff'],
    optionalBonus: 5,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '유성형 캔들 + MACD 데드크로스 + 투매 거래량 — 천장 하락 확률 높음',
  },

  // Tier 2: 중간 강도
  {
    id: 'buy_goldenCrossRsi',
    nameShort: '매수: 골든크로스+RSI',
    signal: 'buy',
    strength: 'medium',
    tier: 2,
    baseConfidence: 72,
    required: ['goldenCross'],
    optional: ['rsiOversoldExit', 'volumeBreakout'],
    optionalBonus: 4,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '골든크로스 + RSI/거래량 보조 확인 — 추세 전환 신호',
  },
  {
    id: 'sell_deadCrossMacd',
    nameShort: '매도: 데드크로스+MACD',
    signal: 'sell',
    strength: 'medium',
    tier: 2,
    baseConfidence: 70,
    required: ['deadCross'],
    optional: ['macdBearishCross', 'rsiOverboughtExit'],
    optionalBonus: 4,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '데드크로스 + MACD/RSI 보조 확인 — 하락 추세 전환 신호',
  },

  // Tier 3: 약한 시그널 (단일 조건 + 보조)
  {
    id: 'buy_bbBounceRsi',
    nameShort: '매수: BB반등+RSI',
    signal: 'buy',
    strength: 'weak',
    tier: 3,
    baseConfidence: 60,
    required: ['bbLowerBounce'],
    optional: ['rsiOversold', 'volumeBreakout'],
    optionalBonus: 3,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '볼린저 하단 반등 + RSI 과매도 영역 — 단기 반등 가능',
  },
  {
    id: 'sell_bbBreakoutRsi',
    nameShort: '매도: BB상단돌파+RSI',
    signal: 'sell',
    strength: 'weak',
    tier: 3,
    baseConfidence: 58,
    required: ['bbUpperBreak'],
    optional: ['rsiOverbought', 'volumeSelloff'],
    optionalBonus: 3,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '볼린저 상단 돌파 + RSI 과매수 영역 — 과열 후 조정 가능',
  },
];


class SignalEngine {

  constructor() {
    /** 시그널 타입별 가중치 (시장 심리 계산용) */
    this._weights = {
      // MA 계열
      goldenCross: 3, deadCross: -3,
      maAlignment_bull: 2, maAlignment_bear: -2,
      // MACD
      macdBullishCross: 2, macdBearishCross: -2,
      macdBullishDivergence: 2.5, macdBearishDivergence: -2.5,
      macdHiddenBullishDivergence: 2.0, macdHiddenBearishDivergence: -2.0,
      // RSI
      rsiOversold: 1.5, rsiOversoldExit: 2.5,
      rsiOverbought: -1.5, rsiOverboughtExit: -2.5,
      rsiBullishDivergence: 2, rsiBearishDivergence: -2,
      rsiHiddenBullishDivergence: 1.5, rsiHiddenBearishDivergence: -1.5,
      // 볼린저
      bbLowerBounce: 1.5, bbUpperBreak: 0,  // [ACC] neutral — 방향은 복합 시그널이 판단
      bbSqueeze: 0,  // 방향 중립
      // 일목균형표
      ichimokuBullishCross: 2.5, ichimokuBearishCross: -2.5,
      ichimokuCloudBreakout: 3, ichimokuCloudBreakdown: -3,
      // 허스트 지수 (레짐 필터 — 방향 중립)
      hurstTrending: 0, hurstMeanReverting: 0,
      // 거래량
      volumeBreakout: 2, volumeSelloff: -2, volumeExhaustion: 0,
      // 복합 (가중치 = tier별 증폭)
      composite: 0,  // 개별 계산
    };
  }

  // ══════════════════════════════════════════════════════
  //  메인 분석 메서드
  // ══════════════════════════════════════════════════════

  /**
   * 지표 시그널 분석 + 복합 시그널 매칭
   * @param {Array} candles — OHLCV 배열
   * @param {Array} candlePatterns — patternEngine.analyze() 결과 (캔들 패턴)
   * @returns {{ signals: Array, cache: IndicatorCache, stats: Object }}
   */
  analyze(candles, candlePatterns = []) {
    if (!candles || candles.length < 30) {
      return { signals: [], cache: null, stats: this._emptyStats() };
    }

    // IndicatorCache 생성 (indicators.js 전역 함수 + 클래스 사용)
    const cache = new IndicatorCache(candles);

    // 7카테고리 개별 시그널 감지
    const indicatorSignals = [];
    indicatorSignals.push(...this._detectMACross(candles, cache));
    indicatorSignals.push(...this._detectMACDSignals(candles, cache));
    indicatorSignals.push(...this._detectRSISignals(candles, cache));
    indicatorSignals.push(...this._detectBBSignals(candles, cache));
    indicatorSignals.push(...this._detectVolumeSignals(candles, cache));
    indicatorSignals.push(...this._detectIchimokuSignals(candles, cache));
    indicatorSignals.push(...this._detectHurstSignal(candles, cache));

    // 캔들 패턴 → 시그널 타입 맵 (복합 매칭용)
    const candleSignalMap = this._buildCandleSignalMap(candlePatterns);

    // 복합 시그널 매칭
    const compositeSignals = this._matchComposites(
      candles, indicatorSignals, candleSignalMap
    );

    // 전체 시그널 병합 (지표 + 복합, 캔들 패턴은 이미 patterns.js에서 관리)
    const signals = [...indicatorSignals, ...compositeSignals];

    // 시간순 정렬
    signals.sort((a, b) => a.index - b.index);

    // 시장 심리 계산
    const stats = this._calcStats(signals, candles);

    return { signals, cache, stats };
  }


  // ══════════════════════════════════════════════════════
  //  1. MA 크로스 시그널
  // ══════════════════════════════════════════════════════

  _detectMACross(candles, cache) {
    const signals = [];
    const ma5  = cache.ma(5);
    const ma20 = cache.ma(20);
    const ema12 = cache.ema(12);
    const ema26 = cache.ema(26);
    const atr  = cache.atr(14);

    for (let i = 1; i < candles.length; i++) {
      if (ma5[i] === null || ma5[i - 1] === null ||
          ma20[i] === null || ma20[i - 1] === null ||
          atr[i] === null) continue;

      const prevDiff = ma5[i - 1] - ma20[i - 1];
      const currDiff = ma5[i] - ma20[i];
      // [ACC] ATR 대비 최소 이격도 0.3→0.4 상향: 횡보장 허위 크로스 감소
      const minGap = atr[i] * 0.4;

      // 골든크로스: MA5가 MA20을 상향 돌파
      if (prevDiff <= 0 && currDiff > 0 && Math.abs(currDiff) >= minGap) {
        // EMA 확인으로 강도 판정
        const emaConfirm = ema12[i] !== null && ema26[i] !== null &&
                           ema12[i] > ema26[i];
        const strength = emaConfirm ? 'strong' : 'medium';
        const confidence = emaConfirm ? 72 : 60;

        signals.push({
          type: 'goldenCross',
          source: 'indicator',
          nameShort: '골든크로스',
          signal: 'buy',
          strength,
          confidence,
          index: i,
          time: candles[i].time,
          description: `MA5가 MA20 상향 돌파${emaConfirm ? ' (EMA 확인)' : ''} — 상승 추세 전환`,
        });
      }

      // 데드크로스: MA5가 MA20을 하향 돌파
      if (prevDiff >= 0 && currDiff < 0 && Math.abs(currDiff) >= minGap) {
        const emaConfirm = ema12[i] !== null && ema26[i] !== null &&
                           ema12[i] < ema26[i];
        const strength = emaConfirm ? 'strong' : 'medium';
        const confidence = emaConfirm ? 70 : 58;

        signals.push({
          type: 'deadCross',
          source: 'indicator',
          nameShort: '데드크로스',
          signal: 'sell',
          strength,
          confidence,
          index: i,
          time: candles[i].time,
          description: `MA5가 MA20 하향 돌파${emaConfirm ? ' (EMA 확인)' : ''} — 하락 추세 전환`,
        });
      }
    }

    // MA 정배열/역배열 감지
    signals.push(...this._detectMAAlignment(candles, cache));

    return signals;
  }

  /**
   * MA 정배열/역배열 진입 감지
   * 정배열: MA5 > MA20 > MA60 (상승 추세)
   * 역배열: MA5 < MA20 < MA60 (하락 추세)
   */
  _detectMAAlignment(candles, cache) {
    const signals = [];
    const ma5  = cache.ma(5);
    const ma20 = cache.ma(20);
    const ma60 = cache.ma(60);

    for (let i = 1; i < candles.length; i++) {
      if (ma5[i] === null || ma20[i] === null || ma60[i] === null ||
          ma5[i - 1] === null || ma20[i - 1] === null || ma60[i - 1] === null) continue;

      const isBullNow  = ma5[i] > ma20[i] && ma20[i] > ma60[i];
      const isBullPrev = ma5[i - 1] > ma20[i - 1] && ma20[i - 1] > ma60[i - 1];

      const isBearNow  = ma5[i] < ma20[i] && ma20[i] < ma60[i];
      const isBearPrev = ma5[i - 1] < ma20[i - 1] && ma20[i - 1] < ma60[i - 1];

      // 정배열 진입 시점
      if (isBullNow && !isBullPrev) {
        signals.push({
          type: 'maAlignment_bull',
          source: 'indicator',
          nameShort: 'MA 정배열',
          signal: 'buy',
          strength: 'medium',
          confidence: 65,
          index: i,
          time: candles[i].time,
          description: 'MA5 > MA20 > MA60 정배열 진입 — 상승 추세 확인',
        });
      }

      // 역배열 진입 시점
      if (isBearNow && !isBearPrev) {
        signals.push({
          type: 'maAlignment_bear',
          source: 'indicator',
          nameShort: 'MA 역배열',
          signal: 'sell',
          strength: 'medium',
          confidence: 63,
          index: i,
          time: candles[i].time,
          description: 'MA5 < MA20 < MA60 역배열 진입 — 하락 추세 확인',
        });
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  2. MACD 시그널
  // ══════════════════════════════════════════════════════

  _detectMACDSignals(candles, cache) {
    const signals = [];
    const { macdLine, signalLine, histogram } = cache.macd();

    for (let i = 1; i < candles.length; i++) {
      if (macdLine[i] === null || macdLine[i - 1] === null ||
          signalLine[i] === null || signalLine[i - 1] === null) continue;

      const prevDiff = macdLine[i - 1] - signalLine[i - 1];
      const currDiff = macdLine[i] - signalLine[i];

      // MACD > Signal 돌파 (매수)
      if (prevDiff <= 0 && currDiff > 0) {
        const aboveZero = macdLine[i] > 0;
        signals.push({
          type: 'macdBullishCross',
          source: 'indicator',
          nameShort: 'MACD 골든크로스',
          signal: 'buy',
          strength: aboveZero ? 'strong' : 'medium',
          confidence: aboveZero ? 70 : 58,
          index: i,
          time: candles[i].time,
          description: `MACD가 시그널선 상향 돌파${aboveZero ? ' (0선 위, 강세)' : ' (0선 아래)'}`,
        });
      }

      // MACD < Signal 돌파 (매도)
      if (prevDiff >= 0 && currDiff < 0) {
        const belowZero = macdLine[i] < 0;
        signals.push({
          type: 'macdBearishCross',
          source: 'indicator',
          nameShort: 'MACD 데드크로스',
          signal: 'sell',
          strength: belowZero ? 'strong' : 'medium',
          confidence: belowZero ? 68 : 56,
          index: i,
          time: candles[i].time,
          description: `MACD가 시그널선 하향 돌파${belowZero ? ' (0선 아래, 약세)' : ' (0선 위)'}`,
        });
      }

      // [ACC] 히스토그램 양전환/음전환 제거 — histogram = MACD - Signal 이므로
      // 히스토그램 zero-cross는 MACD cross와 수학적으로 동일 이벤트 (이중 카운트)
    }

    // MACD 다이버전스 — [ACC] lookback 20→40: 주요 추세 반전 포착 확대
    signals.push(...this._detectDivergence(
      candles, macdLine, 'macd', 40
    ));

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  3. RSI 시그널
  // ══════════════════════════════════════════════════════

  _detectRSISignals(candles, cache) {
    const signals = [];
    const rsi = cache.rsi(14);
    // C-5 CZW: Hurst 레짐 연동 RSI confidence
    // H>0.6(추세): RSI 역행 위험 → confidence 하향
    // H<0.4(반지속): RSI 반전 유효 → confidence 상향
    const H = cache.hurst();
    const hBase = (H !== null && H !== undefined)
      ? Math.round(65 - 20 * Math.max(0, Math.min(1, (H - 0.4) / 0.2)))
      : 55;  // H 없으면 기본 55
    // hBase: H=0.4→65, H=0.5→55, H=0.6→45 (선형 보간)
    const entryConf = Math.max(40, hBase - 10);  // 진입은 탈출보다 10 낮음
    const exitBuyConf = Math.max(50, hBase);
    const exitSellConf = Math.max(48, hBase - 2);

    for (let i = 1; i < candles.length; i++) {
      if (rsi[i] === null || rsi[i - 1] === null) continue;

      // RSI 극단도 보너스: |RSI-50|가 클수록 가산
      const extremeBonus = Math.floor(Math.abs(rsi[i] - 50) / 10) * 2;

      // RSI 30 하향 돌파 → 과매도 진입
      if (rsi[i - 1] >= 30 && rsi[i] < 30) {
        signals.push({
          type: 'rsiOversold',
          source: 'indicator',
          nameShort: 'RSI 과매도 진입',
          signal: 'neutral',
          strength: 'medium',
          confidence: Math.min(75, entryConf + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)})가 30 하향 돌파 — 과매도 영역 진입`,
        });
      }

      // RSI 30 상향 돌파 → 과매도 탈출 (매수)
      if (rsi[i - 1] <= 30 && rsi[i] > 30) {
        signals.push({
          type: 'rsiOversoldExit',
          source: 'indicator',
          nameShort: 'RSI 과매도 탈출',
          signal: 'buy',
          strength: 'medium',
          confidence: Math.min(80, exitBuyConf + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)})가 30 상향 돌파 — 과매도 탈출, 반등 기대`,
        });
      }

      // RSI 70 상향 돌파 → 과매수 진입
      if (rsi[i - 1] <= 70 && rsi[i] > 70) {
        signals.push({
          type: 'rsiOverbought',
          source: 'indicator',
          nameShort: 'RSI 과매수 진입',
          signal: 'neutral',
          strength: 'medium',
          confidence: Math.min(75, entryConf + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)})가 70 상향 돌파 — 과매수 영역 진입`,
        });
      }

      // RSI 70 하향 돌파 → 과매수 탈출 (매도)
      if (rsi[i - 1] >= 70 && rsi[i] < 70) {
        signals.push({
          type: 'rsiOverboughtExit',
          source: 'indicator',
          nameShort: 'RSI 과매수 탈출',
          signal: 'sell',
          strength: 'medium',
          confidence: Math.min(78, exitSellConf + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)})가 70 하향 돌파 — 과매수 탈출, 조정 가능`,
        });
      }
    }

    // RSI 다이버전스 — [ACC] lookback 20→40: 주요 추세 반전 포착 확대
    signals.push(...this._detectDivergence(
      candles, rsi, 'rsi', 40
    ));

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  4. 볼린저 밴드 시그널
  // ══════════════════════════════════════════════════════

  _detectBBSignals(candles, cache) {
    const signals = [];
    const bb = cache.bb(20, 2);

    for (let i = 1; i < candles.length; i++) {
      if (bb[i].upper === null || bb[i - 1].upper === null) continue;

      const c = candles[i];
      const cPrev = candles[i - 1];

      // 하단 밴드 터치 후 반등
      if (cPrev.low <= bb[i - 1].lower && c.close > bb[i].lower &&
          c.close > c.open) {
        signals.push({
          type: 'bbLowerBounce',
          source: 'indicator',
          nameShort: 'BB 하단 반등',
          signal: 'buy',
          strength: 'medium',
          confidence: 60,
          index: i,
          time: c.time,
          description: '볼린저 하단 밴드 터치 후 양봉 반등 — 단기 반등 신호',
        });
      }

      // 상단 밴드 돌파
      // [ACC] 'sell'→'neutral': 강한 추세에서 BB 상단 돌파는 추세 지속 신호일 수 있음
      // (mean-reversion 가정은 횡보장에서만 유효 — 복합 시그널이 방향 판단)
      if (c.close > bb[i].upper && cPrev.close <= bb[i - 1].upper) {
        signals.push({
          type: 'bbUpperBreak',
          source: 'indicator',
          nameShort: 'BB 상단 돌파',
          signal: 'neutral',
          strength: 'weak',
          confidence: 50,
          index: i,
          time: c.time,
          description: '볼린저 상단 밴드 종가 돌파 — 추세 지속 또는 과열 (복합 확인 필요)',
        });
      }
    }

    // Squeeze → Breakout 감지
    signals.push(...this._detectBBSqueeze(candles, bb));

    return signals;
  }

  /**
   * 볼린저 밴드 Squeeze → Breakout
   * 밴드 폭이 최근 20봉 최소 → 현재 2배 이상 확산
   */
  _detectBBSqueeze(candles, bb) {
    const signals = [];
    const lookback = 20;

    for (let i = lookback; i < candles.length; i++) {
      if (bb[i].upper === null) continue;

      const currWidth = bb[i].upper - bb[i].lower;
      if (currWidth <= 0) continue;

      // 최근 lookback 봉의 밴드 폭 최소값
      let minWidth = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (bb[j].upper === null) continue;
        const w = bb[j].upper - bb[j].lower;
        if (w > 0 && w < minWidth) minWidth = w;
      }

      if (minWidth === Infinity || minWidth <= 0) continue;

      // Squeeze 후 Breakout: 현재 밴드 폭이 최소값의 2배 이상
      // 이전 봉이 아직 squeeze 상태였는지 확인
      if (i > 0 && bb[i - 1].upper !== null) {
        const prevWidth = bb[i - 1].upper - bb[i - 1].lower;
        if (prevWidth <= minWidth * 1.3 && currWidth >= minWidth * 2) {
          const c = candles[i];
          const bullish = c.close > c.open;
          signals.push({
            type: 'bbSqueeze',
            source: 'indicator',
            nameShort: 'BB 스퀴즈 브레이크아웃',
            signal: bullish ? 'buy' : 'sell',
            strength: 'strong',
            confidence: 68,
            index: i,
            time: c.time,
            description: `볼린저 밴드 수렴 후 확산 — ${bullish ? '상승' : '하락'} 방향 변동성 확대`,
          });
        }
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  5. 거래량 시그널
  // ══════════════════════════════════════════════════════

  _detectVolumeSignals(candles, cache) {
    const signals = [];
    // C-6 CZW: z-score 기반 동적 임계 (Ane & Geman 2000, 로그정규분포)
    // 대형주/소형주 거래량 분포 차이를 자동 보정
    const zThreshold = 2.0;  // z >= 2.0 = 상위 2.28% (정규분포)

    for (let i = 0; i < candles.length; i++) {
      const zVol = cache.volZScore(i, 20);
      const ratio = cache.volRatio(i, 20);  // 설명 텍스트용 유지
      if (zVol === null || ratio === null) continue;

      const c = candles[i];
      const priceUp = c.close > c.open;

      // C-7 CZW: z-score 기반 confidence (로그 함수, 정보이론 정합)
      // z=2.0→65, z=3.0→73, z=4.0→78, z=5.0→80(cap)
      const buyConf = Math.min(80, Math.round(50 + 15 * Math.log(Math.max(zVol, 1))));
      const sellConf = Math.min(78, Math.round(48 + 15 * Math.log(Math.max(zVol, 1))));

      // 거래량 급증 + 가격 상승 = 돌파 확인
      if (zVol >= zThreshold && priceUp) {
        signals.push({
          type: 'volumeBreakout',
          source: 'indicator',
          nameShort: '거래량 돌파 확인',
          signal: 'buy',
          strength: zVol >= 3.0 ? 'strong' : 'medium',
          confidence: buyConf,
          index: i,
          time: c.time,
          description: `거래량 ${ratio.toFixed(1)}배(z=${zVol.toFixed(1)}) 급증 + 양봉 — 매수세 유입 확인`,
        });
      }

      // 거래량 급증 + 가격 하락 = 투매
      if (zVol >= zThreshold && !priceUp) {
        signals.push({
          type: 'volumeSelloff',
          source: 'indicator',
          nameShort: '투매 거래량',
          signal: 'sell',
          strength: zVol >= 3.0 ? 'strong' : 'medium',
          confidence: sellConf,
          index: i,
          time: c.time,
          description: `거래량 ${ratio.toFixed(1)}배(z=${zVol.toFixed(1)}) 급증 + 음봉 — 매도세 투매 경고`,
        });
      }
    }

    // 5봉 연속 거래량 감소 = 에너지 소진
    signals.push(...this._detectVolumeExhaustion(candles, cache));

    return signals;
  }

  /**
   * 5봉 연속 거래량 감소 → 에너지 소진 시그널
   */
  _detectVolumeExhaustion(candles, cache) {
    const signals = [];
    const volumes = cache.volumes;
    const consecutiveRequired = 5;

    for (let i = consecutiveRequired; i < candles.length; i++) {
      let decreasing = true;
      for (let j = i - consecutiveRequired + 1; j <= i; j++) {
        if (volumes[j] >= volumes[j - 1]) {
          decreasing = false;
          break;
        }
      }

      if (decreasing) {
        // 동일 구간 중복 방지: 직전 봉에도 이 시그널이 있는지 확인
        // (6봉 연속이면 5번째, 6번째 둘 다 감지되므로 마지막만)
        if (i + 1 < candles.length) {
          const nextDecreasing = volumes[i + 1] < volumes[i];
          if (nextDecreasing) continue;  // 아직 감소 중 → 나중에 감지
        }

        signals.push({
          type: 'volumeExhaustion',
          source: 'indicator',
          nameShort: '거래량 에너지 소진',
          signal: 'neutral',
          strength: 'weak',
          confidence: 45,
          index: i,
          time: candles[i].time,
          description: `${consecutiveRequired}봉 연속 거래량 감소 — 추세 전환 또는 횡보 예상`,
        });
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  6. 일목균형표 시그널
  // ══════════════════════════════════════════════════════

  /**
   * 일목균형표 기반 시그널 감지
   * - 전환선/기준선 크로스 (TK Cross)
   * - 구름 상향/하향 돌파 (Cloud Breakout/Breakdown)
   *
   * 시장 심리:
   *   전환선(9일)은 단기 균형, 기준선(26일)은 중기 균형을 나타냄.
   *   전환선이 기준선 위로 올라가면 단기 모멘텀이 중기 추세를 압도하는 것.
   *   구름(선행스팬 A/B 사이)은 미래 지지/저항 영역으로,
   *   가격이 구름을 돌파하면 추세 전환의 강한 확인 신호.
   */
  _detectIchimokuSignals(candles, cache) {
    const signals = [];
    const ich = cache.ichimoku();  // { tenkan, kijun, spanA, spanB, chikou }
    if (!ich) return signals;

    const { tenkan, kijun, spanA, spanB } = ich;

    for (let i = 1; i < candles.length; i++) {
      // ── TK Cross (전환선 × 기준선) ──
      if (tenkan[i] !== null && tenkan[i - 1] !== null &&
          kijun[i] !== null && kijun[i - 1] !== null) {

        const prevDiff = tenkan[i - 1] - kijun[i - 1];
        const currDiff = tenkan[i] - kijun[i];

        // 강세 크로스: 전환선이 기준선 상향 돌파
        if (prevDiff <= 0 && currDiff > 0) {
          // 구름 위에서 발생하면 강도 상향
          const cloudTop = (spanA[i] !== null && spanB[i] !== null)
            ? Math.max(spanA[i], spanB[i]) : null;
          const aboveCloud = cloudTop !== null && candles[i].close > cloudTop;
          signals.push({
            type: 'ichimokuBullishCross',
            source: 'indicator',
            nameShort: '일목 강세 크로스',
            signal: 'buy',
            strength: aboveCloud ? 'strong' : 'medium',
            confidence: aboveCloud ? 72 : 65,
            index: i,
            time: candles[i].time,
            description: `전환선이 기준선 상향 돌파${aboveCloud ? ' (구름 위, 강세)' : ''} — 단기 모멘텀 전환`,
          });
        }

        // 약세 크로스: 전환선이 기준선 하향 돌파
        if (prevDiff >= 0 && currDiff < 0) {
          const cloudBottom = (spanA[i] !== null && spanB[i] !== null)
            ? Math.min(spanA[i], spanB[i]) : null;
          const belowCloud = cloudBottom !== null && candles[i].close < cloudBottom;
          signals.push({
            type: 'ichimokuBearishCross',
            source: 'indicator',
            nameShort: '일목 약세 크로스',
            signal: 'sell',
            strength: belowCloud ? 'strong' : 'medium',
            confidence: belowCloud ? 72 : 65,
            index: i,
            time: candles[i].time,
            description: `전환선이 기준선 하향 돌파${belowCloud ? ' (구름 아래, 약세)' : ''} — 단기 모멘텀 약화`,
          });
        }
      }

      // ── 구름 돌파 (Cloud Breakout/Breakdown) ──
      if (spanA[i] !== null && spanB[i] !== null &&
          spanA[i - 1] !== null && spanB[i - 1] !== null) {

        const cloudTop     = Math.max(spanA[i], spanB[i]);
        const cloudBottom  = Math.min(spanA[i], spanB[i]);
        const prevCloudTop = Math.max(spanA[i - 1], spanB[i - 1]);
        const prevCloudBottom = Math.min(spanA[i - 1], spanB[i - 1]);

        // 상향 돌파: 이전 종가 ≤ 구름 상단, 현재 종가 > 구름 상단
        if (candles[i - 1].close <= prevCloudTop && candles[i].close > cloudTop) {
          signals.push({
            type: 'ichimokuCloudBreakout',
            source: 'indicator',
            nameShort: '일목 구름 상향 돌파',
            signal: 'buy',
            strength: 'strong',
            confidence: 70,
            index: i,
            time: candles[i].time,
            description: '종가가 일목 구름 상단 돌파 — 강한 상승 추세 전환 신호',
          });
        }

        // 하향 돌파: 이전 종가 ≥ 구름 하단, 현재 종가 < 구름 하단
        if (candles[i - 1].close >= prevCloudBottom && candles[i].close < cloudBottom) {
          signals.push({
            type: 'ichimokuCloudBreakdown',
            source: 'indicator',
            nameShort: '일목 구름 하향 돌파',
            signal: 'sell',
            strength: 'strong',
            confidence: 70,
            index: i,
            time: candles[i].time,
            description: '종가가 일목 구름 하단 이탈 — 강한 하락 추세 전환 신호',
          });
        }
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  7. 허스트 지수 레짐 필터
  // ══════════════════════════════════════════════════════

  /**
   * 허스트 지수(Hurst Exponent) 기반 시장 레짐 감지
   * - H > 0.6: 추세 지속 가능성 (trending regime)
   * - H < 0.4: 평균 회귀 가능성 (mean-reverting regime)
   * - 0.4 ≤ H ≤ 0.6: 랜덤워크 (시그널 없음)
   *
   * 시장 심리:
   *   허스트 지수는 시계열의 장기 의존성(long-range dependence)을 측정.
   *   H > 0.5는 과거 추세가 미래에도 지속될 확률이 높음을 의미하고,
   *   H < 0.5는 과거 상승 후 하락(또는 반대) 가능성이 높음을 의미.
   *   이는 매수/매도 방향이 아닌 "어떤 전략이 유효한가"의 레짐 필터.
   */
  _detectHurstSignal(candles, cache) {
    const signals = [];
    const H = cache.hurst();  // 단일 스칼라 값 (null 가능)
    if (H === null || H === undefined) return signals;

    // 마지막 캔들 인덱스에 레짐 시그널 배치 (전체 시계열 요약)
    const lastIdx = candles.length - 1;

    if (H > 0.6) {
      signals.push({
        type: 'hurstTrending',
        source: 'indicator',
        nameShort: '허스트 추세 레짐',
        signal: 'neutral',
        strength: 'weak',
        confidence: 55,
        index: lastIdx,
        time: candles[lastIdx].time,
        description: `허스트 지수 ${H.toFixed(2)} (>0.6) — 추세 지속 가능성 높음, 추세추종 전략 유리`,
      });
    } else if (H < 0.4) {
      signals.push({
        type: 'hurstMeanReverting',
        source: 'indicator',
        nameShort: '허스트 회귀 레짐',
        signal: 'neutral',
        strength: 'weak',
        confidence: 55,
        index: lastIdx,
        time: candles[lastIdx].time,
        description: `허스트 지수 ${H.toFixed(2)} (<0.4) — 평균 회귀 가능성 높음, 역추세 전략 유리`,
      });
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  범용 다이버전스 감지
  // ══════════════════════════════════════════════════════

  /**
   * 가격 vs 지표 다이버전스 감지 (MACD, RSI 공용)
   * @param {Array} candles — OHLCV
   * @param {Array} indicator — 지표값 배열 (macdLine 또는 rsi)
   * @param {string} name — 'macd' | 'rsi'
   * @param {number} lookback — 스윙 탐색 범위
   */
  _detectDivergence(candles, indicator, name, lookback = 20) {
    const signals = [];
    const swingOrder = 3; // 좌우 3봉 비교

    // 스윙 고점 찾기 (가격 기준)
    const swingHighs = [];
    const swingLows = [];

    for (let i = swingOrder; i < candles.length - swingOrder; i++) {
      if (indicator[i] === null) continue;

      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= swingOrder; j++) {
        if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
          isHigh = false;
        }
        if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
          isLow = false;
        }
      }

      if (isHigh) swingHighs.push(i);
      if (isLow)  swingLows.push(i);
    }

    // 강세 다이버전스: 가격 신저가 but 지표 상승
    for (let k = 1; k < swingLows.length; k++) {
      const prev = swingLows[k - 1];
      const curr = swingLows[k];

      if (curr - prev > lookback) continue;
      if (indicator[prev] === null || indicator[curr] === null) continue;

      if (candles[curr].low < candles[prev].low &&
          indicator[curr] > indicator[prev]) {
        const typePrefix = name === 'macd' ? 'macd' : 'rsi';
        signals.push({
          type: `${typePrefix}BullishDivergence`,
          source: 'indicator',
          nameShort: `${name.toUpperCase()} 강세 다이버전스`,
          signal: 'buy',
          strength: 'strong',
          confidence: 70,
          index: curr,
          time: candles[curr].time,
          description: `가격 신저가이나 ${name.toUpperCase()} 상승 — 하락세 약화, 반등 가능`,
        });
      }

      // 히든 강세 다이버전스: 가격 저점 상승 but 지표 저점 하락 → 추세 지속
      if (candles[curr].low > candles[prev].low &&
          indicator[curr] < indicator[prev]) {
        const typePrefix = name === 'macd' ? 'macd' : 'rsi';
        signals.push({
          type: `${typePrefix}HiddenBullishDivergence`,
          source: 'indicator',
          nameShort: `${name.toUpperCase()} 히든 강세 다이버전스`,
          signal: 'buy',
          strength: 'medium',
          confidence: 62,
          index: curr,
          time: candles[curr].time,
          description: `가격 고저점 상승이나 ${name.toUpperCase()} 하락 — 추세 지속 매수 신호`,
        });
      }
    }

    // 약세 다이버전스: 가격 신고가 but 지표 하락
    for (let k = 1; k < swingHighs.length; k++) {
      const prev = swingHighs[k - 1];
      const curr = swingHighs[k];

      if (curr - prev > lookback) continue;
      if (indicator[prev] === null || indicator[curr] === null) continue;

      if (candles[curr].high > candles[prev].high &&
          indicator[curr] < indicator[prev]) {
        const typePrefix = name === 'macd' ? 'macd' : 'rsi';
        signals.push({
          type: `${typePrefix}BearishDivergence`,
          source: 'indicator',
          nameShort: `${name.toUpperCase()} 약세 다이버전스`,
          signal: 'sell',
          strength: 'strong',
          confidence: 68,
          index: curr,
          time: candles[curr].time,
          description: `가격 신고가이나 ${name.toUpperCase()} 하락 — 상승세 약화, 하락 가능`,
        });
      }

      // 히든 약세 다이버전스: 가격 고점 하락 but 지표 고점 상승 → 추세 지속
      if (candles[curr].high < candles[prev].high &&
          indicator[curr] > indicator[prev]) {
        const typePrefix = name === 'macd' ? 'macd' : 'rsi';
        signals.push({
          type: `${typePrefix}HiddenBearishDivergence`,
          source: 'indicator',
          nameShort: `${name.toUpperCase()} 히든 약세 다이버전스`,
          signal: 'sell',
          strength: 'medium',
          confidence: 60,
          index: curr,
          time: candles[curr].time,
          description: `가격 고점 하락이나 ${name.toUpperCase()} 상승 — 추세 지속 매도 신호`,
        });
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  복합 시그널 매칭
  // ══════════════════════════════════════════════════════

  /**
   * 캔들 패턴 → type별 인덱스 맵 변환
   * @param {Array} candlePatterns — patternEngine.analyze() 결과
   * @returns {Map<string, Array<number>>} — type → [index, ...]
   */
  _buildCandleSignalMap(candlePatterns) {
    const map = new Map();
    for (const p of candlePatterns) {
      const idx = p.endIndex !== undefined ? p.endIndex : p.startIndex;
      if (idx === undefined) continue;
      if (!map.has(p.type)) map.set(p.type, []);
      map.get(p.type).push(idx);
    }
    return map;
  }

  /**
   * 복합 시그널 매칭
   * COMPOSITE_SIGNAL_DEFS의 required/optional 조건을 시간 윈도우 내 확인
   */
  _matchComposites(candles, indicatorSignals, candleSignalMap) {
    const composites = [];

    // 지표 시그널 → type별 인덱스 맵
    const indMap = new Map();
    for (const s of indicatorSignals) {
      if (!indMap.has(s.type)) indMap.set(s.type, []);
      indMap.get(s.type).push(s.index);
    }

    // 통합 맵 (캔들 + 지표)
    const allMap = new Map([...candleSignalMap]);
    for (const [type, indices] of indMap) {
      if (allMap.has(type)) {
        allMap.get(type).push(...indices);
      } else {
        allMap.set(type, [...indices]);
      }
    }

    for (const def of COMPOSITE_SIGNAL_DEFS) {
      // required 시그널 각각의 발생 인덱스 목록
      const requiredIndices = def.required.map(type => allMap.get(type) || []);

      // required 중 하나라도 비어있으면 스킵
      if (requiredIndices.some(arr => arr.length === 0)) continue;

      // 첫 번째 required의 각 인덱스를 기준점으로 윈도우 탐색
      for (const baseIdx of requiredIndices[0]) {
        const windowStart = baseIdx - def.window;
        const windowEnd   = baseIdx + def.window;

        // 나머지 required 시그널이 윈도우 내 존재하는지
        let allRequired = true;
        for (let r = 1; r < requiredIndices.length; r++) {
          const found = requiredIndices[r].some(
            idx => idx >= windowStart && idx <= windowEnd
          );
          if (!found) { allRequired = false; break; }
        }

        if (!allRequired) continue;

        // optional 보너스 계산
        let optionalCount = 0;
        for (const optType of (def.optional || [])) {
          const optIndices = allMap.get(optType) || [];
          if (optIndices.some(idx => idx >= windowStart && idx <= windowEnd)) {
            optionalCount++;
          }
        }

        const confidence = Math.min(
          95,
          def.baseConfidence + optionalCount * def.optionalBonus
        );
        // Dual Confidence: confidencePred = calibration 기반 예측 승률 (모델 입력용)
        // czw/data/composite_calibration.json 교정값 참조
        var _predMap = { strongBuy_hammerRsiVolume: 61, strongSell_shootingMacdVol: 69,
          buy_goldenCrossRsi: 58, sell_deadCrossMacd: 58,
          buy_bbBounceRsi: 55, sell_bbBreakoutRsi: 55 };
        var confidencePred = _predMap[def.id] != null
          ? Math.min(90, _predMap[def.id] + optionalCount * Math.round(def.optionalBonus * 0.6))
          : confidence;

        // 기준 인덱스 = 윈도우 내 가장 마지막 시그널
        const refIdx = Math.min(baseIdx + def.window, candles.length - 1);
        const actualIdx = Math.min(refIdx, candles.length - 1);

        // 중복 방지: 동일 compositeId가 ±window 범위에 이미 있으면 스킵
        const alreadyExists = composites.some(
          cs => cs.compositeId === def.id &&
                Math.abs(cs.index - actualIdx) <= def.window
        );
        if (alreadyExists) continue;

        composites.push({
          type: 'composite',
          compositeId: def.id,
          source: 'composite',
          nameShort: def.nameShort,
          signal: def.signal,
          strength: def.strength,
          confidence,
          confidencePred,
          tier: def.tier,
          index: actualIdx,
          time: candles[actualIdx].time,
          description: def.description +
            (optionalCount > 0 ? ` (보조 ${optionalCount}개 확인)` : ''),
          matchedRequired: [...def.required],
          matchedOptional: (def.optional || []).filter(optType => {
            const arr = allMap.get(optType) || [];
            return arr.some(idx => idx >= windowStart && idx <= windowEnd);
          }),
          marker: {
            time: candles[actualIdx].time,
            position: def.signal === 'buy' ? 'belowBar' : 'aboveBar',
            color: def.signal === 'buy' ? KRX_COLORS.UP : KRX_COLORS.DOWN,
            shape: def.signal === 'buy' ? 'arrowUp' : 'arrowDown',
            text: '',
          },
        });
      }
    }

    // tier 정렬 (높은 tier 우선)
    composites.sort((a, b) => a.tier - b.tier || a.index - b.index);

    return composites;
  }


  // ══════════════════════════════════════════════════════
  //  시장 심리 + 통계
  // ══════════════════════════════════════════════════════

  /**
   * 시장 심리 지표 계산
   * 매수/매도 시그널의 가중 비율로 -100~+100 산출
   */
  _calcStats(signals, candles) {
    if (!signals.length) return this._emptyStats();

    // 최근 20봉 내 시그널만 집계
    const recentWindow = 20;
    const lastIdx = candles.length - 1;
    const cutoff = lastIdx - recentWindow;

    let buyWeight = 0;
    let sellWeight = 0;
    let buyCount = 0;
    let sellCount = 0;
    let neutralCount = 0;

    const categoryCounts = {
      ma: 0, macd: 0, rsi: 0, bb: 0, volume: 0, ichimoku: 0, hurst: 0, composite: 0,
    };

    for (const s of signals) {
      // 카테고리 카운트 (전체)
      if (s.source === 'composite') {
        categoryCounts.composite++;
      } else {
        const cat = this._signalCategory(s.type);
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
      }

      // 심리 계산은 최근 봉만
      if (s.index < cutoff) continue;

      const w = this._weights[s.type] || 0;
      if (s.source === 'composite') {
        // 복합 시그널: tier별 가중치
        const tierWeight = s.tier === 1 ? 4 : s.tier === 2 ? 2.5 : 1.5;
        if (s.signal === 'buy')  buyWeight  += tierWeight;
        if (s.signal === 'sell') sellWeight += tierWeight;
      } else {
        if (w > 0) buyWeight  += w;
        if (w < 0) sellWeight += Math.abs(w);
      }

      if (s.signal === 'buy')  buyCount++;
      else if (s.signal === 'sell') sellCount++;
      else neutralCount++;
    }

    const totalWeight = buyWeight + sellWeight;
    const sentiment = totalWeight === 0 ? 0 :
      Math.round(((buyWeight - sellWeight) / totalWeight) * 100);

    return {
      sentiment: Math.max(-100, Math.min(100, sentiment)),
      sentimentLabel: this._sentimentLabel(sentiment),
      totalSignals: signals.length,
      recentBuy: buyCount,
      recentSell: sellCount,
      recentNeutral: neutralCount,
      categoryCounts,
    };
  }

  /**
   * 시그널 타입 → 카테고리 분류
   */
  _signalCategory(type) {
    if (type.startsWith('golden') || type.startsWith('dead') || type.startsWith('maAlignment')) return 'ma';
    if (type.startsWith('macd'))     return 'macd';
    if (type.startsWith('rsi'))      return 'rsi';
    if (type.startsWith('bb'))       return 'bb';
    if (type.startsWith('volume'))   return 'volume';
    if (type.startsWith('ichimoku')) return 'ichimoku';
    if (type.startsWith('hurst'))    return 'hurst';
    return 'ma'; // fallback
  }

  /**
   * 심리 지수 → 라벨
   */
  _sentimentLabel(sentiment) {
    if (sentiment >= 60)  return '강한 매수';
    if (sentiment >= 25)  return '매수 우세';
    if (sentiment > -25)  return '중립';
    if (sentiment > -60)  return '매도 우세';
    return '강한 매도';
  }

  /**
   * 빈 통계 객체
   */
  _emptyStats() {
    return {
      sentiment: 0,
      sentimentLabel: '중립',
      totalSignals: 0,
      recentBuy: 0,
      recentSell: 0,
      recentNeutral: 0,
      categoryCounts: { ma: 0, macd: 0, rsi: 0, bb: 0, volume: 0, ichimoku: 0, hurst: 0, composite: 0 },
    };
  }
}

// ── 전역 인스턴스 ─────────────────────────────────────
const signalEngine = new SignalEngine();
