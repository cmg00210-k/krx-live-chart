// ══════════════════════════════════════════════════════
//  KRX LIVE — 기술적 지표 계산 모듈
//  chart.js에서 분리 (Phase 1)
// ══════════════════════════════════════════════════════

/** KRX 연간 거래일 수 — KRX 공식 기준 ~250일/년
 *  US market convention uses 252 (NYSE). KRX has fewer holidays.
 *  Used for: annualization of volatility, Sharpe, returns, CAPM beta.
 *  Worker-compatible (plain const, importScripts accessible). */
const KRX_TRADING_DAYS = 250;

// ── 기술적 지표 계산 함수 ──────────────────────────────

/** 단순 이동평균 (SMA) */
function calcMA(data, n) {
  if (!data || !data.length || n <= 0) return [];
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let j = i - n + 1; j <= i; j++) sum += data[j];
    return sum / n;
  });
}

/** 지수 이동평균 (EMA) — 첫 N개 SMA로 초기값 설정 (정확도 개선) */
function calcEMA(data, n) {
  if (!data || !data.length) return [];
  if (n <= 0) return [];
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
  if (!closes || !closes.length) return [];
  return closes.map((_, i) => {
    if (i < n - 1) return { upper: null, lower: null, mid: null };
    const sl = closes.slice(i - n + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / n;
    // Population σ (÷n) per Bollinger (2001) — intentional, not Bessel-corrected
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

/** [Phase TA-2] OBV (On-Balance Volume) — Granville (1963), Murphy (1999) Ch.7
 *  거래량을 가격 방향으로 누적하여 수급 압력을 측정하는 선행 지표.
 *  시장 심리: 가격보다 거래량이 먼저 움직인다는 전제 (Granville의 핵심 가설).
 *  - 가격 상승 + OBV 상승 = 매수세 유입 확인 (추세 건전성)
 *  - 가격 상승 + OBV 하락 = 스마트머니 이탈 (약세 다이버전스, 천장 경고)
 *  - 가격 하락 + OBV 상승 = 기관 축적 (강세 다이버전스, 바닥 경고)
 *
 *  @param {Array} candles — OHLCV 캔들 배열
 *  @returns {number[]} — OBV 누적값 배열 (candles와 동일 길이)
 */
function calcOBV(candles) {
  if (!candles || candles.length === 0) return [];
  const obv = new Array(candles.length);
  obv[0] = 0;
  for (let i = 1; i < candles.length; i++) {
    const close = candles[i].close;
    const prevClose = candles[i - 1].close;
    const volume = candles[i].volume || 0;
    if (close > prevClose) {
      obv[i] = obv[i - 1] + volume;
    } else if (close < prevClose) {
      obv[i] = obv[i - 1] - volume;
    } else {
      obv[i] = obv[i - 1];
    }
  }
  return obv;
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

  // Adaptive Q: Mohamed & Schwarz (1999), "Adaptive Kalman Filtering for INS/GPS"
  // Q_t = Q_base * (σ_t / σ̄)^2. 저변동성 → 부드러움, 고변동성 → 민감
  var ewmaVar = 0, ewmaAlpha = 0.06; // ~2/(30+1) for 30-bar EWMA
  var varSum = 0, varCount = 0;

  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0) continue;
    var ret = (closes[i] - closes[i - 1]) / closes[i - 1];
    ewmaVar = ewmaAlpha * ret * ret + (1 - ewmaAlpha) * ewmaVar;
    varSum += ewmaVar; varCount++;
    var meanVar = varSum / varCount;
    var qAdaptive = meanVar > 0 ? Q * (ewmaVar / meanVar) : Q;

    // 예측
    const xPred = x;
    const PPred = P + qAdaptive;
    // 갱신
    const K = PPred / (PPred + R);
    x = xPred + K * (closes[i] - xPred);
    P = (1 - K) * PPred;
    result[i] = x;
  }
  return result;
}

/** 허스트 지수 (Hurst Exponent) — R/S 분석 (log-returns 기반)
 *  Mandelbrot (1963) "The Variation of Certain Speculative Prices";
 *  Peters (1994) "Fractal Market Analysis", Ch.4 — R/S는 정상성(stationarity)을
 *  만족하는 수익률 시계열에 적용해야 함. 가격 수준(I(1) 비정상)은 H를 +0.4 상향 편향.
 *  Anis & Lloyd (1976) 유한표본 보정은 미적용 (James-Stein 수축이 대체).
 *
 *  H > 0.5: 추세 지속성, H < 0.5: 평균 회귀, H ≈ 0.5: 랜덤워크
 *  @param {number[]} closes — 종가 배열 (내부에서 log-returns로 변환)
 *  @param {number} minWindow — R/S 블록 최소 크기 [C] 교정 가능
 */
function calcHurst(closes, minWindow = 10) {
  // log-returns: r_t = ln(P_{t+1} / P_t). 배열 길이 = closes.length - 1
  if (closes.length < minWindow * 4 + 1) return null;

  const returns = [];
  for (let i = 0; i < closes.length - 1; i++) {
    if (closes[i] <= 0 || closes[i + 1] <= 0) return null; // 음수/0 가격 방어
    returns.push(Math.log(closes[i + 1] / closes[i]));
  }

  const logRS = [];
  const logN = [];

  for (let w = minWindow; w <= Math.floor(returns.length / 2); w = Math.floor(w * 1.5)) {
    const numBlocks = Math.floor(returns.length / w);
    let rsSum = 0;
    let validBlocks = 0;  // [M-9 fix] S=0 블록 제외 — 분모를 유효 블록 수로 교정
    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * w, (b + 1) * w);
      const mean = block.reduce((a, v) => a + v, 0) / w;
      const devs = block.map(v => v - mean);
      const cumDevs = [];
      let cum = 0;
      for (const d of devs) { cum += d; cumDevs.push(cum); }
      const R = Math.max(...cumDevs) - Math.min(...cumDevs);
      // Population σ (1/n) per Mandelbrot & Wallis (1969) convention for R/S analysis
      const S = Math.sqrt(devs.reduce((a, d) => a + d * d, 0) / w);
      if (S > 0) { rsSum += R / S; validBlocks++; }
    }
    if (validBlocks <= 0 || rsSum <= 0) continue; // flat-price stocks: S=0 → log(-Inf) 방지
    logRS.push(Math.log(rsSum / validBlocks));
    logN.push(Math.log(w));
  }

  if (logRS.length < 4) return null;
  // 선형 회귀로 기울기(H) 추정 — log(R/S) = H * log(n) + c
  const n = logRS.length;
  var sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (var ri = 0; ri < n; ri++) {
    sx += logN[ri]; sy += logRS[ri]; sxy += logN[ri] * logRS[ri]; sx2 += logN[ri] * logN[ri];
  }
  var denom = n * sx2 - sx * sx;
  if (denom === 0) return null;  // degenerate: all logN identical (shouldn't happen but guard NaN)
  var slope = (n * sxy - sx * sy) / denom;

  // R-squared for Hurst regression quality
  var sy2 = 0;
  for (var rj = 0; rj < n; rj++) sy2 += logRS[rj] * logRS[rj];
  var ssTot = sy2 - sy * sy / n;
  var ssReg = ssTot > 0 ? (n * sxy - sx * sy) * (n * sxy - sx * sy) / (n * denom) : 0;
  var rSquared = ssTot > 0 ? ssReg / ssTot : 0;

  return { H: slope, rSquared: rSquared };
}

/** Hill 꼬리 지수 추정량 — Hill (1975)
 *  α = k / Σ_{i=1}^{k} [ln(X_(i)) - ln(X_(k+1))]
 *  α < 4: 두꺼운 꼬리 (fat tail), α >= 4: 정규 근사 가능
 *  k 자동 선택: floor(sqrt(n)) — Drees & Kaufmann (1998)
 *
 *  @param {number[]} returns - 수익률 배열 (양수/음수 모두)
 *  @param {number} [k] - 상위 k개 순서 통계량 (미지정 시 자동)
 *  @returns {{ alpha: number, se: number, isHeavyTail: boolean, k: number }} 또는 null
 */
function calcHillEstimator(returns, k) {
  if (!returns || returns.length < 10) return null;
  // 절대값 정렬 (내림차순)
  var absRet = [];
  for (var i = 0; i < returns.length; i++) {
    if (returns[i] !== 0) absRet.push(Math.abs(returns[i]));
  }
  absRet.sort(function(a, b) { return b - a; });
  var n = absRet.length;
  if (n < 10) return null;

  if (!k || k < 2) k = Math.max(2, Math.floor(Math.sqrt(n)));
  if (k >= n) k = n - 1;

  // Hill 추정: α = k / Σ[ln(X_i) - ln(X_{k+1})]
  var logThreshold = Math.log(absRet[k]); // X_(k+1) in 0-indexed = absRet[k]
  if (!isFinite(logThreshold) || absRet[k] <= 0) return null;

  var sumLog = 0;
  for (var i = 0; i < k; i++) {
    var lnXi = Math.log(absRet[i]);
    if (!isFinite(lnXi)) continue;
    sumLog += lnXi - logThreshold;
  }
  if (sumLog <= 0) return null;

  var alpha = k / sumLog;
  // 점근 표준오차: se = α / sqrt(k) — Hill (1975)
  // NOTE: Hill SE assumes IID; for dependent data, decluster extremes or use block bootstrap (Drees & Kaufmann, 1998)
  var se = alpha / Math.sqrt(k);

  return { alpha: alpha, se: se, isHeavyTail: alpha < 4, k: k };
}

