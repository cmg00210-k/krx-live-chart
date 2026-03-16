// ══════════════════════════════════════════════════════
//  KRX LIVE — 기술적 지표 계산 모듈
//  chart.js에서 분리 (Phase 1)
// ══════════════════════════════════════════════════════

// ── 기술적 지표 계산 함수 ──────────────────────────────

/** 단순 이동평균 (SMA) */
function calcMA(data, n) {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let j = i - n + 1; j <= i; j++) sum += data[j];
    return sum / n;
  });
}

/** 지수 이동평균 (EMA) — 첫 N개 SMA로 초기값 설정 (정확도 개선) */
function calcEMA(data, n) {
  if (!data.length) return [];
  if (data.length < n) return data.map(() => null);

  const k = 2 / (n + 1);
  const result = new Array(n - 1).fill(null);

  // 첫 N개 데이터의 SMA를 EMA 초기값으로 사용
  let sma = 0;
  for (let i = 0; i < n; i++) sma += data[i];
  sma /= n;
  result.push(sma);

  for (let i = n; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** 볼린저 밴드 (BB) */
function calcBB(closes, n = 20, mult = 2) {
  return closes.map((_, i) => {
    if (i < n - 1) return { upper: null, lower: null, mid: null };
    const sl = closes.slice(i - n + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { upper: mean + mult * std, lower: mean - mult * std, mid: mean };
  });
}

/** RSI (Wilder 방식) */
function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/** ATR (Average True Range) */
function calcATR(candles, period = 14) {
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

/** 일목균형표 (Ichimoku Cloud) */
function calcIchimoku(candles, conv = 9, base = 26, spanBPeriod = 52, displacement = 26) {
  const len = candles.length;
  const midHL = (arr, start, end) => {
    let hi = -Infinity, lo = Infinity;
    for (let i = start; i <= end; i++) {
      if (arr[i].high > hi) hi = arr[i].high;
      if (arr[i].low < lo) lo = arr[i].low;
    }
    return (hi + lo) / 2;
  };

  const tenkan = new Array(len).fill(null);   // 전환선
  const kijun = new Array(len).fill(null);    // 기준선
  const spanA = new Array(len).fill(null);    // 선행스팬A
  const spanB = new Array(len).fill(null);    // 선행스팬B
  const chikou = new Array(len).fill(null);   // 후행스팬

  for (let i = 0; i < len; i++) {
    if (i >= conv - 1) tenkan[i] = midHL(candles, i - conv + 1, i);
    if (i >= base - 1) kijun[i] = midHL(candles, i - base + 1, i);
    if (i >= base - 1 && tenkan[i] !== null && kijun[i] !== null) {
      const futIdx = i + displacement;
      if (futIdx < len) spanA[futIdx] = (tenkan[i] + kijun[i]) / 2;
    }
    if (i >= spanBPeriod - 1) {
      const futIdx = i + displacement;
      if (futIdx < len) spanB[futIdx] = midHL(candles, i - spanBPeriod + 1, i);
    }
    // 후행스팬: 현재 종가를 displacement 전에 표시
    if (i >= displacement) chikou[i - displacement] = candles[i].close;
  }
  return { tenkan, kijun, spanA, spanB, chikou };
}

/** 칼만 필터 (Kalman Filter) 가격 평활 */
function calcKalman(closes, Q = 0.01, R = 1.0) {
  if (!closes.length) return [];
  const result = new Array(closes.length).fill(null);
  let x = closes[0];   // 상태 추정
  let P = 1.0;          // 추정 오차
  result[0] = x;

  for (let i = 1; i < closes.length; i++) {
    // 예측
    const xPred = x;
    const PPred = P + Q;
    // 갱신
    const K = PPred / (PPred + R);
    x = xPred + K * (closes[i] - xPred);
    P = (1 - K) * PPred;
    result[i] = x;
  }
  return result;
}

/** 허스트 지수 (Hurst Exponent) — R/S 분석
 *  현재 내부적으로 사용되지 않음. 향후 추세 지속성 분석용으로 유지.
 *  H > 0.5: 추세 지속성, H < 0.5: 평균 회귀, H ≈ 0.5: 랜덤워크
 */
function calcHurst(closes, minWindow = 10) {
  if (closes.length < minWindow * 4) return null;

  const logRS = [];
  const logN = [];

  for (let w = minWindow; w <= Math.floor(closes.length / 2); w = Math.floor(w * 1.5)) {
    const numBlocks = Math.floor(closes.length / w);
    let rsSum = 0;
    for (let b = 0; b < numBlocks; b++) {
      const block = closes.slice(b * w, (b + 1) * w);
      const mean = block.reduce((a, v) => a + v, 0) / w;
      const devs = block.map(v => v - mean);
      const cumDevs = [];
      let cum = 0;
      for (const d of devs) { cum += d; cumDevs.push(cum); }
      const R = Math.max(...cumDevs) - Math.min(...cumDevs);
      const S = Math.sqrt(devs.reduce((a, d) => a + d * d, 0) / w);
      if (S > 0) rsSum += R / S;
    }
    logRS.push(Math.log(rsSum / numBlocks));
    logN.push(Math.log(w));
  }

  if (logRS.length < 2) return null;
  // 선형 회귀로 기울기(H) 추정
  const n = logRS.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += logN[i]; sy += logRS[i]; sxy += logN[i] * logRS[i]; sx2 += logN[i] * logN[i];
  }
  return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
}

/** MACD (12, 26, 9) */
function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = emaFast.map((v, i) => i < slow - 1 ? null : v - emaSlow[i]);
  const validMacd = macdLine.filter(v => v !== null);
  if (!validMacd.length) return { macdLine, signalLine: macdLine.map(() => null), histogram: macdLine.map(() => null) };

  const signalEma = calcEMA(validMacd, sig);

  const signalLine = new Array(closes.length).fill(null);
  const histogram = new Array(closes.length).fill(null);
  let vi = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      if (vi >= sig - 1) {
        signalLine[i] = signalEma[vi];
        histogram[i] = macdLine[i] - signalLine[i];
      }
      vi++;
    }
  }
  return { macdLine, signalLine, histogram };
}

