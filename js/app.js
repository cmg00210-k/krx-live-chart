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
let activeIndicators = new Set(['vol', 'ma']);
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
let _tfVersion = 0;            // [OPT] 타임프레임 빠른 전환 시 stale fetch 무시용
let _fallbackTimer = null;
let _prevPrice = null;       // 가격 변화 flash 감지용
let _kbNavTimer = null;      // 키보드 네비게이션 디바운스 타이머
let _sectorData = null;      // 업종 비교 데이터 (sector_fundamentals.json)
let _chartPatternStructLines = [];  // 전체 분석에서 감지된 차트 패턴의 구조선 보존 (드래그 시 소실 방지)

// ── 데이터 수신 시각 추적 (Data Freshness Indicator) ──
var _lastDataTime = 0;
var _freshnessTimer = null;

/** 데이터 수신 시각 갱신 표시 (10초마다 자동 갱신) */
function _updateFreshness() {
  var el = document.getElementById('data-freshness');
  if (!el) return;
  if (!_lastDataTime) { el.textContent = ''; return; }

  var diff = Math.floor((Date.now() - _lastDataTime) / 1000);
  if (diff < 5) el.textContent = '방금';
  else if (diff < 60) el.textContent = diff + '초 전';
  else if (diff < 3600) el.textContent = Math.floor(diff / 60) + '분 전';
  else el.textContent = Math.floor(diff / 3600) + '시간 전';

  // 5분 이상 지연 시 경고 색상
  el.style.color = diff > 300 ? 'var(--neutral)' : diff > 60 ? 'var(--text-sub)' : 'var(--text-muted)';
}

/** 캔들 데이터 수신 시 호출 — 최종 수신 시각 기록 */
function _markDataFresh() {
  _lastDataTime = Date.now();
  _updateFreshness();
}

// 10초마다 freshness 텍스트 갱신
_freshnessTimer = setInterval(_updateFreshness, 10000);

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
  // [NEW] 추가 지표 서브차트 DOM 캐시
  _dom.stochContainer = document.getElementById('stoch-chart-container');
  _dom.stochLabel = document.getElementById('stoch-label');
  _dom.cciContainer = document.getElementById('cci-chart-container');
  _dom.cciLabel = document.getElementById('cci-label');
  _dom.adxContainer = document.getElementById('adx-chart-container');
  _dom.adxLabel = document.getElementById('adx-label');
  _dom.willrContainer = document.getElementById('willr-chart-container');
  _dom.willrLabel = document.getElementById('willr-label');
  _dom.atrContainer = document.getElementById('atr-chart-container');
  _dom.atrLabel = document.getElementById('atr-label');
  // [UX] 크로스헤어 지표값 DOM 캐시
  _dom.ohlcRsi     = document.getElementById('ohlc-rsi');
  _dom.ohlcRsiVal  = document.getElementById('ohlc-rsi-val');
  _dom.ohlcMacd    = document.getElementById('ohlc-macd');
  _dom.ohlcMacdVal = document.getElementById('ohlc-macd-val');
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
let _ohlcRafId = 0;            // [FIX] crosshair OHLC 바 RAF 디바운스 ID
let _workerRestartCount = 0;   // [FIX] Worker 에러 시 재시작 카운터 (최대 3회)

// 차트 패턴 구조선 보존 대상 타입 (이중바닥, 삼각형 등 넓은 구간에 걸치는 패턴)
const _CHART_PATTERN_TYPES = new Set([
  'doubleBottom', 'doubleTop',
  'headAndShoulders', 'inverseHeadAndShoulders',
  'ascendingTriangle', 'descendingTriangle',
  'risingWedge', 'fallingWedge',
  'flag', 'supportBounce', 'resistanceReject',
]);

// ── 즐겨찾기 (워치리스트) ──
var WATCHLIST_KEY = 'krx_watchlist';
function _getWatchlist() {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || []; } catch (e) { return []; }
}
function _saveWatchlist(list) { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); }
function _toggleWatchlist(code) {
  var list = _getWatchlist();
  var idx = list.indexOf(code);
  if (idx >= 0) list.splice(idx, 1); else list.push(code);
  _saveWatchlist(list);
  return idx < 0; // true=추가됨
}
function _updateStarBtn() {
  var btn = document.getElementById('watchlist-toggle-btn');
  if (!btn || !currentStock) return;
  var isWatched = _getWatchlist().includes(currentStock.code);
  btn.textContent = isWatched ? '\u2605' : '\u2606';
  btn.classList.toggle('active', isWatched);
}

// ── 지표 파라미터 (우클릭 커스터마이징) ──
var DEFAULT_IND_PARAMS = {
  ma: { p1: 5, p2: 20, p3: 60 },
  ema: { p1: 12, p2: 26 },
  bb: { period: 20, stdDev: 2 },
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  ich: { tenkan: 9, kijun: 26, senkou: 52 },
};
var _PARAM_LABELS = {
  p1: '단기', p2: '중기', p3: '장기', period: '기간', stdDev: '표준편차',
  fast: '빠른선', slow: '느린선', signal: '시그널', tenkan: '전환선', kijun: '기준선', senkou: '선행스팬',
};
function _loadIndParams() {
  try {
    var s = JSON.parse(localStorage.getItem('krx_ind_params'));
    if (s) {
      var merged = JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS));
      for (var k in s) {
        if (merged[k]) Object.assign(merged[k], s[k]);
        else merged[k] = s[k];
      }
      return merged;
    }
    return JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS));
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS)); }
}
function _saveIndParams(p) { localStorage.setItem('krx_ind_params', JSON.stringify(p)); }
var indParams = _loadIndParams();
var _activeParamInd = null;

/**
 * 보존된 차트 패턴을 드래그 분석 결과에 병합 (중복 방지)
 * @param {Array} dragPatterns - 드래그 분석으로 감지된 패턴
 * @returns {Array} 병합된 패턴 배열
 */
function _mergeChartPatternStructLines(dragPatterns) {
  var merged = dragPatterns.slice();
  _chartPatternStructLines.forEach(function (chartP) {
    var isDuplicate = merged.some(function (dp) {
      return dp.type === chartP.type &&
             Math.abs((dp.startIndex || 0) - (chartP.startIndex || 0)) < 3;
    });
    if (!isDuplicate) {
      merged.push(chartP);
    }
  });
  return merged;
}

/**
 * 전체 분석 결과에서 차트 패턴 구조선 추출하여 보존
 * @param {Array} patterns - 전체 분석으로 감지된 패턴
 */
function _saveChartPatternStructLines(patterns) {
  _chartPatternStructLines = patterns
    .filter(function (p) { return _CHART_PATTERN_TYPES.has(p.type); })
    .slice();  // 복사본 저장
}

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

  // 지표 체크박스 동기화 (activeIndicators ↔ DOM)
  document.querySelectorAll('#ind-dropdown-menu input[type="checkbox"]').forEach(function (cb) {
    cb.checked = activeIndicators.has(cb.dataset.ind);
  });
  var indToggle = document.getElementById('ind-dropdown-toggle');
  if (indToggle) indToggle.classList.toggle('has-active', activeIndicators.size > 0);

  // 사이드바: 복원된 종목 활성 표시
  if (currentStock && typeof sidebarManager !== 'undefined' && sidebarManager.setActive) {
    sidebarManager.setActive(currentStock.code);
  }
}

// ══════════════════════════════════════════════════════
//  앱 로딩 오버레이 제어
// ══════════════════════════════════════════════════════

/** 로딩 오버레이 텍스트 변경 */
function _setLoadingText(text, sub) {
  var el = document.getElementById('app-loading-text');
  var subEl = document.getElementById('app-loading-sub');
  if (el) el.textContent = text || '';
  if (subEl) subEl.textContent = sub || '';
}

