// ══════════════════════════════════════════════════════
//  KRX LIVE — 앱 상태 관리 & UI 이벤트 v2.0
//
//  분리된 모듈:
//    - patternPanel.js: PATTERN_ACADEMIC_META, 패턴 카드/수익률 UI
//    - financials.js: 재무지표 패널 (우측 D열)
// ══════════════════════════════════════════════════════


// ── 상태 ──
let currentStock = ALL_STOCKS[0];
let currentTimeframe = '1d';  // 기본 일봉 (장외에서도 데이터 있음)
let activeIndicators = new Set();
let chartType = 'candle';
let patternEnabled = false;
let detectedPatterns = [];
let detectedSignals = [];
let signalStats = {};
let candles = [];
let tickTimer = null;
let _lastPatternAnalysis = 0;
let _realtimeMode = false;
let _realtimeUnsub = null;
let _selectVersion = 0;
let _fallbackTimer = null;
let _prevPrice = null;       // 가격 변화 flash 감지용
let _kbNavTimer = null;      // 키보드 네비게이션 디바운스 타이머

// ── DOM 캐시 (빈번 조회 요소) ──
const _dom = {};
function _cacheDom() {
  _dom.rsiContainer = document.getElementById('rsi-chart-container');
  _dom.rsiLabel     = document.getElementById('rsi-label');
  _dom.macdContainer = document.getElementById('macd-chart-container');
  _dom.macdLabel    = document.getElementById('macd-label');
  _dom.mainContainer = document.getElementById('main-chart-container');
  // OHLC 바 요소 캐시 (crosshair 이동 시마다 호출되므로 DOM 조회 최소화)
  _dom.ohlcOpen  = document.getElementById('ohlc-open');
  _dom.ohlcHigh  = document.getElementById('ohlc-high');
  _dom.ohlcLow   = document.getElementById('ohlc-low');
  _dom.ohlcClose = document.getElementById('ohlc-close');
  _dom.ohlcVol   = document.getElementById('ohlc-vol');
}

// ── 시그널 카테고리 필터 상태 ──
let activeSignalCategories = new Set(['ma', 'macd', 'rsi', 'bb', 'volume', 'composite']);

// ── Web Worker 상태 (Phase 9) ──
let _analysisWorker = null;
let _workerReady = false;
let _workerVersion = 0;       // 종목/타임프레임 변경 시 증가, stale 결과 무시용
let _workerPending = false;    // Worker에 분석 요청 진행 중 여부
let _prevPatternCount = -1;    // 패턴 toast 중복 방지용
let _dragVersion = 0;          // 드래그 분석 stale 결과 무시용
let _dragDebounceTimer = null;  // 드래그 분석 150ms 디바운스
let _dragClampFrom = 0;        // 드래그 분석 인덱스 오프셋 (Worker 결과 보정용)

// ══════════════════════════════════════════════════════
//  Toast 알림 시스템
//
//  showToast(message, type) — type: 'info'|'success'|'warning'|'error'
//  자동 3초 후 소멸, 수동 닫기 가능, 최대 5개 스택
// ══════════════════════════════════════════════════════

const _TOAST_ICONS = { info: 'i', success: '\u2713', warning: '!', error: '\u2715' };
const _TOAST_MAX = 5;
const _TOAST_DURATION = 3000;

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) return;

  // 최대 개수 제한 — 오래된 것부터 제거
  while (container.children.length >= _TOAST_MAX) {
    container.removeChild(container.firstChild);
  }

  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML =
    '<span class="toast-icon">' + (_TOAST_ICONS[type] || 'i') + '</span>' +
    '<span class="toast-msg">' + message + '</span>' +
    '<button class="toast-close" title="\uB2EB\uAE30">&times;</button>';

  // 닫기 버튼
  el.querySelector('.toast-close').addEventListener('click', function () {
    _dismissToast(el);
  });

  container.appendChild(el);

  // 자동 소멸
  var timer = setTimeout(function () { _dismissToast(el); }, _TOAST_DURATION);
  el._toastTimer = timer;
}

