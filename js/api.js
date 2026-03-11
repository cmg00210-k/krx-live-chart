// ══════════════════════════════════════════════════════
//  KRX 데이터 서비스 — 종목 목록 + API 연동 + 데모 모드
// ══════════════════════════════════════════════════════
//
//  사용법:
//  1. 데모 모드 (기본): 시뮬레이션 데이터로 즉시 실행
//  2. 한국투자증권 OpenAPI 연동:
//     - https://apiportal.koreainvestment.com 에서 계정 등록
//     - APP_KEY, APP_SECRET 발급
//     - KRX_API_CONFIG.mode = 'kis' 로 변경
//     - CORS 이슈로 백엔드 프록시 필요
//        (Node.js 프록시 예시: server/proxy.js 참고)
//
// ══════════════════════════════════════════════════════

const KRX_API_CONFIG = {
  mode: 'demo',   // 'demo' | 'kis'
  kis: {
    appKey: '',
    appSecret: '',
    baseUrl: '/api',  // 프록시 서버 주소
  }
};

// ── 전체 종목 목록 (KOSPI + KOSDAQ 주요 종목) ──────────
const ALL_STOCKS = [
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
    this.kisToken = null;
    this.kisTokenExpiry = 0;
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

  /** 캔들 데이터 가져오기 (자동 캐싱) */
  async getCandles(stock, timeframe) {
    const key = `${stock.code}-${timeframe}`;
    if (this.cache[key]) return this.cache[key].candles;

    let candles;
    if (KRX_API_CONFIG.mode === 'kis') {
      candles = await this._kisGetCandles(stock, timeframe);
    } else {
      candles = this._demoGenerateCandles(stock, timeframe);
    }

    this.cache[key] = { candles, lastUpdate: Date.now() };
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

  // ══════════════════════════════════════════════════
  //  한국투자증권 OpenAPI 연동
  //  (CORS 이슈로 백엔드 프록시 경유 필요)
  // ══════════════════════════════════════════════════

  async _kisAuth() {
    if (this.kisToken && Date.now() < this.kisTokenExpiry) return;

    const res = await fetch(`${KRX_API_CONFIG.kis.baseUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: KRX_API_CONFIG.kis.appKey,
        appsecret: KRX_API_CONFIG.kis.appSecret,
      }),
    });

    const data = await res.json();
    this.kisToken = data.access_token;
    this.kisTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  async _kisGetCandles(stock, timeframe) {
    await this._kisAuth();

    // 분봉 조회 (1분/5분/15분/30분/1시간)
    if (timeframe !== '1d') {
      const tfMap = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60' };
      const res = await fetch(
        `${KRX_API_CONFIG.kis.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice?` +
        new URLSearchParams({
          FID_ETC_CLS_CODE: '',
          FID_COND_MRKT_DIV_CODE: stock.market === 'KOSPI' ? 'J' : 'Q',
          FID_INPUT_ISCD: stock.code,
          FID_INPUT_HOUR_1: tfMap[timeframe] || '1',
          FID_PW_DATA_INCU_YN: 'Y',
        }),
        {
          headers: {
            'Authorization': `Bearer ${this.kisToken}`,
            'appkey': KRX_API_CONFIG.kis.appKey,
            'appsecret': KRX_API_CONFIG.kis.appSecret,
            'tr_id': 'FHKST03010200',
          },
        }
      );

      const data = await res.json();
      if (!data.output2) return this._demoGenerateCandles(stock, timeframe);

      return data.output2.reverse().map(item => ({
        time: this._parseKISTime(item.stck_cntg_hour, item.stck_bsop_date),
        open: Number(item.stck_oprc),
        high: Number(item.stck_hgpr),
        low: Number(item.stck_lwpr),
        close: Number(item.stck_prpr),
        volume: Number(item.cntg_vol),
      }));
    }

    // 일봉 조회
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 300);
    const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');

    const res = await fetch(
      `${KRX_API_CONFIG.kis.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?` +
      new URLSearchParams({
        FID_COND_MRKT_DIV_CODE: stock.market === 'KOSPI' ? 'J' : 'Q',
        FID_INPUT_ISCD: stock.code,
        FID_INPUT_DATE_1: fmt(startDate),
        FID_INPUT_DATE_2: fmt(today),
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0',
      }),
      {
        headers: {
          'Authorization': `Bearer ${this.kisToken}`,
          'appkey': KRX_API_CONFIG.kis.appKey,
          'appsecret': KRX_API_CONFIG.kis.appSecret,
          'tr_id': 'FHKST03010100',
        },
      }
    );

    const data = await res.json();
    if (!data.output2) return this._demoGenerateCandles(stock, timeframe);

    return data.output2.reverse().map(item => ({
      time: this._parseDateToUnix(item.stck_bsop_date),
      open: Number(item.stck_oprc),
      high: Number(item.stck_hgpr),
      low: Number(item.stck_lwpr),
      close: Number(item.stck_clpr),
      volume: Number(item.acml_vol),
    }));
  }

  _parseKISTime(hour, date) {
    // hour: 'HHmmss', date: 'YYYYMMDD'
    const y = date.slice(0, 4), m = date.slice(4, 6), d = date.slice(6, 8);
    const hh = hour.slice(0, 2), mm = hour.slice(2, 4);
    return Math.floor(new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`).getTime() / 1000);
  }

  _parseDateToUnix(dateStr) {
    const y = dateStr.slice(0, 4), m = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
    return Math.floor(new Date(`${y}-${m}-${d}T09:00:00+09:00`).getTime() / 1000);
  }
}

// 글로벌 인스턴스
const dataService = new KRXDataService();