/** 로딩 오버레이 페이드아웃 후 숨김 */
function _hideLoadingOverlay() {
  var overlay = document.getElementById('app-loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  setTimeout(function() { overlay.classList.add('hidden'); }, 400);
}

// ══════════════════════════════════════════════════════
//  연결 가이드 (WS 서버 미감지 시)
// ══════════════════════════════════════════════════════

/**
 * WS 서버 프로브 실패 시 로딩 오버레이에 연결 가이드를 표시.
 * 사용자가 주소 입력 / 파일 모드 / 데모 모드를 선택하면 onResolved() 호출.
 * @param {Function} onResolved - 모드 확정 후 호출될 콜백
 */
function _showConnectionGuide(onResolved) {
  var overlay = document.getElementById('app-loading-overlay');
  var spinner = overlay ? overlay.querySelector('.app-loading-spinner') : null;
  var text = document.getElementById('app-loading-text');
  var sub = document.getElementById('app-loading-sub');
  var guide = document.getElementById('conn-guide');
  var urlInput = document.getElementById('conn-guide-url');

  // 스피너 + 텍스트 숨기고 가이드 표시
  if (spinner) spinner.style.display = 'none';
  if (text) text.style.display = 'none';
  if (sub) sub.style.display = 'none';
  if (guide) guide.style.display = '';
  if (urlInput) urlInput.value = KRX_API_CONFIG.wsUrl || 'ws://localhost:8765';

  // 연결 시도 버튼
  var retryBtn = document.getElementById('conn-guide-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', async function() {
      var url = urlInput.value.trim();
      if (!url) return;
      this.textContent = '연결 중...'; this.disabled = true;
      KRX_API_CONFIG.wsUrl = url;
      _savePrefs({ wsUrl: url });
      var ok = await dataService.probeWsServer(url, 5000);
      if (ok) {
        KRX_API_CONFIG.mode = 'ws';
        guide.style.display = 'none';
        if (spinner) spinner.style.display = '';
        if (text) { text.style.display = ''; text.textContent = '연결 성공! 데이터 로드 중...'; }
        if (sub) sub.style.display = '';
        onResolved();
      } else {
        this.textContent = '연결'; this.disabled = false;
        showToast('서버 연결 실패 — 주소를 확인하세요', 'error');
      }
    });
  }

  // 파일 모드 버튼
  var fileBtn = document.getElementById('conn-guide-file');
  if (fileBtn) {
    fileBtn.addEventListener('click', function() {
      KRX_API_CONFIG.mode = 'file';
      guide.style.display = 'none';
      onResolved();
    });
  }

  // 데모 모드 버튼
  var demoBtn = document.getElementById('conn-guide-demo');
  if (demoBtn) {
    demoBtn.addEventListener('click', function() {
      KRX_API_CONFIG.mode = 'demo';
      guide.style.display = 'none';
      onResolved();
    });
  }
}

// ══════════════════════════════════════════════════════
//  연결 설정 패널 상태 업데이트
// ══════════════════════════════════════════════════════

/**
 * 연결 패널의 상태 표시 (dot + 텍스트) 업데이트
 * @param {string} status - 연결 상태 키
 */
function _updateConnPanel(status) {
  var dot = document.getElementById('conn-panel-dot');
  var text = document.getElementById('conn-panel-text');
  if (!dot || !text) return;
  var map = {
    'connected': ['ok', '연결됨'],
    'ready': ['ok', '실시간 준비 완료'],
    'login_pending': ['pending', '로그인 대기 중...'],
    'reconnecting': ['pending', '재연결 중...'],
    'disconnected': ['fail', '연결 끊김'],
    'failed': ['fail', '연결 실패'],
    'login_failed': ['fail', '로그인 실패'],
  };
  var m = map[status] || ['', status];
  dot.className = 'conn-dot ' + m[0];
  text.textContent = m[1];
}

// ══════════════════════════════════════════════════════
//  초기화
// ══════════════════════════════════════════════════════

async function init() {
  // 로딩 상태 표시: 종목 데이터 초기화 단계
  _setLoadingText('CheeseStock 로딩 중...', '종목 데이터 초기화');

  // WS 모드 의도 여부 기록 (initFromIndex 내부에서 mode가 file로 변경될 수 있음)
  var _originalMode = KRX_API_CONFIG.mode;

  try {
    await dataService.initFromIndex();
  } catch (e) {
    showToast('종목 목록 로드 실패 — 기본 종목으로 시작합니다', 'error');
  }

  // ── WS 모드 의도였으나 프로브 실패 → 연결 가이드 표시 ──
  if (_originalMode === 'ws' && KRX_API_CONFIG.mode !== 'ws') {
    _showConnectionGuide(function() { _continueInit(); });
    return;
  }

  _continueInit();
}

/** init()에서 분리된 후속 초기화 (연결 가이드 해소 후 또는 직접 실행) */
async function _continueInit() {
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
  if (prefs && prefs.chartType && ['candle', 'line', 'bar', 'heikin'].indexOf(prefs.chartType) !== -1) {
    chartType = prefs.chartType;
  }

  // 패턴 활성 상태 복원
  if (prefs && typeof prefs.patternEnabled === 'boolean') {
    patternEnabled = prefs.patternEnabled;
  }

  // 활성 지표 복원 (localStorage 저장분 우선, 없으면 기본값 vol+ma 유지)
  if (prefs && Array.isArray(prefs.indicators)) {
    activeIndicators = new Set(prefs.indicators);
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

  // 업종 비교 데이터 로드 (sector_fundamentals.json)
  try {
    var sectorRes = await fetch('data/sector_fundamentals.json');
    if (sectorRes.ok) {
      _sectorData = await sectorRes.json();
      console.log('[KRX] 업종 데이터 로드:', Object.keys(_sectorData.sectors || {}).length, '개 업종');
    }
  } catch (e) {
    console.warn('[KRX] 업종 데이터 로드 실패:', e.message);
  }

  // 복원된 환경설정을 UI에 반영
  _applyPrefsToUI();

  // 로딩 상태 표시: 차트 준비 단계
  _setLoadingText('차트 준비 중...', currentStock.name + ' 데이터 로드');

  // ── 서버 상태 콜백 등록 (로그인 대기 / 준비 완료 / 로그인 실패) ──
  realtimeProvider.onServerStatus = function(status, message) {
    // 연결 설정 패널 상태도 동시 업데이트
    _updateConnPanel(status);

    if (status === 'login_pending') {
      // 로그인 대기 중 — 오버레이 유지, 워터마크에도 표시
      _setLoadingText('Kiwoom 로그인 대기 중...', '로그인 창에서 인증해주세요');
      if (typeof chartManager !== 'undefined' && chartManager.mainChart) {
        chartManager.setWatermark(currentStock.name + ' (로그인 대기 중...)');
      }
      updateLiveStatus('ws');
    } else if (status === 'ready') {
      // 로그인 완료 + 서버 준비 → 오버레이 숨김
      _hideLoadingOverlay();
      if (typeof chartManager !== 'undefined' && chartManager.mainChart) {
        chartManager.setWatermark(currentStock.name);
      }
      updateLiveStatus('live');
      showToast('Kiwoom 실시간 연결 완료', 'success');
    } else if (status === 'login_failed') {
      // 로그인 실패 → 오버레이 숨기고 파일 모드 전환
      _hideLoadingOverlay();
      showToast('Kiwoom 로그인 실패 — 파일 모드로 전환', 'error');
      updateLiveStatus('file');
    }
  };

  // ── 연결 상태 변경 콜백 (Connection Management UI) ──
  realtimeProvider.onConnectionChange = function(state) {
    _updateConnPanel(state);
  };

  // ── 연결 설정 패널 토글 ──
  document.getElementById('conn-settings-btn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    var panel = document.getElementById('conn-panel');
    if (!panel) return;
    var showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : '';
    if (!showing) {
      var urlInput = document.getElementById('conn-panel-url');
      if (urlInput) urlInput.value = KRX_API_CONFIG.wsUrl || '';
    }
  });

  // 외부 클릭 시 패널 닫기
  document.addEventListener('click', function(e) {
    var panel = document.getElementById('conn-panel');
    if (panel && !panel.contains(e.target) && e.target.id !== 'conn-settings-btn') {
      panel.style.display = 'none';
    }
  });

  // 연결 패널 — 연결 버튼
  document.getElementById('conn-panel-connect')?.addEventListener('click', async function() {
    var url = document.getElementById('conn-panel-url')?.value.trim();
    if (!url) return;
    this.textContent = '연결 중...'; this.disabled = true;
    KRX_API_CONFIG.wsUrl = url;
    _savePrefs({ wsUrl: url });

    var ok = await dataService.probeWsServer(url, 5000);
    if (ok) {
      KRX_API_CONFIG.mode = 'ws';
      realtimeProvider.reconnectTo(url);
      showToast('서버 연결 성공', 'success');
      document.getElementById('conn-panel').style.display = 'none';
    } else {
      showToast('연결 실패', 'error');
    }
    this.textContent = '연결'; this.disabled = false;
  });

  // 연결 패널 — 파일 모드 전환
  document.getElementById('conn-panel-file')?.addEventListener('click', function() {
    KRX_API_CONFIG.mode = 'file';
    realtimeProvider.stop();
    updateLiveStatus('file');
    document.getElementById('conn-panel').style.display = 'none';
    showToast('파일 모드로 전환', 'info');
  });

  // 연결 패널 — 데모 모드 전환
  document.getElementById('conn-panel-demo')?.addEventListener('click', function() {
    KRX_API_CONFIG.mode = 'demo';
    realtimeProvider.stop();
    updateLiveStatus('demo');
    document.getElementById('conn-panel').style.display = 'none';
    showToast('데모 모드로 전환', 'info');
  });

  // 차트 생성
  try {
    chartManager.createMainChart(_dom.mainContainer);
  } catch (e) {
    console.error('[KRX] 차트 초기화 실패:', e);
    showToast('차트 초기화 실패: ' + (e.message || '알 수 없는 오류'), 'error');
    _hideLoadingOverlay();
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
    _markDataFresh();  // 데이터 수신 시각 기록
    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
    if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
      chartManager.setWatermark(currentStock.name + ' (일봉 — 분봉 데이터 미제공)');
    } else {
      chartManager.setWatermark(currentStock.name);
    }
    // 데이터 로드 완료 → 로딩 오버레이 숨김
    _hideLoadingOverlay();
  } else if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 캔들 수신 대기 (realtimeProvider.onTick에서 처리)
    // 오버레이는 유지 — serverStatus 'ready' 또는 onTick 수신 시 숨김
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(currentStock.name + ' (서버 연결 중...)');
    _setLoadingText('서버 연결 대기 중...', 'Kiwoom 서버 응답을 기다리는 중입니다');
  } else if (KRX_API_CONFIG.mode === 'file') {
    // file 모드: 데이터 파일 없음 안내 (가짜 데이터 표시하지 않음)
    chartManager.setWatermark(currentStock.name + ' (데이터 없음)');
    _hideLoadingOverlay();
  } else {
    chartManager.setWatermark(currentStock.name);
    _hideLoadingOverlay();
  }

  // 재무지표 초기화 (candles 로드 후 실행 → PER/PBR/PSR 계산 가능)
  updateFinancials();

  // [FIX] OHLC 바 RAF 디바운스 — 60fps crosshair 이벤트를 16ms 프레임으로 제한
  chartManager.onCrosshairMove(function(param) {
    cancelAnimationFrame(_ohlcRafId);
    _ohlcRafId = requestAnimationFrame(function() { updateOHLCBar(param); });
  });

  // 패턴 호버 툴팁 콜백 등록
  chartManager.onPatternHover(handlePatternTooltip);

  // ── 드로잉 도구 초기화 ──
  _initDrawingTools();

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

  // ── 사이드바 토글 grid transition 완료 시 차트 리사이즈 ──
  const mainEl = document.getElementById('main');
  if (mainEl) {
    mainEl.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'grid-template-columns') {
        if (typeof chartManager !== 'undefined' && chartManager.mainChart) {
          const container = document.getElementById('main-chart-container');
          if (container) {
            chartManager.mainChart.applyOptions({ width: container.clientWidth });
          }
        }
      }
    });
  }

  // 실시간 데이터 시작
  startRealtimeTick();

  // 즐겨찾기 별 버튼 초기 갱신
  _updateStarBtn();

  // 지수 폴백: WS 미연결 시 최신 지수 가져오기
  _fetchIndexFallback();

  // 사이드바 종목 데이터 프리로드 (백그라운드)
  _preloadSidebarData();

  // 첫 방문자 온보딩 오버레이
  showOnboarding();
}