/**
 * GPD (Generalized Pareto Distribution) 꼬리 VaR — EVT 기반 손절가 최적화
 *
 * 학술 근거: Pickands-Balkema-de Haan 정리 (core_data/12 §3.3)
 *   임계값 초과 손실은 GPD를 따름.
 *   PWM (Probability Weighted Moments) 추정: Hosking & Wallis (1987)
 *     ξ̂ = 2 - β₀/(β₀ - 2β₁),  σ̂ = 2β₀β₁/(β₀ - 2β₁)
 *   VaR_p = u + (σ/ξ)·[((n/Nᵤ)·(1-p))^(-ξ) - 1]  (Doc 12 §4.1)
 *
 * @param {number[]} returns - 수익률 배열 (양수/음수 모두)
 * @param {number} [quantile=0.99] - VaR 신뢰수준
 * @returns {{ VaR: number, xi: number, sigma: number, u: number, Nu: number }} 또는 null
 */
function calcGPDFit(returns, quantile) {
  if (!returns || returns.length < 500) return null;  // 2년+ 일봉 필요
  // 절대값 정렬 (내림차순)
  var absRet = [];
  for (var i = 0; i < returns.length; i++) {
    if (isFinite(returns[i]) && returns[i] !== 0) absRet.push(Math.abs(returns[i]));
  }
  absRet.sort(function(a, b) { return b - a; });
  var n = absRet.length;
  if (n < 500) return null;

  // 임계값: 상위 5% (Doc 12 §3.4 실무 지침)
  var uIdx = Math.floor(n * 0.05);
  if (uIdx < 30) return null;  // 초과 관측치 최소 30개 필요
  var u = absRet[uIdx];
  if (u <= 0) return null;

  // 초과량 (exceedances)
  var exc = [];
  for (var i = 0; i < uIdx; i++) {
    var y = absRet[i] - u;
    if (y > 0) exc.push(y);
  }
  var Nu = exc.length;
  if (Nu < 20) return null;

  // PWM 추정 — exc를 오름차순 정렬
  // NOTE: PWM estimator valid only for xi < 0.5 (Hosking & Wallis, 1987); beyond this, use MLE
  exc.sort(function(a, b) { return a - b; });
  var b0 = 0, b1 = 0;
  for (var i = 0; i < Nu; i++) {
    b0 += exc[i];
    b1 += exc[i] * i / (Nu - 1);
  }
  b0 /= Nu;
  b1 /= Nu;

  var denom = b0 - 2 * b1;
  if (Math.abs(denom) < 1e-12) return null;

  var xi = 2 - b0 / denom;
  var sigma = 2 * b0 * b1 / denom;
  if (xi >= 0.5) xi = 0.499;  // PWM validity guard: clamp xi < 0.5 (Hosking & Wallis, 1987)
  if (sigma <= 0 || xi >= 1 || xi <= -0.5) return null;  // 유효 범위 확인

  // VaR at quantile p
  var p = quantile || 0.99;
  var ratio = (n / Nu) * (1 - p);
  if (ratio <= 0) return null;
  var VaR = u + (sigma / xi) * (Math.pow(ratio, -xi) - 1);
  if (!isFinite(VaR) || VaR <= 0) return null;

  return { VaR: VaR, xi: xi, sigma: sigma, u: u, Nu: Nu };
}

/**
 * CAPM Beta — 시장 모형 회귀 (core_data/25 §1.2)
 *
 * β = Cov(Rᵢ, Rₘ) / Var(Rₘ), 일별 수익률, 250일 윈도우.
 * Scholes-Williams (1977) 비동기거래 보정:
 *   β_SW = (β₋₁ + β₀ + β₊₁) / (1 + 2ρₘ)
 * 거래량 0일이 10%+ 종목은 thin-trading 경고.
 *
 * @param {number[]} stockCloses - 종목 종가 배열 (오래→최신)
 * @param {number[]} marketCloses - 시장 지수 종가 배열 (동일 날짜 정렬)
 * @param {number} [window=KRX_TRADING_DAYS] - 사용할 최근 거래일 수
 * @returns {{ beta, alpha, rSquared, thinTrading }} 또는 null
 */
function calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual) {
  var w = window || KRX_TRADING_DAYS;
  if (!stockCloses || !marketCloses) return null;
  var n = Math.min(stockCloses.length, marketCloses.length);
  if (n < 60) return null;  // 최소 60일 (3개월)
  // 최근 w일만 사용
  var startIdx = Math.max(0, n - w);

  // 일별 수익률 계산 (excess return: Rf 차감 → Jensen's alpha 정확, Sharpe 1964)
  // [C-2A] rfAnnual: KTB 10Y (bonds_latest.json). beta 불변, alpha만 보정.
  var sr = [], mr = [];
  var zeroVolDays = 0;
  var rfDaily = (rfAnnual && rfAnnual > 0) ? Math.pow(1 + rfAnnual / 100, 1 / KRX_TRADING_DAYS) - 1 : 0;
  for (var i = startIdx + 1; i < n; i++) {
    var sc = stockCloses[i], sp = stockCloses[i - 1];
    var mc = marketCloses[i], mp = marketCloses[i - 1];
    if (sp > 0 && mp > 0 && sc > 0 && mc > 0) {
      var ri = (sc - sp) / sp - rfDaily;
      var rm = (mc - mp) / mp - rfDaily;
      sr.push(ri);
      mr.push(rm);
      if (Math.abs(ri) < 1e-10) zeroVolDays++;
    }
  }
  var T = sr.length;
  if (T < 60) return null;  // MIN_OBS=60 aligned with compute_capm_beta.py

  // OLS beta: Cov(ri, rm) / Var(rm)
  var sumRi = 0, sumRm = 0;
  for (var i = 0; i < T; i++) { sumRi += sr[i]; sumRm += mr[i]; }
  var meanRi = sumRi / T, meanRm = sumRm / T;
  var cov = 0, varM = 0, varI = 0;
  for (var i = 0; i < T; i++) {
    var di = sr[i] - meanRi, dm = mr[i] - meanRm;
    cov += di * dm;
    varM += dm * dm;
    varI += di * di;
  }
  if (varM < 1e-15) return null;
  var beta0 = cov / varM;
  var alpha = meanRi - beta0 * meanRm;

  // Scholes-Williams (1977) 보정: lead/lag beta
  // Aligned with compute_capm_beta.py loop ranges
  var thinTrading = (zeroVolDays / T) > 0.10;
  var beta = beta0;
  if (thinTrading && T > 3) {
    var covLag = 0, covLead = 0, autoM = 0;
    // β₋₁: Cov(ri_t, rm_{t-1}), t ∈ [1, T-1]
    for (var i = 1; i < T; i++) {
      covLag += (sr[i] - meanRi) * (mr[i - 1] - meanRm);
    }
    // β₊₁: Cov(ri_t, rm_{t+1}), t ∈ [0, T-2]
    for (var i = 0; i < T - 1; i++) {
      covLead += (sr[i] - meanRi) * (mr[i + 1] - meanRm);
    }
    // ρ_m: autocorrelation of market returns
    for (var i = 1; i < T; i++) {
      autoM += (mr[i] - meanRm) * (mr[i - 1] - meanRm);
    }
    var rhoM = autoM / varM;
    var denomSW = 1 + 2 * rhoM;
    if (Math.abs(denomSW) > 0.01) {
      var betaLag = covLag / varM;
      var betaLead = covLead / varM;
      beta = (betaLag + beta0 + betaLead) / denomSW;
    }
  }

  // R-squared using the final beta (Scholes-Williams corrected if active)
  // Recompute alpha for the corrected beta to ensure consistent R²
  var alphaFinal = meanRi - beta * meanRm;
  var ssRes = 0, ssTot = varI;
  for (var i = 0; i < T; i++) {
    var pred = alphaFinal + beta * mr[i];
    var err = sr[i] - pred;
    ssRes += err * err;
  }
  var rSq = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    beta: +beta.toFixed(3),
    alpha: +(alphaFinal * KRX_TRADING_DAYS).toFixed(4),  // 연율화 Jensen's alpha (SW-corrected)
    rSquared: +rSq.toFixed(3),
    thinTrading: thinTrading,
    nObs: T,
  };
}

/**
 * Parkinson (1980) 역사적 변동성 추정기 — 고저 범위 기반
 *
 * 학술 근거: core_data/34_volatility_risk_premium_harv.md §3.1
 *   "Parkinson uses high-low range, ~5× more efficient than close-to-close"
 *
 * HV_Parkinson = sqrt(1/(4n·ln2) × Σ[ln(H_i/L_i)]²) × sqrt(KRX_TRADING_DAYS)
 *
 * @param {Array<{high: number, low: number}>} candles - OHLCV 캔들 배열
 * @param {number} [period=20] - 룩백 윈도우 (거래일 수)
 * @returns {number|null} 연율화 HV (소수, 예: 0.30 = 30%). 데이터 부족 시 null
 */
function calcHV(candles, period) {
  var n = period || 20;
  if (!candles || candles.length < n) return null;

  // 최근 n봉의 ln(H/L)² 합산
  var sumLogSq = 0;
  var validCount = 0;
  var start = candles.length - n;

  for (var i = start; i < candles.length; i++) {
    var hi = candles[i].high;
    var lo = candles[i].low;
    // 방어: 0 이하 또는 결측 → 건너뜀
    if (!hi || !lo || lo <= 0 || hi <= 0) continue;
    var logHL = Math.log(hi / lo);
    sumLogSq += logHL * logHL;
    validCount++;
  }

  // 유효 관측수가 period의 절반 미만이면 신뢰 불가
  if (validCount < Math.max(n / 2, 5)) return null;

  // Parkinson: σ² = 1/(4n·ln2) × Σ[ln(H/L)]²
  var LN2 = 0.6931471805599453;  // Math.LN2
  var variance = sumLogSq / (4 * validCount * LN2);

  // 연율화: σ_annual = σ_daily × √(KRX_TRADING_DAYS)
  var hv = Math.sqrt(variance) * Math.sqrt(KRX_TRADING_DAYS);

  return hv;
}

