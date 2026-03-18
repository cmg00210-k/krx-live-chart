// ══════════════════════════════════════════════════════
//  KRX LIVE — 패턴 백테스팅 엔진 (Phase 7)
//
//  의존: patterns.js (patternEngine.analyze),
//        indicators.js (calcATR, calcMA, calcWLSRegression)
//
//  패턴 발생 이력에서 N일 후 수익률 통계를 계산한다.
//  WLS 회귀로 패턴 품질·추세·거래량·변동성 기반 기대수익 예측.
//  결과는 updatePatternHistoryBar()에서 차트 하단 바로 표시.
// ══════════════════════════════════════════════════════

class PatternBacktester {

  constructor() {
    /** 기본 분석 기간(N일 후) */
    this.HORIZONS = [1, 3, 5, 10, 20];

    /** 패턴 타입별 한국어 매핑 + 방향 정보 */
    this._META = {
      threeWhiteSoldiers:     { name: '적삼병',     signal: 'buy'  },
      threeBlackCrows:        { name: '흑삼병',     signal: 'sell' },
      hammer:                 { name: '해머',       signal: 'buy'  },
      invertedHammer:         { name: '역해머',     signal: 'buy'  },
      hangingMan:             { name: '교수형',     signal: 'sell' },
      shootingStar:           { name: '유성형',     signal: 'sell' },
      doji:                   { name: '도지',       signal: 'neutral' },
      bullishEngulfing:       { name: '상승장악',   signal: 'buy'  },
      bearishEngulfing:       { name: '하락장악',   signal: 'sell' },
      bullishHarami:          { name: '상승잉태',   signal: 'buy'  },
      bearishHarami:          { name: '하락잉태',   signal: 'sell' },
      morningStar:            { name: '샛별형',     signal: 'buy'  },
      eveningStar:            { name: '석별형',     signal: 'sell' },
      ascendingTriangle:      { name: '상승삼각',   signal: 'buy'  },
      descendingTriangle:     { name: '하락삼각',   signal: 'sell' },
      risingWedge:            { name: '상승쐐기',   signal: 'sell' },
      fallingWedge:           { name: '하락쐐기',   signal: 'buy'  },
      doubleBottom:           { name: '이중바닥',   signal: 'buy'  },
      doubleTop:              { name: '이중천장',   signal: 'sell' },
      headAndShoulders:       { name: 'H&S',        signal: 'sell' },
      inverseHeadAndShoulders:{ name: '역H&S',      signal: 'buy'  },
      piercingLine:           { name: '관통형',     signal: 'buy'  },
      darkCloud:              { name: '먹구름',     signal: 'sell' },
      dragonflyDoji:          { name: '잠자리도지', signal: 'buy'  },
      gravestoneDoji:         { name: '비석도지',   signal: 'sell' },
      tweezerBottom:          { name: '족집게바닥', signal: 'buy'  },
      tweezerTop:             { name: '족집게천장', signal: 'sell' },
    };

    /** 캐시 키 (종목코드 + 캔들길이) → 결과 */
    this._cache = { key: null, results: null };

    /** 개별 backtest() 결과 캐시: "캔들수_마지막날짜_패턴" → result */
    this._resultCache = new Map();
  }


  // ══════════════════════════════════════════════════════
  //  1. 단일 패턴 백테스트
  // ══════════════════════════════════════════════════════