// ══════════════════════════════════════════════════════
//  지수 폴백: WS 미연결 시 index.json에서 지수 표시
// ══════════════════════════════════════════════════════

function _fetchIndexFallback() {
  // WS 연결 시에는 서버에서 실시간으로 받으므로 스킵
  if (typeof realtimeProvider !== 'undefined' && realtimeProvider.connected) return;

  // 10초 후에도 지수가 "—"이면 폴백 시도
  setTimeout(function() {
    var kospiEl = document.getElementById('t-kospi');
    if (kospiEl && kospiEl.textContent !== '\u2014') return; // 이미 갱신됨

    _loadIndexFromJSON();
  }, 10000);
}

function _loadIndexFromJSON() {
  fetch('data/index.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      if (!data) return;
      // index.json에 indices 필드가 있으면 표시
      if (data.indices) {
        var kospiEl = document.getElementById('t-kospi');
        var kosdaqEl = document.getElementById('t-kosdaq');
        if (data.indices.kospi && kospiEl && kospiEl.textContent === '\u2014') {
          kospiEl.textContent = Number(data.indices.kospi).toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
        }
        if (data.indices.kosdaq && kosdaqEl && kosdaqEl.textContent === '\u2014') {
          kosdaqEl.textContent = Number(data.indices.kosdaq).toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
        }
      }
    })
    .catch(function() {}); // 실패 시 무시 (—로 유지)
}

// ══════════════════════════════════════════════════════
//  사이드바 종목 데이터 프리로드 (file 모드 전용)
// ══════════════════════════════════════════════════════

async function _preloadSidebarData() {
  // 사이드바 종목들의 일봉 데이터를 프리로드 (프로그레시브 렌더링)
  //
  // [최적화 v2]
  //   1. 시총 순 정렬 → 삼성전자/SK하이닉스 등 대형주 우선 로드
  //   2. 배치 크기 3으로 축소 → UI 블로킹 최소화
  //   3. 배치 사이 setTimeout(0) → 브라우저에 렌더 기회 양보
  //   4. 매 배치 완료 시 sidebarManager.updatePrices() → 스파크라인 점진 표시

  // 사이드바에 표시된 종목 목록 (이미 시총 순 정렬됨) 사용, 없으면 ALL_STOCKS 폴백
  var stocks;
  if (typeof sidebarManager !== 'undefined' && sidebarManager.getFilteredStocks) {
    stocks = sidebarManager.getFilteredStocks();
  } else {
    stocks = (typeof ALL_STOCKS !== 'undefined' ? ALL_STOCKS : []);
  }

  // 시총 내림차순 정렬 (중요 종목 우선 로드)
  // [OPT] 30→10: 상위 10종목만 프리로드, 나머지는 클릭 시 온디맨드 로드
  //   네트워크: 30×25KB=750KB → 10×25KB=250KB, 약 2초 내 완료
  var displayCount = 10;
  stocks = stocks.slice(0, displayCount).sort(function(a, b) {
    return (b.marketCap || b.base || 0) - (a.marketCap || a.base || 0);
  });

  var batchSize = 8;  // [OPT] 3→8: 10종목을 2배치로 빠르게 완료

  for (var batch = 0; batch < stocks.length; batch += batchSize) {
    var batchStocks = stocks.slice(batch, batch + batchSize);
    var promises = [];

    for (var i = 0; i < batchStocks.length; i++) {
      var stock = batchStocks[i];
      if (stock.code === currentStock.code) continue;
      var cacheKey = stock.code + '-1d';
      if (dataService.cache[cacheKey]) continue;

      promises.push((function(s, key) {
        return dataService._fileGetCandles(s).then(function(candles) {
          if (candles && candles.length > 0) {
            dataService.cache[key] = { candles: candles, lastUpdate: Date.now() };
          }
        }).catch(function(err) { console.warn('[KRX] 프리로드 실패:', s.code, err.message || err); });
      })(stock, cacheKey));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      // 배치마다 중간 갱신 → 스파크라인 점진 표시 (체감 속도 향상)
      if (typeof sidebarManager !== 'undefined' && sidebarManager.updatePrices) {
        sidebarManager.updatePrices();
      }
      // UI 스레드에 제어권 반환 → 브라우저 멈춤 방지
      await new Promise(function(r) { setTimeout(r, 0); });
    }
  }
}

// ══════════════════════════════════════════════════════
//  온보딩 툴팁 투어 (5단계, 첫 방문자)
//
//  localStorage 'krx_onboarding_v2' 키로 완료 여부 관리.
//  오버레이는 pointer-events:none → 앱 사용을 차단하지 않음.
//  각 스텝의 target 요소가 DOM에 없으면 자동 스킵.
// ══════════════════════════════════════════════════════

var ONBOARDING_KEY = 'krx_onboarding_v2';

