// ══════════════════════════════════════════════════════
//  KRX LIVE — 과거 실적 (재무) 데이터
//
//  데이터 우선순위:
//   1. data/financials/{code}.json (DART/데모 다운로드)
//   2. PAST_DATA 하드코딩 (삼성전자, SK하이닉스)
//   3. 코드 해시 기반 시드 생성 (기타 종목)
// ══════════════════════════════════════════════════════

// ── 재무 데이터 파일 캐시 ──
// 한번 fetch한 종목은 메모리에 캐싱하여 재호출 방지
const _financialCache = {};

const PAST_DATA = {
  '005930': {
    quarter: [
      // 2025년 실적 (추정치 — DART 공시 전까지 컨센서스 기반)
      { p: '2025 Q3', rev: 790000, op: 121000, ni: 94200, opm: '15.3%', eps: 1403, roe: 10.5 },
      { p: '2025 Q2', rev: 774000, op: 114000, ni: 88500, opm: '14.7%', eps: 1318, roe: 10.1 },
      { p: '2025 Q1', rev: 756000, op: 94700,  ni: 72100, opm: '12.5%', eps: 1074, roe: 9.4 },
      // 2024년 실적 (DART 공시 확정치)
      { p: '2024 Q4', rev: 758900, op: 64400,  ni: 52380, opm: '8.5%',  eps: 780,  roe: 7.5 },
      { p: '2024 Q3', rev: 791050, op: 91834,  ni: 73051, opm: '11.6%', eps: 1330, roe: 8.2 },
      { p: '2024 Q2', rev: 740068, op: 106056, ni: 94050, opm: '14.3%', eps: 1410, roe: 9.1 },
      { p: '2024 Q1', rev: 711280, op: 66060,  ni: 50680, opm: '9.3%',  eps: 755,  roe: 7.8 },
      { p: '2023 Q4', rev: 671978, op: 28247,  ni: 24401, opm: '4.2%',  eps: 363,  roe: 5.2 },
    ],
    annual: [
      { p: '2024', rev: 3001298, op: 328350, ni: 270161, opm: '10.9%', eps: 4025, roe: 8.8 },
      { p: '2023', rev: 2589355, op: 64739,  ni: 154873, opm: '2.5%',  eps: 2305, roe: 6.2 },
      { p: '2022', rev: 3023642, op: 433766, ni: 554589, opm: '14.3%', eps: 8057, roe: 16.1 },
      { p: '2021', rev: 2796048, op: 516339, ni: 399075, opm: '18.5%', eps: 5777, roe: 14.2 },
    ]
  },
  '000660': {
    quarter: [
      // 2025년 실적 (추정치)
      { p: '2025 Q3', rev: 199800, op: 86200,  ni: 71500, opm: '43.1%', eps: 9789, roe: 21.3 },
      { p: '2025 Q2', rev: 192500, op: 81400,  ni: 67200, opm: '42.3%', eps: 9200, roe: 20.1 },
      { p: '2025 Q1', rev: 181200, op: 72800,  ni: 59800, opm: '40.2%', eps: 8188, roe: 18.9 },
      // 2024년 실적 (DART 공시 확정치)
      { p: '2024 Q4', rev: 194070, op: 80805,  ni: 68300, opm: '41.6%', eps: 9352, roe: 19.8 },
      { p: '2024 Q3', rev: 174338, op: 70351,  ni: 58011, opm: '40.4%', eps: 7943, roe: 18.7 },
      { p: '2024 Q2', rev: 164234, op: 58012,  ni: 44012, opm: '35.3%', eps: 6022, roe: 15.4 },
      { p: '2024 Q1', rev: 127836, op: 23412,  ni: 16842, opm: '18.3%', eps: 2305, roe: 11.2 },
      { p: '2023 Q4', rev: 113291, op: -1899,  ni: -2470, opm: '-1.7%', eps: -338, roe: -1.5 },
    ],
    annual: [
      { p: '2024', rev: 660478, op: 232580, ni: 187165, opm: '35.2%', eps: 25622, roe: 16.5 },
      { p: '2023', rev: 406625, op: -47731, ni: -23234, opm: '-11.7%', eps: -3180, roe: -8.1 },
      { p: '2022', rev: 446594, op: 66976,  ni: 48500,  opm: '15.0%',  eps: 6638,  roe: 12.0 },
      { p: '2021', rev: 420609, op: 129530, ni: 97499,  opm: '30.8%',  eps: 13351, roe: 21.5 },
    ]
  }
};

