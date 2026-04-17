// ══════════════════════════════════════════════════════
//  KRX LIVE — App Worker (Worker 통신 + 분석 파이프라인)
//
//  Web Worker 초기화, 매크로/파생 데이터 로드,
//  패턴/시그널 신뢰도 조정, 메인 스레드 폴백 분석.
//  appState.js 전역 변수 참조.
// ══════════════════════════════════════════════════════

// ── 파이프라인 로더 TTL (5분 — 중복 fetch 방지) ──
var _PIPELINE_LOAD_TTL = 5 * 60 * 1000; // 5 minutes
var _lastMarketDataLoad = 0;
var _lastDerivativesDataLoad = 0;
var _lastPhase8DataLoad = 0;

// ── [Item 21] 데이터 경과(staleness) 추적 ──
// [V47-B1] >14일 경과 소스 → 관련 신뢰도 조정 로직 자동 skip (승수 1.0 클램프).
// _checkDataStaleness() 14일 초과 시 등록. _applyMacroConfidenceToPatterns,
// _applyPhase8ConfidenceToPatterns의 macro_latest/bonds_latest/flow_signals/
// options_analytics 관련 블록이 _staleDataSources.has(name)로 스킵.
var _staleDataSources = new Set();
var _stalenessLoadersComplete = 0;  // 3개 로더 완료 카운트
var _stalenessChecked = false;       // 1회만 실행

// ── [Item 22] fetch 실패 토스트 중복 방지 (세션당 1회) ──
var _fetchFailToasts = new Set();

// ══════════════════════════════════════════════════════
// [V22-B Phase 3-Step 4] Factor Independence Guard
//
// 9-Layer confidence cascade에서 동일 데이터 소스(VIX, credit, taylor_gap,
// MCS, HMM, usdkrw, foreignMomentum, options IV 등)의 이중 승수화를
// 런타임에 차단하는 literal de-duplication Set.
//
// 10 keys (경제적 개념 단위, 변수명 단위 아님):
//   RISK_VOL_EQUITY           - VIX / VKOSPI / _marketContext.vkospi
//   RISK_CREDIT               - aa_spread / credit_regime / us_hy_spread
//   MACRO_TAYLOR_GAP          - taylor_gap (Factor 7 + Factor 10 공유)
//   MACRO_COMPOSITE           - mcs (0-1) / mcsV2 (0-100) 통합
//   REGIME_HMM                - hmmRegimeLabel / hmm_regimes.json
//   RISK_FX                   - usdkrw
//   RISK_LIQUIDITY            - Amihud ILLIQ / HHI (Micro layer)
//   FLOW_FOREIGN              - foreignMomentum / investor alignment
//   FLOW_OPTIONS              - atmIV / IV/HV ratio / straddleImpliedMove
//   CREDIT_DISTANCE_DEFAULT   - Merton DD (Bharath-Shumway)
//
// 전문가 권고 (statistical-validation-expert, Phase 2): literal dedup은
// necessary but insufficient (VIX/credit/FX가 latent 'risk' factor에
// ρ≈0.6-0.85 공동 적재). Tier-2 PCA budget 접근은 V23으로 연기.
//
// 사용법: 진입점에서 _appliedFactors.clear() → 각 _apply* 함수 내부에서
//   if (!_appliedFactors.has('KEY')) { ...apply...; }
//   → layer 종료 후 _markFactorsAfterLayer() helper로 add 처리
// ══════════════════════════════════════════════════════
var _appliedFactors = new Set();

// [V22-B Phase 3-Step 5] Main-thread vol regime cache
// 각 분석 진입점에서 classifyVolRegime(calcATR(candles, 14))를 호출하여 세팅.
// Phase 8/Macro의 cap 지점에서 getDynamicCap(target, _currentVolRegime) 호출용.
var _currentVolRegime = 'mid';

// [V38 CONF-M2] EVA Spread 기반 매수 패턴 신뢰도 부스트 데이터
// Stern Stewart (1991): EVA = NOPAT - WACC × IC. evaSpread > 0 → 가치 창출 기업.
var _evaScoresData = null;

/**
 * [V22-B] RORO layer 완료 후 팩터 add 처리.
 * RORO가 neutral이 아닌 경우에만 각 데이터 소스의 factor key를 등록하여
 * 이후 Macro/Phase 8 layer가 동일 소스를 재사용하지 않게 한다.
 */
function _markFactorsAfterRORO() {
  if (typeof _currentRORORegime === 'undefined' || _currentRORORegime === 'neutral') return;
  if (typeof _macroLatest !== 'undefined' && _macroLatest &&
      (_macroLatest.vkospi != null || _macroLatest.vix != null)) {
    _appliedFactors.add('RISK_VOL_EQUITY');
  }
  if (typeof _bondsLatest !== 'undefined' && _bondsLatest &&
      _bondsLatest.credit_spreads && _bondsLatest.credit_spreads.aa_spread != null) {
    _appliedFactors.add('RISK_CREDIT');
  }
  if (typeof _macroLatest !== 'undefined' && _macroLatest && _macroLatest.usdkrw != null) {
    _appliedFactors.add('RISK_FX');
  }
  if (typeof _investorData !== 'undefined' && _investorData && _investorData.alignment != null) {
    _appliedFactors.add('FLOW_FOREIGN');
  }
}

/**
 * [V22-B] Macro layer 완료 후 팩터 add 처리.
 * Macro가 MCS/taylor_gap를 실제로 적용했을 때 Phase 8이 동일 소스를 재사용하지 않게 한다.
 * (credit/vix는 RORO에서 이미 처리되거나 Macro 내부 has() guard로 스킵됨.)
 *
 * [AUDIT-FIX] mcsV2 우선 정책: _macroComposite.mcsV2(8-component composite)가
 * 존재하면 L2의 단순 mcs(0-1)는 양보하고 Phase 8의 mcsV2가 MACRO_COMPOSITE를 차지.
 * mcsV2가 없을 때만 L2 mcs가 fallback으로 등록.
 */
function _markFactorsAfterMacro() {
  if (typeof _macroLatest === 'undefined' || !_macroLatest) return;
  // mcsV2가 있으면 Phase 8에서 처리하므로 여기서 등록하지 않음
  if (_macroLatest.mcs != null && !(_macroComposite && _macroComposite.mcsV2 != null)) {
    _appliedFactors.add('MACRO_COMPOSITE');
  }
  if (_macroLatest.taylor_gap != null) _appliedFactors.add('MACRO_TAYLOR_GAP');
}

// ══════════════════════════════════════════════════════
// [V23] PCA Effect Budget — correlated factor 누적 승수 총량 제어
//
// 문제: VIX/credit/FX가 동시 발동 시 latent factor 공유(ρ≈0.6-0.85)로 과도한 cascading.
// 해법: Kish (1965) N_eff + Longin & Solnik (2001) 비대칭 cap.
// avg_|ρ| 계산은 _appliedFactors에서 실제 fired된 subset만 사용.
// ══════════════════════════════════════════════════════

// KRX 2018-2024 blended crisis/normal 실증 상관계수 (|ρ|)
var _FACTOR_CORR = {
  RISK_VOL_EQUITY: { RISK_CREDIT: 0.72, RISK_FX: 0.65, FLOW_FOREIGN: 0.45 },
  RISK_CREDIT:     { RISK_VOL_EQUITY: 0.72, RISK_FX: 0.58, FLOW_FOREIGN: 0.38 },
  RISK_FX:         { RISK_VOL_EQUITY: 0.65, RISK_CREDIT: 0.58, FLOW_FOREIGN: 0.52 },
  FLOW_FOREIGN:    { RISK_VOL_EQUITY: 0.45, RISK_CREDIT: 0.38, RISK_FX: 0.52 }
};
var _CORRELATED_FACTORS = ['RISK_VOL_EQUITY', 'RISK_CREDIT', 'RISK_FX', 'FLOW_FOREIGN'];
var _BUDGET_DOWN = 0.10;  // per-factor log budget (downside — crisis clustering)
var _BUDGET_UP   = 0.12;  // per-factor log budget (upside — recovery heterogeneous)

function _applyPCABudgetCap(patterns) {
  // 1. fired correlated factors 추출
  var fired = [];
  for (var fi = 0; fi < _CORRELATED_FACTORS.length; fi++) {
    if (_appliedFactors.has(_CORRELATED_FACTORS[fi])) fired.push(_CORRELATED_FACTORS[fi]);
  }
  if (fired.length <= 1) {
    // cleanup _confBefore
    for (var ci = 0; ci < patterns.length; ci++) delete patterns[ci]._confBefore;
    return;
  }

  // 2. avg |ρ| over fired subset (pairwise)
  var sumRho = 0, pairs = 0;
  for (var i = 0; i < fired.length; i++) {
    for (var j = i + 1; j < fired.length; j++) {
      var r = _FACTOR_CORR[fired[i]] && _FACTOR_CORR[fired[i]][fired[j]];
      if (r != null) { sumRho += r; pairs++; }
    }
  }
  var avgRho = pairs > 0 ? sumRho / pairs : 0;

  // 3. N_eff (Kish 1965 equicorrelation)
  var nEff = fired.length / (1 + (fired.length - 1) * avgRho);

  // 4. asymmetric budget (Longin & Solnik 2001)
  var budgetDown = _BUDGET_DOWN * Math.sqrt(nEff);
  var budgetUp   = _BUDGET_UP   * Math.sqrt(nEff);

  // 5. cap cumulative log-adjustment
  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    if (p._confBefore == null || p.confidence == null || p._confBefore <= 0) {
      delete p._confBefore;
      continue;
    }
    var logAdj = Math.log(p.confidence / p._confBefore);
    if (logAdj === 0) { delete p._confBefore; continue; }

    var capped = logAdj < 0
      ? Math.max(logAdj, -budgetDown)
      : Math.min(logAdj, budgetUp);

    if (capped !== logAdj) {
      p.confidence = Math.round(p._confBefore * Math.exp(capped));
    }
    delete p._confBefore;
  }
}

// ══════════════════════════════════════════════════════
//  Web Worker 초기화 (Phase 9)
//
//  패턴 분석 + 시그널 분석 + 백테스트를 별도 스레드에서 수행.
//  Worker 지원 불가 또는 로드 실패 시 메인 스레드 동기 폴백.
// ══════════════════════════════════════════════════════