function _dismissToast(el) {
  if (!el || !el.parentNode) return;
  if (el._toastTimer) clearTimeout(el._toastTimer);
  el.classList.add('toast-dismiss');
  el.addEventListener('transitionend', function () {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, { once: true });
  // transitionend가 실패할 경우 대비 (탭 비활성 등)
  setTimeout(function () {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 400);
}

// ══════════════════════════════════════════════════════
//  사용자 환경설정 저장/복원 (localStorage)
//
//  단일 키 'krx-prefs'에 JSON 객체로 저장:
//    { stock, timeframe, chartType, patternEnabled }
// ══════════════════════════════════════════════════════

const _PREFS_KEY = 'krx-prefs';

function _loadPrefs() {
  try {
    var raw = localStorage.getItem(_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _savePrefs(partial) {
  try {
    var prev = _loadPrefs() || {};
    var merged = Object.assign(prev, partial);
    localStorage.setItem(_PREFS_KEY, JSON.stringify(merged));
  } catch (e) {
    // localStorage 비활성 또는 용량 초과 — 무시
  }
}

/**
 * 복원된 환경설정을 툴바 UI에 반영
 * - 타임프레임 버튼 active 클래스
 * - 차트 타입 버튼 active 클래스
 * - 패턴 토글 버튼 + 관련 패널 표시
 */
function _applyPrefsToUI() {
  // 타임프레임 버튼
  document.querySelectorAll('.tf-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tf === currentTimeframe);
  });

  // 차트 타입 버튼
  document.querySelectorAll('.ct-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.ct === chartType);
  });

  // 패턴 토글 버튼 + 관련 UI
  var pBtn = document.getElementById('pattern-toggle');
  if (pBtn) pBtn.classList.toggle('active', patternEnabled);
  var summaryWrap = document.getElementById('pattern-summary-wrap');
  if (summaryWrap) summaryWrap.style.display = patternEnabled ? '' : 'none';
  var filterWrap = document.getElementById('signal-filter-wrap');
  if (filterWrap) filterWrap.style.display = patternEnabled ? '' : 'none';
  var retArea = document.getElementById('return-stats-area');
  if (retArea) retArea.style.display = patternEnabled ? '' : 'none';

  // 사이드바: 복원된 종목 활성 표시
  if (currentStock && typeof sidebarManager !== 'undefined' && sidebarManager.setActive) {
    sidebarManager.setActive(currentStock.code);
  }
}

// ══════════════════════════════════════════════════════
//  초기화
// ══════════════════════════════════════════════════════

async function init() {
  try {
    await dataService.initFromIndex();
  } catch (e) {
    showToast('종목 목록 로드 실패 — 기본 종목으로 시작합니다', 'error');
  }

  // localStorage에서 이전 환경설정 복원
  var prefs = _loadPrefs();

  // 종목 복원: 저장된 코드가 ALL_STOCKS에 존재하면 사용
  if (prefs && prefs.stock) {
    var restored = ALL_STOCKS.find(function (s) { return s.code === prefs.stock; });
    if (restored) currentStock = restored;
    else currentStock = ALL_STOCKS[0];
  } else {
    currentStock = ALL_STOCKS[0];
  }

  // 타임프레임 복원
  if (prefs && prefs.timeframe && TIMEFRAMES[prefs.timeframe]) {
    currentTimeframe = prefs.timeframe;
  }

  // 차트 타입 복원
  if (prefs && prefs.chartType && ['candle', 'line', 'bar'].indexOf(prefs.chartType) !== -1) {
    chartType = prefs.chartType;
  }

  // 패턴 활성 상태 복원
  if (prefs && typeof prefs.patternEnabled === 'boolean') {
    patternEnabled = prefs.patternEnabled;
  }

  // 종목 데이터 로드 알림
  showToast(ALL_STOCKS.length + '개 종목 데이터 로드 완료', 'success');

  // DOM 캐시 초기화
  _cacheDom();

  // 장 상태 표시 시작 (30초 간격 갱신)
  startMarketStateTimer();

  // Web Worker 초기화 (Phase 9)
  _initAnalysisWorker();

  // 사이드바 초기화
  sidebarManager.init();

  // 복원된 환경설정을 UI에 반영
  _applyPrefsToUI();

  // 차트 생성
  try {
    chartManager.createMainChart(_dom.mainContainer);
  } catch (e) {
    console.error('[KRX] 차트 초기화 실패:', e);
    showToast('차트 초기화 실패: ' + (e.message || '알 수 없는 오류'), 'error');
    return;
  }

  // 데이터 로드
  try {
    candles = await dataService.getCandles(currentStock, currentTimeframe);
  } catch (e) {
    console.error('[KRX] 캔들 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 데이터 로드 실패', 'error');
    candles = [];
  }
  if (candles.length > 0) {
    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    chartManager.setWatermark(currentStock.name);
  } else if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 캔들 수신 대기 (realtimeProvider.onTick에서 처리)
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(currentStock.name + ' (서버 연결 중...)');
  } else {
    chartManager.setWatermark(currentStock.name);
  }

  // 재무지표 초기화 (candles 로드 후 실행 → PER/PBR/PSR 계산 가능)
  updateFinancials();

  chartManager.onCrosshairMove(updateOHLCBar);

  // 패턴 호버 툴팁 콜백 등록
  chartManager.onPatternHover(handlePatternTooltip);

  // ── 드래그 시 보이는 구간의 패턴 즉시 감지 ──
  // KNOWSTOCK chart_widget.py 참고: 드래그 → _offset 변경 → _visible_slice() → repaint
  // 여기서는 subscribeVisibleLogicalRangeChange → 해당 구간 패턴 분석 → 즉시 렌더링
  chartManager.onVisibleRangeChange((from, to) => {
    if (!patternEnabled || !candles.length) return;

    // 보이는 구간의 캔들만 추출 (인덱스 보정 포함)
    const clampFrom = Math.max(0, from);
    const clampTo = Math.min(candles.length - 1, to);
    if (clampFrom >= clampTo) return;

    const visibleCandles = candles.slice(clampFrom, clampTo + 1);
    if (visibleCandles.length < 3) return;

    // 150ms 디바운스 — 빠른 드래그 시 마지막 위치만 분석
    if (_dragDebounceTimer) clearTimeout(_dragDebounceTimer);

    _dragDebounceTimer = setTimeout(() => {
      _dragDebounceTimer = null;

      // Worker가 준비되어 있으면 비동기 분석 요청
      if (_analysisWorker && _workerReady) {
        _dragVersion++;
        _dragClampFrom = clampFrom;   // 결과 수신 시 인덱스 보정에 사용
        _analysisWorker.postMessage({
          type: 'analyze',
          candles: visibleCandles,
          realtimeMode: false,        // 드래그 시점의 visible 구간 — 미완성 캔들 제외 불필요
          version: _dragVersion,
          source: 'drag',
        });
      } else {
        // 폴백: 메인 스레드 동기 분석
        _analyzeDragOnMainThread(visibleCandles, clampFrom);
      }
    }, 150);
  });

  // 시그널 필터 체크박스 이벤트
  initSignalFilter();

  // ── Phase 2: 추이 차트 탭 전환 이벤트 ──
  document.querySelectorAll('.fin-trend-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.fin-trend-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _finTrendMetric = tab.dataset.metric;
      drawFinTrendChart(_finTrendData, _finTrendMetric);
    });
  });

  // ── Phase 2: 추이 섹션 접기/펼치기 ──
  const trendToggle = document.getElementById('fin-trend-toggle');
  if (trendToggle) {
    trendToggle.addEventListener('click', () => {
      const body = document.getElementById('fin-trend-body');
      if (body) body.classList.toggle('collapsed');
      trendToggle.classList.toggle('collapsed');
    });
  }

  // ── 수익률 영역: 기간 탭 전환 (5일/10일/20일) ──
  document.querySelectorAll('.rs-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rs-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // 현재 패턴으로 그리드 + 테이블 재렌더링
      const compositeWithMarkers = detectedSignals
        .filter(s => s.type === 'composite' && s.marker)
        .map(s => ({ ...s, endIndex: s.index, startIndex: s.index }));
      updateReturnStatsGrid([...detectedPatterns, ...compositeWithMarkers]);
    });
  });

  // ── Phase 1: 면책 조항 접기/펼치기 ──
  const disclaimerToggle = document.getElementById('fin-disclaimer-toggle');
  if (disclaimerToggle) {
    disclaimerToggle.addEventListener('click', () => {
      const body = document.getElementById('fin-disclaimer-body');
      if (body) body.classList.toggle('show');
      // 토글 아이콘 변경
      disclaimerToggle.innerHTML = body && body.classList.contains('show')
        ? '면책 조항 &#9652;' : '면책 조항 &#9662;';
    });
  }

  // 실시간 데이터 시작
  startRealtimeTick();

  // 첫 방문자 온보딩 오버레이
  showOnboarding();
}

// ══════════════════════════════════════════════════════
//  온보딩 오버레이 (첫 방문자)
// ══════════════════════════════════════════════════════

function showOnboarding() {
  if (localStorage.getItem('krx-onboarded')) return;

  var tips = [
    { icon: '\uD83D\uDD0D', label: '종목 검색', text: '사이드바 또는 상단 검색창 사용' },
    { icon: '\uD83D\uDCC8', label: '차트 분석', text: '패턴이 자동으로 감지됩니다' },
    { icon: '\u2328',  label: '단축키',   text: '1-6 타임프레임, C 차트유형, P 패턴, / 검색' },
    { icon: '\uD83D\uDCCA', label: '재무지표', text: '우측 패널에서 DART 기반 재무분석 확인' }
  ];

  var overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';

  var card = document.createElement('div');
  card.className = 'onboarding-card';

  var title = document.createElement('div');
  title.className = 'onboarding-title';
  title.textContent = 'CheeseStock \uC2DC\uC791\uD558\uAE30';

  var list = document.createElement('ul');
  list.className = 'onboarding-tips';

  tips.forEach(function (tip) {
    var li = document.createElement('li');
    li.className = 'onboarding-tip';

    var iconEl = document.createElement('span');
    iconEl.className = 'onboarding-tip-icon';
    iconEl.textContent = tip.icon;

    var textEl = document.createElement('span');
    var labelEl = document.createElement('span');
    labelEl.className = 'onboarding-tip-label';
    labelEl.textContent = tip.label + ': ';
    textEl.appendChild(labelEl);
    textEl.appendChild(document.createTextNode(tip.text));

    li.appendChild(iconEl);
    li.appendChild(textEl);
    list.appendChild(li);
  });

  var btn = document.createElement('button');
  btn.className = 'onboarding-dismiss';
  btn.textContent = '\uC2DC\uC791\uD558\uAE30';

  function dismiss() {
    localStorage.setItem('krx-onboarded', '1');
    overlay.style.animation = 'onboardFadeIn .2s ease reverse forwards';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  btn.addEventListener('click', dismiss);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) dismiss();
  });

  card.appendChild(title);
  card.appendChild(list);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
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
    _analysisWorker = new Worker('js/analysisWorker.js');

    _analysisWorker.onmessage = function (e) {
      const msg = e.data;

      // ── Worker 준비 완료 ──
      if (msg.type === 'ready') {
        _workerReady = true;
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
          const dragSignals = msg.signals;

          // 인덱스 오프셋 보정: Worker는 visible 구간만 분석했으므로
          dragPatterns.forEach(function (p) {
            if (p.startIndex != null) p.startIndex += clampFrom;
            if (p.endIndex != null) p.endIndex += clampFrom;
          });

          detectedPatterns = dragPatterns;
          chartManager._drawPatterns(candles, chartType, detectedPatterns);
          if (typeof patternRenderer !== 'undefined') {
            patternRenderer.render(chartManager, candles, chartType, detectedPatterns);
          }

          // 시그널 인덱스 오프셋 보정
          dragSignals.forEach(function (s) {
            if (s.index != null) s.index += clampFrom;
          });
          detectedSignals = dragSignals;
          signalStats = msg.stats;

          const dragFiltered = _filterSignalsByCategory(detectedSignals);
          if (typeof signalRenderer !== 'undefined') {
            signalRenderer.render(chartManager, candles, dragFiltered, {
              volumeActive: activeIndicators.has('vol'),
              chartType: chartType,
            });
          }

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
        detectedSignals = msg.signals;
        signalStats = msg.stats;

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
        }

        // 차트에 패턴 렌더링 반영
        chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns);

        // 시그널 Canvas 시각화 (카테고리 필터 적용)
        const workerFiltered = _filterSignalsByCategory(detectedSignals);
        if (typeof signalRenderer !== 'undefined') {
          signalRenderer.render(chartManager, candles, workerFiltered, {
            volumeActive: activeIndicators.has('vol'),
            chartType: chartType,
          });
        }

        // 호버 감지 데이터 갱신
        chartManager.setHoverData(candles, detectedPatterns, workerFiltered);
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
      console.warn('[Worker] 치명적 에러, 메인 스레드 폴백:', err.message);
      showToast('분석 Worker 오류 — 메인 스레드로 전환', 'error');
      _analysisWorker = null;
      _workerReady = false;
      _workerPending = false;
    };

  } catch (err) {
    console.warn('[Worker] 생성 실패:', err.message);
    _analysisWorker = null;
    _workerReady = false;
  }
}

