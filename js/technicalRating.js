// ══════════════════════════════════════════════════════
//  KRX LIVE — 기술적 등급 엔진 (Technical Rating)
//  TradingView/Investing.com 기술적 요약 알고리즘 구현
//  26개 지표 기반 강력매수~강력매도 5단계 판정
// ══════════════════════════════════════════════════════

class TechnicalRating {

  /**
   * 기술적 등급 분석
   * @param {Array} candles — OHLCV 캔들 배열 (최소 200개 권장)
   * @returns {Object} { summary, maRating, oscRating, details }
   */
  analyze(candles) {
    if (!candles || candles.length < 2) {
      const empty = { score: 0, buy: 0, sell: 0, neutral: 0, label: '중립' };
      return {
        summary: empty,
        maRating: empty,
        oscRating: empty,
        details: { ma: [], oscillators: [] }
      };
    }

    const cache = new IndicatorCache(candles);

    const maIndicators = this._analyzeMAs(candles, cache);
    const oscIndicators = this._analyzeOscillators(candles, cache);

    const maRating = this._calcRating(maIndicators);
    const oscRating = this._calcRating(oscIndicators);

    // 종합: MA 15개 + 오실레이터 11개 = 26개 지표
    const allIndicators = [...maIndicators, ...oscIndicators];
    const summary = this._calcRating(allIndicators);

    return {
      summary,
      maRating,
      oscRating,
      details: {
        ma: maIndicators,
        oscillators: oscIndicators
      }
    };
  }

  // ══════════════════════════════════════════════════════
  //  이동평균 분석 (15개 지표)
  // ══════════════════════════════════════════════════════

  _analyzeMAs(candles, cache) {
    const last = candles.length - 1;
    const price = candles[last].close;
    const indicators = [];

    // ── 1-6: SMA 10, 20, 30, 50, 100, 200 ──
    for (const n of [10, 20, 30, 50, 100, 200]) {
      const ma = cache.ma(n);
      const value = ma[last];
      if (value !== null && value !== undefined) {
        indicators.push({
          name: `SMA(${n})`,
          value: value,
          signal: price > value ? 1 : price < value ? -1 : 0
        });
      } else {
        indicators.push({ name: `SMA(${n})`, value: null, signal: 0 });
      }
    }

    // ── 7-12: EMA 10, 20, 30, 50, 100, 200 ──
    for (const n of [10, 20, 30, 50, 100, 200]) {
      const ema = cache.ema(n);
      const value = ema[last];
      if (value !== null && value !== undefined) {
        indicators.push({
          name: `EMA(${n})`,
          value: value,
          signal: price > value ? 1 : price < value ? -1 : 0
        });
      } else {
        indicators.push({ name: `EMA(${n})`, value: null, signal: 0 });
      }
    }

    // ── 13: Hull MA(9) ──
    const hma = this._calcHullMA(cache.closes, 9);
    if (hma.length > 0) {
      const hmaValue = hma[hma.length - 1];
      if (hmaValue !== null && hmaValue !== undefined) {
        indicators.push({
          name: 'HMA(9)',
          value: hmaValue,
          signal: price > hmaValue ? 1 : price < hmaValue ? -1 : 0
        });
      } else {
        indicators.push({ name: 'HMA(9)', value: null, signal: 0 });
      }
    } else {
      indicators.push({ name: 'HMA(9)', value: null, signal: 0 });
    }

    // ── 14: VWMA(20) ──
    const vwma = this._calcVWMA(candles, 20);
    const vwmaValue = vwma[last];
    if (vwmaValue !== null && vwmaValue !== undefined) {
      indicators.push({
        name: 'VWMA(20)',
        value: vwmaValue,
        signal: price > vwmaValue ? 1 : price < vwmaValue ? -1 : 0
      });
    } else {
      indicators.push({ name: 'VWMA(20)', value: null, signal: 0 });
    }

    // ── 15: Ichimoku(9,26,52) ──
    const ich = cache.ichimoku(9, 26, 52, 26);
    const sA = ich.spanA[last];
    const sB = ich.spanB[last];
    if (sA !== null && sB !== null && sA !== undefined && sB !== undefined) {
      const cloudTop = Math.max(sA, sB);
      const cloudBottom = Math.min(sA, sB);
      let ichSignal = 0;
      if (price > cloudTop) ichSignal = 1;
      else if (price < cloudBottom) ichSignal = -1;
      indicators.push({
        name: 'Ichimoku(9,26,52)',
        value: (sA + sB) / 2,
        signal: ichSignal
      });
    } else {
      indicators.push({ name: 'Ichimoku(9,26,52)', value: null, signal: 0 });
    }

    return indicators;
  }