  /**
   * 특정 패턴 타입의 과거 발생 이력에서 N일 후 수익률 통계 계산
   * @param {Array} candles — OHLCV 배열 (전체 기간)
   * @param {string} patternType — 패턴 타입 문자열
   * @param {Object} [options] — { horizons: [1,3,5,10,20] }
   * @returns {{ patternType, name, signal, sampleSize, horizons: Object, curve: Array }}
   */
  backtest(candles, patternType, options = {}) {
    const horizons = options.horizons || this.HORIZONS;

    // 결과 캐시: 캔들 수 + 마지막 날짜 + 패턴 타입으로 중복 계산 방지
    const lastDate = candles.length > 0 ? (candles[candles.length - 1].time || '') : '';
    const cacheKey = `${candles.length}_${lastDate}_${patternType}`;
    const cached = this._resultCache.get(cacheKey);
    if (cached) return cached;

    const meta = this._META[patternType] || { name: patternType, signal: 'neutral' };

    // 슬라이딩 윈도우: 최소 80개 캔들부터 analyze를 시작,
    // 끝까지 확장하며 패턴 발생 시점(endIndex) 수집
    const occurrences = this._collectOccurrences(candles, patternType);

    if (occurrences.length === 0) {
      const empty = {
        patternType,
        name: meta.name,
        signal: meta.signal,
        sampleSize: 0,
        horizons: {},
        curve: [],
      };
      this._resultCache.set(cacheKey, empty);
      return empty;
    }

    const horizonStats = this._computeStats(candles, occurrences, horizons, meta.signal);
    const maxHorizon = Math.max(...horizons);
    const curve = this._cumulativeCurve(candles, occurrences, maxHorizon);

    const result = {
      patternType,
      name: meta.name,
      signal: meta.signal,
      sampleSize: occurrences.length,
      horizons: horizonStats,
      curve,
    };
    this._resultCache.set(cacheKey, result);
    return result;
  }


  // ══════════════════════════════════════════════════════
  //  2. 전체 패턴 일괄 백테스트
  // ══════════════════════════════════════════════════════

  /**
   * 전체 캔들에서 모든 패턴 타입별 백테스트 실행
   * @param {Array} candles — OHLCV 배열
   * @returns {{ [patternType]: backtestResult }}
   */
  backtestAll(candles) {
    if (!candles || candles.length < 50) return {};

    const results = {};
    for (const pType of Object.keys(this._META)) {
      const result = this.backtest(candles, pType);
      if (result.sampleSize > 0) {
        results[pType] = result;
      }
    }
    return results;
  }


  // ══════════════════════════════════════════════════════
  //  3. 패턴 발생 이력 수집
  // ══════════════════════════════════════════════════════

  /**
   * 전체 캔들을 patternEngine.analyze()로 스캔하여
   * 특정 패턴의 발생 이력을 추출 (회귀 특성 포함)
   *
   * 단일 호출이 아닌 전체 캔들을 한 번에 분석하여 성능 확보
   * @param {Array} candles
   * @param {string} patternType
   * @returns {Object[]} — { idx, confidence, trendStrength, volumeRatio, atrNorm } 배열
   */
  _collectOccurrences(candles, patternType) {
    // patternEngine.analyze()는 전체 캔들을 받아 모든 패턴을 반환
    // 캐시 키에 analyze 결과를 저장해 중복 호출 방지
    if (!this._analyzeCache || this._analyzeCache._candles !== candles) {
      this._analyzeCache = {
        _candles: candles,
        patterns: patternEngine.analyze(candles),
      };
    }

    // ATR 캐시 (한 번만 계산)
    if (!this._atrCache || this._atrCache._candles !== candles) {
      this._atrCache = {
        _candles: candles,
        atr: (typeof calcATR === 'function') ? calcATR(candles, 14) : null,
      };
    }

    // 거래량 이동평균 캐시 (20일 VMA)
    if (!this._vmaCache || this._vmaCache._candles !== candles) {
      var volumes = candles.map(function(c) { return c.volume || 0; });
      this._vmaCache = {
        _candles: candles,
        vma: (typeof calcMA === 'function') ? calcMA(volumes, 20) : null,
      };
    }

    var atr = this._atrCache.atr;
    var vma = this._vmaCache.vma;

    var all = this._analyzeCache.patterns;
    var occurrences = [];
    for (var pi = 0; pi < all.length; pi++) {
      var p = all[pi];
      if (p.type !== patternType) continue;
      var idx = p.endIndex !== undefined ? p.endIndex : p.startIndex;
      if (idx === undefined) continue;

      // 패턴 특성 추출 (WLS 회귀용)
      var confidence = (p.confidence != null) ? p.confidence : 50;

      // 추세 강도: patternEngine._detectTrend 직접 호출 대신, 간단 회귀로 추정
      var trendStrength = 0;
      var lookback = Math.min(10, idx);
      if (lookback >= 3 && atr) {
        var atrVal = atr[idx] || (candles[idx].close * 0.01);
        var sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (var ti = 0; ti <= lookback; ti++) {
          var ci = idx - lookback + ti;
          sx += ti; sy += candles[ci].close;
          sxy += ti * candles[ci].close; sx2 += ti * ti;
        }
        var n = lookback + 1;
        var denom = n * sx2 - sx * sx;
        if (Math.abs(denom) > 1e-10 && atrVal > 0) {
          var slope = (n * sxy - sx * sy) / denom;
          trendStrength = Math.abs(slope) / atrVal;
        }
      }

      // 거래량 비율: volume[idx] / VMA(20)
      var volumeRatio = 1;
      if (vma && vma[idx] && vma[idx] > 0 && candles[idx].volume) {
        volumeRatio = candles[idx].volume / vma[idx];
      }

      // ATR 정규화: ATR[idx] / close[idx]
      var atrNorm = 0.02;
      if (atr && atr[idx] && candles[idx].close > 0) {
        atrNorm = atr[idx] / candles[idx].close;
      }

      occurrences.push({
        idx: idx,
        confidence: confidence,
        trendStrength: trendStrength,
        volumeRatio: volumeRatio,
        atrNorm: atrNorm,
      });
    }
    return occurrences;
  }