// ══════════════════════════════════════════════════════
//  실시간 데이터 (Kiwoom WebSocket → 데모 폴백)
// ══════════════════════════════════════════════════════

function startRealtimeTick() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (_realtimeUnsub) { _realtimeUnsub(); _realtimeUnsub = null; }
  if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

  _realtimeUnsub = realtimeProvider.onTick((data) => {
    if (data.error) {
      updateLiveStatus('offline');
      // WS 모드: 재연결을 기다림 (데모 데이터 생성 안 함)
      // WS 외: 데모 모드 전환 (정적 차트 유지)
      if (KRX_API_CONFIG.mode !== 'ws' && !tickTimer && !_realtimeMode) {
        startDemoTick();
      }
      return;
    }

    _realtimeMode = true;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

    // WebSocket 연결 상태 표시 (캔들 유무와 무관하게)
    const liveLabel = realtimeProvider.mode === 'ws' ? 'ws' : 'live';
    updateLiveStatus(liveLabel);

    // 캔들이 있을 때만 차트 업데이트
    if (data.candles && data.candles.length > 0) {
      candles = data.candles;

      // WS에서 받은 캔들을 dataService 캐시에도 반영
      if (currentStock) {
        const cacheKey = `${currentStock.code}-${currentTimeframe}`;
        dataService.cache[cacheKey] = { candles, lastUpdate: Date.now() };
      }

      updateChartFull();
      updateStockInfo();
      updateOHLCBar(null);
      sidebarManager.updatePrices();

      // 서버 캔들 수신 성공 → 워터마크를 종목명으로 복원
      if (currentStock) {
        chartManager.setWatermark(currentStock.name);
      }
    } else {
      console.log('[KRX] WS 캔들 수신: 빈 배열 (실시간 틱 대기 중)');
    }

    chartManager.updatePriceLines(data.currentPrice, data.dayHigh, data.dayLow, data.previousClose);
  });

  realtimeProvider.start(currentStock, currentTimeframe);

  // WS 모드: 서버 응답 대기 (Kiwoom 로그인+TR 포함하면 시간 소요 가능)
  if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 재연결은 realtimeProvider 내부에서 자동 처리
    // 서버 연결 실패 시 Naver Finance 폴백으로 정적 차트 표시
    _fallbackTimer = setTimeout(async () => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected) {
        console.warn('[KRX] WS 서버 연결 대기 중 (10초 타임아웃)...');
        updateLiveStatus('offline');

        // 차트가 비어있으면 폴백 시도
        if (candles.length === 0 && currentStock) {
          let fallbackCandles = [];
          let fallbackSource = '';
          if (currentTimeframe === '1d') {
            // 일봉: file 모드 데이터 시도
            fallbackCandles = await dataService._fileGetCandles(currentStock);
            fallbackSource = 'file';
          } else {
            // 분봉: Naver 시도 (CORS 허용 환경만), 실패 시 데모 폴백
            fallbackCandles = await dataService._naverMinuteCandles(currentStock.code, currentTimeframe);
            fallbackSource = 'Naver';
            if (fallbackCandles.length === 0) {
              fallbackCandles = dataService._demoGenerateCandles(currentStock, currentTimeframe);
              fallbackSource = '데모';
            }
          }
          if (fallbackCandles.length > 0) {
            candles = fallbackCandles;
            const cacheKey = `${currentStock.code}-${currentTimeframe}`;
            dataService.cache[cacheKey] = { candles, lastUpdate: Date.now() };
            updateChartFull();
            updateStockInfo();
            updateOHLCBar(null);
            const label = fallbackSource === 'file' ? '' : ` (${fallbackSource})`;
            chartManager.setWatermark(currentStock.name + label);
            console.log('[KRX] WS 미연결 — %s 폴백 데이터 로드: %s %s (%d건)',
              fallbackSource, currentStock.code, currentTimeframe, candles.length);
          }
        }
        // 서버 재연결 시 onTick 콜백에서 자동 복구 (Naver 데이터를 서버 데이터로 교체)
      }
    }, 10000);
  } else {
    // file/demo 모드: 짧은 대기 후 데모 전환
    _fallbackTimer = setTimeout(() => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected && !tickTimer) {
        console.log('[KRX] 실시간 연결 실패, 데모 모드 시작');
        startDemoTick();
      }
    }, 4000);
  }
}

function startDemoTick() {
  _realtimeMode = false;
  updateLiveStatus('demo');
  // 데모 모드: 정적 차트만 표시 (랜덤 틱 생성하지 않음)
  // 키움 서버 연결 전까지는 초기 로드된 데이터로 정적 차트 유지
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

// ── 전체 차트 업데이트 ──
function updateChartFull() {
  const now = Date.now();
  if (patternEnabled && now - _lastPatternAnalysis > 3000) {

    // Worker가 준비되어 있으면 비동기 분석 요청
    if (_analysisWorker && _workerReady) {
      _requestWorkerAnalysis();
    } else {
      // 폴백: 메인 스레드 동기 분석
      _analyzeOnMainThread();
    }

    _lastPatternAnalysis = now;
  } else if (!patternEnabled) {
    detectedPatterns = [];
    detectedSignals = [];
  }

  chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns);

  // 시그널 Canvas 시각화 (카테고리 필터 적용)
  const filteredSignals = _filterSignalsByCategory(detectedSignals);
  if (typeof signalRenderer !== 'undefined') {
    signalRenderer.render(chartManager, candles, filteredSignals, {
      volumeActive: activeIndicators.has('vol'),
      chartType: chartType,
    });
  }

  // 호버 감지용 데이터 설정 (패턴 + 필터된 시그널)
  chartManager.setHoverData(candles, detectedPatterns, filteredSignals);

  if (activeIndicators.has('rsi')) {
    _dom.rsiContainer.style.display = 'block';
    if (_dom.rsiLabel) _dom.rsiLabel.style.display = 'block';
    if (!chartManager.rsiChart) chartManager.createRSIChart(_dom.rsiContainer);
    chartManager.updateRSI(candles);
  } else {
    _dom.rsiContainer.style.display = 'none';
    if (_dom.rsiLabel) _dom.rsiLabel.style.display = 'none';
    chartManager.destroyRSI();
  }

  if (activeIndicators.has('macd')) {
    _dom.macdContainer.style.display = 'block';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'block';
    if (!chartManager.macdChart) chartManager.createMACDChart(_dom.macdContainer);
    chartManager.updateMACD(candles);
  } else {
    _dom.macdContainer.style.display = 'none';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'none';
    chartManager.destroyMACD();
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
  });
}