/** 스토캐스틱 오실레이터 (Stochastic %K / %D)
 *  %K = SMA( (Close - Lowest Low) / (Highest High - Lowest Low) * 100, smooth )
 *  %D = SMA(%K, dPeriod)
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @param {number} kPeriod — %K 룩백 기간 (기본 14)
 *  @param {number} dPeriod — %D 평활 기간 (기본 3)
 *  @param {number} smooth — %K 평활 기간 (기본 3, 1이면 Fast Stochastic)
 *  @returns {{ k: number[], d: number[] }}
 */
function calcStochastic(candles, kPeriod = 14, dPeriod = 3, smooth = 3) {
  const len = candles.length;
  const k = new Array(len).fill(null);
  const d = new Array(len).fill(null);
  if (len < kPeriod) return { k, d };

  // Raw %K 계산
  const rawK = new Array(len).fill(null);
  for (let i = kPeriod - 1; i < len; i++) {
    let highest = -Infinity, lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    rawK[i] = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
  }

  // %K = SMA(rawK, smooth)
  const validRawK = rawK.filter(v => v !== null);
  if (validRawK.length < smooth) return { k, d };

  const smoothedK = calcMA(validRawK, smooth);
  let vi = 0;
  for (let i = 0; i < len; i++) {
    if (rawK[i] !== null) {
      k[i] = smoothedK[vi];
      vi++;
    }
  }

  // %D = SMA(%K, dPeriod)
  const validK = k.filter(v => v !== null);
  if (validK.length < dPeriod) return { k, d };

  const dLine = calcMA(validK, dPeriod);
  vi = 0;
  for (let i = 0; i < len; i++) {
    if (k[i] !== null) {
      d[i] = dLine[vi];
      vi++;
    }
  }

  return { k, d };
}

