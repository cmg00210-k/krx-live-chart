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

    /** [Phase I-L2] 적응형 슬리피지 — Amihud (2002), core_data/18 §3
     *  ILLIQ 기반 종목별 슬리피지 조정. KOSDAQ 소형주 2-5x 상향.
     *  _behavioralData.illiq_spread 로드 후 사용 가능 */
    this._getAdaptiveSlippage = function(code) {
      if (!this._behavioralData || !this._behavioralData['illiq_spread']) return this.KRX_SLIPPAGE;
      var stockData = this._behavioralData['illiq_spread'].stocks;
      if (!stockData || !stockData[code]) return this.KRX_SLIPPAGE;
      var seg = stockData[code].segment;
      // Segment-based slippage: doc 18 table validated by compute_illiq_spread.py
      if (seg === 'kospi_large') return 0.04;
      if (seg === 'kospi_mid') return 0.10;
      if (seg === 'kosdaq_large') return 0.15;
      if (seg === 'kosdaq_small') return 0.25;
      return this.KRX_SLIPPAGE;
    };

    /** [P0-fix] 보유기간별 거래비용 — 고정비(세금+수수료)와 변동비(슬리피지) 분리
     *  고정비(tax+comm=0.21%): 왕복 1회 발생, horizon 비례 분할 (1/h)
     *  변동비(slippage=0.10%): 시장미시구조 잡음 √h 스케일링 — Kyle (1985)
     *  h=1: 0.31%, h=5: 0.087%, h=20: 0.033% (기존: 0.07% — 112% 과대계상 수정) */
    this._horizonCost = function(h) {
      var hSafe = Math.max(1, h);
      var fixedCost = (this.KRX_COMMISSION + this.KRX_TAX) / hSafe;
      var variableCost = this.KRX_SLIPPAGE / Math.sqrt(hSafe);
      return fixedCost + variableCost;
    };

    /** 패턴 타입별 한국어 매핑 + 방향 정보 */
    this._META = {
      threeWhiteSoldiers:     { name: '적삼병',     signal: 'buy'  },
      threeBlackCrows:        { name: '흑삼병',     signal: 'sell' },
      hammer:                 { name: '해머',       signal: 'buy'  },
      hangingMan:             { name: '교수형',     signal: 'sell' },
      shootingStar:           { name: '유성형',     signal: 'sell' },
      bullishEngulfing:       { name: '상승장악형', signal: 'buy'  },
      bearishEngulfing:       { name: '하락장악형', signal: 'sell' },
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
      longLeggedDoji:         { name: '긴다리도지', signal: 'neutral' },
      bullishBeltHold:        { name: '강세띠두름', signal: 'buy'  },
      bearishBeltHold:        { name: '약세띠두름', signal: 'sell' },
      bullishHaramiCross:     { name: '강세잉태십자', signal: 'buy'  },
      bearishHaramiCross:     { name: '약세잉태십자', signal: 'sell' },
      stickSandwich:          { name: '스틱샌드위치', signal: 'buy'  },
      abandonedBabyBullish:   { name: '강세버림받은아기', signal: 'buy'  },
      abandonedBabyBearish:   { name: '약세버림받은아기', signal: 'sell' },
      invertedHammer:         { name: '역해머',         signal: 'buy'  },
      doji:                   { name: '도지',           signal: 'neutral' },
      bullishHarami:          { name: '상승잉태형',     signal: 'buy'  },
      bearishHarami:          { name: '하락잉태형',     signal: 'sell' },
      spinningTop:            { name: '팽이형',         signal: 'neutral' },
      threeInsideUp:          { name: '상승삼내형',     signal: 'buy'  },
      threeInsideDown:        { name: '하락삼내형',     signal: 'sell' },
      channel:                { name: '채널',           signal: 'neutral' },
      cupAndHandle:           { name: '컵앤핸들',       signal: 'buy'  },
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
    this._rlTier3 = new Set(['fallingWedge']);
    this._loadRLPolicy();
    this._loadBehavioralData();
    this._loadCalibratedConstants();
  }

  /** [Phase I-L2] Behavioral data JSONs — core_data 18-21 quantification outputs */
  _behavioralData = null;
  _loadBehavioralData() {
    var that = this;
    var isWorker = (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined');
    var prefix = isWorker ? '../data/backtest/' : 'data/backtest/';
    // [Phase I-L1] csad_herding 추가: Chang, Cheng & Khorana (2000) 군집행동 지표
    // 45% 극단 군집 일수 → 하락장 극단 군집 시 매수 패턴 신뢰도 하향 조정에 활용
    // [H-12] disposition_proxy: loaded for future Doc24 §3 integration (disposition effect discount); currently unused
    var files = ['illiq_spread', 'hmm_regimes', 'disposition_proxy', 'csad_herding'];
    var loaded = {};
    // [H-3 FIX] Promise.all replaces setTimeout(3000) race condition.
    // All fetches complete before storing _behavioralData.
    Promise.all(files.map(function(name) {
      return fetch(prefix + name + '.json')
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
    })).then(function(results) {
      for (var i = 0; i < files.length; i++) {
        if (results[i]) loaded[files[i]] = results[i];
      }
      // [Phase0-#8] HMM staleness check: 30일 이상 경과 시 null 처리
      // [D] Heuristic — 30-day staleness cutoff: regime shifts typically resolve within 1 month
      if (loaded['hmm_regimes'] && loaded['hmm_regimes'].daily) {
        var daily = loaded['hmm_regimes'].daily;
        var lastEntry = daily.length > 0 ? daily[daily.length - 1] : null;
        if (lastEntry && lastEntry.date) {
          var lastDate = new Date(lastEntry.date);
          var now = new Date();
          var daysSince = (now - lastDate) / (1000 * 60 * 60 * 24);
          if (daysSince > 30) {
            console.warn('[HMM] hmm_regimes.json stale (' + Math.floor(daysSince) + 'd old) — disabled');
            loaded['hmm_regimes'] = null;
          }
        }
      }
      that._behavioralData = loaded;
    });
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
          // [C-9] Staleness guard: warn if policy older than 90 days
          // [D] Heuristic — 90-day policy staleness: ~1 quarterly regime cycle
          if (data.trained_date) {
            var age = (Date.now() - new Date(data.trained_date).getTime()) / (1000*60*60*24);
            if (age > 90) console.warn('[RL] Policy stale: ' + Math.round(age) + 'd old (trained ' + data.trained_date + ')');
          }
          // [H-16] Dimension validation: Python may train with different feature count
          var expectedDim = data.feature_dim || 7; // default 7 for backward compatibility
          if (data.d !== expectedDim) {
            console.warn('[RL] Dimension mismatch: policy.d=' + data.d + ', expected=' + expectedDim);
          }
        }
        // G-2: Beta-Binomial posterior mean → PatternEngine 주입
        if (data && data.win_rates_live && typeof PatternEngine !== 'undefined') {
          var liveWR = {};
          for (var pKey in data.win_rates_live) {
            var ab = data.win_rates_live[pKey];
            if (ab && ab.alpha > 0 && ab.beta > 0) {
              liveWR[pKey] = +(ab.alpha / (ab.alpha + ab.beta) * 100).toFixed(1);
            }
          }
          PatternEngine.PATTERN_WIN_RATES_LIVE = liveWR;
        }
      })
      .catch(function() { /* silent fallback */ });
  }

  /** Load calibrated constants JSON (graceful: missing file = no-op).
   *  calibrated_constants.json: 5 parameters from calibrate_constants.py
   *  Injects into PatternEngine static fields if available.
   *  [C][L:GS] calibrate_constants.py offline pipeline output.
   */
  _calibratedAttempted = false;
  _loadCalibratedConstants() {
    if (this._calibratedAttempted) return;
    this._calibratedAttempted = true;
    var isWorker = (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined');
    var url = isWorker
      ? '../data/backtest/calibrated_constants.json'
      : 'data/backtest/calibrated_constants.json';
    fetch(url)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data) return;
        // D1: candle_target_atr → PatternEngine.CANDLE_TARGET_ATR
        if (data.D1 && data.D1.candle_target_atr && typeof PatternEngine !== 'undefined') {
          var d1 = data.D1.candle_target_atr;
          if (d1.strong > 0 && d1.medium > 0 && d1.weak > 0) {
            PatternEngine.CANDLE_TARGET_ATR = {
              strong: +d1.strong.toFixed(2),
              medium: +d1.medium.toFixed(2),
              weak: +d1.weak.toFixed(2),
            };
          }
        }
        // C2: conf_L N_scale (currently hardcoded as n/300)
        // D3: rr_penalty thresholds
        // These are embedded in function logic, not easily injectable.
        // For now, D1 injection is the highest-impact automation.
      })
      .catch(function() { /* silent fallback — use hardcoded values */ });
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
        var ret = Math.log(closes[i].close / Math.max(prev, 1e-10));
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

    // Dim 9: raw_hurst (R/S analysis on log-returns, z-scored) — reuse calcHurst from indicators.js
    // [D][L:BAY] Fallback mu/sigma for returns-based H (Anis & Lloyd 1976 finite-sample bias).
    // Staleness guard: rl_policy.json may have old price-level stats (mean>0.80).
    // Returns-based H centers ~0.55-0.65; price-level H centers ~0.95 (spurious).
    // Fallback values from 2026-03-31 RL recalibration (rl_policy.json normalization.raw_hurst).
    var rawHurst = 0;
    if (candles && candles.length >= 40 && typeof calcHurst === 'function') {
      var hCloses = [];
      var hStart = Math.max(0, candles.length - 80);
      for (var h = hStart; h < candles.length; h++) hCloses.push(candles[h].close);
      var hResult = calcHurst(hCloses);
      var hVal = hResult ? hResult.H : null;
      if (hVal != null && isFinite(hVal)) {
        var hNorm = this._rlPolicy && this._rlPolicy.normalization && this._rlPolicy.normalization.raw_hurst;
        // Staleness guard: price-level H has mean>0.80; returns-based H has mean<0.80
        var hStale = hNorm && hNorm.mean > 0.80;
        var hMean = (hNorm && !hStale) ? hNorm.mean : 0.612;
        var hStd = (hNorm && !hStale) ? hNorm.std : 0.133;
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

  // [C-7] Greedy-only LinUCB: exploration term α√(x'A⁻¹x) dropped in JS; full UCB in rl_linucb.py
  // LinUCB is a contextual bandit (single-step), not MDP — no Bellman equation applies (Li et al., 2010)
  // [C-8] Known misalignment: RL reward (per-sample return) ≠ evaluation metric (Spearman IC) — see Doc11§13.3
  /** Apply LinUCB (greedy): dot product + argmax over 5 actions */
  _applyLinUCBGreedy(context) {
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
      if (this._resultCache.size > 200) this._resultCache.clear(); // [D] Heuristic — 200 eviction cap: memory guard
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
    if (this._resultCache.size > 200) this._resultCache.clear(); // [D] Heuristic — 200 eviction cap: memory guard
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
        // [B-1 FIX] WFE activation — Pardo (2008): Walk-Forward Efficiency
        // walkForwardTest() was dead code (defined but never called).
        // WFE < 30% → overfit → reliability capped at C (line 438).
        var wfeResult = this.walkForwardTest(candles, pType);
        if (wfeResult) result.wfe = wfeResult.wfe;
        results[pType] = result;
      }
    }

    // ── Benjamini-Hochberg FDR 다중비교 보정 ──────────────
    // Holm step-down(FWER) → BH step-up(FDR) 전환: Phase G-1
    // FDR q=0.05: 기각된 검정 중 거짓 양성 비율 ≤5% 통제
    // 탐색적 패턴 분석에서 Holm은 과도하게 보수적 — BH가 검정력 우위
    // Benjamini & Hochberg (1995), JRSS-B 57(1):289-300
    this._applyBHFDR(results);

    // [Expert Consensus] Reliability Tier — CFA + Statistical + Theory consensus
    // NOTE: reliabilityTier 'A'/'B'/'C'/'D' = 백테스트 통계 유의성 등급 [A-rel ~ D-rel]
    // 혼동 주의: core_data/22의 상수 Tier A/B/C/D/E [A-const]와 별개 시스템
    // 혼동 주의: app.js의 검증 Tier S/A/B/C/D [S-ver ~ D-ver]와도 별개
    for (var tierKey in results) {
      var tierResult = results[tierKey];
      if (!tierResult || !tierResult.horizons) { tierResult.reliabilityTier = 'D'; continue; }
      var h5 = tierResult.horizons[5];
      if (!h5 || h5.n < 10) { tierResult.reliabilityTier = 'D'; continue; }

      var isAdjSig = h5.adjustedSignificant;
      var isSig = h5.significant;
      var alpha = h5.wrAlpha || 0;
      var nSample = h5.n;
      var exp = h5.expectancy || 0;
      var pf = h5.profitFactor || 0;

      // [STAT-B] OOS IC gate — Grinold & Kahn (2000), Qian, Hua & Sorensen (2007)
      // IC=null passes (insufficient data for IC calc ≠ IC=0).
      // A-tier: IC > 0.02 (non-trivial predictive power, Qian et al. minimal benchmark)
      // B-tier: IC > 0.01 (minimal non-random signal)
      // Prevents noise-fit regressions from achieving high tier.
      var h5ic = h5.ic;
      var icPassA = (h5ic == null || h5ic > 0.02);
      var icPassB = (h5ic == null || h5ic > 0.01);

      // [D] Heuristic — reliability tier thresholds (alpha, n, pf) are practitioner conventions,
      // not from a single published source. Informed by CFA sample-size guidance and
      // common quant thresholds, but exact cutoffs are project-specific.
      if (isAdjSig && alpha >= 5 && nSample >= 100 && exp > 0 && pf >= 1.3 && icPassA) {
        tierResult.reliabilityTier = 'A';
      } else if (isAdjSig && alpha >= 3 && nSample >= 30 && exp > 0 && icPassB) {
        // [STAT-A] BH-FDR gate for B-tier — Benjamini & Hochberg (1995)
        // Raw significance alone insufficient: with 30+ patterns × 5 horizons,
        // ~7.5 false positives expected at α=0.05. BH-FDR controls FDR ≤ 5%.
        tierResult.reliabilityTier = 'B';
      } else if (alpha > 0 && nSample >= 30) {
        tierResult.reliabilityTier = 'C';
      } else {
        tierResult.reliabilityTier = 'D';
      }
      // [C-3 FIX] WFE gating — Pardo (2008): WFE < 30% → overfit, cap at C
      // [B-1 FIX] walkForwardTest() returns wfe as integer % (e.g. 50 = 50%).
      // Previous threshold 0.30 was scale mismatch (never triggered). Corrected to 30.
      var wfeVal = tierResult.wfe;
      if (wfeVal != null && wfeVal < 30 && (tierResult.reliabilityTier === 'A' || tierResult.reliabilityTier === 'B')) {
        tierResult.reliabilityTier = 'C';
      }
    }

    return results;
  }

  /** Spearman Rank IC — Grinold & Kahn (2000), "Active Portfolio Management"
   *  Rank correlation between predicted and actual returns.
   *  Non-parametric: robust to non-normal return distributions (Cont 2001).
   *  IC > 0.05 is operationally significant; IC > 0.10 is strong.
   *
   *  @param {Array} pairs — [[predicted, actual], ...] (minimum 5 pairs)
   *  @returns {number|null} — Spearman rho in [-1, 1], or null if insufficient data
   */
  _spearmanCorr(pairs) {
    if (!pairs || pairs.length < 5) return null;
    var n = pairs.length;
    // Rank each column with averaged ties
    function rank(arr) {
      var sorted = arr.map(function(v, i) { return { v: v, i: i }; });
      sorted.sort(function(a, b) { return a.v - b.v; });
      var ranks = new Array(n);
      for (var i = 0; i < n; i++) {
        ranks[sorted[i].i] = i + 1;
      }
      // Handle ties: average ranks — Kendall & Gibbons (1990)
      var j = 0;
      while (j < n) {
        var k = j;
        while (k < n - 1 && sorted[k + 1].v === sorted[k].v) k++;
        if (k > j) {
          var avgRank = (j + k + 2) / 2;
          for (var m = j; m <= k; m++) ranks[sorted[m].i] = avgRank;
        }
        j = k + 1;
      }
      return ranks;
    }
    var rankPred = rank(pairs.map(function(p) { return p[0]; }));
    var rankAct = rank(pairs.map(function(p) { return p[1]; }));
    // [H-1 FIX] Pearson-of-ranks — exact Spearman rho with tied ranks
    // Kendall & Gibbons (1990): shortcut formula invalid with ties
    var sumPR = 0, sumP = 0, sumR = 0, sumP2 = 0, sumR2 = 0;
    for (var i = 0; i < n; i++) {
      sumPR += rankPred[i] * rankAct[i];
      sumP += rankPred[i]; sumR += rankAct[i];
      sumP2 += rankPred[i] * rankPred[i];
      sumR2 += rankAct[i] * rankAct[i];
    }
    var num = n * sumPR - sumP * sumR;
    var den = Math.sqrt((n * sumP2 - sumP * sumP) * (n * sumR2 - sumR * sumR));
    return den > 0 ? num / den : 0;
  }

  /** Rolling OOS IC — out-of-sample Spearman IC via expanding window
   *  Addresses in-sample IC inflation (Lo 2002, "The Statistics of Sharpe Ratios").
   *  Splits chronological pairs into non-overlapping OOS windows.
   *  Each window's IC is computed purely on unseen data.
   *  Average OOS IC is less biased than full-sample IC.
   *
   *  @param {Array} pairs — [[predicted, actual], ...] chronologically ordered
   *  @param {number} minWindow — minimum OOS window size (default 12)
   *  @returns {{ ic: number|null, nWindows: number, isOOS: boolean }}
   */
  _rollingOOSIC(pairs, minWindow) {
    minWindow = minWindow || 12;
    var n = pairs.length;
    // Need at least 2x minWindow for meaningful OOS (training + test)
    if (n < minWindow * 2) {
      var fullIC = this._spearmanCorr(pairs);
      return { ic: fullIC, nWindows: 0, isOOS: false };
    }

    var oosICs = [];
    var step = minWindow;
    // Non-overlapping OOS windows: [minWindow..minWindow+step), [2*step..3*step), ...
    // Each window is pure OOS — model was never fitted on these observations
    for (var i = minWindow; i + step <= n; i += step) {
      var testPairs = pairs.slice(i, i + step);
      var testIC = this._spearmanCorr(testPairs);
      if (testIC != null) oosICs.push(testIC);
    }

    if (oosICs.length === 0) {
      var fullIC2 = this._spearmanCorr(pairs);
      return { ic: fullIC2, nWindows: 0, isOOS: false };
    }

    var sum = 0;
    for (var w = 0; w < oosICs.length; w++) sum += oosICs[w];
    var avgIC = sum / oosICs.length;
    return { ic: +avgIC.toFixed(4), nWindows: oosICs.length, isOOS: true };
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
    const folds = (opts && opts.folds) || (candles.length >= 500 ? 6 : 4); // [Phase0-#10] Bailey-Lopez de Prado (2014): 500+봉 → K=6
    const horizon = (opts && opts.horizon) || 5;
    const minTrain = (opts && opts.minTrain) || 60;
    const purge = horizon * 2; // [Phase0-C] 2×horizon — Bailey & Lopez de Prado (2014): AR(1) 반감기 6.5봉 > horizon(5)
    const len = candles.length;

    // OOS 블록 크기: 전체의 ~20%를 folds개로 분배
    // [D] Heuristic — 20% OOS ratio and min 15 bars: practitioner conventions for WFE
    const oosSize = Math.max(15, Math.floor(len * 0.20 / folds));
    const totalOos = oosSize * folds;
    if (len - totalOos < minTrain) return null;

    const foldResults = [];
    let sumIS = 0, sumOOS = 0, validFolds = 0;

    for (let f = 0; f < folds; f++) {
      // [H-4 FIX] Clear result cache per fold to prevent cross-fold contamination.
      // Different training slices produce different pattern sets; shared cache keys
      // could return stale results from a prior fold's training window.
      this._resultCache = new Map();
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
    var minISEdge = 0.005; // [D] Heuristic — 0.5% minimum IS edge: below KRX round-trip cost → noise
    const wfe = Math.abs(avgIS) < minISEdge
      ? 0  // insufficient IS edge → WFE undefined
      : Math.round((avgOOS / avgIS) * 100);
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
  _applyBHFDR(results) {
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
          df: hs.n - 1,
          stats: hs,
        });
      }
    }

    const m = tests.length;
    if (m === 0) return;

    // Step 2: p-value 근사 후 오름차순 정렬
    // Bailey & Lopez de Prado (2014): df 상이 시 p-value 정렬 필수
    for (var ti = 0; ti < m; ti++) {
      tests[ti].pValue = this._approxPValue(tests[ti].absTStat, tests[ti].df);
    }
    tests.sort(function(a, b) { return a.pValue - b.pValue; });

    // Step 3: BH step-up — Benjamini & Hochberg (1995)
    // 가장 큰 k를 찾되 p_(k) <= (k+1) * q / m (0-indexed)
    // rank <= k 인 모든 검정을 기각 (FDR ≤ q 보장)
    var Q = ALPHA; // FDR level q=0.05
    var maxK = -1;
    for (var k = m - 1; k >= 0; k--) {
      if (tests[k].pValue <= (k + 1) * Q / m) {
        maxK = k;
        break;
      }
    }
    for (var k = 0; k < m; k++) {
      tests[k].stats.adjustedSignificant = (k <= maxK);
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

  /** Fat-tail adjusted t-critical — Cont (2001) "Stylized Facts of Asset Returns"
   *  금융 수익률은 보편적으로 K > 3 (leptokurtic). 표준 t(df)는 꼬리 위험을 과소평가.
   *  초과 첨도 K_e > 0.5일 때, 유효 자유도 nu = 4 + 6/(K_e) 로 축소하여
   *  CI 폭을 현실적으로 확장한다. (K_e ≤ 0.5이면 정규 근사 충분)
   *
   *  @param {number} df — 원래 자유도 (n - 1)
   *  @param {Array<number>} returns — 수익률 배열 (초과 첨도 계산용)
   *  @param {number} [alpha=0.05] — 유의수준 (양측)
   *  @returns {number} — fat-tail 보정된 t-critical (양수)
   */
  _tCritFatTail(df, returns, alpha) {
    if (!alpha) alpha = 0.05;
    if (!returns || returns.length < 4) return this._tCriticalForAlpha(alpha, df);

    // 초과 첨도 (excess kurtosis) 계산: K_e = m4/m2^2 - 3
    var n = returns.length;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += returns[i];
    var mean = sum / n;
    var m2 = 0, m4 = 0;
    for (var i = 0; i < n; i++) {
      var d = returns[i] - mean;
      var d2 = d * d;
      m2 += d2;
      m4 += d2 * d2;
    }
    m2 /= n;
    m4 /= n;
    if (m2 < 1e-12) return this._tCriticalForAlpha(alpha, df);
    var excessKurtosis = (m4 / (m2 * m2)) - 3;

    // Fat-tail 보정: K_e > 0.5 → 유효 df 축소
    // nu_kurtosis ≈ 4 + 6/K_e (t-분포의 첨도 = 6/(nu-4), 역산)
    var effectiveDf = df;
    if (excessKurtosis > 0.5) {
      var nuKurtosis = 4 + 6 / excessKurtosis;
      effectiveDf = Math.min(df, Math.max(1, Math.floor(nuKurtosis)));
    }

    return this._tCriticalForAlpha(alpha, effectiveDf);
  }

  /** 양측 t-분포 p-value 근사 — 정규 근사 + df 보정
   *  Abramowitz & Stegun 26.7.5: 정규 근사 z ≈ t * sqrt((df-0.667)/(df-0.333)) / sqrt(df)
   *  df >= 3에서 ~0.01 정확도 (Holm 정렬에 충분)
   *
   *  @param {number} absT — |t-stat|
   *  @param {number} df — 자유도
   *  @returns {number} — 양측 p-value (0~1)
   */
  _approxPValue(absT, df) {
    if (df < 1 || !isFinite(absT)) return 1;
    if (absT <= 0) return 1;
    // 정규 근사: z ≈ absT * (1 - 1/(4*df)) / sqrt(1 + absT^2/(2*df))
    var z = absT * (1 - 1 / (4 * df)) / Math.sqrt(1 + absT * absT / (2 * df));
    // 표준정규 상보 CDF: Φ(-z) ≈ Abramowitz & Stegun 7.1.26
    var b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937;
    var b4 = -1.821255978, b5 = 1.330274429;
    var t = 1 / (1 + 0.2316419 * z);
    var phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    var tail = phi * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
    return Math.max(0, Math.min(1, 2 * tail)); // 양측
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
        hw: p.hw || 1.0, // [C-2 FIX] regimeWR이 hw 기반 trending/reverting 분류에 사용 — 누락 시 항상 neutral
        momentum60: momentum60,
        priceTarget: (p.priceTarget != null && isFinite(p.priceTarget)) ? p.priceTarget : null,
        patternSignal: p.signal || null,
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
    // KNOWN LIMITATION: Survivorship bias — universe excludes delisted stocks.
    // WR positively biased ~2-5pp (Elton, Gruber & Blake, 1996, JF 51(4):1097-1108).
    // Mitigation: wrAlpha uses null-WR recentering, but absolute WR still inflated.
    const result = {};

    for (const h of horizons) {
      const returns = [];
      const returnDates = [];  // [Calendar Bootstrap] 각 return의 패턴 발생 날짜 (YYYY-MM-DD)
      const validOccs = [];  // 유효한 발생 이력 (회귀용)
      const maeArr = [];  // Max Adverse Excursion per trade
      const mfeArr = [];  // Max Favorable Excursion per trade
      var targetHits = 0, targetTotal = 0;  // 목표가 도달 비율
      var predErrors = [];  // 예측 오차 (|predicted - actual| %) for MAE
      var predActualPairs = [];  // [Phase 2] (predicted%, actual%) 쌍 — 산점도/Calibration용

      for (const occ of occurrences) {
        const exitIdx = occ.idx + h;
        if (exitIdx >= candles.length) continue;

        // [FIX] 진입가: 패턴 다음 캔들 시가 (look-ahead bias 제거)
        const entryIdx = occ.idx + 1;
        if (entryIdx >= candles.length) continue;
        const entryPrice = candles[entryIdx].open || candles[occ.idx].close;
        if (!entryPrice || entryPrice === 0) continue;

        // [Expert Consensus] MAE/MFE — Sweeney (1997), path risk
        var minRet = 0, maxRet = 0;
        for (var pi = entryIdx; pi <= exitIdx; pi++) {
          var pathRet = (candles[pi].close - entryPrice) / entryPrice * 100;
          if (pathRet < minRet) minRet = pathRet;
          if (pathRet > maxRet) maxRet = pathRet;
        }

        const exitPrice = candles[exitIdx].close;
        const ret = (exitPrice - entryPrice) / entryPrice * 100 - this._horizonCost(h); // [Phase0-E] horizon-scaled 거래비용
        returns.push(ret);
        returnDates.push(candles[occ.idx].time || '');  // [Calendar Bootstrap] 패턴 발생 시점 날짜
        validOccs.push(occ);
        maeArr.push(minRet);
        mfeArr.push(maxRet);

        // [Phase 1] 목표가 도달률 + 예측 오차 — priceTarget 존재 시만 계산
        if (occ.priceTarget != null && entryPrice > 0) {
          targetTotal++;
          var occSignal = occ.patternSignal || patternSignal;
          if (occSignal === 'buy') {
            // 매수: 최고가(MFE)가 목표가에 도달했는지
            var targetDist = (occ.priceTarget - entryPrice) / entryPrice * 100;
            if (targetDist > 0 && maxRet >= targetDist) targetHits++;
          } else if (occSignal === 'sell') {
            // 매도: 최저가(MAE 반전)가 목표가에 도달했는지
            var targetDist = (entryPrice - occ.priceTarget) / entryPrice * 100;
            if (targetDist > 0 && Math.abs(minRet) >= targetDist) targetHits++;
          }
          // 예측 오차: |predicted return - actual return|
          var predictedRet = (occ.priceTarget - entryPrice) / entryPrice * 100;
          var actualRet = (exitPrice - entryPrice) / entryPrice * 100;
          predErrors.push(Math.abs(predictedRet - actualRet));
          predActualPairs.push({ predicted: +predictedRet.toFixed(2), actual: +actualRet.toFixed(2) });
        }
      }

      if (returns.length === 0) {
        result[h] = this._emptyHorizonStats();
        continue;
      }

      const n = returns.length;
      const sorted = [...returns].sort((a, b) => a - b);

      // [Expert Consensus] MAE/MFE statistics — path risk assessment
      var maeSorted = [...maeArr].sort(function(a, b) { return a - b; });
      var mfeSorted = [...mfeArr].sort(function(a, b) { return a - b; });
      var medianMAE = n > 0 ? (n % 2 === 0 ? (maeSorted[n/2-1] + maeSorted[n/2]) / 2 : maeSorted[Math.floor(n/2)]) : 0;
      var medianMFE = n > 0 ? (n % 2 === 0 ? (mfeSorted[n/2-1] + mfeSorted[n/2]) / 2 : mfeSorted[Math.floor(n/2)]) : 0;
      // [M-1 FIX] Standard percentile with linear interpolation — Hyndman & Fan (1996) Type 7.
      // Old: Math.floor(n*0.05) gives off-by-one at small n (e.g. n=20 → idx=1, should interpolate).
      // New: index = (n-1)*p, then linear interpolation between floor and ceil.
      var mae5, mfe95;
      if (n >= 2) {
        var idx5 = (n - 1) * 0.05;
        var lo5 = Math.floor(idx5), hi5 = Math.min(Math.ceil(idx5), n - 1), frac5 = idx5 - lo5;
        mae5 = maeSorted[lo5] + frac5 * (maeSorted[hi5] - maeSorted[lo5]);
        var idx95 = (n - 1) * 0.95;
        var lo95 = Math.floor(idx95), hi95 = Math.min(Math.ceil(idx95), n - 1), frac95 = idx95 - lo95;
        mfe95 = mfeSorted[lo95] + frac95 * (mfeSorted[hi95] - mfeSorted[lo95]);
      } else {
        mae5 = maeSorted[0] || 0;
        mfe95 = mfeSorted[n - 1] || 0;
      }

      // [Expert Consensus] Max Drawdown — CFA Level III, cumulative equity path
      var cumRet = 0, peak = 0, maxDD = 0;
      for (var di = 0; di < returns.length; di++) {
        cumRet += returns[di];
        if (cumRet > peak) peak = cumRet;
        var dd = peak - cumRet;
        if (dd > maxDD) maxDD = dd;
      }

      // [Expert Consensus] CVaR (Expected Shortfall) 5% — Basel Committee coherent risk
      var cvarIdx = Math.max(1, Math.floor(n * 0.05));
      var cvarSum = 0;
      for (var ci = 0; ci < cvarIdx; ci++) cvarSum += sorted[ci];
      var cvar5 = cvarIdx > 0 ? cvarSum / cvarIdx : sorted[0] || 0;

      // 기본 통계
      const sum = returns.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
      // Sample variance (÷(n-1), Bessel correction) — distinct from BB's population σ
      const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1 || 1);
      const stdDev = Math.sqrt(variance);

      // [Expert Consensus] Sortino Ratio — Sortino & van der Meer (1991)
      // Penalizes only downside deviation, more appropriate for asymmetric returns
      // Annualization: √(KRX_TRADING_DAYS/(h-1)) per Sortino & Price (1994); h-1 df correction, assumes IID downside deviations
      // [H-1 FIX] Denominator = sqrt(sum(min(r,0)^2) / N_total), NOT / N_negative.
      // Per Sortino & van der Meer (1991): downside deviation uses total sample count
      // to avoid overestimating risk when few negative returns exist.
      const downsideVariance = n > 1
        ? returns.reduce((a, r) => a + (r < 0 ? r * r : 0), 0) / n
        : 0;
      const downsideDev = Math.sqrt(downsideVariance);
      const sortinoRatio = downsideDev > 0 ? +(mean / downsideDev * Math.sqrt(KRX_TRADING_DAYS / Math.max(1, h - 1))).toFixed(2) : null;

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

      // [Expert Consensus] Null WR & Alpha — correct H₀ for market drift
      // Sullivan, Timmermann & White (1999): unconditional base rate as null
      // (Moved before Cohen's h so wrNull is available for proper null hypothesis)
      var nullWR = this._computeNullWR(candles, h);
      var wrNull = patternSignal === 'sell' ? nullWR.sellNull : nullWR.buyNull;
      var wrAlpha = +(winRate - wrNull).toFixed(1);

      // [Expert Consensus] Cohen's h — effect size independent of sample size
      // h = 2 * arcsin(sqrt(p_obs)) - 2 * arcsin(sqrt(p_null))
      // [M-3 FIX] Use wrNull/100 (market-drift-corrected null) instead of hardcoded 0.5.
      // Cohen (1988): effect size relative to proper null hypothesis.
      var pNull = Math.max(0.001, Math.min(0.999, wrNull / 100));
      var cohensH = +(2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, winRate / 100)))) - 2 * Math.asin(Math.sqrt(pNull))).toFixed(3);

      // [Expert Consensus] Information Ratio — Grinold & Kahn (2000)
      // IR = mean_excess / tracking_error, annualized
      // [H-2 FIX] Null mean computed independently from unconditional market returns.
      // Old code: nullMeanApprox = (wrNull-50)/50 * |mean| — circular (derives benchmark from own mean).
      // New: compute actual unconditional h-day mean return from _computeNullWR data.
      // This is the true benchmark: "what would random entry yield on average?"
      var nullMeanReturn = this._computeNullMeanReturn(candles, h);
      var excessReturns = [];
      for (var iri = 0; iri < returns.length; iri++) {
        excessReturns.push(returns[iri] - nullMeanReturn);
      }
      var exSum = excessReturns.reduce(function(a, b) { return a + b; }, 0);
      var exMean = exSum / n;
      var exVar = excessReturns.reduce(function(a, r) { return a + (r - exMean) * (r - exMean); }, 0) / (n - 1 || 1);
      var trackingError = Math.sqrt(exVar);
      var informationRatio = trackingError > 0 ? +(exMean / trackingError * Math.sqrt(KRX_TRADING_DAYS / Math.max(1, h))).toFixed(2) : null;

      // [Expert Consensus] Regime-Conditioned WR — Lo (2004) AMH
      var regimeWR = this._computeRegimeWR(candles, validOccs, h, patternSignal);

      // [Expert Consensus] Calendar-Time Block Bootstrap — Fama & French (2010), Politis & Romano (1994)
      // Patterns cluster in volatile periods (earnings, regime changes), violating i.i.d. assumption.
      // Calendar-month resampling preserves within-month temporal dependence and seasonal effects.
      // Fallback: index-based block bootstrap when date strings are unavailable (intraday data).
      var winRateCI = null;
      if (n >= 30) {
        // Winsorize at 1st/99th percentile before bootstrap (Wilcox 2005)
        // KRX ±30% limit-up/down produces extreme kurtosis; unwinsorized
        // bootstrap CIs are too wide due to heavy-tail resampling.
        var sortedForClip = returns.slice().sort(function(a, b2) { return a - b2; });
        var clipLo = sortedForClip[Math.max(0, Math.floor(n * 0.01))];
        var clipHi = sortedForClip[Math.min(n - 1, Math.floor(n * 0.99))];
        var clippedReturns = returns.map(function(r) { return Math.max(clipLo, Math.min(clipHi, r)); });

        // Calendar-month grouping: group clipped returns by YYYY-MM
        // Patterns in the same month share macro regime, so resampling whole months
        // preserves within-month correlation structure (Carlstein 1986, calendar variant).
        var monthGroups = {};
        var hasCalendarDates = false;
        for (var gi = 0; gi < n; gi++) {
          var dateStr = returnDates[gi];
          // Daily candles: "YYYY-MM-DD" format — extract "YYYY-MM"
          var monthKey = (dateStr && typeof dateStr === 'string' && dateStr.length >= 7)
            ? dateStr.substring(0, 7) : null;
          if (monthKey) {
            hasCalendarDates = true;
            if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
            monthGroups[monthKey].push(clippedReturns[gi]);
          }
        }

        var B = 500, bootWR = []; // Efron & Tibshirani (1993): 200-1000 replicates for percentile CIs

        if (hasCalendarDates && Object.keys(monthGroups).length >= 3) { // [D] Heuristic — min 3 months for meaningful calendar resampling
          // ── Calendar-time bootstrap: resample months with replacement ──
          // Fama & French (2010): calendar-time portfolios correct for cross-sectional dependence.
          // Each bootstrap iteration resamples whole months, preserving intra-month clustering.
          var monthKeys = Object.keys(monthGroups);
          for (var bi = 0; bi < B; bi++) {
            var wins_b = 0, count_b = 0;
            var bootReturns = [];
            // Resample months until we have >= n returns
            while (bootReturns.length < n) {
              var rndMonth = monthKeys[Math.floor(Math.random() * monthKeys.length)];
              for (var mri = 0; mri < monthGroups[rndMonth].length; mri++) {
                bootReturns.push(monthGroups[rndMonth][mri]);
              }
            }
            // Trim to exactly n (avoid bias from last month overshoot)
            for (var bri = 0; bri < n; bri++) {
              if ((patternSignal === 'buy' && bootReturns[bri] > 0) ||
                  (patternSignal === 'sell' && bootReturns[bri] < 0) ||
                  (patternSignal === 'neutral' && bootReturns[bri] > 0)) wins_b++;
              count_b++;
            }
            bootWR.push(count_b > 0 ? (wins_b / count_b * 100) : 50);
          }
        } else {
          // ── Fallback: index-based block bootstrap (intraday or missing dates) ──
          // Kunsch (1989), Carlstein (1986): block size = sqrt(n) preserves local dependence.
          // NOTE: This path does not correct for temporal clustering across periods.
          var blockSize = Math.max(2, Math.round(Math.sqrt(n)));
          var nBlocks = Math.ceil(n / blockSize);
          for (var bi = 0; bi < B; bi++) {
            var wins_b = 0, count_b = 0;
            for (var blk = 0; blk < nBlocks && count_b < n; blk++) {
              var startIdx = Math.floor(Math.random() * n);
              for (var bj = 0; bj < blockSize && count_b < n; bj++) {
                var idx = (startIdx + bj) % n;
                if ((patternSignal === 'buy' && clippedReturns[idx] > 0) ||
                    (patternSignal === 'sell' && clippedReturns[idx] < 0) ||
                    (patternSignal === 'neutral' && clippedReturns[idx] > 0)) wins_b++;
                count_b++;
              }
            }
            bootWR.push(count_b > 0 ? (wins_b / count_b * 100) : 50);
          }
        }
        bootWR.sort(function(a, b2) { return a - b2; });
        winRateCI = [
          +bootWR[Math.floor(B * 0.025)].toFixed(1),
          +bootWR[Math.floor(B * 0.975)].toFixed(1)
        ];
      }

      // 최대 손실/이익
      const maxLoss = sorted[0];
      const maxGain = sorted[n - 1];

      // 평균 이익/손실 (리스크-리워드 비율 계산용)
      const winReturns = returns.filter(r => r > 0);
      const lossReturns = returns.filter(r => r < 0);
      const avgWin = winReturns.length ? winReturns.reduce((a, b) => a + b, 0) / winReturns.length : 0;
      const avgLoss = lossReturns.length ? Math.abs(lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length) : 0;
      const riskReward = avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : (avgWin > 0 ? 999.99 : 0);

      // ── [Expert Consensus] Expectancy, Profit Factor, Kelly f* ──
      // Kelly (1956), Lopez de Prado (2018): WR alone is insufficient
      const expectancy = (wins / n) * avgWin - ((n - wins) / n) * avgLoss;
      const grossProfit = winReturns.length ? winReturns.reduce((a, b) => a + b, 0) : 0;
      const grossLoss = lossReturns.length ? Math.abs(lossReturns.reduce((a, b) => a + b, 0)) : 0;
      const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? 999.99 : 0);
      const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999.99 : 0);
      // [H-3 FIX] Kelly (1956): clamp to [0, 1.0]. Negative Kelly = don't bet.
      // Raw Kelly > 1.0 implies leveraged positions — inappropriate for unleveraged equity.
      // Half-Kelly (f*/2) is industry standard; raw clamped here, downstream can halve.
      // NOTE: Full Kelly used; half-Kelly (0.5f*) recommended for production — reduces drawdown ~50% (Thorp, 2006)
      // [M-5 FIX] Use excess probability over null WR instead of raw wins/n.
      // In a market with positive drift, wrNull > 50% overstates raw edge.
      // Kelly edge = (observed WR - null WR); recentered to 0.5 for formula.
      // [H-2 FIX] Kelly edge = observed WR - null WR (no 0.5 recentering)
      // Previous formula added 0.5 which creates bias when wrNull ≠ 50%.
      // Kelly (1956): edge = p_win - p_lose/b = max(0, WR - wrNull) scaled to Kelly formula
      const kellyEdge = Math.max(0, (wins / n) - (wrNull / 100));
      const kellyRaw = payoffRatio > 0 && kellyEdge > 0 ? ((kellyEdge * (1 + payoffRatio)) - 1) / payoffRatio : 0;
      const kellyFraction = +Math.max(0, Math.min(1.0, kellyRaw)).toFixed(4);

      // t-검정: H0: mean = 0 (fat-tail 보정 Cornish-Fisher 임계값, 95% 양측)
      // Cont (2001): 금융 수익률 K > 3 → 유효 df 축소로 꼬리 위험 반영
      const tStat = stdDev > 0 && n > 1 ? mean / (stdDev / Math.sqrt(n)) : 0;
      const df = n - 1;
      const tCritical = this._tCritFatTail(df, returns, 0.05);
      const significant = Math.abs(tStat) > tCritical;

      // [Expert Consensus] Harvey-Liu-Zhu (2016) stricter threshold for multiple testing
      var hlzSignificant = Math.abs(tStat) > 3.0;

      // MDE (Minimum Detectable Effect) — Cohen (1988), power analysis
      // The smallest mean return (%) reliably distinguishable from zero at 95% confidence.
      // Uses fat-tail-corrected tCritical (not naive 1.96) for KRX heavy-tail returns.
      // If observed |mean| < MDE, the result is statistically indistinguishable from noise.
      var mde = n > 1 && stdDev > 0 ? +(tCritical * stdDev / Math.sqrt(n)).toFixed(2) : null;

      // [Expert Consensus] CFA: n<100 unreliable, n<400 caution (95% CI ±5pp)
      let sampleWarning = '';
      if (n < 30) sampleWarning = 'insufficient';
      else if (n < 100) sampleWarning = 'low';
      else if (n < 400) sampleWarning = 'caution';
      else sampleWarning = 'adequate';

      // [Phase 1] 방향 적중률 (DA) — patternSignal 기준 승률과 동일
      var directionalAccuracy = +winRate.toFixed(1);

      // [Phase 1] 목표가 도달률 — priceTarget 데이터가 있는 발생에 한해 계산
      var targetHitRate = targetTotal >= 5 ? +((targetHits / targetTotal) * 100).toFixed(1) : null;

      // [Phase 1] 예측 MAE — |predicted return - actual return| 평균
      var predictionMAE = predErrors.length >= 5
        ? +(predErrors.reduce(function(a, b) { return a + b; }, 0) / predErrors.length).toFixed(2)
        : null;

      // [Phase 1] 패턴 종합 점수 (0-100)
      // DA * 0.30 + targetHitRate * 0.25 + (100 - MAE*10) * 0.25 + min(PF*20, 100) * 0.20
      // [D] Heuristic — composite score weights (0.30/0.25/0.25/0.20) and scaling factors
      // (MAE×10, PF×20) are practitioner-designed; no single published source.
      // Fallback 50 for missing MAE = neutral midpoint assumption.
      var _da = directionalAccuracy || 0;
      var _thr = targetHitRate != null ? targetHitRate : _da;  // fallback: DA 대용
      var _maeScore = predictionMAE != null ? Math.max(0, 100 - predictionMAE * 10) : 50;  // fallback: 중립
      var _pfScore = Math.min((profitFactor || 0) * 20, 100);
      var patternScore = +Math.max(0, Math.min(100,
        _da * 0.30 + _thr * 0.25 + _maeScore * 0.25 + _pfScore * 0.20
      )).toFixed(1);

      // [D] Heuristic — grade boundaries (80/65/50/35) are practitioner conventions
      var patternGrade;
      if (patternScore >= 80) patternGrade = 'A';
      else if (patternScore >= 65) patternGrade = 'B';
      else if (patternScore >= 50) patternGrade = 'C';
      else if (patternScore >= 35) patternGrade = 'D';
      else patternGrade = 'F';

      // [Phase 3] Mincer-Zarnowitz 회귀 + Calibration 진단
      // Mincer & Zarnowitz (1969): actual = α + β × predicted, H₀: α=0, β=1
      var mzRegression = null;
      var calibrationCoverage = null;
      if (predActualPairs.length >= 20) {
        var _pN = predActualPairs.length;
        var _sx = 0, _sy = 0, _sxy = 0, _sx2 = 0, _sy2 = 0;
        for (var _pi = 0; _pi < _pN; _pi++) {
          var _px = predActualPairs[_pi].predicted, _py = predActualPairs[_pi].actual;
          _sx += _px; _sy += _py; _sxy += _px * _py; _sx2 += _px * _px; _sy2 += _py * _py;
        }
        var _pmx = _sx / _pN, _pmy = _sy / _pN;
        var _denom = _sx2 - _pN * _pmx * _pmx;
        if (Math.abs(_denom) > 1e-10) {
          var _slope = (_sxy - _pN * _pmx * _pmy) / _denom;
          var _intercept = _pmy - _slope * _pmx;
          // R² = 1 - SS_res / SS_tot
          var _ssRes = 0, _ssTot = 0;
          for (var _pi = 0; _pi < _pN; _pi++) {
            var _pred = _intercept + _slope * predActualPairs[_pi].predicted;
            _ssRes += (predActualPairs[_pi].actual - _pred) * (predActualPairs[_pi].actual - _pred);
            _ssTot += (predActualPairs[_pi].actual - _pmy) * (predActualPairs[_pi].actual - _pmy);
          }
          var _r2 = _ssTot > 0 ? Math.max(0, 1 - _ssRes / _ssTot) : 0;
          // Tracking Error (std of prediction errors)
          var _errSum = 0, _errSum2 = 0;
          for (var _pi = 0; _pi < _pN; _pi++) {
            var _err = predActualPairs[_pi].predicted - predActualPairs[_pi].actual;
            _errSum += _err; _errSum2 += _err * _err;
          }
          var _bias = _errSum / _pN;
          var _teVar = _errSum2 / _pN - _bias * _bias;
          var _te = Math.sqrt(Math.max(0, _teVar));

          mzRegression = {
            slope: +_slope.toFixed(3), intercept: +_intercept.toFixed(3),
            rSquared: +_r2.toFixed(3), bias: +_bias.toFixed(2), trackingError: +_te.toFixed(2),
            n: _pN,
          };
        }

        // Calibration: 예측구간 커버리지 (Gneiting & Raftery 2007)
        // [FIX] 이전 구현은 actual의 P5/P95를 actual 자신에 대해 검사 → 항상 ~90% (동어반복).
        // 수정: 시간순 전반부(training) 잔차 분포의 P5/P95로 후반부(test) 커버리지 측정.
        // 보정이 잘 된 모델이면 ~90%, 과적합이면 <80%, 과소적합이면 >95%.
        var _halfN = Math.floor(_pN / 2);
        if (_halfN >= 10) {
          var _trainResids = [];
          for (var _ri = 0; _ri < _halfN; _ri++) {
            _trainResids.push(predActualPairs[_ri].actual - predActualPairs[_ri].predicted);
          }
          _trainResids.sort(function(a, b) { return a - b; });
          var _trN = _trainResids.length;
          var _rp5Idx = Math.floor((_trN - 1) * 0.05);
          var _rp95Idx = Math.min(Math.ceil((_trN - 1) * 0.95), _trN - 1);
          var _resLo = _trainResids[_rp5Idx], _resHi = _trainResids[_rp95Idx];
          var _inRange = 0, _testN = _pN - _halfN;
          for (var _ci = _halfN; _ci < _pN; _ci++) {
            var _resid = predActualPairs[_ci].actual - predActualPairs[_ci].predicted;
            if (_resid >= _resLo && _resid <= _resHi) _inRange++;
          }
          calibrationCoverage = +(_inRange / _testN * 100).toFixed(1);
        }
      }

      const stats = {
        n,
        mean: +mean.toFixed(2),
        median: +median.toFixed(2),
        stdDev: +stdDev.toFixed(2),
        winRate: +winRate.toFixed(1),
        winRateCI: winRateCI,
        wrNull: wrNull,
        wrAlpha: wrAlpha,
        informationRatio,
        regimeWR,
        maxLoss: +maxLoss.toFixed(2),
        maxGain: +maxGain.toFixed(2),
        avgWin: +avgWin.toFixed(2),
        avgLoss: +avgLoss.toFixed(2),
        riskReward,
        medianMAE: +medianMAE.toFixed(2),
        mae5: +mae5.toFixed(2),
        medianMFE: +medianMFE.toFixed(2),
        mfe95: +mfe95.toFixed(2),
        maxDrawdown: +maxDD.toFixed(2),
        cvar5: +cvar5.toFixed(2),
        sortinoRatio,
        cohensH,
        expectancy: +expectancy.toFixed(2),
        profitFactor,
        kellyFraction,
        tStat: +tStat.toFixed(2),
        significant,
        hlzSignificant,
        mde,                // [Diagnostic] Minimum Detectable Effect (%) — Cohen (1988)
        adjustedSignificant: false, // Holm-Bonferroni 보정 후 backtestAll()에서 갱신
        sampleWarning,
        directionalAccuracy,
        targetHitRate,
        predictionMAE,
        patternScore,
        patternGrade,
        mzRegression,       // [Phase 3] Mincer-Zarnowitz 산점도 회귀 (slope, intercept, R², bias, TE)
        calibrationCoverage, // [Phase 3] 90% 예측구간 커버리지 (Gneiting & Raftery 2007)
        predActualPairs: predActualPairs.length >= 10 ? predActualPairs : null, // [Phase 2/3] 산점도용 (predicted, actual) 쌍
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
      // 5열 설계행렬: [intercept, confidence, trendStrength, lnVolRatio, atrNorm]
      // [Phase 7 C-1] wc 제거 (look-ahead bias: analyze(전체candles)의 hw/mw가 미래 반영)
      //               momentum60 제거 (parsimony: 7→5열 축소, 과적합 방지)
      if (returns.length >= 30 && typeof calcWLSRegression === 'function') {
        var X = [], weights = [];
        var lambda = 0.995; // [D] Heuristic — exponential decay half-life ~138 obs; no published optimal
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

        // Column-wise std normalization (j=0 intercept excluded)
        // [B][L:GS] Hoerl & Kennard (1970) require standardized features for uniform shrinkage.
        // Without this, atrNorm (scale ~0.02) receives ~278x stronger penalty than confidence (scale ~0.5).
        // Marquardt (1970): variance normalization is minimum requirement for Ridge.
        var scales = [1]; // intercept: no scaling
        for (var sj = 1; sj < 5; sj++) {
          var sSum = 0, sSum2 = 0;
          for (var si = 0; si < X.length; si++) { sSum += X[si][sj]; sSum2 += X[si][sj] * X[si][sj]; }
          var sMean = sSum / X.length;
          var sVar = sSum2 / X.length - sMean * sMean;
          var sSd = Math.sqrt(Math.max(0, sVar));
          if (sSd < 1e-10) sSd = 1; // constant feature guard
          scales.push(sSd);
          for (var si = 0; si < X.length; si++) X[si][sj] /= sSd;
        }

        // [C][L:GCV] Ridge λ auto-selected via GCV (Golub, Heath & Wahba 1979). Fallback λ=1.0.
        var optLambda = selectRidgeLambdaGCV(X, returns, weights, 5);
        var reg = calcWLSRegression(X, returns, weights, optLambda);

        // ── Huber-IRLS re-weighting (Huber 1964, Street, Carroll & Ruppert 1988) ──
        // KRX 5-day returns have excess kurtosis (fat tails from limit-up/down ±30%).
        // Standard WLS is not robust to outliers; IRLS down-weights |resid| > delta.
        // Delta = 1.345 * MAD-sigma ≈ 5.8 for KRX 5-day return distribution.
        if (reg && reg.coeffs) {
          var HUBER_DELTA = 5.8; // 1.345σ — Huber (1964) 95% efficiency; σ≈4.3 from KRX 5-day MAD
          var HUBER_ITERS = 5;  // [D] Heuristic — typically converges in 3-5 iterations (Street et al. 1988)
          for (var hIter = 0; hIter < HUBER_ITERS; hIter++) {
            var huberWeights = [];
            var changed = false;
            for (var ri = 0; ri < returns.length; ri++) {
              // Compute prediction in standardized space (X already scaled)
              var pred = 0;
              for (var hj = 0; hj < reg.coeffs.length; hj++) pred += X[ri][hj] * reg.coeffs[hj];
              var resid = returns[ri] - pred;
              var absR = Math.abs(resid);
              var hw = absR > HUBER_DELTA ? HUBER_DELTA / absR : 1.0;
              huberWeights.push(hw * weights[ri]);
              if (absR > HUBER_DELTA) changed = true;
            }
            if (!changed) break; // All residuals within delta — converged
            // Re-fit WLS with Huber-adjusted weights
            var huberReg = calcWLSRegression(X, returns, huberWeights, optLambda);
            if (!huberReg || !huberReg.coeffs) break;
            reg = huberReg;
          }
        }

        if (reg) {
          // Reverse-transform coefficients to original scale (Friedman, Hastie & Tibshirani 2010)
          for (var rj = 1; rj < reg.coeffs.length; rj++) {
            reg.coeffs[rj] /= scales[rj];
          }

          stats.regression = {
            labels: ['intercept', 'confidence', 'trendStrength', 'lnVolumeRatio', 'atrNorm'],
            coeffs: reg.coeffs.map(function(c) { return +c.toFixed(6); }),
            rSquared: +reg.rSquared.toFixed(4),
            adjR2: +(reg.adjR2 != null ? reg.adjR2 : reg.rSquared).toFixed(4), // [Diagnostic] Theil (1961), overfitting guard
            // HC3 heteroskedasticity-robust tStats (White 1980, MacKinnon & White 1985)
            // OLS tStats may be inconsistent under financial return heteroskedasticity.
            // HC3 with (1-h_ii)^2 jackknife correction is optimal for n=30-300 (Long & Ervin 2000).
            tStats: reg.hcTStats.map(function(t) { return +t.toFixed(2); }),
            vifs: reg.vifs || [],    // [Diagnostic] VIF per feature — Marquardt (1970), flag > 5
          };

          // 최근 패턴에 대한 기대수익률 예측
          if (validOccs.length > 0) {
            var latest = validOccs[validOccs.length - 1];
            // Prediction uses original-scale features × reverse-transformed coefficients
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
            // Significance gate: only apply LinUCB if t_stat_delta >= 2.0 in training summary.
            // Current result: t_stat_delta=-0.1518 (NOT SIGNIFICANT) → Ridge-only mode active.
            // _buildRLContext() is expensive — skip entirely when Ridge-only.
            if (this._rlPolicy) {
              var deltaT = this._rlPolicy.training_summary ? this._rlPolicy.training_summary.t_stat_delta : null;
              if (deltaT != null && deltaT >= 2.0) {
                // LinUCB path (expensive): build context and apply bandit adjustment
                var rlCtx = this._buildRLContext(predicted, patternSignal, patternType, latest, candles);
                var rlResult = this._applyLinUCBGreedy(rlCtx);
                // [H-20] Safety clamp: |factor| <= 3.0 prevents extreme adjustments
                var MAX_FACTOR = 3.0;
                var clampedFactor = Math.max(-MAX_FACTOR, Math.min(MAX_FACTOR, rlResult.factor));
                stats.expectedReturn = +(predicted * clampedFactor).toFixed(2);
                stats.rlAction = rlResult.action;
                stats.rlFactor = clampedFactor;
                predicted = stats.expectedReturn;
              }
              // else: Ridge-only, no context build needed (performance optimization)
            }

            // 95% 신뢰구간: SE = sqrt(sigma^2 * (1 + x' (X'WX)^-1 x))
            // invXtWX is in standardized space; transform xNew to match
            var xStd = [xNew[0]]; // intercept unchanged
            for (var si = 1; si < xNew.length; si++) xStd.push(xNew[si] / scales[si]);
            var xInvx = 0;
            for (var ii = 0; ii < xStd.length; ii++) {
              for (var jj = 0; jj < xStd.length; jj++) {
                xInvx += xStd[ii] * reg.invXtWX[ii][jj] * xStd[jj];
              }
            }
            var se = Math.sqrt(reg.sigmaHat2 * (1 + xInvx));
            // [FIX-7] Fat-tail 보정 Cornish-Fisher 임계값 (95% CI, 양측)
            // Cont (2001): 금융 수익률 초과 첨도 → 유효 df 축소
            var tCrit = this._tCritFatTail(reg.df, returns, 0.05);
            stats.ci95Lower = +(predicted - tCrit * se).toFixed(2);
            stats.ci95Upper = +(predicted + tCrit * se).toFixed(2);
          }

          // ── Spearman Rank IC — Grinold & Kahn (2000) ──
          // [STAT-A] Rolling OOS IC replaces in-sample IC.
          // In-sample IC inflates predictive ability (Lo 2002).
          // Rolling OOS: non-overlapping 12-pair windows, each unseen by model.
          // Falls back to full-sample IC (flagged isOOS=false) when n < 24.
          // IC > 0.05 operationally significant, > 0.10 strong (Qian, Hua & Sorensen 2007).
          if (validOccs.length >= 10) {
            var icPairs = [];
            for (var icIdx = 0; icIdx < validOccs.length; icIdx++) {
              var icOcc = validOccs[icIdx];
              var icX = [
                1,
                (icOcc.confidencePred || icOcc.confidence || 50) / 100,
                icOcc.trendStrength || 0,
                Math.log(Math.max(icOcc.volumeRatio || 1, 0.1)),
                icOcc.atrNorm || 0.02,
              ];
              var icPred = 0;
              for (var icJ = 0; icJ < icX.length; icJ++) icPred += icX[icJ] * reg.coeffs[icJ];
              icPairs.push([icPred, returns[icIdx]]);
            }
            var oosResult = this._rollingOOSIC(icPairs, 12);
            if (oosResult.ic != null) {
              stats.ic = oosResult.ic;
              stats.icIsOOS = oosResult.isOOS;
              stats.icWindows = oosResult.nWindows;
              // ICIR = IC / std(IC_per_fold) — jackknife SE estimation
              // Jackknife: leave-one-out Spearman on full pairs for variance
              if (icPairs.length >= 20) {
                var jackICs = [];
                for (var jk = 0; jk < icPairs.length; jk++) {
                  var jkPairs = icPairs.slice(0, jk).concat(icPairs.slice(jk + 1));
                  var jkIC = this._spearmanCorr(jkPairs);
                  if (jkIC != null) jackICs.push(jkIC);
                }
                if (jackICs.length >= 10) {
                  var jkSum = 0;
                  for (var jki = 0; jki < jackICs.length; jki++) jkSum += jackICs[jki];
                  var jkMean = jkSum / jackICs.length;
                  var jkVar = 0;
                  for (var jki = 0; jki < jackICs.length; jki++) jkVar += (jackICs[jki] - jkMean) * (jackICs[jki] - jkMean);
                  var icStdDev = Math.sqrt(jkVar / (jackICs.length - 1));
                  stats.icir = icStdDev > 1e-6 ? +(oosResult.ic / icStdDev).toFixed(3) : null;
                } else {
                  stats.icir = null;
                }
              } else {
                stats.icir = null;
              }
            }
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
      n: 0, mean: 0, median: 0, stdDev: 0, winRate: 0, winRateCI: null, wrNull: 50, wrAlpha: 0,
      informationRatio: null, regimeWR: null,
      maxLoss: 0, maxGain: 0, avgWin: 0, avgLoss: 0,
      riskReward: 0, medianMAE: 0, mae5: 0, medianMFE: 0, mfe95: 0,
      maxDrawdown: 0, cvar5: 0,
      sortinoRatio: null, cohensH: 0,
      expectancy: 0, profitFactor: 0, kellyFraction: 0,
      tStat: 0, significant: false, hlzSignificant: false, mde: null, adjustedSignificant: false,
      sampleWarning: 'insufficient',
      directionalAccuracy: 0, targetHitRate: null, predictionMAE: null,
      patternScore: 0, patternGrade: 'F',
      mzRegression: null, calibrationCoverage: null, predActualPairs: null,
      ic: null, icir: null, icIsOOS: false, icWindows: 0,
    };
  }

  /**
   * [Expert Consensus] 시장 드리프트 감안 Null WR — Sullivan, Timmermann & White (1999)
   * 패턴 무관 무작위 진입 시 h-day 수익률 양수 비율 (buy null) 및 음수 비율 (sell null)
   * @param {Array} candles — 전체 캔들 배열
   * @param {number} h — horizon (일)
   * @returns {{ buyNull: number, sellNull: number, totalObs: number }}
   */
  _computeNullWR(candles, h) {
    // [M-5 FIX] Round lastClose to integer — KRX prices are integer KRW.
    // Raw float can cause cache misses due to floating-point precision differences.
    var lastClose = candles.length > 0 ? Math.round(candles[candles.length - 1].close) : 0;
    var cacheKey = candles.length + '_' + h + '_' + lastClose;
    if (!this._nullWRCache) this._nullWRCache = {};
    if (this._nullWRCache[cacheKey]) return this._nullWRCache[cacheKey];

    var buyWins = 0, sellWins = 0, total = 0;
    var cost = this._horizonCost(h);
    for (var i = 0; i < candles.length - h - 1; i++) {
      var entryPrice = candles[i + 1].open || candles[i].close;
      if (!entryPrice || entryPrice === 0) continue;
      var exitPrice = candles[i + h].close;
      var ret = (exitPrice - entryPrice) / entryPrice * 100 - cost;
      if (ret > 0) buyWins++;
      if (ret < 0) sellWins++;
      total++;
    }

    var result;
    if (total === 0) {
      result = { buyNull: 50, sellNull: 50, totalObs: 0 };
    } else {
      result = {
        buyNull: +(buyWins / total * 100).toFixed(1),
        sellNull: +(sellWins / total * 100).toFixed(1),
        totalObs: total
      };
    }
    this._nullWRCache[cacheKey] = result;
    return result;
  }

  /**
   * [H-2 FIX] Unconditional h-day mean return — independent benchmark for IR.
   * Grinold & Kahn (2000): benchmark must be independent of the strategy being evaluated.
   * Computes the mean h-day return across all candle windows (the "random entry" baseline).
   * Cached alongside _computeNullWR for efficiency.
   * @param {Array} candles — OHLCV candles
   * @param {number} h — horizon
   * @returns {number} — mean h-day return (%) after transaction costs
   */
  _computeNullMeanReturn(candles, h) {
    var lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;
    var cacheKey = candles.length + '_' + h + '_' + Math.round(lastClose) + '_mean';
    if (!this._nullMeanCache) this._nullMeanCache = {};
    if (this._nullMeanCache[cacheKey] !== undefined) return this._nullMeanCache[cacheKey];

    var sum = 0, total = 0;
    var cost = this._horizonCost(h);
    for (var i = 0; i < candles.length - h - 1; i++) {
      var entryPrice = candles[i + 1].open || candles[i].close;
      if (!entryPrice || entryPrice === 0) continue;
      var exitPrice = candles[i + h].close;
      var ret = (exitPrice - entryPrice) / entryPrice * 100 - cost;
      sum += ret;
      total++;
    }

    var result = total > 0 ? sum / total : 0;
    this._nullMeanCache[cacheKey] = result;
    return result;
  }

  /**
   * [Expert Consensus] Regime-Conditioned WR — Lo (2004) AMH
   * Split win rate by Hurst weight regime, n>=30 guard
   * @param {Array} candles — OHLCV candles
   * @param {Array} occurrences — valid occurrences with idx
   * @param {number} h — horizon
   * @param {string} patternSignal — 'buy'/'sell'/'neutral'
   * @returns {Object|null} { trending, reverting, neutral } each { wr, n } or null
   */
  _computeRegimeWR(candles, occurrences, h, patternSignal) {
    if (!occurrences || occurrences.length < 30) return null; // CLT minimum for regime-split subgroups
    var cost = this._horizonCost(h);
    var buckets = { trending: { wins: 0, n: 0 }, reverting: { wins: 0, n: 0 }, neutral: { wins: 0, n: 0 } };

    for (var i = 0; i < occurrences.length; i++) {
      var occ = occurrences[i];
      var exitIdx = occ.idx + h;
      if (exitIdx >= candles.length) continue;
      var entryIdx = occ.idx + 1;
      if (entryIdx >= candles.length) continue;
      var entryPrice = candles[entryIdx].open || candles[occ.idx].close;
      if (!entryPrice || entryPrice === 0) continue;
      var exitPrice = candles[exitIdx].close;
      var ret = (exitPrice - entryPrice) / entryPrice * 100 - cost;

      // Classify regime by hw stored on occurrence
      // [D] Heuristic — hw boundaries (1.1/0.9) are ±10% from neutral (1.0); no published source
      var hw = occ.hw || 1.0;
      var bucket = hw > 1.1 ? 'trending' : hw < 0.9 ? 'reverting' : 'neutral';
      buckets[bucket].n++;
      if ((patternSignal === 'buy' && ret > 0) || (patternSignal === 'sell' && ret < 0) || (patternSignal === 'neutral' && ret > 0)) {
        buckets[bucket].wins++;
      }
    }

    var result = {};
    for (var key in buckets) {
      if (buckets[key].n >= 30) {
        result[key] = { wr: +(buckets[key].wins / buckets[key].n * 100).toFixed(1), n: buckets[key].n };
      } else {
        result[key] = null;  // n<30 guard
      }
    }
    return result;
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

        const ret = (candles[exitIdx].close - entryPrice) / entryPrice * 100 - this._horizonCost(d); // [Phase0-E] horizon-scaled 거래비용
        returns.push(ret);
      }

      if (returns.length === 0) {
        curve.push({ day: d, mean: 0, upper: 0, lower: 0, sampleCount: 0 });
        continue;
      }

      const n = returns.length;
      const mean = returns.reduce((a, b) => a + b, 0) / n;
      // Sample variance (÷(n-1), Bessel correction) — distinct from BB's population σ
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
    this._nullWRCache = null;
    this._nullMeanCache = null;
    this._resultCache.clear();
    this._signalAnalysisCache = null;
  }


  // ══════════════════════════════════════════════════════
  //  7. 시그널 백테스팅
  // ══════════════════════════════════════════════════════

  /**
   * signalEngine.analyze()를 전체 캔들에 한 번 실행하여
   * 모든 시그널 타입의 발생 이력을 인덱스별로 수집하고 캐시한다.
   *
   * 캐시 키: 캔들 수 + 마지막 캔들 time (candle 변경 시 자동 무효화)
   *
   * @param {Array} candles — OHLCV 배열
   * @param {string} signalType — 조회할 시그널 타입 (또는 '__init__' for 캐시 초기화만)
   * @returns {Object[]} — 해당 시그널 타입의 발생 이력 배열
   */
  _collectSignalOccurrences(candles, signalType) {
    var lastTime = candles.length > 0 ? (candles[candles.length - 1].time || '') : '';
    var cacheKey = candles.length + '_' + lastTime;

    if (!this._signalAnalysisCache || this._signalAnalysisCache.key !== cacheKey) {
      // ATR 캐시 재사용 (패턴 백테스트가 선행된 경우 이미 존재)
      if (!this._atrCache || this._atrCache._candles !== candles) {
        this._atrCache = {
          _candles: candles,
          atr: (typeof calcATR === 'function') ? calcATR(candles, 14) : null,
        };
      }
      // VMA 캐시 재사용
      if (!this._vmaCache || this._vmaCache._candles !== candles) {
        var volumes = candles.map(function(c) { return c.volume || 0; });
        this._vmaCache = {
          _candles: candles,
          vma: (typeof calcMA === 'function') ? calcMA(volumes, 20) : null,
        };
      }

      // patternEngine.analyze() — 복합 시그널 매칭에 필요
      // _analyzeCache 재사용: 패턴 백테스트가 선행된 경우 중복 실행 방지
      var patterns = [];
      if (this._analyzeCache && this._analyzeCache._candles === candles) {
        patterns = this._analyzeCache.patterns || [];
      } else if (typeof patternEngine !== 'undefined') {
        patterns = patternEngine.analyze(candles) || [];
        this._analyzeCache = { _candles: candles, patterns: patterns };
      }

      // signalEngine.analyze() 한 번 실행 — IndicatorCache 내부 생성
      var sigResult = { signals: [], cache: null, stats: {} };
      if (typeof signalEngine !== 'undefined') {
        sigResult = signalEngine.analyze(candles, patterns) || sigResult;
      }

      var atr = this._atrCache.atr;
      var vma = this._vmaCache.vma;

      // 모든 시그널을 타입별로 인덱싱
      // individual: s.type (e.g. 'goldenCross')
      // composite: s.compositeId (e.g. 'buy_goldenCrossRsi'), s.type === 'composite'
      var signalMap = {};
      var allSignals = sigResult.signals || [];

      for (var i = 0; i < allSignals.length; i++) {
        var s = allSignals[i];
        var idx = s.index;
        if (idx === undefined || idx === null) continue;

        // 타입 결정: 복합 시그널은 compositeId, 개별 시그널은 type
        var sType = (s.type === 'composite' && s.compositeId) ? s.compositeId : s.type;
        if (!sType) continue;

        if (!signalMap[sType]) signalMap[sType] = [];

        // volumeRatio, atrNorm: WLS 회귀 특성값
        var volumeRatio = 1;
        if (vma && vma[idx] && vma[idx] > 0 && candles[idx] && candles[idx].volume) {
          volumeRatio = candles[idx].volume / vma[idx];
        }
        var atrNorm = 0.02;
        if (atr && atr[idx] && candles[idx] && candles[idx].close > 0) {
          atrNorm = atr[idx] / candles[idx].close;
        }

        // _computeStats 호환 발생 이력 객체
        // hw=1: 시그널은 Hurst 가중치 없음 → _computeRegimeWR에서 'neutral' 버킷
        signalMap[sType].push({
          idx: idx,
          confidence: s.confidence || 50,
          confidencePred: s.confidencePred || s.confidence || 50,
          trendStrength: 0,      // 시그널은 추세 강도 미측정 (WLS 절편 흡수)
          volumeRatio: volumeRatio,
          atrNorm: atrNorm,
          hw: 1.0,               // Hurst 가중치 없음 (신호 자체가 레짐 지표)
        });
      }

      this._signalAnalysisCache = { key: cacheKey, map: signalMap };
    }

    if (signalType === '__init__') return [];
    return this._signalAnalysisCache.map[signalType] || [];
  }

  /**
   * 특정 시그널 타입의 과거 발생 이력에서 N일 후 수익률 통계 계산
   *
   * 패턴 백테스트와 동일한 _computeStats() 엔진을 재사용한다.
   * 결과 포맷은 backtest()와 동일 (38 stats per horizon).
   *
   * @param {Array} candles — OHLCV 배열
   * @param {string} signalType — 시그널 타입 문자열
   * @param {Object} [options] — { horizons: [1,3,5,10,20] }
   * @returns {{ signalType, name, signal, sampleSize, horizons: Object }}
   */
  backtestSignal(candles, signalType, options) {
    if (!candles || candles.length < 50) {
      return { signalType: signalType, name: signalType, signal: 'neutral', sampleSize: 0, horizons: {} };
    }
    var horizons = (options && options.horizons) ? options.horizons : this.HORIZONS;

    var occs = this._collectSignalOccurrences(candles, signalType);
    if (!occs || occs.length === 0) {
      return { signalType: signalType, name: signalType, signal: 'neutral', sampleSize: 0, horizons: {} };
    }

    var sigDir = this._resolveSignalDirection(signalType);
    var horizonStats = this._computeStats(candles, occs, horizons, sigDir, signalType);

    return {
      signalType: signalType,
      name: signalType,
      signal: sigDir,
      sampleSize: occs.length,
      horizons: horizonStats,
    };
  }

  /**
   * 시그널 타입 → 방향('buy'/'sell'/'neutral') 조회
   * COMPOSITE_SIGNAL_DEFS 및 알려진 개별 시그널 맵에서 조회.
   * 알 수 없으면 이름 패턴에서 추론.
   *
   * @param {string} signalType
   * @returns {string} 'buy' | 'sell' | 'neutral'
   */
  _resolveSignalDirection(signalType) {
    // 1. COMPOSITE_SIGNAL_DEFS에서 조회 (정의가 전역 변수로 존재하는 경우)
    if (typeof COMPOSITE_SIGNAL_DEFS !== 'undefined') {
      for (var di = 0; di < COMPOSITE_SIGNAL_DEFS.length; di++) {
        if (COMPOSITE_SIGNAL_DEFS[di].id === signalType) {
          return COMPOSITE_SIGNAL_DEFS[di].signal || 'neutral';
        }
      }
    }

    // 2. 알려진 개별 시그널 방향 맵 (signalEngine._weights 기준)
    var KNOWN_DIR = {
      goldenCross: 'buy',          deadCross: 'sell',
      maAlignment_bull: 'buy',     maAlignment_bear: 'sell',
      macdBullishCross: 'buy',     macdBearishCross: 'sell',
      macdBullishDivergence: 'buy', macdBearishDivergence: 'sell',
      macdHiddenBullishDivergence: 'buy', macdHiddenBearishDivergence: 'sell',
      rsiOversold: 'buy',          rsiOverbought: 'sell',
      rsiOversoldExit: 'buy',      rsiOverboughtExit: 'sell',
      rsiBullishDivergence: 'buy', rsiBearishDivergence: 'sell',
      rsiHiddenBullishDivergence: 'buy', rsiHiddenBearishDivergence: 'sell',
      bbLowerBounce: 'buy',        bbUpperBreak: 'neutral',  // [M-6 fix] signalEngine emits 'neutral' (weight 0) — match here
      bbSqueeze: 'neutral',
      ichimokuBullishCross: 'buy', ichimokuBearishCross: 'sell',
      ichimokuCloudBreakout: 'buy', ichimokuCloudBreakdown: 'sell',
      stochRsiOversold: 'buy',     stochRsiOverbought: 'sell',
      stochasticOversold: 'buy',   stochasticOverbought: 'sell',
      hurstTrending: 'neutral',    hurstMeanReverting: 'neutral',
      kalmanUpturn: 'buy',         kalmanDownturn: 'sell',
      volumeBreakout: 'buy',       volumeSelloff: 'sell',
      volumeExhaustion: 'neutral',
      obvBullishDivergence: 'buy', obvBearishDivergence: 'sell',
    };
    if (KNOWN_DIR[signalType]) return KNOWN_DIR[signalType];

    // 3. 이름 패턴에서 추론 (알 수 없는 복합 시그널)
    var lc = signalType.toLowerCase();
    if (lc.indexOf('buy') !== -1 || lc.indexOf('bull') !== -1 || lc.indexOf('golden') !== -1) return 'buy';
    if (lc.indexOf('sell') !== -1 || lc.indexOf('bear') !== -1 || lc.indexOf('dead') !== -1) return 'sell';
    return 'neutral';
  }

  /**
   * 전체 시그널 타입 일괄 백테스트
   * + BH-FDR 다중비교 보정 (_applyBHFDR 재사용)
   * + Reliability Tier 분류 (신호는 패턴보다 완화된 기준 적용)
   *
   * 성능: signalEngine.analyze() 1회 (~10-20ms) + _computeStats() ~25회 (~2-5ms each)
   * 합계: ~60-125ms. 3초 Worker 스로틀 내 완납 가능.
   *
   * @param {Array} candles — OHLCV 배열
   * @returns {{ [signalType]: backtestSignalResult }}
   */
  backtestAllSignals(candles) {
    if (!candles || candles.length < 50) return {};

    // signalEngine 분석 실행 및 캐시 워밍
    this._collectSignalOccurrences(candles, '__init__');
    if (!this._signalAnalysisCache || !this._signalAnalysisCache.map) return {};

    var signalMap = this._signalAnalysisCache.map;

    // 백테스트 대상: 핵심 개별 16개 (높은 발화 빈도 + 학문적 근거)
    var BACKTEST_SIGNALS = [
      'goldenCross', 'deadCross',
      'macdBullishCross', 'macdBearishCross',
      'rsiOversoldExit', 'rsiOverboughtExit',
      'bbLowerBounce', 'bbSqueeze',
      'volumeBreakout', 'volumeSelloff',
      'ichimokuBullishCross', 'ichimokuBearishCross',
      'ichimokuCloudBreakout', 'ichimokuCloudBreakdown',
      'stochasticOversold', 'stochasticOverbought',
    ];

    // 발견된 복합 시그널 자동 추가 (buy_* / sell_* / strong* 접두어)
    for (var sType in signalMap) {
      if (BACKTEST_SIGNALS.indexOf(sType) === -1) {
        if (sType.indexOf('buy_') === 0 || sType.indexOf('sell_') === 0 ||
            sType.indexOf('strong') === 0) {
          BACKTEST_SIGNALS.push(sType);
        }
      }
    }

    var results = {};

    for (var i = 0; i < BACKTEST_SIGNALS.length; i++) {
      var st = BACKTEST_SIGNALS[i];
      var occs = signalMap[st];
      if (!occs || occs.length < 5) continue;  // 최소 5회 발생 (신호 빈도 고려)

      var sigDir = this._resolveSignalDirection(st);
      var horizonStats = this._computeStats(candles, occs, this.HORIZONS, sigDir, st);

      results[st] = {
        signalType: st,
        name: st,
        signal: sigDir,
        sampleSize: occs.length,
        horizons: horizonStats,
      };
    }

    // BH-FDR 다중비교 보정 (패턴 백테스트와 동일 엔진)
    this._applyBHFDR(results);

    // Reliability Tier — 신호는 패턴보다 완화된 기준 (n<100 현실 반영)
    for (var tierKey in results) {
      var tr = results[tierKey];
      if (!tr || !tr.horizons) { tr.reliabilityTier = 'D'; continue; }
      var h5 = tr.horizons[5];
      if (!h5 || h5.n < 5) { tr.reliabilityTier = 'D'; continue; }

      var isAdjSig = h5.adjustedSignificant;
      var isSig = h5.significant;
      var alpha = h5.wrAlpha || 0;
      var nSample = h5.n;
      var exp = h5.expectancy || 0;
      var pf = h5.profitFactor || 0;

      // [STAT-B] OOS IC gate for signal tier — same logic as pattern tier
      // IC=null passes (IC requires n>=10, signals often have smaller samples)
      var h5ic = h5.ic;
      var icPassA = (h5ic == null || h5ic > 0.02);
      var icPassB = (h5ic == null || h5ic > 0.01);

      // [D] Heuristic — signal reliability tier thresholds are relaxed vs pattern tiers
      // (smaller samples, shorter lookback). Cutoffs are practitioner-designed.
      // [M-2 FIX] Tier A: add profitFactor >= 1.1 gate (pattern tier A uses >= 1.3).
      // Signal tier uses lower threshold since signals have smaller samples & shorter lookback.
      // Ensures tier A requires demonstrable edge, not just statistical significance.
      if (isAdjSig && alpha >= 3 && nSample >= 50 && exp > 0 && pf >= 1.1 && icPassA) {
        tr.reliabilityTier = 'A';
      // [STAT-A] Tier B: BH-FDR gate (consistent with pattern tier)
      // Signal tier also requires adjusted significance for B — multiple
      // signal types tested creates same FDR exposure as pattern scanning.
      } else if (isAdjSig && alpha >= 2 && nSample >= 20 && exp > 0 && icPassB) {
        tr.reliabilityTier = 'B';
      // Tier C: wrAlpha>0 + n>=20
      } else if (alpha > 0 && nSample >= 20) {
        tr.reliabilityTier = 'C';
      } else {
        tr.reliabilityTier = 'D';
      }
    }

    return results;
  }
}


// ── 전역 인스턴스 ─────────────────────────────────────
const backtester = new PatternBacktester();