/**
 * 변동성 위험 프리미엄 (VRP) — IV² - HV²
 *
 * 학술 근거: core_data/34_volatility_risk_premium_harv.md §3.1
 *   VRP = σ²_implied - σ²_realized
 *   양수 → IV가 HV 대비 고평가 (옵션 매도 유리)
 *   음수 → IV가 HV 대비 저평가 (옵션 매수 유리)
 *
 * @param {number} vkospi - VKOSPI 지수값 (예: 20.5 → 20.5%)
 * @param {number} hvAnnualized - calcHV() 출력 (소수, 예: 0.30 = 30%)
 * @returns {number|null} VRP (소수, 분산 차이). 입력 누락 시 null
 */
function calcVRP(vkospi, hvAnnualized) {
  if (vkospi == null || hvAnnualized == null) return null;
  if (vkospi < 0 || hvAnnualized < 0) return null;

  // VKOSPI는 %단위(20.5) → 소수(0.205)로 변환 후 제곱
  var ivDecimal = vkospi / 100;
  return ivDecimal * ivDecimal - hvAnnualized * hvAnnualized;
}

/**
 * 가중 다중 선형 회귀 (WLS — Weighted Least Squares)
 *
 * 학술 근거: Reschenhofer et al. (2021)
 *   "Time-dependent WLS for Stock Returns"
 *   — WLS가 OLS보다 유의미하게 높은 예측력
 *
 * @param {number[][]} X - 설계 행렬 (n x p, 절편 열 포함)
 * @param {number[]} y - 종속 변수 (n x 1)
 * @param {number[]} weights - 가중치 (n x 1), null이면 OLS
 * @returns {{ coeffs, rSquared, stdErrors, tStats, df, fitted, sigmaHat2, invXtWX }}
 *          또는 표본 부족/특이행렬 시 null
 */
function calcWLSRegression(X, y, weights, ridgeLambda) {
  var n = X.length, p = X[0].length;
  if (n < p + 2) return null;  // 최소 표본 부족

  // X^T W X  (p x p)
  var XtWX = [];
  for (var j = 0; j < p; j++) {
    XtWX[j] = new Array(p).fill(0);
  }
  // X^T W y  (p x 1)
  var XtWy = new Array(p).fill(0);

  for (var i = 0; i < n; i++) {
    var w = weights ? weights[i] : 1;
    for (var j = 0; j < p; j++) {
      XtWy[j] += X[i][j] * w * y[i];
      for (var k = 0; k < p; k++) {
        XtWX[j][k] += X[i][j] * w * X[i][k];
      }
    }
  }

  // Ridge regularization: (X^T W X + λI) — 절편(j=0)은 페널티 미적용
  if (ridgeLambda && ridgeLambda > 0) {
    for (var j = 1; j < p; j++) {
      XtWX[j][j] += ridgeLambda;
    }
  }

  // (X^T W X + λI)^{-1} via Gauss-Jordan 소거법
  var inv = _invertMatrix(XtWX);
  if (!inv) return null;  // 특이 행렬 (다중공선성 등)

  // 회귀 계수: coeffs = inv * XtWy
  var coeffs = new Array(p).fill(0);
  for (var j = 0; j < p; j++) {
    for (var k = 0; k < p; k++) {
      coeffs[j] += inv[j][k] * XtWy[k];
    }
  }

  // 적합값 + 잔차
  var fitted = X.map(function(xi) {
    return xi.reduce(function(s, v, j) { return s + v * coeffs[j]; }, 0);
  });
  var residuals = y.map(function(yi, i) { return yi - fitted[i]; });

  // 가중 R-squared
  var wSum = weights ? weights.reduce(function(a, b) { return a + b; }, 0) : n;
  var yBarW = y.reduce(function(s, yi, i) {
    return s + (weights ? weights[i] : 1) * yi;
  }, 0) / wSum;

  var ssRes = 0, ssTot = 0;
  for (var i = 0; i < n; i++) {
    var w = weights ? weights[i] : 1;
    ssRes += w * residuals[i] * residuals[i];
    ssTot += w * (y[i] - yBarW) * (y[i] - yBarW);
  }
  var rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Adjusted R² — penalizes model complexity (Theil 1961)
  // adjR² = 1 - (1-R²)(n-1)/(n-p-1), guards against overfitting with many features
  var adjR2 = n > p + 1 ? 1 - (1 - rSquared) * (n - 1) / (n - p - 1) : rSquared;

  // 계수 표준오차
  var df = n - p;
  var sigmaHat2 = df > 0 ? ssRes / df : 0;
  var stdErrors = new Array(p).fill(0);
  for (var j = 0; j < p; j++) {
    stdErrors[j] = Math.sqrt(Math.max(0, sigmaHat2 * inv[j][j]));
  }

  // t-통계량
  var tStats = coeffs.map(function(b, j) {
    return stdErrors[j] > 0 ? b / stdErrors[j] : 0;
  });

  // HC3 이분산-견고 표준오차 (White 1980, MacKinnon & White 1985)
  // Cov_HC3 = inv * (X'W diag(e²/(1-h)²) WX) * inv
  // h_ii = x_i' inv x_i (hat matrix diagonal, leverage)
  var hcStdErrors = new Array(p).fill(0);
  var hcTStats = tStats;
  if (df > 0) {
    var meat = [];
    for (var j = 0; j < p; j++) meat[j] = new Array(p).fill(0);
    for (var i = 0; i < n; i++) {
      var w = weights ? weights[i] : 1;
      // leverage h_ii = w_i * x_i' * inv * x_i (WLS hat matrix, MacKinnon & White 1985)
      var h_ii = 0;
      for (var j = 0; j < p; j++) {
        for (var k = 0; k < p; k++) {
          h_ii += X[i][j] * inv[j][k] * X[i][k] * w;
        }
      }
      var denom = (1 - Math.min(h_ii, 0.99));
      var eScaled = w * w * residuals[i] / (denom * denom);  // w² * e_i / (1-h_ii)^2 — HC3 (MacKinnon & White 1985)
      for (var j = 0; j < p; j++) {
        for (var k = 0; k < p; k++) {
          meat[j][k] += X[i][j] * eScaled * residuals[i] * X[i][k];
        }
      }
    }
    // sandwich: inv * meat * inv
    for (var j = 0; j < p; j++) {
      var s = 0;
      for (var a = 0; a < p; a++) {
        for (var b = 0; b < p; b++) {
          s += inv[j][a] * meat[a][b] * inv[b][j];
        }
      }
      hcStdErrors[j] = Math.sqrt(Math.max(0, s));
    }
    hcTStats = coeffs.map(function(b, j) {
      return hcStdErrors[j] > 0 ? b / hcStdErrors[j] : 0;
    });
  }

  // VIF diagnostic for multicollinearity — Marquardt (1970), Belsley, Kuh & Welsch (1980)
  // VIF_j = 1/(1 - R²_j) where R²_j from auxiliary OLS: regress X_j on all other features.
  // Full auxiliary OLS (O(p³n)), feasible since p <= 10 in this system.
  // VIF > 5 flags moderate multicollinearity; VIF > 10 flags severe (Kutner et al. 2005).
  var vifs = [];
  if (p > 1) {
    for (var j = 1; j < p; j++) {
      // Auxiliary OLS: regress X_j on all other features (including intercept col 0)
      var otherCols = [];
      for (var c = 0; c < p; c++) { if (c !== j) otherCols.push(c); }
      var pAux = otherCols.length;
      // Build auxiliary design matrix Z and response yAux
      var Z = new Array(n);
      var yAux = new Array(n);
      for (var i = 0; i < n; i++) {
        yAux[i] = X[i][j];
        Z[i] = new Array(pAux);
        for (var ci = 0; ci < pAux; ci++) Z[i][ci] = X[i][otherCols[ci]];
      }
      // Z'Z
      var ZtZ = new Array(pAux);
      for (var a = 0; a < pAux; a++) {
        ZtZ[a] = new Array(pAux).fill(0);
        for (var b = 0; b < pAux; b++) {
          for (var i = 0; i < n; i++) ZtZ[a][b] += Z[i][a] * Z[i][b];
        }
      }
      var ZtZinv = _invertMatrix(ZtZ);
      var r2j = 0;
      if (ZtZinv) {
        // Z'y
        var Zty = new Array(pAux).fill(0);
        for (var a = 0; a < pAux; a++) {
          for (var i = 0; i < n; i++) Zty[a] += Z[i][a] * yAux[i];
        }
        // beta_aux = inv(Z'Z) * Z'y
        var betaAux = new Array(pAux).fill(0);
        for (var a = 0; a < pAux; a++) {
          for (var b = 0; b < pAux; b++) betaAux[a] += ZtZinv[a][b] * Zty[b];
        }
        // R²_j = 1 - SSres/SStot
        var meanJ = 0;
        for (var i = 0; i < n; i++) meanJ += yAux[i];
        meanJ /= n;
        var ssTot = 0, ssRes = 0;
        for (var i = 0; i < n; i++) {
          var pred = 0;
          for (var a = 0; a < pAux; a++) pred += Z[i][a] * betaAux[a];
          ssRes += (yAux[i] - pred) * (yAux[i] - pred);
          ssTot += (yAux[i] - meanJ) * (yAux[i] - meanJ);
        }
        r2j = ssTot > 0 ? 1 - ssRes / ssTot : 0;
        r2j = Math.max(0, Math.min(r2j, 0.9999)); // clamp to avoid division by zero
      }
      var vifJ = 1 / (1 - r2j);
      vifs.push({ feature: j, vif: +vifJ.toFixed(2), flag: vifJ > 5 });
    }
  }

  return {
    coeffs: coeffs,
    rSquared: rSquared,
    adjR2: adjR2,
    stdErrors: stdErrors,
    tStats: tStats,
    hcStdErrors: hcStdErrors,
    hcTStats: hcTStats,
    df: df,
    fitted: fitted,
    sigmaHat2: sigmaHat2,
    invXtWX: inv,
    vifs: vifs,
  };
}

/**
 * Jacobi eigenvalue algorithm for symmetric matrices (p <= 10).
 * Returns eigenvalues and eigenvectors for GCV lambda selection.
 * @param {number[][]} A - p x p symmetric matrix (modified in-place → diagonal)
 * @param {number} p - matrix dimension
 * @returns {{ eigenvalues: number[], eigenvectors: number[][] }}
 */