/** 스토캐스틱 RSI (Stochastic RSI)
 *  StochRSI = (RSI - min(RSI, stochPeriod)) / (max(RSI, stochPeriod) - min(RSI, stochPeriod))
 *  K = SMA(StochRSI, kPeriod), D = SMA(K, dPeriod)
 *  @param {number[]} closes — 종가 배열
 *  @param {number} rsiPeriod — RSI 기간 (기본 14)
 *  @param {number} kPeriod — %K 평활 기간 (기본 3)
 *  @param {number} dPeriod — %D 평활 기간 (기본 3)
 *  @param {number} stochPeriod — 스토캐스틱 룩백 기간 (기본 14)
 *  @returns {{ k: number[], d: number[] }}
 */
function calcStochRSI(closes, rsiPeriod = 14, kPeriod = 3, dPeriod = 3, stochPeriod = 14) {
  const len = closes.length;
  const k = new Array(len).fill(null);
  const d = new Array(len).fill(null);

  const rsiArr = calcRSI(closes, rsiPeriod);
  // RSI 유효값 추출
  const rsiValid = [];
  const rsiIdxMap = [];
  for (let i = 0; i < len; i++) {
    if (rsiArr[i] !== null) {
      rsiValid.push(rsiArr[i]);
      rsiIdxMap.push(i);
    }
  }
  if (rsiValid.length < stochPeriod) return { k, d };

  // StochRSI 계산
  const stochRsi = new Array(rsiValid.length).fill(null);
  for (let i = stochPeriod - 1; i < rsiValid.length; i++) {
    let minRSI = Infinity, maxRSI = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (rsiValid[j] < minRSI) minRSI = rsiValid[j];
      if (rsiValid[j] > maxRSI) maxRSI = rsiValid[j];
    }
    const range = maxRSI - minRSI;
    stochRsi[i] = range === 0 ? 50 : ((rsiValid[i] - minRSI) / range) * 100;
  }

  // K = SMA(StochRSI, kPeriod)
  const validStochRsi = stochRsi.filter(v => v !== null);
  if (validStochRsi.length < kPeriod) return { k, d };

  const kLine = calcMA(validStochRsi, kPeriod);
  // kLine → 원래 인덱스로 매핑
  let vi = 0;
  const kAtRsiIdx = new Array(rsiValid.length).fill(null);
  for (let i = 0; i < rsiValid.length; i++) {
    if (stochRsi[i] !== null) {
      kAtRsiIdx[i] = kLine[vi];
      vi++;
    }
  }
  for (let i = 0; i < rsiValid.length; i++) {
    if (kAtRsiIdx[i] !== null) k[rsiIdxMap[i]] = kAtRsiIdx[i];
  }

  // D = SMA(K, dPeriod)
  const validK = [];
  const kOrigIdxMap = [];
  for (let i = 0; i < len; i++) {
    if (k[i] !== null) {
      validK.push(k[i]);
      kOrigIdxMap.push(i);
    }
  }
  if (validK.length < dPeriod) return { k, d };

  const dLine = calcMA(validK, dPeriod);
  for (let i = 0; i < validK.length; i++) {
    d[kOrigIdxMap[i]] = dLine[i];
  }

  return { k, d };
}

/** CCI (Commodity Channel Index)
 *  Typical Price = (High + Low + Close) / 3
 *  CCI = (TP - SMA(TP, period)) / (0.015 * Mean Deviation)
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @param {number} period — 기간 (기본 20)
 *  @returns {number[]} — CCI 배열
 */