function showOnboarding() {
  // 이미 투어 완료했으면 표시하지 않음
  if (localStorage.getItem(ONBOARDING_KEY)) return;

  // ── 5단계 투어 정의 ──
  var steps = [
    {
      target: '#sidebar',
      text: '종목을 클릭하여 차트를 확인하세요.\n검색창에서 종목명/코드로 빠르게 찾을 수 있습니다.',
      position: 'right'
    },
    {
      target: '#main-chart-container',
      text: '마우스 휠로 줌, 드래그로 스크롤할 수 있습니다.\n크로스헤어로 OHLCV를 실시간 확인합니다.',
      position: 'center'
    },
    {
      target: '#draw-toolbar',
      text: '추세선, 수평선, 피보나치 등 6가지 드로잉 도구를 제공합니다.\n키보드 단축키(T/H/V/R/G)도 지원합니다.',
      position: 'right'
    },
    {
      target: '#ind-dropdown-toggle',
      text: '13가지 기술적 지표를 추가할 수 있습니다.\n우클릭으로 파라미터(기간, 표준편차 등)를 변경하세요.',
      position: 'bottom'
    },
    {
      target: '#pattern-toggle',
      text: '패턴 버튼으로 26종 캔들/차트 패턴을 자동 감지합니다.\n감지 결과는 차트 위에 시각화되고 수익률 통계도 확인할 수 있습니다.',
      position: 'bottom'
    }
  ];

  var currentStep = 0;
  var overlay = null;

  // ── 진행 바 (도트) HTML 생성 ──
  function _buildProgressDots(activeIdx) {
    var html = '<div class="ob-progress">';
    for (var i = 0; i < steps.length; i++) {
      var cls = 'ob-dot';
      if (i === activeIdx) cls += ' active';
      else if (i < activeIdx) cls += ' done';
      html += '<span class="' + cls + '"></span>';
    }
    html += '</div>';
    return html;
  }

  // ── 이전 툴팁 / 하이라이트 제거 ──
  function _cleanup() {
    var prev = document.querySelector('.onboarding-tooltip');
    if (prev) prev.remove();
    var hl = document.querySelector('.onboarding-highlight');
    if (hl) hl.classList.remove('onboarding-highlight');
  }

  // ── 투어 종료 (완료 또는 건너뛰기) ──
  function _endTour() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    _cleanup();
    if (overlay && overlay.parentNode) {
      overlay.style.animation = 'obFadeIn .2s ease reverse forwards';
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }
  }

  // ── 특정 스텝 표시 ──
  function _showStep(idx) {
    _cleanup();

    // 모든 스텝 완료
    if (idx >= steps.length) {
      _endTour();
      return;
    }

    var step = steps[idx];
    var target = document.querySelector(step.target);

    // target 요소가 없으면 다음 스텝으로 건너뜀
    if (!target) {
      _showStep(idx + 1);
      return;
    }

    currentStep = idx;

    // 하이라이트 적용
    target.classList.add('onboarding-highlight');

    // 대상 요소가 보이도록 스크롤
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 툴팁 생성
    var tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.setAttribute('data-pos', step.position);

    var isLast = (idx === steps.length - 1);

    tooltip.innerHTML =
      '<div class="ob-text">' + step.text.replace(/\n/g, '<br>') + '</div>' +
      '<div class="ob-actions">' +
        '<span class="ob-counter">' + (idx + 1) + ' / ' + steps.length + '</span>' +
        '<button class="ob-skip">\uAC74\uB108\uB6F0\uAE30</button>' +
        '<button class="ob-next">' + (isLast ? '\uC644\uB8CC' : '\uB2E4\uC74C') + '</button>' +
      '</div>' +
      _buildProgressDots(idx);

    document.body.appendChild(tooltip);

    // ── 위치 계산 ──
    var rect = target.getBoundingClientRect();
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var gap = 12; // 요소와 툴팁 사이 간격

    var left, top;

    switch (step.position) {
      case 'right':
        left = rect.right + gap;
        top = rect.top + Math.min(20, rect.height / 2 - th / 2);
        // 화면 오른쪽 넘어가면 왼쪽으로 배치
        if (left + tw > window.innerWidth - 8) {
          left = rect.left - tw - gap;
          tooltip.setAttribute('data-pos', 'left');
        }
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - tw / 2;
        top = rect.bottom + gap;
        // 화면 아래 넘어가면 위로
        if (top + th > window.innerHeight - 8) {
          top = rect.top - th - gap;
          tooltip.setAttribute('data-pos', 'top');
        }
        break;
      case 'center':
        // 차트 영역 중앙에 표시
        left = rect.left + rect.width / 2 - tw / 2;
        top = rect.top + rect.height / 2 - th / 2;
        break;
      default:
        left = rect.right + gap;
        top = rect.top;
    }

    // 화면 경계 보정
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // ── 이벤트 바인딩 ──
    tooltip.querySelector('.ob-next').addEventListener('click', function() {
      _showStep(idx + 1);
    });

    tooltip.querySelector('.ob-skip').addEventListener('click', function() {
      _endTour();
    });
  }

  // ── 투어 시작 (앱 로드 완료 후 1.5초 딜레이) ──
  setTimeout(function() {
    // 오버레이 생성
    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);

    // 오버레이 클릭 시에도 다음 스텝 (pointer-events:none이므로 실제로는 작동하지 않지만 안전 장치)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _showStep(currentStep + 1);
    });

    // Esc 키로 투어 종료
    var _escHandler = function(e) {
      if (e.key === 'Escape') {
        _endTour();
        document.removeEventListener('keydown', _escHandler);
      }
    };
    document.addEventListener('keydown', _escHandler);

    _showStep(0);
  }, 1500);
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

          // 보존된 차트 패턴 구조선 병합 (드래그 시 소실 방지)
          detectedPatterns = _mergeChartPatternStructLines(dragPatterns);
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

// ══════════════════════════════════════════════════════
//  실시간 데이터 (Kiwoom WebSocket → 데모 폴백)
// ══════════════════════════════════════════════════════

// ── rAF 배치 틱 업데이트 ──────────────────────────────
// WS에서 16ms(60fps) 안에 여러 틱이 올 수 있음.
// 매 틱마다 차트를 다시 그리면 CPU 낭비 → 프레임당 1회만 렌더.
// 데이터(candles, price 등)는 즉시 반영하되, 무거운 렌더링만 배치.
var _pendingTickData = null;  // 다음 rAF에서 적용할 마지막 틱 데이터
var _tickRafId = 0;

/**
 * rAF 콜백 — 배치된 틱 데이터로 차트 렌더링 1회 실행
 */
function _flushTickRender() {
  _tickRafId = 0;
  var data = _pendingTickData;
  if (!data) return;
  _pendingTickData = null;

  // 캔들이 있을 때만 차트 업데이트
  if (data.candles && data.candles.length > 0) {
    candles = data.candles;
    _markDataFresh();  // WS 캔들 수신 시각 기록

    // WS에서 받은 캔들을 dataService 캐시에도 반영 (L1 메모리 + L2 IDB)
    if (currentStock) {
      var cacheKey = currentStock.code + '-' + currentTimeframe;
      var cacheEntry = { candles: candles, lastUpdate: Date.now() };
      dataService.cache[cacheKey] = cacheEntry;
      // 일봉이면 IndexedDB에도 저장 (다음 페이지 로드 시 즉시 사용)
      if (currentTimeframe === '1d' && typeof _idb !== 'undefined') {
        _idb.set(cacheKey, cacheEntry);
      }
    }

    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    sidebarManager.updatePrices();

    // 서버 캔들 수신 성공 → 워터마크를 종목명으로 복원 + 로딩 오버레이 숨김
    if (currentStock) {
      chartManager.setWatermark(currentStock.name);
    }
    _hideLoadingOverlay();
  }

  chartManager.updatePriceLines(data.currentPrice, data.dayHigh, data.dayLow, data.previousClose);
}