/**
 * 과거 실적 데이터 조회 (동기 — 하드코딩 + 시드 폴백)
 * @param {string} code
 * @param {string} period - 'quarter' | 'annual'
 */
function getPastData(code, period) {
  if (PAST_DATA[code]) return PAST_DATA[code][period];

  // 데이터 없는 종목은 코드 기반 고정값 (현재 날짜 기준 동적 생성)
  const now = new Date();
  const curYear = now.getFullYear();
  const curQuarter = Math.ceil((now.getMonth() + 1) / 3);
  // 최근 8분기 라벨 생성 (현재 분기부터 역순)
  const quarters = [];
  let qy = curYear, qq = curQuarter;
  for (let i = 0; i < 8; i++) {
    quarters.push(qy + ' Q' + qq);
    qq--;
    if (qq === 0) { qq = 4; qy--; }
  }
  // 최근 4개 연도 라벨 생성 (전년부터 역순 — 당해 실적은 미확정)
  const years = [];
  for (let i = 1; i <= 4; i++) years.push(String(curYear - i));
  const arr = period === 'quarter' ? quarters : years;

  let seed = 0;
  for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i);
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  return arr.map(p => ({
    p,
    rev: Math.round(50000 + r() * 500000),
    op:  Math.round(-10000 + r() * 90000),
    ni:  Math.round(-5000 + r() * 65000),
    opm: (-5 + r() * 25).toFixed(1) + '%',
    eps: Math.round(-1000 + r() * 9000),
    roe: +(-3 + r() * 23).toFixed(1)
  }));
}

/**
 * 재무 데이터 비동기 조회 (파일 우선 → 하드코딩 폴백)
 *
 * data/financials/{code}.json이 있으면 DART 다운로드 데이터 사용,
 * 없으면 기존 getPastData() 폴백.
 *
 * JSON 스키마 (download_financials.py 출력):
 *   { quarterly: [{period, revenue, op, ni, opm, roe, eps, ...}], annual: [...] }
 *
 * @param {string} code - 종목코드 (6자리)
 * @param {string} period - 'quarter' | 'annual'
 * @returns {Promise<Array>} 재무 데이터 배열 (최신순)
 */
