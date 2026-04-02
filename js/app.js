// ══════════════════════════════════════════════════════
//  KRX LIVE — App Init (초기화 오케스트레이션)
//
//  init(), _continueInit(), 데이터 프리로드.
//  appState.js + appWorker.js + appUI.js 전역 함수 호출.
// ══════════════════════════════════════════════════════

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
  // 로컬 개발 환경에서만 가이드 표시 (공개 서버에서는 file 모드로 자동 진입)
  // 단, 종목 데이터(ALL_STOCKS)가 이미 로드되었으면 file 모드로 바로 진행 (WS 프로브는 백그라운드 진행 중)
  var _isLocalDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');
  var _hasStockData = (typeof ALL_STOCKS !== 'undefined' && ALL_STOCKS.length > 0);
  if (_originalMode === 'ws' && KRX_API_CONFIG.mode !== 'ws' && _isLocalDev && !_hasStockData) {
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

  // 통합 탭 패널: 활성 탭 복원
  if (prefs && typeof prefs.rpActiveTab === 'string') {
    _rpActiveTab = prefs.rpActiveTab;
  }

  // 시각화 레이어 토글 복원
  if (prefs && prefs.vizToggles) {
    vizToggles = Object.assign({ candle: true, chart: true, signal: true, forecast: true }, prefs.vizToggles);
  }

  // 활성 지표 복원 (localStorage 저장분 우선, 없으면 기본값 vol+ma 유지)
  if (prefs && Array.isArray(prefs.indicators)) {
    activeIndicators = new Set(prefs.indicators);
    // [2-slot 모델] 복원 시 오실레이터 상호 배제 강제 — 첫 번째만 유지
    var activeOscs = OSCILLATOR_GROUP.filter(function(o) { return activeIndicators.has(o); });
    if (activeOscs.length > 1) {
      for (var i = 1; i < activeOscs.length; i++) {
        activeIndicators.delete(activeOscs[i]);
      }
    }
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

  // [Phase I-L2] 시장 맥락 데이터 로드 — getContextualConfidence()에서 사용
  // scripts/download_market_context.py로 생성 (CCSI, VKOSPI, 투자자 순매수, 어닝시즌)
  try {
    var mctxRes = await fetch('data/market_context.json');
    if (mctxRes.ok) {
      _marketContext = await mctxRes.json();
      if (_marketContext.source === 'demo') {
        console.log('[KRX] 시장 맥락 데이터 로드 (데모 모드)');
      } else {
        console.log('[KRX] 시장 맥락 데이터 로드:', _marketContext.generated_at);
      }
    }
  } catch (e) {
    // market_context.json은 선택적 — 없어도 정상 동작
    console.log('[KRX] 시장 맥락 데이터 없음 (download_market_context.py 실행 시 활성화)');
  }

  // 매크로/채권 데이터 로드 (비차단 — 차트 오버레이 정보용)
  _loadMarketData();
  _loadDerivativesData();

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
        chartManager.setWatermark(_buildWatermark(currentStock.name, '로그인 대기 중...'));
      }
      updateLiveStatus('ws');
    } else if (status === 'ready') {
      // 로그인 완료 + 서버 준비 → 오버레이 숨김
      _hideLoadingOverlay();
      if (typeof chartManager !== 'undefined' && chartManager.mainChart) {
        chartManager.setWatermark(_buildWatermark(currentStock.name));
      }
      updateLiveStatus('live');
      showToast('Kiwoom 실시간 연결 완료', 'success');
    } else if (status === 'login_failed') {
      // 로그인 실패 → 오버레이 숨기고 파일 모드 전환
      _hideLoadingOverlay();
      KRX_API_CONFIG.mode = 'file';
      realtimeProvider._loginErrorReceived = true;
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
    _updatePriceLinesFromCandles();  // [FIX] 초기 로드 시 가격선 1회 생성
    updateOHLCBar(null);
    // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
    if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
      // 분봉 JSON 실제 로드 여부: Unix 타임스탬프(숫자)면 분봉, 문자열(YYYY-MM-DD)이면 일봉 폴백
      var _hasIntraday = candles.length > 0 && typeof candles[0].time === 'number';
      chartManager.setWatermark(_buildWatermark(currentStock.name, _hasIntraday ? '' : '일봉 — 분봉 데이터 미제공'));
    } else {
      chartManager.setWatermark(_buildWatermark(currentStock.name));
    }
    // 데이터 로드 완료 → 로딩 오버레이 숨김
    _hideLoadingOverlay();
  } else if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 캔들 수신 대기 (realtimeProvider.onTick에서 처리)
    // 오버레이는 유지 — serverStatus 'ready' 또는 onTick 수신 시 숨김
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(_buildWatermark(currentStock.name, '서버 연결 중...'));
    _setLoadingText('서버 연결 대기 중...', 'Kiwoom 서버 응답을 기다리는 중입니다');
  } else if (KRX_API_CONFIG.mode === 'file') {
    // file 모드: 데이터 파일 없음 안내 (가짜 데이터 표시하지 않음)
    chartManager.setWatermark(_buildWatermark(currentStock.name, '데이터 없음'));
    _hideLoadingOverlay();
  } else {
    chartManager.setWatermark(_buildWatermark(currentStock.name));
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
    // ── visible range 기반 고/저점 수평선 업데이트 ──
    // chart.js의 updateVisibleHighLow가 준비되면 자동 연결
    if (candles.length && typeof chartManager.updateVisibleHighLow === 'function') {
      chartManager.updateVisibleHighLow(candles);
    }

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
          learnedWeights: adaptiveWeights,
          market: currentStock && currentStock.market ? currentStock.market : '',
          timeframe: currentTimeframe,
          financialData: _getFinancialDataForSR(),  // 밸류에이션 S/R용 bps/eps
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
            const w = container.clientWidth;
            // 메인 차트 + 모든 서브차트 동시 리사이즈 (사이드바 토글 시 너비 불일치 방지)
            chartManager.mainChart.applyOptions({ width: w });
            if (chartManager._resizeMap) {
              chartManager._resizeMap.forEach(function(entry) {
                if (entry.chart !== chartManager.mainChart) {
                  try { entry.chart.applyOptions({ width: w }); } catch(e) {}
                }
              });
            }
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
//  시작
// ══════════════════════════════════════════════════════
init();