function startRealtimeTick() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (_realtimeUnsub) { _realtimeUnsub(); _realtimeUnsub = null; }
  if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }
  // rAF 배치 초기화
  _pendingTickData = null;
  if (_tickRafId) { cancelAnimationFrame(_tickRafId); _tickRafId = 0; }

  _realtimeUnsub = realtimeProvider.onTick((data) => {
    // 에러는 즉시 처리 (배치하지 않음 — 사용자 피드백 지연 방지)
    if (data.error) {
      updateLiveStatus('offline');
      // WS 모드: 재연결을 기다림
      // WS 외: 정적 차트 모드 전환 (file=실제 데이터, demo=시뮬레이션)
      if (KRX_API_CONFIG.mode !== 'ws' && !tickTimer && !_realtimeMode) {
        startDemoTick();
      }
      return;
    }

    _realtimeMode = true;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

    // WebSocket 연결 상태 표시 (경량 — 즉시 처리)
    var liveLabel = realtimeProvider.mode === 'ws' ? 'ws' : 'live';
    updateLiveStatus(liveLabel);

    // 빈 캔들은 로그만 남기고 배치하지 않음
    if (!data.candles || data.candles.length === 0) {
      console.log('[KRX] WS 캔들 수신: 빈 배열 (실시간 틱 대기 중)');
      // 가격 라인은 캔들 없이도 업데이트 가능
      chartManager.updatePriceLines(data.currentPrice, data.dayHigh, data.dayLow, data.previousClose);
      return;
    }

    // 최신 틱 데이터만 보관 (이전 미렌더링 틱은 덮어씀)
    _pendingTickData = data;

    // 이미 rAF 예약되어 있으면 다음 프레임에서 최신 데이터로 렌더
    if (!_tickRafId) {
      _tickRafId = requestAnimationFrame(_flushTickRender);
    }
  });

  realtimeProvider.start(currentStock, currentTimeframe);

  // WS 모드: 서버 응답 대기 (Kiwoom 로그인+TR 포함하면 시간 소요 가능)
  if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 재연결은 realtimeProvider 내부에서 자동 처리
    // 서버 미연결 시 file 모드 일봉 데이터로 정적 차트 표시 (Naver 사용 안 함)
    _fallbackTimer = setTimeout(async () => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected) {
        console.warn('[KRX] WS 서버 연결 대기 중 (10초 타임아웃)...');
        updateLiveStatus('offline');

        // 차트가 비어있으면 file 모드 폴백 시도 (일봉만 — 분봉은 서버 전용)
        if (candles.length === 0 && currentStock) {
          if (currentTimeframe === '1d') {
            const fallbackCandles = await dataService._fileGetCandles(currentStock);
            if (fallbackCandles.length > 0) {
              candles = fallbackCandles;
              _markDataFresh();  // 폴백 데이터 수신 시각 기록
              const cacheKey = `${currentStock.code}-${currentTimeframe}`;
              const cacheEntry = { candles, lastUpdate: Date.now() };
              dataService.cache[cacheKey] = cacheEntry;
              // 일봉 file 폴백도 IDB에 저장 (다음 로드 시 즉시 사용)
              if (typeof _idb !== 'undefined') { _idb.set(cacheKey, cacheEntry); }
              updateChartFull();
              updateStockInfo();
              updateOHLCBar(null);
              chartManager.setWatermark(currentStock.name);
              console.log('[KRX] WS 미연결 — file 폴백 일봉 로드: %s (%d건)',
                currentStock.code, candles.length);
            }
          } else {
            // 분봉: 서버 미연결 시 빈 차트 + 안내 메시지 (가짜 데이터 생성 안 함)
            chartManager.setWatermark(currentStock.name + ' (분봉 — 서버 연결 필요)');
            console.log('[KRX] WS 미연결 — 분봉 데이터 없음: %s %s (서버 재연결 대기)',
              currentStock.code, currentTimeframe);
          }
        }
        // 서버 재연결 시 onTick 콜백에서 자동 복구
      }
    }, 10000);
  } else {
    // file/demo 모드: 짧은 대기 후 정적 차트 모드 전환
    _fallbackTimer = setTimeout(() => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected && !tickTimer) {
        console.log('[KRX] 실시간 연결 실패, 정적 모드 시작 (%s)', KRX_API_CONFIG.mode);
        startDemoTick();
      }
    }, 4000);
  }
}