  // ══════════════════════════════════════════════════════
  //  오실레이터 분석 (11개 지표)
  // ══════════════════════════════════════════════════════

  _analyzeOscillators(candles, cache) {
    const last = candles.length - 1;
    const closes = cache.closes;
    const indicators = [];

    // ── 1: RSI(14) ──
    const rsi = cache.rsi(14);
    const rsiVal = rsi[last];
    const rsiPrev = last > 0 ? rsi[last - 1] : null;
    if (rsiVal !== null && rsiVal !== undefined) {
      let signal = 0;
      const rising = rsiPrev !== null && rsiPrev !== undefined && rsiVal > rsiPrev;
      const falling = rsiPrev !== null && rsiPrev !== undefined && rsiVal < rsiPrev;
      if (rsiVal < 30 && rising) signal = 1;
      else if (rsiVal > 70 && falling) signal = -1;
      indicators.push({ name: 'RSI(14)', value: rsiVal, signal });
    } else {
      indicators.push({ name: 'RSI(14)', value: null, signal: 0 });
    }

    // ── 2: Stochastic(14,3,3) ──
    const stoch = this._calcStochastic(candles, 14, 3, 3);
    if (stoch) {
      const K = stoch.K[last];
      const D = stoch.D[last];
      if (K !== null && D !== null && K !== undefined && D !== undefined) {
        let signal = 0;
        if (K < 20 && D < 20 && K > D) signal = 1;
        else if (K > 80 && D > 80 && K < D) signal = -1;
        indicators.push({ name: 'Stoch(14,3,3)', value: K, signal });
      } else {
        indicators.push({ name: 'Stoch(14,3,3)', value: null, signal: 0 });
      }
    } else {
      indicators.push({ name: 'Stoch(14,3,3)', value: null, signal: 0 });
    }

    // ── 3: CCI(20) ──
    const cci = this._calcCCI(candles, 20);
    const cciVal = cci[last];
    const cciPrev = last > 0 ? cci[last - 1] : null;
    if (cciVal !== null && cciVal !== undefined) {
      let signal = 0;
      const rising = cciPrev !== null && cciPrev !== undefined && cciVal > cciPrev;
      const falling = cciPrev !== null && cciPrev !== undefined && cciVal < cciPrev;
      if (cciVal < -100 && rising) signal = 1;
      else if (cciVal > 100 && falling) signal = -1;
      indicators.push({ name: 'CCI(20)', value: cciVal, signal });
    } else {
      indicators.push({ name: 'CCI(20)', value: null, signal: 0 });
    }

    // ── 4: ADX(14) ──
    const adx = this._calcADX(candles, 14);
    if (adx) {
      const adxVal = adx.adx[last];
      const pdi = adx.pdi[last];
      const mdi = adx.mdi[last];
      const adxPrev = last > 0 ? adx.adx[last - 1] : null;
      if (adxVal !== null && pdi !== null && mdi !== null &&
          adxVal !== undefined && pdi !== undefined && mdi !== undefined) {
        let signal = 0;
        const rising = adxPrev !== null && adxPrev !== undefined && adxVal > adxPrev;
        const falling = adxPrev !== null && adxPrev !== undefined && adxVal < adxPrev;
        if (pdi > mdi && adxVal > 20 && rising) signal = 1;
        else if (mdi > pdi && adxVal > 20 && falling) signal = -1;
        indicators.push({ name: 'ADX(14)', value: adxVal, signal });
      } else {
        indicators.push({ name: 'ADX(14)', value: null, signal: 0 });
      }
    } else {
      indicators.push({ name: 'ADX(14)', value: null, signal: 0 });
    }

    // ── 5: Awesome Oscillator ──
    const ao = this._calcAwesomeOscillator(candles);
    const aoVal = ao[last];
    const aoPrev = last > 0 ? ao[last - 1] : null;
    if (aoVal !== null && aoVal !== undefined) {
      let signal = 0;
      const rising = aoPrev !== null && aoPrev !== undefined && aoVal > aoPrev;
      const falling = aoPrev !== null && aoPrev !== undefined && aoVal < aoPrev;
      if (aoVal > 0 && rising) signal = 1;
      else if (aoVal < 0 && falling) signal = -1;
      indicators.push({ name: 'AO', value: aoVal, signal });
    } else {
      indicators.push({ name: 'AO', value: null, signal: 0 });
    }

    // ── 6: Momentum(10) ──
    const mom = this._calcMomentum(closes, 10);
    const momVal = mom[last];
    const momPrev = last > 0 ? mom[last - 1] : null;
    if (momVal !== null && momVal !== undefined) {
      let signal = 0;
      const rising = momPrev !== null && momPrev !== undefined && momVal > momPrev;
      const falling = momPrev !== null && momPrev !== undefined && momVal < momPrev;
      if (momVal > 0 && rising) signal = 1;
      else if (momVal < 0 && falling) signal = -1;
      indicators.push({ name: 'Momentum(10)', value: momVal, signal });
    } else {
      indicators.push({ name: 'Momentum(10)', value: null, signal: 0 });
    }

    // ── 7: MACD(12,26,9) ──
    const macd = cache.macd(12, 26, 9);
    const macdVal = macd.macdLine[last];
    const sigVal = macd.signalLine[last];
    if (macdVal !== null && sigVal !== null && macdVal !== undefined && sigVal !== undefined) {
      let signal = 0;
      if (macdVal > sigVal) signal = 1;
      else if (macdVal < sigVal) signal = -1;
      indicators.push({ name: 'MACD(12,26,9)', value: macdVal, signal });
    } else {
      indicators.push({ name: 'MACD(12,26,9)', value: null, signal: 0 });
    }

    // ── 8: StochRSI(3,3,14,14) ──
    const stochRSI = this._calcStochRSI(closes, 3, 3, 14, 14);
    if (stochRSI) {
      const srK = stochRSI.K[last];
      const srD = stochRSI.D[last];
      if (srK !== null && srD !== null && srK !== undefined && srD !== undefined) {
        let signal = 0;
        if (srK < 20 && srK > srD) signal = 1;
        else if (srK > 80 && srK < srD) signal = -1;
        indicators.push({ name: 'StochRSI(3,3,14,14)', value: srK, signal });
      } else {
        indicators.push({ name: 'StochRSI(3,3,14,14)', value: null, signal: 0 });
      }
    } else {
      indicators.push({ name: 'StochRSI(3,3,14,14)', value: null, signal: 0 });
    }

    // ── 9: Williams %R(14) ──
    const wr = this._calcWilliamsR(candles, 14);
    const wrVal = wr[last];
    const wrPrev = last > 0 ? wr[last - 1] : null;
    if (wrVal !== null && wrVal !== undefined) {
      let signal = 0;
      const rising = wrPrev !== null && wrPrev !== undefined && wrVal > wrPrev;
      const falling = wrPrev !== null && wrPrev !== undefined && wrVal < wrPrev;
      if (wrVal < -80 && rising) signal = 1;
      else if (wrVal > -20 && falling) signal = -1;
      indicators.push({ name: 'W%R(14)', value: wrVal, signal });
    } else {
      indicators.push({ name: 'W%R(14)', value: null, signal: 0 });
    }

    // ── 10: Bull Bear Power(13) ──
    const bbp = this._calcBullBearPower(candles, 13);
    const bbpVal = bbp[last];
    const bbpPrev = last > 0 ? bbp[last - 1] : null;
    if (bbpVal !== null && bbpVal !== undefined) {
      let signal = 0;
      const rising = bbpPrev !== null && bbpPrev !== undefined && bbpVal > bbpPrev;
      const falling = bbpPrev !== null && bbpPrev !== undefined && bbpVal < bbpPrev;
      if (bbpVal > 0 && rising) signal = 1;
      else if (bbpVal < 0 && falling) signal = -1;
      indicators.push({ name: 'BBPower(13)', value: bbpVal, signal });
    } else {
      indicators.push({ name: 'BBPower(13)', value: null, signal: 0 });
    }

    // ── 11: Ultimate Oscillator(7,14,28) ──
    const uo = this._calcUltimateOscillator(candles, 7, 14, 28);
    const uoVal = uo[last];
    if (uoVal !== null && uoVal !== undefined) {
      let signal = 0;
      if (uoVal > 70) signal = 1;
      else if (uoVal < 30) signal = -1;
      indicators.push({ name: 'UO(7,14,28)', value: uoVal, signal });
    } else {
      indicators.push({ name: 'UO(7,14,28)', value: null, signal: 0 });
    }

    return indicators;
  }

