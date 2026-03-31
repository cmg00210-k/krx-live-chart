// ══════════════════════════════════════════════════════
//  KRX LIVE — 사이드바 매니저 v12.0
//  16개 기능:
//    R1:  키보드 ↑↓ 네비게이션
//    R2:  최근 본 종목 섹션
//    R3:  코드→tooltip, 거래량 컬럼
//    R4:  정렬 드롭다운 (시총/등락률/패턴/이름)
//    R5:  3단계 보기 모드 (미니멀/기본/분석)
//    R6:  업종 필터 (16그룹 매핑)
//    R7:  패턴명 표시
//    R8:  패턴 감지 종목만 필터
//    R9:  미니 스파크라인 (모든 뷰 모드, IntersectionObserver 지연 로드)
//    R10: RSI 지표 값
//    R11: 드래그 앤 드롭 재정렬
//    R12: IntersectionObserver 스파크라인 뷰포트 최적화
//    R13: 가상 스크롤 (2700+ 종목, DOM ~40개 유지)
//    S3:  시가총액 값 표시 (row2)
//    S6:  패턴명 row3 → 호버 툴팁
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
  let _viewMode = 'default';          // R5: 'default' | 'analysis'
  let _patternOnlyFilter = false;    // R8: 패턴 감지 종목만
  let _kbFocusIndex = -1;            // R1: 키보드 포커스 인덱스
  let _recentStocks = [];            // R2: 최근 본 종목 코드 배열
  let _customOrder = null;           // R11: 사용자 정의 정렬 순서
  let _activeSectorFilter = '';      // 업종 필터 (sector 문자열, 빈 문자열=전체)
  const LS_SECTOR = 'krx_sector_filter';

  const MAX_RECENT = 5;

  const _prevPrices = {};
  const _stockChangeCache = {};
  const _stockPatternCache = {};     // code → { candle, indicator, volume, total, names }
  const _rsiCache = {};              // code → { rsi: number, ts: number } (60s TTL)
  var _allStocksMap = null;           // Map(code → stock) for O(1) lookup, built lazily

  // ── R13: 가상 스크롤 상태 ──
  var VIRTUAL_ITEM_HEIGHT = 42;      // 기본 모드 아이템 높이 (px), 모드별 자동 조정
  var VIRTUAL_BUFFER = 5;            // 뷰포트 위아래 여분 렌더링 수
  var _vsState = null;               // { spacer, content, scrollParent, startIdx, endIdx }
  var _vsRafPending = false;         // requestAnimationFrame 중복 방지
  let _filteredStocks = [];          // 현재 필터/정렬 적용된 전체 종목 배열

  // ── R5: 3모드 순환 순서 ──
  const _viewModes = ['default', 'analysis', 'screener'];
  const _viewModeLabels = { 'default': '기본', analysis: '상세', screener: '스크린' };

  // ── 시가총액 데이터 (억원 단위, index.json에서 동적 빌드) ──
  // init() 호출 시 _buildMarketCapFromStocks()로 ALL_STOCKS에서 자동 채움.
  // download_ohlcv.py가 index.json에 marketCap 필드를 포함하면 실제 시총 사용.
  const MARKET_CAP = {};

  /**
   * ALL_STOCKS에서 MARKET_CAP 자동 빌드.
   * marketCap 필드(억원)가 있으면 우선 사용, 없으면 base(lastClose)를 대용.
   */
  function _buildMarketCapFromStocks() {
    if (typeof ALL_STOCKS === 'undefined') return;
    // 기존 값 초기화
    Object.keys(MARKET_CAP).forEach(function(k) { delete MARKET_CAP[k]; });
    ALL_STOCKS.forEach(function(s) {
      if (s.marketCap && s.marketCap > 0) {
        MARKET_CAP[s.code] = s.marketCap;
      } else if (s.base && s.base > 0) {
        // base(lastClose)를 대략적 시총 대용으로 사용 (정렬 순서 유지용)
        MARKET_CAP[s.code] = s.base;
      }
    });
  }


  // ════════════════════════════════════════════════════
  //  R6: 업종 → 16개 투자자 친화 그룹 매핑
  // ════════════════════════════════════════════════════

  var SECTOR_MAP = {
    // 1. 반도체
    '반도체 제조업': '반도체',
    // 2. 전자/IT부품
    '전자부품 제조업': '전자/IT부품', '통신 및 방송 장비 제조업': '전자/IT부품',
    '영상 및 음향기기 제조업': '전자/IT부품', '컴퓨터 및 주변장치 제조업': '전자/IT부품',
    '절연선 및 케이블 제조업': '전자/IT부품', '가정용 기기 제조업': '전자/IT부품',
    '전구 및 조명장치 제조업': '전자/IT부품', '기타 전기장비 제조업': '전자/IT부품',
    '마그네틱 및 광학 매체 제조업': '전자/IT부품',
    '전동기, 발전기 및 전기 변환 · 공급 · 제어 장치 제조업': '전자/IT부품',
    // 3. 자동차/운송
    '자동차용 엔진 및 자동차 제조업': '자동차/운송', '자동차 신품 부품 제조업': '자동차/운송',
    '자동차 차체 및 트레일러 제조업': '자동차/운송',
    '선박 및 보트 건조업': '자동차/운송', '항공기,우주선 및 부품 제조업': '자동차/운송',
    '철도장비 제조업': '자동차/운송', '그외 기타 운송장비 제조업': '자동차/운송',
    // 4. 바이오/제약
    '의약품 제조업': '바이오/제약', '기초 의약물질 제조업': '바이오/제약',
    '의료용 기기 제조업': '바이오/제약',
    '의료용품 및 기타 의약 관련제품 제조업': '바이오/제약',
    '자연과학 및 공학 연구개발업': '바이오/제약',
    // 5. 금융
    '기타 금융업': '금융', '금융 지원 서비스업': '금융', '은행 및 저축기관': '금융',
    '보험업': '금융', '보험 및 연금관련 서비스업': '금융', '재 보험업': '금융',
    '신탁업 및 집합투자업': '금융',
    // 6. 에너지/전력
    '일차전지 및 이차전지 제조업': '에너지/전력', '전기업': '에너지/전력',
    '연료용 가스 제조 및 배관공급업': '에너지/전력',
    '증기, 냉·온수 및 공기조절 공급업': '에너지/전력',
    '석유 정제품 제조업': '에너지/전력',
    // 7. 화학/소재
    '기초 화학물질 제조업': '화학/소재', '기타 화학제품 제조업': '화학/소재',
    '합성고무 및 플라스틱 물질 제조업': '화학/소재', '화학섬유 제조업': '화학/소재',
    '비료, 농약 및 살균, 살충제 제조업': '화학/소재',
    '플라스틱제품 제조업': '화학/소재', '고무제품 제조업': '화학/소재',
    // 8. 소프트웨어/IT
    '소프트웨어 개발 및 공급업': '소프트웨어/IT',
    '컴퓨터 프로그래밍, 시스템 통합 및 관리업': '소프트웨어/IT',
    '자료처리, 호스팅, 포털 및 기타 인터넷 정보매개 서비스업': '소프트웨어/IT',
    '기타 정보 서비스업': '소프트웨어/IT',
    // 9. 기계/장비
    '일반 목적용 기계 제조업': '기계/장비', '특수 목적용 기계 제조업': '기계/장비',
    '측정, 시험, 항해, 제어 및 기타 정밀기기 제조업': '기계/장비',
    '무기 및 총포탄 제조업': '기계/장비',
    // 10. 철강/금속
    '1차 철강 제조업': '철강/금속', '1차 비철금속 제조업': '철강/금속',
    '기타 금속 가공제품 제조업': '철강/금속',
    '구조용 금속제품, 탱크 및 증기발생기 제조업': '철강/금속',
    '금속 주조업': '철강/금속',
    // 11. 건설/부동산
    '건물 건설업': '건설/부동산', '토목 건설업': '건설/부동산',
    '건축기술, 엔지니어링 및 관련 기술 서비스업': '건설/부동산',
    '건물설비 설치 공사업': '건설/부동산', '전기 및 통신 공사업': '건설/부동산',
    '기반조성 및 시설물 축조관련 전문공사업': '건설/부동산',
    '부동산 임대 및 공급업': '건설/부동산',
    // 12. 유통/소비재
    '종합 소매업': '유통/소비재', '기타 전문 도매업': '유통/소비재',
    '상품 종합 도매업': '유통/소비재', '상품 중개업': '유통/소비재',
    '기타 상품 전문 소매업': '유통/소비재', '무점포 소매업': '유통/소비재',
    '생활용품 도매업': '유통/소비재', '음·식료품 및 담배 도매업': '유통/소비재',
    '연료 소매업': '유통/소비재', '자동차 판매업': '유통/소비재',
    '기계장비 및 관련 물품 도매업': '유통/소비재',
    '섬유, 의복, 신발 및 가죽제품 소매업': '유통/소비재',
    '가전제품 및 정보통신장비 소매업': '유통/소비재',
    '산업용 농축산물 및 동·식물 도매업': '유통/소비재',
    '건축자재, 철물 및 난방장치 도매업': '유통/소비재',
    // 13. 음식료/생활
    '기타 식품 제조업': '음식료/생활', '곡물가공품, 전분 및 전분제품 제조업': '음식료/생활',
    '알코올음료 제조업': '음식료/생활', '비알코올음료 및 얼음 제조업': '음식료/생활',
    '도축, 육류 가공 및 저장 처리업': '음식료/생활',
    '수산물 가공 및 저장 처리업': '음식료/생활',
    '동·식물성 유지 및 낙농제품 제조업': '음식료/생활',
    '동물용 사료 및 조제식품 제조업': '음식료/생활',
    '담배 제조업': '음식료/생활', '봉제의복 제조업': '음식료/생활',
    '가구 제조업': '음식료/생활', '가죽, 가방 및 유사제품 제조업': '음식료/생활',
    '신발 및 신발 부분품 제조업': '음식료/생활',
    '과실, 채소 가공 및 저장 처리업': '음식료/생활',
    // 14. 미디어/콘텐츠
    '영화, 비디오물, 방송프로그램 제작 및 배급업': '미디어/콘텐츠',
    '텔레비전 방송업': '미디어/콘텐츠', '광고업': '미디어/콘텐츠',
    '전기 통신업': '미디어/콘텐츠',
    '오디오물 출판 및 원판 녹음업': '미디어/콘텐츠',
    '서적, 잡지 및 기타 인쇄물 출판업': '미디어/콘텐츠',
    '유원지 및 기타 오락관련 서비스업': '미디어/콘텐츠',
    '창작 및 예술관련 서비스업': '미디어/콘텐츠',
    // 15. 운송/물류
    '해상 운송업': '운송/물류', '항공 여객 운송업': '운송/물류',
    '도로 화물 운송업': '운송/물류', '육상 여객 운송업': '운송/물류',
    '기타 운송관련 서비스업': '운송/물류',
    '여행사 및 기타 여행보조 서비스업': '운송/물류',
    '운송장비 임대업': '운송/물류',
  };

  var SECTOR_ORDER = [
    '반도체', '전자/IT부품', '자동차/운송', '바이오/제약',
    '금융', '에너지/전력', '화학/소재', '소프트웨어/IT',
    '기계/장비', '철강/금속', '건설/부동산', '유통/소비재',
    '음식료/생활', '미디어/콘텐츠', '운송/물류', '기타'
  ];

  function _getSectorGroup(stock) {
    var ind = stock.industry || stock.sector || '';
    return SECTOR_MAP[ind] || '기타';
  }


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

  /** R3: 거래량 포맷팅 — 정확한 단위 (억/만/원본) */
  function _formatVolume(vol) {
    if (vol == null || vol === 0) return '-';
    if (vol >= 100000000) {
      return Math.round(vol / 100000000).toLocaleString() + '억';
    }
    if (vol >= 1000000) {
      return Math.round(vol / 10000).toLocaleString() + '만';
    }
    return vol.toLocaleString();
  }

  /** 등락률 가져오기 (캐시 우선 → 캔들 → index.json 요약) */
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
    // [OPT] index.json 요약 폴백 — 정렬 시 즉시 등락률 사용
    if (_allStocksMap) {
      var stock = _allStocksMap.get(code);
      if (stock && stock.changePercent) return stock.changePercent;
    } else if (typeof ALL_STOCKS !== 'undefined') {
      var stock = ALL_STOCKS.find(function(s) { return s.code === code; });
      if (stock && stock.changePercent) return stock.changePercent;
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

  /** R10: RSI(14) 값 계산 (캐시된 데이터에서만, 60s TTL 캐시) */
  function _getRSI(code) {
    if (typeof calcRSI !== 'function') return null;
    // 캐시 확인 (60초 TTL)
    var cached = _rsiCache[code];
    if (cached && (Date.now() - cached.ts) < 60000) return cached.rsi;
    const candles = _getCachedCandles(code);
    if (!candles || candles.length < 16) return null;
    const closes = candles.map(function (c) { return c.close; });
    const rsi = calcRSI(closes, 14);
    const last = rsi[rsi.length - 1];
    var val = (last != null && !isNaN(last)) ? Math.round(last) : null;
    _rsiCache[code] = { rsi: val, ts: Date.now() };
    return val;
  }

  /** R10: RSI 값에 따른 색상 */
  function _rsiColor(val) {
    if (val == null) return '#888';
    if (val < 30) return KRX_COLORS.DOWN;   // 과매도 (파랑)
    if (val > 70) return KRX_COLORS.UP;     // 과매수 (빨강)
    return '#888';                           // 중립 (회색)
  }

  /** S3: 시가총액 포맷팅 (억원 → 조/억 단위)
   *  - index.json의 marketCap 필드(억원)가 있는 종목만 표시
   *  - base(원) 대용 값일 경우 정렬에만 사용하고 표시하지 않음
   *  실제 marketCap 값 범위: 삼성전자 ~4,380,000억, 소형주 ~100억
   *  base(원) 대용 값 범위: ~1,000,000원 이하
   *  구분 기준: marketCap 필드가 있었는지 여부 (ALL_STOCKS.marketCap > 0)
   */
  function _formatMarketCap(code) {
    const cap = MARKET_CAP[code];
    if (!cap) return '';
    var stock = (typeof ALL_STOCKS !== 'undefined')
      ? ALL_STOCKS.find(function(s) { return s.code === code; })
      : null;
    if (!stock || !stock.marketCap || stock.marketCap <= 0) return '';
    // 간결한 포맷: 100조 이상 → "1,117조", 1조 이상 → "5.4조", 1조 미만 → "5,440억"
    if (cap >= 1000000) return Math.round(cap / 10000).toLocaleString() + '조';
    if (cap >= 10000) return (cap / 10000).toFixed(1) + '조';
    return cap.toLocaleString() + '억';
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
    const dir = _sortDirection === 'asc' ? -1 : 1;

    // [OPT] ALL_STOCKS Map 빌드 (O(1) lookup, 'change' 정렬 O(n²) → O(n log n))
    if (!_allStocksMap && typeof ALL_STOCKS !== 'undefined' && ALL_STOCKS.length) {
      _allStocksMap = new Map(ALL_STOCKS.map(function(s) { return [s.code, s]; }));
    }

    switch (sortBy) {
      case 'change':
        return [].concat(stocks).sort(function (a, b) {
          return dir * (_getChangePct(b.code) - _getChangePct(a.code));
        });

      case 'pattern':
        return [].concat(stocks).sort(function (a, b) {
          const pa = _getPatternCount(a.code, 'all');
          const pb = _getPatternCount(b.code, 'all');
          if (pb !== pa) return dir * (pb - pa);
          return (MARKET_CAP[b.code] || 0) - (MARKET_CAP[a.code] || 0);
        });

      case 'name':
        return [].concat(stocks).sort(function (a, b) {
          return dir * a.name.localeCompare(b.name, 'ko');
        });

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

  /** R6: 업종 그룹 필터 적용 */
  function _filterBySector(stocks) {
    if (!_activeSectorFilter) return stocks;
    return stocks.filter(function (s) { return _getSectorGroup(s) === _activeSectorFilter; });
  }

  /** 업종 그룹 드롭다운 옵션 채우기 (ALL_STOCKS 로드 후 1회) */
  function _populateSectorSelect() {
    var sel = document.getElementById('sb-sector-select');
    if (!sel) return;
    var allStocks = typeof ALL_STOCKS !== 'undefined' ? ALL_STOCKS : [];
    // 그룹별 종목 수 집계
    var groupCounts = {};
    allStocks.forEach(function (s) {
      var grp = _getSectorGroup(s);
      groupCounts[grp] = (groupCounts[grp] || 0) + 1;
    });
    // 기존 옵션 초기화 후 SECTOR_ORDER 순서대로 재생성
    sel.innerHTML = '<option value="">모든 업종</option>';
    SECTOR_ORDER.forEach(function (grpName) {
      var cnt = groupCounts[grpName];
      if (!cnt) return; // 해당 그룹에 종목이 없으면 생략
      var opt = document.createElement('option');
      opt.value = grpName;
      opt.textContent = grpName + ' (' + cnt + ')';
      sel.appendChild(opt);
    });
    // localStorage에서 복원
    sel.value = _activeSectorFilter;
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
      '<div class="sb-list" id="sb-recent"></div>';  // [FIX] sb-body → sb-list (CSS 아코디언 .collapsed + .sb-list 규칙과 일치)

    // 즐겨찾기 다음, 종목 목록 앞에 삽입
    const sbBody = sidebar.querySelector('.sb-body');
    if (sbBody) {
      // 즐겨찾기 섹션이 있으면 그 다음에, 없으면 맨 앞에
      const wlSection = document.getElementById('sb-watchlist-section');
      if (wlSection && wlSection.nextSibling) {
        sbBody.insertBefore(recentSection, wlSection.nextSibling);
      } else if (sbBody.firstChild) {
        sbBody.insertBefore(recentSection, sbBody.firstChild);
      } else {
        sbBody.appendChild(recentSection);
      }
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

    // 검색 중이거나 종목이 없으면 섹션 숨김
    if (sectionEl) {
      sectionEl.style.display = (stocks.length > 0 && !_searchQuery) ? '' : 'none';
    }

    if (stocks.length === 0) {
      container.innerHTML = '';
      return;
    }

    _renderItems(container, stocks, false, 0, null);
  }


  // ════════════════════════════════════════════════════
  //  R5: 3단계 보기 모드 (미니멀/기본/분석)
  // ════════════════════════════════════════════════════

  function setViewMode(mode) {
    // 하위 호환: compact/minimal → default, detailed → analysis
    if (mode === 'compact' || mode === 'minimal') mode = 'default';
    if (mode === 'detailed') mode = 'analysis';
    if (_viewModes.indexOf(mode) === -1) mode = 'default';

    _viewMode = mode;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('sb-minimal', 'sb-analysis');
      if (mode === 'analysis') sidebar.classList.add('sb-analysis');
      // 'default' 모드에는 클래스 없음
    }
    // 세그먼트 그룹 활성 상태 갱신
    _updateViewGroup();
    try { localStorage.setItem(LS_VIEW, mode); } catch (e) { /* ignore */ }
    build(_currentSort);
  }

  /** 보기 모드 세그먼트 그룹 활성 상태 갱신 */
  function _updateViewGroup() {
    var group = document.getElementById('sb-view-group');
    if (!group) return;
    group.querySelectorAll('.sb-view-opt').forEach(function(o) {
      o.classList.toggle('active', o.dataset.view === _viewMode);
    });
  }


  // ════════════════════════════════════════════════════
  //  R5: 보기 모드 토글 버튼 (3모드 순환)
  // ════════════════════════════════════════════════════

  function _ensureViewToggle() {
    var group = document.getElementById('sb-view-group');
    if (!group) return;

    // 초기 상태 반영
    _updateViewGroup();

    group.addEventListener('click', function(e) {
      var opt = e.target.closest('.sb-view-opt');
      if (!opt) return;

      var newMode = opt.dataset.view;
      if (newMode === _viewMode) return;

      _viewMode = newMode;

      // 활성 클래스 갱신
      group.querySelectorAll('.sb-view-opt').forEach(function(o) {
        o.classList.toggle('active', o.dataset.view === _viewMode);
      });

      // 사이드바 클래스 갱신
      var sidebar = document.getElementById('sidebar');
      sidebar.classList.remove('sb-minimal', 'sb-analysis');
      if (_viewMode === 'analysis') sidebar.classList.add('sb-analysis');

      // localStorage 저장
      try { localStorage.setItem(LS_VIEW, _viewMode); } catch(ex) {}

      // 스크리너 패널 토글: screener 모드에서만 패널 표시, 나머지 섹션 숨김
      _toggleScreenerPanel(_viewMode === 'screener');

      build(_currentSort, true);
    });
  }

  /** 스크리너 패널 표시/숨김 토글 */
  function _toggleScreenerPanel(show) {
    var panel = document.getElementById('sb-screener-panel');
    var body = document.querySelector('.sb-body');
    if (!panel || !body) return;
    // 스크리너 패널 외 모든 sb-section 토글
    var sections = body.querySelectorAll('.sb-section');
    sections.forEach(function(s) {
      if (s.id === 'sb-screener-panel') {
        s.style.display = show ? 'flex' : 'none';
      } else {
        s.style.display = show ? 'none' : '';
      }
    });
  }


  // ════════════════════════════════════════════════════
  //  R8: 패턴 감지 종목만 칩 토글
  // ════════════════════════════════════════════════════

  function _ensurePatternOnlyToggle() {
    // HTML에 이미 .sb-pattern-only-chip이 존재하므로 이벤트만 바인딩
    const chip = document.querySelector('.sb-pattern-only-chip');
    if (!chip) return;

    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      _patternOnlyFilter = !_patternOnlyFilter;
      chip.classList.toggle('active', _patternOnlyFilter);
      build(_currentSort);
    });
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
    ctx.strokeStyle = isUp ? KRX_COLORS.UP : KRX_COLORS.DOWN;
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

  /** 보이는 아이템의 스파크라인 일괄 그리기 (rAF)
   *  모든 뷰 모드에서 캐시된 데이터가 있는 종목은 스파크라인 표시.
   *  데이터가 없는 종목은 shimmer 해제 (빈 상태 유지, 무한 shimmer 방지). */
  function _drawVisibleSparklines(container) {
    // [FIX] analysis 모드 제한 제거 — 캐시된 데이터가 있으면 모든 모드에서 그리기
    var canvases = container.querySelectorAll('.sb-sparkline');
    if (!canvases.length) return;

    requestAnimationFrame(function () {
      canvases.forEach(function (cvs) {
        var code = cvs.dataset.code;
        if (!code) return;
        var closes = _getLast20Closes(code);
        var wrap = cvs.closest('.sb-spark-wrap');
        if (closes && closes.length > 1) {
          _drawSparkline(cvs, closes);
          // 로딩 shimmer 해제
          if (wrap) wrap.classList.remove('loading');
        } else {
          // 데이터 없음 → shimmer 해제 (빈 캔버스 유지, 무한 로딩 방지)
          if (wrap) wrap.classList.remove('loading');
        }
      });
    });
  }

  // ── IntersectionObserver 기반 스파크라인 지연 그리기 ──
  var _sparkObserver = null;

  /** 뷰포트에 보이는 스파크라인만 그리기 (스크롤 최적화)
   *  캐시된 캔들 데이터가 있으면 즉시 그리고 관찰 해제.
   *  데이터 없으면 shimmer 해제 후 관찰 해제 (무한 로딩 방지). */
  function _initSparkObserver() {
    if (_sparkObserver) _sparkObserver.disconnect();

    _sparkObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var canvas = entry.target;
        var code = canvas.dataset.code;
        if (!code) return;

        var closes = _getLast20Closes(code);
        var wrap = canvas.closest('.sb-spark-wrap');
        if (closes && closes.length > 1) {
          _drawSparkline(canvas, closes);
          if (wrap) wrap.classList.remove('loading');
        } else {
          // 데이터 미도착 → shimmer 해제 (빈 상태)
          if (wrap) wrap.classList.remove('loading');
        }
        _sparkObserver.unobserve(canvas);  // 한 번 그리면 관찰 해제
      });
    }, { root: null, threshold: 0.1 });

    // 모든 스파크라인 캔버스 관찰 시작
    document.querySelectorAll('.sb-sparkline').forEach(function (cvs) {
      _sparkObserver.observe(cvs);
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

      var maxIdx = _filteredStocks.length - 1;
      if (maxIdx < 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _kbFocusIndex = Math.min(_kbFocusIndex + 1, maxIdx);
        _applyKbFocus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _kbFocusIndex = Math.max(_kbFocusIndex - 1, 0);
        _applyKbFocus();
      } else if (e.key === 'Enter' && _kbFocusIndex >= 0 && _kbFocusIndex <= maxIdx) {
        e.preventDefault();
        var code = _filteredStocks[_kbFocusIndex].code;
        if (code && typeof selectStock === 'function') {
          selectStock(code);
        }
      }
    });
  }

  /** R1+R13: 가상 스크롤 환경에서 키보드 포커스 적용
   *  논리 인덱스 기반으로 스크롤 위치 조정 후 DOM 하이라이트 */
  function _applyKbFocus() {
    if (_kbFocusIndex < 0 || _kbFocusIndex >= _filteredStocks.length) return;

    // 해당 인덱스가 보이도록 스크롤 (가상 스크롤)
    var focusCode = _filteredStocks[_kbFocusIndex].code;
    if (_vsState && _vsState.scrollParent) {
      var el = document.getElementById('sb-all');
      if (el) {
        var itemH = _getItemHeight();
        var targetTop = el.offsetTop + (_kbFocusIndex * itemH);
        var scrollTop = _vsState.scrollParent.scrollTop;
        var viewH = _vsState.scrollParent.clientHeight;
        // 포커스 아이템이 뷰포트 밖이면 스크롤
        if (targetTop < scrollTop || targetTop + itemH > scrollTop + viewH) {
          _vsState.scrollParent.scrollTo({
            top: Math.max(0, targetTop - viewH / 2 + itemH / 2),
            behavior: 'smooth',
          });
        }
      }
    }

    // DOM에 있는 아이템에 kb-focus 클래스 적용
    // (스크롤 후 _renderVisibleItems가 호출되므로 약간의 지연 필요)
    requestAnimationFrame(function() {
      document.querySelectorAll('#sb-all .sb-item').forEach(function(item) {
        item.classList.toggle('kb-focus', item.dataset.code === focusCode);
      });
    });
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
    // [FIX] s 자체가 ALL_STOCKS 요소 — find() 없이 직접 읽기
    let price = 0;
    let changeAmtText = '';   // 변동액 (예: "▲500", "▼1,200")
    let changePctText = '';   // 등락률 (예: "+0.75%", "-1.50%")
    let changeClass = '';
    let volume = 0;

    if (cdls && cdls.length) {
      const last = cdls[cdls.length - 1];
      price = last.close;
      volume = last.volume || 0;
      const prevCandle = cdls.length >= 2 ? cdls[cdls.length - 2] : null;
      const prevClose = prevCandle ? prevCandle.close : last.open;
      if (prevClose > 0) {
        const diff = last.close - prevClose;
        const pctNum = parseFloat(((diff / prevClose) * 100).toFixed(2));
        const arrow = pctNum > 0 ? '\u25B2' : pctNum < 0 ? '\u25BC' : '';
        changeAmtText = arrow + Math.abs(diff).toLocaleString();
        changePctText = '(' + (pctNum >= 0 ? '+' : '') + pctNum.toFixed(2) + '%)';
        changeClass = pctNum >= 0 ? 'up' : 'dn';
      }
    } else {
      // index.json 요약 데이터에서 직접 표시 (OHLCV fetch 불필요)
      price = s.base || s.lastClose || 0;
      volume = s.volume || 0;
      var chgPct = s.changePercent || 0;
      if (s.prevClose > 0 || chgPct !== 0) {
        // 변동액: prevClose가 있으면 계산, 없으면 %만 표시
        var basePrice = s.prevClose || s.base || 0;
        if (basePrice > 0 && chgPct !== 0) {
          var diff = Math.round(basePrice * chgPct / 100);
          var arrow = chgPct > 0 ? '\u25B2' : chgPct < 0 ? '\u25BC' : '';
          changeAmtText = arrow + Math.abs(diff).toLocaleString();
        }
        changePctText = '(' + (chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%)';
        changeClass = chgPct >= 0 ? 'up' : 'dn';
      }
    }

    // ── 모드별 표시 제어 ──
    // 미니멀: CSS가 row2 숨김 → row1에 가격만
    // 기본:   row1=종목명+가격, row2=코드+변동액+등락률 (시총/거래량/RSI 숨김)
    // 분석:   row2에 코드+스파크라인+시총/거래량/RSI+등락 모두 표시

    // R10: RSI 값
    const rsiVal = _getRSI(s.code);
    let rsiHtml = '';
    if (rsiVal != null) {
      rsiHtml = '<span class="sb-rsi" style="color:' + _rsiColor(rsiVal) + '"><span class="sb-label">R</span>' + rsiVal + '</span>';
    }

    // S3: 시가총액 표시
    const mcapText = _formatMarketCap(s.code);
    let mcapHtml = '';
    if (mcapText) {
      mcapHtml = '<span class="sb-mcap"><span class="sb-label">MC</span>' + mcapText + '</span>';
    }

    // S6: 패턴명 → data-patterns 속성 (호버 툴팁)
    let patternAttr = '';
    if (isPatternMode) {
      const cached = _stockPatternCache[s.code];
      if (cached && cached.names && cached.names.length > 0) {
        let displayNames = cached.names.slice(0, 3).join(', ');
        if (cached.names.length > 3) {
          displayNames += ' +' + (cached.names.length - 3);
        }
        patternAttr = ' data-patterns="' + displayNames.replace(/"/g, '&quot;') + '"';
      }
    }

    // 대량거래 뱃지 (volumeRatio >= 2.0)
    const volRatio = _getVolumeRatio(s.code);
    const volBadge = volRatio >= 2.0
      ? '<span class="sb-vol-badge" title="거래량 ' + volRatio.toFixed(1) + '배">&#9650;</span>'
      : '';

    // 패턴 카테고리 pill (기존 호환)
    const pillsHtml = isPatternMode ? _renderCategoryPills(s.code) : '';

    // 스파크라인 데이터 존재 여부에 따라 로딩 상태 결정
    var hasSparkData = !!_getLast20Closes(s.code);
    var sparkWrapClass = 'sb-spark-wrap' + (hasSparkData ? '' : ' loading');
    // 스파크라인 레이블: 일봉이면 '30D', 분봉이면 '오늘'
    var tf = _tf();
    var sparkLabel = tf === '1d' ? '30D' : '\uC624\uB298';

    // [FIX-TRUST] 데모 모드일 때 가격 옆에 데모 뱃지 표시
    var _demoBadge = '';
    if (typeof KRX_API_CONFIG !== 'undefined' && KRX_API_CONFIG.mode === 'demo') {
      _demoBadge = '<span style="font-size:8px;color:#ff9800;background:rgba(255,152,0,0.12);padding:0 3px;border-radius:2px;margin-left:3px;vertical-align:middle;font-weight:700;letter-spacing:.3px;">DEMO</span>';
    }

    return '<div class="sb-item' + (isPatternMode && pillsHtml ? ' has-pattern' : '') + '" data-code="' + s.code + '"' + patternAttr + ' draggable="true">' +
      '<div class="sb-row1">' +
        '<span class="sb-name" title="' + s.code + '">' + s.name + volBadge + pillsHtml + '</span>' +
        '<span class="sb-price" id="sb-' + s.code + '">' + (price > 0 ? price.toLocaleString() : '\u2014') + _demoBadge + '</span>' +
      '</div>' +
      '<div class="sb-row2">' +
        '<span class="sb-code">' + s.code + '</span>' +
        '<span class="' + sparkWrapClass + '">' +
          '<canvas class="sb-sparkline" data-code="' + s.code + '" width="48" height="16"></canvas>' +
          '<span class="sb-spark-label">' + sparkLabel + '</span>' +
        '</span>' +
        mcapHtml +
        '<span class="sb-volume"><span class="sb-label">V</span>' + _formatVolume(volume) + '</span>' +
        rsiHtml +
        '<span class="sb-change-group">' +
          '<span class="sb-change-amt ' + changeClass + '" id="sb-amt-' + s.code + '">' + changeAmtText + '</span>' +
          '<span class="sb-change ' + changeClass + '" id="sb-chg-' + s.code + '">' + changePctText + '</span>' +
        '</span>' +
      '</div>' +
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

    // R9: 스파크라인 — IntersectionObserver로 뷰포트 진입 시 그리기
    _initSparkObserver();
  }


  // ════════════════════════════════════════════════════
  //  R13: 가상 스크롤 렌더링
  //  2700+ 종목을 DOM ~40개로 효율적으로 표시.
  //  .sb-body가 스크롤 컨테이너, #sb-all 내부에
  //  spacer(전체 높이)와 content(보이는 아이템)를 배치.
  // ════════════════════════════════════════════════════

  /** 뷰 모드별 아이템 높이 반환 (px) */
  function _getItemHeight() {
    // analysis 모드: 스파크라인+메타 2행 → 더 높음
    if (_viewMode === 'analysis') return 56;
    // default 모드: row1 + row2 (등락률+거래량)
    return 42;
  }

  /** 가상 스크롤 초기화 — sb-all 내부에 spacer + content 구조 생성 */
  function _initVirtualScroll() {
    var el = document.getElementById('sb-all');
    if (!el) return;

    // 기존 "더보기" 버튼 제거 (더 이상 불필요)
    var loadMoreBtn = document.getElementById('sb-load-more');
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    // 스크롤 부모 = .sb-body (overflow-y: auto인 컨테이너)
    var scrollParent = el.closest('.sb-body');
    if (!scrollParent) return;

    // 이미 초기화된 경우 재사용
    if (_vsState && _vsState.spacer && _vsState.content) {
      _vsState.scrollParent = scrollParent;
      return;
    }

    // 기존 내용 비우기
    el.innerHTML = '';
    el.style.position = 'relative';

    // spacer: 전체 높이를 차지해 정확한 스크롤바 생성
    var spacer = document.createElement('div');
    spacer.className = 'sb-virtual-spacer';
    spacer.style.cssText = 'width:100%;pointer-events:none;';
    el.appendChild(spacer);

    // content: 보이는 아이템만 렌더링하는 절대 위치 컨테이너
    var content = document.createElement('div');
    content.className = 'sb-virtual-content';
    content.style.cssText = 'position:absolute;left:0;right:0;top:0;';
    el.appendChild(content);

    _vsState = {
      spacer: spacer,
      content: content,
      scrollParent: scrollParent,
      startIdx: -1,
      endIdx: -1,
    };

    // 스크롤 이벤트 (rAF 스로틀)
    scrollParent.addEventListener('scroll', _onVirtualScroll, { passive: true });
  }

  /** 스크롤 이벤트 핸들러 — rAF로 스로틀링 */
  function _onVirtualScroll() {
    if (_vsRafPending) return;
    _vsRafPending = true;
    requestAnimationFrame(function() {
      _vsRafPending = false;
      _renderVisibleItems();
    });
  }

  /** 현재 스크롤 위치 기반으로 보이는 아이템만 렌더링 */
  function _renderVisibleItems() {
    if (!_vsState || !_vsState.scrollParent) return;

    var scrollParent = _vsState.scrollParent;
    var el = document.getElementById('sb-all');
    if (!el) return;

    var itemH = _getItemHeight();
    var totalItems = _filteredStocks.length;

    // #sb-all의 scrollParent 내 오프셋 계산
    // (.sb-body 스크롤 위치 - #sb-all의 상대 위치)
    var elTop = el.offsetTop;  // sb-body 내에서의 y 위치
    var scrollTop = scrollParent.scrollTop;
    var viewHeight = scrollParent.clientHeight;

    // sb-all 영역 기준 스크롤 오프셋
    var relativeScrollTop = scrollTop - elTop;

    // 보이는 범위 계산
    var startIdx, endIdx;
    if (relativeScrollTop < 0) {
      // #sb-all 위쪽이 아직 보이지 않음 (즐겨찾기/최근 섹션 영역)
      startIdx = 0;
      endIdx = Math.min(totalItems,
        Math.ceil((viewHeight - elTop + scrollTop) / itemH) + VIRTUAL_BUFFER);
    } else {
      startIdx = Math.max(0, Math.floor(relativeScrollTop / itemH) - VIRTUAL_BUFFER);
      endIdx = Math.min(totalItems,
        Math.ceil((relativeScrollTop + viewHeight) / itemH) + VIRTUAL_BUFFER);
    }

    // 범위가 변경되지 않았으면 스킵 (불필요한 DOM 갱신 방지)
    if (startIdx === _vsState.startIdx && endIdx === _vsState.endIdx) return;
    _vsState.startIdx = startIdx;
    _vsState.endIdx = endIdx;

    // 보이는 아이템 HTML 생성
    var isPatternMode = _currentSort === 'pattern';
    var html = '';
    for (var i = startIdx; i < endIdx; i++) {
      html += _renderItemHTML(_filteredStocks[i], isPatternMode);
    }

    // content 위치 조정 및 렌더
    _vsState.content.style.top = (startIdx * itemH) + 'px';
    _vsState.content.innerHTML = html;

    // 활성 종목 표시 복원
    if (typeof currentStock !== 'undefined' && currentStock) {
      _vsState.content.querySelectorAll('.sb-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.code === currentStock.code);
      });
    }

    // 스파크라인 그리기 (보이는 아이템만)
    _drawVisibleSparklines(_vsState.content);
  }

  /** 전체 종목 목록의 가상 스크롤 렌더링 (build에서 호출) */
  function _renderList() {
    var el = document.getElementById('sb-all');
    if (!el) return;

    // 가상 스크롤 구조 보장
    _initVirtualScroll();
    if (!_vsState) return;

    // 아이템 높이 갱신 (뷰 모드 변경 대응)
    var itemH = _getItemHeight();
    var totalHeight = _filteredStocks.length * itemH;

    // spacer 높이 갱신 (스크롤바 크기 결정)
    _vsState.spacer.style.height = totalHeight + 'px';

    // .sb-list의 max-height 제한 해제 (CSS에서 2000px 제한됨)
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';

    // 렌더 범위 초기화 (강제 재렌더)
    _vsState.startIdx = -1;
    _vsState.endIdx = -1;

    // 보이는 아이템 렌더링
    _renderVisibleItems();
  }


  // ════════════════════════════════════════════════════
  //  시장 지수 갱신 (헤더 ticker strip에만 표시)
  // ════════════════════════════════════════════════════

  function _updateMarketIndex() {
    // 사이드바 내 시장 지수 표시 요소가 제거됨 (v8.0 통합 목록)
    // 헤더 ticker strip (t-kospi, t-kosdaq)은 app.js가 관리
  }


  // ════════════════════════════════════════════════════
  //  이벤트 위임 설정 (전체 사이드바)
  // ════════════════════════════════════════════════════

  function _setupEventDelegation() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // 종목 클릭 (이벤트 위임)
    sidebar.addEventListener('click', function (e) {
      // 종목 아이템 클릭 (sb-header 내부는 제외 — 아코디언 토글)
      if (e.target.closest('.sb-header')) return;
      // 필터/정렬/토글/더보기 버튼은 제외
      if (e.target.closest('.sb-sort-select') || e.target.closest('.sb-sector-select') ||
          e.target.closest('.sb-chip') ||
          e.target.closest('.sb-view-group') || e.target.closest('.sb-view-opt') ||
          e.target.closest('.sb-sort-dir') ||
          e.target.closest('.sb-pattern-only-chip')) return;

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
    // ALL_STOCKS에서 시가총액 자동 빌드 (index.json 로드 후)
    _buildMarketCapFromStocks();

    // localStorage에서 상태 복원 (Safari private mode 안전)
    try {
      const saved = localStorage.getItem(LS_KEY);
      _open = saved !== 'false';
      const savedView = localStorage.getItem(LS_VIEW);
      if (savedView) {
        if (savedView === 'compact' || savedView === 'minimal') _viewMode = 'default';
        else if (savedView === 'detailed') _viewMode = 'analysis';
        else if (_viewModes.indexOf(savedView) !== -1) _viewMode = savedView;
      }
    } catch (e) { _open = true; }
    if (!_open) document.getElementById('main').classList.add('sidebar-collapsed');
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('sb-minimal', 'sb-analysis');
      if (_viewMode === 'analysis') sidebar.classList.add('sb-analysis');
      // 'default' 모드에는 클래스 없음
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
        const first = document.querySelector('#sb-all .sb-item[data-code]');
        if (first && typeof selectStock === 'function') {
          selectStock(first.dataset.code);
          searchInput.value = '';
          _searchQuery = '';
          build(_currentSort);
        }
      });
    }

    // ── R4: 정렬 드롭다운 이벤트 ──
    const sortSelect = document.getElementById('sb-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        const sortBy = sortSelect.value;
        _currentSort = sortBy;

        // R8: 패턴 전용 필터 토글 표시/숨김
        var patChip = document.querySelector('.sb-pattern-only-chip');
        if (patChip) {
          patChip.style.display = sortBy === 'pattern' ? '' : 'none';
          if (sortBy !== 'pattern') {
            _patternOnlyFilter = false;
            patChip.classList.remove('active');
          }
        }

        build(sortBy);
      });
    }

    // ── 정렬 방향 토글 버튼 ──
    var dirBtn = document.getElementById('sb-sort-dir');
    if (dirBtn) {
      dirBtn.addEventListener('click', function() {
        _sortDirection = _sortDirection === 'desc' ? 'asc' : 'desc';
        dirBtn.innerHTML = _sortDirection === 'desc' ? '&#9660;' : '&#9650;';
        build(_currentSort, true);
      });
    }

    // ── 업종 필터 드롭다운 ──
    try { _activeSectorFilter = localStorage.getItem(LS_SECTOR) || ''; } catch (e) { _activeSectorFilter = ''; }
    _populateSectorSelect();
    var sectorSelect = document.getElementById('sb-sector-select');
    if (sectorSelect) {
      sectorSelect.addEventListener('change', function () {
        _activeSectorFilter = sectorSelect.value;
        try { localStorage.setItem(LS_SECTOR, _activeSectorFilter); } catch (e) { /* ignore */ }
        build(_currentSort);
      });
    }

    // ── 동적 DOM 요소 생성 ──
    _ensureViewToggle();        // R5
    _ensurePatternOnlyToggle(); // R8
    _ensureRecentSection();     // R2

    // ── 이벤트 위임 + 드래그 앤 드롭 ──
    _setupEventDelegation();

    // R13: 가상 스크롤은 _renderList()에서 자동 초기화

    // R1: 키보드 네비게이션
    _initKeyboardNav();

    // 즐겨찾기 섹션 렌더링
    renderWatchlist();

    // 즐겨찾기 아코디언 토글
    var wlHeader = document.getElementById('sb-watchlist-header');
    if (wlHeader) {
      wlHeader.addEventListener('click', function () {
        wlHeader.classList.toggle('collapsed');
      });
    }

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
    try { localStorage.setItem(LS_KEY, _open); } catch (e) {}

    // 사이드바 토글 후 차트 리사이즈 (grid transition 완료 대기)
    setTimeout(function () {
      if (typeof chartManager !== 'undefined' && chartManager.mainChart) {
        var container = document.getElementById('main-chart-container');
        if (container) {
          chartManager.mainChart.applyOptions({ width: container.clientWidth });
        }
      }
    }, 300);
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: build
  // ════════════════════════════════════════════════════

  function build(sortBy, keepPage) {
    sortBy = sortBy || _currentSort || 'mcap';
    _currentSort = sortBy;

    // 검색 중이면 ALL_STOCKS 전체 검색, 아니면 ALL_STOCKS (index.json 로드됨)
    const allStocks = typeof ALL_STOCKS !== 'undefined' ? ALL_STOCKS : (typeof DEFAULT_STOCKS !== 'undefined' ? DEFAULT_STOCKS : []);
    let source = _searchQuery
      ? _filterBySearch(allStocks)
      : allStocks;

    // R6: 업종 그룹 필터 적용
    source = _filterBySector(source);

    // R8: 패턴 감지 종목만 필터
    if (_currentSort === 'pattern') {
      source = _filterByPatternOnly(source);
    }

    // R12: 통합 정렬 (KOSPI/KOSDAQ 구분 없이)
    _filteredStocks = _sortStocks(source, sortBy);

    // 총 종목 수 표시
    const allCount = document.getElementById('sb-all-count');
    if (allCount) allCount.textContent = _filteredStocks.length;

    // R13: 가상 스크롤 렌더링
    _renderList();

    // [FIX] build 직후 즉시 가격/등락률 표시 (index.json 요약 데이터 사용)
    updatePrices();

    // 즐겨찾기 섹션 갱신
    renderWatchlist();

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
    // 현재 DOM에 있는 모든 sb-item에 active 토글
    document.querySelectorAll('.sb-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.code === code);
    });
    scrollToActive(code);
  }

  /** 해당 종목이 보이도록 가상 스크롤 위치 조정 후 스크롤 */
  function scrollToActive(code) {
    // R13: 가상 스크롤 — 종목이 DOM에 없을 수 있으므로 인덱스로 스크롤
    if (_vsState && _vsState.scrollParent) {
      var idx = -1;
      for (var i = 0; i < _filteredStocks.length; i++) {
        if (_filteredStocks[i].code === code) { idx = i; break; }
      }
      if (idx >= 0) {
        var el = document.getElementById('sb-all');
        if (el) {
          var itemH = _getItemHeight();
          var targetScroll = el.offsetTop + (idx * itemH);
          var viewH = _vsState.scrollParent.clientHeight;
          // 종목이 뷰포트 중앙에 오도록 스크롤
          _vsState.scrollParent.scrollTo({
            top: Math.max(0, targetScroll - viewH / 2 + itemH / 2),
            behavior: 'smooth',
          });
        }
        return;
      }
    }
    // 폴백: 즐겨찾기/최근 섹션에 있을 수 있음
    var activeEl = document.querySelector('.sb-item[data-code="' + code + '"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC: updatePrices
  // ════════════════════════════════════════════════════

  function updatePrices() {
    _updateMarketIndex();

    // R13: 가상 스크롤 — 현재 DOM에 존재하는 아이템만 갱신
    // (전체 ALL_STOCKS 순회 대신 보이는 아이템의 data-code만 처리)
    var visibleItems = document.querySelectorAll('.sb-item[data-code]');
    for (var vi = 0; vi < visibleItems.length; vi++) {
      var itemEl = visibleItems[vi];
      var code = itemEl.dataset.code;
      if (!code) continue;

      var s = (typeof ALL_STOCKS !== 'undefined')
        ? ALL_STOCKS.find(function(st) { return st.code === code; })
        : null;
      if (!s) continue;

      var priceEl = itemEl.querySelector('.sb-price');
      if (!priceEl) continue;

      var cdls = _getCachedCandles(s.code);
      var newPrice, changePct, changeDiff, lastVol, prevClose;

      if (cdls && cdls.length) {
        // 캐시된 캔들 우선 (실시간/최근 로드 데이터)
        var last = cdls[cdls.length - 1];
        newPrice = last.close;
        lastVol = last.volume || 0;
        var prevCandle = cdls.length >= 2 ? cdls[cdls.length - 2] : null;
        prevClose = prevCandle ? prevCandle.close : last.open;
        changeDiff = prevClose > 0 ? (last.close - prevClose) : 0;
        changePct = prevClose > 0 ? ((changeDiff / prevClose) * 100) : 0;
      } else if (s.base && s.base > 0) {
        // index.json 요약 폴백 — OHLCV fetch 없이 즉시 표시
        newPrice = s.base;
        changePct = s.changePercent || 0;
        lastVol = s.volume || 0;
        var basePrice = s.prevClose || s.base || 0;
        changeDiff = basePrice > 0 ? Math.round(basePrice * changePct / 100) : 0;
      } else {
        continue;
      }

      priceEl.textContent = newPrice.toLocaleString();
      priceEl.className = 'sb-price';

      // 변동액 + 등락률
      var pctNum = parseFloat(changePct.toFixed(2));
      var clsCh = pctNum >= 0 ? 'up' : 'dn';

      var amtEl = itemEl.querySelector('.sb-change-amt');
      if (amtEl) {
        var arrow = pctNum > 0 ? '\u25B2' : pctNum < 0 ? '\u25BC' : '';
        amtEl.textContent = arrow + Math.abs(changeDiff).toLocaleString();
        amtEl.className = 'sb-change-amt ' + clsCh;
      }

      var changeEl = itemEl.querySelector('.sb-change');
      if (changeEl) {
        changeEl.textContent = '(' + (pctNum >= 0 ? '+' : '') + pctNum.toFixed(2) + '%)';
        changeEl.className = 'sb-change ' + clsCh;
        _stockChangeCache[s.code] = pctNum;
      }

      // R3: 거래량 갱신
      var volSpan = itemEl.querySelector('.sb-volume');
      if (volSpan) volSpan.innerHTML = '<span class="sb-label">V</span>' + _formatVolume(lastVol);

      // 가격 flash 효과 (캐시된 캔들이 있을 때만)
      if (!cdls || !cdls.length) continue;
      var prev = _prevPrices[s.code];
      if (prev !== undefined && prev !== newPrice) {
        var flashCls = newPrice > prev ? 'price-flash-up' : 'price-flash-down';
        priceEl.classList.add(flashCls);
        priceEl.addEventListener('animationend', function () {
          this.classList.remove('price-flash-up', 'price-flash-down');
        }, { once: true });
      }
      _prevPrices[s.code] = newPrice;
    }

    // R13: 가상 스크롤 — 보이는 아이템 스파크라인 재그리기
    if (_vsState && _vsState.content) {
      _drawVisibleSparklines(_vsState.content);
    }
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
  //  즐겨찾기 (워치리스트) 섹션 렌더링
  // ════════════════════════════════════════════════════

  function renderWatchlist() {
    var container = document.getElementById('sb-watchlist-items');
    var countEl = document.getElementById('sb-watchlist-count');
    var sectionEl = document.getElementById('sb-watchlist-section');
    if (!container) return;

    var list = [];
    try { list = JSON.parse(localStorage.getItem('krx_watchlist')) || []; } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];

    if (countEl) countEl.textContent = list.length;

    // 종목이 없거나 검색 중이면 숨김
    if (sectionEl) {
      sectionEl.style.display = (list.length > 0 && !_searchQuery) ? '' : 'none';
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="sb-empty-msg" style="padding:8px;color:var(--text-muted);font-size:var(--fs-micro);">종목을 즐겨찾기에 추가하세요</div>';
      return;
    }

    // ALL_STOCKS에서 워치리스트 종목 정보 찾기
    var stocks = [];
    for (var i = 0; i < list.length; i++) {
      var code = list[i];
      var found = (typeof ALL_STOCKS !== 'undefined')
        ? ALL_STOCKS.find(function (s) { return s.code === code; })
        : null;
      if (found) stocks.push(found);
    }

    if (stocks.length === 0) {
      container.innerHTML = '';
      if (sectionEl) sectionEl.style.display = 'none';
      return;
    }

    _renderItems(container, stocks, false, 0, null);
  }


  // ════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════

  /** 현재 사이드바에 표시 중인 종목 목록 반환 (시총 순 정렬 적용됨) */
  function getFilteredStocks() {
    return _filteredStocks.slice();
  }

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
    getFilteredStocks: getFilteredStocks,
    renderWatchlist: renderWatchlist,
    MARKET_CAP: MARKET_CAP,
  };
})();