function startDemoTick() {
  _realtimeMode = false;
  // rAF 배치 취소 (데모/정적 모드에서는 WS 틱 없음)
  _pendingTickData = null;
  if (_tickRafId) { cancelAnimationFrame(_tickRafId); _tickRafId = 0; }
  // file 모드: 실제 데이터임을 표시 / demo 모드: 시뮬레이션 데이터임을 경고
  var statusLabel = (KRX_API_CONFIG.mode === 'file') ? 'file' : 'demo';
  updateLiveStatus(statusLabel);
  // 정적 차트만 표시 (랜덤 틱 생성하지 않음)
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
      // [OPT] 메인 스레드 동기 분석을 지연 실행 — 차트 렌더링 우선
      // 패턴 분석(50-200ms)이 차트 최초 렌더를 차단하지 않도록
      // 먼저 빈 패턴으로 차트를 그린 뒤, 다음 프레임에서 분석 + 재렌더
      var _deferredVersion = _workerVersion;
      setTimeout(function() {
        if (_deferredVersion !== _workerVersion) return;  // stale 방지
        _analyzeOnMainThread();
        // 분석 완료 후 차트 + 렌더러만 갱신 (재귀 방지: 직접 호출)
        chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns, indParams);
        var filtSigs = _filterSignalsByCategory(detectedSignals);
        if (typeof signalRenderer !== 'undefined') {
          signalRenderer.render(chartManager, candles, filtSigs, {
            volumeActive: activeIndicators.has('vol'),
            chartType: chartType,
          });
        }
        chartManager.setHoverData(candles, detectedPatterns, filtSigs);
      }, 0);
    }

    _lastPatternAnalysis = now;
  } else if (!patternEnabled) {
    detectedPatterns = [];
    detectedSignals = [];
  }

  chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns, indParams);

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
    chartManager.updateRSI(candles, indParams);
    // 서브차트 라벨에 커스텀 기간 반영
    if (_dom.rsiLabel) _dom.rsiLabel.textContent = 'RSI (' + (indParams.rsi ? indParams.rsi.period : 14) + ')';
  } else {
    _dom.rsiContainer.style.display = 'none';
    if (_dom.rsiLabel) _dom.rsiLabel.style.display = 'none';
    chartManager.destroyRSI();
  }

  if (activeIndicators.has('macd')) {
    _dom.macdContainer.style.display = 'block';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'block';
    if (!chartManager.macdChart) chartManager.createMACDChart(_dom.macdContainer);
    chartManager.updateMACD(candles, indParams);
    // 서브차트 라벨에 커스텀 파라미터 반영
    var mp = indParams.macd || { fast: 12, slow: 26, signal: 9 };
    if (_dom.macdLabel) _dom.macdLabel.textContent = 'MACD (' + mp.fast + ', ' + mp.slow + ', ' + mp.signal + ')';
  } else {
    _dom.macdContainer.style.display = 'none';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'none';
    chartManager.destroyMACD();
  }

  // [NEW] Stochastic
  if (activeIndicators.has('stoch') && _dom.stochContainer) {
    _dom.stochContainer.style.display = 'block';
    if (_dom.stochLabel) _dom.stochLabel.style.display = 'block';
    if (!chartManager.stochChart) chartManager.createStochasticChart(_dom.stochContainer);
    chartManager.updateStochastic(candles);
  } else if (_dom.stochContainer) {
    _dom.stochContainer.style.display = 'none';
    if (_dom.stochLabel) _dom.stochLabel.style.display = 'none';
    chartManager.destroyStochastic();
  }

  // [NEW] CCI
  if (activeIndicators.has('cci') && _dom.cciContainer) {
    _dom.cciContainer.style.display = 'block';
    if (_dom.cciLabel) _dom.cciLabel.style.display = 'block';
    if (!chartManager.cciChart) chartManager.createCCIChart(_dom.cciContainer);
    chartManager.updateCCI(candles);
  } else if (_dom.cciContainer) {
    _dom.cciContainer.style.display = 'none';
    if (_dom.cciLabel) _dom.cciLabel.style.display = 'none';
    chartManager.destroyCCI();
  }

  // [NEW] ADX
  if (activeIndicators.has('adx') && _dom.adxContainer) {
    _dom.adxContainer.style.display = 'block';
    if (_dom.adxLabel) _dom.adxLabel.style.display = 'block';
    if (!chartManager.adxChart) chartManager.createADXChart(_dom.adxContainer);
    chartManager.updateADX(candles);
  } else if (_dom.adxContainer) {
    _dom.adxContainer.style.display = 'none';
    if (_dom.adxLabel) _dom.adxLabel.style.display = 'none';
    chartManager.destroyADX();
  }

  // [NEW] Williams %R
  if (activeIndicators.has('willr') && _dom.willrContainer) {
    _dom.willrContainer.style.display = 'block';
    if (_dom.willrLabel) _dom.willrLabel.style.display = 'block';
    if (!chartManager.willrChart) chartManager.createWilliamsRChart(_dom.willrContainer);
    chartManager.updateWilliamsR(candles);
  } else if (_dom.willrContainer) {
    _dom.willrContainer.style.display = 'none';
    if (_dom.willrLabel) _dom.willrLabel.style.display = 'none';
    chartManager.destroyWilliamsR();
  }

  // [NEW] ATR
  if (activeIndicators.has('atr') && _dom.atrContainer) {
    _dom.atrContainer.style.display = 'block';
    if (_dom.atrLabel) _dom.atrLabel.style.display = 'block';
    if (!chartManager.atrChart) chartManager.createATRChart(_dom.atrContainer);
    chartManager.updateATR(candles);
  } else if (_dom.atrContainer) {
    _dom.atrContainer.style.display = 'none';
    if (_dom.atrLabel) _dom.atrLabel.style.display = 'none';
    chartManager.destroyATR();
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
// _CHART_PATTERN_TYPES는 상단(61줄)에서 이미 정의됨
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
  const visiblePatterns = patternEngine.analyze(visibleCandles);

  // 인덱스 오프셋 보정: visibleCandles[0]이 candles[clampFrom]
  visiblePatterns.forEach(p => {
    if (p.startIndex != null) p.startIndex += clampFrom;
    if (p.endIndex != null) p.endIndex += clampFrom;
  });

  // 보존된 차트 패턴 구조선 병합 (드래그 시 소실 방지)
  detectedPatterns = _mergeChartPatternStructLines(visiblePatterns);
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

  // [UX] 크로스헤어 RSI/MACD 지표값 표시 (캐시된 계산값 사용, 재계산 없음)
  var idx = d._idx;  // crosshair 콜백에서 전달받은 인덱스
  if (idx == null && candles.length) idx = candles.length - 1;

  if (_dom.ohlcRsi) {
    if (activeIndicators.has('rsi') && chartManager._lastRsiValues && idx != null) {
      var rsiVal = chartManager._lastRsiValues[idx];
      if (rsiVal != null) {
        _dom.ohlcRsi.style.display = '';
        _dom.ohlcRsiVal.textContent = rsiVal.toFixed(1);
        _dom.ohlcRsiVal.style.color = rsiVal > 70 ? KRX_COLORS.UP : rsiVal < 30 ? KRX_COLORS.DOWN : '';
      } else {
        _dom.ohlcRsi.style.display = 'none';
      }
    } else {
      _dom.ohlcRsi.style.display = 'none';
    }
  }
  if (_dom.ohlcMacd) {
    if (activeIndicators.has('macd') && chartManager._lastMacdValues && idx != null) {
      var macdVal = chartManager._lastMacdValues.macdLine[idx];
      if (macdVal != null) {
        _dom.ohlcMacd.style.display = '';
        _dom.ohlcMacdVal.textContent = macdVal.toFixed(0);
        _dom.ohlcMacdVal.style.color = macdVal >= 0 ? KRX_COLORS.UP : KRX_COLORS.DOWN;
      } else {
        _dom.ohlcMacd.style.display = 'none';
      }
    } else {
      _dom.ohlcMacd.style.display = 'none';
    }
  }
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
    // 상태별 라벨 텍스트 — file 모드 추가 (실제 데이터 사용 중 표시)
    var labelMap = {
      live: 'LIVE',
      ws: 'WS',
      file: 'FILE',
      demo: 'DEMO',
      offline: 'OFFLINE'
    };
    label.textContent = labelMap[status] || 'OFFLINE';
  }
  dot.title = {
    live: 'Kiwoom 실시간',
    ws: 'Kiwoom WebSocket 실시간',
    file: '파일 모드 (실제 일봉 데이터)',
    demo: '데모 모드 (시뮬레이션)',
    offline: '연결 끊김'
  }[status] || '';

  // 상태 변경 시에만 toast 알림 (중복 방지)
  if (status !== _prevLiveStatus) {
    _prevLiveStatus = status;
    var toastMap = {
      live: ['Kiwoom 실시간 연결됨', 'success'],
      ws:   ['WebSocket 실시간 연결됨', 'success'],
      file: ['파일 모드 — 실제 일봉 데이터', 'info'],
      demo: ['데모 모드 (시뮬레이션 데이터)', 'warning'],
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
  // [FIX] 기존 타이머 정리 (중복 방지)
  if (_marketStateTimer) clearInterval(_marketStateTimer);
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

  // [FIX] 레이스 컨디션 수정: 비동기 getCandles() 전에 worker/drag 버전 증가
  _lastPatternAnalysis = 0;
  _workerVersion++;
  _workerPending = false;
  _dragVersion++;
  if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
  _chartPatternStructLines = [];
  _prevPrice = null;
  _prevPatternCount = -1;
  if (typeof backtester !== 'undefined') backtester.invalidateCache();

  // [OPT] 로딩 shimmer를 기존 차트 위에 표시 (빈 차트 노출 방지)
  _dom.mainContainer.classList.add('chart-loading');

  // [OPT] 데이터를 먼저 fetch — 차트 destroy/recreate 전에 데이터 준비
  var newCandles;
  try {
    newCandles = await dataService.getCandles(currentStock, currentTimeframe);
  } catch (e) {
    console.error('[KRX] 캔들 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 데이터 로드 실패', 'error');
    newCandles = [];
  }
  if (version !== _selectVersion) return;

  // 데이터 준비 완료 → 차트 재생성 + 즉시 데이터 투입
  candles = newCandles;

  chartManager.destroyAll();
  chartManager.createMainChart(_dom.mainContainer);
  _cacheDom();  // [FIX] 차트 재생성 후 DOM 캐시 갱신

  // 드로잉 도구 재연결 (차트 재생성 후)
  if (typeof drawingTools !== 'undefined') {
    drawingTools.detach();
    drawingTools.setStockCode(code);
    _initDrawingTools();
  }

  // 로딩 해제
  _dom.mainContainer.classList.remove('chart-loading');

  if (candles.length > 0) {
    _markDataFresh();  // 종목 변경 데이터 수신 시각 기록
    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
    if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
      chartManager.setWatermark(currentStock.name + ' (일봉 — 분봉 데이터 미제공)');
    } else {
      chartManager.setWatermark(currentStock.name);
    }
  } else if (KRX_API_CONFIG.mode === 'ws') {
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(currentStock.name + ' (서버 연결 중...)');
  } else if (KRX_API_CONFIG.mode === 'file') {
    chartManager.setWatermark(currentStock.name + ' (데이터 없음)');
  } else {
    chartManager.setWatermark(currentStock.name);
  }
  updateFinancials();

  // [FIX] OHLC 바 RAF 디바운스
  chartManager.onCrosshairMove(function(param) {
    cancelAnimationFrame(_ohlcRafId);
    _ohlcRafId = requestAnimationFrame(function() { updateOHLCBar(param); });
  });
  chartManager.onPatternHover(handlePatternTooltip);

  startRealtimeTick();

  // 즐겨찾기 별 버튼 갱신
  _updateStarBtn();
}

// ══════════════════════════════════════════════════════
//  종목 정보 업데이트
// ══════════════════════════════════════════════════════

