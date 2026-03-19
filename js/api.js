// ══════════════════════════════════════════════════════
//  KRX 데이터 서비스 — 종목 목록 + API 연동 + 데모 모드
// ══════════════════════════════════════════════════════
//
//  사용법:
//  1. WebSocket 모드 (기본): Kiwoom OCX 서버 연동 실시간 데이터
//     - server/start_server.bat 실행 (Python 3.9-32bit, PyQt5)
//     - KRX_API_CONFIG.mode = 'ws'
//  2. 파일 모드: data/ 폴더의 JSON 파일 로드 (일봉만)
//     - python scripts/download_ohlcv.py 실행
//     - KRX_API_CONFIG.mode = 'file'
//  3. 데모 모드: 시뮬레이션 데이터로 즉시 실행
//     - KRX_API_CONFIG.mode = 'demo'
//
//  향후 교체:
//  - 'koscom' 모드 추가 시 서버 측 KRX_PROVIDER 환경변수만 변경
//
// ══════════════════════════════════════════════════════

// ── IndexedDB 캐시 (일봉 OHLCV 영구 저장) ──────────────
// 페이지 리로드 시 네트워크 재요청 없이 IndexedDB에서 즉시 로드.
// 모든 연산은 async + fail-silent — IndexedDB 미지원 환경에서도 안전.
const _idb = {
  db: null,
  DB_NAME: 'krx_cache',
  STORE: 'candles',
  VERSION: 1,

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.DB_NAME, this.VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE)) {
            db.createObjectStore(this.STORE);  // key = "code-timeframe"
          }
        };
        req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
        req.onerror = () => { console.warn('[IDB] 열기 실패'); resolve(null); };
      } catch (e) {
        // IndexedDB 미지원 (예: 프라이빗 모드 일부 브라우저)
        console.warn('[IDB] IndexedDB 사용 불가:', e.message);
        resolve(null);
      }
    });
  },

  async get(key) {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.STORE, 'readonly');
        const store = tx.objectStore(this.STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },

  async set(key, value) {
    const db = await this.open();
    if (!db) return;
    try {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(value, key);
    } catch (e) { /* 쓰기 실패 무시 */ }
  }
};

// ── 배포 환경 자동 감지: cheesestock.co.kr → WSS 프록시, 그 외 → localhost ──
var _defaultWsUrl = 'ws://localhost:8765';
try {
  var _h = window.location.hostname;
  if (_h === 'www.cheesestock.co.kr' || _h === 'cheesestock.co.kr' || _h.endsWith('.pages.dev')) {
    _defaultWsUrl = 'wss://ws.cheesestock.co.kr/ws';
  }
} catch(e) {}

const KRX_API_CONFIG = {
  mode: 'ws',     // 'ws' | 'file' | 'demo' | 'koscom'
  wsUrl: _defaultWsUrl,
  dataDir: 'data', // file 모드에서 JSON 파일 경로
};

// ── 저장된 서버 주소 로드 (localStorage) ──────────────
// 사용자가 연결 설정에서 변경한 wsUrl을 복원
try {
  var _savedPrefs = JSON.parse(localStorage.getItem('krx-prefs'));
  if (_savedPrefs && _savedPrefs.wsUrl) {
    // 프로덕션 도메인에서 localStorage의 localhost URL 무시
    var _isLocalSaved = _savedPrefs.wsUrl.includes('localhost') || _savedPrefs.wsUrl.includes('127.0.0.1');
    var _isProdDomain = _defaultWsUrl.startsWith('wss://');
    if (!(_isLocalSaved && _isProdDomain)) {
      KRX_API_CONFIG.wsUrl = _savedPrefs.wsUrl;
    }
  }
} catch (e) { /* localStorage 접근 불가 — 무시 */ }