  // ══════════════════════════════════════════════════════
  //  4. 통계 계산
  // ══════════════════════════════════════════════════════

  /**
   * 패턴 발생 후 각 horizon별 수익률 통계 + 회귀 분석
   * @param {Array} candles
   * @param {Object[]} occurrences — { idx, confidence, trendStrength, volumeRatio, atrNorm } 배열
   * @param {number[]} horizons — [1,3,5,10,20]
   * @param {string} patternSignal — 'buy' | 'sell' | 'neutral'
   * @returns {Object} — { [horizon]: statsObj }
   */
  _computeStats(candles, occurrences, horizons, patternSignal) {
    const result = {};

    for (const h of horizons) {
      const returns = [];
      const validOccs = [];  // 유효한 발생 이력 (회귀용)

      for (const occ of occurrences) {
        const exitIdx = occ.idx + h;
        if (exitIdx >= candles.length) continue;

        const entryPrice = candles[occ.idx].close;
        if (!entryPrice || entryPrice === 0) continue;

        const exitPrice = candles[exitIdx].close;
        const ret = (exitPrice - entryPrice) / entryPrice * 100; // %
        returns.push(ret);
        validOccs.push(occ);
      }

      if (returns.length === 0) {
        result[h] = this._emptyHorizonStats();
        continue;
      }

      const n = returns.length;
      const sorted = [...returns].sort((a, b) => a - b);

      // 기본 통계
      const sum = returns.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
      const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1 || 1);
      const stdDev = Math.sqrt(variance);

      // 승률 (방향에 따라 다름)
      let wins;
      if (patternSignal === 'buy') {
        wins = returns.filter(r => r > 0).length;
      } else if (patternSignal === 'sell') {
        wins = returns.filter(r => r < 0).length;
      } else {
        // 중립: 절대값 기준으로 양수를 승으로 간주
        wins = returns.filter(r => r > 0).length;
      }
      const winRate = (wins / n) * 100;

      // 최대 손실/이익
      const maxLoss = sorted[0];
      const maxGain = sorted[n - 1];

      // 평균 이익/손실 (리스크-리워드 비율 계산용)
      const winReturns = returns.filter(r => r > 0);
      const lossReturns = returns.filter(r => r < 0);
      const avgWin = winReturns.length ? winReturns.reduce((a, b) => a + b, 0) / winReturns.length : 0;
      const avgLoss = lossReturns.length ? Math.abs(lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length) : 0;
      const riskReward = avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : (avgWin > 0 ? Infinity : 0);

      // t-검정: H0: mean = 0 (소표본 보정: df < 30이면 임계값 상향)
      const tStat = stdDev > 0 && n > 1 ? mean / (stdDev / Math.sqrt(n)) : 0;
      const df = n - 1;
      const tCritical = df >= 30 ? 1.96 : df >= 15 ? 2.13 : df >= 10 ? 2.23 : df >= 5 ? 2.57 : 4.30;
      const significant = Math.abs(tStat) > tCritical;

      // 표본 수 경고
      let sampleWarning = '';
      if (n < 10) sampleWarning = 'insufficient';
      else if (n < 30) sampleWarning = 'caution';
      else sampleWarning = 'adequate';

      const stats = {
        n,
        mean: +mean.toFixed(2),
        median: +median.toFixed(2),
        stdDev: +stdDev.toFixed(2),
        winRate: +winRate.toFixed(1),
        maxLoss: +maxLoss.toFixed(2),
        maxGain: +maxGain.toFixed(2),
        avgWin: +avgWin.toFixed(2),
        avgLoss: +avgLoss.toFixed(2),
        riskReward,
        tStat: +tStat.toFixed(2),
        significant,
        sampleWarning,
      };

      // ── Phase A: 단순 OLS 진단 (return = alpha + beta * confidence) ──
      if (returns.length >= 20) {
        var sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (var ri = 0; ri < returns.length; ri++) {
          var xi = (validOccs[ri].confidence || 50) / 100;
          var yi = returns[ri];
          sx += xi; sy += yi; sxy += xi * yi; sx2 += xi * xi;
        }
        var olsDenom = returns.length * sx2 - sx * sx;
        if (Math.abs(olsDenom) > 1e-10) {
          stats.regSlope = +((returns.length * sxy - sx * sy) / olsDenom).toFixed(4);
          stats.regIntercept = +((sy - stats.regSlope * sx) / returns.length).toFixed(4);
        }
      }

      // ── Phase C: WLS 다중 회귀 (calcWLSRegression 사용) ──
      if (returns.length >= 30 && typeof calcWLSRegression === 'function') {
        var X = [], weights = [];
        var lambda = 0.995;
        for (var ri = 0; ri < returns.length; ri++) {
          var occ = validOccs[ri];
          X.push([
            1,                                             // 절편
            (occ.confidence || 50) / 100,                  // 신뢰도 (0-1)
            occ.trendStrength || 0,                        // 추세 강도
            Math.log(Math.max(occ.volumeRatio || 1, 0.1)), // ln(거래량비)
            occ.atrNorm || 0.02                            // ATR / 종가
          ]);
          // 지수 감소 가중치: 최신 패턴에 높은 가중치
          weights.push(Math.pow(lambda, returns.length - 1 - ri));
        }

        var reg = calcWLSRegression(X, returns, weights);
        if (reg) {
          stats.regression = {
            coeffs: reg.coeffs.map(function(c) { return +c.toFixed(6); }),
            rSquared: +reg.rSquared.toFixed(4),
            tStats: reg.tStats.map(function(t) { return +t.toFixed(2); }),
          };

          // 최근 패턴에 대한 기대수익률 예측
          if (validOccs.length > 0) {
            var latest = validOccs[validOccs.length - 1];
            var xNew = [
              1,
              (latest.confidence || 50) / 100,
              latest.trendStrength || 0,
              Math.log(Math.max(latest.volumeRatio || 1, 0.1)),
              latest.atrNorm || 0.02
            ];
            var predicted = 0;
            for (var j = 0; j < xNew.length; j++) {
              predicted += xNew[j] * reg.coeffs[j];
            }
            stats.expectedReturn = +predicted.toFixed(2);

            // 95% 신뢰구간: SE = sqrt(sigma^2 * (1 + x' (X'WX)^-1 x))
            var xInvx = 0;
            for (var ii = 0; ii < xNew.length; ii++) {
              for (var jj = 0; jj < xNew.length; jj++) {
                xInvx += xNew[ii] * reg.invXtWX[ii][jj] * xNew[jj];
              }
            }
            var se = Math.sqrt(reg.sigmaHat2 * (1 + xInvx));
            var tCrit = reg.df >= 30 ? 1.96 : 2.04;
            stats.ci95Lower = +(predicted - tCrit * se).toFixed(2);
            stats.ci95Upper = +(predicted + tCrit * se).toFixed(2);
          }
        }
      }

      result[h] = stats;
    }

