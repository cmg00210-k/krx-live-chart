// V48-Phase2 — Shared tables/helpers for macro + phase8 confidence endpoints.
// Faithful port of tables and helpers from js/appState.js + js/indicators.js.
// Kept in _lib/ (not _shared/) because Pages Functions treats _shared specially.

export const VIX_VKOSPI_PROXY = 1.12;

export const REGIME_CONFIDENCE_MULT = {
  bull: { buy: 1.06, sell: 0.92 },
  bear: { buy: 0.90, sell: 1.06 },
  null: { buy: 1.00, sell: 1.00 },
};

export const MCS_THRESHOLDS = { strong_bull: 70, bull: 55, bear: 45, strong_bear: 30 };

export const STOVALL_CYCLE = {
  tech:         { trough: 1.12, expansion: 1.08, peak: 0.93, contraction: 0.90 },
  semiconductor:{ trough: 1.14, expansion: 1.10, peak: 0.90, contraction: 0.88 },
  financial:    { trough: 1.12, expansion: 1.04, peak: 0.94, contraction: 0.92 },
  cons_disc:    { trough: 1.10, expansion: 1.06, peak: 0.95, contraction: 0.92 },
  industrial:   { trough: 1.06, expansion: 1.08, peak: 0.97, contraction: 0.93 },
  material:     { trough: 0.96, expansion: 1.04, peak: 1.08, contraction: 0.94 },
  energy:       { trough: 0.94, expansion: 1.02, peak: 1.10, contraction: 0.96 },
  healthcare:   { trough: 1.02, expansion: 1.00, peak: 1.02, contraction: 1.06 },
  cons_staple:  { trough: 0.98, expansion: 0.98, peak: 1.02, contraction: 1.08 },
  utility:      { trough: 0.96, expansion: 0.96, peak: 1.04, contraction: 1.10 },
  telecom:      { trough: 1.02, expansion: 1.00, peak: 1.00, contraction: 1.04 },
  realestate:   { trough: 1.08, expansion: 1.04, peak: 0.94, contraction: 0.94 },
};

const KSIC_MACRO_SECTOR_MAP = [
  { keywords: ['반도체'], sector: 'semiconductor' },
  { keywords: ['소프트웨어', '자료처리', '호스팅', '포털', '인터넷', '게임', '통신 및 방송 장비',
               '컴퓨터', '정보서비스', '프로그래밍'], sector: 'tech' },
  { keywords: ['은행', '보험', '금융', '증권', '신탁', '저축', '여신', '투자'], sector: 'financial' },
  { keywords: ['의약', '의료', '바이오', '제약'], sector: 'healthcare' },
  { keywords: ['석유', '가스', '석탄', '원유', '에너지'], sector: 'energy' },
  { keywords: ['전기업', '가스 공급', '수도', '폐기물'], sector: 'utility' },
  { keywords: ['자동차', '의류', '호텔', '여행', '게임', '엔터테인', '방송', '영화',
               '광고', '교육', '가전', '가구'], sector: 'cons_disc' },
  { keywords: ['식품', '음료', '담배', '농업', '축산', '수산', '낙농'], sector: 'cons_staple' },
  { keywords: ['철강', '비철금속', '화학', '시멘트', '유리', '세라믹', '종이', '고무', '플라스틱',
               '섬유', '가죽'], sector: 'material' },
  { keywords: ['기계', '건설', '조선', '항공', '운송', '물류', '항만', '전자부품', '전동기',
               '선박', '중공업', '전지'], sector: 'industrial' },
  { keywords: ['부동산'], sector: 'realestate' },
  { keywords: ['통신', '전화'], sector: 'telecom' },
];

export const RATE_BETA = {
  utility: -0.08, realestate: -0.07, tech: -0.05, semiconductor: -0.04,
  cons_disc: -0.03, healthcare: -0.02, telecom: -0.01,
  cons_staple: 0.00, industrial: 0.01, material: 0.02, energy: 0.03, financial: 0.05,
};

export function getStovallSector(industryName) {
  if (!industryName) return null;
  for (const entry of KSIC_MACRO_SECTOR_MAP) {
    for (const kw of entry.keywords) {
      if (industryName.indexOf(kw) !== -1) return entry.sector;
    }
  }
  return null;
}

// ATR dynamic cap table — matches js/indicators.js:2236
const ATR_DYNAMIC_CAPS = {
  confidence:     { low: [5, 95],    mid: [10, 90],   high: [25, 75] },
  confidencePred: { low: [5, 95],    mid: [10, 95],   high: [25, 85] },
  macroMult:      { low: [0.70, 1.30], mid: [0.80, 1.20], high: [0.90, 1.10] },
  signalBoost:    { low: [5, 95],    mid: [10, 90],   high: [25, 75] },
};

export function getDynamicCap(target, regime) {
  const table = ATR_DYNAMIC_CAPS[target];
  if (!table) return [10, 90];
  const r = (typeof regime === 'string') ? regime : 'mid';
  return table[r] || table.mid;
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
