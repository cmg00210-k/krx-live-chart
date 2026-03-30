// ══════════════════════════════════════════════════════
//  KRX LIVE — 기술적 지표 계산 모듈
//  chart.js에서 분리 (Phase 1)
// ══════════════════════════════════════════════════════

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

  // Adaptive Q: EWMA 변동성으로 Q 스케일링 — Mehra (1970), Mohamed & Schwarz (1999)
  // Q_t = Q_base * (σ_t / σ̄)^2. 저변동성 → 부드러움, 고변동성 → 민감
  var ewmaVar = 0, ewmaAlpha = 0.06; // ~2/(30+1) for 30-bar EWMA
  var varSum = 0, varCount = 0;

  for (let i = 1; i < closes.length; i++) {
    var ret = (closes[i] - closes[i - 1]) / (closes[i - 1] || 1);
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
    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * w, (b + 1) * w);
      const mean = block.reduce((a, v) => a + v, 0) / w;
      const devs = block.map(v => v - mean);
      const cumDevs = [];
      let cum = 0;
      for (const d of devs) { cum += d; cumDevs.push(cum); }
      const R = Math.max(...cumDevs) - Math.min(...cumDevs);
      const S = Math.sqrt(devs.reduce((a, d) => a + d * d, 0) / w);
      if (S > 0) rsSum += R / S;
    }
    if (rsSum <= 0) continue; // flat-price stocks: S=0 → log(-Inf) 방지
    logRS.push(Math.log(rsSum / numBlocks));
    logN.push(Math.log(w));
  }

  if (logRS.length < 2) return null;
  // 선형 회귀로 기울기(H) 추정 — log(R/S) = H * log(n) + c
  const n = logRS.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += logN[i]; sy += logRS[i]; sxy += logN[i] * logRS[i]; sx2 += logN[i] * logN[i];
  }
  return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
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
  var se = alpha / Math.sqrt(k);

  return { alpha: alpha, se: se, isHeavyTail: alpha < 4, k: k };
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
  var rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

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
      var eScaled = w * residuals[i] / (denom * denom);  // w * e_i / (1-h_ii)^2
      for (var j = 0; j < p; j++) {
        for (var k = 0; k < p; k++) {
          meat[j][k] += X[i][j] * w * eScaled * residuals[i] * X[i][k];
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

  return {
    coeffs: coeffs,
    rSquared: rSquared,
    stdErrors: stdErrors,
    tStats: tStats,
    hcStdErrors: hcStdErrors,
    hcTStats: hcTStats,
    df: df,
    fitted: fitted,
    sigmaHat2: sigmaHat2,
    invXtWX: inv,
  };
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
//  RSI Fisher Transform — Amari (1985), core_data/13 §7.3
//  RSI를 정규분포에 가까운 공간으로 변환, 극단값 거짓 신호 감소
//  rsi_fisher = 0.5 * ln((1+r)/(1-r)), r = 2*(RSI/100) - 1
// ══════════════════════════════════════════════════════

function calcRSIFisher(rsiArray) {
  return rsiArray.map(function(v) {
    if (v === null || v === undefined) return null;
    var r = Math.max(-0.999, Math.min(0.999, 2 * (v / 100) - 1));
    return 0.5 * Math.log((1 + r) / (1 - r));
  });
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
  var medSlope = slopes[Math.floor(slopes.length / 2)];
  // Median intercept
  var intercepts = [];
  for (var k = 0; k < n; k++) {
    intercepts.push(yValues[k] - medSlope * xValues[k]);
  }
  intercepts.sort(function(a, b) { return a - b; });
  var medIntercept = intercepts[Math.floor(intercepts.length / 2)];
  return { slope: medSlope, intercept: medIntercept };
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
   *  확대 공식: mult * (1 + 0.15 * max(0, 4 - α)) */
  bbEVT(n = 20, baseMult = 2) {
    const key = `bbEVT_${n}_${baseMult}`;
    if (!(key in this._cache)) {
      var hillResult = this.hill();
      var evtMult = baseMult;
      if (hillResult && hillResult.alpha > 0 && hillResult.alpha < 4) {
        evtMult = baseMult * (1 + 0.15 * (4 - hillResult.alpha));
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

  /** RSI Fisher Transform — Amari (1985), core_data/13 §7.3 */
  rsiFisher(period = 14) {
    const key = `rsiFisher_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcRSIFisher(this.rsi(period));
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

  /** 허스트 지수 (현재 미사용 — 향후 추세 지속성 분석용) */
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

  /** 모멘텀 */
  momentum(period = 10) {
    const key = `mom_${period}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcMomentum(this.closes, period);
    }
    return this._cache[key];
  }

  /** 어썸 오실레이터 (AO) */
  ao(shortPeriod = 5, longPeriod = 34) {
    const key = `ao_${shortPeriod}_${longPeriod}`;
    if (!(key in this._cache)) {
      this._cache[key] = calcAwesomeOscillator(this._candles, shortPeriod, longPeriod);
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
