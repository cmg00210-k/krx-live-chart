// ══════════════════════════════════════════════════════
//  기술적 패턴 인식 엔진 v2.0
// ══════════════════════════════════════════════════════
//
//  Phase 2: 거래량확인, ATR정규화, 추세맥락, 품질점수
//  Phase 3: 손절가, 목표가, 리스크리워드
//  Phase 4: 교수형, 유성형, 잉태형, 머리어깨, 지지/저항, 컨플루언스
//  Phase 8: 관통형, 먹구름형, 잠자리도지, 비석도지, 족집게바닥/천장
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
    // atrVal이 없으면 가격 평균의 1%를 fallback (기존 동작 유지)
    const divisor = atrVal && atrVal > 0 ? atrVal : (sy / n * 0.01);
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

  /** ATR 기반 손절가 */
  _stopLoss(candles, idx, signal, atr, mult = PatternEngine.STOP_LOSS_ATR_MULT) {
    const p = candles[idx].close;
    const a = atr[idx] || p * PatternEngine.ATR_FALLBACK_PCT;
    return signal === 'buy' ? +(p - a * mult).toFixed(0)
         : signal === 'sell' ? +(p + a * mult).toFixed(0) : null;
  }

  /** 패턴 높이 기반 목표가 */
  _target(candles, si, ei, signal) {
    const seg = candles.slice(si, ei + 1);
    const h = Math.max(...seg.map(c => c.high));
    const l = Math.min(...seg.map(c => c.low));
    const entry = candles[ei].close;
    // Bulkowski "measured move": 패턴 높이의 1.0배가 표준 목표가
    // 1.5x는 목표가 과대 추정 → 리스크-리워드 왜곡 및 매도 타이밍 지연
    return signal === 'buy' ? +(entry + (h - l) * 1.0).toFixed(0)
         : signal === 'sell' ? +(entry - (h - l) * 1.0).toFixed(0) : null;
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
    const ctx = { atr: calcATR(candles), vma: calcMA(candles.map(c => c.volume), 20) };
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
    patterns.push(...this.detectHeadAndShoulders(candles, swH, swL, ctx));
    patterns.push(...this.detectInverseHeadAndShoulders(candles, swH, swL, ctx));

    // 지지/저항 + 컨플루언스
    const sr = this.detectSupportResistance(candles, swH, swL, ctx);
    this._applyConfluence(patterns, sr, ctx);

    return this._dedup(patterns);
  }

  // ══════════════════════════════════════════════════
  //  적삼병 (Three White Soldiers) — 강한 매수
  // ══════════════════════════════════════════════════
  detectThreeWhiteSoldiers(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
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
      const priceTarget = this._target(candles, i - 2, i, 'buy');

      results.push({
        type: 'threeWhiteSoldiers', name: '적삼병 (Three White Soldiers)', nameShort: '적삼병',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 양봉 상승 — 강한 매수 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 2, i, 'sell');

      results.push({
        type: 'threeBlackCrows', name: '흑삼병 (Three Black Crows)', nameShort: '흑삼병',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 음봉 하락 — 강한 매도 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i, i, 'buy');

      results.push({
        type: 'hammer', name: '해머 (Hammer)', nameShort: '해머',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 아래꼬리 — 하락 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i, i, 'buy');

      results.push({
        type: 'invertedHammer', name: '역해머 (Inverted Hammer)', nameShort: '역해머',
        signal: 'buy', strength: 'weak', confidence, stopLoss, priceTarget,  // Bulkowski: 승률 ~50%
        description: `긴 윗꼬리 — 하락 반전 가능 신호. 신뢰도 ${confidence}%`,
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
      if (lowerShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          upperShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 상승 추세 확인 (해머와 반대, ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      // Nison 필수 조건: 다음 봉이 확인 캔들 (종가가 교수형 종가 아래)
      const hasConfirm = (i + 1 < candles.length) && (candles[i + 1].close < c.close);
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confirmBonus = hasConfirm ? 0.3 : 0;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: confirmBonus });
      const strength = hasConfirm ? 'strong' : 'weak';  // 확인 캔들 없으면 약한 신호
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._target(candles, i, i, 'sell');

      results.push({
        type: 'hangingMan', name: '교수형 (Hanging Man)', nameShort: '교수형',
        signal: 'sell', strength, confidence, stopLoss, priceTarget,
        description: `상승 후 긴 아래꼬리${hasConfirm ? ' + 확인 캔들' : ''} — 하락 반전 경고. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i, i, 'sell');

      results.push({
        type: 'shootingStar', name: '유성형 (Shooting Star)', nameShort: '유성형',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `상승 후 긴 윗꼬리 — 하락 반전 경고. 신뢰도 ${confidence}%`,
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
      // [ACC] Doji ATR 정규화: 저변동성 도지는 품질 감산 (노이즈 방지)
      const atrPenalty = range < a * 0.3 ? 0.7 : 1.0;
      const confidence = Math.round(this._quality({ body: 0.5, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.5 }) * atrPenalty);

      results.push({
        type: 'doji', name: '도지 (Doji)', nameShort: '도지',
        signal, strength: 'weak', confidence,
        stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
        priceTarget: signal !== 'neutral' ? this._target(candles, i, i, signal) : null,
        description: `시가 ≈ 종가 — 추세 전환 가능. 신뢰도 ${confidence}%`,
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
            priceTarget: this._target(candles, i - 1, i, 'buy'),
            description: `양봉이 음봉을 감싸 — 강한 상승 반전. 신뢰도 ${confidence}%`,
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
            priceTarget: this._target(candles, i - 1, i, 'sell'),
            description: `음봉이 양봉을 감싸 — 강한 하락 반전. 신뢰도 ${confidence}%`,
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
          // [ACC] 하라미 3캔들 확인: 다음 캔들이 현재 종가 위로 마감하면 확인됨
          const hasConfirm = (i + 1 < candles.length) && candles[i + 1].close > curr.close;
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          if (!hasConfirm) quality = Math.round(quality * 0.8);  // 미확인 시 20% 감산
          results.push({
            type: 'bullishHarami', name: '상승잉태형 (Bullish Harami)', nameShort: '상승잉태',
            signal: 'buy', strength: 'medium', confidence: quality, confirmed: hasConfirm,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._target(candles, i - 1, i, 'buy'),
            description: `작은 양봉이 음봉 내에 — 반전 가능. ${hasConfirm ? '확인됨' : '미확인'}. 신뢰도 ${quality}%`,
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
          // [ACC] 하라미 3캔들 확인: 다음 캔들이 현재 종가 아래로 마감하면 확인됨
          const hasConfirm = (i + 1 < candles.length) && candles[i + 1].close < curr.close;
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          if (!hasConfirm) quality = Math.round(quality * 0.8);  // 미확인 시 20% 감산
          results.push({
            type: 'bearishHarami', name: '하락잉태형 (Bearish Harami)', nameShort: '하락잉태',
            signal: 'sell', strength: 'medium', confidence: quality, confirmed: hasConfirm,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._target(candles, i - 1, i, 'sell'),
            description: `작은 음봉이 양봉 내에 — 반전 가능. ${hasConfirm ? '확인됨' : '미확인'}. 신뢰도 ${quality}%`,
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
      const priceTarget = this._target(candles, i - 2, i, 'buy');

      results.push({
        type: 'morningStar', name: '샛별형 (Morning Star)', nameShort: '샛별형',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `음봉 → 소형봉 → 양봉 — 3봉 바닥 반전. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 2, i, 'sell');

      results.push({
        type: 'eveningStar', name: '석별형 (Evening Star)', nameShort: '석별형',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `양봉 → 소형봉 → 음봉 — 3봉 천장 반전. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 1, i, 'buy');

      results.push({
        type: 'piercingLine', name: '관통형 (Piercing Line)', nameShort: '관통형',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭다운 후 전봉 50% 이상 회복 — 강세 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 1, i, 'sell');

      results.push({
        type: 'darkCloud', name: '먹구름형 (Dark Cloud Cover)', nameShort: '먹구름',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭업 후 전봉 50% 이하 하락 — 약세 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i, i, 'buy');

      results.push({
        type: 'dragonflyDoji', name: '잠자리 도지 (Dragonfly Doji)', nameShort: '잠자리도지',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 하단꼬리 T형 도지 — 바닥 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i, i, 'sell');

      results.push({
        type: 'gravestoneDoji', name: '비석 도지 (Gravestone Doji)', nameShort: '비석도지',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 상단꼬리 역T형 도지 — 천장 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 1, i, 'buy');

      results.push({
        type: 'tweezerBottom', name: '족집게 바닥 (Tweezer Bottom)', nameShort: '족집게바닥',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 저가 반복 지지 — 바닥 반전 신호. 신뢰도 ${confidence}%`,
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
      const priceTarget = this._target(candles, i - 1, i, 'sell');

      results.push({
        type: 'tweezerTop', name: '족집게 천장 (Tweezer Top)', nameShort: '족집게천장',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 고가 반복 저항 — 천장 반전 신호. 신뢰도 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
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
    const { atr = [], vma = [] } = ctx;

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
      const confidence = this._quality({ body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantLows[relevantLows.length - 1].price - a).toFixed(0);
      const patternHeight = resistanceLevel - relevantLows[0].price;
      const priceTarget = +(resistanceLevel + patternHeight).toFixed(0);

      results.push({
        type: 'ascendingTriangle', name: '상승 삼각형 (Ascending Triangle)', nameShort: '상승삼각',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 저항 + 상승 지지 — 상방 돌파 가능. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;

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
      const confidence = this._quality({ body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantHighs[0].price + a).toFixed(0);
      const patternHeight = relevantHighs[0].price - supportLevel;
      const priceTarget = +(supportLevel - patternHeight).toFixed(0);

      results.push({
        type: 'descendingTriangle', name: '하락 삼각형 (Descending Triangle)', nameShort: '하락삼각',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 지지 + 하락 저항 — 하방 돌파 가능. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;

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
        const confidence = this._quality({ body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(h2.price + a).toFixed(0);
        const priceTarget = +(l1.price).toFixed(0);

        results.push({
          type: 'risingWedge', name: '상승 쐐기 (Rising Wedge)', nameShort: '상승쐐기',
          signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `상향 수렴 — 상승 피로, 하락 반전 가능. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;

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
        const confidence = this._quality({ body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(l2.price - a).toFixed(0);
        const priceTarget = +(h1.price).toFixed(0);

        results.push({
          type: 'fallingWedge', name: '하락 쐐기 (Falling Wedge)', nameShort: '하락쐐기',
          signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `하향 수렴 — 하락 피로, 상승 반전 가능. 신뢰도 ${confidence}%`,
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
  //  이중 바닥 (Double Bottom) — 강한 지지
  // ══════════════════════════════════════════════════
  detectDoubleBottom(candles, swingLows, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    const recent = swingLows.filter(l => l.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const l1 = recent[i], l2 = recent[i + 1];
      const a = this._atr(atr, l2.index, candles);
      if (Math.abs(l1.price - l2.price) > a * 1.0) continue;

      const span = l2.index - l1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 저점 사이 최고점)
      let neckline = 0;
      for (let j = l1.index; j <= l2.index; j++) {
        if (candles[j].high > neckline) neckline = candles[j].high;
      }
      const patternHeight = neckline - Math.min(l1.price, l2.price);

      const volumeScore = Math.min(this._volRatio(candles, l2.index, vma) / 2, 1);
      const confidence = this._quality({ body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(l1.price - l2.price) / a });
      const stopLoss = +(Math.min(l1.price, l2.price) - a).toFixed(0);
      const priceTarget = +(neckline + patternHeight).toFixed(0);

      results.push({
        type: 'doubleBottom', name: '이중 바닥 (Double Bottom)', nameShort: '이중바닥',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `W형 바닥 — 강한 지지 확인. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;
    const recent = swingHighs.filter(h => h.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const h1 = recent[i], h2 = recent[i + 1];
      const a = this._atr(atr, h2.index, candles);
      if (Math.abs(h1.price - h2.price) > a * 1.0) continue;

      const span = h2.index - h1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 고점 사이 최저점)
      let neckline = Infinity;
      for (let j = h1.index; j <= h2.index; j++) {
        if (candles[j].low < neckline) neckline = candles[j].low;
      }
      const patternHeight = Math.max(h1.price, h2.price) - neckline;

      const volumeScore = Math.min(this._volRatio(candles, h2.index, vma) / 2, 1);
      const confidence = this._quality({ body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(h1.price - h2.price) / a });
      const stopLoss = +(Math.max(h1.price, h2.price) + a).toFixed(0);
      const priceTarget = +(neckline - patternHeight).toFixed(0);

      results.push({
        type: 'doubleTop', name: '이중 천장 (Double Top)', nameShort: '이중천장',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `M형 천장 — 강한 저항 확인. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;

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

      const patternHeight = head.price - (t1.price + t2.price) / 2;
      const priceTarget = +(neckAtEnd - patternHeight).toFixed(0);
      const symmetry = 1 - Math.abs(ls.price - rs.price) / head.price * 10;
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._quality({ body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: 0.7, shadow: Math.max(symmetry, 0) });

      results.push({
        type: 'headAndShoulders', name: '머리어깨형 (Head & Shoulders)', nameShort: 'H&S',
        signal: 'sell', strength: 'strong', confidence,
        stopLoss: +(head.price).toFixed(0), priceTarget,
        description: `머리어깨 — 강한 하락 반전. 신뢰도 ${confidence}%`,
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
    const { atr = [], vma = [] } = ctx;

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

      const patternHeight = (t1.price + t2.price) / 2 - head.price;
      const priceTarget = +(neckAtEnd + patternHeight).toFixed(0);
      const symmetry = 1 - Math.abs(ls.price - rs.price) / ls.price * 10;
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._quality({ body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: 0.7, shadow: Math.max(symmetry, 0) });

      results.push({
        type: 'inverseHeadAndShoulders', name: '역머리어깨형 (Inverse H&S)', nameShort: '역H&S',
        signal: 'buy', strength: 'strong', confidence,
        stopLoss: +(head.price).toFixed(0), priceTarget,
        description: `역머리어깨 — 강한 상승 반전. 신뢰도 ${confidence}%`,
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
