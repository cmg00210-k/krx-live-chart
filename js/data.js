// ── 종목 데이터 ──
const STOCKS = [
  { code: '005930', name: '삼성전자',   base: 73400 },
  { code: '000660', name: 'SK하이닉스',  base: 182000 },
  { code: '035420', name: 'NAVER',      base: 201500 },
  { code: '005380', name: '현대차',      base: 218000 },
  { code: '051910', name: 'LG화학',     base: 312000 },
  { code: '035720', name: '카카오',      base: 43500 },
  { code: '207940', name: '삼성바이오',   base: 781000 },
  { code: '006400', name: '삼성SDI',    base: 289000 },
];

// ── 과거 실적 데이터 ──
const PAST_DATA = {
  '005930': {
    quarter: [
      { p: '2024 Q3', rev: 791050, op: 91834,  ni: 73051, opm: '11.6%', eps: 1330, roe: 8.2 },
      { p: '2024 Q2', rev: 740068, op: 106056, ni: 94050, opm: '14.3%', eps: 1410, roe: 9.1 },
      { p: '2024 Q1', rev: 711280, op: 66060,  ni: 50680, opm: '9.3%',  eps: 755,  roe: 7.8 },
      { p: '2023 Q4', rev: 671978, op: 28247,  ni: 24401, opm: '4.2%',  eps: 363,  roe: 5.2 },
    ],
    annual: [
      { p: '2023', rev: 2589355, op: 64739,  ni: 154873, opm: '2.5%',  eps: 2305, roe: 6.2 },
      { p: '2022', rev: 3023642, op: 433766, ni: 554589, opm: '14.3%', eps: 8057, roe: 16.1 },
      { p: '2021', rev: 2796048, op: 516339, ni: 399075, opm: '18.5%', eps: 5777, roe: 14.2 },
    ]
  },
  '000660': {
    quarter: [
      { p: '2024 Q3', rev: 174338, op: 70351,  ni: 58011, opm: '40.4%', eps: 7943, roe: 18.7 },
      { p: '2024 Q2', rev: 164234, op: 58012,  ni: 44012, opm: '35.3%', eps: 6022, roe: 15.4 },
      { p: '2024 Q1', rev: 127836, op: 23412,  ni: 16842, opm: '18.3%', eps: 2305, roe: 11.2 },
      { p: '2023 Q4', rev: 113291, op: -1899,  ni: -2470, opm: '-1.7%', eps: -338, roe: -1.5 },
    ],
    annual: [
      { p: '2023', rev: 406625, op: -47731, ni: -23234, opm: '-11.7%', eps: -3180, roe: -8.1 },
      { p: '2022', rev: 446594, op: 66976,  ni: 48500,  opm: '15.0%',  eps: 6638,  roe: 12.0 },
      { p: '2021', rev: 420609, op: 129530, ni: 97499,  opm: '30.8%',  eps: 13351, roe: 21.5 },
    ]
  }
};

/**
 * 과거 실적 데이터 조회
 * @param {string} code - 종목코드
 * @param {string} period - 'quarter' | 'annual'
 */
function getPastData(code, period) {
  if (PAST_DATA[code]) return PAST_DATA[code][period];

  // 데이터 없는 종목은 랜덤 플레이스홀더
  const quarters = ['2024 Q3', '2024 Q2', '2024 Q1', '2023 Q4'];
  const years = ['2023', '2022', '2021'];
  const arr = period === 'quarter' ? quarters : years;

  return arr.map(p => ({
    p,
    rev: Math.round(50000 + Math.random() * 500000),
    op:  Math.round(5000 + Math.random() * 80000),
    ni:  Math.round(3000 + Math.random() * 60000),
    opm: (5 + Math.random() * 20).toFixed(1) + '%',
    eps: Math.round(500 + Math.random() * 8000),
    roe: (5 + Math.random() * 20).toFixed(1)
  }));
}