function _initAnalysisWorker() {
  if (typeof Worker === 'undefined') {
    console.log('[Worker] Web Worker 미지원 — 메인 스레드 폴백');
    return;
  }

  try {
    _analysisWorker = new Worker('js/analysisWorker.js?v=66');

    _analysisWorker.onmessage = async function (e) {
      const msg = e.data;

      // ── Worker 준비 완료 ──
      if (msg.type === 'ready') {
        _workerReady = true;
        _workerRestartCount = 0;  // [FIX] 성공 시 재시작 카운터 리셋
        console.log('[Worker] 분석 Worker 초기화 완료');
        return;
      }

      // ── 패턴 + 시그널 분석 결과 ──
      if (msg.type === 'result') {

        // ── 드래그 분석 결과 (source === 'drag') ──
        if (msg.source === 'drag') {
          // stale 드래그 결과 무시 (이미 새 드래그가 요청됨)
          if (msg.version !== _dragVersion) return;

          const clampFrom = _dragClampFrom;
          const dragPatterns = msg.patterns;
          // [M-1] _srLevels 복원 — structured clone으로 소실된 배열 속성
          if (msg.srLevels) dragPatterns._srLevels = msg.srLevels;
          const dragSignals = msg.signals;

          // 인덱스 오프셋 보정: Worker는 visible 구간만 분석했으므로
          dragPatterns.forEach(function (p) {
            if (p.startIndex != null) p.startIndex += clampFrom;
            if (p.endIndex != null) p.endIndex += clampFrom;
          });

          // 보존된 차트 패턴 구조선 병합 (드래그 시 소실 방지)
          detectedPatterns = _mergeChartPatternStructLines(dragPatterns);
          chartManager._drawPatterns(candles, chartType, _filterPatternsForViz(detectedPatterns));

          // 시그널 인덱스 오프셋 보정
          dragSignals.forEach(function (s) {
            if (s.index != null) s.index += clampFrom;
          });
          detectedSignals = dragSignals;
          _injectWcToSignals(detectedSignals, detectedPatterns);
          signalStats = msg.stats;

          _renderOverlays();  // vizToggles 필터 적용된 통합 렌더
          const dragFiltered = vizToggles.signal ? _filterSignalsByCategory(detectedSignals) : [];

          chartManager.setHoverData(candles, detectedPatterns, dragFiltered);

          var dragComposites = detectedSignals
            .filter(function (s) { return s.type === 'composite' && s.marker; })
            .map(function (s) { return Object.assign({}, s, { endIndex: s.index, startIndex: s.index }); });
          renderPatternPanel([].concat(detectedPatterns, dragComposites));
          return;
        }

        // ── 전체 분석 결과 (source === 'full' 또는 기존 호환) ──
        _workerPending = false;

        // version 체크: 종목이 이미 변경되었으면 stale 결과 무시
        if (msg.version !== _workerVersion) return;

        detectedPatterns = msg.patterns;
        // [M-1] _srLevels 복원 — structured clone으로 소실된 배열 속성
        if (msg.srLevels) detectedPatterns._srLevels = msg.srLevels;
        detectedSignals = msg.signals;
        // [V22-B] factor guard Set 초기화 — 각 분석마다 처음부터 시작
        _appliedFactors.clear();
        // [V22-B] main-thread ATR vol regime 캐시 업데이트
        try {
          if (typeof classifyAtrVolRegime === 'function' && typeof calcATR === 'function') {
            _currentVolRegime = classifyAtrVolRegime(calcATR(candles, 14));
          }
        } catch (_e) { _currentVolRegime = 'mid'; }
        // [V23] PCA budget: save initial confidence before adjustment chain
        for (var bi = 0; bi < detectedPatterns.length; bi++) {
          detectedPatterns[bi]._confBefore = detectedPatterns[bi].confidence;
        }
        // [Phase I-L2] 외부 시장 맥락 신뢰도 조정 (market_context.json 로드 시)
        _applyMarketContextToPatterns(detectedPatterns);
        // [D-2] RORO 3-체제 분류 + 패턴 방향 편향 (매크로 조정 전 상위 레이어)
        _classifyRORORegime();
        _applyRORORegimeToPatterns(detectedPatterns);
        _markFactorsAfterRORO();  // [V22-B] RORO가 consume한 factor 등록
        // [Phase ECOS] 매크로 경제지표 기반 신뢰도 조정 (macro_latest + bonds_latest)
        // [V48-Phase2] server-side first; client-side fallback on error.
        await _fetchMacroConfidence(detectedPatterns);
        _markFactorsAfterMacro();  // [V22-B] Macro가 consume한 factor 등록
        // [Phase 2-D] 미시경제 지표 기반 신뢰도 조정 (ILLIQ, HHI)
        _updateMicroContext(candles);
        _applyMicroConfidenceToPatterns(detectedPatterns, _microContext);
        // [V38 CONF-M2] EVA Spread 매수 패턴 신뢰도 부스트 (Layer 4 직후)
        _applyEVAConfidenceToPatterns(detectedPatterns);
        // [Phase KRX-API] 파생상품·수급 데이터 기반 신뢰도 조정
        _applyDerivativesConfidenceToPatterns(detectedPatterns);
        // [D-4] Merton Distance-to-Default 신용위험 기반 신뢰도 조정 (비금융주)
        _calcNaiveDD(candles.map(function(c) { return c.close; }));
        _applyMertonDDToPatterns(detectedPatterns);
        // [Phase 5+8] MCS + HMM 레짐 + 수급 + 옵션 Implied Move + DD 통합 조정
        // [V48-Phase2] server-side first; client-side fallback on error.
        await _fetchPhase8Confidence(detectedPatterns);
        // [D-1] Survivorship bias: mild confidence discount for buy patterns
        _applySurvivorshipAdjustment(detectedPatterns);
        // [V23] PCA effect budget — cap correlated factor cumulative adjustment
        _applyPCABudgetCap(detectedPatterns);
        // [V6-FIX] C-1: Compound floor — prevent 8-phase multiplicative cascade from
        // crushing confidence below 25. Without this, worst-case 7+ sequential discounts
        // can reduce 70 → 10 (floor). Minimum meaningful confidence = 25.
        // Academic: Winsorized product (Tukey 1977) — robust statistics bounding.
        for (var cf = 0; cf < detectedPatterns.length; cf++) {
          if (detectedPatterns[cf].confidence != null && detectedPatterns[cf].confidence < 25) {
            detectedPatterns[cf].confidence = 25;
          }
        }
        _applyMacroConditionsToSignals(detectedSignals);
        _injectWcToSignals(detectedSignals, detectedPatterns);
        signalStats = msg.stats;

        // ADV 유동성 등급 / VolRegime 레짐 캐시 (Worker stats에서 추출)
        if (msg.stats) {
          if (msg.stats.advLevel != null) _lastAdvLevel = msg.stats.advLevel;
          if (msg.stats.volRegime != null) _lastVolRegime = msg.stats.volRegime;
        }

        // 차트 패턴 구조선 보존 (드래그 시 소실 방지)
        _saveChartPatternStructLines(detectedPatterns);

        // 사이드바 패턴 수 갱신 (카테고리별 분류)
        if (currentStock && typeof sidebarManager !== 'undefined') {
          var categorized = _categorizePatterns(detectedPatterns, detectedSignals);
          sidebarManager.setPatternCount(currentStock.code, categorized);
        }

        // 복합 시그널 중 마커가 있는 것을 패턴 목록에 병합 (차트 표시용)
        const compositeWithMarkers = detectedSignals
          .filter(function (s) { return s.type === 'composite' && s.marker; })
          .map(function (s) { return Object.assign({}, s, { endIndex: s.index, startIndex: s.index }); });
        renderPatternPanel([].concat(detectedPatterns, compositeWithMarkers));

        // 패턴 감지 알림 (패턴이 있을 때만)
        if (detectedPatterns.length > 0) {
          showToast(detectedPatterns.length + '개 패턴 감지됨', 'info');
          // Local Notification API — 탭이 백그라운드일 때 브라우저 알림
          _notifyPatterns(detectedPatterns);
        }

        // 차트에 패턴 렌더링 반영 + 오버레이 통합 렌더 (vizToggles 필터 적용)
        chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns, indParams);
        _renderOverlays();

        // ── analyze 완료 후 백테스트 요청 (승률 + 적응형 가중치 수신) ──
        if (_analysisWorker && _workerReady && candles && candles.length >= 50) {
          _analysisWorker.postMessage({
            type: 'backtest',
            candles: candles,
            market: currentStock && currentStock.market ? currentStock.market : '',
            version: _workerVersion,
            timeframe: currentTimeframe,
          });
        }
        return;
      }

      // ── 백테스트 결과 (적응형 가중치 + 승률 맵 + AMH 기준시점 갱신) ──
      if (msg.type === 'backtestResult') {
        // Dedup: skip if same version and candle length already processed
        // Handles both auto-triggered (from analyze cache miss) and explicit backtest results
        if (_lastBacktestVersion === msg.version && _lastBacktestLen === msg.candleLength) return;
        _lastBacktestVersion = msg.version;
        _lastBacktestLen = msg.candleLength;

        if (msg.learnedWeights) {
          adaptiveWeights = msg.learnedWeights;
          // [AMH] 백테스트 기준시점도 함께 전달 (다음 analyze에서 Worker가 주입)
          if (msg.backtestEpochMs != null) {
            adaptiveWeights._backtestEpochMs = msg.backtestEpochMs;
          }
          console.log('[Adaptive] 학습 가중치 업데이트:', Object.keys(adaptiveWeights).length, '패턴');
        }
        // [Signal Backtest] 시그널 백테스트 결과 저장
        if (msg.signalResults) {
          _signalBacktestResults = msg.signalResults;
        }
        return;
      }

      // ── Worker 에러 ──
      if (msg.type === 'error') {
        if (msg.source !== 'drag') _workerPending = false;
        console.warn('[Worker]', msg.message);
        return;
      }
    };

    _analysisWorker.onerror = function (err) {
      console.warn('[Worker] 치명적 에러:', err.message);
      _analysisWorker = null;
      _workerReady = false;
      _workerPending = false;

      // [FIX] Worker 에러 복구: 최대 3회 재시작 시도 (지수 백오프)
      if (_workerRestartCount < 3) {
        _workerRestartCount++;
        console.log('[Worker] 재시작 시도 %d/3 (%ds 후)', _workerRestartCount, _workerRestartCount);
        showToast('분석 Worker 재시작 중... (' + _workerRestartCount + '/3)', 'warning');
        setTimeout(function() { _initAnalysisWorker(); }, 1000 * _workerRestartCount);
      } else {
        showToast('분석 Worker 오류 — 메인 스레드로 전환', 'error');
      }
    };

  } catch (err) {
    console.warn('[Worker] 생성 실패:', err.message);
    _analysisWorker = null;
    _workerReady = false;
  }
}

/**
 * Worker에 패턴 + 시그널 분석 요청 (비동기)
 * 이미 요청 진행 중이면 중복 전송하지 않음
 */
function _requestWorkerAnalysis() {
  if (_workerPending) return;  // 이전 요청 결과 대기 중 — 스킵

  _workerPending = true;
  _analysisWorker.postMessage({
    type: 'analyze',
    candles: candles,
    realtimeMode: _realtimeMode,
    version: _workerVersion,
    learnedWeights: adaptiveWeights,
    market: currentStock && currentStock.market ? currentStock.market : '',
    timeframe: currentTimeframe,
    financialData: _getFinancialDataForSR(),  // 밸류에이션 S/R용 bps/eps
  });
}

/**
 * [Item 21 / V47-B1] 데이터 경과(staleness) 검사 유틸리티
 *
 * 14일 임계값의 근거: 한국은행 월별 거시지표 갱신 주기(통상 2-3주) × 2배 안전 마진.
 * 14일 초과 시 소스를 _staleDataSources에 등록하고, macro/bonds/flow/options 계열의
 * 신뢰도 승수 적용 함수는 해당 소스를 null로 간주하여 승수 효과를 1.0으로 클램프
 * (조정 비활성화). degraded 운영을 로그와 토스트로 사용자에게 가시화.
 *
 * @param {Object|Array|null} data - 검사 대상 데이터
 * @param {string} name - 소스 이름 (로그/토스트/_staleDataSources 키)
 * @param {string} dateField - 날짜 필드명 (updated/date/generated/time)
 * @param {boolean} isArray - 배열 데이터 여부 (마지막 요소의 dateField 사용)
 */
function _checkDataStaleness(data, name, dateField, isArray) {
  if (data == null) return;
  var dateValue = null;
  if (isArray) {
    if (!Array.isArray(data) || data.length === 0) return;
    dateValue = data[data.length - 1][dateField];
  } else {
    dateValue = data[dateField];
  }
  if (dateValue == null) return;
  var parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) return;
  var ageDays = Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (ageDays > 14) {
    // V47-B1: 14일 초과는 런타임 가드 트리거. 해당 소스 기반 승수는 1.0으로 클램프됨.
    _staleDataSources.add(name);
    _pipelineStatus[name] = ageDays > 30 ? 'stale' : 'aging';
    console.warn('[STALE] ' + name + ': ' + ageDays + '일 경과 (' + dateValue + ') -- 신뢰도 승수 1.0 클램프');
  }
  return ageDays;
}

/**
 * [Item 21] 전체 파이프라인 staleness 일괄 검사 — 3개 로더 모두 완료 후 1회만 실행
 * 3개 로더 (_loadMarketData, _loadDerivativesData, _loadPhase8Data)가 각각 호출,
 * 카운터가 3에 도달해야 실제 검사 수행 (병렬 로더 데이터 누락 방지)
 */