function calcCCI(candles, period = 20) {
  const len = candles.length;
  const cci = new Array(len).fill(null);
  if (len < period) return cci;

  const tp = candles.map(c => (c.high + c.low + c.close) / 3);

  for (let i = period - 1; i < len; i++) {
    // SMA of TP
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += tp[j];
    const smaTP = sum / period;

    // Mean Deviation
    let mdSum = 0;
    for (let j = i - period + 1; j <= i; j++) mdSum += Math.abs(tp[j] - smaTP);
    const md = mdSum / period;

    cci[i] = md === 0 ? 0 : (tp[i] - smaTP) / (0.015 * md);
  }
  return cci;
}

/** ADX (Average Directional Index)
 *  +DI / -DI / ADX (Wilder 평활 방식)
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @param {number} period — 기간 (기본 14)
 *  @returns {{ adx: number[], plusDI: number[], minusDI: number[] }}
 */
function calcADX(candles, period = 14) {
  const len = candles.length;
  const adx = new Array(len).fill(null);
  const plusDI = new Array(len).fill(null);
  const minusDI = new Array(len).fill(null);
  if (len < period + 1) return { adx, plusDI, minusDI };

  // True Range, +DM, -DM 계산
  const tr = new Array(len).fill(0);
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const c = candles[i], p = candles[i - 1];
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    const upMove = c.high - p.high;
    const downMove = p.low - c.low;
    plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  // 초기 합계 (Wilder 평활)
  let smoothTR = 0, smoothPlusDM = 0, smoothMinusDM = 0;
  for (let i = 1; i <= period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }

  // 첫 번째 +DI/-DI
  plusDI[period] = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
  minusDI[period] = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;

  // DX 배열 (ADX 계산용)
  const dx = new Array(len).fill(null);
  const diSum = plusDI[period] + minusDI[period];
  dx[period] = diSum === 0 ? 0 : (Math.abs(plusDI[period] - minusDI[period]) / diSum) * 100;

  // Wilder 평활 계속
  for (let i = period + 1; i < len; i++) {
    smoothTR = smoothTR - (smoothTR / period) + tr[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];

    plusDI[i] = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
    minusDI[i] = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;

    const diS = plusDI[i] + minusDI[i];
    dx[i] = diS === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / diS) * 100;
  }

  // ADX = Wilder 평활(DX, period)
  // 첫 ADX = 첫 period개 DX의 평균
  const adxStart = period * 2;
  if (adxStart >= len) return { adx, plusDI, minusDI };

  let dxSum = 0;
  for (let i = period; i <= adxStart; i++) {
    dxSum += (dx[i] || 0);
  }
  adx[adxStart] = dxSum / (period + 1);

  for (let i = adxStart + 1; i < len; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + (dx[i] || 0)) / period;
  }

  return { adx, plusDI, minusDI };
}

/** 윌리엄스 %R (Williams %R)
 *  %R = ((Highest High - Close) / (Highest High - Lowest Low)) * -100
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @param {number} period — 룩백 기간 (기본 14)
 *  @returns {number[]} — %R 배열 (-100 ~ 0)
 */
function calcWilliamsR(candles, period = 14) {
  const len = candles.length;
  const wr = new Array(len).fill(null);
  if (len < period) return wr;

  for (let i = period - 1; i < len; i++) {
    let highest = -Infinity, lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    wr[i] = range === 0 ? -50 : ((highest - candles[i].close) / range) * -100;
  }
  return wr;
}

/** 모멘텀 (Momentum)
 *  Momentum = close[i] - close[i - period]
 *  @param {number[]} closes — 종가 배열
 *  @param {number} period — 비교 기간 (기본 10)
 *  @returns {number[]} — 모멘텀 배열
 */
function calcMomentum(closes, period = 10) {
  const len = closes.length;
  const mom = new Array(len).fill(null);
  if (len <= period) return mom;

  for (let i = period; i < len; i++) {
    mom[i] = closes[i] - closes[i - period];
  }
  return mom;
}