// ── 패턴/시그널 카테고리 분류 (사이드바 pill 용) ──
// patterns.js 타입 → candle, signalEngine 타입 → indicator/volume
const _CANDLE_PATTERN_TYPES = new Set([
  'doji', 'hammer', 'shootingStar', 'bullishEngulfing', 'bearishEngulfing',
  'morningStar', 'eveningStar', 'threeWhiteSoldiers', 'threeBlackCrows',
  'hangingMan', 'invertedHammer', 'bullishHarami', 'bearishHarami',
  'piercingLine', 'darkCloud', 'dragonflyDoji', 'gravestoneDoji',
  'tweezerBottom', 'tweezerTop',
]);
const _CHART_PATTERN_TYPES = new Set([
  'headAndShoulders', 'inverseHeadAndShoulders',
  'doubleBottom', 'doubleTop',
  'ascendingTriangle', 'descendingTriangle',
  'risingWedge', 'fallingWedge',
  'flag', 'supportBounce', 'resistanceReject',
]);
const _VOLUME_SIGNAL_TYPES = new Set([
  'volumeBreakout', 'volumeSelloff', 'volumeExhaustion',
]);
const _INDICATOR_SIGNAL_TYPES = new Set([
  'goldenCross', 'deadCross', 'maAlignment_bull', 'maAlignment_bear',
  'macdBullishCross', 'macdBearishCross', 'macdHistPositive', 'macdHistNegative',
  'macdBullishDivergence', 'macdBearishDivergence',
  'rsiOversold', 'rsiOversoldExit', 'rsiOverbought', 'rsiOverboughtExit',
  'rsiBullishDivergence', 'rsiBearishDivergence',
  'bbLowerBounce', 'bbUpperBreak', 'bbSqueeze',
]);

/**
 * 패턴/시그널을 3카테고리로 분류하여 카운트 + 이름 반환
 * @param {Array} patterns - patternEngine.analyze() 결과
 * @param {Array} signals  - signalEngine.analyze() 결과
 * @returns {{ candle: number, indicator: number, volume: number, names: string[] }}
 */
function _categorizePatterns(patterns, signals) {
  const result = { candle: 0, indicator: 0, volume: 0, names: [] };

  // patternEngine 결과: 캔들패턴 + 차트패턴 (이름도 수집)
  for (const p of patterns) {
    const type = p.type || p.pattern;
    if (_CANDLE_PATTERN_TYPES.has(type)) {
      result.candle++;
      // PATTERN_ACADEMIC_META (patternPanel.js 전역)에서 한글명 조회
      const meta = typeof PATTERN_ACADEMIC_META !== 'undefined' ? PATTERN_ACADEMIC_META[type] : null;
      result.names.push(meta && meta.nameKo ? meta.nameKo : type);
    } else if (_CHART_PATTERN_TYPES.has(type)) {
      // 차트 패턴(H&S, 삼각형 등)은 지표 카테고리로 분류
      result.indicator++;
      const meta = typeof PATTERN_ACADEMIC_META !== 'undefined' ? PATTERN_ACADEMIC_META[type] : null;
      result.names.push(meta && meta.nameKo ? meta.nameKo : type);
    } else {
      result.candle++;  // 알 수 없는 타입은 캔들 기본값
    }
  }

  // signalEngine 결과: 지표 시그널 + 거래량 시그널
  for (const s of signals) {
    if (s.type === 'composite') continue;  // 복합 시그널은 개별 구성요소로 이미 카운트됨
    if (_VOLUME_SIGNAL_TYPES.has(s.type)) {
      result.volume++;
    } else if (_INDICATOR_SIGNAL_TYPES.has(s.type)) {
      result.indicator++;
    }
  }

  return result;
}

/**
 * 메인 스레드 동기 분석 (Worker 미지원 / 에러 시 폴백)
 * 기존 로직과 동일
 */