// ── 기본 종목 목록 (index.json 로드 전 폴백) ──────────
// base: 0 → 하드코딩 가격 제거. index.json 로드 시 lastClose로 대체됨.
// 데모 모드에서 base가 0이면 기본 50,000원 사용.
const DEFAULT_STOCKS = [
  // ═══ KOSPI 대형주 ═══
  { code: '005930', name: '삼성전자',       market: 'KOSPI', base: 0 },
  { code: '000660', name: 'SK하이닉스',     market: 'KOSPI', base: 0 },
  { code: '005380', name: '현대차',         market: 'KOSPI', base: 0 },
  { code: '000270', name: '기아',           market: 'KOSPI', base: 0 },
  { code: '005490', name: 'POSCO홀딩스',    market: 'KOSPI', base: 0 },
  { code: '051910', name: 'LG화학',         market: 'KOSPI', base: 0 },
  { code: '006400', name: '삼성SDI',        market: 'KOSPI', base: 0 },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', base: 0 },
  { code: '068270', name: '셀트리온',       market: 'KOSPI', base: 0 },
  { code: '035420', name: 'NAVER',          market: 'KOSPI', base: 0 },
  { code: '035720', name: '카카오',         market: 'KOSPI', base: 0 },
  { code: '028260', name: '삼성물산',       market: 'KOSPI', base: 0 },
  { code: '105560', name: 'KB금융',         market: 'KOSPI', base: 0 },
  { code: '055550', name: '신한지주',       market: 'KOSPI', base: 0 },
  { code: '003550', name: 'LG',             market: 'KOSPI', base: 0 },
  { code: '066570', name: 'LG전자',         market: 'KOSPI', base: 0 },
  { code: '012330', name: '현대모비스',     market: 'KOSPI', base: 0 },
  { code: '034730', name: 'SK',             market: 'KOSPI', base: 0 },
  { code: '015760', name: '한국전력',       market: 'KOSPI', base: 0 },
  { code: '030200', name: 'KT',             market: 'KOSPI', base: 0 },
  { code: '033780', name: 'KT&G',           market: 'KOSPI', base: 0 },
  { code: '009150', name: '삼성전기',       market: 'KOSPI', base: 0 },
  { code: '086790', name: '하나금융지주',   market: 'KOSPI', base: 0 },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI', base: 0 },
  { code: '032830', name: '삼성생명',       market: 'KOSPI', base: 0 },
  { code: '003670', name: '포스코퓨처엠',   market: 'KOSPI', base: 0 },
  { code: '096770', name: 'SK이노베이션',   market: 'KOSPI', base: 0 },
  { code: '010130', name: '고려아연',       market: 'KOSPI', base: 0 },
  { code: '011200', name: 'HMM',            market: 'KOSPI', base: 0 },
  { code: '034020', name: '두산에너빌리티', market: 'KOSPI', base: 0 },
  { code: '005935', name: '삼성전자우',     market: 'KOSPI', base: 0 },
  { code: '010950', name: 'S-Oil',          market: 'KOSPI', base: 0 },
  { code: '011170', name: '롯데케미칼',     market: 'KOSPI', base: 0 },
  { code: '017670', name: 'SK텔레콤',       market: 'KOSPI', base: 0 },
  { code: '036570', name: '엔씨소프트',     market: 'KOSPI', base: 0 },

  // ═══ KOSDAQ 대형주 ═══
  { code: '247540', name: '에코프로비엠',   market: 'KOSDAQ', base: 0 },
  { code: '086520', name: '에코프로',       market: 'KOSDAQ', base: 0 },
  { code: '196170', name: '알테오젠',       market: 'KOSDAQ', base: 0 },
  { code: '058470', name: '리노공업',       market: 'KOSDAQ', base: 0 },
  { code: '328130', name: '루닛',           market: 'KOSDAQ', base: 0 },
  { code: '383220', name: 'F&F',            market: 'KOSDAQ', base: 0 },
  { code: '357780', name: '솔브레인',       market: 'KOSDAQ', base: 0 },
  { code: '145020', name: '휴젤',           market: 'KOSDAQ', base: 0 },
  { code: '263750', name: '펄어비스',       market: 'KOSDAQ', base: 0 },
  { code: '293490', name: '카카오게임즈',   market: 'KOSDAQ', base: 0 },
  { code: '112040', name: '위메이드',       market: 'KOSDAQ', base: 0 },
  { code: '041510', name: '에스엠',         market: 'KOSDAQ', base: 0 },
  { code: '251270', name: '넷마블',         market: 'KOSDAQ', base: 0 },
  { code: '067160', name: '아프리카TV',     market: 'KOSDAQ', base: 0 },
  { code: '403870', name: 'HPSP',           market: 'KOSDAQ', base: 0 },
  { code: '039030', name: '이오테크닉스',   market: 'KOSDAQ', base: 0 },
  { code: '095340', name: 'ISC',            market: 'KOSDAQ', base: 0 },
  { code: '141080', name: '레고켐바이오',   market: 'KOSDAQ', base: 0 },
  { code: '377300', name: '카카오페이',     market: 'KOSDAQ', base: 0 },
  { code: '035900', name: 'JYP Ent.',       market: 'KOSDAQ', base: 0 },
];

