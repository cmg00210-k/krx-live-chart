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

    /** KRX 왕복 비용 구성 (%) — calibrated_constants.json 기준 */
    this.KRX_COMMISSION = 0.03;   // 수수료 편도 0.015% × 2
    this.KRX_TAX = 0.18;           // KOSPI 0.03%+농특세0.15% / KOSDAQ 0.18% (2025 동일)
    this.KRX_SLIPPAGE = 0.10;     // 기본 슬리피지 편도 0.05% × 2 (KOSPI 대형 기준)
    this.KRX_COST = this.KRX_COMMISSION + this.KRX_TAX + this.KRX_SLIPPAGE; // 0.31%

    /** 패턴 타입별 한국어 매핑 + 방향 정보 */
    this._META = {
      threeWhiteSoldiers:     { name: '적삼병',     signal: 'buy'  },
      threeBlackCrows:        { name: '흑삼병',     signal: 'sell' },
      hammer:                 { name: '해머',       signal: 'buy'  },
      invertedHammer:         { name: '역해머',     signal: 'buy'  },
      hangingMan:             { name: '교수형',     signal: 'sell' },
      shootingStar:           { name: '유성형',     signal: 'sell' },
      doji:                   { name: '도지',       signal: 'neutral' },
      bullishEngulfing:       { name: '상승장악형', signal: 'buy'  },
      bearishEngulfing:       { name: '하락장악형', signal: 'sell' },
      bullishHarami:          { name: '상승잉태형', signal: 'buy'  },
      bearishHarami:          { name: '하락잉태형', signal: 'sell' },
      morningStar:            { name: '샛별형',     signal: 'buy'  },
      eveningStar:            { name: '석별형',     signal: 'sell' },
      ascendingTriangle:      { name: '상승삼각형', signal: 'buy'  },
      descendingTriangle:     { name: '하락삼각형', signal: 'sell' },
      risingWedge:            { name: '상승쐐기',   signal: 'sell' },
      fallingWedge:           { name: '하락쐐기',   signal: 'buy'  },
      symmetricTriangle:      { name: '대칭삼각형', signal: 'neutral' },
      doubleBottom:           { name: '이중바닥',   signal: 'buy'  },
      doubleTop:              { name: '이중천장',   signal: 'sell' },
      headAndShoulders:       { name: '머리어깨형',  signal: 'sell' },
      inverseHeadAndShoulders:{ name: '역머리어깨형', signal: 'buy'  },
      piercingLine:           { name: '관통형',     signal: 'buy'  },
      darkCloud:              { name: '먹구름형',   signal: 'sell' },
      dragonflyDoji:          { name: '잠자리도지', signal: 'buy'  },
      gravestoneDoji:         { name: '비석도지',   signal: 'sell' },
      tweezerBottom:          { name: '족집게바닥', signal: 'buy'  },
      tweezerTop:             { name: '족집게천장', signal: 'sell' },
      bullishMarubozu:        { name: '양봉마루보주', signal: 'buy'  },
      bearishMarubozu:        { name: '음봉마루보주', signal: 'sell' },
      spinningTop:            { name: '팽이형',     signal: 'neutral' },
      longLeggedDoji:         { name: '긴다리도지', signal: 'neutral' },
      bullishBeltHold:        { name: '강세띠두름', signal: 'buy'  },
      bearishBeltHold:        { name: '약세띠두름', signal: 'sell' },
      threeInsideUp:          { name: '상승삼내형', signal: 'buy'  },
      threeInsideDown:        { name: '하락삼내형', signal: 'sell' },
      abandonedBabyBullish:   { name: '강세버림받은아기', signal: 'buy'  },
      abandonedBabyBearish:   { name: '약세버림받은아기', signal: 'sell' },
      channel:                { name: '채널',           signal: 'neutral' },
    };

    /** 캐시 키 (종목코드 + 캔들길이) → 결과 */
    this._cache = { key: null, results: null };

    /** 개별 backtest() 결과 캐시: "캔들수_마지막날짜_패턴" → result */
    this._resultCache = new Map();

    /** LinUCB policy (Stage B) — loaded lazily from rl_policy.json */
    this._rlPolicy = null;
    this._rlPolicyAttempted = false;
    this._currentMarket = '';  // set by Worker message or main thread
    this._rlTier1 = new Set(['doubleBottom','doubleTop','risingWedge','threeWhiteSoldiers']);  // invertedHammer: Tier-2 (win rate 52.3%)
    this._rlTier3 = new Set(['spinningTop','doji','fallingWedge']);
    this._loadRLPolicy();
  }

  /** Load LinUCB policy JSON (graceful: missing file = no-op) */
  _loadRLPolicy() {
    if (this._rlPolicyAttempted) return;
    this._rlPolicyAttempted = true;
    var that = this;
    var isWorker = (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined');
    var policyUrl = isWorker
      ? '../data/backtest/rl_policy.json'
      : 'data/backtest/rl_policy.json';
    fetch(policyUrl)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.thetas && data.action_factors && typeof data.d === 'number') {
          that._rlPolicy = data;
        }
      })
      .catch(function() { /* silent fallback */ });
  }

  /** Build 7-dim context vector for LinUCB (resid dims removed — runtime N/A)
   *  @param {number} predicted — WLS predicted return
   *  @param {string} signal — 'buy'/'sell'/'neutral'
   *  @param {string} patternType — pattern name
   *  @param {Object} latest — latest occurrence object
   *  @param {Array} candles — OHLCV candles for ewma_vol + hurst
   */
  _buildRLContext(predicted, signal, patternType, latest, candles) {
    var tier = this._rlTier1.has(patternType) ? -1 : (this._rlTier3.has(patternType) ? 1 : 0);
    var sigDir = signal === 'buy' ? 1 : (signal === 'sell' ? -1 : 0);

    // Dim 3: EWMA volatility (lambda=0.94, z-scored)
    var ewmaVol = 0;
    if (candles && candles.length >= 2) {
      var closes = candles.slice(-80);
      var varT = 0;
      for (var i = 1; i < closes.length; i++) {
        var prev = closes[i - 1].close || 1;
        var ret = (closes[i].close - prev) / Math.max(prev, 1e-10);
        varT = i === 1 ? ret * ret : 0.94 * varT + 0.06 * ret * ret;
      }
      var rawVol = Math.sqrt(Math.max(varT, 0));
      var eNorm = this._rlPolicy && this._rlPolicy.normalization && this._rlPolicy.normalization.ewma_vol;
      var eMean = eNorm ? eNorm.mean : 0.026541;
      var eStd = eNorm ? eNorm.std : 0.017892;
      ewmaVol = Math.max(-3, Math.min(3, (rawVol - eMean) / Math.max(eStd, 1e-6)));
    }

    // Dim 3: market_type (KOSDAQ=1, KOSPI=0)
    // Worker-safe: use _currentMarket (set by Worker message) or fallback to currentStock
    var marketType = 0;
    var mkt = this._currentMarket
      || (typeof currentStock !== 'undefined' && currentStock && currentStock.market ? currentStock.market : '');
    if (mkt && mkt.toUpperCase() === 'KOSDAQ') marketType = 1;

    // Dim 9: raw_hurst (R/S analysis, z-scored) — reuse calcHurst from indicators.js
    var rawHurst = 0;
    if (candles && candles.length >= 40 && typeof calcHurst === 'function') {
      var hCloses = [];
      var hStart = Math.max(0, candles.length - 80);
      for (var h = hStart; h < candles.length; h++) hCloses.push(candles[h].close);
      var hVal = calcHurst(hCloses);
      if (hVal != null && isFinite(hVal)) {
        var hNorm = this._rlPolicy && this._rlPolicy.normalization && this._rlPolicy.normalization.raw_hurst;
        var hMean = hNorm ? hNorm.mean : 0.946613;
        var hStd = hNorm ? hNorm.std : 0.075216;
        rawHurst = Math.max(-3, Math.min(3, (hVal - hMean) / Math.max(hStd, 1e-6)));
      }
    }

    return [
      ewmaVol,                                     // 0: ewma_vol (z-scored)
      Math.min(Math.abs(predicted) / (this._rlPolicy && this._rlPolicy.normalization && this._rlPolicy.normalization.pred_std ? this._rlPolicy.normalization.pred_std : 1.17), 3), // 1: pred_magnitude (from training stats)
      sigDir,                                       // 2: signal_dir
      marketType,                                   // 3: market_type
      tier,                                         // 4: pattern_tier
      (latest.confidencePred || latest.confidence || 50) / 100, // 5: confidence_norm (Dual)
      rawHurst                                     // 6: raw_hurst (z-scored)
    ];
  }

  /** Apply LinUCB: dot product + argmax over 5 actions */
  _applyLinUCB(context) {
    var p = this._rlPolicy;
    if (!p || context.length !== p.d) return { action: 2, factor: 1.0 };
    var bestA = 2, bestScore = -Infinity; // default: trust_mra (action 2)
    for (var a = 0; a < p.K; a++) {
      var score = p.thetas[a][0]; // bias
      for (var j = 0; j < p.d; j++) {
        score += p.thetas[a][j + 1] * context[j];
      }
      if (score > bestScore) { bestScore = score; bestA = a; }
    }
    return { action: bestA, factor: p.action_factors[bestA] };
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
      if (this._resultCache.size > 200) this._resultCache.clear();
      return empty;
    }

    const horizonStats = this._computeStats(candles, occurrences, horizons, meta.signal, patternType);
    const maxHorizon = Math.max(...horizons);
    const curve = this._cumulativeCurve(candles, occurrences, maxHorizon);

    const stockWc = occurrences.length > 0 ? occurrences[0].wc : 1;
    const result = {
      patternType,
      name: meta.name,
      signal: meta.signal,
      sampleSize: occurrences.length,
      stockWc: +stockWc.toFixed(4),
      horizons: horizonStats,
      curve,
    };
    this._resultCache.set(cacheKey, result);
    if (this._resultCache.size > 200) this._resultCache.clear();
    return result;
  }


  // ══════════════════════════════════════════════════════
  //  2. 전체 패턴 일괄 백테스트
  // ══════════════════════════════════════════════════════

  /**
   * 전체 캔들에서 모든 패턴 타입별 백테스트 실행
   * + Holm-Bonferroni 다중비교 보정 (27 patterns × 5 horizons = 135 tests)
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

    // ── Holm-Bonferroni 다중비교 보정 ──────────────────
    // 문제: m개 동시 검정 시 alpha=0.05에서 ~m×0.05건이 우연히 유의.
    // Holm step-down: |t|가 큰 순으로 정렬 후 rank k에서
    //   adjusted alpha_k = 0.05 / (m - k + 1)
    // 해당 검정이 adjusted alpha를 통과하지 못하면 이후 모든 검정도 기각 불가.
    this._applyHolmBonferroni(results);

    return results;
  }

  /** Walk-Forward 검증 — Pardo (2008), Bailey & Lopez de Prado (2014)
   *  WFE = OOS_meanReturn / IS_meanReturn
   *  WFE >= 50%: robust, 30-50%: marginal, < 30%: overfit 의심
   *
   *  구조: expanding window, 4 folds, purging H=5 bars
   *  cross-sectional pooling은 backtestAll()이 개별 종목에서 수행하므로
   *  여기서는 단일 종목 시계열 기준 Walk-Forward를 구현
   *
   *  @param {Array} candles — OHLCV 캔들 배열
   *  @param {string} pType — 패턴 타입
   *  @param {Object} [opts] — { folds: 4, horizon: 5, minTrain: 60 }
   *  @returns {{ wfe, foldResults[], isRobust, label }} 또는 null
   */
  walkForwardTest(candles, pType, opts) {
    if (!candles || candles.length < 100) return null;
    const folds = (opts && opts.folds) || 4;
    const horizon = (opts && opts.horizon) || 5;
    const minTrain = (opts && opts.minTrain) || 60;
    const purge = horizon; // purging window = forecast horizon
    const len = candles.length;

    // OOS 블록 크기: 전체의 ~20%를 folds개로 분배
    const oosSize = Math.max(15, Math.floor(len * 0.20 / folds));
    const totalOos = oosSize * folds;
    if (len - totalOos < minTrain) return null;

    const foldResults = [];
    let sumIS = 0, sumOOS = 0, validFolds = 0;

    for (let f = 0; f < folds; f++) {
      // Expanding window: train [0, trainEnd], test [testStart, testEnd]
      const testEnd = len - 1 - (folds - 1 - f) * oosSize;
      const testStart = testEnd - oosSize + 1;
      const trainEnd = testStart - purge - 1; // purging gap
      if (trainEnd < minTrain || testStart < 0 || testEnd >= len) continue;

      const trainCandles = candles.slice(0, trainEnd + 1);
      const testCandles = candles.slice(testStart, testEnd + 1);

      if (trainCandles.length < minTrain || testCandles.length < 5) continue;

      // IS: backtest on training set
      const isResult = this.backtest(trainCandles, pType);
      // OOS: backtest on test set
      const oosResult = this.backtest(testCandles, pType);

      const isReturn = (isResult.horizons && isResult.horizons[horizon])
        ? isResult.horizons[horizon].mean || 0 : 0;
      const oosReturn = (oosResult.horizons && oosResult.horizons[horizon])
        ? oosResult.horizons[horizon].mean || 0 : 0;

      foldResults.push({
        fold: f + 1,
        trainSize: trainCandles.length,
        testSize: testCandles.length,
        isSamples: isResult.sampleSize || 0,
        oosSamples: oosResult.sampleSize || 0,
        isReturn: +isReturn.toFixed(4),
        oosReturn: +oosReturn.toFixed(4),
      });

      if (isResult.sampleSize > 0 && oosResult.sampleSize > 0) {
        sumIS += isReturn;
        sumOOS += oosReturn;
        validFolds++;
      }
    }

    if (validFolds < 2) return null;

    const avgIS = sumIS / validFolds;
    const avgOOS = sumOOS / validFolds;
    // WFE: avoid division by zero, sign-aware (both negative = not robust)
    const wfe = Math.abs(avgIS) > 0.0001
      ? Math.round((avgOOS / avgIS) * 100) : 0;
    // Both-negative: WFE numerically correct but strategically useless
    const bothNegative = avgIS < 0 && avgOOS < 0;

    const label = bothNegative ? 'negative' : wfe >= 50 ? 'robust' : wfe >= 30 ? 'marginal' : 'overfit';

    return {
      wfe,
      avgIS: +avgIS.toFixed(4),
      avgOOS: +avgOOS.toFixed(4),
      validFolds,
      foldResults,
      isRobust: wfe >= 50 && !bothNegative,
      label,
    };
  }

  /**
   * Holm-Bonferroni step-down 다중비교 보정
   *
   * 모든 (pattern, horizon) 쌍의 t-검정 결과를 모아
   * family-wise error rate (FWER) 을 0.05 이하로 보정.
   *
   * 기존 significant (raw) 필드는 보존하고,
   * adjustedSignificant 필드를 추가한다.
   *
   * @param {Object} results — { [patternType]: { horizons: { [h]: stats } } }
   */
  _applyHolmBonferroni(results) {
    const ALPHA = 0.05;

    // Step 1: 모든 검정 수집
    const tests = [];
    for (const pType of Object.keys(results)) {
      const r = results[pType];
      if (!r.horizons) continue;
      for (const h of Object.keys(r.horizons)) {
        const hs = r.horizons[h];
        if (!hs || hs.n < 2) {
          // 표본 부족 — 보정 이전에 이미 비유의
          hs.adjustedSignificant = false;
          continue;
        }
        tests.push({
          pType: pType,
          horizon: h,
          absTStat: Math.abs(hs.tStat || 0),
          stats: hs,
        });
      }
    }

    const m = tests.length;
    if (m === 0) return;

    // Step 2: |t-stat| 내림차순 정렬 (가장 유의한 것부터)
    tests.sort(function(a, b) { return b.absTStat - a.absTStat; });

    // Step 3: Holm step-down 절차
    // t-분포 임계값 lookup: alpha → t-critical (양측)
    // 각 rank k에서 adjusted alpha = ALPHA / (m - k + 1)
    // 해당 df에서 adjusted alpha에 대응하는 t-critical을 구해 비교.
    //
    // 정확한 t-분포 역함수 대신, 보수적 근사 사용:
    // Holm-Bonferroni에서는 Bonferroni보다 덜 보수적이므로,
    // 각 단계별 adjusted alpha에 대한 t-critical을 _tCritical()로 계산.
    let rejected = true;  // step-down: 이전 단계가 기각되어야 다음 단계도 검정 가능
    for (let k = 0; k < m; k++) {
      const test = tests[k];
      const adjustedAlpha = ALPHA / (m - k);  // 0-indexed: m - k = (m - (k+1) + 1)
      if (rejected) {
        const tCrit = this._tCriticalForAlpha(adjustedAlpha, test.stats.n - 1);
        if (test.absTStat > tCrit) {
          test.stats.adjustedSignificant = true;
        } else {
          // 이 단계에서 기각 실패 → 이후 모든 검정도 비유의 처리
          test.stats.adjustedSignificant = false;
          rejected = false;
        }
      } else {
        test.stats.adjustedSignificant = false;
      }
    }
  }

  /**
   * 양측 t-검정 임계값 근사 (Cornish-Fisher 역변환 기반)
   *
   * 정확한 t-분포 역함수(qt) 없이 alpha/2 분위수를 근사.
   * df >= 3에서 실용적 정확도 (~0.01 이내).
   *
   * 사용처: Holm-Bonferroni에서 adjusted alpha별 임계값 필요.
   * 기존 _computeStats의 테이블 lookup은 alpha=0.05 고정이라 충분하지만,
   * 다중비교 보정에서는 alpha가 0.05/135 ~ 0.05/1 범위로 변동.
   *
   * @param {number} alpha — 유의수준 (양측, e.g. 0.05)
   * @param {number} df — 자유도 (n - 1)
   * @returns {number} — t-critical (양수)
   */
  _tCriticalForAlpha(alpha, df) {
    if (df < 1) return Infinity;
    if (alpha <= 0) return Infinity;
    if (alpha >= 1) return 0;

    // 양측 → 단측 alpha
    var a = alpha / 2;

    // 표준정규 분위수 (Rational approximation, Abramowitz & Stegun 26.2.23)
    // p = 1 - a (upper tail)
    var p = 1 - a;
    var t;
    if (p > 0.5) {
      t = Math.sqrt(-2 * Math.log(1 - p));
    } else {
      t = Math.sqrt(-2 * Math.log(p));
    }
    // Rational approximation coefficients
    var c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    var d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    var zp = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
    if (p <= 0.5) zp = -zp;

    // Cornish-Fisher expansion: t_df ≈ z + correction terms
    // 1st order: z + (z^3 + z) / (4 * df)
    // 2nd order: + (5z^5 + 16z^3 + 3z) / (96 * df^2)
    var z = zp;
    var z2 = z * z;
    var z3 = z2 * z;
    var z5 = z3 * z2;
    var tVal = z + (z3 + z) / (4 * df);
    if (df >= 3) {
      tVal += (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
    }

    return Math.abs(tVal);
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

      // 패턴 특성 추출 (WLS 회귀용) — Dual Confidence: confidencePred 우선 사용
      var confidence = (p.confidencePred != null) ? p.confidencePred
                     : (p.confidence != null) ? p.confidence : 50;

      // 추세 강도: patternEngine._detectTrend 직접 호출 대신, 간단 회귀로 추정
      var trendStrength = 0;
      var lookback = Math.min(10, idx);
      if (lookback >= 3 && atr) {
        var atrVal = atr[idx] || (candles[idx].close * (typeof PatternEngine !== 'undefined' ? PatternEngine.ATR_FALLBACK_PCT : 0.02));
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

      // APT Factor: 60-day momentum (Jegadeesh & Titman 1993)
      var momentum60 = 0;
      if (idx >= 60 && candles[idx - 60].close > 0) {
        momentum60 = (candles[idx].close / candles[idx - 60].close - 1) * 100;
      }

      occurrences.push({
        idx: idx,
        confidence: confidence,
        trendStrength: trendStrength,
        volumeRatio: volumeRatio,
        atrNorm: atrNorm,
        wc: p.wc != null ? p.wc : ((p.hw || 1) * (p.mw || 1)),
        momentum60: momentum60,
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
  _computeStats(candles, occurrences, horizons, patternSignal, patternType) {
    const result = {};

    for (const h of horizons) {
      const returns = [];
      const validOccs = [];  // 유효한 발생 이력 (회귀용)

      for (const occ of occurrences) {
        const exitIdx = occ.idx + h;
        if (exitIdx >= candles.length) continue;

        // [FIX] 진입가: 패턴 다음 캔들 시가 (look-ahead bias 제거)
        const entryIdx = occ.idx + 1;
        if (entryIdx >= candles.length) continue;
        const entryPrice = candles[entryIdx].open || candles[occ.idx].close;
        if (!entryPrice || entryPrice === 0) continue;

        const exitPrice = candles[exitIdx].close;
        const ret = (exitPrice - entryPrice) / entryPrice * 100 - this.KRX_COST; // % (왕복 거래비용 차감)
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
      const riskReward = avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : (avgWin > 0 ? 999.99 : 0);

      // t-검정: H0: mean = 0 (소표본 보정: 정밀 t-분포 임계값 테이블, 95% 양측)
      const tStat = stdDev > 0 && n > 1 ? mean / (stdDev / Math.sqrt(n)) : 0;
      const df = n - 1;
      const tCritical = df >= 120 ? 1.96 : df >= 60 ? 2.00 : df >= 30 ? 2.04 : df >= 15 ? 2.13 : df >= 10 ? 2.23 : df >= 5 ? 2.57 : 4.30;
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
        adjustedSignificant: false, // Holm-Bonferroni 보정 후 backtestAll()에서 갱신
        sampleWarning,
      };

      // ── Phase A: 단순 OLS 진단 (return = alpha + beta * confidence) ──
      if (returns.length >= 20) {
        var sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (var ri = 0; ri < returns.length; ri++) {
          var xi = (validOccs[ri].confidencePred || validOccs[ri].confidence || 50) / 100;
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
      // 5열 설계행렬: [intercept, confidence, trendStrength, lnVolRatio, atrNorm]
      // [Phase 7 C-1] wc 제거 (look-ahead bias: analyze(전체candles)의 hw/mw가 미래 반영)
      //               momentum60 제거 (parsimony: 7→5열 축소, 과적합 방지)
      if (returns.length >= 30 && typeof calcWLSRegression === 'function') {
        var X = [], weights = [];
        var lambda = 0.995;
        for (var ri = 0; ri < returns.length; ri++) {
          var occ = validOccs[ri];
          X.push([
            1,                                             // 절편
            (occ.confidencePred || occ.confidence || 50) / 100,  // 신뢰도 (0-1, Dual Confidence)
            occ.trendStrength || 0,                        // 추세 강도
            Math.log(Math.max(occ.volumeRatio || 1, 0.1)), // ln(거래량비)
            occ.atrNorm || 0.02,                           // ATR / 종가
          ]);
          // 지수 감소 가중치: 최신 패턴에 높은 가중치
          weights.push(Math.pow(lambda, returns.length - 1 - ri));
        }

        var reg = calcWLSRegression(X, returns, weights, 2.0);
        if (reg) {
          stats.regression = {
            labels: ['intercept', 'confidence', 'trendStrength', 'lnVolumeRatio', 'atrNorm'],
            coeffs: reg.coeffs.map(function(c) { return +c.toFixed(6); }),
            rSquared: +reg.rSquared.toFixed(4),
            tStats: reg.tStats.map(function(t) { return +t.toFixed(2); }),
          };

          // 최근 패턴에 대한 기대수익률 예측
          if (validOccs.length > 0) {
            var latest = validOccs[validOccs.length - 1];
            var xNew = [
              1,
              (latest.confidencePred || latest.confidence || 50) / 100,
              latest.trendStrength || 0,
              Math.log(Math.max(latest.volumeRatio || 1, 0.1)),
              latest.atrNorm || 0.02,
            ];
            var predicted = 0;
            for (var j = 0; j < xNew.length; j++) {
              predicted += xNew[j] * reg.coeffs[j];
            }
            stats.expectedReturn = +predicted.toFixed(2);

            // ── LinUCB Contextual Bandit 조정 (Stage B) ──
            // Phase 6 audit: LinUCB delta t=-0.85 (STOP). Only apply if
            // t_stat_delta >= 2.0 in training summary (statistically significant improvement).
            if (this._rlPolicy) {
              var deltaT = this._rlPolicy.training_summary && this._rlPolicy.training_summary.t_stat_delta;
              if (deltaT != null && deltaT >= 2.0) {
                var rlCtx = this._buildRLContext(predicted, patternSignal, patternType, latest, candles);
                var rlResult = this._applyLinUCB(rlCtx);
                stats.expectedReturn = +(predicted * rlResult.factor).toFixed(2);
                stats.rlAction = rlResult.action;
                stats.rlFactor = rlResult.factor;
                predicted = stats.expectedReturn;
              }
            }

            // 95% 신뢰구간: SE = sqrt(sigma^2 * (1 + x' (X'WX)^-1 x))
            var xInvx = 0;
            for (var ii = 0; ii < xNew.length; ii++) {
              for (var jj = 0; jj < xNew.length; jj++) {
                xInvx += xNew[ii] * reg.invXtWX[ii][jj] * xNew[jj];
              }
            }
            var se = Math.sqrt(reg.sigmaHat2 * (1 + xInvx));
            // [FIX-7] 정밀 t-분포 임계값 테이블 (95% 신뢰구간, 양측)
            var tCrit = reg.df >= 120 ? 1.96 : reg.df >= 60 ? 2.00 : reg.df >= 30 ? 2.04 : reg.df >= 15 ? 2.13 : reg.df >= 10 ? 2.23 : reg.df >= 5 ? 2.57 : 4.30;
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
      riskReward: 0, tStat: 0, significant: false, adjustedSignificant: false,
      sampleWarning: 'insufficient',
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

        // [FIX] 진입가: 패턴 다음 캔들 시가
        const entryIdx2 = occ.idx + 1;
        if (entryIdx2 >= candles.length) continue;
        const entryPrice = candles[entryIdx2].open || candles[occ.idx].close;
        if (!entryPrice || entryPrice === 0) continue;

        const ret = (candles[exitIdx].close - entryPrice) / entryPrice * 100 - this.KRX_COST; // 왕복 거래비용 차감
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