function _analyzeOnMainThread() {
  const analyzeCandles = (_realtimeMode && candles.length > 1) ? candles.slice(0, -1) : candles;
  // 캔들 패턴 + 복합 시그널 분석 (signalEngine이 IndicatorCache를 공유)
  detectedPatterns = patternEngine.analyze(analyzeCandles);
  const result = signalEngine.analyze(analyzeCandles, detectedPatterns);
  detectedSignals = result.signals;
  signalStats = result.stats;
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
  const visiblePatterns = patternEngine.analyze(visibleCandles);

  // 인덱스 오프셋 보정: visibleCandles[0]이 candles[clampFrom]
  visiblePatterns.forEach(p => {
    if (p.startIndex != null) p.startIndex += clampFrom;
    if (p.endIndex != null) p.endIndex += clampFrom;
  });

  detectedPatterns = visiblePatterns;
  chartManager._drawPatterns(candles, chartType, detectedPatterns);
  if (typeof patternRenderer !== 'undefined') {
    patternRenderer.render(chartManager, candles, chartType, detectedPatterns);
  }

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
//  OHLC 정보 바
// ══════════════════════════════════════════════════════

function updateOHLCBar(data) {
  let d = data;
  if (!d && candles.length) {
    const last = candles[candles.length - 1];
    d = { open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume };
  }
  if (!d) return;

  // 캐시된 DOM 참조 사용 (매 crosshair 이동마다 getElementById 호출 방지)
  const oO = _dom.ohlcOpen;
  const oH = _dom.ohlcHigh;
  const oL = _dom.ohlcLow;
  const oC = _dom.ohlcClose;
  const oV = _dom.ohlcVol;
  if (!oO) return;

  const cls = (d.close || 0) >= (d.open || 0) ? 'up' : 'dn';
  oO.textContent = d.open != null ? d.open.toLocaleString() : '—';
  oH.textContent = d.high != null ? d.high.toLocaleString() : '—';
  oL.textContent = d.low != null ? d.low.toLocaleString() : '—';
  oC.textContent = d.close != null ? d.close.toLocaleString() : '—';
  oC.className = 'ohlc-val ' + cls;
  if (oV && d.volume != null) oV.textContent = formatVol(d.volume);
}

function formatVol(v) {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '억';
  if (v >= 1e4) return Math.floor(v / 1e4).toLocaleString() + '만';
  return v.toLocaleString();
}

// ══════════════════════════════════════════════════════
//  라이브 상태 표시
// ══════════════════════════════════════════════════════

let _prevLiveStatus = null;

function updateLiveStatus(status) {
  const dot = document.getElementById('live-status');
  const label = document.getElementById('live-label');
  if (!dot) return;
  dot.className = 'live-dot ' + status;
  if (label) {
    label.className = 'live-label ' + status;
    label.textContent = status === 'live' ? 'LIVE' : status === 'ws' ? 'WS' : status === 'demo' ? 'DEMO' : 'OFFLINE';
  }
  dot.title = {
    live: 'Kiwoom 실시간',
    ws: 'Kiwoom WebSocket 실시간',
    demo: '데모 모드',
    offline: '연결 끊김'
  }[status] || '';

  // 상태 변경 시에만 toast 알림 (중복 방지)
  if (status !== _prevLiveStatus) {
    _prevLiveStatus = status;
    var toastMap = {
      live: ['Kiwoom 실시간 연결됨', 'success'],
      ws:   ['WebSocket 실시간 연결됨', 'success'],
      demo: ['데모 모드로 전환됨', 'info'],
      offline: ['실시간 연결 끊김', 'warning']
    };
    var t = toastMap[status];
    if (t) showToast(t[0], t[1]);
  }
}

// ══════════════════════════════════════════════════════
//  장 상태 표시 (KST 기준)
// ══════════════════════════════════════════════════════

/**
 * 현재 KST 시각 기준 장 상태 반환.
 * - open:   09:00~15:30 평일
 * - pre:    08:00~09:00 평일
 * - after:  15:30~16:00 평일
 * - closed: 그 외 / 주말
 */
function getMarketState() {
  const now = new Date();
  // KST = UTC+9
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const day = kst.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return 'closed';

  const hhmm = kst.getHours() * 100 + kst.getMinutes();
  if (hhmm >= 900 && hhmm < 1530) return 'open';
  if (hhmm >= 800 && hhmm < 900)  return 'pre';
  if (hhmm >= 1530 && hhmm < 1600) return 'after';
  return 'closed';
}

let _marketStateTimer = null;

function updateMarketState() {
  const el = document.getElementById('market-state');
  if (!el) return;
  const state = getMarketState();
  const labels = { open: '장중', pre: '장전', after: '장후', closed: '장마감' };
  el.textContent = labels[state];
  el.className = 'market-state ' + state;
}

function startMarketStateTimer() {
  updateMarketState();
  // 매 30초마다 갱신
  _marketStateTimer = setInterval(updateMarketState, 30000);
}

// ══════════════════════════════════════════════════════
//  종목 선택
// ══════════════════════════════════════════════════════

async function selectStock(code) {
  const version = ++_selectVersion;
  currentStock = ALL_STOCKS.find(s => s.code === code);
  if (!currentStock) return;

  // 종목 선택 저장
  _savePrefs({ stock: code });

  sidebarManager.setActive(code);

  // 최근 조회 종목 기록 (사이드바 연동)
  if (typeof sidebarManager !== 'undefined' && sidebarManager.setRecentStock) {
    sidebarManager.setRecentStock(code);
  }

  // 로딩 shimmer 표시
  _dom.mainContainer.classList.add('chart-loading');

  chartManager.destroyAll();
  chartManager.createMainChart(_dom.mainContainer);

  try {
    candles = await dataService.getCandles(currentStock, currentTimeframe);
  } catch (e) {
    console.error('[KRX] 캔들 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 데이터 로드 실패', 'error');
    candles = [];
  }
  if (version !== _selectVersion) return;

  // 로딩 해제
  _dom.mainContainer.classList.remove('chart-loading');

  _lastPatternAnalysis = 0;
  _workerVersion++;          // Worker 결과 version 갱신 → stale 결과 무시
  _workerPending = false;    // 이전 요청 무효화
  _dragVersion++;            // 드래그 분석 stale 결과 무효화
  if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
  _prevPrice = null;         // 종목 변경 시 flash 초기화
  _prevPatternCount = -1;    // 종목 변경 시 패턴 toast 리셋
  // 백테스트 캐시 무효화
  if (typeof backtester !== 'undefined') backtester.invalidateCache();

  if (candles.length > 0) {
    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    chartManager.setWatermark(currentStock.name);
  } else if (KRX_API_CONFIG.mode === 'ws') {
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(currentStock.name + ' (서버 연결 중...)');
  } else {
    chartManager.setWatermark(currentStock.name);
  }
  updateFinancials();

  chartManager.onCrosshairMove(updateOHLCBar);
  chartManager.onPatternHover(handlePatternTooltip);

  startRealtimeTick();
}

// ══════════════════════════════════════════════════════
//  종목 정보 업데이트
// ══════════════════════════════════════════════════════

function updateStockInfo() {
  if (!candles.length) return;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = last.close - first.open;
  const pct = ((change / first.open) * 100).toFixed(2);
  const cls = change >= 0 ? 'up' : 'dn';
  const sign = change >= 0 ? '\u25B2' : '\u25BC';

  document.getElementById('stock-name').textContent = currentStock.name;
  document.getElementById('stock-code').textContent = currentStock.code;
  document.getElementById('stock-market').textContent = currentStock.market;

  const priceEl = document.getElementById('stock-price');
  const changeEl = document.getElementById('stock-change');
  priceEl.textContent = last.close.toLocaleString();
  priceEl.className = 'sh-price ' + cls;
  changeEl.textContent =
    `${sign} ${Math.abs(change).toLocaleString()} (${change >= 0 ? '+' : ''}${pct}%)`;
  changeEl.className = 'sh-change ' + cls;

  // 시가/고가/저가/거래량 업데이트 (stock-header 상세)
  const shOpen = document.getElementById('sh-open');
  const shHigh = document.getElementById('sh-high');
  const shLow = document.getElementById('sh-low');
  const shVol = document.getElementById('sh-volume');
  if (shOpen) shOpen.textContent = last.open ? last.open.toLocaleString() : '\u2014';
  if (shHigh) shHigh.textContent = last.high ? last.high.toLocaleString() : '\u2014';
  if (shLow) shLow.textContent = last.low ? last.low.toLocaleString() : '\u2014';
  if (shVol) shVol.textContent = last.volume ? formatVol(last.volume) : '\u2014';

  // 가격 변화 flash 효과
  if (_prevPrice !== null && last.close !== _prevPrice) {
    const flashCls = last.close > _prevPrice ? 'price-flash-up' : 'price-flash-down';
    priceEl.classList.add(flashCls);
    changeEl.classList.add(flashCls);
    const cleanup = () => {
      priceEl.classList.remove('price-flash-up', 'price-flash-down');
      changeEl.classList.remove('price-flash-up', 'price-flash-down');
    };
    priceEl.addEventListener('animationend', cleanup, { once: true });
  }
  _prevPrice = last.close;
}

// ── 재무지표: financials.js로 분리됨 ──
// ── 함수: updateFinancials, _getMarketCapEok, _calcCAGR, _calcInvestmentScore,
//          _calcFinChanges, drawOPMSparkline, _sparklineLabel, drawFinTrendChart ──

// ── 패턴 패널: patternPanel.js로 분리됨 ──
// ── 함수: renderPatternPanel, updatePatternSummaryBar, updatePatternHistoryBar,
//          updatePatternHistoryTable, drawReturnCurve, _calcYTicks,
//          updateReturnStatsGrid, renderPatternCards ──
// ── PATTERN_ACADEMIC_META 상수도 patternPanel.js에 위치 ──



// ══════════════════════════════════════════════════════
//  시그널 카테고리 필터 (작업 1)
//
//  왜: 22종 시그널이 동시 표시되면 차트가 혼잡. 사용자가
//  관심 카테고리(MA/MACD/RSI/BB/Vol/복합)만 선택적으로
//  표시할 수 있어야 분석 효율이 올라감.
// ══════════════════════════════════════════════════════

function initSignalFilter() {
  // 시그널 필터 드롭다운 (툴바 통합)
  const filterWrap = document.getElementById('signal-filter-wrap');
  const filterToggle = document.getElementById('signal-filter-toggle');
  const filterMenu = document.getElementById('signal-filter-menu');

  if (filterToggle && filterMenu) {
    // 드롭다운 열기/닫기
    filterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      filterMenu.classList.toggle('show');
    });
    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#signal-filter-wrap')) {
        filterMenu.classList.remove('show');
      }
    });
    // 체크박스 변경
    filterMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const cat = cb.dataset.cat;
        if (cb.checked) {
          activeSignalCategories.add(cat);
        } else {
          activeSignalCategories.delete(cat);
        }
        _applySignalFilter();
      });
    });
  }

  // 패턴 상세 팝업 열기/닫기
  const detailBtn = document.getElementById('psb-detail-btn');
  const popup = document.getElementById('pattern-detail-popup');
  const popupClose = document.getElementById('pdp-close');

  if (detailBtn && popup) {
    detailBtn.addEventListener('click', () => {
      popup.classList.toggle('show');
    });
  }
  if (popupClose && popup) {
    popupClose.addEventListener('click', () => {
      popup.classList.remove('show');
    });
  }
  // 팝업 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (popup && popup.classList.contains('show')) {
      if (!e.target.closest('#pattern-detail-popup') && !e.target.closest('#psb-detail-btn')) {
        popup.classList.remove('show');
      }
    }
  });
}