function _jacobiEigen(A, p) {
  // Identity matrix for eigenvector accumulation
  var V = [];
  for (var i = 0; i < p; i++) {
    V[i] = new Array(p).fill(0);
    V[i][i] = 1;
  }
  for (var iter = 0; iter < 100; iter++) {
    // Find largest off-diagonal |A[pi][qi]|
    var maxVal = 0, pi = 0, qi = 1;
    for (var i = 0; i < p; i++) {
      for (var j = i + 1; j < p; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          pi = i; qi = j;
        }
      }
    }
    if (maxVal < 1e-12) break;
    // Givens rotation angle
    var diff = A[qi][qi] - A[pi][pi];
    var t;
    if (Math.abs(A[pi][qi]) < 1e-15 * Math.abs(diff)) {
      t = A[pi][qi] / diff;
    } else {
      var phi = diff / (2 * A[pi][qi]);
      t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
      if (phi < 0) t = -t;
    }
    var c = 1 / Math.sqrt(t * t + 1);
    var s = t * c;
    var tau = s / (1 + c);
    // Apply rotation to A
    var tmp = A[pi][qi];
    A[pi][qi] = 0;
    A[pi][pi] -= t * tmp;
    A[qi][qi] += t * tmp;
    for (var j = 0; j < p; j++) {
      if (j === pi || j === qi) continue;
      var g = A[pi][j], h = A[qi][j];
      A[pi][j] = g - s * (h + g * tau);
      A[qi][j] = h + s * (g - h * tau);
      A[j][pi] = A[pi][j];
      A[j][qi] = A[qi][j];
    }
    // Accumulate eigenvectors
    for (var j = 0; j < p; j++) {
      var g2 = V[j][pi], h2 = V[j][qi];
      V[j][pi] = g2 - s * (h2 + g2 * tau);
      V[j][qi] = h2 + s * (g2 - h2 * tau);
    }
  }
  var evals = new Array(p);
  for (var i = 0; i < p; i++) evals[i] = A[i][i];
  return { eigenvalues: evals, eigenvectors: V };
}

/**
 * GCV-optimal Ridge lambda selection. Golub, Heath & Wahba (1979), Technometrics 21(2).
 * Selects lambda minimizing GCV(λ) = (RSS/n) / (1 - tr(H_λ)/n)².
 * Uses Jacobi eigendecomposition of XᵀWX for efficient trace computation.
 *
 * @param {number[][]} X - n x p standardized design matrix (col 0 = intercept)
 * @param {number[]} y - n x 1 response (returns)
 * @param {number[]} weights - n x 1 exponential decay weights
 * @param {number} p - column count (5)
 * @returns {number} optimal lambda (1.0 fallback if GCV unreliable)
 */
function selectRidgeLambdaGCV(X, y, weights, p) {
  var n = X.length;
  if (n < 2 * p) return 1.0;

  // Step 1: Form A = XᵀWX (p x p) and b = XᵀWy (p x 1)
  var A = [], b = new Array(p).fill(0), yNorm2 = 0;
  for (var j = 0; j < p; j++) A[j] = new Array(p).fill(0);
  for (var i = 0; i < n; i++) {
    var w = weights ? weights[i] : 1;
    yNorm2 += w * y[i] * y[i];
    for (var j = 0; j < p; j++) {
      b[j] += X[i][j] * w * y[i];
      for (var k = j; k < p; k++) {
        var val = X[i][j] * w * X[i][k];
        A[j][k] += val;
        if (k !== j) A[k][j] += val;
      }
    }
  }

  // Step 2: Eigendecompose A (deep copy — Jacobi modifies in-place)
  var Ac = [];
  for (var j = 0; j < p; j++) Ac[j] = A[j].slice();
  var eig = _jacobiEigen(Ac, p);
  var sigma = eig.eigenvalues;
  var V = eig.eigenvectors;
  for (var j = 0; j < p; j++) {
    if (sigma[j] < 1e-10) sigma[j] = 1e-10;
  }

  // Step 3: z = Vᵀ b
  var z = new Array(p).fill(0);
  for (var j = 0; j < p; j++) {
    for (var k = 0; k < p; k++) z[j] += V[k][j] * b[k];
  }

  // Step 4: RSS_perp (lambda-independent)
  var rssPerp = yNorm2;
  for (var j = 0; j < p; j++) rssPerp -= z[j] * z[j] / sigma[j];
  if (rssPerp < 0) rssPerp = 0;

  // Step 5: GCV grid search
  var grid = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0];
  var bestLam = 1.0, bestGCV = Infinity;
  var gcvArr = [];
  for (var gi = 0; gi < grid.length; gi++) {
    var lam = grid[gi];
    var trH = 0, rssBias = 0;
    for (var j = 0; j < p; j++) {
      var lamj = (j === 0) ? 0 : lam;
      var den = sigma[j] + lamj;
      trH += sigma[j] / den;
      rssBias += lamj * lamj * z[j] * z[j] / (sigma[j] * den * den);
    }
    var rss = rssPerp + rssBias;
    var gcvDen = 1 - trH / n;
    if (gcvDen < 0.05) { gcvArr.push(Infinity); continue; }
    var gcv = (rss / n) / (gcvDen * gcvDen);
    gcvArr.push(gcv);
    if (gcv < bestGCV) { bestGCV = gcv; bestLam = lam; }
  }

  // Step 6: Flatness check — if GCV varies < 1%, surface is flat → default
  var gcvMin = Infinity, gcvMax = -Infinity, cnt = 0;
  for (var gi = 0; gi < gcvArr.length; gi++) {
    if (gcvArr[gi] < Infinity) {
      if (gcvArr[gi] < gcvMin) gcvMin = gcvArr[gi];
      if (gcvArr[gi] > gcvMax) gcvMax = gcvArr[gi];
      cnt++;
    }
  }
  if (cnt >= 2 && gcvMin > 0 && (gcvMax - gcvMin) / gcvMin < 0.01) return 1.0;

  return bestLam;
}

/** OLS 추세선 — calcWLSRegression wrapper (uniform weights, λ=0)
 *  Lo & MacKinlay (1999): 가격 수준 R² > 0.15 = 추세 존재, > 0.50 = 강한 추세
 *  slope는 ATR(14)로 정규화하여 가격대 무관 비교 가능
 *
 *  @param {number[]} closes - 종가 배열
 *  @param {number} [window=20] - 회귀 윈도우 크기
 *  @param {number} [atr14Last] - 최근 ATR(14), 미지정 시 close*0.02 fallback
 *  @returns {{ slope: number, slopeNorm: number, intercept: number, r2: number,
 *             direction: string, tStat: number }} 또는 null
 */
function calcOLSTrend(closes, window, atr14Last) {
  if (!window) window = 20;
  if (!closes || closes.length < window) return null;

  // 최근 window개 종가 추출
  var seg = closes.slice(closes.length - window);
  var atr = atr14Last && atr14Last > 0 ? atr14Last : seg[seg.length - 1] * 0.02;

  // 설계 행렬 [[1, 0], [1, 1], ..., [1, window-1]]
  var X = [];
  for (var i = 0; i < window; i++) {
    X.push([1, i]);
  }

  var reg = calcWLSRegression(X, seg, null, 0);
  if (!reg) return null;

  var slope = reg.coeffs[1];
  var slopeNorm = atr > 0 ? slope / atr : 0;
  var direction = Math.abs(slopeNorm) < 0.05 ? 'flat'
    : slopeNorm > 0 ? 'up' : 'down';

  return {
    slope: slope,
    slopeNorm: slopeNorm,
    intercept: reg.coeffs[0],
    r2: reg.rSquared,
    direction: direction,
    tStat: reg.tStats[1]
  };
}

/**
 * 행렬 역행렬 (Gauss-Jordan 소거법, 부분 피벗팅)
 * 설계 행렬 크기 제한 없음 (일반적으로 5x5 이하)
 * @param {number[][]} m - 정방 행렬 (n x n)
 * @returns {number[][]|null} — 역행렬 또는 특이행렬 시 null
 */