/** 어썸 오실레이터 (Awesome Oscillator)
 *  Median Price = (High + Low) / 2
 *  AO = SMA(Median, shortPeriod) - SMA(Median, longPeriod)
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @param {number} shortPeriod — 단기 SMA 기간 (기본 5)
 *  @param {number} longPeriod — 장기 SMA 기간 (기본 34)
 *  @returns {number[]} — AO 배열
 */
function calcAwesomeOscillator(candles, shortPeriod = 5, longPeriod = 34) {
  const len = candles.length;
  const ao = new Array(len).fill(null);
  if (len < longPeriod) return ao;

  const median = candles.map(c => (c.high + c.low) / 2);
  const shortMA = calcMA(median, shortPeriod);
  const longMA = calcMA(median, longPeriod);

  for (let i = 0; i < len; i++) {
    if (shortMA[i] !== null && longMA[i] !== null) {
      ao[i] = shortMA[i] - longMA[i];
    }
  }
  return ao;
}

// ══════════════════════════════════════════════════════
//  IndicatorCache — Lazy Evaluation 지표 캐시
//  필요한 지표만 최초 접근 시 계산, 캔들 변경 시 invalidate
// ══════════════════════════════════════════════════════

class IndicatorCache {
  /**
   * @param {Array} candles — OHLCV 캔들 배열
   */
  constructor(candles) {
    this._candles = candles || [];
    this._closes = null;
    this._volumes = null;
    this._cache = {};
  }

  /** 캔들 데이터 교체 → 캐시 전부 무효화 */
  setCandles(candles) {
    this._candles = candles || [];
    this._closes = null;
    this._volumes = null;
    this._cache = {};
  }

  /** 종가 배열 (lazy) */
  get closes() {
    if (!this._closes) {
      this._closes = this._candles.map(c => c.close);
    }
    return this._closes;
  }

  /** 거래량 배열 (lazy) */
  get volumes() {
    if (!this._volumes) {
      this._volumes = this._candles.map(c => c.volume);
    }
    return this._volumes;
  }

  // ── 지표 접근자 (Lazy) ─────────────────────────────

  /** SMA(n) — 기본 5, 20, 60 */
  ma(n) {
    const key = `ma_${n}`;
    if (!this._cache[key]) {
      this._cache[key] = calcMA(this.closes, n);
    }
    return this._cache[key];
  }

  /** EMA(n) — 기본 12, 26 */
  ema(n) {
    const key = `ema_${n}`;
    if (!this._cache[key]) {
      this._cache[key] = calcEMA(this.closes, n);
    }
    return this._cache[key];
  }

  /** 볼린저 밴드 (n, mult) */
  bb(n = 20, mult = 2) {
    const key = `bb_${n}_${mult}`;
    if (!this._cache[key]) {
      this._cache[key] = calcBB(this.closes, n, mult);
    }
    return this._cache[key];
  }