/**
 * 시그널 카테고리 필터 적용
 * signalEngine의 _signalCategory() 분류 기준과 동일하게 필터링 후
 * signalRenderer에 필터된 시그널만 전달
 */
function _applySignalFilter() {
  if (!detectedSignals.length) return;

  const filtered = _filterSignalsByCategory(detectedSignals);

  // 시그널 Canvas 재렌더링
  if (typeof signalRenderer !== 'undefined') {
    signalRenderer.render(chartManager, candles, filtered, {
      volumeActive: activeIndicators.has('vol'),
      chartType: chartType,
    });
  }

  // 호버 데이터도 갱신
  chartManager.setHoverData(candles, detectedPatterns, filtered);
}

/**
 * activeSignalCategories에 따라 시그널 배열 필터링
 * signalEngine._signalCategory() 직접 호출 (중복 로직 제거)
 */
function _filterSignalsByCategory(signals) {
  return signals.filter(s => {
    if (s.source === 'composite' || s.type === 'composite') {
      return activeSignalCategories.has('composite');
    }
    const cat = signalEngine._signalCategory(s.type);
    return activeSignalCategories.has(cat);
  });
}


// ══════════════════════════════════════════════════════
//  패턴/시그널 호버 툴팁 (작업 2)
//
//  왜: Canvas2D 위 도형은 DOM 이벤트를 받을 수 없음.
//  subscribeCrosshairMove()에서 시간 비교로 근접 패턴을
//  감지하고 HTML 툴팁으로 상세 정보를 표시.
//  LWC 공식 문서 권장 패턴.
// ══════════════════════════════════════════════════════

function handlePatternTooltip(data) {
  const tooltip = document.getElementById('pattern-tooltip');
  if (!tooltip) return;

  if (!data || !data.items || !data.items.length) {
    tooltip.classList.remove('show');
    return;
  }

  // 툴팁 내용 빌드
  const html = data.items.map(item => {
    const sc = item.signal === 'buy' ? 'buy' : item.signal === 'sell' ? 'sell' : 'neutral';
    const st = item.signal === 'buy' ? '매수' : item.signal === 'sell' ? '매도' : '중립';

    // 학술 설명 조회 (패턴 소스인 경우)
    let academicDescHtml = '';
    if (item.source === 'pattern' && item.type) {
      const itemMeta = PATTERN_ACADEMIC_META[item.type];
      if (itemMeta) {
        // 학술 설명 2줄 제한 (약 80자)
        const desc = itemMeta.academicDesc;
        const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
        academicDescHtml = `<div class="pt-academic">${shortDesc}</div>`;
      }
    }

    const confColor = (item.confidence || 0) >= 60 ? KRX_COLORS.UP :
                      (item.confidence || 0) >= 40 ? KRX_COLORS.ACCENT : KRX_COLORS.DOWN;
    const confText = item.confidence != null ? `<span class="pt-conf" style="color:${confColor}">${item.confidence}%</span>` : '';

    let meta = '';
    const metaParts = [];
    if (item.stopLoss) metaParts.push(`<span class="pt-sl">SL ${item.stopLoss.toLocaleString()}</span>`);
    if (item.priceTarget) metaParts.push(`<span class="pt-tp">TP ${item.priceTarget.toLocaleString()}</span>`);
    if (item.strength) {
      const strLabel = item.strength === 'strong' ? '강' : item.strength === 'medium' ? '중' : '약';
      metaParts.push(`<span>${strLabel}</span>`);
    }
    if (item.tier) metaParts.push(`<span>Tier ${item.tier}</span>`);
    if (item.confluence) metaParts.push(`<span style="color:${KRX_COLORS.NEUTRAL}">합류</span>`);
    if (metaParts.length) meta = `<div class="pt-meta">${metaParts.join('')}</div>`;

    return `<div class="pt-header"><span class="pt-name">${item.name}</span><span class="pt-signal ${sc}">${st}</span>${confText}</div><div class="pt-desc">${item.description}</div>${academicDescHtml}${meta}`;
  }).join('<div style="border-top:1px solid rgba(255,255,255,0.04);margin:4px 0"></div>');

  tooltip.innerHTML = html;

  // 위치 계산: 크로스헤어 point 기준
  if (data.point) {
    const chartWrap = document.getElementById('chart-wrap');
    if (chartWrap) {
      const wrapRect = chartWrap.getBoundingClientRect();
      const chartContainer = document.getElementById('main-chart-container');
      const chartRect = chartContainer ? chartContainer.getBoundingClientRect() : wrapRect;

      // chart-wrap 내 상대 좌표로 변환
      let left = data.point.x + (chartRect.left - wrapRect.left) + 16;
      let top = data.point.y + (chartRect.top - wrapRect.top) - 10;

      // 우측 넘침 방지
      const tooltipWidth = 240;
      if (left + tooltipWidth > wrapRect.width) {
        left = data.point.x + (chartRect.left - wrapRect.left) - tooltipWidth - 16;
      }
      // 하단 넘침 방지
      if (top + 120 > wrapRect.height) {
        top = Math.max(4, wrapRect.height - 130);
      }
      // 상단 넘침 방지
      if (top < 30) top = 30;

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
  }

  tooltip.classList.add('show');
}


// ══════════════════════════════════════════════════════
//  패턴 패널 ↔ 차트 연동 (작업 3)
//
//  왜: 우측 패턴 패널에서 항목 클릭 시 차트가 해당 봉으로
//  스크롤되어야 자연스러운 분석 흐름이 됨.
//  setVisibleLogicalRange()로 해당 봉을 화면 중앙에 배치.
// ══════════════════════════════════════════════════════

function scrollChartToPattern(time, index) {
  if (!chartManager.mainChart || !candles.length) return;

  const ts = chartManager.mainChart.timeScale();
  const totalBars = candles.length;

  // 화면에 보이는 봉 수 계산
  const visRange = ts.getVisibleLogicalRange();
  let visibleBars = 60; // 기본값
  if (visRange) {
    visibleBars = Math.max(20, Math.round(visRange.to - visRange.from));
  }

  // 해당 봉을 화면 중앙에 배치
  const half = Math.floor(visibleBars / 2);
  const centerIdx = index != null ? index : candles.findIndex(c => c.time === time);
  if (centerIdx < 0) return;

  const from = Math.max(0, centerIdx - half);
  const to = from + visibleBars;

  ts.setVisibleLogicalRange({ from, to });
}


// ══════════════════════════════════════════════════════
//  검색 이벤트
// ══════════════════════════════════════════════════════

const searchInput = document.getElementById('search-input');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { dropdown.classList.remove('show'); return; }
  const matches = dataService.searchStocks(q).slice(0, 10);
  dropdown.innerHTML = matches.map(s => `
    <div class="search-item" data-code="${s.code}">
      <span>${s.name}</span>
      <span class="code">${s.code}</span>
      <span class="market-tag ${s.market.toLowerCase()}">${s.market}</span>
    </div>`).join('') || '<div class="search-item" style="color:#555e78">검색 결과 없음</div>';
  dropdown.classList.add('show');
  dropdown.querySelectorAll('.search-item[data-code]').forEach(el => {
    el.addEventListener('click', () => {
      selectStock(el.dataset.code);
      searchInput.value = '';
      dropdown.classList.remove('show');
    });
  });
});