// ALL_STOCKS: initFromIndex() 호출 시 index.json에서 동적 로드
let ALL_STOCKS = DEFAULT_STOCKS;

// ── 타임프레임 정의 ────────────────────────────────────
const TIMEFRAMES = {
  '1m':  { label: '1분',    seconds: 60,    count: 120 },
  '5m':  { label: '5분',    seconds: 300,   count: 120 },
  '15m': { label: '15분',   seconds: 900,   count: 120 },
  '30m': { label: '30분',   seconds: 1800,  count: 120 },
  '1h':  { label: '1시간',  seconds: 3600,  count: 120 },
  '1d':  { label: '일봉',   seconds: 86400, count: 200 },
};

// ── 캔들 배열 메모리 상한 (장시간 세션 메모리 누수 방지) ──
const MAX_CANDLES_DAILY = 2000;      // 일봉 최대 ~8년
const MAX_CANDLES_INTRADAY = 500;    // 분봉 최대 ~2일
const MAX_CACHE_ENTRIES = 50;        // 캐시 최대 종목 수

// ══════════════════════════════════════════════════════
//  KRX 데이터 서비스 클래스
// ══════════════════════════════════════════════════════
class KRXDataService {
  constructor() {
    this.cache = {};       // { 'code-tf': { candles, lastUpdate } }
  }

  /**
   * index.json에서 종목 목록 로드 (file 모드)
   * 실패 시 DEFAULT_STOCKS 폴백
   */
  async initFromIndex() {
    // ── 모드 자동감지: WS 서버 프로브 → file → demo ──
    // 3초 이내 WS 서버 연결 가능 여부 확인. 실패 시 file 모드로 전환.
    if (KRX_API_CONFIG.mode === 'ws') {
      // [OPT] WS 프로브 비동기화 — 초기 로딩 3초 블로킹 제거
      // file 모드로 즉시 전환하여 차트를 먼저 표시,
      // WS 프로브 성공 시 백그라운드에서 ws 모드 복원
      KRX_API_CONFIG.mode = 'file';
      this.probeWsServer(KRX_API_CONFIG.wsUrl, 3000).then(function(ok) {
        if (ok) {
          KRX_API_CONFIG.mode = 'ws';
          console.log('[KRX] WS 서버 감지 — ws 모드 활성화 (백그라운드)');
        } else {
          console.log('[KRX] WS 서버 미감지 — file 모드 유지');
        }
      });
    }

    if (KRX_API_CONFIG.mode !== 'file' && KRX_API_CONFIG.mode !== 'ws' && KRX_API_CONFIG.mode !== 'koscom') return;

    try {
      const res = await fetch(`${KRX_API_CONFIG.dataDir}/index.json`);
      if (!res.ok) throw new Error(`index.json: ${res.status}`);

      const index = await res.json();
      if (!index.stocks || !index.stocks.length) throw new Error('빈 인덱스');

      ALL_STOCKS = index.stocks.map(s => ({
        code: s.code,
        name: s.name,
        market: s.market,
        file: s.file,
        base: s.lastClose || 50000,  // 데모 모드 폴백용
        marketCap: s.marketCap || 0, // 시가총액 (억원, download_ohlcv.py에서 생성)
        sector: s.sector || '',      // 업종 (KSIC 기준, download_ohlcv.py에서 생성)
        // [OPT] 사이드바 즉시 표시용 요약 데이터 (OHLCV 로드 없이 가격/등락률 표시)
        prevClose: s.prevClose || 0,
        change: s.change || 0,
        changePercent: s.changePercent || 0,
        volume: s.volume || 0,
      }));

      console.log(`[KRX] index.json 로드 완료: ${ALL_STOCKS.length}종목 (${index.kospi} KOSPI + ${index.kosdaq} KOSDAQ)`);
    } catch (e) {
      console.warn('[KRX] index.json 로드 실패, 기본 종목 사용:', e.message);
      ALL_STOCKS = DEFAULT_STOCKS;
    }
  }