function _runPipelineStalenessCheck() {
  _stalenessLoadersComplete++;
  if (_stalenessLoadersComplete < 3 || _stalenessChecked) return;
  _stalenessChecked = true;

  _checkDataStaleness(_macroLatest, 'macro_latest', 'updated', false);
  _checkDataStaleness(_bondsLatest, 'bonds_latest', 'updated', false);
  _checkDataStaleness(_kosisLatest, 'kosis_latest', 'updated', false);
  _checkDataStaleness(_derivativesData, 'derivatives', 'time', true);
  _checkDataStaleness(_investorData, 'investor', 'date', false);
  _checkDataStaleness(_etfData, 'etf', 'date', false);
  _checkDataStaleness(_shortSellingData, 'shortselling', 'date', false);
  _checkDataStaleness(_flowSignals, 'flow_signals', 'generated', false);
  // flow_signals fallback: try "updated" if "generated" not found
  if (_flowSignals && _flowSignals.generated == null) {
    _checkDataStaleness(_flowSignals, 'flow_signals', 'updated', false);
  }
  _checkDataStaleness(_optionsAnalytics, 'options_analytics', 'generated', false);
  // _macroComposite: skip — no reliable date field

  if (_staleDataSources.size > 0) {
    var names = [];
    _staleDataSources.forEach(function(n) { names.push(n); });
    showToast(names.length + '개 데이터 소스 14일+ 경과 -- 관련 신뢰도 조정 비활성화', 'warning');
    console.warn('[STALE] 경과 데이터 소스 (' + names.length + '):', names.join(', '));
  }

  // [V47-B2] 교차-API 그룹별 상태 보고 + down 그룹 1회 알림
  if (typeof _reportCrossApiStatus === 'function') {
    var _apiStatuses = _reportCrossApiStatus();
    var _downApis = [];
    Object.keys(_apiStatuses).forEach(function(api) {
      if (_apiStatuses[api] === 'down') _downApis.push(api);
    });
    if (_downApis.length > 0) {
      showToast(_downApis.join('/') + ' API 다운 -- 관련 신뢰도 조정 전면 비활성화', 'warning');
    }
  }
}

/**
 * [Item 22] fetch 실패 시 1회성 토스트 표시 유틸리티
 * @param {string} name - 소스 이름 (중복 방지 키 + 토스트 표시용)
 */
function _notifyFetchFailure(name) {
  if (_fetchFailToasts.has(name)) return;
  _fetchFailToasts.add(name);
  showToast(name + ' 로드 실패', 'warning');
}

/**
 * 매크로/채권 데이터 비동기 로드 — 차트 오버레이 정보용
 * data/macro/macro_latest.json (KTB10Y, USD/KRW, CPI 등)
 * data/macro/bonds_latest.json (수익률곡선 등)
 * 선택적 데이터: 로드 실패 시 무시 (기존 기능에 영향 없음)
 */
