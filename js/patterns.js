// ══════════════════════════════════════════════════════
//  기술적 패턴 인식 엔진 v2.0
// ══════════════════════════════════════════════════════
//
//  Phase 2: 거래량확인, ATR정규화, 추세맥락, 품질점수
//  Phase 3: 손절가, 목표가, 리스크리워드
//  Phase 4: 교수형, 유성형, 잉태형, 머리어깨, 지지/저항, 컨플루언스
//  Phase 8: 관통형, 먹구름형, 잠자리도지, 비석도지, 족집게바닥/천장
//  Phase 9: 마루보주(강세/약세), 팽이형
//
// ══════════════════════════════════════════════════════

class PatternEngine {

  // ══════════════════════════════════════════════════
  //  임계값 상수 (매직 넘버 제거)
  //  학술 참조: Nison (1991), Morris (2006), Bulkowski (2005)
  // ══════════════════════════════════════════════════

  /** 도지 body/range 비율 상한 — Nison 표준 */
  static DOJI_BODY_RATIO = 0.05;

  /** 꼬리/body 최소 비율 — 해머/유성형 하한 (Morris: 2x body) */
  static SHADOW_BODY_MIN = 2.0;

  /** 반대쪽 꼬리/body 상한 — 해머/유성형 (Morris: <=0.15) */
  static COUNTER_SHADOW_MAX_STRICT = 0.15;  // 해머용
  static COUNTER_SHADOW_MAX_LOOSE = 0.3;    // 역해머/교수형/유성형용

  /** body/range 최소 비율 — 유의미한 body 존재 확인 */
  static MIN_BODY_RANGE = 0.1;

  /** body/range 최대 비율 — 해머 계열 상한 (Nison: body는 range의 상/하 1/3 이내, ~33%. 45% 허용) */
  static MAX_BODY_RANGE_HAMMER = 0.45;

  /** ATR 대비 최소 body 크기 — 적삼병/흑삼병 개별 봉 */
  static THREE_SOLDIER_BODY_MIN = 0.3;

  /** ATR 대비 최소 body — 장악형 이전 봉 / 현재 봉 */
  static ENGULF_PREV_BODY_MIN = 0.1;
  static ENGULF_CURR_BODY_MIN = 0.2;

  /** 장악 봉의 body 배율 — KRX 가격제한폭(30%) 고려 (국제 1.3x → 1.2x) */
  static ENGULF_BODY_MULT = 1.2;

  /** 잉태형 이전 봉 최소 / 현재 봉 body 비율 상한 */
  static HARAMI_PREV_BODY_MIN = 0.3;
  static HARAMI_CURR_BODY_MAX = 0.5;
  static HARAMI_CURR_BODY_MIN = 0.05;

  /** 샛별/석별형 별(2봉) body 상한, 양끝 봉 body 하한 */
  static STAR_BODY_MAX = 0.2;
  static STAR_END_BODY_MIN = 0.3;

  /** 관통형/먹구름형 봉 body 하한 */
  static PIERCING_BODY_MIN = 0.3;

  /** 잠자리/비석 도지 그림자 비율 */
  static SPECIAL_DOJI_SHADOW_MIN = 0.70;
  static SPECIAL_DOJI_COUNTER_MAX = 0.10;

  /** 족집게 봉 body 하한 / 가격 일치 허용오차 (ATR 배수) */
  static TWEEZER_BODY_MIN = 0.15;
  static TWEEZER_TOLERANCE = 0.1;

  /** 마루보주 body/range 하한 — Nison: 실체가 range의 85% 이상 */
  static MARUBOZU_BODY_RATIO = 0.85;
  /** 마루보주 꼬리/body 상한 — Morris: 양끝 꼬리 거의 없음 (2% 이하) */
  static MARUBOZU_SHADOW_MAX = 0.02;

  /** 팽이형 body/range 범위 — 도지(5%)와 보통 봉(30%) 사이 */
  static SPINNING_BODY_MIN = 0.05;
  static SPINNING_BODY_MAX = 0.30;
  /** 팽이형 꼬리/body 하한 — 양쪽 꼬리가 body의 50% 이상 */
  static SPINNING_SHADOW_RATIO = 0.5;

  /** 유의미한 범위 (range/ATR) 하한 */
  static MIN_RANGE_ATR = 0.3;

  /** 추세 감지 정규화 방향 임계값 */
  static TREND_THRESHOLD = 0.3;

  /** 품질 점수 가중치 (Nison/Morris 원칙 기반) */
  static Q_WEIGHT = Object.freeze({
    body: 0.25, volume: 0.25, trend: 0.20, shadow: 0.15, extra: 0.15,
  });

  /** 손절가 ATR 배수 (기본) */
  static STOP_LOSS_ATR_MULT = 2;

  /** ATR fallback: 가격의 2% */
  static ATR_FALLBACK_PCT = 0.02;

  /** 캔들스틱 패턴 목표가 ATR 배수 (Bulkowski 5일 수익률 기반) */
  static CANDLE_TARGET_ATR = { strong: 1.0, medium: 0.7, weak: 0.5 };

  /** 차트 패턴 목표가 ATR 상한 — EVT 99.5% VaR 경계 (core_data/12_extreme_value_theory.md §4.3) */
  static CHART_TARGET_ATR_CAP = 6;

  /** 차트 패턴 목표가 raw 배율 상한 — Bulkowski P80 (패턴 높이의 2배 초과 = 상위 20%) */
  static CHART_TARGET_RAW_CAP = 2.0;

  /** 전역 학습 가중치 (Worker에서 주입) */
  static _globalLearnedWeights = null;

  /**
   * 회귀 계수를 Q_WEIGHT 구조로 정규화
   */
  static _normalizeCoeffsToWeights(coeffs) {
    const fc = [Math.abs(coeffs[1] || 0), Math.abs(coeffs[2] || 0), Math.abs(coeffs[3] || 0), Math.abs(coeffs[4] || 0)];
    const s = fc.reduce((a, b) => a + b, 0.001);
    const raw = { body: fc[0] / s, volume: fc[2] / s, trend: fc[1] / s, shadow: fc[0] / s * 0.6, extra: fc[3] / s };
    const sum = Object.values(raw).reduce((a, b) => a + b, 0.001);
    return { body: raw.body / sum, volume: raw.volume / sum, trend: raw.trend / sum, shadow: raw.shadow / sum, extra: raw.extra / sum };
  }

  // ══════════════════════════════════════════════════
  //  유틸리티
  // ══════════════════════════════════════════════════