// Enter 키로 첫 번째 검색 결과 선택
searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = dropdown.querySelector('.search-item[data-code]');
  if (first) {
    selectStock(first.dataset.code);
    searchInput.value = '';
    dropdown.classList.remove('show');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-wrap')) dropdown.classList.remove('show');
});

// ══════════════════════════════════════════════════════
//  툴바 이벤트
// ══════════════════════════════════════════════════════

// ── 차트 타입 ──
document.querySelectorAll('.ct-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartType = btn.dataset.ct;
    _savePrefs({ chartType: chartType });
    updateChartFull();
  });
});

// ── 타임프레임 ──
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeframe = btn.dataset.tf;
    _savePrefs({ timeframe: currentTimeframe });

    // 로딩 shimmer 표시
    _dom.mainContainer.classList.add('chart-loading');

    chartManager.destroyAll();
    chartManager.createMainChart(_dom.mainContainer);
    chartManager.onCrosshairMove(updateOHLCBar);
    chartManager.onPatternHover(handlePatternTooltip);
    candles = await dataService.getCandles(currentStock, currentTimeframe);

    // 로딩 해제
    _dom.mainContainer.classList.remove('chart-loading');

    _lastPatternAnalysis = 0;
    _workerVersion++;          // Worker 결과 version 갱신
    _workerPending = false;
    _dragVersion++;            // 드래그 분석 stale 결과 무효화
    if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
    _prevPrice = null;         // 타임프레임 변경 시 flash 초기화
    _prevPatternCount = -1;    // 타임프레임 변경 시 패턴 toast 리셋
    if (candles.length > 0) {
      updateChartFull();
      updateStockInfo();
      updateOHLCBar(null);
      // 분봉 폴백 표시 (WS 미연결 또는 file 모드에서 분봉)
      const isMinuteFallback = currentTimeframe !== '1d' && (
        (KRX_API_CONFIG.mode === 'ws' && typeof realtimeProvider !== 'undefined' && !realtimeProvider.connected) ||
        KRX_API_CONFIG.mode === 'file'
      );
      // CORS 환경이면 데모 데이터, 아니면 Naver 데이터
      const fallbackLabel = isMinuteFallback
        ? (dataService._isNaverCorsBlocked() ? ' (데모)' : ' (Naver)')
        : '';
      chartManager.setWatermark(currentStock.name + fallbackLabel);
    } else if (KRX_API_CONFIG.mode === 'ws') {
      console.log('[KRX] WS 모드 — %s 캔들 서버 수신 대기 중...', currentTimeframe);
      chartManager.setWatermark(currentStock.name + ' (' + currentTimeframe + ' 로드 중...)');
    } else {
      chartManager.setWatermark(currentStock.name);
    }
    startRealtimeTick();
  });
});

// ── 지표 드롭다운 토글 ──
const indDropdownToggle = document.getElementById('ind-dropdown-toggle');
const indDropdownMenu = document.getElementById('ind-dropdown-menu');

if (indDropdownToggle && indDropdownMenu) {
  // 드롭다운 열기/닫기
  indDropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    indDropdownMenu.classList.toggle('show');
  });

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!indDropdownToggle.closest('.ind-dropdown-wrap').contains(e.target)) {
      indDropdownMenu.classList.remove('show');
    }
  });

  // 체크박스 변경 시 지표 토글
  indDropdownMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const ind = cb.dataset.ind;
      if (cb.checked) {
        activeIndicators.add(ind);
      } else {
        activeIndicators.delete(ind);
      }
      // 활성 지표가 있으면 드롭다운 버튼에 accent 표시
      indDropdownToggle.classList.toggle('has-active', activeIndicators.size > 0);
      updateChartFull();
    });
  });
}

// ── 패턴 토글 ──
const patternBtn = document.getElementById('pattern-toggle');
if (patternBtn) {
  patternBtn.addEventListener('click', () => {
    patternEnabled = !patternEnabled;
    _savePrefs({ patternEnabled: patternEnabled });
    patternBtn.classList.toggle('active', patternEnabled);

    // 패턴 요약 바 표시/숨김
    const summaryWrap = document.getElementById('pattern-summary-wrap');
    if (summaryWrap) summaryWrap.style.display = patternEnabled ? '' : 'none';

    // 시그널 필터 드롭다운 표시/숨김
    const filterWrap = document.getElementById('signal-filter-wrap');
    if (filterWrap) filterWrap.style.display = patternEnabled ? '' : 'none';

    // 과거 수익률 영역 표시/숨김
    const retArea = document.getElementById('return-stats-area');
    if (retArea) retArea.style.display = patternEnabled ? '' : 'none';

    if (!patternEnabled) {
      detectedPatterns = [];
      detectedSignals = [];
      renderPatternPanel([]);
      // 툴팁 숨기기
      const tt = document.getElementById('pattern-tooltip');
      if (tt) tt.classList.remove('show');
      // 상세 팝업 닫기
      const popup = document.getElementById('pattern-detail-popup');
      if (popup) popup.classList.remove('show');
      // 과거 수익률 바 숨기기
      const phBar = document.getElementById('pattern-history-bar');
      if (phBar) phBar.style.display = 'none';
    } else {
      _lastPatternAnalysis = 0;
    }
    updateChartFull();
  });
}


// ── 패턴 패널 슬라이드 토글 (1024px 이하 반응형) ──
(function initPatternPanelToggle() {
  const ppToggle = document.getElementById('pp-toggle');
  const ppPanel = document.getElementById('pattern-panel');
  const ppBackdrop = document.getElementById('pp-backdrop');
  if (!ppToggle || !ppPanel) return;

  function openPanel() {
    ppPanel.classList.add('pp-visible');
    ppToggle.classList.add('pp-open');
    if (ppBackdrop) ppBackdrop.classList.add('pp-bd-visible');
  }
  function closePanel() {
    ppPanel.classList.remove('pp-visible');
    ppToggle.classList.remove('pp-open');
    if (ppBackdrop) ppBackdrop.classList.remove('pp-bd-visible');
  }

  ppToggle.addEventListener('click', () => {
    if (ppPanel.classList.contains('pp-visible')) {
      closePanel();
    } else {
      openPanel();
    }
  });

  // 백드롭 클릭 시 닫기
  if (ppBackdrop) {
    ppBackdrop.addEventListener('click', closePanel);
  }

  // 뷰포트가 넓어지면 (1024px 초과) 자동으로 상태 초기화
  const mq = window.matchMedia('(max-width: 1024px)');
  mq.addEventListener('change', (e) => {
    if (!e.matches) closePanel();
  });
})();

