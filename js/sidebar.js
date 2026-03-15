// ══════════════════════════════════════════════════════
//  KRX LIVE — 사이드바 매니저 v7.0
//  11개 기능 완전 구현:
//    R1:  키보드 ↑↓ 네비게이션
//    R2:  최근 본 종목 섹션
//    R3:  코드→tooltip, 거래량 컬럼
//    R4:  정렬 방향 화살표
//    R5:  Compact / Detailed 보기 모드
//    R6:  빠른 필터 칩 (전체/상승/하락/대량거래)
//    R7:  패턴명 표시
//    R8:  패턴 감지 종목만 필터
//    R9:  미니 스파크라인
//    R10: RSI 지표 값
//    R11: 드래그 앤 드롭 재정렬
// ══════════════════════════════════════════════════════

const sidebarManager = (() => {
  // ── LocalStorage 키 ──
  const LS_KEY = 'krx_sidebar_open';
  const LS_RECENT = 'krx-recent-stocks';
  const LS_VIEW = 'krx-sidebar-view';
  const LS_ORDER = 'krx-sidebar-order';

  // ── 내부 상태 ──
  let _open = true;
  let _currentSort = 'mcap';
  let _sortDirection = 'desc';
  let _searchQuery = '';
  let _viewMode = 'detailed';        // R5: 'compact' | 'detailed'
  let _activeFilter = 'all';         // R6: 'all' | 'up' | 'down' | 'highvol'
  let _patternOnlyFilter = false;    // R8: 패턴 감지 종목만
  let _kbFocusIndex = -1;            // R1: 키보드 포커스 인덱스
  let _recentStocks = [];            // R2: 최근 본 종목 코드 배열
  let _customOrder = null;           // R11: 사용자 정의 정렬 순서

  const MAX_RECENT = 8;
  const INITIAL_DISPLAY_COUNT = 20;

  const _prevPrices = {};
  const _stockChangeCache = {};
  const _stockPatternCache = {};     // code → { candle, indicator, volume, total, names }

  // ── 더보기 상태 (섹션별) ──
  const _showAllStocks = { 'sb-kospi': false, 'sb-kosdaq': false };

  // ── 패턴 카테고리 서브필터 ──
  const _patternSubFilters = ['all', 'candle', 'indicator', 'volume'];
  const _patternSubLabels = {
    all: '패턴별',
    candle: '캔들',
    indicator: 'MA/지표',
    volume: '거래량',
  };
  let _patternSubIdx = 0;

  // ── 시가총액 데이터 (억원 단위, 2025년 기준 근사치) ──
  const MARKET_CAP = {
    // KOSPI
    '005930': 4380000,  '000660': 1320000,  '005380':  480000,
    '000270':  390000,  '005490':  230000,  '051910':  225000,
    '006400':  195000,  '207940':  520000,  '068270':  230000,
    '035420':  330000,  '035720':  190000,  '028260':  170000,
    '105560':  290000,  '055550':  240000,  '003550':  130000,
    '066570':  160000,  '012330':  200000,  '034730':  150000,
    '015760':  140000,  '030200':   95000,  '033780':  130000,
    '009150':  110000,  '086790':  180000,  '018260':  120000,
    '032830':  160000,  '003670':  100000,  '096770':   90000,
    '010130':  100000,  '011200':   90000,  '034020':   65000,
    '005935':  360000,  '010950':   55000,  '011170':   25000,
    '017670':  130000,  '036570':   35000,
    // KOSDAQ
    '247540':   95000,  '086520':   80000,  '196170':  180000,
    '058470':   65000,  '328130':   40000,  '383220':   35000,
    '357780':   45000,  '145020':   40000,  '263750':   18000,
    '293490':   12000,  '112040':   10000,  '041510':   22000,
    '251270':   25000,  '067160':   20000,  '403870':   25000,
    '039030':   35000,  '095340':   20000,  '141080':   30000,
    '377300':   22000,  '035900':   28000,
  };


  // ════════════════════════════════════════════════════
  //  헬퍼 함수
  // ════════════════════════════════════════════════════

  /** 현재 타임프레임 가져오기 */
  function _tf() {
    return typeof currentTimeframe !== 'undefined' ? currentTimeframe : '1d';
  }

  /** 캐시된 캔들 데이터 가져오기 */
  function _getCachedCandles(code) {
    if (typeof dataService === 'undefined') return null;
    const cached = dataService.cache[code + '-' + _tf()];
    return (cached && cached.candles && cached.candles.length) ? cached.candles : null;
  }

  /** R3: 거래량 포맷팅 — 1.2억, 3,450만, 원본 */
  function _formatVolume(vol) {
    if (vol == null || vol === 0) return '-';
    if (vol >= 100000000) {
      return (vol / 100000000).toFixed(1) + '억';
    }
    if (vol >= 10000) {
      return Math.round(vol / 10000).toLocaleString() + '만';
    }
    return vol.toLocaleString();
  }

  /** 등락률 가져오기 (캐시 우선) */
  function _getChangePct(code) {
    if (_stockChangeCache[code] != null) return _stockChangeCache[code];
    const candles = _getCachedCandles(code);
    if (candles && candles.length >= 2) {
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      if (prev.close > 0) {
        const pct = (last.close - prev.close) / prev.close * 100;
        _stockChangeCache[code] = pct;
        return pct;
      }
    }
    return 0;
  }

  /** 패턴 카테고리별 카운트 추출 */
  function _getPatternCount(code, category) {
    const cached = _stockPatternCache[code];
    if (!cached) return 0;
    if (category === 'all') return cached.total || 0;
    return cached[category] || 0;
  }

  /** R10: RSI(14) 값 계산 (캐시된 데이터에서만) */
  function _getRSI(code) {
    if (typeof calcRSI !== 'function') return null;
    const candles = _getCachedCandles(code);
    if (!candles || candles.length < 16) return null;
    const closes = candles.map(function (c) { return c.close; });
    const rsi = calcRSI(closes, 14);
    const last = rsi[rsi.length - 1];
    return (last != null && !isNaN(last)) ? Math.round(last) : null;
  }

  /** R10: RSI 값에 따른 색상 */
  function _rsiColor(val) {
    if (val == null) return '#888';
    if (val < 30) return '#5086DC';   // 과매도 (파랑)
    if (val > 70) return '#E05050';   // 과매수 (빨강)
    return '#888';                    // 중립 (회색)
  }

  /** R3: 마지막 캔들 거래량 가져오기 */
  function _getLastVolume(code) {
    const candles = _getCachedCandles(code);
    if (!candles || !candles.length) return 0;
    return candles[candles.length - 1].volume || 0;
  }

  /** R9: 마지막 20개 종가 가져오기 */
  function _getLast20Closes(code) {
    const candles = _getCachedCandles(code);
    if (!candles || candles.length < 2) return null;
    const slice = candles.slice(-20);
    return slice.map(function (c) { return c.close; });
  }

  /** R6: 평균 거래량 비율 가져오기 */
  function _getVolumeRatio(code) {
    const candles = _getCachedCandles(code);
    if (!candles || candles.length < 21) return 1;
    const last = candles[candles.length - 1].volume || 0;
    let sum = 0;
    for (let i = candles.length - 21; i < candles.length - 1; i++) {
      sum += (candles[i].volume || 0);
    }
    const avg = sum / 20;
    return avg > 0 ? last / avg : 1;
  }


  // ════════════════════════════════════════════════════
  //  정렬 로직
  // ════════════════════════════════════════════════════

  function _sortStocks(stocks, sortBy) {
    const dir = _sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'change':
        return [].concat(stocks).sort(function (a, b) {
          return dir * (_getChangePct(b.code) - _getChangePct(a.code));
        });

      case 'pattern': {
        const cat = _patternSubFilters[_patternSubIdx];
        return [].concat(stocks).sort(function (a, b) {
          const pa = _getPatternCount(a.code, cat);
          const pb = _getPatternCount(b.code, cat);
          if (pb !== pa) return dir * (pb - pa);
          return (MARKET_CAP[b.code] || 0) - (MARKET_CAP[a.code] || 0);
        });
      }

      case 'mcap':
      default:
        return [].concat(stocks).sort(function (a, b) {
          return dir * ((MARKET_CAP[b.code] || 0) - (MARKET_CAP[a.code] || 0));
        });
    }
  }


  // ════════════════════════════════════════════════════
  //  필터 로직
  // ════════════════════════════════════════════════════

  /** 검색 필터 */
  function _filterBySearch(stocks) {
    if (!_searchQuery) return stocks;
    return stocks.filter(function (s) {
      return s.name.toLowerCase().includes(_searchQuery) ||
             s.code.includes(_searchQuery);
    });
  }

  /** R6: 퀵 필터 칩 적용 */
  function _filterByChip(stocks) {
    switch (_activeFilter) {
      case 'up':
        return stocks.filter(function (s) { return _getChangePct(s.code) > 0; });
      case 'down':
        return stocks.filter(function (s) { return _getChangePct(s.code) < 0; });
      case 'highvol':
        return stocks.filter(function (s) { return _getVolumeRatio(s.code) >= 2.0; });
      case 'all':
      default:
        return stocks;
    }
  }

  /** R8: 패턴 감지 종목만 필터 */
  function _filterByPatternOnly(stocks) {
    if (!_patternOnlyFilter) return stocks;
    return stocks.filter(function (s) {
      const cached = _stockPatternCache[s.code];
      return cached && cached.total > 0;
    });
  }


  // ════════════════════════════════════════════════════
  //  R2: 최근 본 종목
  // ════════════════════════════════════════════════════

  function _loadRecent() {
    try {
      const raw = localStorage.getItem(LS_RECENT);
      _recentStocks = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(_recentStocks)) _recentStocks = [];
    } catch (e) {
      _recentStocks = [];
    }
  }

  function _saveRecent() {
    try {
      localStorage.setItem(LS_RECENT, JSON.stringify(_recentStocks));
    } catch (e) { /* 용량 초과 무시 */ }
  }

  function setRecentStock(code) {
    // 중복 제거 후 맨 앞에 추가
    _recentStocks = _recentStocks.filter(function (c) { return c !== code; });
    _recentStocks.unshift(code);
    if (_recentStocks.length > MAX_RECENT) {
      _recentStocks = _recentStocks.slice(0, MAX_RECENT);
    }
    _saveRecent();
    _renderRecentSection();
  }

  function getRecentStocks() {
    return _recentStocks.slice();
  }

  /** 최근 본 종목 섹션 DOM 생성 (init에서 호출) */
  function _ensureRecentSection() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (document.getElementById('sb-recent-section')) return;

    const recentSection = document.createElement('div');
    recentSection.className = 'sb-section sb-recent-section';
    recentSection.id = 'sb-recent-section';
    recentSection.setAttribute('data-section', 'recent');
    recentSection.innerHTML =
      '<div class="sb-header" id="sb-recent-header">' +
        '<span class="sb-arrow"></span>' +
        '<span>최근 본 종목</span>' +
        '<span class="sb-count" id="sb-recent-count">0</span>' +
      '</div>' +
      '<div class="sb-body" id="sb-recent"></div>';

    // KOSPI 섹션 앞에 삽입
    const kospiSection = sidebar.querySelector('[data-section="kospi"]');
    if (kospiSection) {
      kospiSection.parentNode.insertBefore(recentSection, kospiSection);
    } else {
      sidebar.appendChild(recentSection);
    }

    // 아코디언 토글
    const header = document.getElementById('sb-recent-header');
    if (header) {
      header.addEventListener('click', function () {
        header.classList.toggle('collapsed');
      });
    }
  }

  /** 최근 본 종목 섹션 렌더링 */
  function _renderRecentSection() {
    const container = document.getElementById('sb-recent');
    const countEl = document.getElementById('sb-recent-count');
    const sectionEl = document.getElementById('sb-recent-section');
    if (!container) return;

    // ALL_STOCKS에서 최근 종목 정보 찾기
    const stocks = [];
    for (let i = 0; i < _recentStocks.length; i++) {
      const code = _recentStocks[i];
      const found = (typeof ALL_STOCKS !== 'undefined')
        ? ALL_STOCKS.find(function (s) { return s.code === code; })
        : null;
      if (found) stocks.push(found);
    }

    if (countEl) countEl.textContent = stocks.length;

    // 종목이 없으면 섹션 숨김
    if (sectionEl) {
      sectionEl.style.display = stocks.length > 0 ? '' : 'none';
    }

    if (stocks.length === 0) {
      container.innerHTML = '';
      return;
    }

    _renderItems(container, stocks, false, 0, null);
  }


  // ════════════════════════════════════════════════════
  //  R5: Compact / Detailed 보기 모드
  // ════════════════════════════════════════════════════

  function setViewMode(mode) {
    if (mode !== 'compact' && mode !== 'detailed') return;
    _viewMode = mode;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('sb-compact', 'sb-detailed');
      sidebar.classList.add(mode === 'compact' ? 'sb-compact' : 'sb-detailed');
    }
    // 토글 버튼 아이콘 갱신
    const toggleBtn = document.getElementById('sb-view-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = mode === 'compact' ? '\u2630' : '\u2637';
      toggleBtn.title = mode === 'compact' ? '상세 보기' : '간략 보기';
    }
    try { localStorage.setItem(LS_VIEW, mode); } catch (e) { /* ignore */ }
    build(_currentSort);
  }


  // ════════════════════════════════════════════════════
  //  R6: 퀵 필터 칩 DOM 생성
  // ════════════════════════════════════════════════════

  function _ensureFilterChips() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('sb-filter-chips')) return;

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'sb-filter-chips';
    chipsWrap.id = 'sb-filter-chips';
    chipsWrap.innerHTML =
      '<button class="sb-chip active" data-filter="all">전체</button>' +
      '<button class="sb-chip" data-filter="up">\u25B2상승</button>' +
      '<button class="sb-chip" data-filter="down">\u25BC하락</button>' +
      '<button class="sb-chip" data-filter="highvol">대량거래</button>';

    // sb-sort-bar 다음에 삽입
    const sortBar = sidebar.querySelector('.sb-sort-bar');
    if (sortBar && sortBar.nextSibling) {
      sortBar.parentNode.insertBefore(chipsWrap, sortBar.nextSibling);
    } else if (sortBar) {
      sortBar.parentNode.appendChild(chipsWrap);
    } else {
      sidebar.insertBefore(chipsWrap, sidebar.firstChild);
    }

    // 이벤트 위임
    chipsWrap.addEventListener('click', function (e) {
      const btn = e.target.closest('.sb-chip');
      if (!btn) return;
      _activeFilter = btn.dataset.filter || 'all';
      chipsWrap.querySelectorAll('.sb-chip').forEach(function (c) {
        c.classList.toggle('active', c === btn);
      });
      build(_currentSort);
    });
  }


  // ════════════════════════════════════════════════════
  //  R5: 보기 모드 토글 버튼
  // ════════════════════════════════════════════════════

  function _ensureViewToggle() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('sb-view-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'sb-view-toggle';
    btn.className = 'sb-view-toggle';
    btn.title = _viewMode === 'compact' ? '상세 보기' : '간략 보기';
    btn.textContent = _viewMode === 'compact' ? '\u2630' : '\u2637';

    // 필터 칩 옆에 삽입
    const chips = document.getElementById('sb-filter-chips');
    if (chips) {
      chips.parentNode.insertBefore(btn, chips.nextSibling);
    } else {
      const sortBar = sidebar.querySelector('.sb-sort-bar');
      if (sortBar && sortBar.nextSibling) {
        sortBar.parentNode.insertBefore(btn, sortBar.nextSibling);
      }
    }

    btn.addEventListener('click', function () {
      setViewMode(_viewMode === 'compact' ? 'detailed' : 'compact');
    });
  }


  // ════════════════════════════════════════════════════
  //  R8: 패턴 감지 종목만 토글
  // ════════════════════════════════════════════════════

  function _ensurePatternOnlyToggle() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('sb-pattern-only-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'sb-pattern-only-wrap';
    wrap.className = 'sb-pattern-only-wrap';
    wrap.style.display = _currentSort === 'pattern' ? '' : 'none';
    wrap.innerHTML =
      '<label class="sb-pattern-only-label">' +
        '<input type="checkbox" id="sb-pattern-only-cb">' +
        '<span>패턴 감지 종목만</span>' +
      '</label>';

    // 보기 모드 토글 다음에 삽입
    const viewToggle = document.getElementById('sb-view-toggle');
    if (viewToggle && viewToggle.nextSibling) {
      viewToggle.parentNode.insertBefore(wrap, viewToggle.nextSibling);
    } else {
      const chips = document.getElementById('sb-filter-chips');
      if (chips && chips.nextSibling) {
        chips.parentNode.insertBefore(wrap, chips.nextSibling);
      }
    }

    const cb = document.getElementById('sb-pattern-only-cb');
    if (cb) {
      cb.addEventListener('change', function () {
        _patternOnlyFilter = cb.checked;
        build(_currentSort);
      });
    }
  }


  // ════════════════════════════════════════════════════
  //  R9: 스파크라인 그리기
  // ════════════════════════════════════════════════════

  function _drawSparkline(canvas, closes) {
    if (!canvas || !closes || closes.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] < min) min = closes[i];
      if (closes[i] > max) max = closes[i];
    }
    let range = max - min;
    if (range === 0) range = 1;

    // 선 색상: 마지막 > 처음 → 빨강, 아니면 파랑
    const isUp = closes[closes.length - 1] > closes[0];
    ctx.strokeStyle = isUp ? '#E05050' : '#5086DC';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let j = 0; j < closes.length; j++) {
      const x = (j / (closes.length - 1)) * w;
      const y = h - ((closes[j] - min) / range) * (h - 2) - 1;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /** 보이는 아이템의 스파크라인 일괄 그리기 (rAF) */
  function _drawVisibleSparklines(container) {
    if (_viewMode === 'compact') return;
    const canvases = container.querySelectorAll('.sb-sparkline');
    if (!canvases.length) return;

    requestAnimationFrame(function () {
      canvases.forEach(function (cvs) {
        const code = cvs.dataset.code;
        if (!code) return;
        const closes = _getLast20Closes(code);
        if (closes) _drawSparkline(cvs, closes);
      });
    });
  }


  // ════════════════════════════════════════════════════
  //  R11: 드래그 앤 드롭
  // ════════════════════════════════════════════════════

  let _dragSrcEl = null;

  function _initDragDrop(container) {
    container.addEventListener('dragstart', function (e) {
      const item = e.target.closest('.sb-item');
      if (!item) return;
      _dragSrcEl = item;
      item.classList.add('sb-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.code);
    });

    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.sb-item');
      if (target && target !== _dragSrcEl) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        container.querySelectorAll('.sb-item').forEach(function (el) {
          el.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
        });
        if (e.clientY < midY) {
          target.classList.add('sb-drag-over-top');
        } else {
          target.classList.add('sb-drag-over-bottom');
        }
      }
    });

    container.addEventListener('dragleave', function (e) {
      const item = e.target.closest('.sb-item');
      if (item) {
        item.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
      }
    });

    container.addEventListener('drop', function (e) {
      e.preventDefault();
      const target = e.target.closest('.sb-item');
      container.querySelectorAll('.sb-item').forEach(function (el) {
        el.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
      });

      if (!target || !_dragSrcEl || target === _dragSrcEl) return;

      // DOM 재정렬
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        target.parentNode.insertBefore(_dragSrcEl, target);
      } else {
        target.parentNode.insertBefore(_dragSrcEl, target.nextSibling);
      }

      // 새 순서 저장
      _saveCustomOrder(container);
    });

    container.addEventListener('dragend', function () {
      if (_dragSrcEl) {
        _dragSrcEl.classList.remove('sb-dragging');
        _dragSrcEl = null;
      }
      container.querySelectorAll('.sb-item').forEach(function (el) {
        el.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
      });
    });
  }

  function _saveCustomOrder(container) {
    const items = container.querySelectorAll('.sb-item[data-code]');
    const order = [];
    items.forEach(function (el) { order.push(el.dataset.code); });
    if (!_customOrder) _customOrder = {};
    _customOrder[container.id] = order;
    try {
      localStorage.setItem(LS_ORDER, JSON.stringify(_customOrder));
    } catch (e) { /* ignore */ }
  }

  function _loadCustomOrder() {
    try {
      const raw = localStorage.getItem(LS_ORDER);
      _customOrder = raw ? JSON.parse(raw) : null;
    } catch (e) {
      _customOrder = null;
    }
  }


  // ════════════════════════════════════════════════════
  //  R1: 키보드 네비게이션
  // ════════════════════════════════════════════════════

  function _initKeyboardNav() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.setAttribute('tabindex', '0');

    sidebar.addEventListener('keydown', function (e) {
      // 검색 입력 중에는 키보드 네비게이션 비활성
      if (document.activeElement && document.activeElement.id === 'sb-search-input') return;

      const items = sidebar.querySelectorAll('.sb-item[data-code]');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _kbFocusIndex = Math.min(_kbFocusIndex + 1, items.length - 1);
        _applyKbFocus(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _kbFocusIndex = Math.max(_kbFocusIndex - 1, 0);
        _applyKbFocus(items);
      } else if (e.key === 'Enter' && _kbFocusIndex >= 0 && _kbFocusIndex < items.length) {
        e.preventDefault();
        const code = items[_kbFocusIndex].dataset.code;
        if (code && typeof selectStock === 'function') {
          selectStock(code);
        }
      }
    });
  }

  function _applyKbFocus(items) {
    items.forEach(function (el, idx) {
      el.classList.toggle('kb-focus', idx === _kbFocusIndex);
    });
    if (_kbFocusIndex >= 0 && _kbFocusIndex < items.length) {
      items[_kbFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }


  // ════════════════════════════════════════════════════
  //  아이템 렌더링
  // ════════════════════════════════════════════════════

  /**
   * 종목 아이템 HTML 생성 (한 개)
   * R3:  코드는 title 속성, 거래량 컬럼 추가
   * R7:  패턴 모드에서 패턴명 표시
   * R9:  스파크라인 canvas
   * R10: RSI 값
   * R11: draggable 속성
   */
  function _renderItemHTML(s, isPatternMode) {
    const cdls = _getCachedCandles(s.code);
    let price = s.base || 0;
    let changeText = '\u2014';
    let changeClass = '';
    let volume = 0;

    if (cdls && cdls.length) {
      const last = cdls[cdls.length - 1];
      price = last.close;
      volume = last.volume || 0;
      const prevCandle = cdls.length >= 2 ? cdls[cdls.length - 2] : null;
      const prevClose = prevCandle ? prevCandle.close : last.open;
      if (prevClose > 0) {
        const pct = ((last.close - prevClose) / prevClose * 100).toFixed(2);
        const arrow = pct > 0 ? '\u25B2 ' : pct < 0 ? '\u25BC ' : '';
        changeText = arrow + (pct >= 0 ? '+' : '') + pct + '%';
        changeClass = pct >= 0 ? 'up' : 'dn';
      }
    }

    // ── Compact 모드 (R5) ──
    if (_viewMode === 'compact') {
      return '<div class="sb-item compact" data-code="' + s.code + '" draggable="true">' +
        '<span class="sb-name" title="' + s.code + '">' + s.name + '</span>' +
        '<span class="sb-change ' + changeClass + '" id="sb-chg-' + s.code + '">' + changeText + '</span>' +
      '</div>';
    }

    // ── Detailed 모드 ──

    // R10: RSI 값
    const rsiVal = _getRSI(s.code);
    let rsiHtml = '';
    if (rsiVal != null) {
      rsiHtml = '<span class="sb-rsi" style="color:' + _rsiColor(rsiVal) + '">' + rsiVal + '</span>';
    }

    // R7: 패턴명 표시 (패턴 모드에서만)
    let patternRow = '';
    if (isPatternMode) {
      const cached = _stockPatternCache[s.code];
      if (cached && cached.names && cached.names.length > 0) {
        let displayNames = cached.names.slice(0, 2).join(', ');
        if (cached.names.length > 2) {
          displayNames += ' +' + (cached.names.length - 2);
        }
        patternRow = '<div class="sb-row3 sb-pattern-names">' + displayNames + '</div>';
      }
    }

    // 패턴 카테고리 pill (기존 호환)
    const pillsHtml = isPatternMode ? _renderCategoryPills(s.code) : '';

    return '<div class="sb-item' + (isPatternMode && pillsHtml ? ' has-pattern' : '') + '" data-code="' + s.code + '" draggable="true">' +
      '<div class="sb-row1">' +
        '<span class="sb-name" title="' + s.code + '">' + s.name + pillsHtml + '</span>' +
        '<span class="sb-price" id="sb-' + s.code + '">' + (price ? price.toLocaleString() : '\u2014') + '</span>' +
      '</div>' +
      '<div class="sb-row2">' +
        '<canvas class="sb-sparkline" data-code="' + s.code + '" width="48" height="16"></canvas>' +
        '<span class="sb-volume">' + _formatVolume(volume) + '</span>' +
        rsiHtml +
        '<span class="sb-change ' + changeClass + '" id="sb-chg-' + s.code + '">' + changeText + '</span>' +
      '</div>' +
      patternRow +
    '</div>';
  }

  /** 패턴 카테고리 pill HTML 생성 (기존 호환) */
  function _renderCategoryPills(code) {
    const cached = _stockPatternCache[code];
    if (!cached || cached.total === 0) return '';
    const pills = [];
    if (cached.candle > 0) {
      pills.push('<span class="sb-cat-pill candle" title="\uCE94\uB4E4\uD328\uD134">\uD83D\uDD6F' + cached.candle + '</span>');
    }
    if (cached.indicator > 0) {
      pills.push('<span class="sb-cat-pill indicator" title="MA/\uC9C0\uD45C">\uD83D\uDCCA' + cached.indicator + '</span>');
    }
    if (cached.volume > 0) {
      pills.push('<span class="sb-cat-pill volume" title="\uAC70\uB798\uB7C9">\uD83D\uDCC8' + cached.volume + '</span>');
    }
    if (pills.length === 0) return '';
    return '<span class="sb-cat-pills">' + pills.join('') + '</span>';
  }

  /**
   * 아이템 배열을 컨테이너에 렌더링 (이벤트 위임 사용)
   */
  function _renderItems(container, stocks, showLoadMore, remaining, containerId) {
    const isPatternMode = _currentSort === 'pattern';
    let html = '';
    for (let i = 0; i < stocks.length; i++) {
      html += _renderItemHTML(stocks[i], isPatternMode);
    }

    // "N개 더보기" 버튼
    if (showLoadMore && remaining > 0 && containerId) {
      html += '<button class="sb-load-more" data-container="' + containerId + '">' +
        remaining + '개 더보기</button>';
    }

    container.innerHTML = html;

    // R9: 스파크라인 일괄 그리기
    _drawVisibleSparklines(container);
  }


  // ════════════════════════════════════════════════════
  //  섹션 렌더링
  // ════════════════════════════════════════════════════

  function _renderSection(containerId, stocks) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const showAll = _showAllStocks[containerId];
    const displayStocks = showAll ? stocks : stocks.slice(0, INITIAL_DISPLAY_COUNT);
    const remaining = stocks.length - INITIAL_DISPLAY_COUNT;

    _renderItems(el, displayStocks, !showAll, remaining, containerId);
  }


  // ════════════════════════════════════════════════════
  //  시장 지수 갱신
  // ════════════════════════════════════════════════════

  function _updateMarketIndex() {
    const kospiTicker = document.getElementById('t-kospi');
    const kosdaqTicker = document.getElementById('t-kosdaq');
    const kospiVal = document.getElementById('sb-kospi-val');
    const kosdaqVal = document.getElementById('sb-kosdaq-val');
    if (kospiTicker && kospiVal) kospiVal.textContent = kospiTicker.textContent;
    if (kosdaqTicker && kosdaqVal) kosdaqVal.textContent = kosdaqTicker.textContent;
  }


  // ════════════════════════════════════════════════════
  //  이벤트 위임 설정 (전체 사이드바)
  // ════════════════════════════════════════════════════

  function _setupEventDelegation() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // 종목 클릭 + 더보기 버튼 (이벤트 위임)
    sidebar.addEventListener('click', function (e) {
      // 더보기 버튼
      const loadMoreBtn = e.target.closest('.sb-load-more');
      if (loadMoreBtn) {
        const cid = loadMoreBtn.dataset.container;
        if (cid) {
          _showAllStocks[cid] = true;
          build(_currentSort);
        }
        return;
      }

      // 종목 아이템 클릭 (sb-header 내부는 제외 — 아코디언 토글)
      if (e.target.closest('.sb-header')) return;
      // 필터/정렬/토글 버튼은 제외
      if (e.target.closest('.sb-sort-btn') || e.target.closest('.sb-chip') ||
          e.target.closest('.sb-view-toggle') || e.target.closest('.sb-pattern-only-wrap')) return;

      const item = e.target.closest('.sb-item[data-code]');
      if (item) {
        const code = item.dataset.code;
        if (code && typeof selectStock === 'function') {
          selectStock(code);
        }
      }
    });

    // R11: 드래그 앤 드롭 (각 sb-body에)
    sidebar.querySelectorAll('.sb-body').forEach(function (body) {
      _initDragDrop(body);
    });
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: init
  // ════════════════════════════════════════════════════

  function init() {
    // localStorage에서 상태 복원
    const saved = localStorage.getItem(LS_KEY);
    _open = saved !== 'false';
    if (!_open) document.getElementById('main').classList.add('sidebar-collapsed');

    // R5: 보기 모드 복원
    const savedView = localStorage.getItem(LS_VIEW);
    if (savedView === 'compact' || savedView === 'detailed') {
      _viewMode = savedView;
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.add(_viewMode === 'compact' ? 'sb-compact' : 'sb-detailed');
    }

    // R2: 최근 본 종목 로드
    _loadRecent();

    // R11: 커스텀 순서 로드
    _loadCustomOrder();

    // 토글 버튼
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggle);

    // 아코디언 헤더 클릭
    document.querySelectorAll('.sb-header').forEach(function (h) {
      h.addEventListener('click', function () { h.classList.toggle('collapsed'); });
    });

    // ── 검색 이벤트 ──
    const searchInput = document.getElementById('sb-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        _searchQuery = e.target.value.trim().toLowerCase();
        build(_currentSort);
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        const first = document.querySelector('#sb-kospi .sb-item[data-code], #sb-kosdaq .sb-item[data-code]');
        if (first && typeof selectStock === 'function') {
          selectStock(first.dataset.code);
          searchInput.value = '';
          _searchQuery = '';
          build(_currentSort);
        }
      });
    }

    // ── 세그먼트 컨트롤 정렬 버튼 이벤트 ──
    const sortTrack = document.querySelector('.sb-sort-track');
    if (sortTrack) sortTrack.setAttribute('data-active', '0');

    document.querySelectorAll('.sb-sort-btn').forEach(function (btn) {
      // R4: 초기 방향 표시
      if (btn.classList.contains('active')) {
        btn.setAttribute('data-dir', _sortDirection);
      }

      btn.addEventListener('click', function () {
        const sortBy = btn.dataset.sort;
        const btnIdx = btn.dataset.idx || '0';

        // 패턴 버튼 반복 클릭 → 서브필터 순환
        if (sortBy === 'pattern' && _currentSort === 'pattern') {
          _patternSubIdx = (_patternSubIdx + 1) % _patternSubFilters.length;
          btn.textContent = _patternSubLabels[_patternSubFilters[_patternSubIdx]];
          build('pattern');
          return;
        }

        // 다른 정렬에서 패턴으로 전환 시 서브필터 초기화
        if (sortBy === 'pattern' && _currentSort !== 'pattern') {
          _patternSubIdx = 0;
          btn.textContent = _patternSubLabels.all;
        }

        // 패턴이 아닌 다른 정렬로 전환 시 패턴 버튼 라벨 복원
        if (sortBy !== 'pattern') {
          const patternBtn = document.querySelector('.sb-sort-btn[data-sort="pattern"]');
          if (patternBtn) {
            patternBtn.textContent = _patternSubLabels.all;
            _patternSubIdx = 0;
          }
        }

        // R4: 같은 정렬 버튼 재클릭 → 방향 토글
        if (sortBy === _currentSort) {
          _sortDirection = _sortDirection === 'desc' ? 'asc' : 'desc';
          btn.setAttribute('data-dir', _sortDirection);
          build(sortBy);
          return;
        }

        // 정렬 기준 변경
        _currentSort = sortBy;
        _sortDirection = 'desc';

        document.querySelectorAll('.sb-sort-btn').forEach(function (b) {
          b.classList.remove('active');
          b.removeAttribute('data-dir');
        });
        btn.classList.add('active');
        btn.setAttribute('data-dir', _sortDirection);

        if (sortTrack) sortTrack.setAttribute('data-active', btnIdx);

        // R8: 패턴 전용 필터 토글 표시/숨김
        const patternOnlyWrap = document.getElementById('sb-pattern-only-wrap');
        if (patternOnlyWrap) {
          patternOnlyWrap.style.display = sortBy === 'pattern' ? '' : 'none';
          if (sortBy !== 'pattern') {
            _patternOnlyFilter = false;
            const cb = document.getElementById('sb-pattern-only-cb');
            if (cb) cb.checked = false;
          }
        }

        build(sortBy);
      });
    });

    // ── 동적 DOM 요소 생성 ──
    _ensureFilterChips();       // R6
    _ensureViewToggle();        // R5
    _ensurePatternOnlyToggle(); // R8
    _ensureRecentSection();     // R2

    // ── 이벤트 위임 + 드래그 앤 드롭 ──
    _setupEventDelegation();

    // R1: 키보드 네비게이션
    _initKeyboardNav();

    // 시장 지수 값 표시
    _updateMarketIndex();

    // 최근 본 종목 렌더링
    _renderRecentSection();

    // R11: 새로 생성된 최근 본 종목 섹션에도 드래그 앤 드롭 설정
    const recentBody = document.getElementById('sb-recent');
    if (recentBody) _initDragDrop(recentBody);

    // 종목 목록 빌드
    build('mcap');
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: toggle
  // ════════════════════════════════════════════════════

  function toggle() {
    _open = !_open;
    document.getElementById('main').classList.toggle('sidebar-collapsed', !_open);
    localStorage.setItem(LS_KEY, _open);
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: build
  // ════════════════════════════════════════════════════

  function build(sortBy) {
    sortBy = sortBy || _currentSort || 'mcap';
    _currentSort = sortBy;

    // 검색 중이면 ALL_STOCKS 전체 검색, 아니면 DEFAULT_STOCKS만
    let source = _searchQuery
      ? _filterBySearch(typeof ALL_STOCKS !== 'undefined' ? ALL_STOCKS : []).slice(0, 50)
      : (typeof DEFAULT_STOCKS !== 'undefined' ? DEFAULT_STOCKS : []);

    // R6: 퀵 필터 적용
    source = _filterByChip(source);

    // R8: 패턴 감지 종목만 필터
    if (_currentSort === 'pattern') {
      source = _filterByPatternOnly(source);
    }

    const filteredKospi = source.filter(function (s) { return s.market === 'KOSPI'; });
    const filteredKosdaq = source.filter(function (s) { return s.market === 'KOSDAQ'; });

    const kospi = _sortStocks(filteredKospi, sortBy);
    const kosdaq = _sortStocks(filteredKosdaq, sortBy);

    _renderSection('sb-kospi', kospi);
    _renderSection('sb-kosdaq', kosdaq);

    const kospiCount = document.getElementById('sb-kospi-count');
    const kosdaqCount = document.getElementById('sb-kosdaq-count');
    if (kospiCount) kospiCount.textContent = kospi.length;
    if (kosdaqCount) kosdaqCount.textContent = kosdaq.length;

    // 시장 지수 값 갱신
    _updateMarketIndex();

    // R2: 최근 본 종목 섹션 갱신
    _renderRecentSection();

    // 현재 활성 종목 복원
    if (typeof currentStock !== 'undefined' && currentStock) {
      setActive(currentStock.code);
    }

    // R1: 키보드 포커스 리셋
    _kbFocusIndex = -1;
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: setActive / scrollToActive
  // ════════════════════════════════════════════════════

  function setActive(code) {
    document.querySelectorAll('.sb-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.code === code);
    });
    scrollToActive(code);
  }

  function scrollToActive(code) {
    const activeEl = document.querySelector('.sb-item[data-code="' + code + '"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: updatePrices
  // ════════════════════════════════════════════════════

  function updatePrices() {
    _updateMarketIndex();

    const stocks = typeof DEFAULT_STOCKS !== 'undefined' ? DEFAULT_STOCKS : [];
    for (let si = 0; si < stocks.length; si++) {
      const s = stocks[si];
      const priceEl = document.getElementById('sb-' + s.code);
      if (!priceEl) continue;

      const cdls = _getCachedCandles(s.code);
      if (!cdls || !cdls.length) continue;

      const last = cdls[cdls.length - 1];
      const newPrice = last.close;
      priceEl.textContent = newPrice.toLocaleString();
      priceEl.className = 'sb-price';

      // 등락률
      const prevCandle = cdls.length >= 2 ? cdls[cdls.length - 2] : null;
      const prevClose = prevCandle ? prevCandle.close : last.open;
      const changeEl = document.getElementById('sb-chg-' + s.code);
      if (changeEl && prevClose > 0) {
        const changePct = ((last.close - prevClose) / prevClose * 100).toFixed(2);
        const arrow = changePct > 0 ? '\u25B2 ' : changePct < 0 ? '\u25BC ' : '';
        changeEl.textContent = arrow + (changePct >= 0 ? '+' : '') + changePct + '%';
        changeEl.className = 'sb-change ' + (changePct >= 0 ? 'up' : 'dn');
        _stockChangeCache[s.code] = parseFloat(changePct);
      }

      // R3: 거래량 갱신
      const itemEl = priceEl.closest('.sb-item');
      if (itemEl) {
        const volSpan = itemEl.querySelector('.sb-volume');
        if (volSpan) volSpan.textContent = _formatVolume(last.volume || 0);
      }

      // 가격 flash 효과
      const prev = _prevPrices[s.code];
      if (prev !== undefined && prev !== newPrice) {
        const flashCls = newPrice > prev ? 'price-flash-up' : 'price-flash-down';
        priceEl.classList.add(flashCls);
        priceEl.addEventListener('animationend', function () {
          this.classList.remove('price-flash-up', 'price-flash-down');
        }, { once: true });
      }
      _prevPrices[s.code] = newPrice;
    }

    // R9: 스파크라인 일괄 갱신
    const sbKospi = document.getElementById('sb-kospi');
    const sbKosdaq = document.getElementById('sb-kosdaq');
    const sbRecent = document.getElementById('sb-recent');
    if (sbKospi) _drawVisibleSparklines(sbKospi);
    if (sbKosdaq) _drawVisibleSparklines(sbKosdaq);
    if (sbRecent) _drawVisibleSparklines(sbRecent);
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: setPatternCount (하위 호환 유지)
  // ════════════════════════════════════════════════════

  /**
   * 패턴 감지 결과 업데이트
   * @param {string} code — 종목 코드
   * @param {number|Object} categorized — 숫자 또는 { candle, indicator, volume, names? }
   * @param {Array<string>} [names] — 감지된 패턴명 배열 (R7, 선택 인자)
   */
  function setPatternCount(code, categorized, names) {
    if (typeof categorized === 'number') {
      _stockPatternCache[code] = {
        candle: categorized, indicator: 0, volume: 0,
        total: categorized,
        names: names || [],
      };
    } else {
      const c = categorized.candle || 0;
      const ind = categorized.indicator || 0;
      const v = categorized.volume || 0;
      _stockPatternCache[code] = {
        candle: c, indicator: ind, volume: v,
        total: c + ind + v,
        names: names || categorized.names || [],
      };
    }
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════

  return {
    init: init,
    build: build,
    toggle: toggle,
    setActive: setActive,
    scrollToActive: scrollToActive,
    updatePrices: updatePrices,
    setPatternCount: setPatternCount,
    setRecentStock: setRecentStock,
    getRecentStocks: getRecentStocks,
    setViewMode: setViewMode,
    MARKET_CAP: MARKET_CAP,
  };
})();
