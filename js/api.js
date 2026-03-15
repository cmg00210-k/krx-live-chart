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

const KRX_API_CONFIG = {
  mode: 'ws',     // 'ws' | 'file' | 'demo' (향후 'koscom' 추가)
  wsUrl: 'ws://localhost:8765',  // WebSocket 서버 주소 (Kiwoom OCX)
  dataDir: 'data', // file 모드에서 JSON 파일 경로
};

// ── 기본 종목 목록 (index.json 로드 전 폴백) ──────────
const DEFAULT_STOCKS = [
  // ═══ KOSPI 대형주 ═══
  { code: '005930', name: '삼성전자',       market: 'KOSPI', base: 73400 },
  { code: '000660', name: 'SK하이닉스',     market: 'KOSPI', base: 182000 },
  { code: '005380', name: '현대차',         market: 'KOSPI', base: 218000 },
  { code: '000270', name: '기아',           market: 'KOSPI', base: 95200 },
  { code: '005490', name: 'POSCO홀딩스',    market: 'KOSPI', base: 312000 },
  { code: '051910', name: 'LG화학',         market: 'KOSPI', base: 312000 },
  { code: '006400', name: '삼성SDI',        market: 'KOSPI', base: 289000 },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', base: 781000 },
  { code: '068270', name: '셀트리온',       market: 'KOSPI', base: 178000 },
  { code: '035420', name: 'NAVER',          market: 'KOSPI', base: 201500 },
  { code: '035720', name: '카카오',         market: 'KOSPI', base: 43500 },
  { code: '028260', name: '삼성물산',       market: 'KOSPI', base: 128000 },
  { code: '105560', name: 'KB금융',         market: 'KOSPI', base: 72800 },
  { code: '055550', name: '신한지주',       market: 'KOSPI', base: 45600 },
  { code: '003550', name: 'LG',             market: 'KOSPI', base: 78500 },
  { code: '066570', name: 'LG전자',         market: 'KOSPI', base: 98700 },
  { code: '012330', name: '현대모비스',     market: 'KOSPI', base: 215000 },
  { code: '034730', name: 'SK',             market: 'KOSPI', base: 162000 },
  { code: '015760', name: '한국전력',       market: 'KOSPI', base: 21500 },
  { code: '030200', name: 'KT',             market: 'KOSPI', base: 36200 },
  { code: '033780', name: 'KT&G',           market: 'KOSPI', base: 95300 },
  { code: '009150', name: '삼성전기',       market: 'KOSPI', base: 143000 },
  { code: '086790', name: '하나금융지주',   market: 'KOSPI', base: 56200 },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI', base: 152000 },
  { code: '032830', name: '삼성생명',       market: 'KOSPI', base: 82000 },
  { code: '003670', name: '포스코퓨처엠',   market: 'KOSPI', base: 215000 },
  { code: '096770', name: 'SK이노베이션',   market: 'KOSPI', base: 105000 },
  { code: '010130', name: '고려아연',       market: 'KOSPI', base: 485000 },
  { code: '011200', name: 'HMM',            market: 'KOSPI', base: 18500 },
  { code: '034020', name: '두산에너빌리티', market: 'KOSPI', base: 17200 },
  { code: '005935', name: '삼성전자우',     market: 'KOSPI', base: 60500 },
  { code: '010950', name: 'S-Oil',          market: 'KOSPI', base: 62500 },
  { code: '011170', name: '롯데케미칼',     market: 'KOSPI', base: 82000 },
  { code: '017670', name: 'SK텔레콤',       market: 'KOSPI', base: 52800 },
  { code: '036570', name: '엔씨소프트',     market: 'KOSPI', base: 178000 },

  // ═══ KOSDAQ 대형주 ═══
  { code: '247540', name: '에코프로비엠',   market: 'KOSDAQ', base: 165000 },
  { code: '086520', name: '에코프로',       market: 'KOSDAQ', base: 58000 },
  { code: '196170', name: '알테오젠',       market: 'KOSDAQ', base: 82000 },
  { code: '058470', name: '리노공업',       market: 'KOSDAQ', base: 215000 },
  { code: '328130', name: '루닛',           market: 'KOSDAQ', base: 75000 },
  { code: '383220', name: 'F&F',            market: 'KOSDAQ', base: 62000 },
  { code: '357780', name: '솔브레인',       market: 'KOSDAQ', base: 275000 },
  { code: '145020', name: '휴젤',           market: 'KOSDAQ', base: 178000 },
  { code: '263750', name: '펄어비스',       market: 'KOSDAQ', base: 38500 },
  { code: '293490', name: '카카오게임즈',   market: 'KOSDAQ', base: 18200 },
  { code: '112040', name: '위메이드',       market: 'KOSDAQ', base: 35000 },
  { code: '041510', name: '에스엠',         market: 'KOSDAQ', base: 82000 },
  { code: '251270', name: '넷마블',         market: 'KOSDAQ', base: 52000 },
  { code: '067160', name: '아프리카TV',     market: 'KOSDAQ', base: 88000 },
  { code: '403870', name: 'HPSP',           market: 'KOSDAQ', base: 38000 },
  { code: '039030', name: '이오테크닉스',   market: 'KOSDAQ', base: 165000 },
  { code: '095340', name: 'ISC',            market: 'KOSDAQ', base: 58000 },
  { code: '141080', name: '레고켐바이오',   market: 'KOSDAQ', base: 52000 },
  { code: '377300', name: '카카오페이',     market: 'KOSDAQ', base: 32000 },
  { code: '035900', name: 'JYP Ent.',       market: 'KOSDAQ', base: 62000 },
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
    if (KRX_API_CONFIG.mode !== 'file' && KRX_API_CONFIG.mode !== 'ws') return;

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

  /** 종목 검색 */
  searchStocks(query) {
    const q = query.toLowerCase();
    return ALL_STOCKS.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.includes(q)
    );
  }

  /** 캔들 데이터 가져오기 (TTL 캐싱) */
  async getCandles(stock, timeframe) {
    const key = `${stock.code}-${timeframe}`;
    const cached = this.cache[key];
    const TTL = timeframe === '1d' ? 3600000 : 60000; // 일봉 1시간, 분봉 1분
    if (cached && (Date.now() - cached.lastUpdate) < TTL) return cached.candles;

    let candles;
    if (KRX_API_CONFIG.mode === 'ws') {
      // WS 모드: 서버가 subscribe 응답으로 candles 전송.
      // getCandles()는 빈 배열만 반환하고, 실제 데이터는
      // realtimeProvider.onTick 콜백에서 수신 처리.
      // 서버 미연결 + 분봉: Naver 시도 (CORS 허용 환경만), 실패 시 데모 폴백.
      if (timeframe !== '1d' && typeof realtimeProvider !== 'undefined' && !realtimeProvider.connected) {
        candles = await this._naverMinuteCandles(stock.code, timeframe);
        if (candles.length > 0) {
          console.log('[KRX] WS 미연결 — Naver 분봉 폴백: %s %s (%d건)', stock.code, timeframe, candles.length);
        } else {
          // Naver CORS 차단 또는 실패 → 데모 폴백
          candles = this._demoGenerateCandles(stock, timeframe);
          console.log('[KRX] WS 미연결 — 데모 분봉 폴백: %s %s', stock.code, timeframe);
        }
      } else {
        candles = [];
      }
    } else if (KRX_API_CONFIG.mode === 'file' && timeframe === '1d') {
      candles = await this._fileGetCandles(stock);
    } else if (KRX_API_CONFIG.mode === 'file' && timeframe !== '1d') {
      // file 모드 + 분봉: Naver Finance API 시도 (CORS 허용 환경만), 실패 시 데모
      candles = await this._naverMinuteCandles(stock.code, timeframe);
      if (candles.length > 0) {
        console.log('[KRX] file 모드 — Naver 분봉 로드: %s %s (%d건)', stock.code, timeframe, candles.length);
      } else {
        // Naver CORS 차단 또는 실패 → 데모 폴백
        candles = this._demoGenerateCandles(stock, timeframe);
      }
    } else {
      candles = this._demoGenerateCandles(stock, timeframe);
    }

    if (candles.length > 0) {
      this.cache[key] = { candles, lastUpdate: Date.now() };
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

    // 현재 캔들 업데이트
    const volatility = this._getVolatility(stock.base);
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
      // 파일이 없으면 데모 데이터로 폴백
      return this._demoGenerateCandles(stock, '1d');
    }
  }

  // ══════════════════════════════════════════════════
  //  Naver Finance API: 분봉 데이터 (장외/서버 미연결 폴백)
  //
  //  엔드포인트:
  //    https://api.stock.naver.com/chart/domestic/item/{code}/minute    (1분)
  //    https://api.stock.naver.com/chart/domestic/item/{code}/minute5   (5분)
  //    https://api.stock.naver.com/chart/domestic/item/{code}/minute15  (15분)
  //    https://api.stock.naver.com/chart/domestic/item/{code}/minute30  (30분)
  //    https://api.stock.naver.com/chart/domestic/item/{code}/minute60  (60분)
  //
  //  응답: [{localDateTime, currentPrice, openPrice, highPrice,
  //          lowPrice, accumulatedTradingVolume}, ...]
  // ══════════════════════════════════════════════════

  /**
   * CORS 차단 여부 감지.
   * file:// 프로토콜에서는 Origin 헤더가 없어 Naver API 정상 동작.
   * http://localhost (VS Code Live Server 등)에서는 CORS 차단.
   */
  _isNaverCorsBlocked() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  async _naverMinuteCandles(code, timeframe) {
    // CORS 차단 환경이면 시도하지 않고 빈 배열 반환 (호출측에서 폴백 처리)
    if (this._isNaverCorsBlocked()) {
      console.log('[KRX] Naver 분봉 스킵 (CORS 차단 환경: %s)', location.protocol);
      return [];
    }

    const pathMap = {
      '1m': 'minute', '3m': 'minute3', '5m': 'minute5',
      '10m': 'minute10', '15m': 'minute15',
      '30m': 'minute30', '1h': 'minute60',
    };
    const path = pathMap[timeframe] || 'minute';

    // 분봉 간격 (초) — LWC 타임스탬프 정렬용
    const intervalSec = {
      '1m': 60, '3m': 180, '5m': 300, '10m': 600,
      '15m': 900, '30m': 1800, '1h': 3600,
    }[timeframe] || 60;

    try {
      // Naver API 호출
      // - file:// 프로토콜: CORS 무관, 정상 동작
      // - http://localhost (Live Server): CORS 차단 → _isNaverCorsBlocked()에서 사전 차단
      // count=120: TIMEFRAMES[tf].count와 일치 (차트에 충분한 봉 표시)
      const naverUrl = `https://api.stock.naver.com/chart/domestic/item/${code}/${path}?count=120`;
      const res = await fetch(naverUrl);
      if (!res.ok) throw new Error(`Naver API: ${res.status}`);

      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('빈 응답');

      const candles = [];
      const seen = new Set();  // 중복 timestamp 방지

      for (const item of raw) {
        const dtStr = item.localDateTime || '';
        if (dtStr.length < 12) continue;

        // "20260313090000" → Date → unix timestamp (봉 시작 정렬)
        const year = parseInt(dtStr.substring(0, 4));
        const month = parseInt(dtStr.substring(4, 6)) - 1;
        const day = parseInt(dtStr.substring(6, 8));
        const hour = parseInt(dtStr.substring(8, 10));
        const min = parseInt(dtStr.substring(10, 12));
        const sec = parseInt(dtStr.substring(12, 14) || '0');

        const dt = new Date(year, month, day, hour, min, sec);
        let ts = Math.floor(dt.getTime() / 1000);
        ts = Math.floor(ts / intervalSec) * intervalSec;  // 봉 시작 기준 정렬

        if (seen.has(ts)) continue;
        seen.add(ts);

        const c = Math.round(item.currentPrice || 0);
        const o = Math.round(item.openPrice || c);
        const h = Math.round(item.highPrice || c);
        const l = Math.round(item.lowPrice || c);
        const v = Math.round(item.accumulatedTradingVolume || 0);

        if (c === 0) continue;

        candles.push({
          time: ts,
          open: o > 0 ? o : c,
          high: h > 0 ? h : c,
          low: l > 0 ? l : c,
          close: c,
          volume: v,
        });
      }

      // 시간순 정렬
      candles.sort((a, b) => a.time - b.time);
      return candles;

    } catch (e) {
      console.warn(`[KRX] Naver 분봉 로드 실패 (${code} ${timeframe}):`, e.message);
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
    let price = stock.base;
    const vol = this._getVolatility(stock.base);

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

    for (let i = 0; i < count; i++) {
      const t = now - (count - 1 - i) * tf.seconds;

      // 일봉: 주말 건너뛰기
      if (timeframe === '1d') {
        const d = new Date(t * 1000);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
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
      const wickUp = Math.round(Math.abs(close - open) * seededRandom() * 0.8);
      const wickDn = Math.round(Math.abs(close - open) * seededRandom() * 0.8);
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDn;

      const baseVol = timeframe === '1d' ? 500000 : 50000;
      const volume = Math.round(baseVol + seededRandom() * baseVol * 4);

      candles.push({ time: t, open, high, low, close, volume });
      price = close;
    }

    return candles;
  }

}

// 글로벌 인스턴스
const dataService = new KRXDataService();