function updateStockInfo() {
  if (!candles.length) return;
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const prevClose = prev ? prev.close : last.open;  // 전일 종가, 없으면 당일 시가
  const change = last.close - prevClose;
  const pct = prevClose > 0 ? ((change / prevClose) * 100).toFixed(2) : '0.00';
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

  // file/demo 모드에서도 가격선 표시
  if (candles.length > 0) {
    const lastC = candles[candles.length - 1];
    const prevC = candles.length >= 2 ? candles[candles.length - 2] : null;
    chartManager.updatePriceLines(
      lastC.close,
      lastC.high,
      lastC.low,
      prevC ? prevC.close : lastC.open
    );
  }
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

    // ── 예상 수익률 (priceTarget 기반 + 리스크/리워드 비율 바) ──
    //  벤치마크: Autochartist Forecast Zone의 "Expected Move" 표시
    //  TrendSpider의 "Projected Move" + R:R ratio 바
    let forecastHtml = '';
    if (item.source === 'pattern' && item.priceTarget && item.stopLoss) {
      // 진입가: chart.js에서 전달받은 실제 패턴 완성 봉 종가
      const entry = item.entryPrice || ((item.priceTarget + item.stopLoss) / 2);
      const reward = Math.abs(item.priceTarget - entry);
      const risk = Math.abs(entry - item.stopLoss);
      const rr = risk > 0 ? (reward / risk).toFixed(1) : '--';
      const retPct = entry > 0 ? ((item.priceTarget - entry) / entry * 100).toFixed(1) : '--';
      const retSign = parseFloat(retPct) >= 0 ? '+' : '';
      const retCls = parseFloat(retPct) >= 0 ? 'up' : 'dn';

      // R:R 비율 바 (시각적 리스크/리워드)
      const rrNum = parseFloat(rr);
      const rewardPct = rrNum > 0 ? Math.min(80, Math.round(rrNum / (1 + rrNum) * 100)) : 50;

      forecastHtml = `<div class="pt-forecast"><div class="pt-forecast-row"><span class="pt-forecast-ret ${retCls}">${retSign}${retPct}%</span><span class="pt-forecast-rr">R:R ${rr}</span></div><div class="pt-rr-bar"><div class="pt-rr-reward" style="width:${rewardPct}%"></div></div></div>`;
    }

    // ── 과거 수익률 (backtester 연동) ──
    //  벤치마크: TradingView Auto Chart Patterns의 "Historical Performance"
    //  Thomas Bulkowski 통계 스타일: 샘플 수 + 5일 후 평균 수익률 + 승률
    let backtestHtml = '';
    if (item.source === 'pattern' && item.type && typeof backtester !== 'undefined' && candles && candles.length >= 50) {
      try {
        const btResult = backtester.backtest(candles, item.type);
        if (btResult && btResult.sampleSize > 0) {
          const h5 = btResult.horizons[5];
          if (h5 && h5.n > 0) {
            const btRetSign = h5.mean >= 0 ? '+' : '';
            const btRetCls = h5.mean >= 0 ? 'up' : 'dn';
            backtestHtml = `<div class="pt-backtest"><span class="pt-bt-label">과거 ${btResult.sampleSize}회</span><span class="pt-bt-ret ${btRetCls}">${btRetSign}${h5.mean.toFixed(1)}% (5D)</span><span class="pt-bt-win">${h5.winRate.toFixed(0)}%승</span></div>`;
          }
        }
      } catch (e) { /* backtester 오류 무시 */ }
    }

    return `<div class="pt-header"><span class="pt-name">${item.name}</span><span class="pt-signal ${sc}">${st}</span>${confText}</div><div class="pt-desc">${item.description}</div>${academicDescHtml}${forecastHtml}${backtestHtml}${meta}`;
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
  dropdown.innerHTML = '';
  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'search-item';
    empty.style.color = '#555e78';
    empty.textContent = '검색 결과 없음';
    dropdown.appendChild(empty);
  } else {
    matches.forEach(s => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.dataset.code = s.code;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = s.name;
      const codeSpan = document.createElement('span');
      codeSpan.className = 'code';
      codeSpan.textContent = s.code;
      const marketSpan = document.createElement('span');
      marketSpan.className = 'market-tag ' + s.market.toLowerCase();
      marketSpan.textContent = s.market;
      item.appendChild(nameSpan);
      item.appendChild(codeSpan);
      item.appendChild(marketSpan);
      item.addEventListener('click', () => {
        selectStock(item.dataset.code);
        searchInput.value = '';
        dropdown.classList.remove('show');
      });
      dropdown.appendChild(item);
    });
  }
  dropdown.classList.add('show');
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

    // [OPT] 빠른 타임프레임 전환 시 이전 fetch 결과 무시
    var myTfVersion = ++_tfVersion;

    // [FIX] 레이스 컨디션 수정: 비동기 fetch 전에 상태 초기화
    _lastPatternAnalysis = 0;
    _workerVersion++;
    _workerPending = false;
    _dragVersion++;
    if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
    _chartPatternStructLines = [];
    _prevPrice = null;
    _prevPatternCount = -1;

    // [OPT] 로딩 shimmer를 기존 차트 위에 표시 (빈 차트 노출 방지)
    _dom.mainContainer.classList.add('chart-loading');

    // [OPT] 데이터를 먼저 fetch — 차트 destroy/recreate 전에 데이터 준비
    // 캐시 히트 시 즉시 반환 (~0ms), 네트워크 fetch 시에만 대기
    // 기존: destroyAll → createChart → await fetch (빈 차트 노출)
    // 변경: await fetch → destroyAll → createChart → setData (즉시 렌더)
    var newCandles;
    try {
      newCandles = await dataService.getCandles(currentStock, currentTimeframe);
    } catch (e) {
      console.error('[KRX] 캔들 데이터 로드 실패:', e);
      newCandles = [];
    }

    // [OPT] stale 결과 무시 — 이미 다른 타임프레임으로 전환됨
    if (myTfVersion !== _tfVersion) return;

    // 데이터 준비 완료 → 차트 재생성 + 즉시 데이터 투입
    candles = newCandles;

    chartManager.destroyAll();
    chartManager.createMainChart(_dom.mainContainer);
    _cacheDom();  // [FIX] 차트 재생성 후 DOM 캐시 갱신
    // [FIX] OHLC 바 RAF 디바운스
    chartManager.onCrosshairMove(function(param) {
      cancelAnimationFrame(_ohlcRafId);
      _ohlcRafId = requestAnimationFrame(function() { updateOHLCBar(param); });
    });
    chartManager.onPatternHover(handlePatternTooltip);
    // 드로잉 도구 재연결 (차트 재생성 후)
    if (typeof drawingTools !== 'undefined') {
      drawingTools.detach();
      _initDrawingTools();
    }

    // 로딩 해제
    _dom.mainContainer.classList.remove('chart-loading');
    if (candles.length > 0) {
      _markDataFresh();  // 타임프레임 변경 데이터 수신 시각 기록
      updateChartFull();
      updateStockInfo();
      updateOHLCBar(null);
      // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
      if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
        chartManager.setWatermark(currentStock.name + ' (일봉 — 분봉 데이터 미제공)');
      } else {
        chartManager.setWatermark(currentStock.name);
      }
    } else if (KRX_API_CONFIG.mode === 'ws') {
      console.log('[KRX] WS 모드 — %s 캔들 서버 수신 대기 중...', currentTimeframe);
      chartManager.setWatermark(currentStock.name + ' (' + currentTimeframe + ' 로드 중...)');
    } else if (KRX_API_CONFIG.mode === 'file') {
      chartManager.setWatermark(currentStock.name + ' (데이터 없음)');
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
      // 지표 상태를 localStorage에 저장
      _savePrefs({ indicators: Array.from(activeIndicators) });
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


// ── 패턴 패널 슬라이드 토글 (1200px 이하 반응형) ──
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

  // 뷰포트가 넓어지면 (1200px 초과) 자동으로 상태 초기화
  const mq = window.matchMedia('(max-width: 1200px)');
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
//  드로잉 도구 초기화
//
//  좌측 수직 툴바 버튼 이벤트 + 차트 클릭 핸들러 연결
//  drawingTools.js에 정의된 드로잉 엔진과 app.js를 연결하는 글루 코드
// ══════════════════════════════════════════════════════

// [OPT] 드로잉 버튼 이벤트 리스너는 한 번만 등록 (중복 방지 플래그)
var _drawBtnsInitialized = false;
// [OPT] mouseup 이벤트 리스너도 한 번만 등록
var _drawMouseUpInitialized = false;

function _initDrawingTools() {
  if (typeof drawingTools === 'undefined') return;

  // 드로잉 도구 연결: primitive를 차트에 부착
  drawingTools.attach(chartManager);
  drawingTools.setStockCode(currentStock ? currentStock.code : null);

  // [OPT] 툴바 버튼 클릭 이벤트 — 한 번만 등록 (매 TF 전환마다 누적 방지)
  if (!_drawBtnsInitialized) {
    _drawBtnsInitialized = true;
    document.querySelectorAll('.draw-btn').forEach(function(btn) {
      var tool = btn.dataset.tool;
      // 색상 버튼은 도구 전환 대신 색상 선택기를 토글
      if (tool === 'color') {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          drawingTools.toggleColorPicker();
        });
        return;
      }
      btn.addEventListener('click', function() {
        drawingTools.setTool(tool);
      });
    });
  }

  // 메인 차트 클릭/크로스헤어 이벤트 — 차트 재생성마다 재등록 필요
  // (destroyAll()로 차트 객체가 교체되므로 subscribeClick/subscribeCrosshairMove 재등록)
  if (chartManager.mainChart) {
    chartManager.mainChart.subscribeClick(function(param) {
      if (!drawingTools.getActiveTool()) return;
      if (!param.time) return;

      var price = null;
      var targetSeries = chartManager.candleSeries;
      if (!targetSeries || (chartType === 'line' && chartManager.indicatorSeries._priceLine)) {
        targetSeries = chartManager.indicatorSeries._priceLine || chartManager.candleSeries;
      }
      if (param.point && targetSeries) {
        price = targetSeries.coordinateToPrice(param.point.y);
      }
      if (price == null) {
        var sd = param.seriesData && param.seriesData.get(targetSeries);
        if (sd) price = sd.close;
      }
      if (price == null) return;

      drawingTools.handleChartClick(price, param.time);
    });

    chartManager.mainChart.subscribeCrosshairMove(function(param) {
      if (!drawingTools.getActiveTool()) return;
      if (!param.time) return;

      var price = null;
      var moveSeries = chartManager.candleSeries;
      if (!moveSeries || (chartType === 'line' && chartManager.indicatorSeries._priceLine)) {
        moveSeries = chartManager.indicatorSeries._priceLine || chartManager.candleSeries;
      }
      if (param.point && moveSeries) {
        price = moveSeries.coordinateToPrice(param.point.y);
      }
      if (price == null) return;

      drawingTools.handleChartMouseMove(price, param.time);
    });
  }

  // [OPT] mouseup 이벤트 — 한 번만 등록 (DOM 요소는 변경되지 않음)
  if (!_drawMouseUpInitialized) {
    _drawMouseUpInitialized = true;
    var chartWrapEl = document.getElementById('chart-wrap');
    if (chartWrapEl) {
      chartWrapEl.addEventListener('mouseup', function() {
        if (typeof drawingTools !== 'undefined') {
          drawingTools.handleChartMouseUp();
        }
      });
    }
  }
}