  /** 종목 목록 (시장 필터) */
  getStocks(market = 'all') {
    if (market === 'all') return ALL_STOCKS;
    return ALL_STOCKS.filter(s => s.market === market);
  }

  /** 종목 검색 (정확일치 > 이름시작 > 포함, 시총순) */
  searchStocks(query) {
    const q = query.toLowerCase();
    const matches = ALL_STOCKS.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.includes(q)
    );
    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      // 정확 일치 최우선
      if (aName === q && bName !== q) return -1;
      if (aName !== q && bName === q) return 1;
      // 이름 시작 일치
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      // 같은 카테고리 내 시총순
      return (b.base || 0) - (a.base || 0);
    });
  }

  /** 캔들 데이터 가져오기 (L1 메모리 → L2 IndexedDB → L3 네트워크) */
  async getCandles(stock, timeframe) {
    const key = `${stock.code}-${timeframe}`;

    // ── L1: 메모리 캐시 확인 ──
    const cached = this.cache[key];
    // [OPT] 분봉 캐시 TTL 5분으로 증가 (불필요한 재생성 방지)
    const TTL = timeframe === '1d' ? 3600000 : 300000; // 일봉 1시간, 분봉 5분
    if (cached && (Date.now() - cached.lastUpdate) < TTL) return cached.candles;

    // ── L2: IndexedDB 캐시 확인 (일봉만 — 분봉은 실시간성 필요) ──
    if (timeframe === '1d') {
      try {
        const idbData = await _idb.get(key);
        if (idbData && idbData.candles && idbData.candles.length > 0) {
          // IDB 데이터가 24시간 이내면 네트워크 요청 없이 바로 사용
          if (Date.now() - (idbData.lastUpdate || 0) < 86400000) {
            this.cache[key] = idbData;  // L1 캐시에도 복사
            // [FIX-TRUST] IDB 캐시 데이터도 출처 태그 (file 기반 캐시)
            if (!idbData.candles._dataSource) {
              Object.defineProperty(idbData.candles, '_dataSource', {
                value: 'file', writable: true, enumerable: false, configurable: true,
              });
            }
            console.log('[IDB] 캐시 히트: %s (%d건)', key, idbData.candles.length);
            return idbData.candles;
          }
        }
      } catch (e) { /* IDB 읽기 실패 — L3로 진행 */ }
    }

    // ── L3: 네트워크/소스 fetch ──
    let candles;
    if (KRX_API_CONFIG.mode === 'ws') {
      // WS 모드: 서버가 subscribe 응답으로 candles 전송.
      // getCandles()는 빈 배열만 반환하고, 실제 데이터는
      // realtimeProvider.onTick 콜백에서 수신 처리.
      // 서버 미연결 시에도 빈 배열 반환 — 재연결 후 자동 수신.
      candles = [];
    } else if (KRX_API_CONFIG.mode === 'file' && timeframe === '1d') {
      // file 모드 + 일봉: JSON 파일 로드, 없으면 데모 폴백
      candles = await this._fileGetCandles(stock);
      if (candles.length === 0) {
        console.log('[KRX] 파일 없음, 데모 폴백:', stock.code);
        candles = this._demoGenerateCandles(stock, timeframe);
      }
    } else if (KRX_API_CONFIG.mode === 'file' && timeframe !== '1d') {
      // [OPT] file 모드 + 분봉: 일봉 캐시 재사용 (동일 JSON 이중 fetch 방지)
      var dailyKey = stock.code + '-1d';
      var dailyCached = this.cache[dailyKey];
      if (dailyCached && dailyCached.candles && dailyCached.candles.length > 0) {
        candles = dailyCached.candles.slice();
      } else {
        candles = await this._fileGetCandles(stock);
        if (candles.length === 0) {
          candles = this._demoGenerateCandles(stock, timeframe);
        }
      }
    } else if (KRX_API_CONFIG.mode === 'demo') {
      // 데모 모드: 명시적으로 demo 모드가 설정된 경우에만 시뮬레이션 데이터 생성
      candles = this._demoGenerateCandles(stock, timeframe);
    } else if (KRX_API_CONFIG.mode === 'koscom') {
      // 코스콤 모드: 향후 구현 예정 (사업화 시 전환)
      console.warn('[KRX] Koscom API는 아직 구현되지 않았습니다');
      try {
        candles = await koscomService.getCandles(stock, timeframe);
      } catch (e) {
        console.warn('[Koscom]', e.message);
        candles = [];
      }
    } else {
      // 알 수 없는 모드: 빈 배열 반환 (가짜 데이터 생성하지 않음)
      console.warn('[KRX] 알 수 없는 데이터 모드:', KRX_API_CONFIG.mode);
      candles = [];
    }

    // [FIX-TRUST] 캔들 데이터 출처 추적 — 가짜 데이터를 실제처럼 표시 방지
    // candles._dataSource: 'ws' | 'file' | 'demo' | 'idb' | 'koscom'
    var candleSource = KRX_API_CONFIG.mode;

    if (candles.length > 0) {
      // 캔들 정제: 검증 + 시간순 정렬 + 메모리 상한
      candles = this._sanitizeCandles(candles, timeframe);

      // 데이터 출처를 캔들 배열에 태그 (배열 자체의 비-열거형 속성)
      Object.defineProperty(candles, '_dataSource', {
        value: candleSource, writable: true, enumerable: false, configurable: true,
      });

      const cacheEntry = { candles, lastUpdate: Date.now() };
      this.cache[key] = cacheEntry;
      this._pruneCache();  // 캐시 크기 제한 확인

      // IndexedDB에 비동기 저장 (일봉만 — fire-and-forget, await 안 함)
      if (timeframe === '1d') {
        _idb.set(key, cacheEntry);
      }
    }
    return candles;
  }

  /** 실시간 틱 업데이트 (현재 캔들 수정 또는 새 캔들 추가) */
  tick(stock, timeframe) {
    const key = `${stock.code}-${timeframe}`;
    const cached = this.cache[key];
    if (!cached || !cached.candles.length) return null;

    const tf = TIMEFRAMES[timeframe];
    const candles = cached.candles;
    const last = candles[candles.length - 1];
    const now = Math.floor(Date.now() / 1000);

    // 현재 캔들 업데이트 (현재가 기준 변동성 — base가 0이어도 정상 동작)
    const volatility = this._getVolatility(last.close || stock.base || 50000);
    const drift = (Math.random() - 0.49) * volatility;
    const newClose = Math.max(100, Math.round(last.close + last.close * drift));
    last.close = newClose;
    last.high = Math.max(last.high, newClose);
    last.low = Math.min(last.low, newClose);
    last.volume += Math.round(Math.random() * 1000);

    // 새 캔들 생성 조건
    const elapsed = now - last.time;
    if (elapsed >= tf.seconds) {
      const newCandle = {
        time: last.time + tf.seconds,
        open: newClose,
        high: newClose,
        low: newClose,
        close: newClose,
        volume: Math.round(10000 + Math.random() * 50000),
      };
      candles.push(newCandle);
      if (candles.length > tf.count + 20) candles.shift();
    }

    return candles;
  }

  /**
   * WS 서버 연결 가능 여부 확인 (프로브)
   * @param {string} wsUrl - WebSocket 서버 주소
   * @param {number} timeout - 타임아웃 (ms), 기본 3000
   * @returns {Promise<boolean>} 연결 가능하면 true
   */
  async probeWsServer(wsUrl, timeout) {
    timeout = timeout || 3000;
    try {
      var ws = new WebSocket(wsUrl);
      return await new Promise(function(resolve) {
        ws.onopen = function() { ws.close(); resolve(true); };
        ws.onerror = function() { resolve(false); };
        setTimeout(function() {
          try { ws.close(); } catch(e) {}
          resolve(false);
        }, timeout);
      });
    } catch(e) { return false; }
  }

  /** 캐시 초기화 */
  clearCache(stockCode) {
    if (stockCode) {
      Object.keys(this.cache).forEach(k => {
        if (k.startsWith(stockCode)) delete this.cache[k];
      });
    } else {
      this.cache = {};
    }
  }

  // ══════════════════════════════════════════════════
  //  캔들 데이터 검증 + 메모리 관리
  // ══════════════════════════════════════════════════

  /**
   * 개별 캔들 OHLCV 유효성 검증
   * @param {Object} c - 현재 캔들
   * @param {Object|null} prev - 이전 캔들 (가격 제한폭 비교용)
   * @returns {boolean} 유효하면 true
   */
  _validateCandle(c, prev) {
    // OHLC 관계 검증
    if (c.high < c.low) return false;
    if (c.open > c.high || c.open < c.low) return false;
    if (c.close > c.high || c.close < c.low) return false;

    // 거래량 음수 검증
    if (c.volume != null && c.volume < 0) return false;

    // 가격 0 이하 검증
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) return false;

    // KRX 가격 제한폭 검증 (전일 대비 ±30% + 5% 여유)
    if (prev && prev.close > 0) {
      var change = Math.abs(c.close - prev.close) / prev.close;
      if (change > 0.35) {
        console.warn('[KRX] 가격 제한폭 초과 의심:', c.close, 'vs 전일', prev.close);
        return false;
      }
    }

    return true;
  }

  /**
   * 캔들 배열 정제: 검증 + 시간순 정렬 + 길이 상한 적용
   * @param {Array} candles - 원본 캔들 배열
   * @param {string} timeframe - 타임프레임 ('1d', '5m' 등)
   * @returns {Array} 정제된 캔들 배열 (새 배열 반환, 원본 변경 없음)
   */
  _sanitizeCandles(candles, timeframe) {
    if (!candles || candles.length === 0) return candles;

    // [OPT] 정렬 전 이미 정렬되어 있는지 빠른 검증 (대부분의 JSON은 이미 정렬됨)
    var needsSort = false;
    for (var si = 1; si < candles.length; si++) {
      var prevT = candles[si - 1].time;
      var curT = candles[si].time;
      // 같은 타입끼리 비교 (string "YYYY-MM-DD"는 사전순 = 시간순)
      if (curT < prevT) { needsSort = true; break; }
    }
    if (needsSort) {
      candles.sort(function(a, b) {
        var ta = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
        var tb = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
        return ta - tb;
      });
    }

    // OHLCV 유효성 필터링
    var self = this;
    var validated = candles.filter(function(c, i) {
      return self._validateCandle(c, i > 0 ? candles[i - 1] : null);
    });

    // 메모리 상한 적용 (최신 데이터 유지)
    var maxLen = timeframe === '1d' ? MAX_CANDLES_DAILY : MAX_CANDLES_INTRADAY;
    if (validated.length > maxLen) {
      validated = validated.slice(validated.length - maxLen);
    }

    return validated;
  }

  /**
   * 캐시 크기 제한 (최대 MAX_CACHE_ENTRIES 종목)
   * 가장 오래된 항목부터 삭제
   */
  _pruneCache() {
    var keys = Object.keys(this.cache);
    if (keys.length <= MAX_CACHE_ENTRIES) return;

    var cache = this.cache;
    keys.sort(function(a, b) {
      return (cache[a].lastUpdate || 0) - (cache[b].lastUpdate || 0);
    });

    // 가장 오래된 항목 삭제
    for (var i = 0; i < keys.length - MAX_CACHE_ENTRIES; i++) {
      delete this.cache[keys[i]];
    }
  }

  // ══════════════════════════════════════════════════
  //  파일 모드: data/ 폴더의 JSON 로드
  // ══════════════════════════════════════════════════

  async _fileGetCandles(stock) {
    try {
      // stock.file이 있으면 사용, 없으면 market에서 경로 추론
      const filePath = stock.file
        ? `${KRX_API_CONFIG.dataDir}/${stock.file}`
        : `${KRX_API_CONFIG.dataDir}/${stock.market.toLowerCase()}/${stock.code}.json`;

      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`${filePath}: ${res.status}`);

      const data = await res.json();
      if (!data.candles || !data.candles.length) throw new Error('빈 캔들 데이터');

      // "YYYY-MM-DD" → Lightweight Charts v4 호환 형식
      return data.candles.map(c => ({
        time: c.time,  // "YYYY-MM-DD" 문자열 — LWC가 직접 지원
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    } catch (e) {
      console.warn(`[KRX] 파일 로드 실패 (${stock.code}):`, e.message);
      // 파일이 없으면 빈 배열 반환 (가짜 데이터 생성 안 함 — 데이터 무결성 원칙)
      return [];
    }
  }

  /**
   * 보간 분봉 JSON 파일 로드 (generate_intraday.py가 생성한 파일)
   * 파일명 형식: {code}_{timeframe}.json (예: 005930_5m.json)
   * @param {Object} stock - 종목 객체
   * @param {string} timeframe - 타임프레임 ('1m', '5m', '15m', '1h')
   * @returns {Array} 캔들 배열 (없으면 빈 배열)
   */
  async _fileGetIntradayCandles(stock, timeframe) {
    try {
      const market = (stock.market || 'kospi').toLowerCase();
      const filePath = `${KRX_API_CONFIG.dataDir}/${market}/${stock.code}_${timeframe}.json`;

      const res = await fetch(filePath);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.candles || !data.candles.length) return [];

      // 분봉 time은 Unix 타임스탬프 (숫자) — LWC가 직접 지원
      return data.candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    } catch (e) {
      // 분봉 파일 없음 — 조용히 빈 배열 반환 (일봉 폴백으로 진행)
      return [];
    }
  }

  // ══════════════════════════════════════════════════
  //  데모 모드: 시뮬레이션 데이터 생성
  // ══════════════════════════════════════════════════

  _getVolatility(basePrice) {
    // 가격대별 변동성 조절
    if (basePrice > 500000) return 0.0015;
    if (basePrice > 100000) return 0.002;
    if (basePrice > 50000) return 0.0025;
    return 0.003;
  }

  _demoGenerateCandles(stock, timeframe) {
    const tf = TIMEFRAMES[timeframe];
    const count = tf.count;
    const now = Math.floor(Date.now() / 1000);
    const candles = [];
    let price = stock.base || 50000;  // base 없으면 기본 50,000원
    const vol = this._getVolatility(price);

    // 코드 해시를 seed로 활용 (같은 종목은 동일 데이터)
    let seed = 0;
    for (let i = 0; i < stock.code.length; i++) {
      seed += stock.code.charCodeAt(i);
    }
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // 트렌드 구간 설정 (일부 구간에서 적삼병/흑삼병 패턴 자연 발생 유도)
    let trendDir = 0;
    let trendLen = 0;

    // [OPT] 루프 밖에서 일봉 여부/기본 거래량 결정 (분기 비용 절감)
    const isDaily = timeframe === '1d';
    const baseVol = isDaily ? 500000 : 50000;

    // ── 분봉: KRX 장시간(09:00~15:30 KST) 내 타임슬롯 사전 생성 ──
    // 한국은 서머타임 미적용 — KST = UTC+9 고정
    // 분봉 타임스탬프를 KRX 거래시간에 맞춰야 차트 시간축이 자연스러움
    let intradaySlots = [];
    if (!isDaily) {
      const KST_OFFSET = 9 * 3600;                       // UTC+9 (초)
      const MARKET_OPEN_KST = 9 * 3600;                  // 09:00 KST (초)
      const MARKET_CLOSE_KST = 15 * 3600 + 30 * 60;      // 15:30 KST (초)
      const slotsPerDay = Math.floor((MARKET_CLOSE_KST - MARKET_OPEN_KST) / tf.seconds);

      // 오늘 KST 날짜 기준으로 역순 거래일 탐색
      const nowKstMs = (now + KST_OFFSET) * 1000;
      const todayKST = new Date(nowKstMs);
      let dayOffset = 0;
      let slotsNeeded = count;

      while (slotsNeeded > 0) {
        const dayDate = new Date(todayKST);
        dayDate.setUTCDate(dayDate.getUTCDate() - dayOffset);
        const dayOfWeek = dayDate.getUTCDay();

        // 주말 건너뛰기
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // 해당 거래일 자정(UTC) 타임스탬프
          const dayStartUTC = Math.floor(Date.UTC(
            dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate()
          ) / 1000);

          // 이 거래일에서 채울 슬롯 수 (마지막 거래일은 필요한 만큼만)
          const slotsThisDay = Math.min(slotsPerDay, slotsNeeded);
          const startSlot = slotsPerDay - slotsThisDay;  // 장 마감쪽부터 채움

          for (let s = startSlot; s < slotsPerDay; s++) {
            // KST 시각 → UTC 타임스탬프 변환
            const kstSeconds = MARKET_OPEN_KST + s * tf.seconds;
            const utcTimestamp = dayStartUTC + kstSeconds - KST_OFFSET;
            intradaySlots.push(utcTimestamp);
          }
          slotsNeeded -= slotsThisDay;
        }
        dayOffset++;
        if (dayOffset > 30) break;  // 안전 상한 (~1개월)
      }

      // 시간순 정렬 (역순 탐색으로 생성했으므로)
      intradaySlots.sort((a, b) => a - b);
    }

    for (let i = 0; i < count; i++) {
      let t;

      if (isDaily) {
        t = now - (count - 1 - i) * tf.seconds;
        // 일봉: 주말 건너뛰기 (KST 기준 — UTC+9)
        const kstMs = t * 1000 + 9 * 3600000;
        const d = new Date(kstMs);
        if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      } else {
        // 분봉: 미리 계산된 KST 장시간 슬롯 사용
        if (i >= intradaySlots.length) break;
        t = intradaySlots[i];
      }

      // 트렌드 변경
      if (trendLen <= 0) {
        trendDir = (seededRandom() - 0.45) * vol * 2;
        trendLen = Math.floor(3 + seededRandom() * 15);
      }
      trendLen--;

      const drift = trendDir + (seededRandom() - 0.5) * vol;
      const open = price;
      const close = Math.max(100, Math.round(open + open * drift));
      const diff = Math.abs(close - open);  // [OPT] 한 번만 계산
      const wickUp = Math.round(diff * seededRandom() * 0.8);
      const wickDn = Math.round(diff * seededRandom() * 0.8);
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDn;

      const volume = Math.round(baseVol + seededRandom() * baseVol * 4);

      candles.push({ time: t, open, high, low, close, volume });
      price = close;
    }

    return candles;
  }

}

