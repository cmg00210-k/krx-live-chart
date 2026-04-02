// ══════════════════════════════════════════════════════
//  KRX LIVE — App Worker (Worker 통신 + 분석 파이프라인)
//
//  Web Worker 초기화, 매크로/파생 데이터 로드,
//  패턴/시그널 신뢰도 조정, 메인 스레드 폴백 분석.
//  appState.js 전역 변수 참조.
// ══════════════════════════════════════════════════════

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
    _analysisWorker = new Worker('js/analysisWorker.js?v=29');

    _analysisWorker.onmessage = function (e) {
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
        // [Phase I-L2] 외부 시장 맥락 신뢰도 조정 (market_context.json 로드 시)
        _applyMarketContextToPatterns(detectedPatterns);
        // [Phase ECOS] 매크로 경제지표 기반 신뢰도 조정 (macro_latest + bonds_latest)
        _applyMacroConfidenceToPatterns(detectedPatterns);
        // [Phase 2-D] 미시경제 지표 기반 신뢰도 조정 (ILLIQ, HHI)
        _updateMicroContext(candles);
        _applyMicroConfidenceToPatterns(detectedPatterns, _microContext);
        // [Phase KRX-API] 파생상품·수급 데이터 기반 신뢰도 조정
        _applyDerivativesConfidenceToPatterns(detectedPatterns);
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
 * 매크로/채권 데이터 비동기 로드 — 차트 오버레이 정보용
 * data/macro/macro_latest.json (KTB10Y, USD/KRW, CPI 등)
 * data/macro/bonds_latest.json (수익률곡선 등)
 * 선택적 데이터: 로드 실패 시 무시 (기존 기능에 영향 없음)
 */
async function _loadMarketData() {
  try {
    var results = await Promise.allSettled([
      fetch('data/macro/macro_latest.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/macro/bonds_latest.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/macro/kosis_latest.json', { signal: AbortSignal.timeout(5000) }),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.ok)
      _macroLatest = await results[0].value.json();
    if (results[1].status === 'fulfilled' && results[1].value.ok)
      _bondsLatest = await results[1].value.json();
    if (results[2].status === 'fulfilled' && results[2].value.ok)
      _kosisLatest = await results[2].value.json();
    if (_macroLatest || _bondsLatest) {
      console.log('[KRX] 매크로/채권 데이터 로드 완료');
    }
    if (_kosisLatest) {
      console.log('[KRX] KOSIS 경제지표 로드 완료:', Object.keys(_kosisLatest).length, '개 필드');
    }
    // [B-4] VKOSPI 시계열 로드 → 최신 close를 _macroLatest.vkospi에 주입
    // data/vkospi.json: [{time,open,high,low,close}, ...] (download_derivatives.py 생성)
    try {
      var vkResp = await fetch('data/vkospi.json', { signal: AbortSignal.timeout(5000) });
      if (vkResp.ok) {
        var vkData = await vkResp.json();
        if (Array.isArray(vkData) && vkData.length > 0) {
          var latestVK = vkData[vkData.length - 1];
          if (latestVK && latestVK.close != null) {
            if (!_macroLatest) _macroLatest = {};
            if (_macroLatest.vkospi == null) {
              _macroLatest.vkospi = latestVK.close;
              console.log('[KRX] VKOSPI 로드:', latestVK.close, '(' + latestVK.time + ')');
            }
          }
        }
      }
    } catch (e) { /* vkospi.json 로드 실패 — 기존 VIX proxy fallback 유지 */ }
    // [H-2] 매크로 데이터에 VKOSPI/VIX가 있으면 Worker에 전달
    // _loadDerivativesData()와 병렬 실행되므로 양쪽 모두에서 호출 (중복 전송 안전)
    _sendMarketContextToWorker();
  } catch (e) { /* 선택적 데이터 — 실패 시 무시 */ }
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
  try {
    var results = await Promise.allSettled([
      fetch('data/derivatives/derivatives_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/investor_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/etf_summary.json', { signal: AbortSignal.timeout(5000) }),
      fetch('data/derivatives/shortselling_summary.json', { signal: AbortSignal.timeout(5000) }),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.ok)
      _derivativesData = await results[0].value.json();
    if (results[1].status === 'fulfilled' && results[1].value.ok)
      _investorData = await results[1].value.json();
    if (results[2].status === 'fulfilled' && results[2].value.ok)
      _etfData = await results[2].value.json();
    if (results[3].status === 'fulfilled' && results[3].value.ok)
      _shortSellingData = await results[3].value.json();
    var loaded = [_derivativesData, _investorData, _etfData, _shortSellingData].filter(Boolean).length;
    if (loaded > 0) {
      console.log('[KRX] 파생상품/수급 데이터 로드 완료 (' + loaded + '/4)');
    }

    // [H-2] Worker에 시장 맥락 데이터 주입 — signalEngine 레짐 분류용
    // 메인 스레드: 멀티플라이어 적용 (_applyDerivativesConfidenceToPatterns)
    // Worker: 레짐 분류만 (signalEngine._classifyVolRegimeFromVKOSPI 등)
    _sendMarketContextToWorker();
  } catch (e) { /* 선택적 데이터 — 실패 시 무시 */ }
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
    // VIX→VKOSPI proxy (same heuristic as signalEngine._classifyVolRegimeFromVKOSPI)
    var vix = _macroLatest.vix;
    var scale = vix < 20 ? 1.0 : vix < 30 ? 1.1 : 1.25;
    vkospi = vix * scale;
  }

  // derivatives_summary.json: PCR, basis
  var deriv = _derivativesData;
  if (Array.isArray(deriv) && deriv.length > 0) deriv = deriv[deriv.length - 1];
  var pcr = (deriv && deriv.pcr != null) ? deriv.pcr : null;
  var basis = (deriv && deriv.basis != null) ? deriv.basis : null;

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
  if (vkospi == null && pcr == null && basis == null && leverageRatio == null && foreignAlignment == null) return;

  _analysisWorker.postMessage({
    type: 'marketContext',
    vkospi: vkospi,
    pcr: pcr,
    basis: basis,
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

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var isBuy = (p.signal === 'buy');
    var adj = 1.0;

    // ── 1. 선물 베이시스 (Doc36 §3, Bessembinder & Seguin 1993) ──
    // 양의 베이시스(contango) = 낙관, 음의 베이시스(backwardation) = 비관
    if (deriv && deriv.basis != null) {
      var basis = deriv.basis;
      if (basis > 0.5) {          // contango: 시장 낙관
        adj *= isBuy ? 1.05 : 0.95;
      } else if (basis < -0.5) {  // backwardation: 시장 비관
        adj *= isBuy ? 0.95 : 1.05;
      }
    }

    // ── 2. PCR 역발상 (Doc37 §6, Pan & Poteshman 2006) ──
    // PCR > 1.3 = 극도의 공포 → 역발상 매수, PCR < 0.5 = 극도의 탐욕 → 역발상 매도
    if (deriv && deriv.pcr != null) {
      var pcr = deriv.pcr;
      if (pcr > 1.3) {
        adj *= isBuy ? 1.08 : 0.92;   // 극단적 공포 → 매수 유리
      } else if (pcr < 0.5) {
        adj *= isBuy ? 0.92 : 1.08;   // 극단적 탐욕 → 매도 유리
      }
    }

    // ── 3. 투자자 수급 alignment (Doc39 §6, Choe/Kho/Stulz 2005) ──
    // [C-2 FIX] alignment: object {signal_1d} 또는 string 모두 지원
    if (investor && investor.alignment) {
      var align = investor.alignment;
      if (align && typeof align === 'object') align = align.signal_1d;
      if (align === 'aligned_buy') {
        adj *= isBuy ? 1.08 : 0.93;   // 외국인+기관 동반 매수
      } else if (align === 'aligned_sell') {
        adj *= isBuy ? 0.93 : 1.08;   // 외국인+기관 동반 매도
      }
      // divergent/neutral: 조정 없음
    }

    // ── 4. ETF 레버리지 센티먼트 (Doc38 §3, Cheng & Madhavan 2009) ──
    if (etf && etf.leverageSentiment) {
      var sentiment = etf.leverageSentiment.sentiment;
      if (sentiment === 'strong_bullish') {
        adj *= isBuy ? 0.95 : 1.05;   // 극단적 낙관 → 역발상 (과열 경고)
      } else if (sentiment === 'strong_bearish') {
        adj *= isBuy ? 1.05 : 0.95;   // 극단적 비관 → 역발상 (바닥 근접)
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
      } else if (msr != null && msr < 2) {
        adj *= isBuy ? 0.97 : 1.03;   // 낮은 공매도 → 하방 보험 부족
      }
    }

    // [C-6 FIX] ERP는 signalEngine._detectERPSignal()에서만 처리 — 이중 적용 방지

    // clamp [0.70, 1.30]
    adj = Math.max(0.70, Math.min(1.30, adj));
    if (adj !== 1.0) {
      p.confidence = Math.max(10, Math.min(95, Math.round(p.confidence * adj)));
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

  var ccsi = _marketContext.ccsi;
  // [C-11 FIX] vkospi 제거 — patterns.js regimeWeight 3-tier cascade가 권위적 소스
  var netForeign = _marketContext.net_foreign_eok;
  var earningSeason = _marketContext.earning_season;

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var adj = 1.0;

    // CCSI 조정 (매수 패턴만)
    if (p.signal === 'buy' && ccsi != null) {
      if (ccsi < 85) adj *= 0.88;
      else if (ccsi > 108) adj *= 1.06;  // [학술 수정] 105→108 (Lemmon&Portniaguina 2006)
    }

    // 외국인 유의미한 순매수 확인 (매수 패턴만) — [학술 수정] 500→1000억 (Richards 2005: ~$75M 이상)
    if (p.signal === 'buy' && netForeign != null && netForeign > 1000) adj *= 1.08;

    // 어닝시즌 (매수/매도 모두 — 실적 불확실성)
    if (earningSeason === 1) adj *= 0.93;

    // clamp [0.55, 1.35]
    adj = Math.max(0.55, Math.min(1.35, adj));

    if (adj !== 1.0) {
      p.confidence = Math.max(10, Math.min(100, Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(10, Math.min(95, Math.round(p.confidencePred * adj)));
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
function _applyMacroConfidenceToPatterns(patterns) {
  if (!patterns || patterns.length === 0) return;
  var macro = _macroLatest;
  var bonds = _bondsLatest;
  if (!macro && !bonds) return;

  // ── 매크로 상태 추출 (null-safe) ──
  var cp = macro && macro.cycle_phase;
  var phase = cp ? cp.phase : null;          // expansion|peak|contraction|trough
  var cliDelta = cp ? cp.delta : null;       // 월간 CLI 변화량
  var slope = bonds ? bonds.slope_10y3y : (macro ? macro.term_spread : null);
  var inverted = bonds ? bonds.curve_inverted : false;
  var aaSpread = bonds && bonds.credit_spreads ? bonds.credit_spreads.aa_spread : null;
  var creditRegime = bonds ? bonds.credit_regime : null;
  var fSignal = macro ? macro.foreigner_signal : null;
  var taylorGap = macro ? macro.taylor_gap : null;
  var _stockIndustry = currentStock ? (currentStock.industry || currentStock.sector) : null;
  var _macroSector = _getStovallSector(_stockIndustry);

  for (var pi = 0; pi < patterns.length; pi++) {
    var p = patterns[pi];
    var isBuy = (p.signal === 'buy');
    var adj = 1.0;

    // ── 1. 경기국면 + Stovall(1996) 섹터 순환 (Doc30 §1, B-1) ──
    // 기본: IS-LM 균형점 방향 (expansion→buy, contraction→sell)
    // 섹터 차등: Stovall 매핑 (tech/semiconductor→trough 선도, utility→contraction 방어)
    if (phase) {
      var _sectorCycle = _macroSector ? _STOVALL_CYCLE[_macroSector] : null;
      if (_sectorCycle && _sectorCycle[phase] != null) {
        // Stovall 차등: 섹터별 buy_mult, sell_mult = 2.0 - buy_mult
        var buyMult = _sectorCycle[phase];
        adj *= isBuy ? buyMult : (2.0 - buyMult);
      } else {
        // 매핑 실패 시 기존 균일 조정 유지
        if (phase === 'expansion') {
          adj *= isBuy ? 1.06 : 0.94;
        } else if (phase === 'peak') {
          adj *= isBuy ? 0.95 : 1.08;
        } else if (phase === 'contraction') {
          adj *= isBuy ? 0.92 : 1.08;
        } else if (phase === 'trough') {
          adj *= isBuy ? 1.10 : 0.90;
        }
      }
    }

    // ── 2. 수익률곡선 4-체제 (B-2, Doc35 §3) ──
    // Bull/Bear: taylor_gap 부호로 추론 (dovish<0=Bull, hawkish>0=Bear)
    // Steepening/Flattening: slope 수준 (>0.2=Steep, <0.2=Flat)
    // 역전(slope<0): 최강 bearish → 별도 처리
    if (slope != null) {
      if (inverted || slope < 0) {
        // 역전: 12-18개월 경기침체 선행 → 최강 매수 억제
        adj *= isBuy ? 0.88 : 1.12;
      } else if (taylorGap != null) {
        var isBull = taylorGap < 0;     // dovish = Bull (금리 하락 기대)
        var isSteep = slope > 0.20;     // 정상 이상 → Steepening
        if (isBull && isSteep) {
          // Bull Steepening: 초기 완화 → 가장 위험선호적, 매수 강화
          adj *= isBuy ? 1.06 : 0.95;
        } else if (isBull && !isSteep) {
          // Bull Flattening: 장기 금리 하락 주도 → 성장 둔화 우려
          adj *= isBuy ? 0.97 : 1.03;
        } else if (!isBull && isSteep) {
          // Bear Steepening: 장기 금리 상승 → 인플레이션/공급 우려
          adj *= isBuy ? 0.95 : 1.04;
        } else {
          // Bear Flattening: 단기 금리 상승 주도 → 긴축, 경기침체 전조
          adj *= isBuy ? 0.90 : 1.10;
        }
      } else {
        // taylor_gap 없을 때: 기존 slope 수준 기반 fallback
        if (slope < 0.15) {
          adj *= isBuy ? 0.96 : 1.04;
        } else if (slope > 0.5) {
          adj *= isBuy ? 1.04 : 0.97;
        }
      }
    }

    // ── 3. 크레딧 레짐 (Doc35 §4, AA- 스프레드) ──
    // 스트레스: 신용위험 확대 → 모든 패턴 신뢰도 감소
    if (aaSpread != null) {
      if (aaSpread > 1.5 || creditRegime === 'stress') {
        adj *= 0.85;                  // 스트레스: -15% (전체)
      } else if (aaSpread > 1.0 || creditRegime === 'elevated') {
        adj *= isBuy ? 0.93 : 1.04;  // 주의: 매수 -7%, 매도 +4%
      }
      // normal: 조정 없음
    }

    // ── 4. 외인 시그널 (UIP, Mundell-Fleming 자본유입, Doc28 §8) ──
    // foreigner_signal > +0.3: 외인 순유입 → 매수 패턴 지지
    // foreigner_signal < -0.3: 외인 순유출 → 매도 패턴 지지
    if (fSignal != null) {
      if (fSignal > 0.3) {
        adj *= isBuy ? 1.05 : 0.96;  // 유입: 매수 +5%, 매도 -4%
      } else if (fSignal < -0.3) {
        adj *= isBuy ? 0.95 : 1.05;  // 유출: 매수 -5%, 매도 +5%
      }
    }

    // ── 5. 패턴-특화 오버라이드 (S-tier 고WR 패턴 매크로 연동) ──
    var pType = p.type || p.pattern || '';
    // doubleTop (WR=74.7%): contraction/peak + 역전 시 강화 (Doc30 §2 negative demand shock)
    if (pType === 'doubleTop' && !isBuy) {
      if ((phase === 'contraction' || phase === 'peak') && (inverted || (slope != null && slope < 0.15))) {
        adj *= 1.10;  // 경기하강+역전: 추가 +10%
      }
    }
    // doubleBottom (WR=62.1%): trough + steep curve 시 강화 (Doc30 §2 positive demand shock)
    if (pType === 'doubleBottom' && isBuy) {
      if (phase === 'trough' && slope != null && slope > 0.3) {
        adj *= 1.12;  // 회복기+정상곡선: 추가 +12%
      }
    }
    // bearishEngulfing (n=113K): BSI/CLI 하락 구간에서 신뢰도 증가
    if (pType === 'bearishEngulfing' && !isBuy && cliDelta != null && cliDelta < -0.1) {
      adj *= 1.06;    // CLI 하락 모멘텀: 추가 +6%
    }
    // [B-4] hammer (WR=47.9%, n=4293): ECOS 경기 국면 필터
    // Nison (1991): 해머는 하락 추세 반전 신호 → 경기 저점에서 강화, 확장기에서 약화
    // trough/contraction → 바닥 근처: 매수 반전 패턴 신뢰도 증가
    // expansion/peak → 상승 추세 중: 반전 신호 약화 (추세 지속 가능성 높음)
    if (pType === 'hammer' && isBuy) {
      if (phase === 'trough' || phase === 'contraction') {
        adj *= 1.06;  // 경기 저점/수축: +6% (반전 신호 강화)
      } else if (phase === 'expansion' || phase === 'peak') {
        adj *= 0.96;  // 상승 추세/정점: -4% (반전 신호 약화)
      }
    }
    // invertedHammer (WR=48.9%, n=6710): hammer와 동일 경기 국면 로직 적용
    if (pType === 'invertedHammer' && isBuy) {
      if (phase === 'trough' || phase === 'contraction') {
        adj *= 1.05;  // 경기 저점/수축: +5%
      } else if (phase === 'expansion' || phase === 'peak') {
        adj *= 0.97;  // 상승 추세/정점: -3%
      }
    }

    // ── 6. MCS v2 (Doc30 §4.3 Macro Context Score v2) ──
    // MCS > 0.6: 거시 강세 → 매수 패턴 부스트, 매도 패턴 감쇄
    // MCS < 0.4: 거시 약세 → 매도 패턴 부스트, 매수 패턴 감쇄
    // 0.4~0.6: 중립 → 조정 없음
    var mcs = macro ? macro.mcs : null;
    if (mcs != null) {
      if (mcs > 0.6) {
        var mcsAdj = 1.0 + (mcs - 0.6) * 0.25;  // 0.6→1.0, 1.0→1.10
        adj *= isBuy ? mcsAdj : (2.0 - mcsAdj);
      } else if (mcs < 0.4) {
        var mcsAdj = 1.0 + (0.4 - mcs) * 0.25;  // 0.4→1.0, 0.0→1.10
        adj *= isBuy ? (2.0 - mcsAdj) : mcsAdj;
      }
    }

    // ── 7. Taylor Rule Gap (Doc30 §4.1, 상수 #135-#141) ──
    // [N-4] ECOS 금리 방향 시그널: taylor_gap 부호가 금리 방향 프록시 역할 수행
    //   taylor_gap < 0 (dovish): 금리 인하 가능성 → 매수 부스트 (Factor 7이 자동 적용)
    //   taylor_gap > 0 (hawkish): 금리 인상 가능성 → 매도 부스트 (Factor 7이 자동 적용)
    //   → 별도 N-4 시그널 불필요: Factor 7에 의해 이미 완전 커버됨
    // Taylor-implied rate: i* = r* + pi + a_pi*(pi-pi*) + a_y*(y-y*)
    // taylor_gap > 0: 과도한 긴축 → 성장주 억압, 매도 지지
    // taylor_gap < 0: 과도한 완화 → 성장주 부양, 매수 지지
    // dead band: |gap| < 0.5%p → 조정 없음 (#141=0.25 normalized)
    // Sign convention: taylor_gap = i_actual - i_Taylor (Doc30 §4.1)
    //   gap > 0 → overtly tight (hawkish) → negative for equities → sell boost
    //   gap < 0 → overtly loose (dovish) → positive for equities → buy boost
    // taylorGap: for-루프 밖에서 선언됨 (line 571)
    if (taylorGap != null) {
      // tgNorm: gap을 [-2, +2] 범위에서 [-1, +1]로 정규화
      var tgNorm = Math.max(-1, Math.min(1, taylorGap / 2));
      if (tgNorm < -0.25) {
        // 완화적 (dovish): 매수 부스트, 매도 감쇄
        var tAdj = 1.0 + Math.abs(tgNorm) * 0.05;  // max ±5% (#140)
        adj *= isBuy ? tAdj : (2.0 - tAdj);
      } else if (tgNorm > 0.25) {
        // 긴축적 (hawkish): 매도 부스트, 매수 감쇄
        var tAdj = 1.0 + Math.abs(tgNorm) * 0.05;  // max ±5% (#140)
        adj *= isBuy ? (2.0 - tAdj) : tAdj;
      }
      // |tgNorm| <= 0.25: 중립 (dead band) → 조정 없음
    }

    // ── 8. VRP — Volatility Risk Premium (Doc26 §3, Carr-Wu 2009) ──
    // VIX > 30: risk-off, 모든 패턴 신뢰도 감소 (변동성 확대 → 패턴 노이즈)
    // VIX < 15: risk-on, 매수 패턴 소폭 부스트
    // 20~30: 정상 범위 → 조정 없음
    var vix = macro ? macro.vix : null;
    if (vix != null) {
      if (vix > 30) {
        adj *= 0.93;                    // high VIX: -7% (모든 패턴)
      } else if (vix > 25) {
        adj *= isBuy ? 0.97 : 1.02;    // elevated: 매수 -3%, 매도 +2%
      } else if (vix < 15) {
        adj *= isBuy ? 1.03 : 0.98;    // low vol: 매수 +3%, 매도 -2%
      }
    }

    // ── 9. 한미 금리차 (Mundell-Fleming, Doc30 §1.4 확장) ──
    // rate_diff = bok_rate - fed_rate. 음수: 한국 금리 < 미국 → 자본유출 압력
    // 현재 -1.14%p: 상당한 유출 압력
    var rateDiff = macro ? macro.rate_diff : null;
    if (rateDiff != null) {
      if (rateDiff < -1.5) {
        adj *= isBuy ? 0.95 : 1.04;    // 큰 역전: 매수 -5%, 매도 +4%
      } else if (rateDiff < -0.5) {
        adj *= isBuy ? 0.98 : 1.02;    // 소폭 역전: 매수 -2%, 매도 +2%
      } else if (rateDiff > 1.0) {
        adj *= isBuy ? 1.03 : 0.98;    // 한국 우위: 매수 +3%, 매도 -2%
      }
    }

    // ── 10. Rate Beta × 금리 방향 (B-3, Damodaran 2012) ──
    // Taylor gap + ktb10y 수준 → 섹터별 금리 민감도 차등 적용
    // hawkish(gap>0): rate_beta<0 섹터 매수 할인, rate_beta>0 섹터 매수 부스트
    // dovish(gap<0): 역방향 (금리 하락 → Utility/REIT 수혜)
    if (taylorGap != null && _macroSector) {
      var rBeta = _RATE_BETA[_macroSector];
      if (rBeta != null && rBeta !== 0) {
        // 금리 방향 정규화: taylor_gap을 [-2,+2] → [-1,+1]
        var rateDir = Math.max(-1, Math.min(1, taylorGap / 2));
        // 절대 금리 고수준 추가 압력: ktb10y > 4.0 → 민감도 1.5배 증폭
        var ktb10y = macro ? macro.ktb10y : null;
        var levelAmp = (ktb10y != null && ktb10y > 4.0) ? 1.5 : 1.0;
        // adj 적용: rateDir * rBeta * levelAmp (hawkish + 양의 beta = 매수 부스트)
        var rateAdj = rateDir * rBeta * levelAmp;
        adj *= isBuy ? (1.0 + rateAdj) : (1.0 - rateAdj);
      }
    }

    // ── clamp [0.70, 1.25] ──
    adj = Math.max(0.70, Math.min(1.25, adj));

    if (adj !== 1.0) {
      p.confidence = Math.max(10, Math.min(100, Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(10, Math.min(95, Math.round(p.confidencePred * adj)));
      }
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
        // TODO: eps_stability factor from Doc33 §5.2 — requires quarterly EPS variance data
        hhiBoost = 0.10 * hhi;
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
function _applyMicroConfidenceToPatterns(patterns, microCtx) {
  if (!patterns || patterns.length === 0 || !microCtx) return;

  var MEAN_REV_TYPES = {
    doubleBottom: true, doubleTop: true,
    headAndShoulders: true, inverseHeadAndShoulders: true
  };

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

    // clamp [0.80, 1.15]
    adj = Math.max(0.80, Math.min(1.15, adj));

    if (adj !== 1.0) {
      p.confidence = Math.max(10, Math.min(100, Math.round(p.confidence * adj)));
      if (p.confidencePred != null) {
        p.confidencePred = Math.max(10, Math.min(95, Math.round(p.confidencePred * adj)));
      }
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

    adj = Math.max(0.70, Math.min(1.25, adj));

    if (adj !== 1.0) {
      s.confidence = Math.max(10, Math.min(95, Math.round(s.confidence * adj)));
      if (s.confidencePred != null) {
        s.confidencePred = Math.max(10, Math.min(95, Math.round(s.confidencePred * adj)));
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
 * 메인 스레드 동기 분석 (Worker 미지원 / 에러 시 폴백)
 * 기존 로직과 동일
 */
function _analyzeOnMainThread() {
  const analyzeCandles = (_realtimeMode && candles.length > 1) ? candles.slice(0, -1) : candles;
  // 캔들 패턴 + 복합 시그널 분석 (signalEngine이 IndicatorCache를 공유)
  detectedPatterns = patternEngine.analyze(analyzeCandles, { timeframe: currentTimeframe, market: currentStock && currentStock.market ? currentStock.market : '' });
  const result = signalEngine.analyze(analyzeCandles, detectedPatterns);
  detectedSignals = result.signals;
  // [Phase I] S/R proximity boost — support/resistance 근접 신호 강화
  if (detectedPatterns._srLevels && typeof signalEngine.applySRProximityBoost === 'function') {
    signalEngine.applySRProximityBoost(detectedSignals, analyzeCandles, detectedPatterns._srLevels, result.cache);
  }
  // [Phase I-L2] 외부 시장 맥락 신뢰도 조정 (market_context.json 로드 시)
  _applyMarketContextToPatterns(detectedPatterns);
  // [Phase ECOS] 매크로 경제지표 기반 신뢰도 조정 (macro_latest + bonds_latest)
  _applyMacroConfidenceToPatterns(detectedPatterns);
  // [Phase 2-D] 미시경제 지표 기반 신뢰도 조정 (ILLIQ, HHI)
  _updateMicroContext(candles);
  _applyMicroConfidenceToPatterns(detectedPatterns, _microContext);
  // [FIX] Worker 경로와 동일하게 파생상품 신뢰도 조정 추가
  _applyDerivativesConfidenceToPatterns(detectedPatterns);
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
 * 드래그 시 메인 스레드 동기 분석 (Worker 미지원 / 에러 시 폴백)
 * visibleCandles만 분석 후 인덱스 오프셋 보정
 */
function _analyzeDragOnMainThread(visibleCandles, clampFrom) {
  const visiblePatterns = patternEngine.analyze(visibleCandles, { timeframe: currentTimeframe, market: currentStock && currentStock.market ? currentStock.market : '' });

  // 인덱스 오프셋 보정: visibleCandles[0]이 candles[clampFrom]
  visiblePatterns.forEach(p => {
    if (p.startIndex != null) p.startIndex += clampFrom;
    if (p.endIndex != null) p.endIndex += clampFrom;
  });

  // 보존된 차트 패턴 구조선 병합 (드래그 시 소실 방지)
  detectedPatterns = _mergeChartPatternStructLines(visiblePatterns);
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
