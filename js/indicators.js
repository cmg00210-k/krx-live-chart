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
