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
    baseConfidence: 61, // [C-8] 82→61 calibrated (composite_calibration.json, hammer WR=47.9%)
    required: ['hammer', 'rsiOversoldExit'],
    optional: ['volumeBreakout'],
    optionalBonus: 5,
    window: 5,  // [D-Heuristic] 5봉(1거래주). Nison (1991): "수 세션 내 확인". 3→5 KRX 복합 수렴 테스트.
    description: '해머 캔들 + RSI 과매도 탈출 + 거래량 급증 — 바닥 반등 확률 높음',
  },
  {
    id: 'strongSell_shootingMacdVol',
    nameShort: '강력매도: 유성형+MACD+거래량',
    signal: 'sell',
    strength: 'strong',
    tier: 1,
    baseConfidence: 69, // [C-8] 80→69 calibrated (shootingStar WR=56.0%)
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
    baseConfidence: 58, // [C-8] 72→58 calibrated (composite_calibration.json)
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
    baseConfidence: 58, // [C-8] 70→58 calibrated (composite_calibration.json)
    required: ['deadCross'],
    optional: ['macdBearishCross', 'rsiOverboughtExit'],
    optionalBonus: 4,
    window: 5,  // [ACC] 3→5: 복합 시그널 수렴 시간 확대
    description: '데드크로스 + MACD/RSI 보조 확인 — 하락 추세 전환 신호',
  },

  // Tier 2 (CS-A): 패턴+지표 복합 — pattern_impl/03 Priority A (Nison 1991 + Bollinger 2001 + Murphy 1999)
  {
    id: 'buy_hammerBBVol',
    nameShort: '매수: 해머+BB하단+거래량',
    signal: 'buy',
    strength: 'medium',
    tier: 2,
    baseConfidence: 63, // [E-1] KRX 실측 WR×조건부배수 1.25 (tech-pattern-architect 권고)
    required: ['hammer', 'bbLowerBounce'],
    optional: ['volumeBreakout'],
    optionalBonus: 5,
    window: 5,
    description: '해머 + BB하단 반등 + 거래량 급증 — 볼린저 지지 + 반전 캔들 합류',
  },
  {
    id: 'sell_shootingStarBBVol',
    nameShort: '매도: 유성형+BB상단+거래량',
    signal: 'sell',
    strength: 'medium',
    tier: 2,
    baseConfidence: 69, // [E-1] shootingStar WR=56% × 1.25 조건부 배수
    required: ['shootingStar', 'bbUpperBreak'],
    optional: ['volumeSelloff'],
    optionalBonus: 5,
    window: 5,
    description: '유성형 + BB상단 돌파 + 투매 거래량 — 볼린저 저항 + 반전 캔들 합류',
  },
  {
    id: 'buy_morningStarRsiVol',
    nameShort: '매수: 샛별형+RSI+거래량',
    signal: 'buy',
    strength: 'medium',
    tier: 2,
    baseConfidence: 58, // [E-1] morningStar WR=42.9% but 3봉 구조적 강도 보정
    required: ['morningStar', 'rsiOversoldExit'],
    optional: ['volumeBreakout'],
    optionalBonus: 4,
    window: 5,
    description: '샛별형 3봉 반전 + RSI 과매도 탈출 + 거래량 — 바닥 확인 강도 높음',
  },
  {
    id: 'sell_eveningStarRsiVol',
    nameShort: '매도: 석별형+RSI+거래량',
    signal: 'sell',
    strength: 'medium',
    tier: 2,
    baseConfidence: 65, // [E-1] eveningStar WR=53.3% × KRX 약세 패턴 우위 반영
    required: ['eveningStar', 'rsiOverboughtExit'],
    optional: ['volumeSelloff'],
    optionalBonus: 4,
    window: 5,
    description: '석별형 3봉 반전 + RSI 과매수 탈출 + 투매 — 천장 확인 강도 높음',
  },

  // Tier 2 (CS-B): 패턴+지표 복합 — pattern_impl/03 Priority B
  {
    id: 'buy_engulfingMacdAlign',
    nameShort: '매수: 장악형+MACD+정배열',
    signal: 'buy',
    strength: 'medium',
    tier: 2,
    baseConfidence: 48, // [Audit] bullishEngulfing WR=41.3% → MACD조건부 추정 ~48%. 60은 +18.7pp 과대
    required: ['bullishEngulfing', 'macdBullishCross'],
    optional: ['maAlignment_bull'],
    optionalBonus: 4,
    window: 5,
    description: '상승장악형 + MACD 골든크로스 + MA 정배열 — 추세 전환 확인',
  },
  {
    id: 'sell_engulfingMacdAlign',
    nameShort: '매도: 장악형+MACD+역배열',
    signal: 'sell',
    strength: 'medium',
    tier: 2,
    baseConfidence: 66, // [E-4] bearishEngulfing WR=56.4% + MACD 조건부 배수
    required: ['bearishEngulfing', 'macdBearishCross'],
    optional: ['maAlignment_bear'],
    optionalBonus: 4,
    window: 5,
    description: '하락장악형 + MACD 데드크로스 + MA 역배열 — 하락 전환 확인',
  },
  {
    id: 'buy_doubleBottomNeckVol',
    nameShort: '매수: 이중바닥+거래량',
    signal: 'buy',
    strength: 'strong',
    tier: 1,
    baseConfidence: 68, // [S-5] doubleBottom WR=62.1% + vol 조건부 ~68% (72→68 캘리브레이션)
    required: ['doubleBottom', 'volumeBreakout'],
    optional: ['goldenCross'],
    optionalBonus: 5,
    window: 5,
    description: '이중바닥 완성 + 거래량 급증 + 골든크로스 — 강력한 바닥 확인',
  },
  {
    id: 'sell_doubleTopNeckVol',
    nameShort: '매도: 이중천장+거래량',
    signal: 'sell',
    strength: 'strong',
    tier: 1,
    baseConfidence: 75, // [E-4] doubleTop WR=73.0% × 구조적 강도
    required: ['doubleTop', 'volumeSelloff'],
    optional: ['deadCross'],
    optionalBonus: 5,
    window: 5,
    description: '이중천장 완성 + 투매 거래량 + 데드크로스 — 강력한 천장 확인',
  },
  {
    id: 'buy_ichimokuTriple',
    nameShort: '매수: 일목삼역호전',
    signal: 'buy',
    strength: 'strong',
    tier: 1,
    baseConfidence: 70, // [E-4] 일목균형표 3조건 동시 — Hosoda 원전 기반
    // [Phase TA-2][B-1] measuredWR: 백테스트 미측정. Hosoda 원전 WR=65~75% 추정 (삼역호전 동시).
    // KRX 실측 WR 확보 시 baseConfidence 재교정 필요. 현재는 이론 기반 추정치 사용.
    measuredWR: null, // 백테스트 데이터 확보 후 갱신 예정
    required: ['ichimokuCloudBreakout', 'ichimokuBullishCross'],
    optional: ['volumeBreakout'],
    optionalBonus: 4,
    window: 5,
    description: '구름 돌파 + 전환/기준선 교차 + 거래량 — 일목 삼역호전',
  },
  {
    id: 'sell_ichimokuTriple',
    nameShort: '매도: 일목삼역역전',
    signal: 'sell',
    strength: 'strong',
    tier: 1,
    baseConfidence: 70, // [E-4] 일목균형표 3조건 동시 (역방향)
    // [Phase TA-2][B-1] measuredWR: 백테스트 미측정. Hosoda 원전 WR=65~75% 추정 (삼역역전 동시).
    // KRX 실측 WR 확보 시 baseConfidence 재교정 필요. 현재는 이론 기반 추정치 사용.
    measuredWR: null, // 백테스트 데이터 확보 후 갱신 예정
    required: ['ichimokuCloudBreakdown', 'ichimokuBearishCross'],
    optional: ['volumeSelloff'],
    optionalBonus: 4,
    window: 5,
    description: '구름 하향 이탈 + 전환/기준선 역교차 + 투매 — 일목 삼역역전',
  },
  {
    id: 'buy_goldenMarubozuVol',
    nameShort: '매수: 골든+마루보주+거래량',
    signal: 'buy',
    strength: 'strong',
    tier: 1,
    baseConfidence: 65, // [E-4] goldenCross + 마루보주 동시 = 강한 추세 시작
    required: ['goldenCross', 'bullishMarubozu'],
    optional: ['volumeBreakout'],
    optionalBonus: 5,
    window: 5,
    description: '골든크로스 + 양봉 마루보주 + 거래량 급증 — 추세 시작 강력 확인',
  },
  {
    id: 'sell_deadMarubozuVol',
    nameShort: '매도: 데드+마루보주+거래량',
    signal: 'sell',
    strength: 'strong',
    tier: 1,
    baseConfidence: 68, // [E-4] deadCross + 음봉 마루보주 = 강한 하락 시작
    required: ['deadCross', 'bearishMarubozu'],
    optional: ['volumeSelloff'],
    optionalBonus: 5,
    window: 5,
    description: '데드크로스 + 음봉 마루보주 + 투매 거래량 — 하락 추세 강력 확인',
  },

  // Tier 3: 약한 시그널 (단일 조건 + 보조)
  {
    id: 'buy_bbBounceRsi',
    nameShort: '매수: BB반등+RSI',
    signal: 'buy',
    strength: 'weak',
    tier: 3,
    baseConfidence: 55, // [C-8] 60→55 calibrated (composite_calibration.json)
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
    baseConfidence: 55, // [C-8] 58→55 calibrated (composite_calibration.json)
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
      // StochRSI (RSI 중립대 보조 — Chande & Kroll 1994)
      stochRsiOversold: 1.0, stochRsiOverbought: -1.0,
      // Stochastic (Lane 1984 — Slow %K/%D cross, RSI와 측정대상 상이)
      stochasticOversold: 1.5, stochasticOverbought: -1.5,
      // 허스트 지수 (레짐 필터 — 방향 중립)
      hurstTrending: 0, hurstMeanReverting: 0,
      // 칼만 필터 (composite condition 전용 — A. Harvey 1989, 독립 시그널 아님)
      kalmanUpturn: 0, kalmanDownturn: 0,
      // 거래량
      volumeBreakout: 2, volumeSelloff: -2, volumeExhaustion: 0,
      // [Phase TA-2] OBV 다이버전스 — Granville (1963): 가격-거래량 괴리
      obvBullishDivergence: 2.5, obvBearishDivergence: -2.5,
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
    // [M-3 FIX] ADV level computed once here, shared with _detectVolumeSignals and stats below
    var _sharedAdvResult = this.calcADVLevel(candles, 60);
    indicatorSignals.push(...this._detectVolumeSignals(candles, cache, _sharedAdvResult));
    indicatorSignals.push(...this._detectOBVDivergence(candles, cache)); // [Phase TA-2][N-1] OBV 다이버전스
    indicatorSignals.push(...this._detectIchimokuSignals(candles, cache));
    indicatorSignals.push(...this._detectHurstSignal(candles, cache));
    indicatorSignals.push(...this._detectStochRSISignals(candles, cache));
    indicatorSignals.push(...this._detectStochasticSignals(candles, cache));
    indicatorSignals.push(...this._detectKalmanSignals(candles, cache));

    // 캔들 패턴 → 시그널 타입 맵 (복합 매칭용)
    const candleSignalMap = this._buildCandleSignalMap(candlePatterns);

    // 복합 시그널 매칭
    const compositeSignals = this._matchComposites(
      candles, indicatorSignals, candleSignalMap
    );

    // 전체 시그널 병합 (지표 + 복합, 캔들 패턴은 이미 patterns.js에서 관리)
    const signals = [...indicatorSignals, ...compositeSignals];

    // [Phase0-B] 후처리 전 base confidence 스냅샷 — 누적 조정 상한 ±15 적용용
    for (let si = 0; si < signals.length; si++) {
      signals[si]._baseConf = signals[si].confidence;
    }

    // ADX 트렌드 필터 — Wilder (1978): 트렌드 추종 시그널 confidence 후조정
    this._applyADXFilter(signals, cache);
    // CCI 레짐 필터 — Lambert (1980): |CCI| 기반 추세/횡보 판별 (ADX와 직교)
    this._applyCCIFilter(signals, cache);

    // [Expert Consensus] CUSUM breakpoint discount — Page (1954), Roberts (1966)
    this._applyCUSUMDiscount(signals, candles, cache);

    // [Expert Consensus] Binary Segmentation regime discount — Bai & Perron (1998)
    this._applyBinSegDiscount(signals, candles, cache);

    // OLS 추세 확인 → 순방향 confidence boost — Lo & MacKinlay (1999)
    // R² > 0.50 = 강한 추세: 추세 방향 시그널에 +5 boost
    // [Phase0-B] OLS 상한 95→90 통일: ADX/CCI와 동일 상한 적용
    const olsTrend = cache.olsTrend(20);
    if (olsTrend && olsTrend.r2 > 0.50) {
      const trendDir = olsTrend.direction; // 'up', 'down', 'flat'
      for (let si = 0; si < signals.length; si++) {
        const s = signals[si];
        if (trendDir === 'up' && s.signal === 'buy') {
          s.confidence = Math.min(90, (s.confidence || 50) + 5);
        } else if (trendDir === 'down' && s.signal === 'sell') {
          s.confidence = Math.min(90, (s.confidence || 50) + 5);
        }
      }
    }

    // [Phase0-B] 누적 조정 상한 ±15 — ADX+CCI+OLS 스택 인플레이션 방지
    // [D-Heuristic] ADX(Wilder 1978)/CCI(Lambert 1980)/OLS는 부분 상관 추세 지표.
    // 가산 boost는 독립성을 가정하나 이론적 정당화 부족. 15pt cap → 최대 ~15% 신뢰도 이동.
    const MAX_CUMULATIVE_ADJ = 15;
    for (let si = 0; si < signals.length; si++) {
      const s = signals[si];
      if (s._baseConf != null) {
        const delta = s.confidence - s._baseConf;
        if (delta > MAX_CUMULATIVE_ADJ) {
          s.confidence = s._baseConf + MAX_CUMULATIVE_ADJ;
        } else if (delta < -MAX_CUMULATIVE_ADJ) {
          s.confidence = s._baseConf - MAX_CUMULATIVE_ADJ;
        }
        s.confidence = Math.max(10, Math.min(90, s.confidence));
        delete s._baseConf;
      }
    }

    // 시간순 정렬
    signals.sort((a, b) => a.index - b.index);

    // 시장 심리 계산
    const stats = this._calcStats(signals, candles);

    // [P2-11] entropy 감쇄: sqrt 기반 점진적 회복 — Shannon (1948)
    // 기존: 선형 [0.85, 1.0] at entropyNorm < 0.5 (0.5 이상 무효과)
    // 개선: sqrt 감쇄 [0.80, 1.0] — 전 구간 적용, 다양성 높으면 빠르게 회복
    //   entropyNorm=0→0.80, 0.25→0.90, 0.50→0.94, 1.0→1.0
    if (signals.length > 2 && stats.entropyNorm < 1.0) {
      const scale = 0.80 + 0.20 * Math.sqrt(Math.max(0, stats.entropyNorm));
      for (let si = 0; si < signals.length; si++) {
        if (signals[si].confidence) {
          signals[si].confidence = Math.max(10, Math.round(signals[si].confidence * scale));
        }
      }
    }

    // [Phase TA-3 C-2] VKOSPI/VIX → HMM fallback chain (Doc26 §2)
    // Priority: 1) VKOSPI (KRX 자체 변동성지수, 미구현 시 null)
    //           2) VIX × 1.1 proxy (VKOSPI ≈ VIX × 1.1 for KRX, Whaley 2009)
    //           3) HMM regime (기존 hmm_regimes.json 데이터)
    // 레짐별 신호 할인: crisis→0.65, high→0.80, normal→1.0, low→1.0
    var _vkospiRegime = SignalEngine._classifyVolRegimeFromVKOSPI();
    var _appliedVolDiscount = false;

    if (_vkospiRegime !== null) {
      // VKOSPI/VIX 기반 레짐 할인 — Whaley (2000), Carr & Wu (2009)
      var volScale = 1.0;
      if (_vkospiRegime === 'crisis') volScale = 0.65;       // VIX>35: 극단적 불확실성
      else if (_vkospiRegime === 'high') volScale = 0.80;    // VIX 25-35: 고변동
      // normal/low: no discount
      if (volScale < 1.0) {
        for (var vi = 0; vi < signals.length; vi++) {
          if (signals[vi].confidence) {
            signals[vi].confidence = Math.max(10, Math.round(signals[vi].confidence * volScale));
          }
        }
        _appliedVolDiscount = true;
      }
    }

    // HMM fallback: VKOSPI/VIX 미가용 시에만 적용 (이중 할인 방지)
    if (!_appliedVolDiscount) {
      var _hmmBeh = (typeof backtester !== 'undefined' && backtester._behavioralData
        && backtester._behavioralData['hmm_regimes']) ? backtester._behavioralData['hmm_regimes'] : null;
      if (_hmmBeh && _hmmBeh.daily && _hmmBeh.daily.length > 0) {
        var _lastR = _hmmBeh.daily[_hmmBeh.daily.length - 1];
        if (_lastR && _lastR.bull_prob != null) {
          var bull_prob = _lastR.bull_prob;
          // [H-1 FIX] Directional HMM discount — regime-confirming signals unpenalized,
          // counter-trend signals discounted. bull_prob>0.5=bullish, <0.5=bearish.
          var counterScale = bull_prob > 0.5
            ? 0.70 + 0.30 * (1 - bull_prob)   // bullish regime: sell penalty
            : 0.70 + 0.30 * bull_prob;         // bearish regime: buy penalty
          for (var vi = 0; vi < signals.length; vi++) {
            if (signals[vi].confidence) {
              var isBuy = signals[vi].signal === 'buy';
              var regimeConfirms = (bull_prob > 0.5 && isBuy) || (bull_prob <= 0.5 && !isBuy);
              var vs = regimeConfirms ? 1.0 : counterScale;
              signals[vi].confidence = Math.max(10, Math.round(signals[vi].confidence * vs));
            }
          }
        }
      }
    }

    // ── ADV Level Multiplier — Katz & Shapiro (1985) 네트워크 외부성 ──
    // 유동성(거래대금) 등급별 패턴 신뢰도 승수 (정보 전달용, 실제 적용은 renderer/app)
    // [M-3 FIX] Reuse _sharedAdvResult computed above (avoid duplicate calcADVLevel)
    var advResult = _sharedAdvResult;
    stats.advLevel = advResult.level;
    stats.advMultiplier = advResult.multiplier;
    stats.categoryCounts.adv = advResult.level; // 등급을 카운트 필드에 기록

    // ── VolRegime Signal — Carr & Wu (2009) 변동성 위험 프리미엄 ──
    // [Phase0-#6] VRP→VolRegime 리네임 + multiplier 확대 [0.85,1.15]
    var volRegimeResult = this.calcVolRegime(candles, cache);
    stats.volRegime = volRegimeResult.regime;
    stats.volRegimeMultiplier = volRegimeResult.multiplier;
    stats.categoryCounts.volRegime = volRegimeResult.regime === 'neutral' ? 0 : 1; // 비중립 = 활성

    return { signals, cache, stats };
  }

  // ══════════════════════════════════════════════════════
  //  [D-Heuristic] S/R proximity boost: factor=8 is empirical (not derived from prospect theory)
  //  지지선 근처 반전(buy) 시그널 강화, 저항선 근처 매도 시그널 강화
  //  호출: app.js에서 S/R 가용 시 선택적 적용 (analyze 시그니처 불변)
  // ══════════════════════════════════════════════════════

  applySRProximityBoost(signals, candles, srLevels, cache) {
    if (!srLevels || srLevels.length === 0 || !cache) return;
    var atrArr = cache.atr(14);
    var lastATR = atrArr && atrArr.length > 0 ? atrArr[atrArr.length - 1] : null;
    if (!lastATR || lastATR <= 0) return;
    for (var pi = 0; pi < signals.length; pi++) {
      var sig = signals[pi];
      if (sig.index >= candles.length) continue;
      var sigPrice = candles[sig.index].close;

      // Buy-side: support proximity boost (factor=8)
      if (sig.signal === 'buy') {
        for (var si = 0; si < srLevels.length; si++) {
          var sr = srLevels[si];
          if (sr.type !== 'support') continue;
          var dist = Math.abs(sigPrice - sr.price) / lastATR;
          if (dist < 1.0) {
            var boost = Math.round(8 * Math.max(0, 1 - dist) * Math.min(sr.strength || 1, 2) / 2);
            sig.confidence = Math.min(90, sig.confidence + boost);
            break;
          }
        }
      }

      // Sell-side: resistance proximity boost (factor=5, weaker than buy-side)
      // Asymmetry rationale: support bounces are stronger reversal signals than resistance rejections
      if (sig.signal === 'sell') {
        for (var si = 0; si < srLevels.length; si++) {
          var sr = srLevels[si];
          if (sr.type !== 'resistance') continue;
          var dist = Math.abs(sigPrice - sr.price) / lastATR;
          if (dist < 1.0) {
            var boost = Math.round(5 * Math.max(0, 1 - dist) * Math.min(sr.strength || 1, 2) / 2);
            sig.confidence = Math.min(90, sig.confidence + boost);
            break;
          }
        }
      }
    }
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
          // [Phase TA-2][B-3] measuredWR: 백테스트 미측정. Murphy (1999): MA 정배열은
          // 추세 확인 지표로 단독 WR보다 복합 시그널 필터 역할이 핵심.
          // KRX 실측 WR 확보 시 confidence 재교정 필요.
          measuredWR: null, // 백테스트 데이터 확보 후 갱신 예정
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
          // [Phase TA-2][B-3] measuredWR: 백테스트 미측정. Murphy (1999): MA 역배열은
          // 하락 추세 확인 필터. 단독 매도보다 MACD/RSI 복합 시 유효성 상승.
          // KRX 실측 WR 확보 시 confidence 재교정 필요.
          measuredWR: null, // 백테스트 데이터 확보 후 갱신 예정
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
    var hurstObj = cache.hurst();
    const H = hurstObj ? hurstObj.H : null;
    const hurstR2 = hurstObj ? hurstObj.rSquared : null;
    // [Hurst R² quality gate] R/S 회귀 품질이 낮으면 Hurst 영향 축소
    const hurstQuality = (hurstR2 !== null && hurstR2 < 0.70) ? hurstR2 / 0.70 : 1.0;
    const hBase = (H !== null && H !== undefined && !isNaN(H))
      ? Math.round((65 - 20 * Math.max(0, Math.min(1, (H - 0.4) / 0.2))) * hurstQuality + 55 * (1 - hurstQuality))
      : 55;  // H 없으면 기본 55
    // hBase: R²≥0.70 → H=0.4→65, H=0.5→55, H=0.6→45 (선형 보간)
    //        R²<0.70 → neutral(55)로 블렌딩 (예: R²=0.35 → 50% Hurst + 50% neutral)
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
    // [Phase I] EVT-aware BB — Gopikrishnan (1999), core_data/12 §7.1
    // Hill alpha < 4 (heavy tail) → BB 밴드 자동 확대, 거짓 돌파 감소
    const bb = (typeof cache.bbEVT === 'function') ? cache.bbEVT(20, 2) : cache.bb(20, 2);

    for (let i = 1; i < candles.length; i++) {
      if (bb[i].upper === null || bb[i - 1].upper === null ||
          bb[i].lower === null || bb[i - 1].lower === null) continue;

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

      // [Phase1-FIX] Bollinger (2001) 표준: bandwidth percentile 기반 squeeze 판정
      // 기존 "최소값의 2배" → lookback 구간 내 백분위 정렬
      const widths = [];
      for (let j = i - lookback; j < i; j++) {
        if (bb[j].upper === null) continue;
        const w = bb[j].upper - bb[j].lower;
        if (w > 0) widths.push(w);
      }

      if (widths.length < 10) continue;
      widths.sort((a, b) => a - b);
      const pct10 = widths[Math.floor(widths.length * 0.10)];  // 하위 10% 임계

      // Squeeze 후 Breakout: 이전 봉이 하위 10% squeeze → 현재 확산
      if (i > 0 && bb[i - 1].upper !== null) {
        const prevWidth = bb[i - 1].upper - bb[i - 1].lower;
        if (prevWidth <= pct10 && currWidth >= pct10 * 2) {
          const c = candles[i];
          // [Phase1-FIX] 방향 확인 강화: 단일 봉 양/음봉 + 밴드 돌파 방향
          const aboveUpper = c.close > bb[i].upper;
          const belowLower = c.close < bb[i].lower;
          const bullish = aboveUpper || (!belowLower && c.close > c.open);
          // [A-4] squeeze 지속기간 측정 — Bollinger (2001): 장기 squeeze 후 breakout이 더 강력
          let squeezeBars = 0;
          for (let j = i - 1; j >= Math.max(0, i - 50); j--) {
            if (bb[j] && bb[j].upper !== null) {
              const w = bb[j].upper - bb[j].lower;
              if (w <= pct10) squeezeBars++;
              else break;
            } else break;
          }
          const durBoost = squeezeBars >= 20 ? 8 : squeezeBars >= 10 ? 4 : 0;
          // 밴드 돌파 시 confidence 상향
          const conf = Math.min(90, ((aboveUpper || belowLower) ? 72 : 64) + durBoost);
          signals.push({
            type: 'bbSqueeze',
            source: 'indicator',
            nameShort: 'BB 스퀴즈 브레이크아웃',
            signal: bullish ? 'buy' : 'sell',
            strength: (aboveUpper || belowLower) ? 'strong' : 'medium',
            confidence: conf,
            index: i,
            time: c.time,
            description: `볼린저 밴드 ${squeezeBars}봉 수렴 후 확산 — ${bullish ? '상승' : '하락'} 방향 변동성 확대`,
          });
        }
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  5. 거래량 시그널
  // ══════════════════════════════════════════════════════

  _detectVolumeSignals(candles, cache, advResultParam) {
    const signals = [];
    // C-6 CZW: z-score 기반 동적 임계 (Ane & Geman 2000, 로그정규분포)
    // 대형주/소형주 거래량 분포 차이를 자동 보정
    const zThreshold = 2.0;  // z >= 2.0 = 상위 2.28% (정규분포)

    // [A-3][M-3 FIX] ADV 레벨 — analyze()에서 전달받거나 fallback 계산
    const advResult = advResultParam || this.calcADVLevel(candles, 60);
    const advLevel = advResult.level;  // 0=<1억, 1=<10억, 2=<100억, 3=>=100억

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

      // [A-3] ADV 레벨 기반 confidence 조정 — 극소형 유동성 부족 잡음 감산
      const advAdj = advLevel === 0 ? -5 : advLevel === 1 ? -2 : 0;

      // 거래량 급증 + 가격 상승 = 돌파 확인
      if (zVol >= zThreshold && priceUp) {
        signals.push({
          type: 'volumeBreakout',
          source: 'indicator',
          nameShort: '거래량 돌파 확인',
          signal: 'buy',
          strength: zVol >= 3.0 ? 'strong' : 'medium',
          confidence: Math.max(40, buyConf + advAdj),
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
          confidence: Math.max(40, sellConf + advAdj),
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
        // [M-1 fix] 후향적 중복 방지: 이전 시그널이 i-1이면 교체 (lookahead 제거)
        // 연속 감소 구간에서 마지막 봉만 유지 — 미래 데이터 참조 없이 동일 효과
        if (signals.length > 0 && signals[signals.length - 1].index === i - 1) {
          signals.pop();
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
  //  5-B. OBV 다이버전스 시그널 — Granville (1963), Murphy (1999)
  //  [Phase TA-2][N-1]
  //
  //  시장 심리:
  //    OBV(On-Balance Volume)는 "거래량은 가격에 선행한다"는 Granville 가설 기반.
  //    가격과 OBV의 괴리(다이버전스)는 스마트머니의 축적/분배를 포착:
  //    - 강세 다이버전스: 가격은 신저점 but OBV는 더 높은 저점
  //      → 기관/스마트머니가 하락 중 축적 (매집). 바닥 반전 가능.
  //    - 약세 다이버전스: 가격은 신고점 but OBV는 더 낮은 고점
  //      → 상승 중 거래량 이탈, 추종 매수 약화. 천장 반전 경고.
  //
  //  참고: Granville (1963) "New Key to Stock Market Profits"
  //        Murphy (1999) "Technical Analysis of the Financial Markets" Ch.7
  // ══════════════════════════════════════════════════════

  _detectOBVDivergence(candles, cache) {
    const signals = [];
    if (candles.length < 30) return signals;

    const obv = cache.obv();
    if (!obv || obv.length < 30) return signals;

    const closes = cache.closes;
    const lookback = 20; // 스윙 포인트 탐색 범위 (약 1거래월)

    // 스윙 포인트 탐색: 좌우 3봉 대비 극값 (Zigzag 단순화)
    // NOTE: OBV swing uses 3-bar future confirmation (look-ahead). Signal index at swing, not confirmation bar.
    // This is consistent with _detectDivergence() behavior (see line ~1739).
    // [Phase TA-2] swingOrder=3: 너무 작으면 잡음, 너무 크면 놓침
    const swingOrder = 3;
    const swingLows = [];
    const swingHighs = [];

    for (let i = swingOrder; i < candles.length - swingOrder; i++) {
      let isLow = true, isHigh = true;
      for (let j = 1; j <= swingOrder; j++) {
        if (closes[i] >= closes[i - j] || closes[i] >= closes[i + j]) isLow = false;
        if (closes[i] <= closes[i - j] || closes[i] <= closes[i + j]) isHigh = false;
      }
      if (isLow) swingLows.push(i);
      if (isHigh) swingHighs.push(i);
    }

    // 강세 OBV 다이버전스: 최근 lookback 내 두 저점 비교
    // 가격 lower low + OBV higher low = 축적 중
    for (let si = swingLows.length - 1; si >= 1; si--) {
      const curr = swingLows[si];
      const prev = swingLows[si - 1];
      if (curr - prev > lookback) continue;
      if (curr < candles.length - lookback - swingOrder) continue; // 최근 범위만

      if (closes[curr] < closes[prev] && obv[curr] > obv[prev]) {
        // 가격은 낮아졌지만 OBV는 높아짐 → 강세 다이버전스
        const atrArr = cache.atr(14);
        const atrVal = atrArr[curr] || (closes[curr] * 0.02);
        const priceGapATR = Math.abs(closes[prev] - closes[curr]) / atrVal;
        // confidence: ATR 정규화된 가격 괴리 기반 (0.5 ATR → 55, 1.0 ATR → 62, 2.0 ATR → 69)
        const conf = Math.min(75, Math.round(50 + 12 * Math.log(Math.max(priceGapATR, 0.5) + 0.5)));

        signals.push({
          type: 'obvBullishDivergence',
          source: 'indicator',
          nameShort: 'OBV 강세 다이버전스',
          signal: 'buy',
          strength: priceGapATR >= 1.0 ? 'strong' : 'medium',
          confidence: conf,
          index: curr,
          time: candles[curr].time,
          description: `가격 신저점 but OBV 상승 — 스마트머니 축적 감지 (괴리 ${priceGapATR.toFixed(1)} ATR)`,
        });
        break; // 가장 최근 하나만
      }
    }

    // 약세 OBV 다이버전스: 최근 lookback 내 두 고점 비교
    // 가격 higher high + OBV lower high = 분배 중
    for (let si = swingHighs.length - 1; si >= 1; si--) {
      const curr = swingHighs[si];
      const prev = swingHighs[si - 1];
      if (curr - prev > lookback) continue;
      if (curr < candles.length - lookback - swingOrder) continue; // 최근 범위만

      if (closes[curr] > closes[prev] && obv[curr] < obv[prev]) {
        // 가격은 높아졌지만 OBV는 낮아짐 → 약세 다이버전스
        const atrArr = cache.atr(14);
        const atrVal = atrArr[curr] || (closes[curr] * 0.02);
        const priceGapATR = Math.abs(closes[curr] - closes[prev]) / atrVal;
        const conf = Math.min(73, Math.round(48 + 12 * Math.log(Math.max(priceGapATR, 0.5) + 0.5)));

        signals.push({
          type: 'obvBearishDivergence',
          source: 'indicator',
          nameShort: 'OBV 약세 다이버전스',
          signal: 'sell',
          strength: priceGapATR >= 1.0 ? 'strong' : 'medium',
          confidence: conf,
          index: curr,
          time: candles[curr].time,
          description: `가격 신고점 but OBV 하락 — 스마트머니 분배 감지 (괴리 ${priceGapATR.toFixed(1)} ATR)`,
        });
        break; // 가장 최근 하나만
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

    const { tenkan, kijun, spanA, spanB, chikou } = ich;

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

        // [A-2] Hosoda 후행스팬(chikou) 확인: chikou[i] vs candles[i-26].close
        // 삼역호전 완성 시 confidence +5 (Hosoda 원전: 3역 동시 충족이 최강 신호)
        const chikouConfirm = chikou && i >= 26 && chikou[i] != null
          ? (chikou[i] > candles[i - 26].close ? 'bull' : chikou[i] < candles[i - 26].close ? 'bear' : null)
          : null;

        // 상향 돌파: 이전 종가 ≤ 구름 상단, 현재 종가 > 구름 상단
        if (candles[i - 1].close <= prevCloudTop && candles[i].close > cloudTop) {
          const chikouBoost = chikouConfirm === 'bull' ? 5 : 0;
          signals.push({
            type: 'ichimokuCloudBreakout',
            source: 'indicator',
            nameShort: '일목 구름 상향 돌파',
            signal: 'buy',
            strength: 'strong',
            confidence: 70 + chikouBoost,
            index: i,
            time: candles[i].time,
            description: `종가가 일목 구름 상단 돌파${chikouBoost ? ' + 후행스팬 확인 (삼역호전)' : ''} — 강한 상승 추세 전환 신호`,
          });
        }

        // 하향 돌파: 이전 종가 ≥ 구름 하단, 현재 종가 < 구름 하단
        if (candles[i - 1].close >= prevCloudBottom && candles[i].close < cloudBottom) {
          const chikouBoost = chikouConfirm === 'bear' ? 5 : 0;
          signals.push({
            type: 'ichimokuCloudBreakdown',
            source: 'indicator',
            nameShort: '일목 구름 하향 돌파',
            signal: 'sell',
            strength: 'strong',
            confidence: 70 + chikouBoost,
            index: i,
            time: candles[i].time,
            description: `종가가 일목 구름 하단 이탈${chikouBoost ? ' + 후행스팬 확인 (삼역역전)' : ''} — 강한 하락 추세 전환 신호`,
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
    var hurstObj = cache.hurst();  // { H, rSquared } 또는 null
    const H = hurstObj ? hurstObj.H : null;
    if (H === null || H === undefined) return signals;

    const hurstR2 = hurstObj ? hurstObj.rSquared : null;
    // [Hurst R² gate] R/S 회귀가 불안정하면 레짐 시그널 발생하지 않음
    if (hurstR2 !== null && hurstR2 < 0.50) return signals;

    // R² 0.50-0.70: confidence 비례 축소 / R² ≥ 0.70: 전체 confidence
    var rQual = (hurstR2 !== null && hurstR2 < 0.70) ? (hurstR2 / 0.70) : 1.0;

    // 마지막 캔들 인덱스에 레짐 시그널 배치 (전체 시계열 요약)
    const lastIdx = candles.length - 1;

    if (H > 0.6) {
      signals.push({
        type: 'hurstTrending',
        source: 'indicator',
        nameShort: '허스트 추세 레짐',
        signal: 'neutral',
        strength: 'weak',
        confidence: Math.round(55 * rQual),
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
        confidence: Math.round(55 * rQual),
        index: lastIdx,
        time: candles[lastIdx].time,
        description: `허스트 지수 ${H.toFixed(2)} (<0.4) — 평균 회귀 가능성 높음, 역추세 전략 유리`,
      });
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  8. StochRSI 시그널 (RSI 중립대 보조)
  //  Chande & Kroll (1994): RSI 30-70 밖에서는 RSI 자체가 시그널,
  //  40-60 중립대에서 StochRSI 극값이 미세 모멘텀 포착
  // ══════════════════════════════════════════════════════

  _detectStochRSISignals(candles, cache) {
    const signals = [];
    const rsi = cache.rsi(14);
    const { k: stochK } = cache.stochRsi(14, 3, 3, 14);
    if (!stochK) return signals;

    const COOLDOWN = 5; // 동일 방향 최소 간격 (whipsaw 방지)
    let lastBuyIdx = -COOLDOWN;
    let lastSellIdx = -COOLDOWN;

    for (let i = 1; i < candles.length; i++) {
      if (rsi[i] === null || stochK[i] === null) continue;

      // RSI 40-60 중립대 조건 — RSI가 이미 시그널을 내는 구간은 제외 (이중 카운트 방지)
      if (rsi[i] < 40 || rsi[i] > 60) continue;

      // StochRSI K < 10 → 과매도 (매수 보조)
      if (stochK[i] < 10 && (i - lastBuyIdx) >= COOLDOWN) {
        const extremeBonus = Math.floor(Math.max(0, 10 - stochK[i]) / 2); // 0~5
        signals.push({
          type: 'stochRsiOversold',
          source: 'indicator',
          nameShort: 'StochRSI 과매도',
          signal: 'buy',
          strength: 'weak',
          confidence: Math.min(55, 48 + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)}) 중립대에서 StochRSI K(${stochK[i].toFixed(1)}) 극저 — 단기 반등 가능`,
        });
        lastBuyIdx = i;
      }

      // StochRSI K > 90 → 과매수 (매도 보조)
      if (stochK[i] > 90 && (i - lastSellIdx) >= COOLDOWN) {
        const extremeBonus = Math.floor(Math.max(0, stochK[i] - 90) / 2); // 0~5
        signals.push({
          type: 'stochRsiOverbought',
          source: 'indicator',
          nameShort: 'StochRSI 과매수',
          signal: 'sell',
          strength: 'weak',
          confidence: Math.min(55, 48 + extremeBonus),
          index: i,
          time: candles[i].time,
          description: `RSI(${rsi[i].toFixed(1)}) 중립대에서 StochRSI K(${stochK[i].toFixed(1)}) 극고 — 단기 조정 가능`,
        });
        lastSellIdx = i;
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  Stochastic Oscillator 시그널 — Lane (1984), Murphy (1999)
  //  Slow Stochastic (14,3,3) %K/%D 교차 기반 모멘텀 반전 탐지
  //
  //  RSI와의 차별화:
  //   - RSI: 가격 변동폭의 상대강도 (Wilder 1978)
  //   - Stochastic: 거래범위 내 종가 위치 (Lane 1984)
  //   → 측정 대상이 다르므로 독립 시그널로 유효
  //
  //  Williams %R 컨플루언스:
  //   %R = -(100 - Raw %K) — 수학적 동치이므로 독립 시그널이 아닌
  //   확인 보너스(+3)로만 활용 (이중 카운트 방지)
  // ══════════════════════════════════════════════════════

  _detectStochasticSignals(candles, cache) {
    const signals = [];
    const { k, d } = cache.stochastic(14, 3, 3);
    if (!k || !d) return signals;

    // Williams %R — 컨플루언스 확인용 (독립 시그널 아님)
    const wr = cache.williamsR(14);

    const OVERSOLD   = 20;  // Lane (1984) 표준
    const OVERBOUGHT = 80;
    const EXTREME_OS = 10;  // Bulkowski (2005): 극단 반등 +12pp
    const EXTREME_OB = 90;
    const COOLDOWN   = 7;   // Slow Stochastic half-cycle (Appel 2005)
    const BASE_CONF  = 52;
    const WR_BONUS   = 3;   // %R 동시 확인 보너스

    let lastBuyIdx  = -COOLDOWN;
    let lastSellIdx = -COOLDOWN;

    for (let i = 1; i < candles.length; i++) {
      if (k[i] === null || k[i - 1] === null ||
          d[i] === null || d[i - 1] === null) continue;

      // ── 매수: 과매도 구간에서 %K > %D 상향 교차 ──
      if (k[i - 1] <= d[i - 1] && k[i] > d[i] && k[i] < OVERSOLD &&
          (i - lastBuyIdx) >= COOLDOWN) {

        const extremeBonus = Math.min(10, Math.floor((OVERSOLD - k[i]) / 4) * 2);
        const isExtreme = k[i] < EXTREME_OS;
        const maxConf = isExtreme ? 70 : 65;
        const wrBonus = (wr && wr[i] !== null && wr[i] < -80) ? WR_BONUS : 0;

        signals.push({
          type: 'stochasticOversold',
          source: 'indicator',
          nameShort: '스토캐스틱 과매도 반등',
          signal: 'buy',
          strength: isExtreme ? 'strong' : 'medium',
          confidence: Math.min(maxConf, BASE_CONF + extremeBonus + wrBonus),
          index: i,
          time: candles[i].time,
          description: `Stoch %K(${k[i].toFixed(1)})가 %D(${d[i].toFixed(1)}) 상향교차 — `
            + `과매도 구간${isExtreme ? ' (극단)' : ''} 모멘텀 반전${wrBonus ? ' + WR확인' : ''}`,
        });
        lastBuyIdx = i;
      }

      // ── 매도: 과매수 구간에서 %K < %D 하향 교차 ──
      if (k[i - 1] >= d[i - 1] && k[i] < d[i] && k[i] > OVERBOUGHT &&
          (i - lastSellIdx) >= COOLDOWN) {

        const extremeBonus = Math.min(10, Math.floor((k[i] - OVERBOUGHT) / 4) * 2);
        const isExtreme = k[i] > EXTREME_OB;
        const maxConf = isExtreme ? 68 : 63; // 매도 cap -2 (KRX 공매도 제한 비대칭)
        const wrBonus = (wr && wr[i] !== null && wr[i] > -20) ? WR_BONUS : 0;

        signals.push({
          type: 'stochasticOverbought',
          source: 'indicator',
          nameShort: '스토캐스틱 과매수 이탈',
          signal: 'sell',
          strength: isExtreme ? 'strong' : 'medium',
          confidence: Math.min(maxConf, BASE_CONF + extremeBonus + wrBonus),
          index: i,
          time: candles[i].time,
          description: `Stoch %K(${k[i].toFixed(1)})가 %D(${d[i].toFixed(1)}) 하향교차 — `
            + `과매수 구간${isExtreme ? ' (극단)' : ''} 모멘텀 약화${wrBonus ? ' + WR확인' : ''}`,
        });
        lastSellIdx = i;
      }
    }

    return signals;
  }


  // ══════════════════════════════════════════════════════
  //  ADX 트렌드 필터 (모듈레이터)
  //  Wilder (1978): ADX는 독립 시그널이 아닌 기존 시그널의 품질 필터
  //  트렌드 추종 시그널만 적용, 평균회귀 시그널은 미적용
  // ══════════════════════════════════════════════════════

  /** 트렌드 추종 시그널 타입 — ADX 정방향 조정 대상 */
  static _ADX_TREND_TYPES = new Set([
    'goldenCross', 'deadCross',
    'maAlignment_bull', 'maAlignment_bear',
    'macdBullishCross', 'macdBearishCross',
    'ichimokuBullishCross', 'ichimokuBearishCross',
    'ichimokuCloudBreakout', 'ichimokuCloudBreakdown',
  ]);

  // [P2-ADX] Isotonic piecewise-linear interpolation — Barlow et al. (1972)
  // Wilder (1978) 5단계 계단함수 → 연속 보간으로 불연속 점프 제거
  // rl_policy.adx_isotonic 있으면 데이터 기반 breakpoints 사용, 없으면 이론 기본값
  static _ADX_ISOTONIC_DEFAULT = [
    [10, -10], [15, -5], [20, 0], [25, 5], [30, 7], [40, 10], [50, 10]
  ];

  // [C-3] ADX period TF-adaptive — Wilder (1978), Kaufman (2013)
  // 분봉에서는 노이즈가 많아 더 긴 lookback 필요: 5m→28, 15m/30m→21, 1h+→14 (기본)
  // PatternEngine._currentTimeframe가 analyze() 전에 설정됨
  static _ADX_TF_PERIOD = { '1m': 28, '5m': 28, '15m': 21, '30m': 21, '1h': 14, '1d': 14, '1w': 14, '1M': 14 };

  // ══════════════════════════════════════════════════════
  //  [Phase TA-3 C-2] VKOSPI/VIX Regime Classification
  //  Whaley (2000, 2009): VIX as "investor fear gauge"
  //  Doc26 §2: VKOSPI ≈ VIX × regime-dependent scale (KRX 실증 프록시)
  //  Fallback chain: VKOSPI → VIX×scale (1.0/1.1/1.25) → null
  // ══════════════════════════════════════════════════════

  /**
   * VKOSPI/VIX 기반 변동성 레짐 분류 (Doc26 §2)
   * @returns {string|null} 'low' (vol<15) | 'normal' (15-25) | 'high' (25-35) | 'crisis' (>35) | null
   */
  static _classifyVolRegimeFromVKOSPI() {
    // 1차: _macroLatest (app.js 전역) — macro_latest.json에서 로드
    var macro = (typeof _macroLatest !== 'undefined') ? _macroLatest : null;
    // 2차: _marketContext (app.js 전역) — market_context.json에서 로드
    var mctx = (typeof _marketContext !== 'undefined') ? _marketContext : null;

    // VKOSPI 우선 (KRX 자체 변동성지수) — 현재 미구현이므로 null일 수 있음
    var vol = null;
    if (mctx && mctx.vkospi != null) {
      vol = mctx.vkospi;  // VKOSPI 직접 사용
    } else if (macro && macro.vkospi != null) {
      vol = macro.vkospi;  // macro_latest.json VKOSPI
    } else if (macro && macro.vix != null) {
      // [D-Heuristic] VIX→VKOSPI proxy: regime-dependent (pending actual VKOSPI data pipeline)
      // Normal (VIX<20): x1.0, Elevated (20<=VIX<30): x1.1, Crisis (VIX>=30): x1.25
      var vix = macro.vix;
      var vkospiScale = vix < 20 ? 1.0 : vix < 30 ? 1.1 : 1.25;
      vol = vix * vkospiScale;
    }

    if (vol == null) return null;
    // NOTE: Thresholds (15/20/25/30) transplanted from VIX; pending VKOSPI-specific calibration
    if (vol < 15) return 'low';
    if (vol <= 25) return 'normal';
    if (vol <= 35) return 'high';
    return 'crisis';
  }


  static _interpIsotonic(val, breakpoints) {
    if (!breakpoints || breakpoints.length < 2) return 0;  // degenerate → neutral
    if (val <= breakpoints[0][0]) return breakpoints[0][1];
    if (val >= breakpoints[breakpoints.length - 1][0]) return breakpoints[breakpoints.length - 1][1];
    for (var i = 1; i < breakpoints.length; i++) {
      if (val <= breakpoints[i][0]) {
        var x0 = breakpoints[i - 1][0], y0 = breakpoints[i - 1][1];
        var x1 = breakpoints[i][0], y1 = breakpoints[i][1];
        if (x1 === x0) return y1;  // duplicate x → use right value
        return y0 + (y1 - y0) * (val - x0) / (x1 - x0);
      }
    }
    return breakpoints[breakpoints.length - 1][1];
  }

  _applyADXFilter(signals, cache) {
    // [C-3] TF-adaptive ADX period: 분봉에서 안정성을 위해 더 긴 기간 사용
    var tf = (typeof PatternEngine !== 'undefined' && PatternEngine._currentTimeframe)
      ? PatternEngine._currentTimeframe : '1d';
    var adxPeriod = SignalEngine._ADX_TF_PERIOD[tf] || 14;
    const { adx } = cache.adx(adxPeriod);
    if (!adx) return;

    var bp = (typeof backtester !== 'undefined' && backtester._rlPolicy && backtester._rlPolicy.adx_isotonic)
      ? backtester._rlPolicy.adx_isotonic : SignalEngine._ADX_ISOTONIC_DEFAULT;

    for (const sig of signals) {
      // 트렌드 추종 시그널만 대상 (평균회귀 시그널 제외)
      if (!SignalEngine._ADX_TREND_TYPES.has(sig.type)) continue;

      const adxVal = adx[sig.index];
      if (adxVal === null || adxVal === undefined) continue;

      var adj = SignalEngine._interpIsotonic(adxVal, bp);
      sig.confidence = Math.max(30, Math.min(90, sig.confidence + adj));
    }
  }


  // ══════════════════════════════════════════════════════
  //  CCI 레짐 필터 — Lambert (1980), Colby (2003)
  //  |CCI| 기반 3단계 분류: trending/transition/ranging
  //  ADX(방향운동)와 직교적(가격 이탈도) — r≈0.50
  //  KRX 임계값: 150/75 (표준 100/50 대비 상향, 높은 변동성 보상)
  // ══════════════════════════════════════════════════════

  // [P2-CCI] Isotonic piecewise-linear — Lambert (1980), KRX-adjusted
  // 4단계 계단함수 → 연속 보간. |CCI| 기반 (방향 불문, 이탈도만 사용)
  static _CCI_ISOTONIC_DEFAULT = [
    [40, -3], [75, 0], [100, 0], [150, 2], [200, 3], [300, 3]
  ];

  _applyCCIFilter(signals, cache) {
    var cciArr = cache.cci(20);
    if (!cciArr) return;

    var bp = (typeof backtester !== 'undefined' && backtester._rlPolicy && backtester._rlPolicy.cci_isotonic)
      ? backtester._rlPolicy.cci_isotonic : SignalEngine._CCI_ISOTONIC_DEFAULT;

    for (var i = 0; i < signals.length; i++) {
      var sig = signals[i];
      if (!SignalEngine._ADX_TREND_TYPES.has(sig.type)) continue;

      var cciVal = cciArr[sig.index];
      if (cciVal === null || cciVal === undefined) continue;

      var absCCI = Math.abs(cciVal);
      var adj = SignalEngine._interpIsotonic(absCCI, bp);
      sig.confidence = Math.max(30, Math.min(90, sig.confidence + adj));
    }
  }


  // ══════════════════════════════════════════════════════
  //  CUSUM Breakpoint Discount — Page (1954), Roberts (1966)
  //  구조적 변동점 근처 시그널 신뢰도 감산: 레짐 전환 시
  //  과거 관계식이 무효화될 수 있으므로 30봉에 걸쳐 선형 회복
  //  discount: 0.70 (변동점) → 1.0 (30봉 후)
  // ══════════════════════════════════════════════════════

  _applyCUSUMDiscount(signals, candles, cache) {
    if (!signals || signals.length === 0) return;
    // [Phase TA-3 C-1] Volatility-adaptive CUSUM threshold (Doc34 §2.3)
    // 최근 변동성 레짐을 전달하여 임계값 자동 적응
    var lastVolRegime = null;
    var vrArr = cache.volRegime(0.94);
    if (vrArr && vrArr.length > 0) {
      for (var vi = vrArr.length - 1; vi >= 0; vi--) {
        if (vrArr[vi] !== null) { lastVolRegime = vrArr[vi]; break; }
      }
    }
    var cusumResult = cache.cusum(2.5, lastVolRegime);
    if (!cusumResult || !cusumResult.isRecent || !cusumResult.breakpoints || cusumResult.breakpoints.length === 0) return;

    var lastBP = cusumResult.breakpoints[cusumResult.breakpoints.length - 1];
    var lastIdx = candles.length - 1;
    var barsSince = lastIdx - lastBP.index;

    // Linear recovery: 0.70 at breakpoint → 1.0 after 30 bars
    if (barsSince >= 30) return;  // fully recovered
    var discount = 0.70 + 0.30 * (barsSince / 30);

    for (var i = 0; i < signals.length; i++) {
      if (signals[i].confidence) {
        signals[i].confidence = Math.max(10, Math.round(signals[i].confidence * discount));
      }
    }
  }


  // ══════════════════════════════════════════════════════
  //  Binary Segmentation Regime Discount — Bai & Perron (1998)
  //  구조적 변환점(regime shift) 근처 역추세 시그널 신뢰도 감산.
  //  rightMean > leftMean = 상승 레짐 → sell 신호 할인 (반대도 동일).
  //  CUSUM보다 약한 할인 (0.85 vs 0.70): BinSeg는 방향별 선택적.
  //  breakpoint index는 returns 배열 기준 (candle index ≈ bp.index + 1).
  // ══════════════════════════════════════════════════════

  _applyBinSegDiscount(signals, candles, cache) {
    if (!signals || signals.length === 0) return;
    var bsResult = cache.binarySegmentation(3, 30);
    if (!bsResult || !bsResult.breakpoints || bsResult.breakpoints.length === 0) return;

    // Use the most recent breakpoint
    var lastBP = bsResult.breakpoints[bsResult.breakpoints.length - 1];
    var barsSince = (candles.length - 1) - lastBP.index;

    // Only apply if breakpoint is recent (within 30 bars)
    if (barsSince > 30) return;

    // Determine new regime direction from mean shift
    var regimeDir = (lastBP.rightMean > lastBP.leftMean) ? 'up' : 'down';

    // Discount factor: 0.85 at breakpoint → 1.0 after 30 bars (linear recovery)
    var discount = 0.85 + 0.15 * (barsSince / 30);

    for (var i = 0; i < signals.length; i++) {
      var s = signals[i];
      if (!s.confidence) continue;

      // Only discount COUNTER-TREND signals (opposing the new regime)
      var isCounter = (regimeDir === 'up' && s.signal === 'sell') ||
                      (regimeDir === 'down' && s.signal === 'buy');
      if (isCounter) {
        s.confidence = Math.max(10, Math.round(s.confidence * discount));
      }
    }
  }


  // ══════════════════════════════════════════════════════
  //  칼만 필터 방향 전환 — Kalman (1960), A. Harvey (1989, structural time series / state space)
  //  composite condition 전용 (독립 시그널 아님)
  //  Q=0.1, R=1.0 → 정상상태 K≈0.095, EMA(≈20) 상당 반응속도
  // ══════════════════════════════════════════════════════

  _detectKalmanSignals(candles, cache) {
    var signals = [];
    var kalm = cache.kalman(0.1, 1.0);
    if (!kalm || kalm.length < 3) return signals;

    for (var i = 2; i < kalm.length; i++) {
      if (kalm[i] == null || kalm[i - 1] == null || kalm[i - 2] == null) continue;

      var d1 = kalm[i] - kalm[i - 1];
      var d0 = kalm[i - 1] - kalm[i - 2];

      // 방향 전환: 부호 변경 감지 (0 교차 제외)
      if (d0 <= 0 && d1 > 0) {
        signals.push({
          type: 'kalmanUpturn', signal: 'buy', strength: 'weak',
          confidence: 40, index: i, time: candles[i].time,
          nameShort: '칼만 상향', source: 'indicator',
          description: '칼만 필터 상향 전환 (추세 바닥 추정)',
        });
      } else if (d0 >= 0 && d1 < 0) {
        signals.push({
          type: 'kalmanDownturn', signal: 'sell', strength: 'weak',
          confidence: 40, index: i, time: candles[i].time,
          nameShort: '칼만 하향', source: 'indicator',
          description: '칼만 필터 하향 전환 (추세 천장 추정)',
        });
      }
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

    // [H-2] 스윙 확인에 i+1..i+swingOrder 참조 (3-bar lookahead)
    // 차트 표시용으로는 문제 없으나, 실시간 매매 시 swingOrder봉 지연 발생
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

    // Dual Confidence: confidencePred = calibration 기반 예측 승률 (모델 입력용)
    const _predMap = { strongBuy_hammerRsiVolume: 61, strongSell_shootingMacdVol: 69,
      buy_goldenCrossRsi: 58, sell_deadCrossMacd: 58,
      buy_bbBounceRsi: 55, sell_bbBreakoutRsi: 55,
      buy_hammerBBVol: 63, sell_shootingStarBBVol: 69,
      buy_morningStarRsiVol: 58, sell_eveningStarRsiVol: 65,
      buy_engulfingMacdAlign: 48, sell_engulfingMacdAlign: 66,
      buy_doubleBottomNeckVol: 68, sell_doubleTopNeckVol: 75,
      buy_ichimokuTriple: 70, sell_ichimokuTriple: 70,
      buy_goldenMarubozuVol: 65, sell_deadMarubozuVol: 68 };

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

    // [P2-CW] Per-signal composite window — rl_policy.composite_windows override
    // 고정 window=5 → 시그널 속도 특성별 최적 윈도우 적용
    // 빠른 시그널(volume) → 3~4, 느린 시그널(ichimoku, MA) → 6~7
    var cwOverride = (typeof backtester !== 'undefined' && backtester._rlPolicy && backtester._rlPolicy.composite_windows)
      ? backtester._rlPolicy.composite_windows : null;

    for (const def of COMPOSITE_SIGNAL_DEFS) {
      // per-signal window: rl_policy override → def.window fallback
      var effectiveWindow = Math.max(1, (cwOverride && cwOverride[def.id] != null) ? cwOverride[def.id] : def.window);

      // required 시그널 각각의 발생 인덱스 목록
      const requiredIndices = def.required.map(type => allMap.get(type) || []);

      // required 중 하나라도 비어있으면 스킵
      if (requiredIndices.some(arr => arr.length === 0)) continue;

      // 첫 번째 required의 각 인덱스를 기준점으로 윈도우 탐색
      for (const baseIdx of requiredIndices[0]) {
        const windowStart = baseIdx - effectiveWindow;
        const windowEnd   = baseIdx + effectiveWindow;

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

        // [M-4 documented] Composite cap 95 vs individual 90 — 이론적 타당성 확인됨
        // Bayesian updating: 독립적 확인 시그널은 사후확률을 단조증가시킴
        // Grinold-Kahn IC aggregation: IR_composite ≈ IC·√(N·(1+(N-1)ρ)⁻¹), ρ<1이면 IR 향상
        // 5pt 차등: OHLCV 기반 기술적 지표의 공유 노이즈를 반영한 적정 수준
        // [M-4 FIX] D-tier quality gate: reliabilityTier from backtester should reduce cap 95→70
        // LIMITATION: reliabilityTier is computed per-pattern in backtester.backtestAll(),
        // which runs AFTER signalEngine.analyze() in the pipeline. Composite signals here
        // cannot access backtester results at this stage. The quality gate must be applied
        // downstream (e.g., in patternRenderer or app.js when displaying composite signals).
        // TODO: Pass backtestResults into analyze() or apply D-tier discount post-hoc.
        const confidence = Math.min(
          95,
          def.baseConfidence + optionalCount * def.optionalBonus
        );
        // Dual Confidence: calibration 기반 예측 승률
        var confidencePred = _predMap[def.id] != null
          ? Math.min(90, _predMap[def.id] + optionalCount * Math.round(def.optionalBonus * 0.6))
          : confidence;
        // [H-2 FIX] _predMap values are already directional win rates
        // (e.g. shootingStar WR=56% = P(decline)). No inversion needed.
        confidencePred = Math.max(10, Math.min(90, confidencePred));
        // G-3: Platt calibration — Platt (1999), P = 1/(1+exp(-(a*x+b)))
        var _plattP = (typeof backtester !== 'undefined' && backtester._rlPolicy && backtester._rlPolicy.platt_params)
          ? backtester._rlPolicy.platt_params[def.id] : null;
        if (_plattP) {
          var _pz = _plattP[0] * (confidencePred / 100) + _plattP[1];
          confidencePred = Math.max(10, Math.min(90, Math.round(100 / (1 + Math.exp(-_pz)))));
        }

        // [M-2 fix] 기준 인덱스 = 윈도우 내 required 시그널 중 실제 가장 마지막 위치
        // (기존: window end 사용 → 실제 시그널 클러스터와 괴리)
        let latestRequiredIdx = baseIdx;
        for (let r = 1; r < requiredIndices.length; r++) {
          for (const idx of requiredIndices[r]) {
            if (idx >= windowStart && idx <= windowEnd && idx > latestRequiredIdx) {
              latestRequiredIdx = idx;
            }
          }
        }
        const actualIdx = Math.min(latestRequiredIdx, candles.length - 1);

        // 중복 방지: 동일 compositeId가 ±window 범위에 이미 있으면 스킵
        const alreadyExists = composites.some(
          cs => cs.compositeId === def.id &&
                Math.abs(cs.index - actualIdx) <= effectiveWindow
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
      ma: 0, macd: 0, rsi: 0, bb: 0, volume: 0, obv: 0, ichimoku: 0, hurst: 0, kalman: 0, stochastic: 0, composite: 0, adv: 0, volRegime: 0,
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
        // 복합 시그널: AMH crowding discount (Lo 2004, Pedersen 2009)
        // Tier-1 patterns are most crowded → lowest weight (alpha decay)
        // Tier-3 patterns retain alpha → highest weight
        const tierWeight = s.tier === 1 ? 1.5 : s.tier === 2 ? 2.5 : 3.5;
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

    // Shannon entropy — 시그널 다양성 측정
    // H = -Σ(p_i · log2(p_i)), 범위 [0, log2(categories)]
    // H 낮음 = 소수 카테고리 집중 (중복 시그널) → confidence 감쇄 근거
    const catValues = Object.values(categoryCounts);
    const catTotal = catValues.reduce((a, b) => a + b, 0);
    let entropy = 0;
    let maxEntropy = 0;
    if (catTotal > 0) {
      const activeCats = catValues.filter(v => v > 0).length;
      maxEntropy = activeCats > 1 ? Math.log2(activeCats) : 1;
      for (const v of catValues) {
        if (v > 0) {
          const p = v / catTotal;
          entropy -= p * Math.log2(p);
        }
      }
    }
    // 정규화: 0~1 (1 = 완전 분산, 0 = 단일 카테고리)
    const entropyNorm = maxEntropy > 0 ? +(entropy / maxEntropy).toFixed(3) : 0;

    return {
      sentiment: Math.max(-100, Math.min(100, sentiment)),
      sentimentLabel: this._sentimentLabel(sentiment),
      totalSignals: signals.length,
      recentBuy: buyCount,
      recentSell: sellCount,
      recentNeutral: neutralCount,
      categoryCounts,
      entropy: +entropy.toFixed(3),
      entropyNorm,
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
    if (type.startsWith('obv'))      return 'obv'; // [Phase TA-2] OBV 다이버전스 — Granville (1963)
    if (type.startsWith('ichimoku')) return 'ichimoku';
    if (type.startsWith('hurst'))    return 'hurst';
    if (type.startsWith('stochRsi')) return 'rsi'; // StochRSI는 RSI 카테고리 귀속
    if (type.startsWith('stochastic')) return 'stochastic'; // Lane (1984) Slow Stochastic — RSI와 별도
    if (type.startsWith('kalman'))  return 'kalman'; // [E-4] Kalman 필터 카테고리
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

  // ══════════════════════════════════════════════════════
  //  ADV Level Multiplier — 네트워크 외부성 (Katz & Shapiro, 1985)
  //  평균 거래대금(ADV) 기반 패턴 신뢰도 승수
  //  유동성 높은 종목 = 더 많은 시장 참여자 = 패턴 신뢰도 ↑
  // ══════════════════════════════════════════════════════

  /** ADV 등급별 신뢰도 승수 — 극소형(0.75), 소형(0.85), 중형(1.00), 대형(1.10) */
  static ADV_MULTIPLIERS = [0.75, 0.85, 1.00, 1.10];

  /**
   * ADV(Average Daily Value) 등급 계산
   * @param {Array} candles — OHLCV 배열
   * @param {number} [lookback=60] — 평균 산출 기간 (봉 수)
   * @returns {{ level: number, adv_eok: number, multiplier: number }}
   */
  calcADVLevel(candles, lookback) {
    if (lookback === undefined || lookback === null) lookback = 60;
    var result = { level: 0, adv_eok: 0, multiplier: SignalEngine.ADV_MULTIPLIERS[0] };
    if (!candles || candles.length === 0) return result;

    var start = Math.max(0, candles.length - lookback);
    var sum = 0;
    var count = 0;
    for (var i = start; i < candles.length; i++) {
      var c = candles[i];
      var close = c.close || 0;
      var volume = c.volume || 0;
      if (close > 0 && volume > 0) {
        sum += close * volume;
        count++;
      }
    }
    if (count === 0) return result;

    var adv = sum / count;
    var adv_eok = adv / 1e8; // 억원 단위 변환

    // ADV tiers: thin(<1M)/normal(1-10M)/thick(>100M KRW) — calibrated for KRX; Doc32 values (1/5/50) outdated
    // 등급 분류: <1억 → 0, <10억 → 1, <100억 → 2, >=100억 → 3
    var level;
    if (adv_eok < 1)        level = 0;
    else if (adv_eok < 10)  level = 1;
    else if (adv_eok < 100) level = 2;
    else                    level = 3;

    return {
      level: level,
      adv_eok: +adv_eok.toFixed(2),
      multiplier: SignalEngine.ADV_MULTIPLIERS[level],
    };
  }

  // ══════════════════════════════════════════════════════
  //  VolRegime Signal — 변동성 위험 프리미엄 (Carr & Wu, 2009)
  //  [Phase0-#6] VRP→VolRegime 리네임 + multiplier [0.85,1.15]
  //  장기/단기 EWMA 변동성 비율로 위험 선호 레짐 판별
  // ══════════════════════════════════════════════════════

  /**
   * VolRegime 레짐 계산 (EWMA 변동성 비율 프록시)
   * @param {Array} candles — OHLCV 배열
   * @param {IndicatorCache} [cache] — 캐시 (있으면 EWMA vol 재사용)
   * @returns {{ regime: string, ratio: number, multiplier: number }}
   *   regime: 'risk-on' (ratio > 1.2) | 'risk-off' (< 0.8) | 'neutral'
   */
  calcVolRegime(candles, cache) {
    var result = { regime: 'neutral', ratio: 1.0, multiplier: 1.00 };
    if (!candles || candles.length < 60) return result;

    var closes = [];
    for (var i = 0; i < candles.length; i++) {
      closes.push(candles[i].close || 0);
    }

    // EWMA 변동성: 장기 lambda=0.97 (반감기 ~23일), 단기 lambda=0.86 (반감기 ~4.6일)
    // 반감기 h = ln(2)/ln(1/λ). EMA span 등가: span=60→λ≈0.97, span=10→λ≈0.86
    var volLong, volShort;

    if (cache && typeof cache.ewmaVol === 'function') {
      volLong = cache.ewmaVol(0.97);
      volShort = cache.ewmaVol(0.86);
    } else {
      // IndicatorCache 미사용 시 직접 계산 (Worker 환경 등)
      volLong = (typeof calcEWMAVol === 'function') ? calcEWMAVol(closes, 0.97) : null;
      volShort = (typeof calcEWMAVol === 'function') ? calcEWMAVol(closes, 0.86) : null;
    }

    if (!volLong || !volShort) return result;

    // 최근 유효 값 추출
    var lastLong = null, lastShort = null;
    for (var i = volLong.length - 1; i >= 0; i--) {
      if (volLong[i] !== null && volLong[i] > 0) { lastLong = volLong[i]; break; }
    }
    for (var i = volShort.length - 1; i >= 0; i--) {
      if (volShort[i] !== null && volShort[i] > 0) { lastShort = volShort[i]; break; }
    }

    if (!lastLong || !lastShort || lastShort <= 0) return result;

    // vol_ratio = long_vol / short_vol
    // > 1.2 → 장기 변동성 > 단기 → 현재 안정 (변동성 감소 추세) → risk-on
    // < 0.8 → 단기 변동성 급등 → 현재 불안정 → risk-off
    // [Phase0-#6] multiplier 확대: [0.95,1.05]→[0.85,1.15] (레짐 효과 강화)
    // NOTE: 3x VRP multiplier widened in Phase0-#6; empirical validation pending
    var ratio = lastLong / lastShort;

    var regime, multiplier;
    if (ratio > 1.2) {
      regime = 'risk-on';
      multiplier = 1.15;
    } else if (ratio < 0.8) {
      regime = 'risk-off';
      multiplier = 0.85;
    } else {
      regime = 'neutral';
      multiplier = 1.00;
    }

    return {
      regime: regime,
      ratio: +ratio.toFixed(3),
      multiplier: multiplier,
    };
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
      categoryCounts: { ma: 0, macd: 0, rsi: 0, bb: 0, volume: 0, obv: 0, ichimoku: 0, hurst: 0, kalman: 0, stochastic: 0, composite: 0, adv: 0, volRegime: 0 },
      entropy: 0,
      entropyNorm: 0,
      advLevel: 0,
      advMultiplier: 0.75,
      volRegime: 'neutral',
      volRegimeMultiplier: 1.00,
    };
  }
}

// ── 전역 인스턴스 ─────────────────────────────────────
const signalEngine = new SignalEngine();