async function _loadMarketData() {
  var _now = Date.now();
  if (_now - _lastMarketDataLoad < _PIPELINE_LOAD_TTL) return;
  _lastMarketDataLoad = _now;
  try {
    var results = await Promise.allSettled([
      fetch('data/macro/macro_latest.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/macro/bonds_latest.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/macro/kosis_latest.json', { signal: AbortSignal.timeout(5000) }),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.ok)
      try { _macroLatest = await results[0].value.json(); _pipelineStatus.macro_latest = 'ok'; } catch(e) { console.warn('[KRX] macro JSON parse error:', e); }
    else _notifyFetchFailure('macro_latest');
    if (results[1].status === 'fulfilled' && results[1].value.ok)
      try { _bondsLatest = await results[1].value.json(); _pipelineStatus.bonds_latest = 'ok'; } catch(e) { console.warn('[KRX] bonds JSON parse error:', e); }
    else _notifyFetchFailure('bonds_latest');
    if (results[2].status === 'fulfilled' && results[2].value.ok)
      try { _kosisLatest = await results[2].value.json(); _pipelineStatus.kosis_latest = 'ok'; } catch(e) { console.warn('[KRX] kosis JSON parse error:', e); }
    else _notifyFetchFailure('kosis_latest');
    if (_macroLatest || _bondsLatest) {
      console.log('[KRX] 매크로/채권 데이터 로드 완료');
    }
    if (_kosisLatest) {
      console.log('[KRX] KOSIS 경제지표 로드 완료:', Object.keys(_kosisLatest).length, '개 필드');
    }
    // [B-4] VKOSPI 시계열 로드 → 최신 close를 _macroLatest.vkospi에 주입
    // data/vkospi.json: [{time,open,high,low,close}, ...] (download_vkospi.py 생성)
    // VKOSPI 레퍼런스 범위: <15 저변동, 15-22 정상, 22-30 경계, 30-50 위기, 50+ 극단
    // (Doc26 §2.3; 역사적 최고 ~80 COVID 2020, ~80 tariff crisis 2026)
    try {
      var vkResp = await fetch('data/vkospi.json', { signal: AbortSignal.timeout(5000) });
      if (vkResp.ok) {
        var vkData; try { vkData = await vkResp.json(); } catch(e) { console.warn('[KRX] vkospi JSON parse error:', e); vkData = null; }
        if (Array.isArray(vkData) && vkData.length > 0) {
          var latestVK = vkData[vkData.length - 1];
          if (latestVK && latestVK.close != null) {
            if (!_macroLatest) _macroLatest = {};
            if (_macroLatest.vkospi == null) {
              _macroLatest.vkospi = latestVK.close;
              // Staleness check: warn if latest VKOSPI data is >7 days old
              if (latestVK.time) {
                var vkDate = new Date(latestVK.time + 'T00:00:00+09:00');
                var vkDaysOld = Math.floor((Date.now() - vkDate.getTime()) / 86400000);
                if (vkDaysOld > 7) {
                  console.warn('[KRX] VKOSPI 데이터 오래됨:', latestVK.time, '(' + vkDaysOld + '일 전) — 갱신 필요');
                }
              }
              console.log('[KRX] VKOSPI 로드:', latestVK.close, '(' + latestVK.time + ')');
              _pipelineStatus.vkospi = 'ok';
            }
          }
        }
      }
    } catch (e) { _notifyFetchFailure('vkospi'); }
    // [H-2] 매크로 데이터에 VKOSPI/VIX가 있으면 Worker에 전달
    // _loadDerivativesData()와 병렬 실행되므로 양쪽 모두에서 호출 (중복 전송 안전)
    _sendMarketContextToWorker();
    var _mktHealth = _getPipelineHealth();
    console.log('[Pipeline] Health:', _mktHealth.ok + '/' + _mktHealth.total, 'sources OK');
    // [Item 21] staleness 검사 트리거 (3개 로더 중 마지막 완료 시 실행)
    _runPipelineStalenessCheck();
  } catch (e) { _notifyFetchFailure('매크로/채권'); }
}

/**
 * [Phase KRX-API] 파생상품·수급·ETF·공매도 데이터 비동기 로드
 * data/derivatives/ 하위 4개 summary JSON (download_*.py 생성)
 * 선택적 데이터: 로드 실패 시 무시 (기존 기능에 영향 없음)
 *
 * 이론: Doc36 (선물 미시구조), Doc37 (옵션 IV 곡면), Doc38 (ETF 생태계),
 *       Doc39 (투자자 수급), Doc40 (공매도), Doc41 (채권-주식 상대가치)
 */
async function _loadDerivativesData() {
  var _now = Date.now();
  if (_now - _lastDerivativesDataLoad < _PIPELINE_LOAD_TTL) return;
  _lastDerivativesDataLoad = _now;
  try {
    var results = await Promise.allSettled([
      fetch('data/derivatives/derivatives_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/investor_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/etf_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/shortselling_summary.json', { signal: AbortSignal.timeout(5000) }),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.ok)
      try { _derivativesData = await results[0].value.json(); _pipelineStatus.derivatives = 'ok'; } catch(e) { console.warn('[KRX] derivatives JSON parse error:', e); }
    else _notifyFetchFailure('derivatives');
    if (results[1].status === 'fulfilled' && results[1].value.ok)
      try { _investorData = await results[1].value.json(); _pipelineStatus.investor = 'ok'; } catch(e) { console.warn('[KRX] investor JSON parse error:', e); }
    else _notifyFetchFailure('investor');
    if (results[2].status === 'fulfilled' && results[2].value.ok)
      try { _etfData = await results[2].value.json(); _pipelineStatus.etf = 'ok'; } catch(e) { console.warn('[KRX] etf JSON parse error:', e); }
    else _notifyFetchFailure('etf');
    if (results[3].status === 'fulfilled' && results[3].value.ok)
      try { _shortSellingData = await results[3].value.json(); _pipelineStatus.shortselling = 'ok'; } catch(e) { console.warn('[KRX] shortselling JSON parse error:', e); }
    else _notifyFetchFailure('shortselling');

    // [H-13 FIX] source="sample" 데이터는 null 처리 — 가짜 데이터가 신뢰도 조정에 영향 방지
    if (_investorData && _investorData.source === 'sample') {
      console.warn('[KRX] investor_summary is SAMPLE data — investor adjustments disabled');
      _pipelineStatus.investor = 'sample';
      _investorData = null;
    }
    // [AUDIT-FIX] source="naver"는 KRX 공식 대비 지연/형식 차이 가능 — 신뢰도 감쇠
    if (_investorData && _investorData.source === 'naver') {
      console.warn('[KRX] investor_summary sourced from Naver scrape — applying 0.85 discount');
      _pipelineStatus.investor = 'naver';
      _investorData._sourceDiscount = 0.85;
    }
    // [H-14 FIX] shortselling source="sample" or "unavailable" → disable
    if (_shortSellingData && (_shortSellingData.source === 'sample' || _shortSellingData.source === 'unavailable')) {
      console.warn('[KRX] shortselling_summary is ' + _shortSellingData.source + ' data — short interest adjustments disabled');
      _pipelineStatus.shortselling = _shortSellingData.source;
      _shortSellingData = null;
    }
    // [P1-fix] Source guards for 3 remaining derivative data paths
    if (_derivativesData && !Array.isArray(_derivativesData) && (_derivativesData.source === 'sample' || _derivativesData.source === 'demo')) {
      console.warn('[KRX] derivatives_summary is ' + _derivativesData.source + ' data — derivatives adjustments disabled');
      _pipelineStatus.derivatives = _derivativesData.source;
      _derivativesData = null;
    }
    if (_etfData && (_etfData.source === 'sample' || _etfData.source === 'demo')) {
      console.warn('[KRX] etf_summary is ' + _etfData.source + ' data — ETF adjustments disabled');
      _pipelineStatus.etf = _etfData.source;
      _etfData = null;
    }

    var loaded = [_derivativesData, _investorData, _etfData, _shortSellingData].filter(Boolean).length;
    if (loaded > 0) {
      console.log('[KRX] 파생상품/수급 데이터 로드 완료 (' + loaded + '/4)');
    }

    // [H-6~7 FIX] basis_analysis.json에서 basis/basisPct를 _derivativesData에 병합
    // derivatives_summary.json에는 basis 필드가 없고, basis_analysis.json에 별도 저장됨
    try {
      var basisResp = await fetch('data/derivatives/basis_analysis.json', { signal: AbortSignal.timeout(5000) });
      if (basisResp.ok) {
        var basisArr; try { basisArr = await basisResp.json(); } catch(e) { console.warn('[KRX] basis JSON parse error:', e); basisArr = null; }
        if (Array.isArray(basisArr) && basisArr.length > 0) {
          var latestBasis = basisArr[basisArr.length - 1];
          // _derivativesData가 배열이면 최신 레코드에 병합, 아니면 객체에 직접 병합
          if (Array.isArray(_derivativesData) && _derivativesData.length > 0) {
            var lastDeriv = _derivativesData[_derivativesData.length - 1];
            if (lastDeriv.basis == null && latestBasis.basis != null) lastDeriv.basis = latestBasis.basis;
            if (lastDeriv.basisPct == null && latestBasis.basisPct != null) lastDeriv.basisPct = latestBasis.basisPct;
          } else if (_derivativesData && typeof _derivativesData === 'object') {
            if (_derivativesData.basis == null && latestBasis.basis != null) _derivativesData.basis = latestBasis.basis;
            if (_derivativesData.basisPct == null && latestBasis.basisPct != null) _derivativesData.basisPct = latestBasis.basisPct;
          } else {
            // _derivativesData가 없으면 basis만으로 생성
            _derivativesData = [{ basis: latestBasis.basis, basisPct: latestBasis.basisPct }];
          }
          _pipelineStatus.basis = 'ok';
          console.log('[KRX] 베이시스 데이터 병합: basis=' + latestBasis.basis + ', basisPct=' + latestBasis.basisPct);
        }
      }
    } catch (e) { _notifyFetchFailure('basis'); }

    // [H-2] Worker에 시장 맥락 데이터 주입 — signalEngine 레짐 분류용
    // 메인 스레드: 멀티플라이어 적용 (_applyDerivativesConfidenceToPatterns)
    // Worker: 레짐 분류만 (signalEngine._classifyVolRegimeFromVKOSPI 등)
    _sendMarketContextToWorker();
    var _derivHealth = _getPipelineHealth();
    console.log('[Pipeline] Health:', _derivHealth.ok + '/' + _derivHealth.total, 'sources OK');
    // [Item 21] staleness 검사 트리거
    _runPipelineStalenessCheck();
  } catch (e) { _notifyFetchFailure('파생상품/수급'); }
}

/**
 * [Phase 5+8] 매크로 복합점수 + 투자자 수급 + 옵션 분석 데이터 비동기 로드
 *
 * 이론: Doc 25 §9.5 (IC 형식론), Doc 29 §5 (MCS), Doc 46 §5 (옵션 전략)
 * 선택적 데이터: 로드 실패 시 무시 (기존 기능에 영향 없음)
 */
async function _loadPhase8Data() {
  var _now = Date.now();
  if (_now - _lastPhase8DataLoad < _PIPELINE_LOAD_TTL) return;
  _lastPhase8DataLoad = _now;
  try {
    // [V48-SEC] flow_signals and eva_scores served via Origin-gated /api/*.
    // Dev fallback to raw data/backtest/*.json if the API returns non-OK.
    async function _secFetch(apiPath, rawPath) {
      try {
        var r = await fetch(apiPath, { signal: AbortSignal.timeout(5000), credentials: 'same-origin' });
        if (r.ok) return r;
      } catch (_) {}
      return fetch(rawPath, { signal: AbortSignal.timeout(5000) });
    }
    var results = await Promise.allSettled([
      fetch('data/macro/macro_composite.json', { signal: AbortSignal.timeout(5000) }),
      _secFetch('/api/flow', 'data/backtest/flow_signals.json'),
      fetch('data/derivatives/options_analytics.json', { signal: AbortSignal.timeout(5000) }),
      _secFetch('/api/eva', 'data/backtest/eva_scores.json'),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.ok)
      try { _macroComposite = await results[0].value.json(); _pipelineStatus.macro_composite = 'ok'; } catch(e) { console.warn('[KRX] macro_composite JSON parse error:', e); }
    else _notifyFetchFailure('macro_composite');
    if (results[1].status === 'fulfilled' && results[1].value.ok)
      try { _flowSignals = await results[1].value.json(); _pipelineStatus.flow_signals = 'ok'; } catch(e) { console.warn('[KRX] flow_signals JSON parse error:', e); }
    else _notifyFetchFailure('flow_signals');
    if (results[2].status === 'fulfilled' && results[2].value.ok)
      try { _optionsAnalytics = await results[2].value.json(); _pipelineStatus.options_analytics = 'ok'; } catch(e) { console.warn('[KRX] options_analytics JSON parse error:', e); }
    else _notifyFetchFailure('options_analytics');
    // [V38 CONF-M2] EVA Spread 데이터 로드
    if (results[3].status === 'fulfilled' && results[3].value.ok)
      try { _evaScoresData = await results[3].value.json(); _pipelineStatus.eva_scores = 'ok'; } catch(e) { console.warn('[KRX] eva_scores JSON parse error:', e); }
    else _notifyFetchFailure('eva_scores');
    // [P1-fix] Status/source guards for macro_composite and options_analytics
    if (_macroComposite && (_macroComposite.status === 'error' || _macroComposite.source === 'sample' || _macroComposite.source === 'demo')) {
      console.warn('[KRX] macro_composite rejected — status/source=' + (_macroComposite.status || _macroComposite.source));
      _pipelineStatus.macro_composite = 'rejected';
      _macroComposite = null;
    }
    if (_optionsAnalytics && (_optionsAnalytics.status === 'error' || _optionsAnalytics.source === 'sample' || _optionsAnalytics.source === 'demo')) {
      console.warn('[KRX] options_analytics rejected — status/source=' + (_optionsAnalytics.status || _optionsAnalytics.source));
      _pipelineStatus.options_analytics = 'rejected';
      _optionsAnalytics = null;
    }
    // [P0-fix] flow_signals quality gate: flowDataCount=0 means no real investor data
    if (_flowSignals && _flowSignals.flowDataCount === 0) {
      console.warn('[KRX] flow_signals has flowDataCount=0 — HMM regime adjustments disabled');
      _pipelineStatus.flow_signals = 'empty';
    }
    var loaded = [_macroComposite, _flowSignals, _optionsAnalytics].filter(Boolean).length;
    if (loaded > 0) {
      console.log('[KRX] Phase 8 데이터 로드 완료 (' + loaded + '/3)');
    }
    // [V38] EVA scores load status
    if (_evaScoresData && _evaScoresData.stocks) {
      console.log('[KRX] EVA scores 로드: ' + Object.keys(_evaScoresData.stocks).length + '종목');
    }
    // [V38] AD-AS shock classification logging (confidence 조정은 후속 세션에서 검증 후 활성화)
    if (_macroComposite && _macroComposite.adAsShock) {
      console.log('[KRX] AD-AS 충격 분류: ' + _macroComposite.adAsShock +
        (_macroComposite.adAsDetail ? ' (' + _macroComposite.adAsDetail.description + ')' : ''));
    }
    var _p8Health = _getPipelineHealth();
    console.log('[Pipeline] Health:', _p8Health.ok + '/' + _p8Health.total, 'sources OK');
    // [Item 21] staleness 검사 트리거
    _runPipelineStalenessCheck();
  } catch (e) { _notifyFetchFailure('Phase8 데이터'); }
}

function _applyPhase8ConfidenceToPatterns(patterns) {
  throw new Error('[V48-Phase2.5] removed; see /api/confidence/phase8');
}

/**
 * [H-2] Worker에 시장 맥락 데이터 전송
 *
 * signalEngine._classifyVolRegimeFromVKOSPI()가 Worker 내부에서 _marketContext.vkospi를 읽고,
 * signalEngine._detect*Signal()이 _derivativesData/_investorData/_etfData를 읽는다.
 * 메인 스레드에서 로드된 데이터를 Worker 전역에 주입하여 레짐 분류를 가능하게 한다.
 *
 * VKOSPI 소스 우선순위: _marketContext.vkospi → _macroLatest.vkospi → _macroLatest.vix×proxy
 * (signalEngine._classifyVolRegimeFromVKOSPI와 동일한 fallback chain)
 */
function _sendMarketContextToWorker() {
  if (!_analysisWorker || !_workerReady) return;

  // VKOSPI: market_context.json → macro_latest.json (VKOSPI 직접 또는 VIX proxy)
  var vkospi = null;
  if (_marketContext && _marketContext.vkospi != null) {
    vkospi = _marketContext.vkospi;
  } else if (_macroLatest && _macroLatest.vkospi != null) {
    vkospi = _macroLatest.vkospi;
  } else if (_macroLatest && _macroLatest.vix != null) {
    // [DEPRECATED FALLBACK] VIX→VKOSPI proxy — offline only (real VKOSPI in vkospi.json)
    // [P1-FIX] variable scale (1.0/1.1/1.25) → VIX_VKOSPI_PROXY 통일 (P0-C8 일관성)
    vkospi = _macroLatest.vix * VIX_VKOSPI_PROXY;
  }

  // derivatives_summary.json: PCR, basis
  var deriv = _derivativesData;
  if (Array.isArray(deriv) && deriv.length > 0) deriv = deriv[deriv.length - 1];
  var pcr = (deriv && deriv.pcr != null) ? deriv.pcr : null;
  var basis = (deriv && deriv.basis != null) ? deriv.basis : null;
  var basisPct = (deriv && deriv.basisPct != null) ? deriv.basisPct : null;

  // etf_summary.json: leverageRatio
  var leverageRatio = null;
  if (_etfData && _etfData.leverageSentiment && _etfData.leverageSentiment.leverageRatio != null) {
    leverageRatio = _etfData.leverageSentiment.leverageRatio;
  }

  // investor_summary.json: foreignAlignment
  var foreignAlignment = null;
  if (_investorData && _investorData.alignment) {
    var align = _investorData.alignment;
    foreignAlignment = (typeof align === 'object') ? align.signal_1d : align;
  }

  // 데이터가 하나라도 있을 때만 전송
  if (vkospi == null && pcr == null && basis == null && basisPct == null && leverageRatio == null && foreignAlignment == null) return;

  _analysisWorker.postMessage({
    type: 'marketContext',
    vkospi: vkospi,
    pcr: pcr,
    basis: basis,
    basisPct: basisPct,
    leverageRatio: leverageRatio,
    foreignAlignment: foreignAlignment,
  });
}

/**
 * [Phase KRX-API] 파생상품·수급 데이터 기반 패턴 신뢰도 조정
 *
 * 6개 독립 팩터 (곱셈 결합, clamp [0.70, 1.30]):
 *  1. 선물 베이시스 (Doc36 §3) — 베이시스 방향과 패턴 방향 일치 시 boost
 *  2. PCR (Doc37 §6) — Put/Call Ratio 극단값 역발상 신호
 *  3. 투자자 수급 (Doc39 §6) — 외국인+기관 alignment 신호
 *  4. ETF 센티먼트 (Doc38 §3) — 레버리지/인버스 비율 극단값
 *  5. 공매도 비율 (Doc40 §4) — 시장 전체 공매도 비율 레짐
 *  6. ERP (Doc41 §2) — 채권-주식 상대가치 z-score
 *
 * @param {Array} patterns - patternEngine.analyze() 결과
 */
function _applyDerivativesConfidenceToPatterns(patterns) {
  if (!patterns || patterns.length === 0) return;

  // [C-1 FIX] derivatives_summary.json: 배열(per-date) 또는 단일 객체 모두 지원
  var deriv = _derivativesData;
  if (Array.isArray(deriv) && deriv.length > 0) deriv = deriv[deriv.length - 1];
  var investor = _investorData;
  var etf = _etfData;
  var shorts = _shortSellingData;

  // 데이터 전무 시 no-op
  if (!deriv && !investor && !etf && !shorts) return;

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  // [Phase 4-B] USD/KRW 수출주 채널 — 루프 밖 1회 산출 (Doc28 §3)
  // β_FX +0.3~+0.5: KRW 약세 → 수출주 매출↑ → 매수 부스트, 역방향도 적용
  var _fxExportDir = 0;  // 0=neutral, +1=KRW weak (exporter bullish), -1=KRW strong
  if (_macroLatest && _macroLatest.usdkrw != null && currentStock) {
    var _usdkrw = _macroLatest.usdkrw;
    var _expSector = _getStovallSector(currentStock.industry || currentStock.sector || '');
    var _EXPORT_SECTORS = { 'semiconductor': 1, 'tech': 1, 'cons_disc': 1, 'industrial': 1 };
    if (_EXPORT_SECTORS[_expSector]) {
      if (_usdkrw > 1400) _fxExportDir = 1;        // KRW 급약세: 수출주 수혜
      else if (_usdkrw < 1300) _fxExportDir = -1;   // KRW 강세: 수출주 불리
    }
  }

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var isBuy = (p.signal === 'buy');
    var adj = 1.0;

    // ── 1. 선물 베이시스 (Doc27 §5.1 + §6.2, Bessembinder & Seguin 1993) ──
    // basisPct 정규화 사용: ±0.5% normal (±5%), ±2.0% extreme (±8%)
    if (deriv && (deriv.excessBasisPct != null || deriv.basisPct != null || deriv.basis != null)) {
      var _bPct = deriv.excessBasisPct != null ? deriv.excessBasisPct : deriv.basisPct;
      var _bAbs = _bPct != null ? Math.abs(_bPct) : Math.abs(deriv.basis);
      var _bThr = _bPct != null ? 0.5 : 0.5;
      var _bExt = _bPct != null ? 2.0 : 5.0;
      var _bPos = _bPct != null ? (_bPct > 0) : (deriv.basis > 0);
      if (_bAbs >= _bThr) {
        // [V6-FIX] B-6: noise-adjusted (σ_basis=2.36%), Bessembinder & Seguin IC 0.02-0.05
        var _bMult = _bAbs >= _bExt ? 0.07 : 0.04;  // extreme ±7%, normal ±4%
        if (_bPos) {              // contango: 시장 낙관
          adj *= isBuy ? (1 + _bMult) : (1 - _bMult);
        } else {                  // backwardation: 시장 비관
          adj *= isBuy ? (1 - _bMult) : (1 + _bMult);
        }
      }
    }

    // ── 2. PCR 역발상 (Doc37 §6, Pan & Poteshman 2006) ──
    // [V6-FIX] B-6: thresholds 1.3/0.5→1.2/0.6 (P90=1.149; 0.5 was dead code: 0 observations)
    // mult 0.08→0.06 (IC 0.03-0.05, wider activation zone → smaller per-hit adjustment)
    if (deriv && deriv.pcr != null) {
      var pcr = deriv.pcr;
      if (pcr > 1.2) {
        adj *= isBuy ? 1.06 : 0.94;   // 극단적 공포 → 매수 유리
      } else if (pcr < 0.6) {
        adj *= isBuy ? 0.94 : 1.06;   // 극단적 탐욕 → 매도 유리
      }
    }

    // ── 3. 투자자 수급 alignment (Doc39 §6, Choe/Kho/Stulz 2005) ──
    // [C-2 FIX] alignment: object {signal_1d} 또는 string 모두 지원
    // [AUDIT-FIX] naver source: KRX 공식 대비 지연 가능 → _sourceDiscount(0.85) 감쇠
    if (investor && investor.alignment) {
      var align = investor.alignment;
      if (align && typeof align === 'object') align = align.signal_1d;
      var srcDisc = investor._sourceDiscount || 1.0;
      if (align === 'aligned_buy') {
        var rawBuy = isBuy ? 1.08 : 0.93;
        adj *= 1.0 + (rawBuy - 1.0) * srcDisc;   // 외국인+기관 동반 매수
      } else if (align === 'aligned_sell') {
        var rawSell = isBuy ? 0.93 : 1.08;
        adj *= 1.0 + (rawSell - 1.0) * srcDisc;   // 외국인+기관 동반 매도
      }
      // divergent/neutral: 조정 없음
    }

    // ── 4. ETF 레버리지 센티먼트 (Doc38 §3, Cheng & Madhavan 2009) ──
    if (etf && etf.leverageSentiment) {
      var sentiment = etf.leverageSentiment.sentiment;
      // [V6-FIX] B-6: 5%→4% (unvalidated for KRX; 80%+ retail ETF market adds noise)
      if (sentiment === 'strong_bullish') {
        adj *= isBuy ? 0.96 : 1.04;   // 극단적 낙관 → 역발상 (과열 경고)
      } else if (sentiment === 'strong_bearish') {
        adj *= isBuy ? 1.04 : 0.96;   // 극단적 비관 → 역발상 (바닥 근접)
      }
    }

    // ── 5. 공매도 비율 (Doc40 §4, Desai et al. 2002) ──
    // [C-4 FIX] market_short_ratio(flat) 또는 marketTrend[-1].shortRatio
    if (shorts) {
      var msr = shorts.market_short_ratio;
      if (msr == null && shorts.marketTrend && shorts.marketTrend.length > 0)
        msr = shorts.marketTrend[shorts.marketTrend.length - 1].shortRatio;
      if (msr != null && msr > 10) {    // 시장 공매도 비율 > 10%
        adj *= isBuy ? 1.06 : 0.94;   // 높은 공매도 → 숏커버 rally 가능 (매수 유리)
      // [V6-FIX] B-6: Low-SIR branch neutralized — data "unavailable" since Dec 2025,
      // short-selling partially banned 2023.11-2025.03. Low SIR = regulatory constraint,
      // not sentiment (Miller 1977). Re-enable when per-stock short data active.
      // } else if (msr != null && msr < 2) {
      //   adj *= isBuy ? 0.97 : 1.03;
      }
    }

    // [C-6 FIX] ERP는 signalEngine._detectERPSignal()에서만 처리 — 이중 적용 방지

    // ── 7. USD/KRW 수출주 채널 (Doc28 §3, β_FX ±5%) ──
    if (_fxExportDir !== 0) {
      adj *= (_fxExportDir === 1)
        ? (isBuy ? 1.05 : 0.95)     // KRW 약세 → 수출주 매수 유리
        : (isBuy ? 0.95 : 1.05);    // KRW 강세 → 수출주 매수 불리
    }

    // clamp [0.70, 1.30]
    adj = Math.max(0.70, Math.min(1.30, adj));
    if (adj !== 1.0) {
      p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// [D-4] Merton Distance-to-Default (Naive DD)
//
// Merton(1974): 자기자본 = 자산에 대한 유럽식 콜옵션.
// Bharath & Shumway(2008) 간편법: V≈E+D, σ_V 가중평균.
// 금융주(은행/보험/증권) 부채=영업자산 → DD 부적합 → 제외.
// Doc35 §6.1-6.5, 상수 #134 MERTON_DD_WARNING=1.5
// ══════════════════════════════════════════════════════════════

// ── 표준정규 CDF 근사 (Abramowitz & Stegun 1964, |ε| < 7.5e-8) ──
function _normalCDF(x) {
  if (x > 6) return 1;
  if (x < -6) return 0;
  var neg = (x < 0);
  if (neg) x = -x;
  var t = 1 / (1 + 0.2316419 * x);
  var d = 0.3989422804014327 * Math.exp(-0.5 * x * x);  // n(x) = φ(x)
  var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return neg ? p : 1 - p;
}

// ── Naive DD 계산 (Bharath & Shumway 2008) ──
// candleCloses: 일봉 종가 배열 (EWMA 변동성 산출용)
function _calcNaiveDD(candleCloses) {
  _currentDD = null;
  if (!currentStock || !candleCloses || candleCloses.length < 60) return;

  // 금융주 제외: 부채=영업자산이므로 DD 해석 무의미
  var industry = currentStock.industry || currentStock.sector || '';
  var sector = _getStovallSector(industry);
  if (sector === 'financial') return;

  // 재무 데이터: seed 제외 (가짜 데이터로 DD 계산 금지)
  if (typeof _financialCache === 'undefined') return;
  var cached = _financialCache[currentStock.code];
  if (!cached) return;
  if (cached.source !== 'dart' && cached.source !== 'hardcoded') return;
  var arr = (cached.quarterly && cached.quarterly.length) ? cached.quarterly : cached.annual;
  if (!arr || !arr.length) return;
  var latest = arr[0];
  var totalLiab = latest.total_liabilities;
  if (!totalLiab || totalLiab <= 0) return;

  // E: 시총 (억원 — totalLiab와 동일 단위, toEok() 변환 후)
  var mcapEok = null;
  if (typeof sidebarManager !== 'undefined' && sidebarManager.MARKET_CAP) {
    mcapEok = sidebarManager.MARKET_CAP[currentStock.code];
  }
  if (!mcapEok && currentStock.marketCap) mcapEok = currentStock.marketCap;
  if (!mcapEok || mcapEok <= 0) return;
  var E = mcapEok;  // 억원 (totalLiab와 동일 단위)

  // D: Default Point ≈ total_liabilities × 0.75 (KMV 관행, Doc35 §6.5)
  var D = totalLiab * 0.75;
  if (D <= 0) return;

  // σ_E: EWMA 일간 변동성 → 연율화 (×√252)
  var ewmaVol = calcEWMAVol(candleCloses);
  var sigmaE = null;
  for (var i = ewmaVol.length - 1; i >= 0; i--) {
    if (ewmaVol[i] != null) { sigmaE = ewmaVol[i]; break; }
  }
  if (!sigmaE || sigmaE <= 0) return;
  sigmaE *= Math.sqrt(250);  // 연율화 (KRX_TRADING_DAYS=250)

  // r: 무위험이자율 (KTB 3Y)
  var r = 0.035;  // fallback (#130 YIELD_GAP_FALLBACK_KTB, Doc35 §10.1)
  if (_bondsLatest && _bondsLatest.yields && _bondsLatest.yields.ktb_3y != null) {
    r = _bondsLatest.yields.ktb_3y / 100;
  } else if (_macroLatest && _macroLatest.ktb3y != null) {
    r = _macroLatest.ktb3y / 100;
  }

  // Naive DD 계산
  var V = E + D;                                          // 자산가치 근사
  var sigmaV = sigmaE * (E / V) + 0.05 * (D / V);       // 자산변동성 근사
  if (sigmaV <= 0) return;
  var T = 1;  // 1년

  var dd = (Math.log(V / D) + (r - 0.5 * sigmaV * sigmaV) * T) / (sigmaV * Math.sqrt(T));

  _currentDD = {
    dd: dd,
    edf: _normalCDF(-dd),     // 기대 부도확률
    V: V, D: D,
    sigmaV: sigmaV,
    sector: sector
  };
}

// ── DD 기반 패턴 신뢰도 조정 (Doc35 §6.4) ──
// DD ≥ 2.0: 안전, 조정 없음
// DD ≥ 1.5: 경계 — 매수 소폭 할인
// DD < 1.5: 위험 — 매수 강한 할인, 매도 부스트
// DD < 1.0: 매우 위험 — 최대 할인
// clamp [0.85, 1.15]: 종목 고유 지표이므로 제한적 범위
function _applyMertonDDToPatterns(patterns) {
  if (!patterns || patterns.length === 0 || !_currentDD) return;
  var dd = _currentDD.dd;
  if (dd >= 2.0) return;  // 안전 — 조정 없음

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    var isBuy = (p.signal === 'buy');
    var adj;

    if (dd >= 1.5) {
      // 경계: 매수 소폭 할인, 매도 소폭 부스트
      adj = isBuy ? 0.95 : 1.02;
    } else if (dd >= 1.0) {
      // 위험: 매수 강한 할인, 매도 부스트
      adj = isBuy ? 0.82 : 1.12;
    } else {
      // 매우 위험: 최대 할인
      adj = isBuy ? 0.75 : 1.15;
    }

    // clamp [0.75, 1.15] — 하한 0.75: DD<1.0 tier (매우 위험) 구분 유효
    adj = Math.max(0.75, Math.min(1.15, adj));
    p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
    if (p.confidencePred != null) {
      p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
    }
  }
}

/**
 * [D-1] Survivorship bias confidence adjustment.
 * Applies mild confidence discount to BUY patterns when correction data is loaded.
 * Sell patterns are NOT adjusted (delisted stocks failing = bearish patterns were correct).
 * Clamp: [0.92, 1.0] — consistent with D-2 RORO band [0.92, 1.08].
 */
function _applySurvivorshipAdjustment(patterns) {
  if (typeof backtester === 'undefined' || !backtester._survivorshipCorr) return;
  var corr = backtester._survivorshipCorr;
  var globalDelta = corr.global ? corr.global.delta_wr_median : 0;

  // Only apply if correction is meaningful (> 1pp)
  if (globalDelta <= 1) return;

  // [V6-FIX] B-1: /200→/100 (Elton-Gruber-Blake 1996); still near-zero with global delta ~0.1pp
  // adj = 1 - (delta / 100): WR delta as confidence multiplier
  // 2.8pp delta → 0.972 multiplier, 5pp delta → 0.950 multiplier
  var adj = Math.max(0.92, Math.min(1.0, 1 - (globalDelta / 100)));

  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    // Buy patterns only — sell patterns benefit from delisted stock failures
    if (p.signal === 'buy' && typeof p.confidence === 'number') {
      p.confidence = +(p.confidence * adj).toFixed(1);
    }
  }

}

/**
 * 현재 종목의 재무 데이터에서 밸류에이션 S/R용 bps/eps 추출
 * _financialCache (data.js 전역)에서 동기적 접근
 * @returns {Object|null} { bps, eps } 또는 null (데이터 미로드/seed)
 */
function _getFinancialDataForSR() {
  if (typeof _financialCache === 'undefined' || !currentStock) return null;
  var cached = _financialCache[currentStock.code];
  if (!cached) return null;
  // seed 생성 가짜 데이터는 밸류에이션 S/R에 사용하지 않음
  if (cached.source !== 'dart' && cached.source !== 'hardcoded') return null;
  // quarterly 또는 annual 데이터에서 bps/eps 추출
  var arr = (cached.quarterly && cached.quarterly.length) ? cached.quarterly : cached.annual;
  if (!arr || !arr.length) return null;
  var latest = arr[0];
  var bps = latest.bps ? Number(latest.bps) : null;
  var eps = latest.eps ? Number(latest.eps) : null;
  if (!bps && !eps) return null;
  return { bps: bps || null, eps: eps || null };
}

/**
 * [Phase I-L2] 외부 시장 맥락 기반 패턴 신뢰도 조정
 * data/market_context.json (download_market_context.py 생성) 활용
 *
 * 조정 인자 (모두 독립 — 중복 적용 가능, clamp [0.55, 1.35]):
 *  - CCSI <85 → ×0.88 (소비심리 악화, 상승 반전 신뢰도 저하)
 *  - CCSI >108 → ×1.06 (소비심리 호전, 상승 반전 신뢰도 상승) [105→108: Lemmon&Portniaguina 2006]
 *  - VKOSPI: removed — handled by patterns.js regimeWeight (Doc26 §2, 3-tier fallback)
 *  - net_foreign_eok >1000 → ×1.08 (외국인 유의미한 순매수) [500→1000: Richards 2005 ~$75M]
 *  - earning_season=1 → ×0.93 (실적 불확실성, 패턴 예측력 저하)
 *  데모 데이터 소스는 조정 미적용 (source==='demo' 시 no-op)
 *
 * @param {Array} patterns - patternEngine.analyze() 결과
 */
function _applyMarketContextToPatterns(patterns) {
  if (!_marketContext || !patterns || patterns.length === 0) return;
  if (_marketContext.source === 'demo') return; // 데모 데이터는 실제 조정 미적용

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  var ccsi = _marketContext.ccsi;
  // [C-11 FIX] vkospi 제거 — patterns.js regimeWeight 3-tier cascade가 권위적 소스
  var netForeign = _marketContext.net_foreign_eok;
  var earningSeason = _marketContext.earning_season;

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var adj = 1.0;

    // CCSI 조정 (매수 패턴만)
    if (p.signal === 'buy' && ccsi != null) {
      // [V6-FIX] Baker-Wurgler (2006) + Lemmon-Portniaguina (2006): 0.88→0.90 (IC 0.02-0.04 range)
      if (ccsi < 85) adj *= 0.90;
      else if (ccsi > 108) adj *= 1.06;
    }

    // 외국인 유의미한 순매수 확인 (매수 패턴만) — [학술 수정] 500→1000억 (Richards 2005: ~$75M 이상)
    if (p.signal === 'buy' && netForeign != null && netForeign > 1000) adj *= 1.08;

    // 어닝시즌 (매수/매도 모두 — 실적 불확실성)
    if (earningSeason === 1) adj *= 0.93;

    // clamp [0.55, 1.35]
    adj = Math.max(0.55, Math.min(1.35, adj));

    if (adj !== 1.0) {
      p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// [Phase ECOS] 매크로 경제지표 기반 패턴·시그널 신뢰도 승수
// ══════════════════════════════════════════════════════════════
// 소스: macro_latest.json (ECOS API) + bonds_latest.json (ECOS 채권)
// 이론: IS-LM (Doc30), AD-AS (Doc30 §2), Mundell-Fleming (Doc30 §1.4),
//       Yield Curve Regime (Doc35 §3), MCS (Doc29 §6.2)
//
// 9개 독립 팩터 (곱셈 결합, clamp [0.70, 1.25]):
//   1. 경기국면 (cycle_phase) — IS-LM 균형점 방향
//   2. 수익률곡선 (slope_10y3y) — 경기 선행 시그널
//   3. 크레딧 레짐 (aa_spread) — 위험 프리미엄
//   4. 외인 시그널 (foreigner_signal) — UIP/Mundell-Fleming 자본유입
//   5. 패턴-특화 오버라이드 — doubleTop/Bottom 등 고WR 패턴 강화
//   6. MCS v2 (Doc30 §4.3) — PMI+CSI+수출+금리곡선+EPU+Taylor gap 가중합산
//   7. Taylor Rule Gap (Doc30 §4.1) — 정책금리와 테일러 준칙 괴리
//   8. VRP (Volatility Risk Premium) — VIX > 30: risk-off, VIX < 15: risk-on
//   9. 금리차 (rate_diff) — 한미 금리차 → 자본유출입 압력
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// [V48-Phase2] Server-side macro confidence wrapper.
// POSTs patterns + minimal context to /api/confidence/macro and copies the
// adjusted confidence values back. Falls back to the in-process client
// function when the endpoint is unreachable so feature parity is preserved
// during the Phase 2.5 rollout window.
// ══════════════════════════════════════════════════════════════
async function _fetchMacroConfidence(patterns) {
  if (!patterns || patterns.length === 0) return;
  // Same cross-API cascade short-circuit applied client-side: skip both
  // server fetch and fallback when ECOS group is down.
  if (typeof _getApiGroupHealth === 'function' && _getApiGroupHealth('ECOS') === 'down') {
    console.warn('[CROSS-API] ECOS down → macro 신뢰도 조정 전면 스킵');
    return;
  }
  var payloadPatterns = patterns.map(function (p) {
    return {
      type: p.type || p.pattern || '',
      signal: p.signal,
      confidence: p.confidence,
      confidencePred: p.confidencePred != null ? p.confidencePred : null,
    };
  });
  var ctx = {
    industry: currentStock ? (currentStock.industry || currentStock.sector || null) : null,
    volRegime: _currentVolRegime || 'mid',
    macro: _staleDataSources && _staleDataSources.has('macro_latest') ? null : _macroLatest,
    bonds: _staleDataSources && _staleDataSources.has('bonds_latest') ? null : _bondsLatest,
    kosis: _kosisLatest || null,
    macroComposite: _macroComposite || null,
    appliedFactors: Array.from(_appliedFactors || []),
  };
  try {
    // [V48-SEC Phase 3] _signPost adds HMAC signature + Bearer token headers.
    // AbortSignal.timeout is not supported in older Workers runtimes for Web Crypto
    // chained calls, so we use a manual AbortController.
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 4000);
    var r;
    try {
      r = await _signPost('/api/confidence/macro', { patterns: payloadPatterns, context: ctx });
    } finally { clearTimeout(timer); }
    if (r.ok) {
      var data = await r.json();
      var adj = (data && Array.isArray(data.patterns)) ? data.patterns : null;
      if (adj && adj.length === patterns.length) {
        for (var i = 0; i < patterns.length; i++) {
          if (adj[i].confidence != null) patterns[i].confidence = adj[i].confidence;
          if (adj[i].confidencePred != null) patterns[i].confidencePred = adj[i].confidencePred;
        }
        return;
      }
    }
    console.warn('[V48-Phase2.5] macro confidence server unavailable — confidence adjustment skipped');
  } catch (_e) {
    console.warn('[V48-Phase2.5] macro confidence server error — confidence adjustment skipped');
  }
  if (typeof showToast === 'function') {
    showToast('신뢰도 조정 일시 불가 - 새로고침 후 재시도', 'warn');
  }
}

// ══════════════════════════════════════════════════════════════
// [V48-Phase2] Server-side Phase 8 confidence wrapper.
// Mirrors _fetchMacroConfidence pattern; calls /api/confidence/phase8
// which loads flow_signals.json server-side (Phase 1 protected).
// ══════════════════════════════════════════════════════════════
async function _fetchPhase8Confidence(patterns) {
  if (!patterns || patterns.length === 0) return;
  var krxDown = (typeof _getApiGroupHealth === 'function' && _getApiGroupHealth('KRX') === 'down');
  var payloadPatterns = patterns.map(function (p) {
    return {
      type: p.type || p.pattern || '',
      signal: p.signal,
      confidence: p.confidence,
      confidencePred: p.confidencePred != null ? p.confidencePred : null,
    };
  });
  var ctx = {
    code: currentStock ? currentStock.code : null,
    volRegime: _currentVolRegime || 'mid',
    macroComposite: _macroComposite || null,
    optionsAnalytics: _optionsAnalytics || null,
    krxGroupDown: krxDown,
    staleSources: _staleDataSources ? Array.from(_staleDataSources) : [],
    appliedFactors: Array.from(_appliedFactors || []),
  };
  try {
    // [V48-SEC Phase 3] signed POST with HMAC + Bearer token.
    var r = await _signPost('/api/confidence/phase8', { patterns: payloadPatterns, context: ctx });
    if (r.ok) {
      var data = await r.json();
      var adj = (data && Array.isArray(data.patterns)) ? data.patterns : null;
      if (adj && adj.length === patterns.length) {
        for (var i = 0; i < patterns.length; i++) {
          if (adj[i].confidence != null) patterns[i].confidence = adj[i].confidence;
          if (adj[i].confidencePred != null) patterns[i].confidencePred = adj[i].confidencePred;
        }
        return;
      }
    }
    console.warn('[V48-Phase2.5] phase8 confidence server unavailable — confidence adjustment skipped');
  } catch (_e) {
    console.warn('[V48-Phase2.5] phase8 confidence server error — confidence adjustment skipped');
  }
  if (typeof showToast === 'function') {
    showToast('신뢰도 조정 일시 불가 - 새로고침 후 재시도', 'warn');
  }
}

function _applyMacroConfidenceToPatterns(patterns) {
  throw new Error('[V48-Phase2.5] removed; see /api/confidence/macro');
}

// ══════════════════════════════════════════════════════════════
// [D-2] RORO 3-체제 프레임워크 (Risk-On / Risk-Off / Neutral)
//
// 5-factor 복합 스코어 → 히스테리시스 체제 분류 → 패턴 방향 편향.
// 기존 10-factor 매크로 조정과 독립 레이어로 운용.
// clamp [0.92, 1.08]: VIX(Factor8)/credit(Factor3) 이중 적용 방지.
//
// 이론: Baele, Bekaert & Inghelbrecht (2010) "The Determinants of Stock and Bond Return Comovements", RFS 23(6)
// ══════════════════════════════════════════════════════════════
function _classifyRORORegime() {
  var score = 0;
  var count = 0;

  // ── Factor 1: VKOSPI/VIX 수준 (weight 0.30) ──
  var vkospi = null;
  if (_marketContext && _marketContext.vkospi != null) {
    vkospi = _marketContext.vkospi;
  } else if (_macroLatest && _macroLatest.vkospi != null) {
    vkospi = _macroLatest.vkospi;
  } else if (_macroLatest && _macroLatest.vix != null) {
    // [DEPRECATED FALLBACK] VIX→VKOSPI proxy — offline only (real VKOSPI in vkospi.json)
    // [P0-C8] 1.15 → VIX_VKOSPI_PROXY 통일 (signalEngine.js와 일관성)
    vkospi = _macroLatest.vix * VIX_VKOSPI_PROXY;
  }
  if (vkospi != null) {
    var volScore;
    if (vkospi > 30) volScore = -1.0;       // crisis
    else if (vkospi > 22) volScore = -0.5;  // elevated
    else if (vkospi < 15) volScore = 0.5;   // calm
    else volScore = 0.0;                     // normal (15-22)
    score += volScore * 0.30;
    count++;
  }

  // ── Factor 2: 신용스프레드 (weight 0.20, 양분) ──
  var aaSpread = _bondsLatest && _bondsLatest.credit_spreads
    ? _bondsLatest.credit_spreads.aa_spread : null;
  if (aaSpread != null) {
    var csScore;
    if (aaSpread > 1.5) csScore = -1.0;       // stress
    else if (aaSpread > 1.0) csScore = -0.5;  // elevated
    else if (aaSpread < 0.5) csScore = 0.3;   // tight (risk-on)
    else csScore = 0.0;                        // normal
    // [V22-B] AA- credit weight 0.10 복원: _appliedFactors.has('RISK_CREDIT') guard가
    // Macro Factor 3와의 이중 반영을 명시적으로 차단하므로 weight 완화 불필요.
    // (기존 [RX-06] 0.10→0.05 완화는 guard 없던 시절의 heuristic. V22-B guard로 대체.)
    score += csScore * 0.10;
    count++;
  }
  var hySpread = _macroLatest ? _macroLatest.us_hy_spread : null;
  if (hySpread != null) {
    var hyScore;
    if (hySpread > 5.0) hyScore = -1.0;
    else if (hySpread > 4.0) hyScore = -0.5;
    else if (hySpread < 3.0) hyScore = 0.3;
    else hyScore = 0.0;
    score += hyScore * 0.10;
    count++;
  }

  // ── Factor 3: USD/KRW 수준 (weight 0.20) ──
  var usdkrw = _macroLatest ? _macroLatest.usdkrw : null;
  if (usdkrw != null) {
    var fxScore;
    if (usdkrw > 1450) fxScore = -1.0;       // KRW 급약세
    else if (usdkrw > 1350) fxScore = -0.5;  // 약세
    else if (usdkrw < 1200) fxScore = 0.5;   // 강세
    else if (usdkrw < 1100) fxScore = 1.0;   // 급강세
    else fxScore = 0.0;                       // 중립 (1200-1350)
    score += fxScore * 0.20;
    count++;
  }

  // ── Factor 4: MCS v2 (weight 0.15) ──
  var mcs = _macroLatest ? _macroLatest.mcs : null;
  if (mcs != null) {
    // MCS [0,1] → [-1,+1]: 0.5=neutral, >0.6=risk-on, <0.4=risk-off
    var mcsScore = (mcs - 0.5) * 2;
    score += mcsScore * 0.15;
    count++;
  }

  // ── Factor 5: 투자자 정렬 (weight 0.15) ──
  // [AUDIT-FIX] naver source discount 반영
  if (_investorData && _investorData.alignment != null) {
    var flowScore;
    var alignment = _investorData.alignment;
    if (typeof alignment === 'object') alignment = alignment.signal_1d;
    if (alignment === 'aligned_buy') flowScore = 0.8;
    else if (alignment === 'aligned_sell') flowScore = -0.8;
    else flowScore = 0.0;
    var srcDisc = _investorData._sourceDiscount || 1.0;
    score += flowScore * srcDisc * 0.15;
    count++;
  }

  // ── 정규화: 유효 입력 3개 미만 시 비례 할인 ──
  if (count === 0) {
    _currentRORORegime = 'neutral';
    _roroScore = 0;
    return;
  }
  var normalizedScore = score * Math.min(count / 3, 1.0);

  // ── 히스테리시스 체제 전환 ──
  var ENTER_ON = 0.25, ENTER_OFF = -0.25;
  var EXIT_ON = 0.10, EXIT_OFF = -0.10;
  var prev = _currentRORORegime;
  var next;

  if (prev === 'neutral') {
    if (normalizedScore >= ENTER_ON) next = 'risk-on';
    else if (normalizedScore <= ENTER_OFF) next = 'risk-off';
    else next = 'neutral';
  } else if (prev === 'risk-on') {
    if (normalizedScore <= EXIT_ON) next = (normalizedScore <= ENTER_OFF) ? 'risk-off' : 'neutral';
    else next = 'risk-on';
  } else {
    // prev === 'risk-off'
    if (normalizedScore >= EXIT_OFF) next = (normalizedScore >= ENTER_ON) ? 'risk-on' : 'neutral';
    else next = 'risk-off';
  }

  _currentRORORegime = next;
  _roroScore = normalizedScore;
}

// ── RORO 체제 기반 패턴 방향 편향 적용 ──
// risk-on: 매수 +6%, 매도 -6%  |  risk-off: 매수 -8%, 매도 +8%
// clamp [0.92, 1.08]: 기존 Factor 3(credit), Factor 8(VIX) 이중 적용 방지
function _applyRORORegimeToPatterns(patterns) {
  if (!patterns || patterns.length === 0) return;
  if (_currentRORORegime === 'neutral') return;

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  var buyAdj, sellAdj;
  if (_currentRORORegime === 'risk-on') {
    buyAdj = 1.06; sellAdj = 0.94;
  } else {
    buyAdj = 0.92; sellAdj = 1.08;
  }

  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p.signal !== 'buy' && p.signal !== 'sell') continue;  // neutral → skip
    var adj = (p.signal === 'buy') ? buyAdj : sellAdj;
    // clamp [0.92, 1.08]
    adj = Math.max(0.92, Math.min(1.08, adj));
    p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
    if (p.confidencePred != null) {
      p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
    }
  }
}

// ══════════════════════════════════════════════════════════════
// [Phase 2-D] 미시경제 지표 계산 + 캐시
// ══════════════════════════════════════════════════════════════
function _updateMicroContext(candleData) {
  if (!candleData || candleData.length < 21) { _microContext = null; return; }
  var illiq = (typeof calcAmihudILLIQ === 'function') ? calcAmihudILLIQ(candleData) : null;

  // HHI mean-reversion boost (industry 기반, ALL_STOCKS 필요)
  var hhiBoost = 0;
  if (currentStock && typeof ALL_STOCKS !== 'undefined' && ALL_STOCKS.length > 0) {
    var ind = currentStock.industry || currentStock.sector || '';
    if (ind) {
      var totalCap = 0, sectorCaps = [];
      for (var i = 0; i < ALL_STOCKS.length; i++) {
        var s = ALL_STOCKS[i];
        if ((s.industry || s.sector || '') === ind && s.marketCap > 0) {
          sectorCaps.push(s.marketCap);
          totalCap += s.marketCap;
        }
      }
      if (sectorCaps.length >= 2 && totalCap > 0) {
        var hhi = 0;
        for (var j = 0; j < sectorCaps.length; j++) {
          var sh = sectorCaps[j] / totalCap;
          hhi += sh * sh;
        }
        // HHI_MEAN_REV_COEFF = 0.10 (#119, Doc33 §6.2)
        // [V6-FIX] B-5 M-1: eps_stability mediator — Jensen-Meckling (1976)
        // eps_stability = 1/(1 + sigma_NI_growth/100), dampens HHI boost for volatile earnings
        var epsStab = 1.0;  // fallback: neutral
        if (typeof _financialCache !== 'undefined' && _financialCache && currentStock) {
          var fData = _financialCache[currentStock.code];
          if (fData && fData.ni_history && fData.ni_history.length >= 3) {
            var niArr = fData.ni_history;
            var growths = [];
            for (var g = 1; g < niArr.length; g++) {
              if (niArr[g-1] !== 0) growths.push((niArr[g] - niArr[g-1]) / Math.abs(niArr[g-1]) * 100);
            }
            if (growths.length >= 2) {
              var gMean = 0; for (var gm = 0; gm < growths.length; gm++) gMean += growths[gm];
              gMean /= growths.length;
              var gVar = 0; for (var gv = 0; gv < growths.length; gv++) gVar += (growths[gv] - gMean) * (growths[gv] - gMean);
              var sigmaNI = Math.sqrt(gVar / growths.length);
              epsStab = 1 / (1 + sigmaNI / 100);
            }
          }
        }
        hhiBoost = 0.10 * hhi * epsStab;
      }
    }
  }

  _microContext = { illiq: illiq, hhiBoost: hhiBoost };
}

// ══════════════════════════════════════════════════════════════
// [Phase 2-D] 미시경제 지표 기반 패턴 신뢰도 보정
// ══════════════════════════════════════════════════════════════
// Amihud ILLIQ (Doc18 §3.1) — 유동성 할인
// HHI Mean-Reversion Boost (Doc33 §6.2) — 업종 집중도
// _applyMacroConfidenceToPatterns() 직후 호출
// clamp: [0.80, 1.15] (미시 보정은 매크로보다 좁은 범위)
// ══════════════════════════════════════════════════════════════
// [V6-FIX] B-5 M-5: Short-selling ban periods — Miller (1977), Diamond-Verrecchia (1987)
// During bans: bearish patterns less reliable (can't short), bullish slightly less (no price discovery)
var _SHORT_BAN_PERIODS = [
  { start: '2020-03-16', end: '2021-05-02' },   // COVID-19 emergency
  { start: '2023-11-06', end: '2025-03-30' }     // Latest ban (KOSPI200/KOSDAQ150 partial lift)
];
function _isInShortBan(dateStr) {
  if (!dateStr) return false;
  for (var b = 0; b < _SHORT_BAN_PERIODS.length; b++) {
    if (dateStr >= _SHORT_BAN_PERIODS[b].start && (!_SHORT_BAN_PERIODS[b].end || dateStr <= _SHORT_BAN_PERIODS[b].end)) return true;
  }
  return false;
}

function _applyMicroConfidenceToPatterns(patterns, microCtx) {
  if (!patterns || patterns.length === 0 || !microCtx) return;

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  var MEAN_REV_TYPES = {
    doubleBottom: true, doubleTop: true,
    headAndShoulders: true, inverseHeadAndShoulders: true
  };

  // Determine short-ban status from latest candle date
  var shortBanActive = false;
  if (typeof candles !== 'undefined' && candles && candles.length > 0) {
    var lastDate = candles[candles.length - 1].time;
    if (typeof lastDate === 'string') shortBanActive = _isInShortBan(lastDate);
  }

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var adj = 1.0;

    // 1. Amihud ILLIQ 유동성 할인 (Doc18 §3.1, Kyle 1985)
    if (microCtx.illiq && microCtx.illiq.confDiscount < 1.0) {
      adj *= microCtx.illiq.confDiscount;
    }

    // 2. HHI Mean-Reversion Boost (Doc33 §6.2, #119 HHI_MEAN_REV_COEFF=0.10)
    var pType = p.type || p.pattern || '';
    if (MEAN_REV_TYPES[pType] && microCtx.hhiBoost > 0) {
      adj *= (1 + microCtx.hhiBoost);
    }

    // 3. Short-selling ban adjustment (Miller 1977: constraints → overpricing)
    if (shortBanActive) {
      if (p.signal === 'sell') adj *= 0.70;   // bearish patterns unreliable during ban
      else if (p.signal === 'buy') adj *= 0.90; // bullish slightly dampened (no price discovery)
    }

    // clamp [0.55, 1.15] — widened from 0.80 to accommodate short-ban 0.70 effect
    adj = Math.max(0.55, Math.min(1.15, adj));

    if (adj !== 1.0) {
      p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// [V38 CONF-M2] EVA Spread 기반 매수 패턴 신뢰도 부스트
//
// Stern Stewart (1991): EVA = NOPAT - WACC × IC
// evaSpread > 0 → 가치 창출 기업 → 매수 패턴 신뢰도 0~15% 상향.
// 10계층 체인 Layer 4(미시) 직후, Layer 5(파생) 전에 삽입.
// ══════════════════════════════════════════════════════════════
function _applyEVAConfidenceToPatterns(patterns) {
  if (!patterns || patterns.length === 0) return;
  if (!_evaScoresData || !_evaScoresData.stocks) return;
  if (!currentStock || !currentStock.code) return;

  // Factor guard — 이중 적용 방지
  if (_appliedFactors.has('MICRO_EVA')) return;

  var stockEva = _evaScoresData.stocks[currentStock.code];
  if (!stockEva || stockEva.evaSpread == null || stockEva.evaSpread <= 0) return;

  _appliedFactors.add('MICRO_EVA');

  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  // Linear scaling: evaSpread 0~0.10 → boost 0~15%
  // 0.10 = 10%p ROIC-WACC spread cap (상위 ~5% 기업 수준)
  var boostPct = Math.min(stockEva.evaSpread / 0.10, 1.0) * 0.15;

  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p.signal !== 'buy') continue; // 매수 패턴만 부스트

    var adj = 1.0 + boostPct;
    p.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(p.confidence * adj)));
    if (p.confidencePred != null) {
      p.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(p.confidencePred * adj)));
    }
  }
}