function _invertMatrix(m) {
  var n = m.length;
  // 증강 행렬 [m | I] 구성
  var aug = [];
  for (var i = 0; i < n; i++) {
    aug[i] = new Array(2 * n);
    for (var j = 0; j < n; j++) aug[i][j] = m[i][j];
    for (var j = 0; j < n; j++) aug[i][n + j] = (i === j) ? 1 : 0;
  }

  for (var col = 0; col < n; col++) {
    // 부분 피벗팅: 최대 절대값 행 탐색
    var maxRow = col;
    for (var row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    // 행 교환
    var temp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = temp;

    // 특이 행렬 판별
    if (Math.abs(aug[col][col]) < 1e-12) return null;

    // 피벗 행 정규화
    var pivot = aug[col][col];
    for (var j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // 다른 행에서 피벗 열 소거
    for (var row = 0; row < n; row++) {
      if (row === col) continue;
      var factor = aug[row][col];
      for (var j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  // 역행렬 추출 (우측 n열)
  var result = [];
  for (var i = 0; i < n; i++) {
    result[i] = aug[i].slice(n);
  }
  return result;
}

/** MACD (12, 26, 9) */
function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = emaFast.map((v, i) => i < slow - 1 ? null : v - emaSlow[i]);
  const validMacd = macdLine.filter(v => v !== null && !isNaN(v));
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
  for (let i = period; i < adxStart; i++) {
    dxSum += (dx[i] || 0);
  }
  adx[adxStart] = dxSum / period;

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


// ══════════════════════════════════════════════════════
//  Theil-Sen Robust Trendline — Theil (1950), Sen (1968)
//  core_data/07 §2.3: 이상치 저항 기울기 추정
//  b = median{(yj-yi)/(xj-xi) for all i<j}
//  a = median{yi - b*xi}
// ══════════════════════════════════════════════════════

function calcTheilSen(xValues, yValues) {
  var n = Math.min(xValues.length, yValues.length);
  if (n < 2) return null;
  if (n === 2) {
    var dx = xValues[1] - xValues[0];
    if (dx === 0) return null;
    var slope = (yValues[1] - yValues[0]) / dx;
    return { slope: slope, intercept: yValues[0] - slope * xValues[0] };
  }
  // All-pairs slopes
  var slopes = [];
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var d = xValues[j] - xValues[i];
      if (d !== 0) slopes.push((yValues[j] - yValues[i]) / d);
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort(function(a, b) { return a - b; });
  var mid = Math.floor(slopes.length / 2);
  var medSlope = slopes.length % 2 === 1 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
  // Median intercept
  var intercepts = [];
  for (var k = 0; k < n; k++) {
    intercepts.push(yValues[k] - medSlope * xValues[k]);
  }
  intercepts.sort(function(a, b) { return a - b; });
  var midI = Math.floor(intercepts.length / 2);
  var medIntercept = intercepts.length % 2 === 1 ? intercepts[midI] : (intercepts[midI - 1] + intercepts[midI]) / 2;
  return { slope: medSlope, intercept: medIntercept };
}


// ══════════════════════════════════════════════════════
//  EWMA 변동성 — J.P. Morgan RiskMetrics (1996) IGARCH
//  Bollerslev (1986) GARCH(1,1) 특수 케이스 (omega=0, alpha+beta=1)
//  σ²_t = λ·σ²_{t-1} + (1-λ)·r²_{t-1},  r_t = ln(P_t / P_{t-1})
//  [B] lambda=0.94 — Academic Tunable (RiskMetrics daily default)
// ══════════════════════════════════════════════════════

/**
 * EWMA 조건부 변동성 계산
 * Bollerslev (1986) GARCH(1,1) IGARCH 특수 케이스 (omega=0)
 * J.P. Morgan RiskMetrics (1996): lambda=0.94 for daily data
 *
 * @param {number[]} closes — 종가 배열 (양수)
 * @param {number} [lambda=0.94] — 감쇠 계수 [B] Tunable: 일간=0.94, 분간=0.97
 * @returns {number[]} — 조건부 표준편차 배열 (index 0 = null, 최소 2개 필요)
 */
function calcEWMAVol(closes, lambda) {
  // λ=0.94: RiskMetrics (1996) G7 default; adequate for KRX large-cap liquidity — KRX-specific calibration TBD
  if (lambda === undefined || lambda === null) lambda = 0.94; // [B] RiskMetrics default
  var len = closes.length;
  var result = new Array(len).fill(null);
  if (len < 2) return result;

  // log-returns: r_t = ln(P_t / P_{t-1}). 양수 방어
  var returns = new Array(len).fill(null);
  for (var i = 1; i < len; i++) {
    if (closes[i] <= 0 || closes[i - 1] <= 0) return result; // 음수/0 가격 방어
    returns[i] = Math.log(closes[i] / closes[i - 1]);
  }

  // 초기 분산: 첫 min(20, len-1)개 수익률의 표본 분산
  var initN = Math.min(20, len - 1);
  var initSum = 0, initSumSq = 0;
  for (var i = 1; i <= initN; i++) {
    initSum += returns[i];
    initSumSq += returns[i] * returns[i];
  }
  var initMean = initSum / initN;
  var initVar = initSumSq / initN - initMean * initMean;
  if (initVar <= 0) initVar = 1e-8; // flat-price 방어

  // EWMA 재귀: σ²_t = λ·σ²_{t-1} + (1-λ)·r²_{t-1}
  var variance = initVar;
  var oneMinusLambda = 1 - lambda;

  for (var i = 1; i <= initN; i++) {
    result[i] = Math.sqrt(initVar);
  }
  for (var i = initN + 1; i < len; i++) {
    var r = returns[i]; // r_i = ln(P_i / P_{i-1})
    if (r === null) break;
    // 업데이트: 직전 수익률로 현재 분산 추정
    variance = lambda * variance + oneMinusLambda * returns[i] * returns[i];
    result[i] = Math.sqrt(variance);
  }
  return result;
}

/**
 * 변동성 레짐 분류 — 장기 평균 대비 현재 변동성 비율
 * 장기 평균: EMA(σ, alpha=0.01) — ~100 bar half-life (2/alpha - 1 ≈ 199)
 *
 * @param {number[]} ewmaVol — calcEWMAVol() 반환값 (null 포함)
 * @returns {string[]} — 'low' (ratio < 0.75) | 'mid' (0.75-1.50) | 'high' (> 1.50) | null
 */
function classifyVolRegime(ewmaVol) {
  var VOL_REGIME_LOW = 0.75;   // below 75% of long-run EMA = low vol
  var VOL_REGIME_HIGH = 1.50;  // above 150% of long-run EMA = high vol

  var len = ewmaVol.length;
  var result = new Array(len).fill(null);
  var longRunEMA = null;
  var alpha = 0.01; // [B] ~100 bar half-life: EMA alpha for long-run mean

  for (var i = 0; i < len; i++) {
    var sigma = ewmaVol[i];
    if (sigma === null || sigma <= 0) continue;

    if (longRunEMA === null) {
      longRunEMA = sigma;
    } else {
      longRunEMA = alpha * sigma + (1 - alpha) * longRunEMA;
    }

    if (longRunEMA <= 0) continue;
    var ratio = sigma / longRunEMA;

    if (ratio < VOL_REGIME_LOW) {
      result[i] = 'low';
    } else if (ratio <= VOL_REGIME_HIGH) {
      result[i] = 'mid';
    } else {
      result[i] = 'high';
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════
//  Amihud ILLIQ — Amihud (2002) Illiquidity Measure
//  ILLIQ = (1/D) × Σ|r_t|/DVOL_t, Doc18 §3.1
//  유동성 기반 패턴 신뢰도 할인: Kyle (1985) λ ∝ 1/depth
// ══════════════════════════════════════════════════════

/**
 * Amihud ILLIQ 계산 (Amihud 2002, Doc18 §3.1)
 * @param {Array} candles - OHLCV 일봉 배열 ({close, volume})
 * @param {number} [window=20] - 관측일 수 (#162)
 * @returns {{ illiq: number|null, logIlliq: number|null, level: string, confDiscount: number }}
 */
function calcAmihudILLIQ(candles, window) {
  var WINDOW = window || 20;            // [B] #162 Amihud (2002) standard
  var CONF_DISCOUNT = 0.85;             // [C] #163 max discount for illiquid
  // logIlliq = log10(raw_illiq × 1e8). KRW DVOL 스케일:
  //   KOSPI 200: logIlliq ~ -5 (매우 유동), KOSDAQ 중형: ~ -2, KOSDAQ 소형: ~ 0+
  var LOG_HIGH = -1.0;                  // [C] #164 logIlliq > -1 → 고비유동 (DVOL 작음)
  var LOG_LOW = -3.0;                   // [C] #165 logIlliq < -3 → 유동 (할인 없음)

  if (!candles || candles.length < WINDOW + 1)
    return { illiq: null, logIlliq: null, level: 'unknown', confDiscount: 1.0 };

  var start = candles.length - WINDOW - 1;
  var sum = 0, validDays = 0;

  for (var i = start + 1; i < candles.length; i++) {
    var prev = candles[i - 1], cur = candles[i];
    if (!cur.close || !prev.close || prev.close <= 0) continue;
    if (!cur.volume || cur.volume <= 0) continue;
    var r = Math.abs((cur.close - prev.close) / prev.close);
    var dvol = cur.close * cur.volume;
    if (dvol > 0) { sum += r / dvol; validDays++; }
  }

  if (validDays < 10) return { illiq: null, logIlliq: null, level: 'unknown', confDiscount: 1.0 };

  var illiq = sum / validDays;
  var logIlliq = illiq > 0 ? +(Math.log10(illiq * 1e8)).toFixed(2) : null;
  var level = (logIlliq === null || logIlliq <= LOG_LOW) ? 'liquid'
    : logIlliq >= LOG_HIGH ? 'illiquid' : 'moderate';

  // 신뢰도 할인: logIlliq 기반 선형 보간 (KRW-safe, 2-C validation R-1)
  var confDiscount = 1.0;
  if (logIlliq !== null) {
    if (logIlliq >= LOG_HIGH) {
      confDiscount = CONF_DISCOUNT;
    } else if (logIlliq > LOG_LOW) {
      var t = (logIlliq - LOG_LOW) / (LOG_HIGH - LOG_LOW);
      confDiscount = 1.0 - t * (1.0 - CONF_DISCOUNT);
    }
  }

  return { illiq: illiq, logIlliq: logIlliq, level: level, confDiscount: +confDiscount.toFixed(3) };
}

// ══════════════════════════════════════════════════════
//  구조적 변환점 탐지 — Page (1954) CUSUM + Bai-Perron (1998)
//  레짐 인식 패턴 가중치를 위한 변환점 검출
// ══════════════════════════════════════════════════════

/**
 * Online CUSUM 변환점 탐지 — Page (1954)
 * 양방향 CUSUM + 슬랙 파라미터로 ARL 최적화 (Roberts 1966)
 *
 * [Phase TA-3 C-1] Volatility-adaptive threshold (Doc34 §2.3)
 * volRegime 전달 시 임계값 자동 적응:
 *   high → 3.5 (false alarm 억제), mid/null → default, low → 1.5 (감도 향상)
 *
 * @param {number[]} returns — 로그수익률 배열
 * @param {number} [threshold=2.5] — 탐지 임계값 (σ 단위)
 * @param {string} [volRegime] — 변동성 레짐 ('low'/'mid'/'high', classifyVolRegime 결과)
 * @returns {{breakpoints: Array<{index:number, direction:string, magnitude:number}>,
 *            cusum: {plus:number, minus:number}, isRecent: boolean, adaptedThreshold: number}}
 */
function calcOnlineCUSUM(returns, threshold, volRegime) {
  if (threshold === undefined || threshold === null) threshold = 2.5;

  // [Phase TA-3 C-1] Volatility-adaptive threshold — Doc34 §2.3
  // High volatility: raise threshold to reduce false alarms (ARL↑)
  // Low volatility: lower threshold to increase sensitivity (ARL↓)
  if (volRegime === 'high') threshold = Math.max(threshold, 3.5);
  else if (volRegime === 'low') threshold = Math.min(threshold, 1.5);

  var empty = { breakpoints: [], cusum: { plus: 0, minus: 0 }, isRecent: false, adaptedThreshold: threshold };
  if (!returns || returns.length < 40) return empty;

  var len = returns.length;
  var breakpoints = [];

  // NOTE: ARL calibration assumes standard CUSUM; adaptive h/k variant may differ — validate with simulation
  // EMA 기반 러닝 평균/분산 — alpha = 2/31 (~30-bar half-life)
  var alpha = 2 / 31;   // [B] ~30-bar half-life for adaptive mean/variance
  var slack = 0.5;       // [B] Roberts (1966) ARL 최적화 슬랙
  var warmup = 30;       // [B] 워밍업 기간 (초기 평균/분산 안정화)

  // 초기 통계: 첫 warmup 구간의 표본 평균/분산
  var initSum = 0;
  var initSumSq = 0;
  for (var i = 0; i < warmup; i++) {
    initSum += returns[i];
    initSumSq += returns[i] * returns[i];
  }
  var runMean = initSum / warmup;
  var runVar = initSumSq / warmup - runMean * runMean;
  if (runVar <= 0) runVar = 1e-10; // flat-price 방어

  // 양방향 CUSUM 상태
  var sPlus = 0;   // 상향 감지 CUSUM
  var sMinus = 0;  // 하향 감지 CUSUM

  for (var i = warmup; i < len; i++) {
    var r = returns[i];

    // z-score 표준화
    var sigma = Math.sqrt(runVar);
    if (sigma < 1e-12) sigma = 1e-12;
    var z = (r - runMean) / sigma;

    // 양방향 CUSUM 업데이트 (슬랙 차감 후 0 이상 유지)
    sPlus = Math.max(0, sPlus + z - slack);
    sMinus = Math.max(0, sMinus - z - slack);

    // 임계값 초과 → 변환점 기록 + CUSUM 리셋
    if (sPlus > threshold) {
      breakpoints.push({ index: i, direction: 'up', magnitude: sPlus });
      sPlus = 0;
    }
    if (sMinus > threshold) {
      breakpoints.push({ index: i, direction: 'down', magnitude: sMinus });
      sMinus = 0;
    }

    // EMA 기반 러닝 통계 업데이트
    var oldMean = runMean;
    runMean = alpha * r + (1 - alpha) * runMean;
    var diff = r - oldMean;
    runVar = alpha * (diff * diff) + (1 - alpha) * runVar;
    if (runVar <= 0) runVar = 1e-10;
  }

  // isRecent: 마지막 변환점이 최근 20 바 이내인지
  var isRecent = false;
  if (breakpoints.length > 0) {
    isRecent = (len - 1 - breakpoints[breakpoints.length - 1].index) <= 20;
  }

  return {
    breakpoints: breakpoints,
    cusum: { plus: sPlus, minus: sMinus },
    isRecent: isRecent,
    adaptedThreshold: threshold  // [Phase TA-3 C-1] 실제 적용된 임계값 반환
  };
}

/**
 * 이진 분할 구조적 변환점 — 단순화 Bai-Perron (1998)
 * BIC 기준 최적 분할점 탐색 (Greedy binary segmentation)
 *
 * 복잡도: O(n × maxBreaks × maxSegmentSize)
 * 252-bar, maxBreaks=3 → ~576 반복 (실시간 적합)
 *
 * @param {number[]} returns — 로그수익률 배열
 * @param {number} [maxBreaks=3] — 최대 변환점 수
 * @param {number} [minSegment=30] — 최소 구간 길이
 * @returns {{breakpoints: Array<{index:number, leftMean:number, rightMean:number,
 *            leftStd:number, rightStd:number, bicDelta:number}>}}
 */
function calcBinarySegmentation(returns, maxBreaks, minSegment) {
  if (maxBreaks === undefined || maxBreaks === null) maxBreaks = 3;
  if (minSegment === undefined || minSegment === null) minSegment = 30;

  var empty = { breakpoints: [] };
  if (!returns || returns.length < 2 * minSegment) return empty;

  var len = returns.length;

  // 구간 [start, end)의 BIC 계산
  // BIC = n * log(max(RSS/n, 1e-12)) + 2 * log(n)
  function segmentBIC(start, end) {
    var n = end - start;
    if (n <= 1) return 0;
    var sum = 0;
    for (var i = start; i < end; i++) sum += returns[i];
    var mean = sum / n;
    var rss = 0;
    for (var i = start; i < end; i++) {
      var d = returns[i] - mean;
      rss += d * d;
    }
    return n * Math.log(Math.max(rss / n, 1e-12)) + 2 * Math.log(n);
  }

  // 구간 통계 계산 헬퍼
  function segmentStats(start, end) {
    var n = end - start;
    if (n <= 0) return { mean: 0, std: 0 };
    var sum = 0;
    for (var i = start; i < end; i++) sum += returns[i];
    var mean = sum / n;
    var sumSq = 0;
    for (var i = start; i < end; i++) {
      var d = returns[i] - mean;
      sumSq += d * d;
    }
    return { mean: mean, std: Math.sqrt(sumSq / n) };
  }

  // 초기 구간 목록: 전체 [0, len)
  var segments = [{ start: 0, end: len }];
  var breakpoints = [];

  for (var iter = 0; iter < maxBreaks; iter++) {
    var bestDelta = 0;     // BIC 개선량 (양수 = 개선)
    var bestSplit = -1;    // 분할 위치
    var bestSegIdx = -1;   // 분할 대상 구간 인덱스

    // 각 구간에서 최적 분할점 탐색
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var segLen = seg.end - seg.start;
      if (segLen < 2 * minSegment) continue; // 분할 불가능한 짧은 구간

      var parentBIC = segmentBIC(seg.start, seg.end);

      // 최소 구간 길이를 보장하는 범위 내에서 분할점 탐색
      for (var k = seg.start + minSegment; k <= seg.end - minSegment; k++) {
        var leftBIC = segmentBIC(seg.start, k);
        var rightBIC = segmentBIC(k, seg.end);
        var delta = parentBIC - (leftBIC + rightBIC); // 양수 = 분할이 개선

        if (delta > bestDelta) {
          bestDelta = delta;
          bestSplit = k;
          bestSegIdx = s;
        }
      }
    }

    // BIC 개선 없으면 조기 종료
    if (bestDelta <= 0 || bestSegIdx < 0) break;

    // 변환점 기록 (좌/우 구간 통계 포함)
    var parentSeg = segments[bestSegIdx];
    var leftStats = segmentStats(parentSeg.start, bestSplit);
    var rightStats = segmentStats(bestSplit, parentSeg.end);

    breakpoints.push({
      index: bestSplit,
      leftMean: leftStats.mean,
      rightMean: rightStats.mean,
      leftStd: leftStats.std,
      rightStd: rightStats.std,
      bicDelta: bestDelta
    });

    // 구간 분할: 부모 구간을 좌/우 두 구간으로 교체
    segments.splice(bestSegIdx, 1,
      { start: parentSeg.start, end: bestSplit },
      { start: bestSplit, end: parentSeg.end }
    );
  }

  // 인덱스 순으로 정렬
  breakpoints.sort(function(a, b) { return a.index - b.index; });

  return { breakpoints: breakpoints };
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
    if (this._closes === null) {
      this._closes = this._candles.map(c => c.close);
    }
    return this._closes;
  }

  /** 거래량 배열 (lazy) */
  get volumes() {
    if (this._volumes === null) {
      this._volumes = this._candles.map(c => c.volume);
    }
    return this._volumes;
  }

  // ── 지표 접근자 (Lazy) ─────────────────────────────

  /** SMA(n) — 기본 5, 20, 60 */
  ma(n) {
    const key = `ma_${n}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcMA(this.closes, n);
    }
    return this._cache[key];
  }

  /** EMA(n) — 기본 12, 26 */
  ema(n) {
    const key = `ema_${n}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcEMA(this.closes, n);
    }
    return this._cache[key];
  }

  /** 볼린저 밴드 (n, mult) */
  bb(n = 20, mult = 2) {
    const key = `bb_${n}_${mult}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcBB(this.closes, n, mult);
    }
    return this._cache[key];
  }

  /** EVT-aware 볼린저 밴드 — Hill alpha < 4 시 자동 확대 (core_data/12 §7.1)
   *  Gopikrishnan (1999): 금융 수익률 α≈3 → ±2σ 과소추정
   *  확대 공식: mult * (1 + 0.45 * max(0, 4 - α))
   *  [Phase0-#7] 계수 0.15→0.45: 이론값 정상화 (기존=이론의 1/3) */
  bbEVT(n = 20, baseMult = 2) {
    const key = `bbEVT_${n}_${baseMult}`;
    if (!(key in this._cache)) {
      var hillResult = this.hill();
      var evtMult = baseMult;
      if (hillResult && hillResult.alpha > 0 && hillResult.alpha < 4) {
        evtMult = baseMult * (1 + 0.45 * (4 - hillResult.alpha));
      }
      this._cache[key] = calcBB(this.closes, n, evtMult);
    }
    return this._cache[key];
  }

  /** RSI (period) */
  rsi(period = 14) {
    const key = `rsi_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcRSI(this.closes, period);
    }
    return this._cache[key];
  }

  /** ATR (period) */
  atr(period = 14) {
    const key = `atr_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcATR(this._candles, period);
    }
    return this._cache[key];
  }

  /** [Phase TA-2] OBV — Granville (1963) 누적 거래량 */
  obv() {
    const key = 'obv';
    if (!(key in this._cache)) {
      this._cache[key] = calcOBV(this._candles);
    }
    return this._cache[key];
  }

  /** MACD (fast, slow, sig) */
  macd(fast = 12, slow = 26, sig = 9) {
    const key = `macd_${fast}_${slow}_${sig}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcMACD(this.closes, fast, slow, sig);
    }
    return this._cache[key];
  }

  /** 일목균형표 */
  ichimoku(conv = 9, base = 26, spanBPeriod = 52, displacement = 26) {
    const key = `ich_${conv}_${base}_${spanBPeriod}_${displacement}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcIchimoku(this._candles, conv, base, spanBPeriod, displacement);
    }
    return this._cache[key];
  }

  /** 칼만 필터 */
  kalman(Q = 0.01, R = 1.0) {
    const key = `kalman_${Q}_${R}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcKalman(this.closes, Q, R);
    }
    return this._cache[key];
  }

  /** 허스트 지수 — { H: number, rSquared: number } 또는 null */
  hurst(minWindow = 10) {
    const key = `hurst_${minWindow}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcHurst(this.closes, minWindow);
    }
    return this._cache[key];
  }

  /** OLS 추세선 (window) — slope/r2/direction */
  olsTrend(window = 20) {
    const key = `olsTrend_${window}`;
    if (!(key in this._cache)) {
      const atrArr = this.atr(14);
      const lastATR = atrArr && atrArr.length > 0 ? atrArr[atrArr.length - 1] : null;
      this._cache[key] = calcOLSTrend(this.closes, window, lastATR);
    }
    return this._cache[key];
  }

  /** Hill 꼬리 지수 — 수익률 분포 tail thickness */
  hill(k) {
    const key = `hill_${k || 'auto'}`;
    if (!(key in this._cache)) {
      const cl = this.closes;
      if (cl.length < 11) { this._cache[key] = null; }
      else {
        const rets = [];
        for (let i = 1; i < cl.length; i++) {
          if (cl[i - 1] > 0) rets.push((cl[i] - cl[i - 1]) / cl[i - 1]);
        }
        this._cache[key] = calcHillEstimator(rets, k);
      }
    }
    return this._cache[key];
  }

  /** GPD 꼬리 VaR — EVT 손절 최적화용 (n≥500 필요, Doc 12 §4.1) */
  gpdVaR(quantile) {
    var q = quantile || 0.99;
    var key = 'gpdVaR_' + q;
    if (!(key in this._cache)) {
      var cl = this.closes;
      if (cl.length < 501) { this._cache[key] = null; }
      else {
        var rets = [];
        for (var i = 1; i < cl.length; i++) {
          if (cl[i - 1] > 0) rets.push((cl[i] - cl[i - 1]) / cl[i - 1]);
        }
        this._cache[key] = calcGPDFit(rets, q);
      }
    }
    return this._cache[key];
  }

  /** EWMA 조건부 변동성 배열 — RiskMetrics lambda=0.94 [B] */
  ewmaVol(lambda) {
    var lam = (lambda !== undefined && lambda !== null) ? lambda : 0.94;
    var key = 'ewmaVol_' + lam;
    if (!(key in this._cache)) {
      this._cache[key] = calcEWMAVol(this.closes, lam);
    }
    return this._cache[key];
  }

  /** 변동성 레짐 분류 배열 — 'low'/'mid'/'high'/null [B] */
  volRegime(lambda) {
    var lam = (lambda !== undefined && lambda !== null) ? lambda : 0.94;
    var key = 'volRegime_' + lam;
    if (!(key in this._cache)) {
      this._cache[key] = classifyVolRegime(this.ewmaVol(lam));
    }
    return this._cache[key];
  }

  // ── 구조적 변환점 접근자 ──────────────────────────────

  /** Online CUSUM 변환점 — Page (1954), Roberts (1966) slack
   *  [Phase TA-3 C-1] volRegime 전달 시 임계값 자동 적응 */
  cusum(threshold, volRegime) {
    var thr = (threshold !== undefined && threshold !== null) ? threshold : 2.5;
    var vr = volRegime || null;
    var key = 'cusum_' + thr + (vr ? '_' + vr : '');
    if (!(key in this._cache)) {
      var cl = this.closes;
      if (cl.length < 2) {
        this._cache[key] = { breakpoints: [], cusum: { plus: 0, minus: 0 }, isRecent: false, adaptedThreshold: thr };
      } else {
        var rets = [];
        for (var i = 1; i < cl.length; i++) {
          if (cl[i] > 0 && cl[i - 1] > 0) {
            rets.push(Math.log(cl[i] / cl[i - 1]));
          } else {
            rets.push(0);
          }
        }
        this._cache[key] = calcOnlineCUSUM(rets, thr, vr);
      }
    }
    return this._cache[key];
  }

  /** 이진 분할 구조적 변환점 — Bai-Perron (1998) */
  binarySegmentation(maxBreaks, minSegment) {
    var mb = (maxBreaks !== undefined && maxBreaks !== null) ? maxBreaks : 3;
    var ms = (minSegment !== undefined && minSegment !== null) ? minSegment : 30;
    var key = 'binSeg_' + mb + '_' + ms;
    if (!(key in this._cache)) {
      var cl = this.closes;
      if (cl.length < 2) {
        this._cache[key] = { breakpoints: [] };
      } else {
        var rets = [];
        for (var i = 1; i < cl.length; i++) {
          if (cl[i] > 0 && cl[i - 1] > 0) {
            rets.push(Math.log(cl[i] / cl[i - 1]));
          } else {
            rets.push(0);
          }
        }
        this._cache[key] = calcBinarySegmentation(rets, mb, ms);
      }
    }
    return this._cache[key];
  }

  // ── 오실레이터 접근자 ───────────────────────────────

  /** 스토캐스틱 (%K, %D) */
  stochastic(kPeriod = 14, dPeriod = 3, smooth = 3) {
    const key = `stoch_${kPeriod}_${dPeriod}_${smooth}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcStochastic(this._candles, kPeriod, dPeriod, smooth);
    }
    return this._cache[key];
  }

  /** 스토캐스틱 RSI (%K, %D) */
  stochRsi(rsiPeriod = 14, kPeriod = 3, dPeriod = 3, stochPeriod = 14) {
    const key = `stochRsi_${rsiPeriod}_${kPeriod}_${dPeriod}_${stochPeriod}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcStochRSI(this.closes, rsiPeriod, kPeriod, dPeriod, stochPeriod);
    }
    return this._cache[key];
  }

  /** CCI (Commodity Channel Index) */
  cci(period = 20) {
    const key = `cci_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcCCI(this._candles, period);
    }
    return this._cache[key];
  }

  /** ADX (+DI, -DI, ADX) */
  adx(period = 14) {
    const key = `adx_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcADX(this._candles, period);
    }
    return this._cache[key];
  }

  /** 윌리엄스 %R */
  williamsR(period = 14) {
    const key = `wr_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcWilliamsR(this._candles, period);
    }
    return this._cache[key];
  }


  // ── 거래량 이동평균 (VMA) ──────────────────────────

  /** 거래량 이동평균 (Volume Moving Average) */
  vma(n = 20) {
    const key = `vma_${n}`;
    if (!(key in this._cache)) {
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

  /**
   * 거래량 z-score: 로그정규분포 기반 (Ane & Geman 2000)
   * 종목별 거래량 분포 특성을 반영하여 대형주/소형주 동일 기준 적용
   * @param {number} idx — 캔들 인덱스
   * @param {number} n — 관측 기간 (기본 20)
   * @returns {number|null}
   */
  volZScore(idx, n = 20) {
    const key = `volz_${n}`;
    if (!(key in this._cache)) {
      const vols = this.volumes;
      const result = new Array(vols.length).fill(null);
      for (let i = n; i < vols.length; i++) {
        let sumLn = 0, sumLn2 = 0, cnt = 0;
        for (let j = i - n; j < i; j++) {
          if (vols[j] > 0) { const lv = Math.log(vols[j]); sumLn += lv; sumLn2 += lv * lv; cnt++; }
        }
        if (cnt < 5 || vols[i] <= 0) continue;
        const meanLn = sumLn / cnt;
        const stdLn = Math.sqrt(Math.max(0, sumLn2 / cnt - meanLn * meanLn));
        if (stdLn < 1e-9) continue;
        result[i] = (Math.log(vols[i]) - meanLn) / stdLn;
      }
      this._cache[key] = result;
    }
    const arr = this._cache[key];
    return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
  }

  // ── 주의 상태 (Stigler/Peng-Xiong Attention Theory) ──

  /**
   * [DEAD] 주의 결핍/폭발 상태 — Stigler (1961) 정보 비용 + Peng & Xiong (2006) 제한적 주의
   * 거래량 결핍 후 갑작스러운 폭발은 과잉반응 유발 (core_data/18 §5.1)
   * 미사용 — 행동재무 시그널 활성화 시 재활용 후보
   * @param {number} idx — 캔들 인덱스
   * @param {number} lookback — 백분위 산출 기간 (기본 20)
   * @returns {{ deprivationDays: number, isAttentionJump: boolean, multiplier: number }|null}
   */
  attentionState(idx, lookback = 20) {
    const key = `attn_${lookback}`;
    if (!(key in this._cache)) {
      const vols = this.volumes;
      const len = vols.length;
      const result = new Array(len).fill(null);

      for (let i = lookback; i < len; i++) {
        // lookback 윈도우 거래량 정렬 → 백분위 산출
        const window = [];
        for (let j = i - lookback; j < i; j++) {
          if (vols[j] != null && vols[j] >= 0) window.push(vols[j]);
        }
        if (window.length < 5) continue; // 최소 샘플 방어

        window.sort((a, b) => a - b);
        const q30Idx = Math.floor(window.length * 0.3);
        const q70Idx = Math.floor(window.length * 0.7);
        const q30 = window[q30Idx];
        const q70 = window[q70Idx];

        // 최근 5봉 중 결핍일 (volume < q30) 카운트
        let deprivationDays = 0;
        const deprivLookback = Math.min(5, i);
        for (let j = i - deprivLookback; j < i; j++) {
          if (vols[j] != null && vols[j] < q30) deprivationDays++;
        }

        // 주의 폭발 판정: 현재 거래량 > q70*2.0 AND 결핍일 >= 3
        const curVol = vols[i] != null ? vols[i] : 0;
        const isAttentionJump = curVol > q70 * 2.0 && deprivationDays >= 3;
        const multiplier = isAttentionJump ? 1.10 : 1.0;

        result[i] = { deprivationDays, isAttentionJump, multiplier };
      }
      this._cache[key] = result;
    }
    const arr = this._cache[key];
    return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
  }

  // ── 점프 강도 (Merton Jump-Diffusion) ─────────────

  /**
   * [DEAD] 점프 강도 — Merton (1976) Jump-Diffusion 모형
   * 로그수익률 중 ATR 기반 임계값 초과를 점프로 분류, 연율화 빈도 산출
   * 미사용 — EVT/리스크 모듈 활성화 시 재활용 후보
   * @param {number} idx — 캔들 인덱스
   * @param {number} lookback — 점프 관측 기간 (기본 KRX_TRADING_DAYS, ~1년)
   * @returns {{ lambda: number, isJump: boolean, jumpCount: number }|null}
   */
  jumpIntensity(idx, lookback = KRX_TRADING_DAYS) {
    const key = `jump_${lookback}`;
    if (!(key in this._cache)) {
      const closes = this.closes;
      const len = closes.length;
      const result = new Array(len).fill(null);

      if (len < 2) { this._cache[key] = result; }
      else {
        // 로그수익률 산출
        const logReturns = new Array(len).fill(null);
        for (let i = 1; i < len; i++) {
          if (closes[i] > 0 && closes[i - 1] > 0) {
            logReturns[i] = Math.log(closes[i] / closes[i - 1]);
          }
        }

        // ATR of returns (14기간) — 수익률의 변동폭 기반 임계값
        const atrPeriod = 14;
        const absReturns = new Array(len).fill(null);
        for (let i = 1; i < len; i++) {
          if (logReturns[i] != null) absReturns[i] = Math.abs(logReturns[i]);
        }

        // 수익률 ATR: 이동평균(|r_t|, atrPeriod) — Wilder 방식
        const atrReturns = new Array(len).fill(null);
        let atrSum = 0, atrCnt = 0;
        for (let i = 1; i < len; i++) {
          if (absReturns[i] != null) {
            if (atrCnt < atrPeriod) {
              atrSum += absReturns[i];
              atrCnt++;
              if (atrCnt === atrPeriod) {
                atrReturns[i] = atrSum / atrPeriod;
              }
            } else {
              atrReturns[i] = (atrReturns[i - 1] * (atrPeriod - 1) + absReturns[i]) / atrPeriod;
            }
          } else if (atrCnt >= atrPeriod && atrReturns[i - 1] != null) {
            atrReturns[i] = atrReturns[i - 1]; // 결측 시 이전 값 유지
          }
        }

        // 점프 임계값: 3 * ATR_return
        const JUMP_MULT = 3;

        // 최소 시작 인덱스: atrPeriod + 1 (수익률 ATR 확보 필요)
        const minStart = atrPeriod + 1;

        for (let i = minStart; i < len; i++) {
          if (logReturns[i] == null || atrReturns[i] == null) continue;

          const threshold = JUMP_MULT * atrReturns[i];
          if (threshold <= 0) continue; // flat-price 방어

          // lookback 윈도우 내 점프 카운트
          const windowStart = Math.max(minStart, i - lookback + 1);
          let jumpCount = 0;
          for (let j = windowStart; j <= i; j++) {
            if (logReturns[j] != null && atrReturns[j] != null) {
              const thr = JUMP_MULT * atrReturns[j];
              if (thr > 0 && Math.abs(logReturns[j]) > thr) jumpCount++;
            }
          }

          const windowLen = i - windowStart + 1;
          const isJump = Math.abs(logReturns[i]) > threshold;
          // 연율화 점프 빈도: λ = (jumpCount / windowLen) * KRX_TRADING_DAYS
          const lambda = windowLen > 0 ? (jumpCount / windowLen) * KRX_TRADING_DAYS : 0;

          result[i] = { lambda, isJump, jumpCount };
        }
        this._cache[key] = result;
      }
    }
    const arr = this._cache[key];
    return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
  }

  // ── HAR-RV 모형 (Corsi 2009) ──────────────────────

  /**
   * Heterogeneous Autoregressive Realized Volatility (HAR-RV)
   * Corsi (2009): 일/주/월 실현변동성 분해 → OLS 예측
   * @param {number} idx — 캔들 인덱스
   * @returns {{ harRV: number, rv_d: number, rv_w: number, rv_m: number }|null}
   */
  harRV(idx) {
    const key = 'harRV';
    if (!(key in this._cache)) {
      const closes = this.closes;
      const len = closes.length;
      const result = new Array(len).fill(null);

      // 최소 데이터: 22(월간RV) + 60(OLS 피팅) = 82봉 이상 필요
      const D = 1, W = 5, M = 22;
      const MIN_FIT = 60; // OLS 피팅 최소 관측수
      const MIN_BARS = M + MIN_FIT;

      if (len < MIN_BARS + 1) { this._cache[key] = result; }
      else {
        // 로그수익률 제곱 (일간 실현분산 프록시)
        const r2 = new Array(len).fill(null);
        for (let i = 1; i < len; i++) {
          if (closes[i] > 0 && closes[i - 1] > 0) {
            const r = Math.log(closes[i] / closes[i - 1]);
            r2[i] = r * r;
          }
        }

        // RV 컴포넌트 배열: rv_d(1일), rv_w(5일 평균), rv_m(22일 평균)
        const rvD = new Array(len).fill(null);
        const rvW = new Array(len).fill(null);
        const rvM = new Array(len).fill(null);

        for (let i = M; i < len; i++) {
          // rv_d = r_t^2
          if (r2[i] != null) rvD[i] = r2[i];

          // rv_w = mean(r2[i-4..i]) — 최근 5일 평균
          let sumW = 0, cntW = 0;
          for (let j = i - W + 1; j <= i; j++) {
            if (r2[j] != null) { sumW += r2[j]; cntW++; }
          }
          if (cntW >= 3) rvW[i] = sumW / cntW; // 최소 3일 유효

          // rv_m = mean(r2[i-21..i]) — 최근 22일 평균
          let sumM = 0, cntM = 0;
          for (let j = i - M + 1; j <= i; j++) {
            if (r2[j] != null) { sumM += r2[j]; cntM++; }
          }
          if (cntM >= 10) rvM[i] = sumM / cntM; // 최소 10일 유효
        }

        // OLS 피팅 + 예측: 각 시점에서 trailing 60봉 윈도우로 회귀
        for (let i = MIN_BARS; i < len; i++) {
          // y = RV_d(t+1), X = [1, RV_d(t), RV_w(t), RV_m(t)]
          // 피팅 윈도우: [i-MIN_FIT, i-1] (t), y는 [i-MIN_FIT+1, i]
          const X = []; // 각 행: [1, rvD, rvW, rvM]
          const y = []; // RV_d(t+1)

          for (let t = i - MIN_FIT; t < i; t++) {
            if (rvD[t] != null && rvW[t] != null && rvM[t] != null && rvD[t + 1] != null) {
              X.push([1, rvD[t], rvW[t], rvM[t]]);
              y.push(rvD[t + 1]);
            }
          }

          // 최소 30개 유효 관측 필요 (OLS 안정성)
          if (X.length < 30) continue;

          // 현재 시점 독립변수
          if (rvD[i] == null || rvW[i] == null || rvM[i] == null) continue;

          // OLS: β = (X'X)^{-1} X'y — 4x4 정규방정식
          const p = 4; // 파라미터 수 (intercept + 3)
          const n = X.length;

          // X'X (4x4)
          const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
          const Xty = new Array(p).fill(0);

          for (let k = 0; k < n; k++) {
            for (let a = 0; a < p; a++) {
              Xty[a] += X[k][a] * y[k];
              for (let b = a; b < p; b++) {
                XtX[a][b] += X[k][a] * X[k][b];
              }
            }
          }
          // 대칭 채우기
          for (let a = 0; a < p; a++) {
            for (let b = 0; b < a; b++) {
              XtX[a][b] = XtX[b][a];
            }
          }

          // 4x4 역행렬 — top-level _invertMatrix() 재사용
          const inv = _invertMatrix(XtX);
          if (!inv) continue; // 특이 행렬

          // β = inv(X'X) * X'y
          const beta = new Array(p).fill(0);
          for (let a = 0; a < p; a++) {
            for (let b = 0; b < p; b++) {
              beta[a] += inv[a][b] * Xty[b];
            }
          }

          // 예측: RV_hat_{t+1} = β_0 + β_1*RV_d + β_2*RV_w + β_3*RV_m
          let rvHat = beta[0] + beta[1] * rvD[i] + beta[2] * rvW[i] + beta[3] * rvM[i];
          if (rvHat < 0) rvHat = 0; // 음수 분산 방어

          // 연율화: HAR_RV_ann = sqrt(RV_hat * KRX_TRADING_DAYS) * 100 (%)
          const harRVann = Math.sqrt(rvHat * KRX_TRADING_DAYS) * 100;

          result[i] = {
            harRV: harRVann,
            rv_d: rvD[i],
            rv_w: rvW[i],
            rv_m: rvM[i]
          };
        }
        this._cache[key] = result;
      }
    }
    const arr = this._cache[key];
    return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
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

/**
 * HAR-RV 모형 배열 — Corsi (2009)
 * @param {Array} candles — OHLCV 캔들 배열
 * @returns {Array<{harRV,rv_d,rv_w,rv_m}|null>}
 */
function calcHAR_RV(candles) {
  if (!candles || candles.length === 0) return [];
  const cache = new IndicatorCache(candles);
  return candles.map((_, i) => cache.harRV(i));
}