  /** 선형 추세 감지 — ATR 기반 정규화로 변동성 일관 감도 보장
   *  Murphy (1999): "Trend identification should be normalized against
   *  recent volatility for consistent sensitivity across market regimes."
   *  @param {number} [atrVal] 미리 계산된 ATR 값 (없으면 가격 평균 1% fallback)
   */
  _detectTrend(candles, endIndex, lookback = 10, atrVal = null) {
    const start = Math.max(0, endIndex - lookback);
    if (endIndex - start < 3) return { slope: 0, strength: 0, direction: 'neutral' };
    const seg = candles.slice(start, endIndex);
    const n = seg.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let i = 0; i < n; i++) {
      sx += i; sy += seg[i].close; sxy += i * seg[i].close; sx2 += i * i;
    }
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    // ATR 기반 정규화: 나머지 엔진과 일관된 변동성 기준 사용
    // atrVal이 없으면 가격 평균의 2%를 fallback (ATR_FALLBACK_PCT = 0.02 일관)
    const divisor = atrVal && atrVal > 0 ? atrVal : (sy / n * PatternEngine.ATR_FALLBACK_PCT);
    const norm = slope / divisor;
    const T = PatternEngine.TREND_THRESHOLD;
    return {
      slope,
      strength: Math.abs(norm),
      direction: norm > T ? 'up' : norm < -T ? 'down' : 'neutral',
    };
  }

  /** 거래량 비율 (현재 / MA) */
  _volRatio(candles, idx, vma) {
    if (!vma || !vma[idx] || vma[idx] === 0) return 1;
    return candles[idx].volume / vma[idx];
  }

  /** 다요인 품질 점수 (0-100)
   *  extra 기본값 0.3: 확인 요인 부재 시 보수적 평가 (Nison/Morris 원칙)
   *  0.5는 "추가 확인 없이도 절반 점수"를 의미하여 신뢰도 인플레이션 유발
   */
  _quality({ body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.3 }) {
    const W = PatternEngine.Q_WEIGHT;
    const raw = W.body * body + W.volume * volume + W.trend * trend + W.shadow * shadow + W.extra * extra;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }

  /**
   * 적응형 품질 평가 — 학술 기본값(prior) + 데이터 학습(posterior)
   * 차트 패턴(9종) 전용. 캔들 패턴은 기존 _quality() 유지.
   * @param {string} patternType
   * @param {Object} features - { body, volume, trend, shadow, extra }
   * @returns {number} confidence 0-100
   */
  _adaptiveQuality(patternType, features) {
    let W = PatternEngine.Q_WEIGHT;
    const lw = PatternEngine._globalLearnedWeights;

    if (lw && lw[patternType] && lw[patternType].confidence > 0.05) {
      const learned = lw[patternType];
      // alpha: 최대 50% 적응 — 학술값을 완전히 버리지 않음
      const alpha = Math.max(0, Math.min(learned.confidence * 2, 0.5));
      const W_learned = PatternEngine._normalizeCoeffsToWeights(learned.beta);
      W = {
        body: (1 - alpha) * W.body + alpha * W_learned.body,
        volume: (1 - alpha) * W.volume + alpha * W_learned.volume,
        trend: (1 - alpha) * W.trend + alpha * W_learned.trend,
        shadow: (1 - alpha) * W.shadow + alpha * W_learned.shadow,
        extra: (1 - alpha) * W.extra + alpha * W_learned.extra,
      };
      const sum = Object.values(W).reduce((a, b) => a + b, 0.001);
      Object.keys(W).forEach(k => W[k] /= sum);
    }

    const { body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.3 } = features;
    const raw = W.body * body + W.volume * volume + W.trend * trend + W.shadow * shadow + W.extra * extra;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }

  /** ATR 기반 손절가 */
  _stopLoss(candles, idx, signal, atr, mult = PatternEngine.STOP_LOSS_ATR_MULT) {
    const p = candles[idx].close;
    const a = atr[idx] || p * PatternEngine.ATR_FALLBACK_PCT;
    return signal === 'buy' ? +(p - a * mult).toFixed(0)
         : signal === 'sell' ? +(p + a * mult).toFixed(0) : null;
  }

  /** 캔들스틱 패턴 전용 목표가 — ATR × strength 배수
   *  학술 근거: Nison (1991) — 캔들 패턴은 목표가를 제시하지 않음.
   *  Bulkowski (2012) 5일 평균 수익률 기반 ATR 배수로 보수적 추정.
   *  차트 패턴의 measured move와 명시적으로 분리. */
  _candleTarget(candles, idx, signal, strength, atr) {
    const entry = candles[idx].close;
    const a = atr[idx] || entry * PatternEngine.ATR_FALLBACK_PCT;
    const mult = PatternEngine.CANDLE_TARGET_ATR[strength] || 0.7;
    return signal === 'buy'  ? +(entry + a * mult).toFixed(0)
         : signal === 'sell' ? +(entry - a * mult).toFixed(0) : null;
  }

  /** ATR 값 (fallback 포함) */
  _atr(atr, idx, candles) {
    return atr[idx] || candles[idx].close * PatternEngine.ATR_FALLBACK_PCT;
  }

  // ══════════════════════════════════════════════════
  //  전체 분석
  // ══════════════════════════════════════════════════

  analyze(candles) {
    if (!candles || candles.length < 10) return [];
    // indicators.js 전역 함수 직접 호출 (불필요한 래퍼 제거)
    const closes = candles.map(c => c.close);
    const hurst = calcHurst(closes);
    // f(hurst): James-Stein shrinkage — 데이터 부족 시 H→0.5(랜덤워크) 수축
    let hurstWeight = 1.0;
    if (hurst != null && isFinite(hurst)) {
      var nEff = Math.max(2, Math.floor(Math.log(closes.length / 20) / Math.log(1.5)));
      var shrinkage = nEff / (nEff + 20);
      var hShrunk = shrinkage * hurst + (1 - shrinkage) * 0.5;
      hurstWeight = Math.max(0.6, Math.min(2 * hShrunk, 1.4));
    }
    // k(vol): 변동성 레짐 보정 — ATR_14/ATR_50 비율 (경제물리학 멱법칙 기반)
    const atr14 = calcATR(candles, 14);
    const atr50 = calcATR(candles, 50);
    const lastATR14 = atr14[atr14.length - 1] || 1;
    const lastATR50 = atr50[atr50.length - 1] || lastATR14;
    const volWeight = Math.max(0.7, Math.min(1 / Math.sqrt(lastATR14 / lastATR50), 1.4));

    // m(meanRev): 평균 회귀 보정 — OU 과정 반감기 기반 (core_data/12_extreme_value_theory.md)
    const ma50 = calcMA(closes, 50);
    const lastMA50 = ma50[ma50.length - 1] || closes[closes.length - 1];
    const moveATR = lastATR14 > 0 ? Math.abs(closes[closes.length - 1] - lastMA50) / lastATR14 : 0;
    const excess = Math.max(0, moveATR - 3);
    const meanRevWeight = Math.max(0.6, Math.min(Math.exp(-0.1386 * excess), 1.0));

    // r(regime): Jeffrey 발산 기반 레짐 변화 보정 — 대칭 KL (core_data/13_information_geometry.md §4.3)
    let regimeWeight = 1.0;
    if (closes.length >= 80) {
      const returns60 = [], returns20 = [];
      for (let ri = closes.length - 80; ri < closes.length - 20; ri++) {
        if (closes[ri] > 0) returns60.push((closes[ri + 1] - closes[ri]) / closes[ri]);
      }
      for (let ri = closes.length - 20; ri < closes.length - 1; ri++) {
        if (closes[ri] > 0) returns20.push((closes[ri + 1] - closes[ri]) / closes[ri]);
      }
      if (returns60.length > 10 && returns20.length > 5) {
        const mu1 = returns60.reduce((s, v) => s + v, 0) / returns60.length;
        const mu2 = returns20.reduce((s, v) => s + v, 0) / returns20.length;
        const s1sq = returns60.reduce((s, v) => s + (v - mu1) ** 2, 0) / returns60.length || 1e-10;
        const s2sq = returns20.reduce((s, v) => s + (v - mu2) ** 2, 0) / returns20.length || 1e-10;
        // Jeffrey divergence (symmetric KL) — 방향 편향 제거
        const dj = 0.5 * (s1sq / s2sq + s2sq / s1sq - 2)
                 + 0.5 * (mu1 - mu2) * (mu1 - mu2) * (1 / s1sq + 1 / s2sq);
        regimeWeight = Math.max(0.7, Math.min(1.0, 1 - dj * 0.15));
      }
    }

    const ctx = { atr: atr14, vma: calcMA(candles.map(c => c.volume), 20), hurstWeight, volWeight, meanRevWeight, regimeWeight };
    const patterns = [];

    // 캔들 패턴 — 빈도순 (Bulkowski 출현율 기준, 빈번한 패턴 먼저 감지)
    // 1봉 패턴 (가장 빈번: 도지 > 해머 > 장악형 > 잉태형)
    patterns.push(...this.detectDoji(candles, ctx));
    patterns.push(...this.detectHammer(candles, ctx));
    patterns.push(...this.detectShootingStar(candles, ctx));
    patterns.push(...this.detectHangingMan(candles, ctx));
    patterns.push(...this.detectInvertedHammer(candles, ctx));
    patterns.push(...this.detectDragonflyDoji(candles, ctx));
    patterns.push(...this.detectGravestoneDoji(candles, ctx));
    patterns.push(...this.detectMarubozu(candles, ctx));
    patterns.push(...this.detectSpinningTop(candles, ctx));
    // 2봉 패턴
    patterns.push(...this.detectEngulfing(candles, ctx));
    patterns.push(...this.detectHarami(candles, ctx));
    patterns.push(...this.detectPiercingLine(candles, ctx));
    patterns.push(...this.detectDarkCloud(candles, ctx));
    patterns.push(...this.detectTweezerBottom(candles, ctx));
    patterns.push(...this.detectTweezerTop(candles, ctx));
    // 3봉 패턴 (가장 드묾)
    patterns.push(...this.detectThreeWhiteSoldiers(candles, ctx));
    patterns.push(...this.detectThreeBlackCrows(candles, ctx));
    patterns.push(...this.detectMorningStar(candles, ctx));
    patterns.push(...this.detectEveningStar(candles, ctx));

    // 차트 패턴
    const swH = this._findSwingHighs(candles, 3);
    const swL = this._findSwingLows(candles, 3);
    patterns.push(...this.detectDoubleBottom(candles, swL, ctx));
    patterns.push(...this.detectDoubleTop(candles, swH, ctx));
    patterns.push(...this.detectAscendingTriangle(candles, swH, swL, ctx));
    patterns.push(...this.detectDescendingTriangle(candles, swH, swL, ctx));
    patterns.push(...this.detectRisingWedge(candles, swH, swL, ctx));
    patterns.push(...this.detectFallingWedge(candles, swH, swL, ctx));
    patterns.push(...this.detectSymmetricTriangle(candles, swH, swL, ctx));
    patterns.push(...this.detectHeadAndShoulders(candles, swH, swL, ctx));
    patterns.push(...this.detectInverseHeadAndShoulders(candles, swH, swL, ctx));

    // 지지/저항 + 컨플루언스
    const sr = this.detectSupportResistance(candles, swH, swL, ctx);
    this._applyConfluence(patterns, sr, ctx);

    // R:R 검증 게이트 — 전망이론 λ=2.25 기반 (Kahneman & Tversky 1979)
    this._applyRRGate(patterns, candles);

    return this._dedup(patterns);
  }

  // ══════════════════════════════════════════════════
  //  적삼병 (Three White Soldiers) — 강한 매수
  // ══════════════════════════════════════════════════
  detectThreeWhiteSoldiers(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;
    for (let i = 2; i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      if (c0.close <= c0.open || c1.close <= c1.open || c2.close <= c2.open) continue;
      if (c1.close <= c0.close || c2.close <= c1.close) continue;
      if (c1.open < c0.open || c1.open > c0.close) continue;
      if (c2.open < c1.open || c2.open > c1.close) continue;

      const a = this._atr(atr, i, candles);
      const b0 = c0.close - c0.open, b1 = c1.close - c1.open, b2 = c2.close - c2.open;
      const bodyMin = PatternEngine.THREE_SOLDIER_BODY_MIN;
      if (b0 < a * bodyMin || b1 < a * bodyMin || b2 < a * bodyMin) continue;

      const w0 = c0.high - c0.close, w1 = c1.high - c1.close, w2 = c2.high - c2.close;
      if (w0 > b0 * 0.5 || w1 > b1 * 0.5 || w2 > b2 * 0.5) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const shadowScore = 1 - Math.min((w0 / b0 + w1 / b1 + w2 / b2) / 3, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10, a);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'strong', atr);

      results.push({
        type: 'threeWhiteSoldiers', name: '적삼병 (Three White Soldiers)', nameShort: '적삼병',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 양봉 상승 — 강한 매수 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  흑삼병 (Three Black Crows) — 강한 매도
  // ══════════════════════════════════════════════════
  detectThreeBlackCrows(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 2; i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      if (c0.close >= c0.open || c1.close >= c1.open || c2.close >= c2.open) continue;
      if (c1.close >= c0.close || c2.close >= c1.close) continue;
      if (c1.open > c0.open || c1.open < c0.close) continue;
      if (c2.open > c1.open || c2.open < c1.close) continue;

      const a = this._atr(atr, i, candles);
      const b0 = c0.open - c0.close, b1 = c1.open - c1.close, b2 = c2.open - c2.close;
      const bodyMin = PatternEngine.THREE_SOLDIER_BODY_MIN;
      if (b0 < a * bodyMin || b1 < a * bodyMin || b2 < a * bodyMin) continue;

      // Nison: "각 음봉의 아래꼬리가 짧아야 한다" — 적삼병 윗꼬리 검증의 대칭
      // 아래꼬리가 길면 해당 가격대에서 매수세 저항을 의미 → 하락 신뢰도 저하
      const ls0 = c0.close - c0.low, ls1 = c1.close - c1.low, ls2 = c2.close - c2.low;
      if (ls0 > b0 * bodyMin || ls1 > b1 * bodyMin || ls2 > b2 * bodyMin) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const shadowScore = 1 - Math.min((ls0 / b0 + ls1 / b1 + ls2 / b2) / 3, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10, a);
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'strong', atr);

      results.push({
        type: 'threeBlackCrows', name: '흑삼병 (Three Black Crows)', nameShort: '흑삼병',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 음봉 하락 — 강한 매도 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  해머 (Hammer) — 하락 추세 반전 매수
  // ══════════════════════════════════════════════════
  detectHammer(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (lowerShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          upperShadow > body * PatternEngine.COUNTER_SHADOW_MAX_STRICT ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 하락 추세 확인 (ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr);

      results.push({
        type: 'hammer', name: '해머 (Hammer)', nameShort: '해머',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 아래꼬리 — 하락 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  역해머 (Inverted Hammer) — 하락 추세 반전 가능
  // ══════════════════════════════════════════════════
  detectInvertedHammer(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (upperShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          lowerShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'weak', atr);

      results.push({
        type: 'invertedHammer', name: '역해머 (Inverted Hammer)', nameShort: '역해머',
        signal: 'buy', strength: 'weak', confidence, stopLoss, priceTarget,  // Bulkowski: 승률 ~50%
        description: `긴 윗꼬리 — 하락 반전 가능 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  교수형 (Hanging Man) — 상승 추세 반전 매도
  // ══════════════════════════════════════════════════
  detectHangingMan(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (lowerShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          upperShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 상승 추세 확인 (해머와 반대, ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
      // Nison: 교수형은 확인 캔들(다음 봉 하락)로 신뢰도가 높아지나,
      // 실시간 감지 시 미래 데이터를 사용하면 백테스트 결과가 왜곡됨.
      // 확인 없이는 보수적으로 평가 (extra=0.15, strength='weak')
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.15 });
      const strength = 'weak';  // 확인 캔들 없이는 약한 신호 (look-ahead bias 방지)
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'weak', atr);

      results.push({
        type: 'hangingMan', name: '교수형 (Hanging Man)', nameShort: '교수형',
        signal: 'sell', strength, confidence, stopLoss, priceTarget,
        description: `상승 후 긴 아래꼬리 — 하락 반전 경고 (확인 필요). 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  유성형 (Shooting Star) — 상승 추세 반전 매도
  // ══════════════════════════════════════════════════
  detectShootingStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (upperShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          lowerShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 상승 추세 확인 (역해머와 반대, ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr);

      results.push({
        type: 'shootingStar', name: '유성형 (Shooting Star)', nameShort: '유성형',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `상승 후 긴 윗꼬리 — 하락 반전 경고. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  도지 (Doji) — 추세 전환 가능
  // ══════════════════════════════════════════════════
  detectDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const a = this._atr(atr, i, candles);
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 추세 맥락으로 신호 방향 결정 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      const signal = trend.direction === 'up' ? 'sell' : trend.direction === 'down' ? 'buy' : 'neutral';
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction !== 'neutral' ? Math.min(trend.strength, 1) : 0.3;
      const shadowScore = Math.min(range / a, 1);
      // [FIX] Doji 품질: 저변동성 도지 패널티 제거 — 도지 품질은 꼬리/추세 점수가 결정
      // 천장/바닥의 작은 range 도지가 유효한 반전 신호이므로 감산하면 안됨
      const confidence = Math.round(this._quality({ body: 0.5, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.5 }));

      results.push({
        type: 'doji', name: '도지 (Doji)', nameShort: '도지',
        signal, strength: 'weak', confidence,
        stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
        priceTarget: signal !== 'neutral' ? this._candleTarget(candles, i, signal, 'weak', atr) : null,
        description: `시가 ≈ 종가 — 추세 전환 가능. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  장악형 (Engulfing) — 강한 반전
  // ══════════════════════════════════════════════════
  detectEngulfing(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);
      const a = this._atr(atr, i, candles);
      if (prevBody < a * PatternEngine.ENGULF_PREV_BODY_MIN ||
          currBody < a * PatternEngine.ENGULF_CURR_BODY_MIN) continue;

      // Bulkowski: 장악 봉의 body가 이전 봉 body보다 유의미하게 커야 유효
      // KRX 가격제한폭(30%) 고려하여 1.2배로 설정 (국제 기준 1.3배보다 보수적)
      if (currBody < prevBody * PatternEngine.ENGULF_BODY_MULT) continue;

      const trend = this._detectTrend(candles, i - 1, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min(currBody / a, 1);

      // 상승 장악형
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open <= prev.close && curr.close >= prev.open) {
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
          let confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          // [ACC] 거래량 확인: 장악 봉의 거래량이 이전 봉 대비 1.2배 이상이면 +10%
          if (curr.volume > prev.volume * 1.2) confidence = Math.min(confidence + 10, 100);
          results.push({
            type: 'bullishEngulfing', name: '상승장악형 (Bullish Engulfing)', nameShort: '상승장악',
            signal: 'buy', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._candleTarget(candles, i, 'buy', 'strong', atr),
            description: `양봉이 음봉을 감싸 — 강한 상승 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          });
        }
      }

      // 하락 장악형
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open >= prev.close && curr.close <= prev.open) {
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
          let confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          // [ACC] 거래량 확인: 장악 봉의 거래량이 이전 봉 대비 1.2배 이상이면 +10%
          if (curr.volume > prev.volume * 1.2) confidence = Math.min(confidence + 10, 100);
          results.push({
            type: 'bearishEngulfing', name: '하락장악형 (Bearish Engulfing)', nameShort: '하락장악',
            signal: 'sell', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._candleTarget(candles, i, 'sell', 'strong', atr),
            description: `음봉이 양봉을 감싸 — 강한 하락 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          });
        }
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  잉태형 (Harami) — 반전 가능
  // ══════════════════════════════════════════════════
  detectHarami(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);
      const a = this._atr(atr, i, candles);
      if (prevBody < a * PatternEngine.HARAMI_PREV_BODY_MIN ||
          currBody > prevBody * PatternEngine.HARAMI_CURR_BODY_MAX) continue;
      if (currBody < a * PatternEngine.HARAMI_CURR_BODY_MIN) continue;

      const trend = this._detectTrend(candles, i - 1, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);

      // 상승 잉태형 (하락 추세 → 큰 음봉 → 작은 양봉 내포)
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open > prev.close && curr.close < prev.open) {
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
          // 잉태형은 본질적으로 미확인 패턴 — 항상 보수적으로 평가 (20% 감산 적용)
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          quality = Math.round(quality * 0.8);  // 미확인 상태가 기본 (look-ahead bias 방지)
          results.push({
            type: 'bullishHarami', name: '상승잉태형 (Bullish Harami)', nameShort: '상승잉태',
            signal: 'buy', strength: 'medium', confidence: quality,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._candleTarget(candles, i, 'buy', 'medium', atr),
            description: `작은 양봉이 음봉 내에 — 반전 가능 (확인 필요). 형태 점수 ${quality}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          });
        }
      }

      // 하락 잉태형 (상승 추세 → 큰 양봉 → 작은 음봉 내포)
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open < prev.close && curr.close > prev.open) {
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
          // 잉태형은 본질적으로 미확인 패턴 — 항상 보수적으로 평가 (20% 감산 적용)
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          quality = Math.round(quality * 0.8);  // 미확인 상태가 기본 (look-ahead bias 방지)
          results.push({
            type: 'bearishHarami', name: '하락잉태형 (Bearish Harami)', nameShort: '하락잉태',
            signal: 'sell', strength: 'medium', confidence: quality,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._candleTarget(candles, i, 'sell', 'medium', atr),
            description: `작은 음봉이 양봉 내에 — 반전 가능 (확인 필요). 형태 점수 ${quality}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          });
        }
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  샛별형 (Morning Star) — 바닥 반전
  // ══════════════════════════════════════════════════
  detectMorningStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 2; i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);

      // Nison (1991): 1봉은 반드시 긴 음봉, 3봉은 반드시 긴 양봉
      if (c0.close >= c0.open) continue;   // 1봉 음봉 확인 (Bug fix)
      if (c2.close <= c2.open) continue;   // 3봉 양봉 확인

      const body0 = c0.open - c0.close;    // 음봉이므로 양수
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.close - c2.open;    // 양봉이므로 양수

      if (body0 < a * PatternEngine.STAR_END_BODY_MIN) continue;   // 1봉: 유의미한 크기
      if (body1 > a * PatternEngine.STAR_BODY_MAX) continue;     // 2봉: 작은 몸통 (별)
      if (body2 < a * PatternEngine.STAR_END_BODY_MIN) continue; // 3봉: 유의미한 크기
      if (c1.close > c0.close && c1.open > c0.close) continue;  // 2봉 갭다운 확인

      // Nison: "3봉 종가가 1봉 몸통의 50% 이상 회복해야"
      const c0Mid = c0.close + body0 * 0.5;
      if (c2.close < c0Mid) continue;

      const trend = this._detectTrend(candles, i - 2, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
      const starScore = 1 - Math.min(body1 / a, 1);
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, shadow: starScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'strong', atr);

      results.push({
        type: 'morningStar', name: '샛별형 (Morning Star)', nameShort: '샛별형',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `음봉 → 소형봉 → 양봉 — 3봉 바닥 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  석별형 (Evening Star) — 천장 반전
  // ══════════════════════════════════════════════════
  detectEveningStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 2; i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);

      // Nison (1991): 1봉은 반드시 긴 양봉, 3봉은 반드시 긴 음봉
      if (c0.close <= c0.open) continue;   // 1봉 양봉 확인 (Bug fix)
      if (c2.close >= c2.open) continue;   // 3봉 음봉 확인

      const body0 = c0.close - c0.open;    // 양봉이므로 양수
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.open - c2.close;    // 음봉이므로 양수

      if (body0 < a * PatternEngine.STAR_END_BODY_MIN) continue;   // 1봉: 유의미한 크기
      if (body1 > a * PatternEngine.STAR_BODY_MAX) continue;     // 2봉: 작은 몸통 (별)
      if (body2 < a * PatternEngine.STAR_END_BODY_MIN) continue; // 3봉: 유의미한 크기
      if (c1.close < c0.close && c1.open < c0.close) continue;  // 2봉 갭업 확인

      // Nison: "3봉 종가가 1봉 몸통의 50% 이하로 하락해야"
      const c0Mid = c0.open + body0 * 0.5;
      if (c2.close > c0Mid) continue;

      const trend = this._detectTrend(candles, i - 2, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
      const starScore = 1 - Math.min(body1 / a, 1);
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, shadow: starScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'strong', atr);

      results.push({
        type: 'eveningStar', name: '석별형 (Evening Star)', nameShort: '석별형',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `양봉 → 소형봉 → 음봉 — 3봉 천장 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  관통형 (Piercing Line) — 하락 후 강세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 전일 강한 하락 후, 당일 갭다운 시가에서 매수세가 유입되어
  //  전일 음봉 몸통의 50% 이상을 회복하며 마감. 매도 세력의 약화와
  //  저가 매수 세력의 등장을 의미 (Nison, 1991; Bulkowski 승률 ~64%).
  //
  detectPiercingLine(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 음봉 (하락)
      if (prev.close >= prev.open) continue;
      // 현봉: 양봉 (상승)
      if (curr.close <= curr.open) continue;

      const prevBody = prev.open - prev.close;  // 음봉이므로 양수
      const currBody = curr.close - curr.open;   // 양봉이므로 양수
      const a = this._atr(atr, i, candles);

      // ATR 정규화: 두 봉 모두 유의미한 크기
      if (prevBody < a * PatternEngine.PIERCING_BODY_MIN ||
          currBody < a * PatternEngine.PIERCING_BODY_MIN) continue;

      // 현봉 시가가 전봉 종가(저가 쪽) 이하에서 시작 (갭다운 또는 동일 수준)
      if (curr.open > prev.close) continue;

      // 현봉 종가가 전봉 몸통의 50% 이상 회복
      const prevMid = prev.close + prevBody * 0.5;
      if (curr.close < prevMid) continue;

      // 현봉 종가가 전봉 시가(고가 쪽)를 넘지 않아야 (넘으면 장악형)
      if (curr.close >= prev.open) continue;

      // 하락 추세 확인 — 하락 추세에서만 반전 의미 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'down') continue;

      // 품질 점수 산출
      const penetration = (curr.close - prev.close) / prevBody; // 관통 비율 (0.5~1.0)
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const shadowScore = Math.min(penetration, 1);  // 관통 깊이가 깊을수록 신뢰
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr);

      results.push({
        type: 'piercingLine', name: '관통형 (Piercing Line)', nameShort: '관통형',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭다운 후 전봉 50% 이상 회복 — 강세 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  먹구름형 (Dark Cloud Cover) — 상승 후 약세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 전일 강한 상승 후, 당일 갭업 시가에서 매도세가 등장하여
  //  전일 양봉 몸통의 50% 이하로 하락 마감. 매수 세력의 소진과
  //  차익 실현 또는 신규 매도의 등장을 의미 (Nison, 1991; Bulkowski 승률 ~60%).
  //  관통형의 약세 대칭 패턴.
  //
  detectDarkCloud(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 양봉 (상승)
      if (prev.close <= prev.open) continue;
      // 현봉: 음봉 (하락)
      if (curr.close >= curr.open) continue;

      const prevBody = prev.close - prev.open;  // 양봉이므로 양수
      const currBody = curr.open - curr.close;   // 음봉이므로 양수
      const a = this._atr(atr, i, candles);

      // ATR 정규화: 두 봉 모두 유의미한 크기
      if (prevBody < a * PatternEngine.PIERCING_BODY_MIN ||
          currBody < a * PatternEngine.PIERCING_BODY_MIN) continue;

      // 현봉 시가가 전봉 종가(고가 쪽) 이상에서 시작 (갭업 또는 동일 수준)
      if (curr.open < prev.close) continue;

      // 현봉 종가가 전봉 몸통의 50% 이하로 하락
      const prevMid = prev.open + prevBody * 0.5;
      if (curr.close > prevMid) continue;

      // 현봉 종가가 전봉 시가(저가 쪽)를 넘지 않아야 (넘으면 장악형)
      if (curr.close <= prev.open) continue;

      // 상승 추세 확인 — 상승 추세에서만 반전 의미 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'up') continue;

      // 품질 점수 산출
      const penetration = (prev.close - curr.close) / prevBody; // 관통 비율 (0.5~1.0)
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const shadowScore = Math.min(penetration, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr);

      results.push({
        type: 'darkCloud', name: '먹구름형 (Dark Cloud Cover)', nameShort: '먹구름',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭업 후 전봉 50% 이하 하락 — 약세 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  잠자리 도지 (Dragonfly Doji) — 하락 반전 강세
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 장중 큰 폭으로 하락했으나 매수세가 강하게 유입되어
  //  시가 근처까지 회복. T자 형태. 하락 추세 바닥에서 나타나면
  //  강력한 반전 신호 (Nison: "dragonfly doji is more bullish than
  //  a regular doji at a market bottom"). 해머보다 더 극단적인 형태.
  //
  detectDragonflyDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 도지 조건: body가 range의 5% 이하 (Nison 표준)
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);

      // 잠자리 도지: 하단 그림자가 range의 70% 이상, 상단 그림자 거의 없음
      if (lowerShadow < range * PatternEngine.SPECIAL_DOJI_SHADOW_MIN) continue;
      if (upperShadow > range * PatternEngine.SPECIAL_DOJI_COUNTER_MAX) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 하락 추세에서 발생 시 강세 반전 (상승 추세에서는 무시, ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const rangeScore = Math.min(range / a, 1);
      const confidence = this._quality({ body: 0.6, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: rangeScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr);

      results.push({
        type: 'dragonflyDoji', name: '잠자리 도지 (Dragonfly Doji)', nameShort: '잠자리도지',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 하단꼬리 T형 도지 — 바닥 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  비석 도지 (Gravestone Doji) — 상승 반전 약세
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 장중 큰 폭으로 상승했으나 매도세에 밀려 시가 근처까지
  //  하락. 역T자(⊥) 형태. 상승 추세 천장에서 나타나면 강력한
  //  반전 신호 (Nison: "gravestone doji at a top is a bearish signal").
  //  유성형보다 더 극단적인 형태.
  //
  detectGravestoneDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 도지 조건: body가 range의 5% 이하 (Nison 표준)
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 비석 도지: 상단 그림자가 range의 70% 이상, 하단 그림자 거의 없음
      if (upperShadow < range * PatternEngine.SPECIAL_DOJI_SHADOW_MIN) continue;
      if (lowerShadow > range * PatternEngine.SPECIAL_DOJI_COUNTER_MAX) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 상승 추세에서 발생 시 약세 반전 (하락 추세에서는 무시, ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const rangeScore = Math.min(range / a, 1);
      const confidence = this._quality({ body: 0.6, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: rangeScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr);

      results.push({
        type: 'gravestoneDoji', name: '비석 도지 (Gravestone Doji)', nameShort: '비석도지',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 상단꼬리 역T형 도지 — 천장 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  족집게 바닥 (Tweezer Bottom) — 강세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 2일 연속 동일 저가 수준에서 지지를 받음. 첫째 날 음봉으로
  //  하락했지만 둘째 날 같은 가격대에서 반등하며 양봉으로 마감.
  //  동일 가격대의 반복 지지는 해당 수준이 강력한 수요 영역임을 시사
  //  (Nison, 1991; Bulkowski: tweezer 바닥의 반전 성공률 ~57%).
  //
  detectTweezerBottom(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 음봉 (하락), 현봉: 양봉 (상승)
      if (prev.close >= prev.open) continue;
      if (curr.close <= curr.open) continue;

      const a = this._atr(atr, i, candles);

      // 두 봉 모두 유의미한 크기
      const prevBody = prev.open - prev.close;
      const currBody = curr.close - curr.open;
      if (prevBody < a * PatternEngine.TWEEZER_BODY_MIN ||
          currBody < a * PatternEngine.TWEEZER_BODY_MIN) continue;

      // 두 봉의 저가가 거의 동일 (ATR * 0.1 이내)
      const lowDiff = Math.abs(prev.low - curr.low);
      if (lowDiff > a * PatternEngine.TWEEZER_TOLERANCE) continue;

      // 하락 추세 확인 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'down') continue;

      // 품질 점수
      const matchScore = 1 - Math.min(lowDiff / (a * PatternEngine.TWEEZER_TOLERANCE), 1); // 저가 일치도
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: matchScore, volume: volumeScore, trend: trendScore });
      const stopLoss = +(Math.min(prev.low, curr.low) - a).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr);

      results.push({
        type: 'tweezerBottom', name: '족집게 바닥 (Tweezer Bottom)', nameShort: '족집게바닥',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 저가 반복 지지 — 바닥 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  족집게 천장 (Tweezer Top) — 약세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 2일 연속 동일 고가 수준에서 저항을 받음. 첫째 날 양봉으로
  //  상승했지만 둘째 날 같은 가격대에서 매도 압력을 받아 음봉으로 마감.
  //  동일 가격대의 반복 저항은 해당 수준이 강력한 공급 영역임을 시사.
  //  족집게 바닥의 약세 대칭 패턴 (Nison, 1991).
  //
  detectTweezerTop(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 5; i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 양봉 (상승), 현봉: 음봉 (하락)
      if (prev.close <= prev.open) continue;
      if (curr.close >= curr.open) continue;

      const a = this._atr(atr, i, candles);

      // 두 봉 모두 유의미한 크기
      const prevBody = prev.close - prev.open;
      const currBody = curr.open - curr.close;
      if (prevBody < a * PatternEngine.TWEEZER_BODY_MIN ||
          currBody < a * PatternEngine.TWEEZER_BODY_MIN) continue;

      // 두 봉의 고가가 거의 동일 (ATR * 0.1 이내)
      const highDiff = Math.abs(prev.high - curr.high);
      if (highDiff > a * PatternEngine.TWEEZER_TOLERANCE) continue;

      // 상승 추세 확인 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'up') continue;

      // 품질 점수
      const matchScore = 1 - Math.min(highDiff / (a * PatternEngine.TWEEZER_TOLERANCE), 1); // 고가 일치도
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: matchScore, volume: volumeScore, trend: trendScore });
      const stopLoss = +(Math.max(prev.high, curr.high) + a).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr);

      results.push({
        type: 'tweezerTop', name: '족집게 천장 (Tweezer Top)', nameShort: '족집게천장',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 고가 반복 저항 — 천장 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  마루보주 (Marubozu) — 강한 추세 지속
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 시가부터 종가까지 한 방향으로만 움직여 꼬리가
  //  거의 없는 봉. 매수(양봉) 또는 매도(음봉) 압력이 장 전체를
  //  지배했음을 의미. Nison(1991): "Marubozu represents one of
  //  the strongest single-candle continuation signals."
  //
  //  Bulkowski 통계:
  //    양봉 마루보주: 상승 지속 확률 ~72%
  //    음봉 마루보주: 하락 지속 확률 ~71%
  //

  detectMarubozu(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 마루보주 핵심 조건: body가 range의 85% 이상, 양끝 꼬리 각각 body의 2% 이하
      if (body < range * PatternEngine.MARUBOZU_BODY_RATIO) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (upperShadow > body * PatternEngine.MARUBOZU_SHADOW_MAX) continue;
      if (lowerShadow > body * PatternEngine.MARUBOZU_SHADOW_MAX) continue;

      const a = this._atr(atr, i, candles);
      // ATR 대비 유의미한 크기인지 확인 (MIN_RANGE_ATR 재활용)
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      const isBullish = c.close > c.open;
      const signal = isBullish ? 'buy' : 'sell';
      const type = isBullish ? 'bullishMarubozu' : 'bearishMarubozu';

      // 추세 맥락 (ATR 기반 정규화) — 추세 방향과 일치하면 지속 신호
      const trend = this._detectTrend(candles, i, 10, a);

      // 품질 점수 산출
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = 1 - Math.min((upperShadow + lowerShadow) / range, 1); // 꼬리 없을수록 높음
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      // 추세 일치 시 높은 점수, 반대 시 보수적
      const trendScore = (isBullish && trend.direction === 'up') || (!isBullish && trend.direction === 'down')
        ? Math.min(trend.strength, 1) : 0.3;

      // 기본 신뢰도 75, 거래량 확인 시 +10
      let confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      // [ACC] 거래량 확인: 전일 대비 1.2배 이상이면 +10% (Nison 거래량 원칙)
      if (i > 0 && c.volume > candles[i - 1].volume * 1.2) confidence = Math.min(confidence + 10, 100);

      // 손절가/목표가: body 높이 기반 (마루보주는 body ≈ range)
      const stopLoss = isBullish
        ? +(c.low - a * 1.5).toFixed(0)
        : +(c.high + a * 1.5).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, signal, 'strong', atr);

      results.push({
        type, name: isBullish ? '양봉 마루보주 (Bullish Marubozu)' : '음봉 마루보주 (Bearish Marubozu)',
        nameShort: isBullish ? '양봉마루보주' : '음봉마루보주',
        signal, strength: 'strong', confidence, stopLoss, priceTarget,
        description: isBullish
          ? `시가=저가, 종가=고가 — 매수 압력 극대화. 형태 점수 ${confidence}%`
          : `시가=고가, 종가=저가 — 매도 압력 극대화. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: {
          time: c.time,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: isBullish ? KRX_COLORS.PTN_MARKER_BUY : KRX_COLORS.PTN_MARKER_SELL,
          shape: isBullish ? 'arrowUp' : 'arrowDown',
          text: '',
        },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  팽이형 (Spinning Top) — 시장 우유부단
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 도지보다는 실체가 있으나 작고, 양쪽 꼬리가 실체
  //  이상으로 길어 매수/매도 어느 쪽도 우위를 점하지 못한 상태.
  //  Nison(1991): "Spinning tops represent indecision; they are
  //  especially important after a sustained advance or decline."
  //
  //  Bulkowski: 단독 패턴으로서 방향성 예측력은 낮으나 (51%),
  //  추세 말기에 출현하면 반전 확률 상승. 주로 다른 패턴과
  //  복합 신호로 사용 (예: 팽이형 + 볼린저밴드 수축).
  //

  detectSpinningTop(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const bodyRatio = body / range;
      // 팽이형: body가 range의 5~30% (도지보다 크고 보통 봉보다 작음)
      if (bodyRatio <= PatternEngine.SPINNING_BODY_MIN ||
          bodyRatio >= PatternEngine.SPINNING_BODY_MAX) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 양쪽 꼬리 모두 body의 50% 이상 (양방향 압력 존재)
      if (upperShadow < body * PatternEngine.SPINNING_SHADOW_RATIO) continue;
      if (lowerShadow < body * PatternEngine.SPINNING_SHADOW_RATIO) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 품질 점수 (중립 패턴 — 추세 불문)
      const shadowBalance = 1 - Math.abs(upperShadow - lowerShadow) / range; // 꼬리 균형도
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodySmallScore = 1 - bodyRatio; // body가 작을수록 우유부단
      const confidence = this._quality({ body: bodySmallScore, shadow: shadowBalance, volume: volumeScore, trend: 0.3, extra: 0.3 });

      results.push({
        type: 'spinningTop', name: '팽이형 (Spinning Top)', nameShort: '팽이형',
        signal: 'neutral', strength: 'weak', confidence,
        stopLoss: null, priceTarget: null,
        description: `작은 실체 + 긴 양쪽 꼬리 — 시장 우유부단. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  상승 삼각형 (Ascending Triangle)
  // ══════════════════════════════════════════════════
  detectAscendingTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 40);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 40);

    for (let i = 0; i < recentHighs.length - 1; i++) {
      const h1 = recentHighs[i], h2 = recentHighs[i + 1];
      const a = this._atr(atr, h2.index, candles);
      if (Math.abs(h1.price - h2.price) > a * 0.5) continue;

      const relevantLows = recentLows
        .filter(l => l.index >= h1.index - 2 && l.index <= h2.index + 2)
        .sort((a, b) => a.index - b.index);
      if (relevantLows.length < 2) continue;

      let ascending = true;
      for (let j = 1; j < relevantLows.length; j++) {
        if (relevantLows[j].price <= relevantLows[j - 1].price) { ascending = false; break; }
      }
      if (!ascending) continue;

      const resistanceLevel = (h1.price + h2.price) / 2;
      const startIdx = Math.min(h1.index, relevantLows[0].index);
      const endIdx = Math.max(h2.index, relevantLows[relevantLows.length - 1].index);
      if (endIdx >= candles.length) continue;

      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('ascendingTriangle', { body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantLows[relevantLows.length - 1].price - a).toFixed(0);
      const raw = resistanceLevel - relevantLows[0].price;
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);
      const priceTarget = +(resistanceLevel + patternHeight).toFixed(0);

      results.push({
        type: 'ascendingTriangle', name: '상승 삼각형 (Ascending Triangle)', nameShort: '상승삼각',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 저항 + 상승 지지 — 상방 돌파 가능. 형태 점수 ${confidence}%`,
        startIndex: startIdx, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
        trendlines: [
          { color: KRX_COLORS.DOWN, style: 'dashed', points: [
            { time: candles[h1.index].time, value: resistanceLevel },
            { time: candles[h2.index].time, value: resistanceLevel },
          ]},
          { color: KRX_COLORS.UP, style: 'dashed', points: [
            { time: candles[relevantLows[0].index].time, value: relevantLows[0].price },
            { time: candles[relevantLows[relevantLows.length - 1].index].time, value: relevantLows[relevantLows.length - 1].price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  하락 삼각형 (Descending Triangle)
  // ══════════════════════════════════════════════════
  detectDescendingTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 40);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 40);

    for (let i = 0; i < recentLows.length - 1; i++) {
      const l1 = recentLows[i], l2 = recentLows[i + 1];
      const a = this._atr(atr, l2.index, candles);
      if (Math.abs(l1.price - l2.price) > a * 0.5) continue;

      const relevantHighs = recentHighs
        .filter(h => h.index >= l1.index - 2 && h.index <= l2.index + 2)
        .sort((a, b) => a.index - b.index);
      if (relevantHighs.length < 2) continue;

      let descending = true;
      for (let j = 1; j < relevantHighs.length; j++) {
        if (relevantHighs[j].price >= relevantHighs[j - 1].price) { descending = false; break; }
      }
      if (!descending) continue;

      const supportLevel = (l1.price + l2.price) / 2;
      const startIdx = Math.min(l1.index, relevantHighs[0].index);
      const endIdx = Math.max(l2.index, relevantHighs[relevantHighs.length - 1].index);
      if (endIdx >= candles.length) continue;

      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('descendingTriangle', { body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantHighs[0].price + a).toFixed(0);
      const raw = relevantHighs[0].price - supportLevel;
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);
      const priceTarget = +(supportLevel - patternHeight).toFixed(0);

      results.push({
        type: 'descendingTriangle', name: '하락 삼각형 (Descending Triangle)', nameShort: '하락삼각',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 지지 + 하락 저항 — 하방 돌파 가능. 형태 점수 ${confidence}%`,
        startIndex: startIdx, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
        trendlines: [
          { color: KRX_COLORS.UP, style: 'dashed', points: [
            { time: candles[l1.index].time, value: supportLevel },
            { time: candles[l2.index].time, value: supportLevel },
          ]},
          { color: KRX_COLORS.DOWN, style: 'dashed', points: [
            { time: candles[relevantHighs[0].index].time, value: relevantHighs[0].price },
            { time: candles[relevantHighs[relevantHighs.length - 1].index].time, value: relevantHighs[relevantHighs.length - 1].price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  상승 쐐기 (Rising Wedge) — 하락 반전 경고
  // ══════════════════════════════════════════════════
  detectRisingWedge(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];
        if (h2.price <= h1.price || l2.price <= l1.price) continue;

        const a = this._atr(atr, h2.index, candles);
        const highSlope = (h2.price - h1.price) / (h2.index - h1.index) / a;
        const lowSlope = (l2.price - l1.price) / (l2.index - l1.index) / a;
        if (highSlope >= lowSlope) continue;

        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 8) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
        const confidence = this._adaptiveQuality('risingWedge', { body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(h2.price + a).toFixed(0);
        const wedgeHeight = h2.price - l2.price;
        const priceTarget = +(Math.max(l1.price, candles[endIdx].close - Math.min(wedgeHeight * hw * vw * mw * rw, wedgeHeight * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP))).toFixed(0);

        results.push({
          type: 'risingWedge', name: '상승 쐐기 (Rising Wedge)', nameShort: '상승쐐기',
          signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `상향 수렴 — 상승 피로, 하락 반전 가능. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  하락 쐐기 (Falling Wedge) — 상승 반전 기대
  // ══════════════════════════════════════════════════
  detectFallingWedge(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];
        if (h2.price >= h1.price || l2.price >= l1.price) continue;

        const a = this._atr(atr, h2.index, candles);
        const highSlope = Math.abs(h2.price - h1.price) / (h2.index - h1.index) / a;
        const lowSlope = Math.abs(l2.price - l1.price) / (l2.index - l1.index) / a;
        if (highSlope >= lowSlope) continue;

        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 8) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
        const confidence = this._adaptiveQuality('fallingWedge', { body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(l2.price - a).toFixed(0);
        const wedgeHeight = h2.price - l2.price;
        const priceTarget = +(Math.min(h1.price, candles[endIdx].close + Math.min(wedgeHeight * hw * vw * mw * rw, wedgeHeight * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP))).toFixed(0);

        results.push({
          type: 'fallingWedge', name: '하락 쐐기 (Falling Wedge)', nameShort: '하락쐐기',
          signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `하향 수렴 — 하락 피로, 상승 반전 가능. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  대칭 삼각형 (Symmetric Triangle) — 중립 수렴
  //  시장 심리: 매수세와 매도세가 균형을 이루며 가격 범위가 점진적으로
  //  축소. 고점은 낮아지고(하향 저항) 저점은 높아지는(상향 지지) 대칭
  //  수렴 형태. 에너지 압축이 극에 달하면 어느 방향이든 폭발적 돌파 발생.
  //  Bulkowski 통계: 54%가 상방 돌파, 목표가 = 삼각형 높이의 측정 이동.
  // ══════════════════════════════════════════════════
  detectSymmetricTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    // 최근 50봉 내 스윙 포인트만 사용
    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];

        // 핵심 조건: 고점 하락(저항선 하향) + 저점 상승(지지선 상향)
        if (h2.price >= h1.price) continue;  // 고점이 낮아져야 함
        if (l2.price <= l1.price) continue;  // 저점이 높아져야 함

        const a = this._atr(atr, h2.index, candles);

        // ATR 정규화 기울기 계산
        const highSlope = (h2.price - h1.price) / (h2.index - h1.index) / a;   // 음수 (하향)
        const lowSlope = (l2.price - l1.price) / (l2.index - l1.index) / a;    // 양수 (상향)

        // 기울기 의미 유효성: 너무 완만하면 횡보, 삼각형이 아님
        if (Math.abs(highSlope) < 0.01 || Math.abs(lowSlope) < 0.01) continue;

        // 대칭성 검증: 두 기울기 절대값의 비율이 0.3~3.0 사이
        // 비율이 이 범위를 벗어나면 상승/하락 삼각형이나 쐐기에 더 가까움
        const slopeRatio = Math.abs(highSlope) / Math.abs(lowSlope);
        if (slopeRatio < 0.3 || slopeRatio > 3.0) continue;

        // 최소 패턴 폭: 10봉 이상 (충분한 수렴 기간)
        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 10) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        // 거래량 분석: 삼각형 내부에서 거래량 감소가 전형적 (수렴 에너지 압축)
        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);

        // 대칭성이 좋을수록 신뢰도 보너스 (1.0에 가까울수록 완벽한 대칭)
        const symmetryScore = 1 - Math.abs(1 - slopeRatio) / 2;
        const confidence = this._adaptiveQuality('symmetricTriangle', { body: 0.6, volume: volumeScore, trend: 0.5, extra: symmetryScore });

        results.push({
          type: 'symmetricTriangle', name: '대칭 삼각형 (Symmetric Triangle)', nameShort: '대칭삼각',
          signal: 'neutral', strength: 'medium', confidence,
          stopLoss: null, priceTarget: null,
          description: `대칭 수렴 — 매수·매도 균형, 방향 돌파 대기. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;  // 한 쌍 발견 시 내부 루프 탈출 (중복 방지)
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  이중 바닥 (Double Bottom) — 강한 지지
  // ══════════════════════════════════════════════════
  detectDoubleBottom(candles, swingLows, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;
    const recent = swingLows.filter(l => l.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const l1 = recent[i], l2 = recent[i + 1];
      const a = this._atr(atr, l2.index, candles);
      if (Math.abs(l1.price - l2.price) > a * 1.0) continue;

      const span = l2.index - l1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 저점 사이 최고 종가 — 꼬리 봉 과대 산정 방지)
      let neckline = 0;
      for (let j = l1.index; j <= l2.index; j++) {
        if (candles[j].close > neckline) neckline = candles[j].close;
      }
      const raw = neckline - Math.min(l1.price, l2.price);
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);

      const volumeScore = Math.min(this._volRatio(candles, l2.index, vma) / 2, 1);
      const confidence = this._adaptiveQuality('doubleBottom', { body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(l1.price - l2.price) / a });
      const stopLoss = +(Math.min(l1.price, l2.price) - a).toFixed(0);
      const priceTarget = +(neckline + patternHeight).toFixed(0);

      results.push({
        type: 'doubleBottom', name: '이중 바닥 (Double Bottom)', nameShort: '이중바닥',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        neckline: neckline,
        description: `W형 바닥 — 강한 지지 확인. 형태 점수 ${confidence}%`,
        startIndex: l1.index, endIndex: l2.index,
        marker: { time: candles[l2.index].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  이중 천장 (Double Top) — 강한 저항
  // ══════════════════════════════════════════════════
  detectDoubleTop(candles, swingHighs, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;
    const recent = swingHighs.filter(h => h.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const h1 = recent[i], h2 = recent[i + 1];
      const a = this._atr(atr, h2.index, candles);
      if (Math.abs(h1.price - h2.price) > a * 1.0) continue;

      const span = h2.index - h1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 고점 사이 최저 종가 — 꼬리 봉 과대 산정 방지)
      let neckline = Infinity;
      for (let j = h1.index; j <= h2.index; j++) {
        if (candles[j].close < neckline) neckline = candles[j].close;
      }
      const raw = Math.max(h1.price, h2.price) - neckline;
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);

      const volumeScore = Math.min(this._volRatio(candles, h2.index, vma) / 2, 1);
      const confidence = this._adaptiveQuality('doubleTop', { body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(h1.price - h2.price) / a });
      const stopLoss = +(Math.max(h1.price, h2.price) + a).toFixed(0);
      const priceTarget = +(neckline - patternHeight).toFixed(0);

      results.push({
        type: 'doubleTop', name: '이중 천장 (Double Top)', nameShort: '이중천장',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        neckline: neckline,
        description: `M형 천장 — 강한 저항 확인. 형태 점수 ${confidence}%`,
        startIndex: h1.index, endIndex: h2.index,
        marker: { time: candles[h2.index].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  머리어깨형 (Head & Shoulders) — 강한 하락 반전
  // ══════════════════════════════════════════════════
  detectHeadAndShoulders(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 3 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const rH = swingHighs.filter(h => h.index >= candles.length - 60);
    const rL = swingLows.filter(l => l.index >= candles.length - 60);

    for (let i = 0; i < rH.length - 2; i++) {
      const ls = rH[i], head = rH[i + 1], rs = rH[i + 2];
      if (head.price <= ls.price || head.price <= rs.price) continue;
      if (Math.abs(ls.price - rs.price) / head.price > 0.05) continue;

      const t1 = rL.find(l => l.index > ls.index && l.index < head.index);
      const t2 = rL.find(l => l.index > head.index && l.index < rs.index);
      if (!t1 || !t2) continue;

      const endIdx = Math.min(rs.index + 3, candles.length - 1);
      const neckSlope = (t2.price - t1.price) / (t2.index - t1.index);
      const neckAtEnd = t1.price + neckSlope * (endIdx - t1.index);
      const lastClose = candles[endIdx].close;

      // 넥라인 근처 또는 이탈 확인
      const a = this._atr(atr, endIdx, candles);
      if (lastClose > neckAtEnd + a * 0.5) continue;

      const raw = head.price - (t1.price + t2.price) / 2;
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);
      const priceTarget = +(neckAtEnd - patternHeight).toFixed(0);
      const symmetry = 1 - Math.abs(ls.price - rs.price) / head.price * 10;
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('headAndShoulders', { body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: 0.7, shadow: Math.max(symmetry, 0) });

      results.push({
        type: 'headAndShoulders', name: '머리어깨형 (Head & Shoulders)', nameShort: 'H&S',
        signal: 'sell', strength: 'strong', confidence,
        stopLoss: Math.round(rs.price + a * 1.5), priceTarget,  // 우측 어깨 + 1.5 ATR (head 대비 합리적 손절)
        description: `머리어깨 — 강한 하락 반전. 형태 점수 ${confidence}%`,
        startIndex: ls.index, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
        trendlines: [
          { color: KRX_COLORS.PTN_STRUCT, style: 'dashed', points: [
            { time: candles[t1.index].time, value: t1.price },
            { time: candles[t2.index].time, value: t2.price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  역머리어깨형 (Inverse H&S) — 강한 상승 반전
  // ══════════════════════════════════════════════════
  detectInverseHeadAndShoulders(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingLows.length < 3 || swingHighs.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, volWeight: vw = 1, meanRevWeight: mw = 1, regimeWeight: rw = 1 } = ctx;

    const rL = swingLows.filter(l => l.index >= candles.length - 60);
    const rH = swingHighs.filter(h => h.index >= candles.length - 60);

    for (let i = 0; i < rL.length - 2; i++) {
      const ls = rL[i], head = rL[i + 1], rs = rL[i + 2];
      if (head.price >= ls.price || head.price >= rs.price) continue;
      if (Math.abs(ls.price - rs.price) / ls.price > 0.05) continue;

      const t1 = rH.find(h => h.index > ls.index && h.index < head.index);
      const t2 = rH.find(h => h.index > head.index && h.index < rs.index);
      if (!t1 || !t2) continue;

      const endIdx = Math.min(rs.index + 3, candles.length - 1);
      const neckSlope = (t2.price - t1.price) / (t2.index - t1.index);
      const neckAtEnd = t1.price + neckSlope * (endIdx - t1.index);
      const lastClose = candles[endIdx].close;
      const a = this._atr(atr, endIdx, candles);
      if (lastClose < neckAtEnd - a * 0.5) continue;

      const raw = (t1.price + t2.price) / 2 - head.price;
      const patternHeight = Math.min(raw * hw * vw * mw * rw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * PatternEngine.CHART_TARGET_ATR_CAP);
      const priceTarget = +(neckAtEnd + patternHeight).toFixed(0);
      const symmetry = 1 - Math.abs(ls.price - rs.price) / ls.price * 10;
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('inverseHeadAndShoulders', { body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: 0.7, shadow: Math.max(symmetry, 0) });

      results.push({
        type: 'inverseHeadAndShoulders', name: '역머리어깨형 (Inverse H&S)', nameShort: '역H&S',
        signal: 'buy', strength: 'strong', confidence,
        stopLoss: Math.round(rs.price - a * 1.5), priceTarget,  // 우측 어깨 - 1.5 ATR (head 대비 합리적 손절)
        description: `역머리어깨 — 강한 상승 반전. 형태 점수 ${confidence}%`,
        startIndex: ls.index, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
        trendlines: [
          { color: KRX_COLORS.PTN_STRUCT, style: 'dashed', points: [
            { time: candles[t1.index].time, value: t1.price },
            { time: candles[t2.index].time, value: t2.price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  지지/저항 수준 탐지
  // ══════════════════════════════════════════════════
  detectSupportResistance(candles, swingHighs, swingLows, ctx = {}) {
    const { atr = [] } = ctx;
    const lastATR = atr[candles.length - 1] || candles[candles.length - 1].close * 0.02;
    const tol = lastATR * 0.5;

    const pts = [
      ...swingHighs.map(h => ({ price: h.price, type: 'resistance' })),
      ...swingLows.map(l => ({ price: l.price, type: 'support' })),
    ];

    const levels = [];
    const used = new Set();
    for (let i = 0; i < pts.length; i++) {
      if (used.has(i)) continue;
      const cluster = [pts[i]];
      for (let j = i + 1; j < pts.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(pts[j].price - pts[i].price) < tol) {
          cluster.push(pts[j]);
          used.add(j);
        }
      }
      used.add(i);
      if (cluster.length >= 2) {
        const avg = cluster.reduce((s, p) => s + p.price, 0) / cluster.length;
        const sCount = cluster.filter(p => p.type === 'support').length;
        levels.push({
          price: +avg.toFixed(0),
          type: sCount >= cluster.length / 2 ? 'support' : 'resistance',
          touches: cluster.length,
          strength: Math.min(cluster.length / 4, 1),
        });
      }
    }
    return levels.sort((a, b) => b.touches - a.touches).slice(0, 10);
  }

  // ══════════════════════════════════════════════════
  //  컨플루언스 점수 보정
  // ══════════════════════════════════════════════════
  _applyConfluence(patterns, srLevels, ctx = {}) {
    if (!srLevels || !srLevels.length) return;
    const { atr = [] } = ctx;

    patterns.forEach(p => {
      if (!p.confidence || !p.endIndex) return;
      const a = atr[p.endIndex] || 1;
      let boost = 0;

      for (const sr of srLevels) {
        if (p.signal === 'buy' && sr.type === 'support' && p.stopLoss) {
          if (Math.abs(p.stopLoss - sr.price) < a) boost += 3 * sr.strength;
        }
        if (p.signal === 'sell' && sr.type === 'resistance' && p.stopLoss) {
          if (Math.abs(p.stopLoss - sr.price) < a) boost += 3 * sr.strength;
        }
        if (p.priceTarget) {
          if (Math.abs(p.priceTarget - sr.price) < a) boost += 2 * sr.strength;
        }
      }

      if (boost > 0) {
        p.confidence = Math.min(100, p.confidence + Math.round(boost));
        p.confluence = true;
      }
    });
  }

  /** R:R 검증 게이트 — R:R < 1.0이면 confidence 감산
   *  전망이론 (Kahneman & Tversky 1979): λ=2.25, 투자자는 손실을
   *  이익의 2.25배로 인지. 켈리 기준: 최소 R:R ≥ 1.5 권장. */
  _applyRRGate(patterns, candles) {
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (!p.priceTarget || !p.stopLoss || !p.endIndex) continue;
      var entry = candles[p.endIndex] ? candles[p.endIndex].close : null;
      if (!entry) continue;
      var reward = Math.abs(p.priceTarget - entry);
      var risk = Math.abs(entry - p.stopLoss);
      if (risk <= 0) continue;
      var rr = reward / risk;
      if (rr < 1.0) {
        p.confidence = Math.max(10, p.confidence - 15);
      } else if (rr < 1.5) {
        p.confidence = Math.max(10, p.confidence - 5);
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  유틸리티: 스윙 포인트 & 중복 제거
  // ══════════════════════════════════════════════════

  _findSwingHighs(candles, lookback) {
    const highs = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      let isHigh = true;
      for (let j = 1; j <= lookback; j++) {
        if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
          isHigh = false; break;
        }
      }
      if (isHigh) highs.push({ index: i, price: candles[i].high, time: candles[i].time });
    }
    return highs;
  }

  _findSwingLows(candles, lookback) {
    const lows = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      let isLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
          isLow = false; break;
        }
      }
      if (isLow) lows.push({ index: i, price: candles[i].low, time: candles[i].time });
    }
    return lows;
  }

  _dedup(patterns) {
    const seen = new Set();
    return patterns.filter(p => {
      const key = `${p.type}-${p.endIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// 글로벌 인스턴스
const patternEngine = new PatternEngine();