// ══════════════════════════════════════════════════════════════
// [Phase ECOS-2] 복합 시그널 매크로 조건 조정
// ══════════════════════════════════════════════════════════════
// 5개 S/A-tier composite 시그널에 매크로 상태 기반 신뢰도 조정
// _applyMacroConfidenceToPatterns와 동일한 매크로 상태를 사용하되,
// 복합 시그널의 compositeId에 따라 특화된 조정 적용
// ══════════════════════════════════════════════════════════════
function _applyMacroConditionsToSignals(signals) {
  if (!signals || signals.length === 0) return;
  var macro = _macroLatest;
  var bonds = _bondsLatest;
  if (!macro && !bonds) return;

  // [V23] ATR 동적 cap
  var _capConf = getDynamicCap('confidence', _currentVolRegime);
  var _capPred = getDynamicCap('confidencePred', _currentVolRegime);

  var cp = macro && macro.cycle_phase;
  var phase = cp ? cp.phase : null;
  var slope = bonds ? bonds.slope_10y3y : (macro ? macro.term_spread : null);
  var inverted = bonds ? bonds.curve_inverted : false;
  var creditRegime = bonds ? bonds.credit_regime : null;
  var fSignal = macro ? macro.foreigner_signal : null;

  for (var si = 0; si < signals.length; si++) {
    var s = signals[si];
    if (s.type !== 'composite') continue;
    var cid = s.compositeId || '';
    var adj = 1.0;

    // sell_doubleTopNeckVol (baseConf=75): contraction/peak + 역전 → 강화
    if (cid === 'sell_doubleTopNeckVol') {
      if (phase === 'contraction' || phase === 'peak') adj *= 1.08;
      if (inverted || (slope != null && slope < 0)) adj *= 1.10;
      if (creditRegime === 'stress') adj *= 1.06;
    }

    // buy_doubleBottomNeckVol (baseConf=72): trough + 정상곡선 → 강화
    if (cid === 'buy_doubleBottomNeckVol') {
      if (phase === 'trough') adj *= 1.12;
      else if (phase === 'contraction') adj *= 0.90;
      if (slope != null && slope > 0.3) adj *= 1.05;
      if (fSignal != null && fSignal > 0.3) adj *= 1.06;
    }

    // strongSell_shootingMacdVol (baseConf=69): tightening + 역전 → 강화
    if (cid === 'strongSell_shootingMacdVol') {
      if (phase === 'peak' || phase === 'contraction') adj *= 1.06;
      if (inverted) adj *= 1.08;
    }

    // sell_shootingStarBBVol (baseConf=69): 고변동 레짐에서 BB 저항 강화
    if (cid === 'sell_shootingStarBBVol') {
      if (creditRegime === 'elevated' || creditRegime === 'stress') adj *= 1.05;
      if (phase === 'peak') adj *= 1.04;
    }

    // sell_engulfingMacdAlign (baseConf=66): CLI 하락 모멘텀 → 강화
    if (cid === 'sell_engulfingMacdAlign') {
      if (phase === 'peak' || phase === 'contraction') adj *= 1.06;
      if (fSignal != null && fSignal < -0.3) adj *= 1.05;
    }

    // [V38] signal clamp: 패턴 거시 클램프 [0.70, 1.30]과 통일
    adj = Math.max(0.70, Math.min(1.30, adj));

    if (adj !== 1.0) {
      s.confidence = Math.max(_capConf[0], Math.min(_capConf[1], Math.round(s.confidence * adj)));
      if (s.confidencePred != null) {
        s.confidencePred = Math.max(_capPred[0], Math.min(_capPred[1], Math.round(s.confidencePred * adj)));
      }
    }
  }
}