// ══════════════════════════════════════════════════════
//  모바일 사이드바 드로어 (768px 이하)
//  - 기존 #sidebar-toggle 햄버거를 오버레이 드로어로 재활용
//  - 백드롭 #sb-backdrop 클릭 시 닫기
// ══════════════════════════════════════════════════════
(function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sbBackdrop = document.getElementById('sb-backdrop');
  const sbToggle = document.getElementById('sidebar-toggle');
  if (!sidebar || !sbToggle) return;

  const mq = window.matchMedia('(max-width: 768px)');

  function isMobile() { return mq.matches; }

  function openDrawer() {
    sidebar.classList.add('sb-drawer-open');
    if (sbBackdrop) sbBackdrop.classList.add('sb-bd-visible');
  }
  function closeDrawer() {
    sidebar.classList.remove('sb-drawer-open');
    if (sbBackdrop) sbBackdrop.classList.remove('sb-bd-visible');
  }

  // 모바일에서 햄버거 버튼 동작 오버라이드
  sbToggle.addEventListener('click', (e) => {
    if (!isMobile()) return; // 데스크톱은 기존 sidebarManager.toggle()이 처리
    e.stopImmediatePropagation(); // sidebarManager의 리스너보다 먼저 잡기
    if (sidebar.classList.contains('sb-drawer-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }, true); // capture: true로 sidebarManager보다 먼저 실행

  // 백드롭 클릭 시 닫기
  if (sbBackdrop) {
    sbBackdrop.addEventListener('click', closeDrawer);
  }

  // 사이드바 내 종목 클릭 시 자동 닫기
  sidebar.addEventListener('click', (e) => {
    if (!isMobile()) return;
    if (e.target.closest('.sb-item')) {
      setTimeout(closeDrawer, 150);
    }
  });

  // 뷰포트가 넓어지면 드로어 상태 초기화
  mq.addEventListener('change', (e) => {
    if (!e.matches) closeDrawer();
  });
})();

// ══════════════════════════════════════════════════════
//  모바일 재무지표 바텀시트 (768px 이하)
//  - #fin-toggle FAB 버튼으로 열기/닫기
//  - #rp-backdrop 클릭 시 닫기
// ══════════════════════════════════════════════════════
(function initMobileFinSheet() {
  const rpanel = document.getElementById('right-panel');
  const finToggle = document.getElementById('fin-toggle');
  const rpBackdrop = document.getElementById('rp-backdrop');
  if (!rpanel || !finToggle) return;

  function openSheet() {
    rpanel.classList.add('rp-sheet-open');
    finToggle.classList.add('rp-open');
    finToggle.innerHTML = '&#10005;';   // X 아이콘
    if (rpBackdrop) rpBackdrop.classList.add('rp-bd-visible');
  }
  function closeSheet() {
    rpanel.classList.remove('rp-sheet-open');
    finToggle.classList.remove('rp-open');
    finToggle.innerHTML = '&#8942;';    // 세로 점 3개 아이콘
    if (rpBackdrop) rpBackdrop.classList.remove('rp-bd-visible');
  }

  finToggle.addEventListener('click', () => {
    if (rpanel.classList.contains('rp-sheet-open')) {
      closeSheet();
    } else {
      openSheet();
    }
  });

  if (rpBackdrop) {
    rpBackdrop.addEventListener('click', closeSheet);
  }

  // 뷰포트가 넓어지면 바텀시트 상태 초기화
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', (e) => {
    if (!e.matches) closeSheet();
  });
})();

// ══════════════════════════════════════════════════════
//  키보드 단축키
//
//  1-6: 타임프레임 전환, C: 차트타입 순환, P: 패턴 토글
//  / 또는 F: 검색 포커스, Escape: 검색 블러 + 팝업 닫기
//  입력 필드 포커스 중에는 무시 (Escape 제외)
// ══════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable);

  // Escape: 항상 동작 — 검색 블러, 모든 팝업/드롭다운 닫기
  if (e.key === 'Escape') {
    // 검색 입력 블러
    if (searchInput && document.activeElement === searchInput) {
      searchInput.blur();
      searchInput.value = '';
    }
    // 사이드바 검색 블러
    const sbInput = document.getElementById('sb-search-input');
    if (sbInput && document.activeElement === sbInput) {
      sbInput.blur();
      sbInput.value = '';
    }
    // 검색 드롭다운 닫기
    if (dropdown) dropdown.classList.remove('show');
    // 패턴 상세 팝업 닫기
    const popup = document.getElementById('pattern-detail-popup');
    if (popup) popup.classList.remove('show');
    // 지표 드롭다운 닫기
    if (indDropdownMenu) indDropdownMenu.classList.remove('show');
    // 시그널 필터 드롭다운 닫기
    const sfMenu = document.getElementById('signal-filter-menu');
    if (sfMenu) sfMenu.classList.remove('show');
    // 모바일 사이드바 드로어 닫기
    const sidebarEl = document.getElementById('sidebar');
    const sbBd = document.getElementById('sb-backdrop');
    if (sidebarEl && sidebarEl.classList.contains('sb-drawer-open')) {
      sidebarEl.classList.remove('sb-drawer-open');
      if (sbBd) sbBd.classList.remove('sb-bd-visible');
    }
    // 모바일 재무지표 바텀시트 닫기
    const rpEl = document.getElementById('right-panel');
    const rpBd = document.getElementById('rp-backdrop');
    const finBtn = document.getElementById('fin-toggle');
    if (rpEl && rpEl.classList.contains('rp-sheet-open')) {
      rpEl.classList.remove('rp-sheet-open');
      if (finBtn) { finBtn.classList.remove('rp-open'); finBtn.innerHTML = '\u22EE'; }
      if (rpBd) rpBd.classList.remove('rp-bd-visible');
    }
    return;
  }

  // 입력 필드에서는 나머지 단축키 무시
  if (isInput) return;

  // Ctrl/Alt/Meta 조합은 무시 (브라우저 기본 단축키 보존)
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const key = e.key;

  // Arrow Up/Down: 사이드바 종목 키보드 네비게이션
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    e.preventDefault();
    const items = [...document.querySelectorAll('.sb-item:not([style*="display: none"])')];
    if (!items.length) return;

    const current = document.querySelector('.sb-item.kb-focus') || document.querySelector('.sb-item.active');
    let idx = items.indexOf(current);

    // 기존 포커스 제거
    items.forEach(i => i.classList.remove('kb-focus'));

    if (key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    else idx = Math.max(idx - 1, 0);

    items[idx].classList.add('kb-focus');
    items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 디바운스된 종목 선택 (200ms) — 빠른 화살표 연타 시 마지막 위치만 로드
    clearTimeout(_kbNavTimer);
    _kbNavTimer = setTimeout(() => {
      const code = items[idx].dataset.code;
      if (code) selectStock(code);
    }, 200);
    return;
  }

  // 1-6: 타임프레임 전환 (기존 .tf-btn 클릭을 프로그래밍 방식으로 트리거)
  const tfMap = { '1': '1m', '2': '5m', '3': '15m', '4': '30m', '5': '1h', '6': '1d' };
  if (tfMap[key]) {
    const tfBtn = document.querySelector(`.tf-btn[data-tf="${tfMap[key]}"]`);
    if (tfBtn && !tfBtn.classList.contains('active')) {
      tfBtn.click();
    }
    e.preventDefault();
    return;
  }

  // C: 차트 타입 순환 (candle → line → bar → candle)
  if (key === 'c' || key === 'C') {
    const types = ['candle', 'line', 'bar'];
    const curIdx = types.indexOf(chartType);
    const nextType = types[(curIdx + 1) % types.length];
    const ctBtn = document.querySelector(`.ct-btn[data-ct="${nextType}"]`);
    if (ctBtn) ctBtn.click();
    e.preventDefault();
    return;
  }

  // P: 패턴 토글
  if (key === 'p' || key === 'P') {
    const pBtn = document.getElementById('pattern-toggle');
    if (pBtn) pBtn.click();
    e.preventDefault();
    return;
  }

  // / 또는 F: 검색 포커스
  if (key === '/' || key === 'f' || key === 'F') {
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    e.preventDefault();
    return;
  }
});


// ══════════════════════════════════════════════════════
//  시작
// ══════════════════════════════════════════════════════
init();
