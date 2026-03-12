// ══════════════════════════════════════════════════════
//  기술적 패턴 인식 엔진 v2.0
// ══════════════════════════════════════════════════════
//
//  Phase 2: 거래량확인, ATR정규화, 추세맥락, 품질점수
//  Phase 3: 손절가, 목표가, 리스크리워드
//  Phase 4: 교수형, 유성형, 잉태형, 머리어깨, 지지/저항, 컨플루언스
//
// ══════════════════════════════════════════════════════

class PatternEngine {

  // ══════════════════════════════════════════════════
  //  유틸리티
  // ══════════════════════════════════════════════════

  /** ATR (Average True Range) — Wilder 평활 */
  _calcATR(candles, period = 14) {
    const atr = new Array(candles.length).fill(null);
    if (candles.length < 2) return atr;
    const tr = [candles[0].high - candles[0].low];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i], p = candles[i - 1];
      tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }
    if (candles.length < period) return atr;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += tr[i];
    atr[period - 1] = sum / period;
    for (let i = period; i < candles.length; i++) {
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }
    return atr;
  }

  /** 선형 추세 감지 */
  _detectTrend(candles, endIndex, lookback = 10) {
    const start = Math.max(0, endIndex - lookback);
    if (endIndex - start < 3) return { slope: 0, strength: 0, direction: 'neutral' };
    const seg = candles.slice(start, endIndex);
    const n = seg.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let i = 0; i < n; i++) {
      sx += i; sy += seg[i].close; sxy += i * seg[i].close; sx2 += i * i;
    }
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const norm = slope / (sy / n * 0.01);
    return {
      slope,
      strength: Math.abs(norm),
      direction: norm > 0.3 ? 'up' : norm < -0.3 ? 'down' : 'neutral',
    };
  }

  /** 거래량 이동평균 */
  _calcVolumeMA(candles, period = 20) {
    const vma = new Array(candles.length).fill(null);
    for (let i = period - 1; i < candles.length; i++) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += candles[j].volume;
      vma[i] = s / period;
    }
    return vma;
  }

  /** 거래량 비율 (현재 / MA) */
  _volRatio(candles, idx, vma) {
    if (!vma || !vma[idx] || vma[idx] === 0) return 1;
    return candles[idx].volume / vma[idx];
  }

  /** 다요인 품질 점수 (0-100) */
  _quality({ body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.5 }) {
    const raw = 0.25 * body + 0.25 * volume + 0.20 * trend + 0.15 * shadow + 0.15 * extra;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }

  /** ATR 기반 손절가 */
  _stopLoss(candles, idx, signal, atr, mult = 2) {
    const p = candles[idx].close;
    const a = atr[idx] || p * 0.02;
    return signal === 'buy' ? +(p - a * mult).toFixed(0)
         : signal === 'sell' ? +(p + a * mult).toFixed(0) : null;
  }

  /** 패턴 높이 기반 목표가 */
  _target(candles, si, ei, signal) {
    const seg = candles.slice(si, ei + 1);
    const h = Math.max(...seg.map(c => c.high));
    const l = Math.min(...seg.map(c => c.low));
    const entry = candles[ei].close;
    return signal === 'buy' ? +(entry + (h - l) * 1.5).toFixed(0)
         : signal === 'sell' ? +(entry - (h - l) * 1.5).toFixed(0) : null;
  }

  /** ATR 값 (fallback 포함) */
  _atr(atr, idx, candles) {
    return atr[idx] || candles[idx].close * 0.02;
  }

  // ══════════════════════════════════════════════════
  //  전체 분석
  // ══════════════════════════════════════════════════

  analyze(candles) {
    if (!candles || candles.length < 10) return [];
    const ctx = { atr: this._calcATR(candles), vma: this._calcVolumeMA(candles) };
    const patterns = [];

    // 캔들 패턴
    patterns.push(...this.detectThreeWhiteSoldiers(candles, ctx));
    patterns.push(...this.detectThreeBlackCrows(candles, ctx));
    patterns.push(...this.detectHammer(candles, ctx));
    patterns.push(...this.detectInvertedHammer(candles, ctx));
    patterns.push(...this.detectHangingMan(candles, ctx));
    patterns.push(...this.detectShootingStar(candles, ctx));
    patterns.push(...this.detectDoji(candles, ctx));
    patterns.push(...this.detectEngulfing(candles, ctx));
    patterns.push(...this.detectHarami(candles, ctx));
    patterns.push(...this.detectMorningStar(candles, ctx));
    patterns.push(...this.detectEveningStar(candles, ctx));

    // 차트 패턴
    const swH = this._findSwingHighs(candles, 3);
    const swL = this._findSwingLows(candles, 3);
    patterns.push(...this.detectAscendingTriangle(candles, swH, swL, ctx));
    patterns.push(...this.detectDescendingTriangle(candles, swH, swL, ctx));
    patterns.push(...this.detectRisingWedge(candles, swH, swL, ctx));
    patterns.push(...this.detectFallingWedge(candles, swH, swL, ctx));
    patterns.push(...this.detectDoubleBottom(candles, swL, ctx));
    patterns.push(...this.detectDoubleTop(candles, swH, ctx));
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
      if (b0 < a * 0.3 || b1 < a * 0.3 || b2 < a * 0.3) continue;

      const w0 = c0.high - c0.close, w1 = c1.high - c1.close, w2 = c2.high - c2.close;
      if (w0 > b0 * 0.5 || w1 > b1 * 0.5 || w2 > b2 * 0.5) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const shadowScore = 1 - Math.min((w0 / b0 + w1 / b1 + w2 / b2) / 3, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._target(candles, i - 2, i, 'buy');

      results.push({
        type: 'threeWhiteSoldiers', name: '적삼병 (Three White Soldiers)', nameShort: '적삼병',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 양봉 상승 — 강한 매수 신호. 신뢰도 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `적삼병 ${confidence}%` },
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
      if (b0 < a * 0.3 || b1 < a * 0.3 || b2 < a * 0.3) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10);
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._target(candles, i - 2, i, 'sell');

      results.push({
        type: 'threeBlackCrows', name: '흑삼병 (Three Black Crows)', nameShort: '흑삼병',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 음봉 하락 — 강한 매도 신호. 신뢰도 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `흑삼병 ${confidence}%` },
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
      if (lowerShadow < body * 2 || upperShadow > body * 0.3 || body < range * 0.1) continue;

      // 하락 추세 확인
      const trend = this._detectTrend(candles, i, 10);
      if (trend.direction !== 'down') continue;

      const a = this._atr(atr, i, candles);
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
        marker: { time: c.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `해머 ${confidence}%` },
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
      if (upperShadow < body * 2 || lowerShadow > body * 0.3 || body < range * 0.1) continue;

      const trend = this._detectTrend(candles, i, 10);
      if (trend.direction !== 'down') continue;

      const a = this._atr(atr, i, candles);
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._target(candles, i, i, 'buy');

      results.push({
        type: 'invertedHammer', name: '역해머 (Inverted Hammer)', nameShort: '역해머',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 윗꼬리 — 하락 반전 가능 신호. 신뢰도 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `역해머 ${confidence}%` },
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
      if (lowerShadow < body * 2 || upperShadow > body * 0.3 || body < range * 0.1) continue;

      // 상승 추세 확인 (해머와 반대)
      const trend = this._detectTrend(candles, i, 10);
      if (trend.direction !== 'up') continue;

      const a = this._atr(atr, i, candles);
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._target(candles, i, i, 'sell');

      results.push({
        type: 'hangingMan', name: '교수형 (Hanging Man)', nameShort: '교수형',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `상승 후 긴 아래꼬리 — 하락 반전 경고. 신뢰도 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `교수형 ${confidence}%` },
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
      if (upperShadow < body * 2 || lowerShadow > body * 0.3 || body < range * 0.1) continue;

      // 상승 추세 확인 (역해머와 반대)
      const trend = this._detectTrend(candles, i, 10);
      if (trend.direction !== 'up') continue;

      const a = this._atr(atr, i, candles);
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
        marker: { time: c.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `유성형 ${confidence}%` },
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
      if (body > range * 0.1) continue;

      const a = this._atr(atr, i, candles);
      if (range < a * 0.3) continue;

      // 추세 맥락으로 신호 방향 결정
      const trend = this._detectTrend(candles, i, 10);
      const signal = trend.direction === 'up' ? 'sell' : trend.direction === 'down' ? 'buy' : 'neutral';
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction !== 'neutral' ? Math.min(trend.strength, 1) : 0.3;
      const shadowScore = Math.min(range / a, 1);
      const confidence = this._quality({ body: 0.5, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.5 });

      results.push({
        type: 'doji', name: '도지 (Doji)', nameShort: '도지',
        signal, strength: 'weak', confidence,
        stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
        priceTarget: signal !== 'neutral' ? this._target(candles, i, i, signal) : null,
        description: `시가 ≈ 종가 — 추세 전환 가능. 신뢰도 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: '#ffeb3b', shape: 'circle', text: `도지 ${confidence}%` },
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
      if (prevBody < a * 0.1 || currBody < a * 0.2) continue;

      const trend = this._detectTrend(candles, i - 1, 10);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min(currBody / a, 1);

      // 상승 장악형
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open <= prev.close && curr.close >= prev.open) {
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
          const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          results.push({
            type: 'bullishEngulfing', name: '상승장악형 (Bullish Engulfing)', nameShort: '상승장악',
            signal: 'buy', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._target(candles, i - 1, i, 'buy'),
            description: `양봉이 음봉을 감싸 — 강한 상승 반전. 신뢰도 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `상승장악 ${confidence}%` },
          });
        }
      }

      // 하락 장악형
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open >= prev.close && curr.close <= prev.open) {
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
          const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          results.push({
            type: 'bearishEngulfing', name: '하락장악형 (Bearish Engulfing)', nameShort: '하락장악',
            signal: 'sell', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._target(candles, i - 1, i, 'sell'),
            description: `음봉이 양봉을 감싸 — 강한 하락 반전. 신뢰도 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `하락장악 ${confidence}%` },
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
      if (prevBody < a * 0.3 || currBody > prevBody * 0.5) continue;
      if (currBody < a * 0.05) continue;

      const trend = this._detectTrend(candles, i - 1, 10);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);

      // 상승 잉태형 (하락 추세 → 큰 음봉 → 작은 양봉 내포)
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open > prev.close && curr.close < prev.open) {
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          results.push({
            type: 'bullishHarami', name: '상승잉태형 (Bullish Harami)', nameShort: '상승잉태',
            signal: 'buy', strength: 'medium', confidence,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._target(candles, i - 1, i, 'buy'),
            description: `작은 양봉이 음봉 내에 — 반전 가능. 신뢰도 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `잉태 ${confidence}%` },
          });
        }
      }

      // 하락 잉태형 (상승 추세 → 큰 양봉 → 작은 음봉 내포)
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open < prev.close && curr.close > prev.open) {
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          results.push({
            type: 'bearishHarami', name: '하락잉태형 (Bearish Harami)', nameShort: '하락잉태',
            signal: 'sell', strength: 'medium', confidence,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._target(candles, i - 1, i, 'sell'),
            description: `작은 음봉이 양봉 내에 — 반전 가능. 신뢰도 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `잉태 ${confidence}%` },
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
      const body0 = c0.open - c0.close;
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.close - c2.open;

      if (body0 < a * 0.3) continue;
      if (body1 > a * 0.2) continue;
      if (body2 < a * 0.3) continue;
      if (c1.close > c0.close && c1.open > c0.close) continue;

      const trend = this._detectTrend(candles, i - 2, 10);
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
        marker: { time: c2.time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `샛별형 ${confidence}%` },
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
      const body0 = c0.close - c0.open;
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.open - c2.close;

      if (body0 < a * 0.3) continue;
      if (body1 > a * 0.2) continue;
      if (body2 < a * 0.3) continue;
      if (c1.close < c0.close && c1.open < c0.close) continue;

      const trend = this._detectTrend(candles, i - 2, 10);
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
        marker: { time: c2.time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `석별형 ${confidence}%` },
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
        marker: { time: candles[endIdx].time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `상승삼각 ${confidence}%` },
        trendlines: [
          { color: '#5086DC', style: 'dashed', points: [
            { time: candles[h1.index].time, value: resistanceLevel },
            { time: candles[h2.index].time, value: resistanceLevel },
          ]},
          { color: '#E05050', style: 'dashed', points: [
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
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `하락삼각 ${confidence}%` },
        trendlines: [
          { color: '#E05050', style: 'dashed', points: [
            { time: candles[l1.index].time, value: supportLevel },
            { time: candles[l2.index].time, value: supportLevel },
          ]},
          { color: '#5086DC', style: 'dashed', points: [
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
          marker: { time: candles[endIdx].time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `상승쐐기 ${confidence}%` },
          trendlines: [
            { color: '#5086DC', style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: '#E05050', style: 'dashed', points: [
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
          marker: { time: candles[endIdx].time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `하락쐐기 ${confidence}%` },
          trendlines: [
            { color: '#5086DC', style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: '#E05050', style: 'dashed', points: [
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
        marker: { time: candles[l2.index].time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `W바닥 ${confidence}%` },
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
        marker: { time: candles[h2.index].time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `M천장 ${confidence}%` },
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
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: '#5086DC', shape: 'arrowDown', text: `H&S ${confidence}%` },
        trendlines: [
          { color: '#C9A84C', style: 'dashed', points: [
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
        marker: { time: candles[endIdx].time, position: 'belowBar', color: '#E05050', shape: 'arrowUp', text: `역H&S ${confidence}%` },
        trendlines: [
          { color: '#C9A84C', style: 'dashed', points: [
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