// ══════════════════════════════════════════════════════
//  키보드 단축키
//
//  1-6: 타임프레임 전환, C: 차트타입 순환, P: 패턴 토글
//  T/H/V/R/G: 드로잉 도구, Del: 삭제 도구
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
    // 드로잉 도구 해제
    if (typeof drawingTools !== 'undefined' && drawingTools.getActiveTool()) {
      drawingTools.setTool(drawingTools.getActiveTool()); // 토글 해제
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
    const types = ['candle', 'line', 'bar', 'heikin'];
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

  // 드로잉 도구 단축키: S=선택, T=추세선, H=수평선, V=수직선, R=사각형, G=피보나치, Delete=삭제
  if (typeof drawingTools !== 'undefined') {
    const drawKeyMap = {
      s: 'select', S: 'select',
      t: 'trendline', T: 'trendline',
      h: 'hline', H: 'hline',
      v: 'vline', V: 'vline',
      r: 'rect', R: 'rect',
      g: 'fib', G: 'fib',
    };
    if (drawKeyMap[key]) {
      drawingTools.setTool(drawKeyMap[key]);
      e.preventDefault();
      return;
    }
    if (key === 'Delete') {
      drawingTools.setTool('eraser');
      e.preventDefault();
      return;
    }
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
//  스크린샷 내보내기
// ══════════════════════════════════════════════════════
document.getElementById('screenshot-btn')?.addEventListener('click', function() {
  var chartWrap = document.getElementById('chart-wrap');
  if (!chartWrap) return;

  var allCanvases = chartWrap.querySelectorAll('canvas');
  if (!allCanvases.length) {
    showToast('캡처할 차트가 없습니다', 'warning');
    return;
  }

  // 전체 chart-wrap 영역을 하나의 이미지로 합성
  var rect = chartWrap.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var outCanvas = document.createElement('canvas');
  outCanvas.width = rect.width * dpr;
  outCanvas.height = rect.height * dpr;
  var ctx = outCanvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 배경색 채우기
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim() || '#141414';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // 각 canvas를 상대 위치에 그리기 (메인 + RSI + MACD 서브차트 포함)
  allCanvases.forEach(function(c) {
    var cRect = c.getBoundingClientRect();
    try {
      ctx.drawImage(c, cRect.left - rect.left, cRect.top - rect.top, cRect.width, cRect.height);
    } catch (e) { /* cross-origin canvas 무시 */ }
  });

  // 워터마크
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px Pretendard, sans-serif';
  ctx.fillText('CheeseStock — ' + (currentStock ? currentStock.name : '') + ' ' + currentTimeframe, 10, rect.height - 10);

  // 다운로드
  var link = document.createElement('a');
  // [FIX] KST 날짜로 파일명 생성 (UTC→KST 보정)
  var _kstNow = new Date(Date.now() + 9 * 3600000);
  link.download = (currentStock ? currentStock.code : 'chart') + '_' + currentTimeframe + '_' + _kstNow.toISOString().slice(0, 10) + '.png';
  link.href = outCanvas.toDataURL('image/png');
  link.click();
  showToast('스크린샷 저장 완료', 'success');
});


// ══════════════════════════════════════════════════════
//  즐겨찾기 토글 버튼
// ══════════════════════════════════════════════════════
document.getElementById('watchlist-toggle-btn')?.addEventListener('click', function () {
  if (!currentStock) return;
  var added = _toggleWatchlist(currentStock.code);
  _updateStarBtn();
  showToast(currentStock.name + (added ? ' 즐겨찾기 추가' : ' 즐겨찾기 제거'), 'info');
  // 사이드바 즐겨찾기 섹션 갱신
  if (typeof sidebarManager !== 'undefined' && sidebarManager.renderWatchlist) {
    sidebarManager.renderWatchlist();
  }
});


// ══════════════════════════════════════════════════════
//  지표 파라미터 우클릭 팝업
// ══════════════════════════════════════════════════════

/** 지표 체크박스에 커스텀 표시 업데이트 */
function _markCustomParams() {
  document.querySelectorAll('#ind-dropdown-menu .ind-check').forEach(function (label) {
    var cb = label.querySelector('input[data-ind]');
    if (!cb) return;
    var ind = cb.dataset.ind;
    var defaults = DEFAULT_IND_PARAMS[ind];
    var current = indParams[ind];
    if (!defaults || !current) { label.classList.remove('param-custom'); return; }
    var isCustom = false;
    for (var k in defaults) {
      if (current[k] !== defaults[k]) { isCustom = true; break; }
    }
    label.classList.toggle('param-custom', isCustom);
  });
}

/** 팝업 열기 */
function _openParamPopup(ind, anchorEl) {
  var popup = document.getElementById('ind-param-popup');
  var fields = document.getElementById('ind-param-fields');
  if (!popup || !fields) return;

  var params = indParams[ind];
  if (!params) return;

  _activeParamInd = ind;

  // 필드 생성
  var html = '';
  for (var key in params) {
    var label = _PARAM_LABELS[key] || key;
    html += '<div class="ind-param-row">' +
      '<label>' + label + '</label>' +
      '<input type="number" data-key="' + key + '" value="' + params[key] + '" min="1" max="999" step="' + (key === 'stdDev' ? '0.1' : '1') + '">' +
      '</div>';
  }
  fields.innerHTML = html;

  // 타이틀 업데이트
  var nameMap = { ma: 'MA', ema: 'EMA', bb: '볼린저', rsi: 'RSI', macd: 'MACD', ich: '일목균형표' };
  popup.querySelector('.ind-param-title').textContent = (nameMap[ind] || ind) + ' 설정';

  // 위치 계산
  var rect = anchorEl.getBoundingClientRect();
  popup.style.display = '';
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';
}

/** 팝업 닫기 */
function _closeParamPopup() {
  var popup = document.getElementById('ind-param-popup');
  if (popup) popup.style.display = 'none';
  _activeParamInd = null;
}

// 적용 버튼
document.getElementById('ind-param-apply')?.addEventListener('click', function () {
  if (!_activeParamInd) return;
  var fields = document.getElementById('ind-param-fields');
  if (!fields) return;

  var ind = _activeParamInd;
  var params = indParams[ind] || {};
  fields.querySelectorAll('input[data-key]').forEach(function (input) {
    var val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) {
      params[input.dataset.key] = val;
    }
  });
  indParams[ind] = params;
  _saveIndParams(indParams);
  _markCustomParams();
  _closeParamPopup();
  updateChartFull();
  showToast(ind.toUpperCase() + ' 파라미터 적용 완료', 'success');
});

// 초기화 버튼
document.getElementById('ind-param-reset')?.addEventListener('click', function () {
  if (!_activeParamInd || !DEFAULT_IND_PARAMS[_activeParamInd]) return;
  var ind = _activeParamInd;
  indParams[ind] = JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS[ind]));
  _saveIndParams(indParams);
  _markCustomParams();
  _closeParamPopup();
  updateChartFull();
  showToast(ind.toUpperCase() + ' 파라미터 초기화', 'info');
});

// 팝업 외부 클릭 시 닫기
document.addEventListener('click', function (e) {
  var popup = document.getElementById('ind-param-popup');
  if (!popup || popup.style.display === 'none') return;
  if (!popup.contains(e.target)) {
    _closeParamPopup();
  }
});

// 지표 체크박스에 우클릭 이벤트 바인딩
document.querySelectorAll('#ind-dropdown-menu .ind-check').forEach(function (label) {
  label.addEventListener('contextmenu', function (e) {
    var cb = label.querySelector('input[data-ind]');
    if (!cb) return;
    var ind = cb.dataset.ind;
    // 파라미터가 정의된 지표만 팝업 열기
    if (!DEFAULT_IND_PARAMS[ind]) return;
    e.preventDefault();
    e.stopPropagation();
    _openParamPopup(ind, label);
  });
});

// 초기 커스텀 표시
_markCustomParams();


// ══════════════════════════════════════════════════════
//  시작
// ══════════════════════════════════════════════════════
init();