  /** RSI (period) */
  rsi(period = 14) {
    const key = `rsi_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcRSI(this.closes, period);
    }
    return this._cache[key];
  }

  /** ATR (period) */
  atr(period = 14) {
    const key = `atr_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcATR(this._candles, period);
    }
    return this._cache[key];
  }

  /** MACD (fast, slow, sig) */
  macd(fast = 12, slow = 26, sig = 9) {
    const key = `macd_${fast}_${slow}_${sig}`;
    if (!this._cache[key]) {
      this._cache[key] = calcMACD(this.closes, fast, slow, sig);
    }
    return this._cache[key];
  }

  /** 일목균형표 */
  ichimoku(conv = 9, base = 26, spanBPeriod = 52, displacement = 26) {
    const key = `ich_${conv}_${base}_${spanBPeriod}_${displacement}`;
    if (!this._cache[key]) {
      this._cache[key] = calcIchimoku(this._candles, conv, base, spanBPeriod, displacement);
    }
    return this._cache[key];
  }

  /** 칼만 필터 */
  kalman(Q = 0.01, R = 1.0) {
    const key = `kalman_${Q}_${R}`;
    if (!this._cache[key]) {
      this._cache[key] = calcKalman(this.closes, Q, R);
    }
    return this._cache[key];
  }

  /** 허스트 지수 (현재 미사용 — 향후 추세 지속성 분석용) */
  hurst(minWindow = 10) {
    const key = `hurst_${minWindow}`;
    if (!this._cache[key]) {
      this._cache[key] = calcHurst(this.closes, minWindow);
    }
    return this._cache[key];
  }

  // ── 오실레이터 접근자 ───────────────────────────────

  /** 스토캐스틱 (%K, %D) */
  stochastic(kPeriod = 14, dPeriod = 3, smooth = 3) {
    const key = `stoch_${kPeriod}_${dPeriod}_${smooth}`;
    if (!this._cache[key]) {
      this._cache[key] = calcStochastic(this._candles, kPeriod, dPeriod, smooth);
    }
    return this._cache[key];
  }

  /** 스토캐스틱 RSI (%K, %D) */
  stochRsi(rsiPeriod = 14, kPeriod = 3, dPeriod = 3, stochPeriod = 14) {
    const key = `stochRsi_${rsiPeriod}_${kPeriod}_${dPeriod}_${stochPeriod}`;
    if (!this._cache[key]) {
      this._cache[key] = calcStochRSI(this.closes, rsiPeriod, kPeriod, dPeriod, stochPeriod);
    }
    return this._cache[key];
  }

  /** CCI (Commodity Channel Index) */
  cci(period = 20) {
    const key = `cci_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcCCI(this._candles, period);
    }
    return this._cache[key];
  }

  /** ADX (+DI, -DI, ADX) */
  adx(period = 14) {
    const key = `adx_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcADX(this._candles, period);
    }
    return this._cache[key];
  }

  /** 윌리엄스 %R */
  williamsR(period = 14) {
    const key = `wr_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcWilliamsR(this._candles, period);
    }
    return this._cache[key];
  }

  /** 모멘텀 */
  momentum(period = 10) {
    const key = `mom_${period}`;
    if (!this._cache[key]) {
      this._cache[key] = calcMomentum(this.closes, period);
    }
    return this._cache[key];
  }

  /** 어썸 오실레이터 (AO) */
  ao(shortPeriod = 5, longPeriod = 34) {
    const key = `ao_${shortPeriod}_${longPeriod}`;
    if (!this._cache[key]) {
      this._cache[key] = calcAwesomeOscillator(this._candles, shortPeriod, longPeriod);
    }
    return this._cache[key];
  }

  // ── 거래량 이동평균 (VMA) ──────────────────────────

  /** 거래량 이동평균 (Volume Moving Average) */
  vma(n = 20) {
    const key = `vma_${n}`;
    if (!this._cache[key]) {
      this._cache[key] = calcMA(this.volumes, n);
    }
    return this._cache[key];
  }

  // ── 거래량 비율 헬퍼 ───────────────────────────────

  /**
   * 거래량 비율: 해당 인덱스의 거래량 / VMA(n)
   * @param {number} idx — 캔들 인덱스
   * @param {number} n — VMA 기간 (기본 20)
   * @returns {number|null} — VMA가 없거나 0이면 null
   */
  volRatio(idx, n = 20) {
    const vmaArr = this.vma(n);
    if (idx < 0 || idx >= this._candles.length) return null;
    if (!vmaArr[idx] || vmaArr[idx] === 0) return null;
    return this.volumes[idx] / vmaArr[idx];
  }

  // ── 캐시 관리 ──────────────────────────────────────

  /** 특정 지표 캐시만 무효화 */
  invalidate(keyPrefix) {
    if (!keyPrefix) {
      this._cache = {};
      return;
    }
    for (const key of Object.keys(this._cache)) {
      if (key.startsWith(keyPrefix)) {
        delete this._cache[key];
      }
    }
  }

  /** 캐시된 지표 목록 반환 */
  get cachedKeys() {
    return Object.keys(this._cache);
  }
}