/**
 * Signal에 Wc 주입 — detectedPatterns의 평균 wc를 모든 시그널에 매칭
 * wc가 없는 패턴(seed/null)은 평균 계산에서 제외
 */
function _injectWcToSignals(signals, patterns) {
  if (!signals || signals.length === 0) return;
  if (!patterns || patterns.length === 0) return;
  var sum = 0, cnt = 0;
  for (var wi = 0; wi < patterns.length; wi++) {
    if (patterns[wi].wc != null) { sum += patterns[wi].wc; cnt++; }
  }
  var avgWc = cnt > 0 ? sum / cnt : 1;
  for (var si = 0; si < signals.length; si++) {
    signals[si].wc = avgWc;
  }
}

/**
 * 메인 스레드 분석 (Worker 미지원 / 에러 시 폴백)
 * [V48-Phase2.5] async 전환: macro/phase8 신뢰도 조정을 서버 fetch wrapper로 위임.
 * 캐시 히트 시 50-80ms / miss 시 100-200ms 추가 latency. Worker 경로와 일관성 확보.
 */
async function _analyzeOnMainThread() {
  const analyzeCandles = (_realtimeMode && candles.length > 1) ? candles.slice(0, -1) : candles;
  // 캔들 패턴 + 복합 시그널 분석 (signalEngine이 IndicatorCache를 공유)
  detectedPatterns = patternEngine.analyze(analyzeCandles, { timeframe: currentTimeframe, market: currentStock && currentStock.market ? currentStock.market : '' });
  const result = signalEngine.analyze(analyzeCandles, detectedPatterns);
  detectedSignals = result.signals;
  // [Phase I] S/R proximity boost — support/resistance 근접 신호 강화
  if (detectedPatterns._srLevels && typeof signalEngine.applySRProximityBoost === 'function') {
    signalEngine.applySRProximityBoost(detectedSignals, analyzeCandles, detectedPatterns._srLevels, result.cache);
  }
  // [V22-B] factor guard Set 초기화 — 메인 스레드 폴백 경로
  _appliedFactors.clear();
  // [V22-B] main-thread ATR vol regime 캐시 업데이트
  try {
    if (typeof classifyAtrVolRegime === 'function' && typeof calcATR === 'function') {
      _currentVolRegime = classifyAtrVolRegime(calcATR(candles, 14));
    }
  } catch (_e) { _currentVolRegime = 'mid'; }
  // [V23] PCA budget: save initial confidence before adjustment chain
  for (var bi = 0; bi < detectedPatterns.length; bi++) {
    detectedPatterns[bi]._confBefore = detectedPatterns[bi].confidence;
  }
  // [Phase I-L2] 외부 시장 맥락 신뢰도 조정 (market_context.json 로드 시)
  _applyMarketContextToPatterns(detectedPatterns);
  // [D-2] RORO 3-체제 분류 + 패턴 방향 편향 (매크로 조정 전 상위 레이어)
  _classifyRORORegime();
  _applyRORORegimeToPatterns(detectedPatterns);
  _markFactorsAfterRORO();  // [V22-B] RORO가 consume한 factor 등록
  // [Phase ECOS] 매크로 경제지표 기반 신뢰도 조정 (macro_latest + bonds_latest)
  // [V48-Phase2.5] 서버 위임 — 실패 시 신뢰도 조정 스킵 + toast 안내
  try { await _fetchMacroConfidence(detectedPatterns); }
  catch (_e) { console.warn('[V48-Phase2.5] macro fetch threw on main thread', _e); }
  _markFactorsAfterMacro();  // [V22-B] Macro가 consume한 factor 등록
  // [Phase 2-D] 미시경제 지표 기반 신뢰도 조정 (ILLIQ, HHI)
  _updateMicroContext(candles);
  _applyMicroConfidenceToPatterns(detectedPatterns, _microContext);
  // [V38 CONF-M2] EVA Spread 매수 패턴 신뢰도 부스트 (Layer 4 직후)
  _applyEVAConfidenceToPatterns(detectedPatterns);
  // [FIX] Worker 경로와 동일하게 파생상품 신뢰도 조정 추가
  _applyDerivativesConfidenceToPatterns(detectedPatterns);
  // [D-4] Merton Distance-to-Default 신용위험 기반 신뢰도 조정 (비금융주)
  _calcNaiveDD(candles.map(function(c) { return c.close; }));
  _applyMertonDDToPatterns(detectedPatterns);
  // [P0-C9] Phase 8 MCS + HMM 레짐 + 수급 + 옵션 + DD 통합 조정 (Worker 경로와 동일)
  // [V48-Phase2.5] 서버 위임
  try { await _fetchPhase8Confidence(detectedPatterns); }
  catch (_e) { console.warn('[V48-Phase2.5] phase8 fetch threw on main thread', _e); }
  // [D-1] Survivorship bias: mild confidence discount for buy patterns
  _applySurvivorshipAdjustment(detectedPatterns);
  // [V23] PCA effect budget — cap correlated factor cumulative adjustment
  _applyPCABudgetCap(detectedPatterns);
  // [V6-FIX] C-1: Compound floor (drag/resize path — same as Worker path)
  for (var cf = 0; cf < detectedPatterns.length; cf++) {
    if (detectedPatterns[cf].confidence != null && detectedPatterns[cf].confidence < 25) {
      detectedPatterns[cf].confidence = 25;
    }
  }
  _applyMacroConditionsToSignals(detectedSignals);
  _injectWcToSignals(detectedSignals, detectedPatterns);
  signalStats = result.stats;

  // 차트 패턴 구조선 보존 (드래그 시 소실 방지)
  _saveChartPatternStructLines(detectedPatterns);

  // 사이드바 패턴 수 갱신 (카테고리별 분류)
  if (currentStock && typeof sidebarManager !== 'undefined') {
    const categorized = _categorizePatterns(detectedPatterns, detectedSignals);
    sidebarManager.setPatternCount(currentStock.code, categorized);
  }
  // 복합 시그널 중 마커가 있는 것을 패턴 목록에 병합 (차트 표시용)
  const compositeWithMarkers = detectedSignals
    .filter(s => s.type === 'composite' && s.marker)
    .map(s => ({ ...s, endIndex: s.index, startIndex: s.index }));
  renderPatternPanel([...detectedPatterns, ...compositeWithMarkers]);

  // 패턴 감지 알림 (패턴 수 변경 시에만 — 반복 toast 방지)
  if (detectedPatterns.length > 0 && detectedPatterns.length !== _prevPatternCount) {
    showToast(detectedPatterns.length + '개 패턴 감지됨', 'info');
  }
  _prevPatternCount = detectedPatterns.length;
}