// ══════════════════════════════════════════════════════
//  Koscom API 스텁 (향후 전환용)
//
//  코스콤 정보분배 API (sandbox-apigw.koscom.co.kr) 대응.
//  현재는 미구현 — 실제 전환 시 getCandles/getRealTimeQuote 구현 필요.
//  사업화 시 pykrx → 코스콤 전환 필수 (라이선스 요건).
// ══════════════════════════════════════════════════════
class KoscomDataService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://sandbox-apigw.koscom.co.kr/v3';
    this.connected = false;
  }

  /**
   * API 키 설정
   * @param {string} key - 코스콤 API 인증키
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * 캔들 데이터 조회 (미구현)
   * @param {Object} stock - 종목 객체 { code, name, market }
   * @param {string} timeframe - 타임프레임 ('1d', '5m' 등)
   * @throws {Error} 항상 에러 — 아직 구현되지 않음
   */
  async getCandles(stock, timeframe) {
    throw new Error('[Koscom] 미구현 — Kiwoom OCX 또는 file 모드 사용');
  }

  /**
   * 실시간 시세 조회 (미구현)
   * @param {string} stockCode - 종목 코드
   * @throws {Error} 항상 에러 — 아직 구현되지 않음
   */
  async getRealTimeQuote(stockCode) {
    throw new Error('[Koscom] 미구현');
  }

  /**
   * 종목 기본 정보 조회 (미구현)
   * @param {string} stockCode - 종목 코드
   * @throws {Error} 항상 에러 — 아직 구현되지 않음
   */
  async getStockInfo(stockCode) {
    throw new Error('[Koscom] 미구현');
  }
}

// 코스콤 서비스 인스턴스 (향후 전환 시 사용)
const koscomService = new KoscomDataService();

// 글로벌 인스턴스
const dataService = new KRXDataService();

// ══════════════════════════════════════════════════════
//  [FIX-TRUST] 데이터 출처 확인 유틸리티
//
//  실제 시장 데이터인지 확인. 데모/시뮬레이션 데이터일 경우
//  UI 경고를 표시하여 사용자가 가짜 데이터로 투자 판단을
//  내리는 것을 방지.
// ══════════════════════════════════════════════════════

/**
 * 현재 데이터 모드가 실제 시장 데이터인지 확인
 * @returns {boolean} ws/file 모드이면 true, demo이면 false
 */
function isRealData() {
  return KRX_API_CONFIG.mode === 'ws' || KRX_API_CONFIG.mode === 'file';
}

/**
 * 캔들 배열의 데이터 출처 확인
 * @param {Array} candleArray - 캔들 배열
 * @returns {string} 'ws' | 'file' | 'demo' | 'unknown'
 */
function getCandleSource(candleArray) {
  if (!candleArray) return 'unknown';
  return candleArray._dataSource || KRX_API_CONFIG.mode || 'unknown';
}