  // ══════════════════════════════════════════════════════
  //  등급 계산
  // ══════════════════════════════════════════════════════

  _calcRating(indicators) {
    let buy = 0, sell = 0, neutral = 0;
    for (const ind of indicators) {
      if (ind.signal === 1) buy++;
      else if (ind.signal === -1) sell++;
      else neutral++;
    }
    const total = indicators.length;
    const score = total > 0 ? (buy - sell) / total : 0;
    return { score, buy, sell, neutral, label: this._ratingLabel(score) };
  }

  _ratingLabel(score) {
    if (score > 0.5) return '강력 매수';
    if (score > 0.1) return '매수';
    if (score >= -0.1) return '중립';
    if (score >= -0.5) return '매도';
    return '강력 매도';
  }

  // ══════════════════════════════════════════════════════
  //  내부 지표 계산 함수들
  // ══════════════════════════════════════════════════════

  /**
   * Hull Moving Average
   * HMA(n) = EMA(sqrt(n)) of [2 * EMA(n/2) - EMA(n)]
   */
  _calcHullMA(closes, period) {
    if (!closes || closes.length < period) return [];

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const halfEma = calcEMA(closes, halfPeriod);
    const fullEma = calcEMA(closes, period);

    const diff = halfEma.map((v, i) =>
      v !== null && fullEma[i] !== null ? 2 * v - fullEma[i] : null
    );

    // diff 배열에서 유효한 값만 추출하여 EMA 적용
    const validDiff = diff.filter(v => v !== null);
    if (validDiff.length < sqrtPeriod) return [];

    const hma = calcEMA(validDiff, sqrtPeriod);
    return hma;
  }