/**
 * 드래그 시 메인 스레드 분석 (Worker 미지원 / 에러 시 폴백)
 * visibleCandles만 분석 후 인덱스 오프셋 보정
 * [V48-Phase2.5] async 전환: macro/phase8 신뢰도 조정을 서버 fetch wrapper로 위임.
 */
async function _analyzeDragOnMainThread(visibleCandles, clampFrom) {
  const visiblePatterns = patternEngine.analyze(visibleCandles, { timeframe: currentTimeframe, market: currentStock && currentStock.market ? currentStock.market : '' });

  // 인덱스 오프셋 보정: visibleCandles[0]이 candles[clampFrom]
  visiblePatterns.forEach(p => {
    if (p.startIndex != null) p.startIndex += clampFrom;
    if (p.endIndex != null) p.endIndex += clampFrom;
  });

  // 보존된 차트 패턴 구조선 병합 (드래그 시 소실 방지)
  detectedPatterns = _mergeChartPatternStructLines(visiblePatterns);

  // 드래그 시 신뢰도 조정 — 캐시된 전역 컨텍스트 값 활용, 재계산 없음
  // [V22-B] factor guard Set 초기화 — 드래그 경로
  _appliedFactors.clear();
  // [V22-B] drag 경로: 기존 _currentVolRegime 재사용 (드래그는 재계산 비활성)
  // [V23] PCA budget: save initial confidence
  for (var bi = 0; bi < detectedPatterns.length; bi++) {
    detectedPatterns[bi]._confBefore = detectedPatterns[bi].confidence;
  }
  _applyMarketContextToPatterns(detectedPatterns);
  _applyRORORegimeToPatterns(detectedPatterns);
  _markFactorsAfterRORO();  // [V22-B] RORO가 consume한 factor 등록
  // [V48-Phase2.5] 서버 위임 — 드래그는 신뢰도 조정 누락 허용 (UX 우선)
  try { await _fetchMacroConfidence(detectedPatterns); }
  catch (_e) { console.warn('[V48-Phase2.5] drag macro fetch threw', _e); }
  _markFactorsAfterMacro();  // [V22-B] Macro가 consume한 factor 등록
  _applyMicroConfidenceToPatterns(detectedPatterns, _microContext);
  // [V38 CONF-M2] EVA Spread 매수 패턴 신뢰도 부스트 (Layer 4 직후)
  _applyEVAConfidenceToPatterns(detectedPatterns);
  _applyDerivativesConfidenceToPatterns(detectedPatterns);
  _applyMertonDDToPatterns(detectedPatterns);
  try { await _fetchPhase8Confidence(detectedPatterns); }
  catch (_e) { console.warn('[V48-Phase2.5] drag phase8 fetch threw', _e); }
  _applySurvivorshipAdjustment(detectedPatterns);
  // [V23] PCA effect budget — cap correlated factor cumulative adjustment
  _applyPCABudgetCap(detectedPatterns);

  chartManager._drawPatterns(candles, chartType, _filterPatternsForViz(detectedPatterns));
  _renderOverlays();

  // 시그널도 보이는 구간으로 재분석
  if (typeof signalEngine !== 'undefined') {
    const result = signalEngine.analyze(visibleCandles, visiblePatterns.map(p => ({
      ...p,
      startIndex: p.startIndex != null ? p.startIndex - clampFrom : p.startIndex,
      endIndex: p.endIndex != null ? p.endIndex - clampFrom : p.endIndex,
    })));
    detectedSignals = result.signals;
    detectedSignals.forEach(s => {
      if (s.index != null) s.index += clampFrom;
    });
    _injectWcToSignals(detectedSignals, detectedPatterns);
    signalStats = result.stats;

    const filteredSignals = _filterSignalsByCategory(detectedSignals);
    if (typeof signalRenderer !== 'undefined') {
      signalRenderer.render(chartManager, candles, filteredSignals, {
        volumeActive: activeIndicators.has('vol'),
        chartType: chartType,
      });
    }
  }

  chartManager.setHoverData(candles, detectedPatterns, detectedSignals);

  const compositeWithMarkers = detectedSignals
    .filter(s => s.type === 'composite' && s.marker)
    .map(s => ({ ...s, endIndex: s.index, startIndex: s.index }));
  renderPatternPanel([...detectedPatterns, ...compositeWithMarkers]);
}

// ══════════════════════════════════════════════════════