    return result;
  }

  /**
   * 비어있는 horizon 통계 객체
   */
  _emptyHorizonStats() {
    return {
      n: 0, mean: 0, median: 0, stdDev: 0, winRate: 0,
      maxLoss: 0, maxGain: 0, avgWin: 0, avgLoss: 0,
      riskReward: 0, tStat: 0, significant: false, sampleWarning: 'insufficient',
    };
  }


  // ══════════════════════════════════════════════════════
  //  5. 누적 수익률 곡선
  // ══════════════════════════════════════════════════════

  /**
   * 패턴 발생 후 1일~maxHorizon까지 일별 누적 수익률 곡선
   * mean +/- 1sigma 밴드 포함
   * @param {Array} candles
   * @param {Object[]} occurrences — { idx, ... } 배열
   * @param {number} maxHorizon
   * @returns {Array<{ day, mean, upper, lower, sampleCount }>}
   */
  _cumulativeCurve(candles, occurrences, maxHorizon) {
    const curve = [];

    for (let d = 1; d <= maxHorizon; d++) {
      const returns = [];

      for (const occ of occurrences) {
        const exitIdx = occ.idx + d;
        if (exitIdx >= candles.length) continue;

        const entryPrice = candles[occ.idx].close;
        if (!entryPrice || entryPrice === 0) continue;

        const ret = (candles[exitIdx].close - entryPrice) / entryPrice * 100;
        returns.push(ret);
      }

      if (returns.length === 0) {
        curve.push({ day: d, mean: 0, upper: 0, lower: 0, sampleCount: 0 });
        continue;
      }

      const n = returns.length;
      const mean = returns.reduce((a, b) => a + b, 0) / n;
      const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1 || 1);
      const sigma = Math.sqrt(variance);

      curve.push({
        day: d,
        mean: +mean.toFixed(3),
        upper: +(mean + sigma).toFixed(3),
        lower: +(mean - sigma).toFixed(3),
        sampleCount: n,
      });
    }

    return curve;
  }


  // ══════════════════════════════════════════════════════
  //  6. 캐시 관리
  // ══════════════════════════════════════════════════════

  /**
   * 캐시 키 생성 (종목코드 + 캔들 길이)
   */
  _cacheKey(stockCode, candleLength) {
    return `${stockCode}_${candleLength}`;
  }

  /**
   * 캐시 유효성 확인 & 결과 반환
   * @returns {Object|null}
   */
  getCached(stockCode, candleLength) {
    const key = this._cacheKey(stockCode, candleLength);
    if (this._cache.key === key) return this._cache.results;
    return null;
  }

  /**
   * 캐시 저장
   */
  setCache(stockCode, candleLength, results) {
    this._cache.key = this._cacheKey(stockCode, candleLength);
    this._cache.results = results;
  }

  /**
   * 캐시 무효화
   */
  invalidateCache() {
    this._cache.key = null;
    this._cache.results = null;
    this._analyzeCache = null;
    this._atrCache = null;
    this._vmaCache = null;
    this._resultCache.clear();
  }
}


// ── 전역 인스턴스 ─────────────────────────────────────
const backtester = new PatternBacktester();