  /**
   * Volume Weighted Moving Average
   * VWMA(n) = sum(close * volume, n) / sum(volume, n)
   */
  _calcVWMA(candles, period) {
    const result = new Array(candles.length).fill(null);
    if (candles.length < period) return result;

    for (let i = period - 1; i < candles.length; i++) {
      let sumCV = 0;
      let sumV = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumCV += candles[j].close * (candles[j].volume || 0);
        sumV += (candles[j].volume || 0);
      }
      result[i] = sumV > 0 ? sumCV / sumV : null;
    }
    return result;
  }

  /**
   * Stochastic Oscillator (K기간, K평활, D평활)
   * %K = SMA(rawK, smoothK), %D = SMA(%K, smoothD)
   */
  _calcStochastic(candles, period, smoothK, smoothD) {
    const len = candles.length;
    if (len < period) return null;

    // Raw %K 계산
    const rawK = new Array(len).fill(null);
    for (let i = period - 1; i < len; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > hh) hh = candles[j].high;
        if (candles[j].low < ll) ll = candles[j].low;
      }
      rawK[i] = hh !== ll ? ((candles[i].close - ll) / (hh - ll)) * 100 : 50;
    }

    // %K = SMA(rawK, smoothK)
    const K = this._smoothArray(rawK, smoothK);

    // %D = SMA(%K, smoothD)
    const D = this._smoothArray(K, smoothD);

    return { K, D };
  }

  /**
   * CCI (Commodity Channel Index)
   * CCI = (TP - SMA(TP, n)) / (0.015 * MeanDev)
   */
  _calcCCI(candles, period) {
    const len = candles.length;
    const result = new Array(len).fill(null);
    if (len < period) return result;

    // Typical Price 계산
    const tp = candles.map(c => (c.high + c.low + c.close) / 3);

    for (let i = period - 1; i < len; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += tp[j];
      const mean = sum / period;

      let meanDev = 0;
      for (let j = i - period + 1; j <= i; j++) meanDev += Math.abs(tp[j] - mean);
      meanDev /= period;

      result[i] = meanDev !== 0 ? (tp[i] - mean) / (0.015 * meanDev) : 0;
    }
    return result;
  }

  /**
   * ADX (Average Directional Index)
   * +DI, -DI, ADX 반환
   */
  _calcADX(candles, period) {
    const len = candles.length;
    if (len < period + 1) return null;

    const pdi = new Array(len).fill(null);   // +DI
    const mdi = new Array(len).fill(null);   // -DI
    const adx = new Array(len).fill(null);   // ADX

    // True Range, +DM, -DM 계산
    const tr = new Array(len).fill(0);
    const pdm = new Array(len).fill(0);
    const mdm = new Array(len).fill(0);

    for (let i = 1; i < len; i++) {
      const h = candles[i].high, l = candles[i].low;
      const ph = candles[i - 1].high, pl = candles[i - 1].low, pc = candles[i - 1].close;

      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

      const upMove = h - ph;
      const downMove = pl - l;

      pdm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      mdm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }

    // Wilder 평활 (초기값: period 합산)
    let smoothTR = 0, smoothPDM = 0, smoothMDM = 0;
    for (let i = 1; i <= period; i++) {
      smoothTR += tr[i];
      smoothPDM += pdm[i];
      smoothMDM += mdm[i];
    }

    pdi[period] = smoothTR > 0 ? (smoothPDM / smoothTR) * 100 : 0;
    mdi[period] = smoothTR > 0 ? (smoothMDM / smoothTR) * 100 : 0;

    // DX 시리즈 (ADX 계산용)
    const dx = new Array(len).fill(null);
    const diSum = pdi[period] + mdi[period];
    dx[period] = diSum > 0 ? (Math.abs(pdi[period] - mdi[period]) / diSum) * 100 : 0;

    for (let i = period + 1; i < len; i++) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPDM = smoothPDM - smoothPDM / period + pdm[i];
      smoothMDM = smoothMDM - smoothMDM / period + mdm[i];

      pdi[i] = smoothTR > 0 ? (smoothPDM / smoothTR) * 100 : 0;
      mdi[i] = smoothTR > 0 ? (smoothMDM / smoothTR) * 100 : 0;

      const diS = pdi[i] + mdi[i];
      dx[i] = diS > 0 ? (Math.abs(pdi[i] - mdi[i]) / diS) * 100 : 0;
    }

    // ADX: DX의 Wilder 평활
    if (len >= period * 2) {
      let adxSum = 0;
      for (let i = period; i < period * 2; i++) {
        adxSum += dx[i] || 0;
      }
      adx[period * 2 - 1] = adxSum / period;

      for (let i = period * 2; i < len; i++) {
        adx[i] = (adx[i - 1] * (period - 1) + (dx[i] || 0)) / period;
      }
    }

    return { adx, pdi, mdi };
  }

  /**
   * Awesome Oscillator
   * AO = SMA(midprice, 5) - SMA(midprice, 34)
   */
  _calcAwesomeOscillator(candles) {
    const len = candles.length;
    const result = new Array(len).fill(null);
    if (len < 34) return result;

    const midPrice = candles.map(c => (c.high + c.low) / 2);
    const sma5 = calcMA(midPrice, 5);
    const sma34 = calcMA(midPrice, 34);

    for (let i = 0; i < len; i++) {
      if (sma5[i] !== null && sma34[i] !== null) {
        result[i] = sma5[i] - sma34[i];
      }
    }
    return result;
  }

  /**
   * Momentum
   * MOM(n) = close[i] - close[i - n]
   */
  _calcMomentum(closes, period) {
    const result = new Array(closes.length).fill(null);
    for (let i = period; i < closes.length; i++) {
      result[i] = closes[i] - closes[i - period];
    }
    return result;
  }

  /**
   * Stochastic RSI
   * StochRSI = Stochastic(%K, %D) applied to RSI values
   * @param {Array} closes
   * @param {number} kSmooth — %K 평활 기간
   * @param {number} dSmooth — %D 평활 기간
   * @param {number} rsiPeriod — RSI 기간
   * @param {number} stochPeriod — Stochastic 기간
   */
  _calcStochRSI(closes, kSmooth, dSmooth, rsiPeriod, stochPeriod) {
    const rsi = calcRSI(closes, rsiPeriod);
    const len = closes.length;

    // RSI에 Stochastic 적용
    const rawK = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
      if (i < rsiPeriod + stochPeriod - 1) continue;

      let hhRsi = -Infinity, llRsi = Infinity;
      for (let j = i - stochPeriod + 1; j <= i; j++) {
        if (rsi[j] === null) { hhRsi = null; break; }
        if (rsi[j] > hhRsi) hhRsi = rsi[j];
        if (rsi[j] < llRsi) llRsi = rsi[j];
      }
      if (hhRsi === null || hhRsi === llRsi) {
        rawK[i] = hhRsi === null ? null : 50;
      } else {
        rawK[i] = ((rsi[i] - llRsi) / (hhRsi - llRsi)) * 100;
      }
    }

    const K = this._smoothArray(rawK, kSmooth);
    const D = this._smoothArray(K, dSmooth);

    return { K, D };
  }

  /**
   * Williams %R
   * %R = (HH - Close) / (HH - LL) * -100
   */
  _calcWilliamsR(candles, period) {
    const len = candles.length;
    const result = new Array(len).fill(null);
    if (len < period) return result;

    for (let i = period - 1; i < len; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > hh) hh = candles[j].high;
        if (candles[j].low < ll) ll = candles[j].low;
      }
      result[i] = hh !== ll
        ? ((hh - candles[i].close) / (hh - ll)) * -100
        : -50;
    }
    return result;
  }

  /**
   * Bull Bear Power
   * Bulls Power = High - EMA(period)
   * Bears Power = Low - EMA(period)
   * BBPower = Bulls Power + Bears Power
   */
  _calcBullBearPower(candles, period) {
    const len = candles.length;
    const result = new Array(len).fill(null);
    const closes = candles.map(c => c.close);
    const ema = calcEMA(closes, period);

    for (let i = 0; i < len; i++) {
      if (ema[i] !== null) {
        const bullsPower = candles[i].high - ema[i];
        const bearsPower = candles[i].low - ema[i];
        result[i] = bullsPower + bearsPower;
      }
    }
    return result;
  }

  /**
   * Ultimate Oscillator
   * UO = 100 * [(4 * Avg7) + (2 * Avg14) + Avg28] / 7
   * Avg = Sum(BP, period) / Sum(TR, period)
   * BP (Buying Pressure) = Close - Min(Low, PrevClose)
   * TR = Max(High, PrevClose) - Min(Low, PrevClose)
   */
  _calcUltimateOscillator(candles, p1, p2, p3) {
    const len = candles.length;
    const result = new Array(len).fill(null);
    if (len < p3 + 1) return result;

    // Buying Pressure, True Range 계산
    const bp = new Array(len).fill(0);
    const tr = new Array(len).fill(0);

    for (let i = 1; i < len; i++) {
      const prevClose = candles[i - 1].close;
      const low = candles[i].low;
      const high = candles[i].high;
      const close = candles[i].close;

      bp[i] = close - Math.min(low, prevClose);
      tr[i] = Math.max(high, prevClose) - Math.min(low, prevClose);
    }

    for (let i = p3; i < len; i++) {
      let bpSum1 = 0, trSum1 = 0;
      let bpSum2 = 0, trSum2 = 0;
      let bpSum3 = 0, trSum3 = 0;

      for (let j = i - p1 + 1; j <= i; j++) { bpSum1 += bp[j]; trSum1 += tr[j]; }
      for (let j = i - p2 + 1; j <= i; j++) { bpSum2 += bp[j]; trSum2 += tr[j]; }
      for (let j = i - p3 + 1; j <= i; j++) { bpSum3 += bp[j]; trSum3 += tr[j]; }

      const avg1 = trSum1 > 0 ? bpSum1 / trSum1 : 0;
      const avg2 = trSum2 > 0 ? bpSum2 / trSum2 : 0;
      const avg3 = trSum3 > 0 ? bpSum3 / trSum3 : 0;

      result[i] = 100 * (4 * avg1 + 2 * avg2 + avg3) / 7;
    }
    return result;
  }

  // ══════════════════════════════════════════════════════
  //  헬퍼 함수
  // ══════════════════════════════════════════════════════

  /**
   * 배열 SMA 평활 (null 값 보존)
   * Stochastic %K/%D 계산에 사용
   */
  _smoothArray(arr, period) {
    const len = arr.length;
    const result = new Array(len).fill(null);

    for (let i = 0; i < len; i++) {
      if (arr[i] === null) continue;

      // 현재 위치에서 period개의 유효값이 있는지 확인
      let count = 0;
      let sum = 0;
      for (let j = i; j >= 0 && count < period; j--) {
        if (arr[j] !== null) {
          sum += arr[j];
          count++;
        }
      }
      if (count === period) {
        result[i] = sum / period;
      }
    }
    return result;
  }
}

const technicalRating = new TechnicalRating();