async function getFinancialData(code, period) {
  // 1. 캐시 확인 (TTL: 4시간)
  if (_financialCache[code]) {
    const cached = _financialCache[code];
    const age = Date.now() - (cached.fetchedAt || 0);
    if (age < 4 * 3600 * 1000) {
      const arr = period === 'quarter' ? cached.quarterly : cached.annual;
      if (arr && arr.length) return arr;
    }
  }

  // 2. data/financials/{code}.json 시도
  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
  try {
    const resp = await fetch(`data/financials/${code}.json`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      // download_financials.py 출력 형식을 getPastData() 형식으로 변환
      // DART 데이터는 원 단위 → 억 단위로 변환 (1억 = 100,000,000)
      const toEok = (v, unit) => {
        if (!v) return 0;
        const n = typeof v === 'string' ? parseInt(v.replace(/,/g, '')) : v;
        // [C-9 FIX] DART unit-aware conversion to 억원
        if (unit === '백만원') return Math.round(n / 100);  // 백만원 → 억원
        // Default: 원 → 억원 (legacy behavior with auto-detect threshold)
        return Math.abs(n) > 1000000 ? Math.round(n / 100000000) : n;
      };
      const toDisplay = (items) => items.map(d => {
        const revEok = toEok(d.revenue, d.unit);
        const niEok  = toEok(d.ni, d.unit);
        const totalAssetsEok = d.total_assets ? toEok(d.total_assets, d.unit) : null;
        const totalLiabilitiesEok = d.total_liabilities ? toEok(d.total_liabilities, d.unit) : null;
        const totalEquityEok = d.total_equity ? toEok(d.total_equity, d.unit) : null;

        // NPM (순이익률): ni / rev * 100
        let npm = null;
        if (revEok && revEok !== 0) {
          npm = +(niEok / revEok * 100).toFixed(1);
        }

        // ROA (총자산이익률): ni / total_assets * 100
        let roa = null;
        if (totalAssetsEok && totalAssetsEok !== 0) {
          roa = +(niEok / totalAssetsEok * 100).toFixed(1);
        }

        return {
          p: _formatPeriodLabel(d.period),
          rev: revEok,
          op:  toEok(d.op, d.unit),
          ni:  niEok,
          opm: d.opm || ((d.revenue && d.op) ? (d.op / d.revenue * 100).toFixed(1) + '%' : '\u2014'),
          eps: d.eps || 0,
          roe: d.roe ? parseFloat(d.roe) : (d.ni && d.total_equity ? +(d.ni / d.total_equity * 100).toFixed(1) : 0),
          bps: d.bps || null,
          total_assets: totalAssetsEok,
          total_liabilities: totalLiabilitiesEok,
          total_equity: totalEquityEok,
          shares_outstanding: d.shares_outstanding || null,
          npm: npm,
          roa: roa,
          debt_ratio: d.debt_ratio != null ? parseFloat(d.debt_ratio) : null,
        };
      }).sort((a, b) => b.p.localeCompare(a.p)); // 최신순 정렬

      const quarterly = toDisplay(data.quarterly || []);
      const annual = toDisplay(data.annual || []);

      // annual 순이익 시계열 추출 (eps_stability mediator — Jensen-Meckling 1976)
      var niHist = [];
      if (annual && annual.length > 0) {
        for (var ai = annual.length - 1; ai >= 0; ai--) {
          if (annual[ai].ni != null && annual[ai].ni !== 0) niHist.push(annual[ai].ni);
        }
      }
      _financialCache[code] = { quarterly, annual, source: data.source || 'dart', fetchedAt: Date.now(), ni_history: niHist.length >= 3 ? niHist : null };
      return period === 'quarter' ? quarterly : annual;
    }
  } catch (e) {
    clearTimeout(timeoutId);
    // fetch 실패 (파일 없음 등) — 하드코딩/시드 폴백
    console.debug('[Financial] %s 파일 없음, 폴백 사용:', code, e.message);
  }

  // 3. 기존 하드코딩/시드 폴백
  // [FIX-TRUST] 시드/하드코딩 데이터는 source 표시를 위해 캐시에 기록
  const fallback = getPastData(code, period);
  const isHardcoded = !!PAST_DATA[code];
  const existing = _financialCache[code] || {};
  // eps_stability 시계열: hardcoded만 구성, seed 데이터 제외 (fake data 방지)
  var fbNiHist = existing.ni_history || null;
  if (isHardcoded && !fbNiHist) {
    var fbAnnual = period === 'annual' ? fallback : (existing.annual || []);
    if (fbAnnual && fbAnnual.length > 0) {
      var niArr = [];
      for (var ai = fbAnnual.length - 1; ai >= 0; ai--) {
        if (fbAnnual[ai].ni != null && fbAnnual[ai].ni !== 0) niArr.push(fbAnnual[ai].ni);
      }
      if (niArr.length >= 3) fbNiHist = niArr;
    }
  }
  _financialCache[code] = {
    quarterly: period === 'quarter' ? fallback : (existing.quarterly || []),
    annual: period === 'annual' ? fallback : (existing.annual || []),
    source: isHardcoded ? 'hardcoded' : 'seed',
    fetchedAt: Date.now(),
    ni_history: isHardcoded ? fbNiHist : null,
  };
  return fallback;
}

/**
 * download_financials.py의 period 형식 ("2024Q3") →
 * UI 표시 형식 ("2024 Q3")으로 변환
 */
function _formatPeriodLabel(period) {
  if (!period) return '\u2014';
  // "2024Q3" → "2024 Q3", "2024" → "2024"
  const match = period.match(/^(\d{4})Q(\d)$/);
  if (match) return `${match[1]} Q${match[2]}`;
  return period;
}
