// ══════════════════════════════════════════════════════
//  KRX LIVE — 재무지표 패널 (우측 D열)
//
//  app.js에서 분리된 재무 분석 전담 모듈.
//  전역 함수로 노출 — 모듈 시스템 없음.
//
//  의존: data.js (getFinancialData), colors.js (KRX_COLORS),
//        api.js (currentStock — app.js 전역), sidebar.js (sidebarManager)
//        app.js (candles, showToast — 전역)
// ══════════════════════════════════════════════════════

// ── 추이 차트 데이터 캐시 (탭 전환용) ──
var _finTrendData = [];
var _finTrendMetric = 'revenue';

// ── 매크로 데이터 캐시 (KTB10Y 등) ──
var _macroData = null;
// ── EVA 스코어 캐시 (compute_eva.py 출력) ──
var _evaScores = null;
// ── 채권 메트릭스 캐시 (compute_bond_metrics.py 출력) ──
var _bondMetrics = null;
// ── 시장 지수 종가 캐시 (CAPM beta용) ──
var _marketIndexCloses = { kospi: null, kosdaq: null };
// ── FF3 팩터 데이터 캐시 (Fama-French 1993) ──
var _ff3FactorData = null;
// ── CAPM Beta JSON 캐시 (compute_capm_beta.py 출력, DD 포함) ──
var _capmBetaJson = null;

// ── 업종 비교용 최신 재무값 캐시 ──
var _latestFinOpm = 0;
var _latestFinRoe = 0;

// ── 섹터 라벨: 주력 매출/이익 세그먼트 기준 (WICS/FICS/증권사 리서치 합의) ──
var SEGMENT_OVERRIDE = {
  '005930':'반도체','005935':'반도체','000660':'반도체',
  '402340':'지주','028260':'지주','005490':'지주',
  '034020':'원전','012450':'방산',
  '051910':'화학','006400':'2차전지','373220':'2차전지','003670':'2차전지',
  '035420':'플랫폼','035720':'플랫폼',
  '105560':'은행','055550':'은행','086790':'은행','316140':'은행','323410':'은행',
  '377300':'핀테크',
  '329180':'조선','009540':'조선','042660':'조선',
  '068270':'바이오','207940':'바이오','196170':'바이오',
  '000810':'보험','032830':'보험',
  '009150':'전자부품','267260':'전력기기',
  '066570':'가전','047050':'상사',
};
var KSIC_SHORT_LABEL = {
  '반도체 제조업':'반도체','전자부품 제조업':'전자부품',
  '통신 및 방송 장비 제조업':'통신장비','컴퓨터 및 주변장치 제조업':'IT하드웨어',
  '영상 및 음향기기 제조업':'전자',
  '자동차용 엔진 및 자동차 제조업':'자동차','자동차 신품 부품 제조업':'자동차부품',
  '기초 화학물질 제조업':'화학','기타 화학제품 제조업':'화학',
  '합성고무 및 플라스틱 물질 제조업':'화학',
  '기초 의약물질 제조업':'바이오','의약품 제조업':'제약',
  '의료용품 및 기타 의약 관련제품 제조업':'의료',
  '의료용 기기 제조업':'의료기기',
  '측정, 시험, 항해, 제어 및 기타 정밀기기 제조업':'정밀기기',
  '전동기, 발전기 및 전기 변환 · 공급 · 제어 장치 제조업':'전력기기',
  '일차전지 및 이차전지 제조업':'2차전지',
  '일반 목적용 기계 제조업':'기계','특수 목적용 기계 제조업':'기계',
  '선박 및 보트 건조업':'조선','항공기,우주선 및 부품 제조업':'방산',
  '1차 철강 제조업':'철강','1차 비철금속 제조업':'비철금속',
  '석유 정제품 제조업':'정유',
  '기타 금융업':'금융','보험업':'보험','금융 지원 서비스업':'금융','은행 및 저축기관':'은행',
  '소프트웨어 개발 및 공급업':'SW',
  '컴퓨터 프로그래밍, 시스템 통합 및 관리업':'IT서비스',
  '자료처리, 호스팅, 포털 및 기타 인터넷 정보매개 서비스업':'플랫폼',
  '전기 통신업':'통신',
  '건물 건설업':'건설','토목 건설업':'건설',
  '전기업':'유틸리티','종합 소매업':'유통','해상 운송업':'해운',
  '기타 식품 제조업':'식품','봉제의복 제조업':'의류',
  '부동산 임대 및 공급업':'부동산','자연과학 및 공학 연구개발업':'연구개발',
  '기타 전문 도매업':'도매','상품 중개업':'상사',
};
function _getSegmentLabel(stock) {
  if (!stock) return '';
  if (SEGMENT_OVERRIDE[stock.code]) return SEGMENT_OVERRIDE[stock.code];
  var ind = stock.industry || stock.sector || '';
  if (ind && KSIC_SHORT_LABEL[ind]) return KSIC_SHORT_LABEL[ind];
  return '';
}

// ── KSIC 세부업종 → 광의 업종 매핑 (peer group 폴백용) ──
var KSIC_BROAD_MAP = {
  '반도체 제조업': 'C26_전자부품컴퓨터통신장비',
  '전자부품 제조업': 'C26_전자부품컴퓨터통신장비',
  '통신 및 방송 장비 제조업': 'C26_전자부품컴퓨터통신장비',
  '컴퓨터 및 주변장치 제조업': 'C26_전자부품컴퓨터통신장비',
  '영상 및 음향기기 제조업': 'C26_전자부품컴퓨터통신장비',
  '자동차용 엔진 및 자동차 제조업': 'C30_자동차',
  '자동차 신품 부품 제조업': 'C30_자동차',
  '자동차 차체 및 트레일러 제조업': 'C30_자동차',
  '기초 화학물질 제조업': 'C20_화학',
  '기타 화학제품 제조업': 'C20_화학',
  '합성고무 및 플라스틱 물질 제조업': 'C20_화학',
  '기초 의약물질 제조업': 'C21_의약품',
  '의약품 제조업': 'C21_의약품',
  '의료용품 및 기타 의약 관련제품 제조업': 'C21_의약품',
  '의료용 기기 제조업': 'C27_의료정밀',
  '측정, 시험, 항해, 제어 및 기타 정밀기기 제조업': 'C27_의료정밀',
  '전동기, 발전기 및 전기 변환 · 공급 · 제어 장치 제조업': 'C28_전기장비',
  '일차전지 및 이차전지 제조업': 'C28_전기장비',
  '일반 목적용 기계 제조업': 'C29_기계장비',
  '특수 목적용 기계 제조업': 'C29_기계장비',
  '기타 금융업': 'K64_금융보험',
  '보험업': 'K64_금융보험',
  '금융 지원 서비스업': 'K64_금융보험',
  '은행 및 저축기관': 'K64_금융보험',
  '소프트웨어 개발 및 공급업': 'J58_정보통신',
  '컴퓨터 프로그래밍, 시스템 통합 및 관리업': 'J58_정보통신',
  '자료처리, 호스팅, 포털 및 기타 인터넷 정보매개 서비스업': 'J58_정보통신',
  '전기 통신업': 'J58_정보통신',
  '선박 및 보트 건조업': 'C31_기타운송장비',
  '항공기,우주선 및 부품 제조업': 'C31_기타운송장비',
  '1차 철강 제조업': 'C24_1차금속',
  '1차 비철금속 제조업': 'C24_1차금속',
  '석유 정제품 제조업': 'C19_석유정제',
  '건물 건설업': 'F41_건설',
  '토목 건설업': 'F41_건설',
};

function _getBroadIndustry(name) {
  return KSIC_BROAD_MAP[name] || name;
}

// ══════════════════════════════════════════════════════
//  재무지표 패널 (우측 탭)
// ══════════════════════════════════════════════════════

/**
 * 매크로 데이터 로드 (KTB10Y 국고채 10년물 금리 등)
 * data/macro/macro_latest.json에서 비동기 로드, 실패 시 무시 (fallback 3.5%)
 */
async function _loadMacroData() {
  if (_macroData) return;
  try {
    var resp = await fetch('data/macro/macro_latest.json', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) _macroData = await resp.json();
  } catch (e) { /* 매크로 데이터 선택적 — 실패 시 KTB10Y 기본값 3.5% 사용 */ }
}

/** CAPM Beta 렌더링 (core_data/25 §1.2, Scholes-Williams 1977) */
async function _renderCAPMBeta(stock) {
  var el = document.getElementById('fin-beta');
  if (!el) return;
  if (!stock || !stock.market) { el.textContent = '\u2014'; return; }
  var mktKey = stock.market.toLowerCase().indexOf('kosdaq') >= 0 ? 'kosdaq' : 'kospi';
  // 현재 종목 종가 로드 (dataService에서 일봉 조회)
  var stockCandles = null;
  try { stockCandles = await dataService.getCandles(stock, '1d'); } catch (e) { /* optional */ }
  if (!stockCandles || stockCandles.length < 60) { el.textContent = '\u2014'; return; }
  // 날짜 기반 매칭: 종목과 시장 지수의 날짜가 다를 수 있으므로 date 키로 정렬
  var mktMap = {};
  var mktData = null;
  try {
    var resp = await fetch('data/market/' + mktKey + '_daily.json', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) mktData = await resp.json();
  } catch (e) { /* optional */ }
  if (!mktData) { el.textContent = '\u2014'; return; }
  for (var mi = 0; mi < mktData.length; mi++) mktMap[mktData[mi].time] = mktData[mi].close;
  // 공통 날짜만 추출 (정렬된 매칭)
  var sCloses = [], mCloses = [];
  for (var si = 0; si < stockCandles.length; si++) {
    var t = stockCandles[si].time;
    if (mktMap[t]) { sCloses.push(stockCandles[si].close); mCloses.push(mktMap[t]); }
  }
  // Rf fallback chain: macro → bonds_latest → 3.5% (consistent with yield gap, H-3 fix)
  var rfAnnual = (_macroData && _macroData.ktb10y != null) ? _macroData.ktb10y
    : (_bondsLatest && _bondsLatest.yields && _bondsLatest.yields.ktb_10y != null) ? _bondsLatest.yields.ktb_10y
    : 3.5;
  var result = (typeof calcCAPMBeta === 'function') ? calcCAPMBeta(sCloses, mCloses, 250, rfAnnual) : null;
  if (!result) { el.textContent = '\u2014'; return; }
  var b = result.beta;
  var label = b >= 1.5 ? '고위험' : b >= 1.0 ? '공격적' : b >= 0.7 ? '중립' : '방어적';
  el.textContent = b.toFixed(2) + ' (' + label + ')';
  el.className = 'fin-grid-value' + (b >= 1.0 ? ' up' : ' dn');
}

/** Merton Distance-to-Default 렌더링 (Merton 1974, Doc35 §6.1-6.5)
 *  compute_capm_beta.py가 사전 계산한 DD를 capm_beta.json에서 읽어 표시.
 *  DD>3: 안전(초록), 2-3: 주의(중립), <2: 경고(빨강) */
async function _renderDD(stock) {
  var el = document.getElementById('fin-dd');
  if (!el) return;
  if (!stock || !stock.code) { el.textContent = '\u2014'; el.className = 'fin-grid-value'; return; }

  // capm_beta.json 캐시 로드 (한번만)
  if (!_capmBetaJson) {
    try {
      var resp = await fetch('data/backtest/capm_beta.json', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) _capmBetaJson = await resp.json();
    } catch (e) { /* optional */ }
  }
  if (!_capmBetaJson || !_capmBetaJson.stocks) {
    el.textContent = '\u2014'; el.className = 'fin-grid-value'; return;
  }

  var entry = _capmBetaJson.stocks[stock.code];
  if (!entry || entry.distanceToDefault == null) {
    el.textContent = '\u2014'; el.className = 'fin-grid-value'; return;
  }

  var dd = entry.distanceToDefault;
  var grade = entry.ddGrade;
  var label, cls;
  if (grade === 'safe' || dd > 3) {
    label = '\uC548\uC804';  // 안전
    cls = 'fin-grid-value fin-good';
  } else if (grade === 'caution' || dd >= 2) {
    label = '\uC8FC\uC758';  // 주의
    cls = 'fin-grid-value';
  } else {
    label = '\uACBD\uACE0';  // 경고
    cls = 'fin-grid-value up';
  }
  el.textContent = label + ' (DD: ' + dd.toFixed(2) + ')';
  el.className = cls;
}

/** Blume(1975) 보정 Beta + Jensen Alpha 유의성 렌더링 (Doc 25 §9.3-9.4)
 *  compute_capm_beta.py가 사전 계산한 betaBlume/alphaTstat를 capm_beta.json에서 읽어 표시. */
async function _renderBlumeBetaAlpha(stock) {
  var elBlume = document.getElementById('fin-blume-beta');
  var elAlpha = document.getElementById('fin-alpha-sig');
  if (!elBlume && !elAlpha) return;
  if (!stock || !stock.code) {
    if (elBlume) { elBlume.textContent = '\u2014'; elBlume.className = 'fin-grid-value'; }
    if (elAlpha) { elAlpha.textContent = '\u2014'; elAlpha.className = 'fin-grid-value'; }
    return;
  }

  // capm_beta.json 캐시 로드 (한번만 — _renderDD와 공유)
  if (!_capmBetaJson) {
    try {
      var resp = await fetch('data/backtest/capm_beta.json', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) _capmBetaJson = await resp.json();
    } catch (e) { /* optional */ }
  }
  if (!_capmBetaJson || !_capmBetaJson.stocks) {
    if (elBlume) { elBlume.textContent = '\u2014'; elBlume.className = 'fin-grid-value'; }
    if (elAlpha) { elAlpha.textContent = '\u2014'; elAlpha.className = 'fin-grid-value'; }
    return;
  }

  var entry = _capmBetaJson.stocks[stock.code];
  if (!entry) {
    if (elBlume) { elBlume.textContent = '\u2014'; elBlume.className = 'fin-grid-value'; }
    if (elAlpha) { elAlpha.textContent = '\u2014'; elAlpha.className = 'fin-grid-value'; }
    return;
  }

  // Blume Beta (Doc 25 §9.3)
  if (elBlume && entry.betaBlume != null) {
    var bb = entry.betaBlume;
    var label = bb >= 1.5 ? '\uACE0\uC704\uD5D8' : bb >= 1.0 ? '\uACF5\uACA9\uC801' : bb >= 0.7 ? '\uC911\uB9BD' : '\uBC29\uC5B4\uC801';
    elBlume.textContent = bb.toFixed(2) + ' (' + label + ')';
    elBlume.className = 'fin-grid-value' + (bb >= 1.0 ? ' up' : ' dn');
  } else if (elBlume) {
    elBlume.textContent = '\u2014'; elBlume.className = 'fin-grid-value';
  }

  // Alpha Significance (Doc 25 §9.4)
  if (elAlpha && entry.alpha != null) {
    var alpha = entry.alpha;
    var tstat = entry.alphaTstat;
    var sig = (tstat != null && Math.abs(tstat) > 2.0);
    var alphaStr = (alpha >= 0 ? '+' : '') + (alpha * 100).toFixed(2) + '%';
    elAlpha.textContent = alphaStr + (sig ? ' *\uC720\uC758' : ' \uBE44\uC720\uC758');
    elAlpha.className = 'fin-grid-value' + (sig ? (alpha >= 0 ? ' fin-good' : ' up') : '');
  } else if (elAlpha) {
    elAlpha.textContent = '\u2014'; elAlpha.className = 'fin-grid-value';
  }
}

/** 시장 지수 데이터 로드 (CAPM beta용, core_data/25 §1.2) */
async function _loadMarketIndex(market) {
  var key = (market || 'kospi').toLowerCase();
  if (_marketIndexCloses[key]) return _marketIndexCloses[key];
  try {
    var resp = await fetch('data/market/' + key + '_daily.json', { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      var data = await resp.json();
      _marketIndexCloses[key] = data.map(function(d) { return d.close; });
    }
  } catch (e) { /* market index optional */ }
  return _marketIndexCloses[key] || null;
}

/**
 * FF3 팩터 노출도 렌더링 (Fama-French 1993, core_data/23 §3.2)
 * Stock returns regressed on SMB/HML/MKT_RF daily factors via OLS.
 * Displays factor loadings with size/value style labels.
 */
async function _renderFF3Factors(stock) {
  var elSmb = document.getElementById('fin-smb');
  var elHml = document.getElementById('fin-hml');
  if (!elSmb || !elHml) return;
  if (!stock || !stock.market) {
    elSmb.textContent = '\u2014'; elHml.textContent = '\u2014'; return;
  }
  // Load FF3 factor data (cached)
  if (!_ff3FactorData) {
    try {
      var resp = await fetch('data/macro/ff3_factors.json', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) _ff3FactorData = await resp.json();
    } catch (e) { /* optional */ }
  }
  if (!_ff3FactorData || !_ff3FactorData.daily) {
    elSmb.textContent = '\u2014'; elHml.textContent = '\u2014'; return;
  }
  // Load stock candles
  var stockCandles = null;
  try { stockCandles = await dataService.getCandles(stock, '1d'); } catch (e) { /* optional */ }
  if (!stockCandles || stockCandles.length < 60) {
    elSmb.textContent = '\u2014'; elHml.textContent = '\u2014'; return;
  }
  // Build date-indexed stock returns
  var ff3 = _ff3FactorData.daily;
  var dateSet = {};
  for (var di = 0; di < ff3.dates.length; di++) dateSet[ff3.dates[di]] = di;
  // Match stock returns to factor dates
  // [FIX] FF3 regression: dependent variable should be excess return (Ri - Rf)
  var rfDaily = _ff3FactorData.rf_daily || 0;
  var stockRet = [], smbArr = [], hmlArr = [], mktArr = [];
  for (var si = 1; si < stockCandles.length; si++) {
    var t = stockCandles[si].time;
    var idx = dateSet[t];
    if (idx === undefined) continue;
    var prev = stockCandles[si - 1].close;
    if (!prev || prev <= 0) continue;
    var ri = (stockCandles[si].close - prev) / prev - rfDaily;
    stockRet.push(ri);
    smbArr.push(ff3.SMB[idx]);
    hmlArr.push(ff3.HML[idx]);
    mktArr.push(ff3.MKT_RF[idx]);
  }
  if (stockRet.length < 30) {
    elSmb.textContent = '\u2014'; elHml.textContent = '\u2014'; return;
  }
  // OLS: stockRet = a + b1*MKT_RF + b2*SMB + b3*HML
  // Simple multivariate via normal equations: X = [1, MKT_RF, SMB, HML]
  var N = stockRet.length;
  // Build XtX (4x4) and Xty (4x1)
  var XtX = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  var Xty = [0,0,0,0];
  for (var i = 0; i < N; i++) {
    var row = [1, mktArr[i], smbArr[i], hmlArr[i]];
    var yi = stockRet[i];
    for (var a = 0; a < 4; a++) {
      Xty[a] += row[a] * yi;
      for (var b = 0; b < 4; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  // Solve 4x4 via Gaussian elimination
  var mat = [];
  for (var a = 0; a < 4; a++) {
    mat[a] = XtX[a].slice();
    mat[a].push(Xty[a]);
  }
  for (var col = 0; col < 4; col++) {
    var maxR = col;
    for (var r = col + 1; r < 4; r++) if (Math.abs(mat[r][col]) > Math.abs(mat[maxR][col])) maxR = r;
    var tmp = mat[col]; mat[col] = mat[maxR]; mat[maxR] = tmp;
    if (Math.abs(mat[col][col]) < 1e-12) {
      elSmb.textContent = '\u2014'; elHml.textContent = '\u2014'; return;
    }
    var pivot = mat[col][col];
    for (var c = col; c < 5; c++) mat[col][c] /= pivot;
    for (var r = 0; r < 4; r++) {
      if (r === col) continue;
      var f = mat[r][col];
      for (var c = col; c < 5; c++) mat[r][c] -= f * mat[col][c];
    }
  }
  // beta = [alpha, mkt_beta, smb_loading, hml_loading]
  var smbLoad = mat[2][4];
  var hmlLoad = mat[3][4];
  // Display with style labels
  var smbLabel = smbLoad > 0.3 ? '\uC18C\uD615\uC8FC' : smbLoad < -0.3 ? '\uB300\uD615\uC8FC' : '\uC911\uB9BD';
  var hmlLabel = hmlLoad > 0.3 ? '\uAC00\uCE58\uC8FC' : hmlLoad < -0.3 ? '\uC131\uC7A5\uC8FC' : '\uC911\uB9BD';
  elSmb.textContent = smbLoad.toFixed(2) + ' (' + smbLabel + ')';
  elSmb.className = 'fin-grid-value' + (smbLoad >= 0 ? ' up' : ' dn');
  elHml.textContent = hmlLoad.toFixed(2) + ' (' + hmlLabel + ')';
  elHml.className = 'fin-grid-value' + (hmlLoad >= 0 ? ' up' : ' dn');
}

/** 경기순환 국면 배지 렌더링 — OECD CLI 4-phase (core_data/29 §1.2) */
function _renderCyclePhase() {
  var phaseEl = document.getElementById('fin-cycle-phase');
  var detailEl = document.getElementById('fin-cycle-detail');
  if (!phaseEl) return;
  var cp = _macroData && _macroData.cycle_phase;
  if (!cp || !cp.phase) {
    phaseEl.textContent = '\u2014';
    phaseEl.className = 'fin-cycle-phase';
    if (detailEl) detailEl.textContent = '';
    return;
  }
  var LABELS = { expansion: '확장기', peak: '후퇴기', contraction: '수축기', trough: '회복기' };
  var COLORS = { expansion: 'up', peak: 'dn', contraction: 'dn', trough: 'up' };
  phaseEl.textContent = LABELS[cp.phase] || cp.phase;
  phaseEl.className = 'fin-cycle-phase ' + (COLORS[cp.phase] || '');
  if (detailEl) {
    var parts = [];
    if (cp.months_in_phase) parts.push(cp.months_in_phase + '개월째');
    if (cp.cli) parts.push('CLI ' + cp.cli);
    if (!cp.confirmed) parts.push('(미확인)');
    // Stovall(1996) sector rotation: US S&P-based, unvalidated for KRX
    // Show [미검증] badge when current stock has a Stovall sector mapping
    if (typeof _getStovallSector === 'function' && typeof currentStock !== 'undefined' && currentStock) {
      var _stovSector = _getStovallSector(currentStock.industry || currentStock.sector || '');
      if (_stovSector) parts.push('섹터순환 [미검증]');
    }
    detailEl.textContent = parts.join(' · ');
  }
}

/**
 * [Phase ECOS-4] 수익률곡선 레짐 렌더링
 * bonds_latest.json: slope_10y3y, curve_inverted, nss_params, credit_regime
 * Doc35 §3: Normal/Flat/Inverted → 경기 선행 시그널
 */
function _renderYieldCurve() {
  var slopeEl = document.getElementById('fin-yield-slope');
  var regimeEl = document.getElementById('fin-yield-regime');
  if (!slopeEl) return;

  var bonds = (typeof _bondsLatest !== 'undefined') ? _bondsLatest : null;
  if (!bonds) {
    slopeEl.textContent = '\u2014';
    if (regimeEl) regimeEl.textContent = '';
    return;
  }

  var slope = bonds.slope_10y3y;
  var inverted = bonds.curve_inverted;

  // slope 표시
  if (slope != null) {
    slopeEl.textContent = (slope >= 0 ? '+' : '') + slope.toFixed(2) + '%p';
    slopeEl.style.color = inverted ? 'var(--up)' : (slope < 0.15 ? 'var(--neutral)' : 'var(--fin-good)');
  } else {
    slopeEl.textContent = '\u2014';
  }

  // regime 배지
  if (regimeEl) {
    if (inverted || (slope != null && slope < 0)) {
      regimeEl.textContent = '\uC5ED\uC804';  // 역전
      regimeEl.className = 'fin-yield-regime inverted';
    } else if (slope != null && slope < 0.15) {
      regimeEl.textContent = '\uD3C9\uD0C4';  // 평탄
      regimeEl.className = 'fin-yield-regime flat';
    } else if (slope != null) {
      regimeEl.textContent = '\uC815\uC0C1';  // 정상
      regimeEl.className = 'fin-yield-regime normal';
    } else {
      regimeEl.textContent = '';
      regimeEl.className = 'fin-yield-regime';
    }
  }
}

/** EVA Spread 렌더링 (Stern Stewart 1991, Doc 14 §2.8) */
async function _renderEVA(stock) {
  var el = document.getElementById('fin-eva-spread');
  if (!el) return;
  if (!stock || !stock.code) { el.textContent = '\u2014'; return; }
  // 캐시된 EVA 스코어 로드
  if (!_evaScores) {
    // [V48-SEC] Primary: /api/eva (Origin-gated). Fallback: raw JSON (dev/file mode).
    try {
      var resp = await fetch('/api/eva', { signal: AbortSignal.timeout(5000), credentials: 'same-origin' });
      if (!resp.ok) {
        resp = await fetch('data/backtest/eva_scores.json', { signal: AbortSignal.timeout(5000) });
      }
      if (resp.ok) _evaScores = await resp.json();
    } catch (e) { /* EVA optional */ }
  }
  if (!_evaScores || !_evaScores.stocks) { el.textContent = '\u2014'; return; }
  var data = _evaScores.stocks[stock.code];
  if (!data || data.evaSpread == null) { el.textContent = '\u2014'; return; }
  var spread = data.evaSpread;
  var pct = (spread * 100).toFixed(1);
  el.textContent = (spread >= 0 ? '+' : '') + pct + '%';
  el.className = 'fin-grid-value' + (spread >= 0 ? ' up' : ' dn');
}

/** 채권 메트릭스 렌더링 (Duration/DV01, Doc 44) */
async function _renderBondMetrics() {
  var durEl = document.getElementById('fin-bond-duration');
  var dv01El = document.getElementById('fin-bond-dv01');
  if (!durEl) return;
  // bond_metrics.json 로드 (캐시)
  if (!_bondMetrics) {
    try {
      var resp = await fetch('data/macro/bond_metrics.json', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) _bondMetrics = await resp.json();
    } catch (e) { /* bond metrics optional */ }
  }
  if (!_bondMetrics || !_bondMetrics.benchmarks) {
    durEl.textContent = '\u2014';
    if (dv01El) dv01El.textContent = '';
    return;
  }
  var ktb10 = _bondMetrics.benchmarks.ktb_10y;
  if (!ktb10) {
    durEl.textContent = '\u2014';
    if (dv01El) dv01El.textContent = '';
    return;
  }
  durEl.textContent = ktb10.modifiedDuration.toFixed(2) + '\uB144';  // 년
  if (dv01El) {
    dv01El.textContent = 'DV01 ' + ktb10.dv01.toFixed(4);
    dv01El.className = 'fin-yield-regime normal';
  }
}

/**
 * DART 데이터 없을 때 모든 재무 지표를 "—"로 초기화 + 캔버스 차트 클리어
 * seed 생성 가짜 데이터를 표시하지 않기 위한 헬퍼.
 */
function _clearAllFinancials() {
  // 모든 fin-* 텍스트 요소를 "—"로 설정하고 색상 클래스 제거
  var ids = [
    'fin-period', 'fin-revenue', 'fin-op', 'fin-ni',
    'fin-rev-yoy', 'fin-rev-qoq', 'fin-op-yoy', 'fin-op-qoq', 'fin-ni-yoy', 'fin-ni-qoq',
    'fin-opm', 'fin-roe', 'fin-eps', 'fin-bps',
    'fin-per', 'fin-pbr', 'fin-psr', 'fin-yield-gap', 'fin-beta', 'fin-dd', 'fin-blume-beta', 'fin-alpha-sig', 'fin-smb', 'fin-hml', 'fin-eva-spread', 'fin-roa', 'fin-debt-ratio', 'fin-npm',
    'fin-rev-cagr', 'fin-ni-cagr', 'fin-score', 'fin-grade'
  ];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      el.textContent = '\u2014';  // em dash
      el.classList.remove('up', 'down', 'neutral', 'fin-good', 'fin-bad', 'fin-warn');
    }
  }

  // 캔버스 차트 클리어 (이전 종목의 잔류 데이터 방지)
  var canvasIds = ['opm-sparkline', 'fin-trend-canvas', 'fin-per-band'];
  for (var c = 0; c < canvasIds.length; c++) {
    var canvas = document.getElementById(canvasIds[c]);
    if (canvas) {
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 추이 차트 데이터 캐시 초기화 (탭 전환 시 이전 종목 데이터 렌더링 방지)
  _finTrendData = [];

  // 업종 비교 / 동종업종 비교 영역 초기화
  var compareEl = document.getElementById('fin-compare');
  if (compareEl) compareEl.innerHTML = '';
  var peersEl = document.getElementById('fin-peers');
  if (peersEl) peersEl.innerHTML = '';

  // 데이터 출처 배지 숨김
  var badge = document.getElementById('fin-source-badge');
  if (badge) badge.style.display = 'none';
}

/**
 * 데이터 출처별 경고 배너 표시
 * @param {string|null} source - 'dart' | 'hardcoded' | 'seed' | null
 */
function _showDartWarning(source) {
  var el = document.getElementById('fin-seed-warning');
  if (!el) return;

  // ── 헤더 배지 업데이트 ──
  var badge = document.getElementById('fin-source-badge');
  if (badge) {
    badge.style.display = 'inline';
    badge.className = 'fin-source-badge';
    if (source === 'dart') {
      badge.textContent = 'DART';
      badge.classList.add('dart');
      badge.title = 'DART 공시 데이터';
    } else if (source === 'hardcoded') {
      badge.textContent = '기본';
      badge.classList.add('default');
      badge.title = '내장 참고 데이터 (삼성전자/SK하이닉스)';
    } else {
      badge.textContent = '추정';
      badge.classList.add('seed');
      badge.title = '실제 재무데이터가 아닙니다';
    }
  }

  if (source === 'dart') {
    // DART 실제 데이터 — 경고 숨김
    el.style.display = 'none';
  } else if (source === 'hardcoded') {
    // 하드코딩 데이터 (삼성전자/SK하이닉스) — 일부 추정치 포함 가능
    el.style.display = 'block';
    el.textContent = '참고용 데이터 (DART 미연동 \u2014 일부 추정치 포함)';
    el.style.background = KRX_COLORS.WARNING_ORANGE_FILL(0.10);
    el.style.borderColor = KRX_COLORS.WARNING_ORANGE_FILL(0.20);
    el.style.color = KRX_COLORS.WARNING_ORANGE_FILL(0.65);
  } else {
    // seed 생성 또는 알 수 없는 출처 — DART 연동 안내
    el.style.display = 'block';
    el.textContent = 'DART 데이터 미연동 \u2014 download_financials.py를 실행하세요';
    el.style.background = KRX_COLORS.DANGER_RED_FILL(0.10);
    el.style.borderColor = KRX_COLORS.DANGER_RED_FILL(0.25);
    el.style.color = KRX_COLORS.DANGER_RED_FILL(0.75);
  }
}

async function updateFinancials() {
  // [FIX] 새 종목 전환 시 이전 데이터 잔류 방지: 모든 fin-* 요소 초기화
  var _finIds = [
    'fin-period', 'fin-revenue', 'fin-op', 'fin-ni',
    'fin-rev-yoy', 'fin-rev-qoq', 'fin-op-yoy', 'fin-op-qoq', 'fin-ni-yoy', 'fin-ni-qoq',
    'fin-opm', 'fin-roe', 'fin-eps', 'fin-bps',
    'fin-per', 'fin-pbr', 'fin-psr', 'fin-yield-gap', 'fin-beta', 'fin-dd', 'fin-blume-beta', 'fin-alpha-sig', 'fin-smb', 'fin-hml', 'fin-eva-spread', 'fin-roa', 'fin-debt-ratio', 'fin-npm',
    'fin-rev-cagr', 'fin-ni-cagr', 'fin-score', 'fin-grade'
  ];
  for (var _i = 0; _i < _finIds.length; _i++) {
    var _el = document.getElementById(_finIds[_i]);
    if (_el) _el.textContent = '\u2014';
  }

  // 매크로 데이터 사전 로드 (KTB10Y — Yield Gap 계산용, 비차단)
  _loadMacroData();

  var data;
  try {
    data = await getFinancialData(currentStock.code, 'quarter');
  } catch (e) {
    console.error('[KRX] 재무 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 재무 데이터 로드 실패', 'error');
    _clearAllFinancials();
    return;
  }
  if (!data.length) return;
  const latest = data[0];

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = cls; };

  // ── 데이터 출처 확인: seed 데이터는 표시하지 않음 ──
  const _cached = (typeof _financialCache !== 'undefined') ? _financialCache[currentStock.code] : null;
  const _finSource = _cached ? _cached.source : null;

  // [CLEAN-DATA] source가 'dart' 또는 'hardcoded'가 아닌 경우 (seed 생성 가짜 데이터)
  // → 모든 재무 지표를 "—"로 표시하고 캔버스 차트 초기화 후 조기 종료
  if (_finSource !== 'dart' && _finSource !== 'hardcoded') {
    _clearAllFinancials();
    _showDartWarning('seed');
    return;
  }

  // [FIX-TRUST] 데이터 출처별 경고 배너 표시
  _showDartWarning(_finSource);

  // 기간 표시
  set('fin-period', latest.p || '\u2014');

  // 주요손익지표 — 단위를 span.fin-unit으로 분리 (CSS 별도 스타일링)
  setHtml('fin-revenue', Number(latest.rev).toLocaleString() + '<span class="fin-unit">억</span>');
  setHtml('fin-op', Number(latest.op).toLocaleString() + '<span class="fin-unit">억</span>');
  setHtml('fin-ni', Number(latest.ni).toLocaleString() + '<span class="fin-unit">억</span>');

  // 영업이익 색상: 기본 흰색, 음수만 파랑
  setClass('fin-op', 'fin-row-value' + (Number(latest.op) < 0 ? ' dn' : ''));
  // 순이익 색상: 기본 흰색, 음수만 파랑
  setClass('fin-ni', 'fin-row-value' + (Number(latest.ni) < 0 ? ' dn' : ''));

  // 수익성 지표
  set('fin-opm', latest.opm);
  setClass('fin-opm', 'fin-grid-value' + (parseFloat(latest.opm) < 0 ? ' dn' : ''));
  _latestFinOpm = _parsePercent(latest.opm);
  set('fin-eps', Number(latest.eps).toLocaleString() + '원');
  setClass('fin-eps', 'fin-grid-value' + (Number(latest.eps) < 0 ? ' dn' : ''));
  const roeNum = parseFloat(latest.roe);
  set('fin-roe', isNaN(roeNum) ? '\u2014' : roeNum.toFixed(1) + '%');
  setClass('fin-roe', 'fin-grid-value' + (!isNaN(roeNum) && roeNum < 0 ? ' dn' : ''));
  _latestFinRoe = isNaN(roeNum) ? 0 : roeNum;
  // BPS: 자본총계/발행주식수 (DART 데이터에 있으면 표시)
  const bps = latest.bps || '\u2014';
  set('fin-bps', typeof bps === 'number' ? bps.toLocaleString() + '원' : bps);
  setClass('fin-bps', 'fin-grid-value' + (typeof bps === 'number' && bps < 0 ? ' dn' : ''));

  // ── Phase 1: ROA, 부채비율, NPM ──
  const rev = Number(latest.rev) || 0;
  const ni = Number(latest.ni) || 0;

  // NPM (순이익률): data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  // [FIX-3] 문자열 "14.5%" 등 파싱 안전 처리 — parseFloat 강제
  let npmVal = null;
  if (latest.npm != null) {
    npmVal = parseFloat(latest.npm) || 0;
  } else if (rev !== 0) {
    npmVal = +(ni / rev * 100).toFixed(1);
  }
  if (npmVal != null) {
    set('fin-npm', npmVal.toFixed(1) + '%');
    setClass('fin-npm', 'fin-grid-value' + (npmVal < 0 ? ' dn' : ''));
  } else {
    set('fin-npm', '\u2014');
  }

  // ROA: data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  // [FIX-2] 평균총자산 기반 ROA: (당기 + 전기 총자산) / 2 사용
  //         전분기 데이터 없으면 기말 총자산 폴백 (한계 주석 표기)
  let roaVal = null;
  if (latest.roa != null) {
    roaVal = parseFloat(latest.roa) || 0;
  } else if (latest.total_assets && Number(latest.total_assets) !== 0) {
    const curAssets = Number(latest.total_assets);
    const prevQ = data.length > 1 ? data[1] : null;
    const prevAssets = prevQ && prevQ.total_assets ? Number(prevQ.total_assets) : 0;
    // 평균총자산 = (당기 + 전기) / 2; 전기 없으면 기말잔액 폴백
    const avgAssets = prevAssets > 0 ? (curAssets + prevAssets) / 2 : curAssets;
    roaVal = +(ni / avgAssets * 100).toFixed(1);
  }
  if (roaVal != null) {
    set('fin-roa', roaVal.toFixed(1) + '%');
    setClass('fin-roa', 'fin-grid-value' + (roaVal < 0 ? ' dn' : ''));
  } else {
    set('fin-roa', '\u2014');
  }

  // 부채비율: debt_ratio (DART) 또는 total_liabilities/total_equity로 계산
  // [FIX-10] 자본총계 < 0 → "자본잠식" 표시 (부채비율 계산 불가)
  let debtRatio = null;
  const totalEquityRaw = Number(latest.total_equity) || 0;
  if (totalEquityRaw < 0) {
    set('fin-debt-ratio', '자본잠식');
    setClass('fin-debt-ratio', 'fin-grid-value dn');
  } else if (latest.debt_ratio != null) {
    debtRatio = parseFloat(latest.debt_ratio);
    set('fin-debt-ratio', debtRatio.toFixed(1) + '%');
    // 부채비율: 200% 초과 = 위험(dn), 나머지 = 기본 흰색
    setClass('fin-debt-ratio', 'fin-grid-value' + (debtRatio > 200 ? ' dn' : ''));
  } else if (latest.total_liabilities && latest.total_equity && totalEquityRaw !== 0) {
    debtRatio = +(Number(latest.total_liabilities) / totalEquityRaw * 100).toFixed(1);
    set('fin-debt-ratio', debtRatio.toFixed(1) + '%');
    setClass('fin-debt-ratio', 'fin-grid-value' + (debtRatio > 200 ? ' dn' : ''));
  } else {
    set('fin-debt-ratio', '\u2014');
  }

  // ── PER / PBR / PSR 계산 ──
  const currentPrice = candles.length ? candles[candles.length - 1].close : null;

  // 시가총액을 먼저 구함 (PER/PBR/PSR 폴백 계산에 모두 필요)
  const mcapEok = _getMarketCapEok(currentStock.code, currentPrice, latest.shares_outstanding);

  // EPS 결정: DART 직접값 → shares_outstanding 기반 계산 → 0
  // [FIX-4] shares_outstanding 단위 검증 + [FIX-9] 0 나누기 방어
  let epsNum = Number(latest.eps) || 0;
  if (!epsNum && latest.shares_outstanding && latest.shares_outstanding > 0 && ni) {
    let shares = Number(latest.shares_outstanding);
    // 단위 보정: 100 미만이면 백만주 단위로 추정 → 원래 주수로 변환
    if (shares < 100) {
      console.warn('[KRX-FIN] shares_outstanding < 100, 백만주 단위 추정:', shares, '\u2192', shares * 1000000);
      shares = shares * 1000000;
    } else if (shares > 0 && shares < 1000) {
      console.warn('[KRX-FIN] shares_outstanding 비정상 범위:', shares, '\u2014 EPS 계산 생략');
      shares = 0;
    }
    if (shares > 0) {
      // ni(억원) → 원 환산 후 주당 계산
      epsNum = Math.round(ni * 100000000 / shares);
    }
  }

  // BPS 결정: DART 직접값 → shares_outstanding 기반 계산
  // [FIX-9] shares_outstanding > 0 가드 추가 (0 나누기 방어)
  let bpsNum = typeof latest.bps === 'number' ? latest.bps : null;
  if (!bpsNum && latest.shares_outstanding && latest.shares_outstanding > 0 && latest.total_equity) {
    // total_equity(억원) → 원 환산 후 주당 계산
    bpsNum = Math.round(Number(latest.total_equity) * 100000000 / latest.shares_outstanding);
  }

  // EPS/BPS 표시 업데이트 (shares_outstanding에서 계산된 값 반영)
  if (epsNum) {
    set('fin-eps', Number(epsNum).toLocaleString() + '원');
    setClass('fin-eps', 'fin-grid-value' + (epsNum < 0 ? ' dn' : ''));
  }
  if (bpsNum) {
    set('fin-bps', Number(bpsNum).toLocaleString() + '원');
    setClass('fin-bps', 'fin-grid-value' + (bpsNum < 0 ? ' dn' : ''));
  }

  // PER 계산 우선순위:
  //   1순위: currentPrice / EPS (주당순이익 직접 or shares 기반)
  //   2순위: mcapEok / niEok   (시총/순이익 — shares 없을 때)
  // [FIX] 이중 반올림 방지: toFixed(1) 한 번만 적용
  let perVal = null;
  if (currentPrice && epsNum > 0) {
    perVal = +(currentPrice / epsNum).toFixed(1);
  } else if (!epsNum && mcapEok && ni > 0) {
    perVal = +(mcapEok / ni).toFixed(1);
  }
  if (perVal != null && perVal > 0) {
    set('fin-per', perVal + '배');
    setClass('fin-per', 'fin-grid-value');
  } else if (currentPrice && (epsNum <= 0 || ni <= 0)) {
    set('fin-per', '적자');
    setClass('fin-per', 'fin-grid-value');
  } else {
    set('fin-per', '\u2014');
  }

  // PBR 계산 우선순위:
  //   1순위: currentPrice / BPS (주당순자산 직접 or shares 기반)
  //   2순위: mcapEok / totalEquityEok (시총/자본총계 — shares 없을 때)
  let pbrVal = null;
  const totalEquityNum = Number(latest.total_equity) || 0;
  if (currentPrice && bpsNum && bpsNum > 0) {
    pbrVal = +(currentPrice / bpsNum).toFixed(2);
  } else if (!bpsNum && mcapEok && totalEquityNum > 0) {
    pbrVal = +(mcapEok / totalEquityNum).toFixed(2);
  }
  if (pbrVal != null && pbrVal > 0) {
    set('fin-pbr', pbrVal.toFixed(2) + '배');
    setClass('fin-pbr', 'fin-grid-value');
  } else {
    set('fin-pbr', '\u2014');
  }

  // PSR = 시가총액(억원) / TTM 매출액(억원)
  // latest.rev는 분기 매출 → 최근 4분기 합(TTM)으로 보정, 연간 데이터면 그대로 사용
  let psrVal = null;
  let revTTM = rev;
  if (latest.p && latest.p.includes('Q') && data.length >= 4) {
    // 분기 데이터: 최근 4분기 합산
    let sum = 0, qCount = 0;
    for (let qi = 0; qi < data.length && qCount < 4; qi++) {
      if (data[qi].p && data[qi].p.includes('Q') && data[qi].rev) {
        sum += Number(data[qi].rev) || 0;
        qCount++;
      }
    }
    if (qCount === 4) revTTM = sum;
  }
  if (mcapEok && revTTM > 0) {
    psrVal = +(mcapEok / revTTM).toFixed(2);
    set('fin-psr', psrVal.toFixed(2) + '배');
    setClass('fin-psr', 'fin-grid-value');
  } else {
    set('fin-psr', '\u2014');
  }

  // ── Yield Gap (Fed/BOK Model): 이익수익률 vs 국고채 10년물 ──
  // E/P = 1/PER (%), Yield Gap = E/P - KTB10Y
  // 양수 → 주식이 채권 대비 저평가 (bullish), 음수 → 고평가 (bearish)
  if (perVal && perVal > 0) {
    var earningsYield = (1 / perVal) * 100; // E/P (%)
    // KTB10Y: macro → bonds_latest → fallback 3.5%
    var ktb10y = (_macroData && _macroData.ktb10y != null) ? _macroData.ktb10y
      : (_bondsLatest && _bondsLatest.yields && _bondsLatest.yields.ktb_10y != null) ? _bondsLatest.yields.ktb_10y
      : 3.5;
    var yieldGapVal = +(earningsYield - ktb10y).toFixed(2);
    var yieldGapStr = (yieldGapVal >= 0 ? '+' : '') + yieldGapVal.toFixed(2) + '%p';
    set('fin-yield-gap', yieldGapStr);
    // 양수(저평가) = fin-good 초록, 음수(고평가) = dn 파랑
    setClass('fin-yield-gap', 'fin-grid-value' + (yieldGapVal >= 0 ? ' up' : ' dn'));
  } else {
    set('fin-yield-gap', '\u2014');
    setClass('fin-yield-gap', 'fin-grid-value');
  }

  // ── CAPM Beta (core_data/25 §1.2) ──
  _renderCAPMBeta(currentStock);
  // ── Merton Distance-to-Default (Doc35 §6.1-6.5) ──
  _renderDD(currentStock);
  // ── Blume Beta + Alpha Significance (Doc 25 §9.3-9.4) ──
  _renderBlumeBetaAlpha(currentStock);
  // ── FF3 Factor Exposure (Fama-French 1993, core_data/23 §3.2) ──
  _renderFF3Factors(currentStock);

  // ── 성장성: 3년 CAGR 계산 ──
  const annualData = await getFinancialData(currentStock.code, 'annual');
  _calcCAGR(annualData, set, setClass);

  // ── 투자판단 점수 (0~100) ──
  _calcInvestmentScore({
    perVal, pbrVal, psrVal, roaVal, npmVal, debtRatio,
    roe: parseFloat(latest.roe) || 0,
    opm: parseFloat(latest.opm) || 0,
    annualData,
  }, set, setClass);

  // ── 경기순환 국면 표시 (OECD CLI 4-phase, core_data/29 §1.2) ──
  _renderCyclePhase();
  // ── 수익률곡선 레짐 (Doc35 §3, NSS slope) ──
  _renderYieldCurve();
  // ── EVA Spread (Doc 14 §2.8, Stern Stewart 1991) ──
  _renderEVA(currentStock);
  // ── 채권 듀레이션/DV01 (Doc 44) ──
  _renderBondMetrics();

  // YoY/QoQ 변화율 계산
  _calcFinChanges(data);

  // 영업이익률 스파크라인
  drawOPMSparkline(data);

  // ── Phase 2: 추이 차트 (최초 로드 시 매출 탭) ──
  _finTrendData = data;
  _finTrendMetric = 'revenue';
  // 활성 탭 리셋
  const tabs = document.querySelectorAll('.fin-trend-tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.metric === 'revenue'));
  drawFinTrendChart(data, 'revenue');

  // ── 업종 비교 렌더링 ──
  _renderSectorComparison();

  // ── 동종업종 비교 테이블 ──
  _renderPeerGroup();

  // ── PER 밴드 차트 ──
  _drawPERBandChart();
}

/**
 * 시가총액 (억원) 산출 — sidebarManager.MARKET_CAP 또는 shares_outstanding 기반
 */
function _getMarketCapEok(code, currentPrice, sharesOutstanding) {
  // 1. sidebarManager.MARKET_CAP (하드코딩 — IIFE에서 public으로 노출)
  if (typeof sidebarManager !== 'undefined' && sidebarManager.MARKET_CAP) {
    const mcap = sidebarManager.MARKET_CAP[code];
    if (mcap) return mcap;
  }
  // 2. shares_outstanding * currentPrice (원→억원)
  if (sharesOutstanding && currentPrice) {
    return +(sharesOutstanding * currentPrice / 100000000).toFixed(0);
  }
  return null;
}

/**
 * 3년 CAGR (연평균 성장률) 계산
 * CAGR = (V_end / V_start)^(1/n) - 1
 */
function _calcCAGR(annualData, set, setClass) {
  if (!annualData || annualData.length < 2) {
    set('fin-rev-cagr', '\u2014');
    set('fin-ni-cagr', '\u2014');
    return;
  }

  const newest = annualData[0];
  const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
  const years = annualData.length >= 4 ? 3 : (annualData.length - 1);

  if (years <= 0) {
    set('fin-rev-cagr', '\u2014');
    set('fin-ni-cagr', '\u2014');
    return;
  }

  // 매출 CAGR
  const revEnd = Number(newest.rev) || 0;
  const revStart = Number(oldest.rev) || 0;
  if (revStart > 0 && revEnd > 0) {
    const revCagr = (Math.pow(revEnd / revStart, 1 / years) - 1) * 100;
    set('fin-rev-cagr', (revCagr >= 0 ? '+' : '') + revCagr.toFixed(1) + '%');
    setClass('fin-rev-cagr', 'fin-grid-value ' + (revCagr >= 0 ? 'up' : 'dn'));
  } else {
    set('fin-rev-cagr', '\u2014');
  }

  // 순이익 CAGR
  const niEnd = Number(newest.ni) || 0;
  const niStart = Number(oldest.ni) || 0;
  if (niStart > 0 && niEnd > 0) {
    const niCagr = (Math.pow(niEnd / niStart, 1 / years) - 1) * 100;
    set('fin-ni-cagr', (niCagr >= 0 ? '+' : '') + niCagr.toFixed(1) + '%');
    setClass('fin-ni-cagr', 'fin-grid-value ' + (niCagr >= 0 ? 'up' : 'dn'));
  } else if (niStart < 0 && niEnd > 0) {
    set('fin-ni-cagr', '흑자전환');
    setClass('fin-ni-cagr', 'fin-grid-value up');
  } else if (niStart > 0 && niEnd < 0) {
    set('fin-ni-cagr', '적자전환');
    setClass('fin-ni-cagr', 'fin-grid-value dn');
  } else {
    set('fin-ni-cagr', '\u2014');
  }
}

/**
 * 업종 벤치마크 조회 (sector_fundamentals.json)
 * @param {string} field - avgPer, avgPbr, avgRoe, avgOpm
 * @returns {number|null}
 */
function _getSectorAvg(field) {
  if (typeof _sectorData === 'undefined' || !_sectorData || !_sectorData.sectors ||
      typeof currentStock === 'undefined' || !currentStock) return null;
  var stockInfo = (typeof ALL_STOCKS !== 'undefined' && ALL_STOCKS)
    ? ALL_STOCKS.find(function(s) { return s.code === currentStock.code; }) : null;
  if (!stockInfo) return null;
  var sectorName = stockInfo.industry || stockInfo.sector || '';
  if (!sectorName || !_sectorData.sectors[sectorName]) {
    sectorName = stockInfo.sector || '';
  }
  if (sectorName && _sectorData.sectors[sectorName]) {
    var val = _sectorData.sectors[sectorName][field];
    if (val != null && !isNaN(val)) return val;
  }
  // 업종 없으면 시장 평균 폴백
  var marketAvg = (currentStock.market === 'KOSDAQ')
    ? (_sectorData.kosdaqAvg || {})
    : (_sectorData.kospiAvg || {});
  var key = field.replace('avg', '').toLowerCase();
  return (marketAvg[key] != null) ? marketAvg[key] : null;
}

/**
 * 투자판단 점수 (0~100) — DuPont 3-Factor + 업종 상대평가
 *
 * 항목별 배점 (V39 DuPont 재설계):
 *   DuPont (50점): 순이익률(20) + 자산회전률(15) + 자본승수 적정성(15)
 *   밸류에이션 업종 대비 (30점): PER(15) + PBR(15)
 *   성장+안정 (20점): 매출 CAGR(10) + 부채비율(10)
 */
function _calcInvestmentScore(params, set, setClass) {
  const { perVal, pbrVal, debtRatio, roe, opm, roaVal, npmVal, annualData } = params;
  let score = 0;
  let maxPossible = 0;

  // ── DuPont 3-Factor (50점) ──
  // ROE = Net Margin × Asset Turnover × Equity Multiplier

  // 1. 순이익률 (NPM) 업종 대비 — 20점
  if (npmVal != null && !isNaN(npmVal)) {
    maxPossible += 20;
    var sectorOpm = _getSectorAvg('avgOpm') || 8;
    var npmRatio = npmVal / Math.max(sectorOpm, 0.1);
    if (npmRatio >= 1.5) score += 20;
    else if (npmRatio >= 1.0) score += 15;
    else if (npmRatio >= 0.5) score += 10;
    else if (npmVal > 0) score += 5;
  }

  // 2. 자산회전률 (Asset Turnover = Revenue / Total Assets) — 15점
  var assetTurnover = null;
  if (annualData && annualData.length > 0) {
    var latestAnn = annualData[0];
    if (latestAnn.rev > 0 && latestAnn.total_assets > 0) {
      assetTurnover = latestAnn.rev / latestAnn.total_assets;
    }
  }
  if (assetTurnover != null) {
    maxPossible += 15;
    // 한국 상장사 중앙값 ~0.7, 업종별 편차 크지만 벤치마크 미보유 → 절대 임계값
    if (assetTurnover >= 1.2) score += 15;
    else if (assetTurnover >= 0.8) score += 12;
    else if (assetTurnover >= 0.4) score += 8;
    else if (assetTurnover > 0) score += 4;
  }

  // 3. 자본승수 적정성 (Equity Multiplier = Total Assets / Total Equity) — 15점
  var equityMult = null;
  if (annualData && annualData.length > 0) {
    var latestAnn2 = annualData[0];
    if (latestAnn2.total_assets > 0 && latestAnn2.total_equity > 0) {
      equityMult = latestAnn2.total_assets / latestAnn2.total_equity;
    }
  }
  if (equityMult != null) {
    maxPossible += 15;
    // 적정 레버리지 1.0~3.0 (업종 중앙값 ±1σ 근사), >5.0 과다
    if (equityMult >= 1.0 && equityMult <= 3.0) score += 15;
    else if (equityMult > 3.0 && equityMult <= 5.0) score += 8;
    else score += 3;
  }

  // ── 밸류에이션 업종 상대평가 (30점): PER 15점 + PBR 15점 ──
  if (perVal != null && perVal > 0) {
    maxPossible += 15;
    var sectorPer = _getSectorAvg('avgPer') || 15;
    var perRatio = perVal / Math.max(sectorPer, 1);
    // 업종 대비 저PER → 고점, 고PER → 저점
    if (perRatio < 0.5) score += 15;
    else if (perRatio < 0.8) score += 12;
    else if (perRatio <= 1.2) score += 8;
    else if (perRatio <= 2.0) score += 4;
  }
  if (pbrVal != null && pbrVal > 0) {
    maxPossible += 15;
    var sectorPbr = _getSectorAvg('avgPbr') || 1.2;
    var pbrRatio = pbrVal / Math.max(sectorPbr, 0.1);
    if (pbrRatio < 0.5) score += 15;
    else if (pbrRatio < 0.8) score += 12;
    else if (pbrRatio <= 1.2) score += 8;
    else if (pbrRatio <= 2.0) score += 4;
  }

  // ── 성장+안정 (20점): 매출 CAGR 10점 + 부채비율 10점 ──
  if (annualData && annualData.length >= 2) {
    const newest = annualData[0];
    const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
    const yrs = annualData.length >= 4 ? 3 : (annualData.length - 1);
    const rEnd = Number(newest.rev) || 0;
    const rStart = Number(oldest.rev) || 0;
    if (rStart > 0 && rEnd > 0 && yrs > 0) {
      maxPossible += 10;
      const cagr = (Math.pow(rEnd / rStart, 1 / yrs) - 1) * 100;
      if (cagr >= 20) score += 10;
      else if (cagr >= 10) score += 8;
      else if (cagr >= 5) score += 6;
      else if (cagr >= 0) score += 3;
    }
  }
  if (debtRatio != null && !isNaN(debtRatio)) {
    maxPossible += 10;
    if (debtRatio < 50) score += 10;
    else if (debtRatio <= 100) score += 8;
    else if (debtRatio <= 200) score += 5;
    else if (debtRatio <= 300) score += 2;
  }

  // 최소 2개 항목 활성 필요 (최소 maxPossible >= 30)
  if (maxPossible < 30) {
    set('fin-score', '\u2014');
    set('fin-grade', '\u2014');
    return;
  }

  const normalizedScore = Math.round(score / maxPossible * 100);
  const finalScore = Math.min(100, Math.max(0, normalizedScore));

  set('fin-score', finalScore);
  if (finalScore >= 70) {
    setClass('fin-score', 'fin-grid-value fin-score score-high');
  } else if (finalScore >= 40) {
    setClass('fin-score', 'fin-grid-value fin-score score-mid');
  } else {
    setClass('fin-score', 'fin-grid-value fin-score score-low');
  }

  // 등급: A (80+), B (60~79), C (40~59), D (<40)
  let grade, gradeCls;
  if (finalScore >= 80) { grade = 'A'; gradeCls = 'fin-grade-a'; }
  else if (finalScore >= 60) { grade = 'B'; gradeCls = 'fin-grade-b'; }
  else if (finalScore >= 40) { grade = 'C'; gradeCls = 'fin-grade-c'; }
  else { grade = 'D'; gradeCls = 'fin-grade-d'; }

  set('fin-grade', grade);
  setClass('fin-grade', 'fin-grid-value ' + gradeCls);
}

/**
 * 재무지표 YoY/QoQ 변화율 계산
 * YoY: 전년 동기 대비 (index 4 = 4분기 전)
 * QoQ: 전분기 대비 (index 1)
 */
function _calcFinChanges(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  // [FIX-5] 흑자전환/적자전환 마커도 색상 반영
  const setChangeClass = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val === '__흑자전환__') { el.className = 'fin-change up'; return; }
    if (val === '__적자전환__') { el.className = 'fin-change dn'; return; }
    el.className = 'fin-change' + (val > 0 ? ' up' : val < 0 ? ' dn' : '');
  };

  const latest = data[0];
  const prevQ = data.length > 1 ? data[1] : null;   // 전분기
  const prevY = data.length > 4 ? data[4] : null;    // 전년 동기

  // [FIX-5] prev=0 → 흑자전환/적자전환 특수 마커 반환
  const TURNAROUND_POS = '__흑자전환__';
  const TURNAROUND_NEG = '__적자전환__';
  const calcPct = (cur, prev) => {
    if (prev == null) return null;
    if (prev === 0) {
      if (cur > 0) return TURNAROUND_POS;
      if (cur < 0) return TURNAROUND_NEG;
      return null; // 0→0: 변화 없음
    }
    return ((cur - prev) / Math.abs(prev) * 100);
  };

  const fmtPct = (label, pct) => {
    if (pct == null) return label + ' \u2014';
    if (pct === TURNAROUND_POS) return label + ' 흑자전환';
    if (pct === TURNAROUND_NEG) return label + ' 적자전환';
    const sign = pct >= 0 ? '+' : '';
    return label + ' ' + sign + pct.toFixed(1) + '%';
  };

  // 매출액
  const revYoY = prevY ? calcPct(Number(latest.rev), Number(prevY.rev)) : null;
  const revQoQ = prevQ ? calcPct(Number(latest.rev), Number(prevQ.rev)) : null;
  set('fin-rev-yoy', fmtPct('YoY', revYoY));
  set('fin-rev-qoq', fmtPct('QoQ', revQoQ));
  setChangeClass('fin-rev-yoy', revYoY);
  setChangeClass('fin-rev-qoq', revQoQ);

  // 영업이익
  const opYoY = prevY ? calcPct(Number(latest.op), Number(prevY.op)) : null;
  const opQoQ = prevQ ? calcPct(Number(latest.op), Number(prevQ.op)) : null;
  set('fin-op-yoy', fmtPct('YoY', opYoY));
  set('fin-op-qoq', fmtPct('QoQ', opQoQ));
  setChangeClass('fin-op-yoy', opYoY);
  setChangeClass('fin-op-qoq', opQoQ);

  // 순이익
  const niYoY = prevY ? calcPct(Number(latest.ni), Number(prevY.ni)) : null;
  const niQoQ = prevQ ? calcPct(Number(latest.ni), Number(prevQ.ni)) : null;
  set('fin-ni-yoy', fmtPct('YoY', niYoY));
  set('fin-ni-qoq', fmtPct('QoQ', niQoQ));
  setChangeClass('fin-ni-yoy', niYoY);
  setChangeClass('fin-ni-qoq', niQoQ);
}

function drawOPMSparkline(data) {
  const canvas = document.getElementById('opm-sparkline');
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // 레이아웃: 상단 값 라벨 + 차트 영역 + 하단 분기 라벨
  const topLabelH = 14;   // 퍼센트 값 표시 영역
  const bottomLabelH = 14; // 분기 라벨 영역
  const paddingL = 16;     // 좌측 여백 (첫 라벨 잘림 방지)
  const paddingR = 16;     // 우측 여백

  // [FIX] 부모 크기에 맞게 동적 계산 — 최소 100px 보장
  const w = Math.max((canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 200), 100);
  const h = Math.max(80, Math.min(120, Math.round(w * 0.40)));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // 차트 그리기 영역 (상단/하단 라벨 제외)
  const chartTop = topLabelH;
  const chartH = h - topLabelH - bottomLabelH;
  const chartW = w - paddingL - paddingR;

  const values = data.map(d => parseFloat(d.opm) || 0).reverse();
  const labels = data.map(d => _sparklineLabel(d.p)).reverse();
  if (values.length < 2) return;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const pad = 4; // 상하 내부 패딩

  // 좌표 계산 헬퍼
  const ptX = (i) => paddingL + (i / (values.length - 1)) * chartW;
  const ptY = (v) => chartTop + pad + ((maxVal - v) / range) * (chartH - 2 * pad);

  // 포인트 배열 미리 계산
  var points = [];
  for (var i = 0; i < values.length; i++) {
    points.push({ x: ptX(i), y: ptY(values[i]) });
  }

  // 0% 기준선의 Y 좌표 (영역 채우기 기준점으로도 사용)
  var baseY = chartTop + chartH; // 기본: 차트 하단
  var hasZeroLine = minVal < 0 && maxVal > 0;
  var zeroY = hasZeroLine ? ptY(0) : baseY;

  // ── 1) 영역 채우기 (그라디언트) ──
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  // 아래로 닫기: 0% 기준선 (양수/음수 혼재) 또는 차트 하단까지
  ctx.lineTo(points[points.length - 1].x, hasZeroLine ? zeroY : baseY);
  ctx.lineTo(points[0].x, hasZeroLine ? zeroY : baseY);
  ctx.closePath();
  var gradient = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH);
  gradient.addColorStop(0, KRX_COLORS.ACCENT_FILL(0.20));
  gradient.addColorStop(1, KRX_COLORS.ACCENT_FILL(0.02));
  ctx.fillStyle = gradient;
  ctx.fill();

  // ── 2) 0% 기준선 (양수/음수 혼재 시) ──
  if (hasZeroLine) {
    ctx.save();
    ctx.strokeStyle = KRX_COLORS.WHITE_FILL(0.25);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(paddingL, zeroY);
    ctx.lineTo(w - paddingR, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // "0%" 라벨
    ctx.fillStyle = KRX_COLORS.WHITE_FILL(0.35);
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0%', paddingL - 3, zeroY);
  }

  // ── 3) 라인 ──
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = KRX_COLORS.ACCENT;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── 4) 원형 마커 (각 데이터 포인트) ──
  for (i = 0; i < points.length; i++) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = values[i] >= 0 ? KRX_COLORS.ACCENT : KRX_COLORS.DOWN;
    ctx.fill();
  }

  // ── 5) 퍼센트 값 텍스트 (마커 위) ──
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // 라벨 표시 간격: 6개 이하면 모두, 아니면 짝수 인덱스 + 마지막
  var showAll = values.length <= 6;
  for (i = 0; i < points.length; i++) {
    if (!showAll && i % 2 !== 0 && i !== points.length - 1) continue;
    ctx.fillStyle = values[i] >= 0
      ? KRX_COLORS.CHART_TEXT || KRX_COLORS.WHITE_FILL(0.7)
      : KRX_COLORS.DOWN;
    ctx.fillText(values[i].toFixed(1) + '%', points[i].x, points[i].y - 6);
  }

  // ── 6) X축 분기 라벨 (하단) ──
  ctx.font = "10px 'Pretendard', sans-serif";
  ctx.fillStyle = KRX_COLORS.WHITE_FILL(0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  var maxLabels = 6;
  var step = values.length <= maxLabels ? 1 : Math.ceil(values.length / maxLabels);
  for (i = 0; i < points.length; i++) {
    if (i % step !== 0 && i !== points.length - 1) continue;
    ctx.fillText(labels[i] || '', points[i].x, chartTop + chartH + 2);
  }
}

/**
 * 분기 라벨 축약: "2025 Q3" -> "Q3'25", "2024" -> "'24"
 */
function _sparklineLabel(p) {
  if (!p) return '';
  const qm = p.match(/^(\d{4})\s*Q(\d)$/);
  if (qm) return `Q${qm[2]}'${qm[1].slice(2)}`;
  const ym = p.match(/^(\d{4})$/);
  if (ym) return `'${ym[1].slice(2)}`;
  return p;
}

// ══════════════════════════════════════════════════════
//  추이 차트 (Phase 2 — 매출/영익 바차트 + EPS 라인차트)
// ══════════════════════════════════════════════════════

/**
 * 추이 차트 그리기 (매출/영익: 바차트, EPS: 라인차트)
 * drawOPMSparkline()과 동일한 패턴.
 * @param {Array} data - 재무 데이터 배열 (최신순)
 * @param {string} metric - 'revenue' | 'op' | 'eps'
 */
function drawFinTrendChart(data, metric) {
  const canvas = document.getElementById('fin-trend-canvas');
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const labelHeight = 14;
  // [FIX] 부모 크기에 맞게 동적 계산
  const w = Math.max((canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 190), 100);
  const h = Math.max(70, Math.min(110, Math.round(w * 0.35)));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const chartH = h - labelHeight;

  // 최근 8분기, 과거→최신 순서로 정렬
  const sliced = data.slice(0, 8).reverse();
  const labels = sliced.map(d => _sparklineLabel(d.p));

  // 메트릭에 따른 값 추출
  const keyMap = { revenue: 'rev', op: 'op', eps: 'eps' };
  const key = keyMap[metric] || 'rev';
  const values = sliced.map(d => Number(d[key]) || 0);

  if (values.length < 1) return;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const absMax = Math.max(Math.abs(max), Math.abs(min)) || 1;

  // 0선 위치 (양수/음수 공존 시) — 실제 데이터 범위 기반
  const hasNeg = min < 0;
  const absMin = Math.abs(min);
  const zeroY = max <= 0
    ? 0                                           // 전부 음수: 0선이 꼭대기
    : min >= 0
      ? chartH                                    // 전부 양수: 0선이 바닥
      : chartH * (Math.abs(max) / (Math.abs(max) + absMin));  // 혼재: 비례 배치

  if (metric === 'eps') {
    // ── EPS: 라인차트 + 점 ──
    const range = max - min || 1;
    const pad = 4;

    // 영역 채우기
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(w, chartH);
    ctx.lineTo(0, chartH);
    ctx.closePath();
    ctx.fillStyle = KRX_COLORS.ACCENT_FILL(0.08);
    ctx.fill();

    // 라인
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = KRX_COLORS.ACCENT;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 데이터 포인트
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = v >= 0 ? KRX_COLORS.UP : KRX_COLORS.DOWN;
      ctx.fill();
    });

  } else {
    // ── 매출/영익: 바차트 ──
    const barCount = values.length;
    const gap = 3;
    const barW = Math.max(4, (w - gap * (barCount + 1)) / barCount);

    values.forEach((v, i) => {
      const x = gap + i * (barW + gap);
      // 양수: zeroY 위 공간, 음수: zeroY 아래 공간에 비례
      const maxH = v >= 0 ? (zeroY || 1) : ((chartH - zeroY) || 1);
      const barH = (Math.abs(v) / absMax) * (hasNeg ? maxH : chartH - 2);

      ctx.fillStyle = v >= 0
        ? KRX_COLORS.UP_FILL(0.65)    // 양수: 빨강
        : KRX_COLORS.DOWN_FILL(0.65); // 음수: 파랑

      if (v >= 0) {
        ctx.fillRect(x, zeroY - barH, barW, barH);
      } else {
        ctx.fillRect(x, zeroY, barW, barH);
      }
    });

    // 0선 (음수가 있을 때만)
    if (hasNeg) {
      ctx.strokeStyle = KRX_COLORS.WHITE_FILL(0.15);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();
    }

    // 바 위에 값 표시 (억원 → 조/억 단위) — 겹침 방지 thinning
    ctx.fillStyle = KRX_COLORS.WHITE_FILL(0.7);
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    var prevLabelX = null;
    values.forEach((v, i) => {
      var barX = gap + i * (barW + gap);
      var maxH2 = v >= 0 ? (zeroY || 1) : ((chartH - zeroY) || 1);
      var barH = (Math.abs(v) / absMax) * (hasNeg ? maxH2 : chartH - 2);
      var text = '';
      if (Math.abs(v) >= 10000) {         // 1조 이상 (값은 억원 단위)
        text = (v / 10000).toFixed(1) + '조';
      } else if (Math.abs(v) >= 100) {     // 100억 이상
        text = Math.round(v) + '억';
      }
      if (text) {
        var centerX = barX + barW / 2;
        var labelWidth = ctx.measureText(text).width;
        // 이전 라벨과 너무 가까우면 건너뜀 (겹침 방지)
        if (prevLabelX != null && Math.abs(centerX - prevLabelX) < labelWidth + 4) {
          return; // skip this label
        }
        if (v >= 0) {
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, centerX, zeroY - barH - 2);
        } else {
          ctx.textBaseline = 'top';
          ctx.fillText(text, centerX, zeroY + barH + 2);
        }
        prevLabelX = centerX;
      }
    });
  }

  // ── 분기 라벨 (x축 하단) ──
  ctx.font = "10px 'Pretendard', sans-serif";
  ctx.fillStyle = KRX_COLORS.WHITE_FILL(0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxLabels = 6;
  const step = values.length <= maxLabels ? 1 : Math.ceil(values.length / maxLabels);

  if (metric === 'eps') {
    values.forEach((v, i) => {
      if (i % step !== 0 && i !== values.length - 1) return;
      const x = (i / Math.max(values.length - 1, 1)) * w;
      ctx.fillText(labels[i] || '', x, chartH + 2);
    });
  } else {
    const barCount = values.length;
    const gap = 3;
    const barW = Math.max(4, (w - gap * (barCount + 1)) / barCount);
    values.forEach((v, i) => {
      if (i % step !== 0 && i !== values.length - 1) return;
      const x = gap + i * (barW + gap) + barW / 2;
      ctx.fillText(labels[i] || '', x, chartH + 2);
    });
  }
}

// ══════════════════════════════════════════════════════
//  업종 비교 (P1 — FnGuide 스타일 3열 비교 테이블)
// ══════════════════════════════════════════════════════

/**
 * 퍼센트 문자열 파싱: "14.1%" → 14.1, 숫자 → 그대로
 */
function _parsePercent(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  var s = String(val).replace('%', '').trim();
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 업종 비교 테이블 렌더링
 * 현재 종목의 ROE/OPM을 업종 평균, 시장 평균과 비교
 */
function _renderSectorComparison() {
  var container = document.getElementById('fin-compare');
  if (!container) return;

  // 전역 변수 존재 여부 확인
  if (typeof currentStock === 'undefined' || !currentStock ||
      typeof ALL_STOCKS === 'undefined' ||
      typeof _sectorData === 'undefined' || !_sectorData) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 데이터 없음</div>';
    return;
  }

  // 현재 종목의 섹터 찾기 (industry 우선, sector 폴백)
  var stockInfo = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
  var sectorName = stockInfo ? (stockInfo.industry || stockInfo.sector || '') : '';

  // sector_fundamentals 키 매칭: industry로 먼저 시도, 없으면 sector로 재시도
  if (!sectorName || !_sectorData.sectors || !_sectorData.sectors[sectorName]) {
    var fallbackSector = stockInfo ? (stockInfo.sector || '') : '';
    if (fallbackSector && _sectorData.sectors && _sectorData.sectors[fallbackSector]) {
      sectorName = fallbackSector;
    }
  }

  if (!sectorName || !_sectorData.sectors || !_sectorData.sectors[sectorName]) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 데이터 없음</div>';
    return;
  }

  var sectorAvg = _sectorData.sectors[sectorName];
  var marketAvg = (currentStock.market === 'KOSDAQ')
    ? (_sectorData.kosdaqAvg || {})
    : (_sectorData.kospiAvg || {});

  // 현재 종목의 ROE/OPM (updateFinancials에서 캐시된 값)
  var myRoe = _latestFinRoe;
  var myOpm = _latestFinOpm;

  // FnGuide 스타일 3열 비교 테이블
  var html = '<div class="fin-compare-header">' +
    '<span class="fin-compare-sector">' + sectorName + '</span>' +
    '<span class="fin-compare-count">' + (sectorAvg.count || 0) + '개 종목</span>' +
  '</div>';

  html += '<table class="fin-compare-table">' +
    '<thead><tr>' +
      '<th></th><th>기업</th><th>업종평균</th><th>' + (currentStock.market || 'KOSPI') + '</th>' +
    '</tr></thead><tbody>';

  // ROE 비교 (높을수록 양호)
  html += _compareRow('ROE', myRoe, sectorAvg.avgRoe, marketAvg.roe, '%', true);

  // OPM 비교 (높을수록 양호)
  html += _compareRow('영업이익률', myOpm, sectorAvg.avgOpm, marketAvg.opm, '%', true);

  html += '</tbody></table>';

  container.innerHTML = html;
}

/**
 * 비교 테이블 행 생성
 * @param {string} label - 지표명
 * @param {number} myVal - 기업 값
 * @param {number} sectorVal - 업종 평균
 * @param {number} marketVal - 시장 평균
 * @param {string} unit - 단위 (%, 배 등)
 * @param {boolean} higherIsBetter - true면 높을수록 양호
 */
function _compareRow(label, myVal, sectorVal, marketVal, unit, higherIsBetter) {
  var fmt = function(v) {
    if (v == null || v === 0) return '-';
    return (typeof v === 'number') ? v.toFixed(1) + unit : String(v);
  };

  // 색상: 기업이 업종평균보다 좋으면 초록, 나쁘면 톤다운 빨강
  var myClass = '';
  if (myVal && sectorVal && sectorVal > 0) {
    if (higherIsBetter) {
      myClass = myVal >= sectorVal ? 'fin-cmp-good' : 'fin-cmp-bad';
    } else {
      myClass = myVal <= sectorVal ? 'fin-cmp-good' : 'fin-cmp-bad';
    }
  }

  return '<tr>' +
    '<td class="fin-cmp-label">' + label + '</td>' +
    '<td class="fin-cmp-val ' + myClass + '">' + fmt(myVal) + '</td>' +
    '<td class="fin-cmp-val">' + fmt(sectorVal) + '</td>' +
    '<td class="fin-cmp-val">' + fmt(marketVal) + '</td>' +
  '</tr>';
}

// ══════════════════════════════════════════════════════
//  동종업종 비교 (Peer Group — FnGuide/Seeking Alpha 스타일)
// ══════════════════════════════════════════════════════

var _peerPreloading = false;

/**
 * 퍼센트 값 포맷: 0 또는 null → '-', 그 외 → '3.0%'
 */
function _fmtPct(val) {
  if (val == null || val === 0) return '-';
  return val.toFixed(1) + '%';
}

/**
 * peer 종목의 재무 데이터를 _financialCache에서 동기적으로 가져오기
 * @param {string} code - 종목코드
 * @returns {{roe: number, opm: number, debtRatio: number}}
 */
function _getPeerFinancials(code) {
  var result = { roe: 0, opm: 0, debtRatio: 0 };

  try {
    // data.js의 _financialCache는 전역 const — 직접 접근 가능
    if (typeof _financialCache !== 'undefined' && _financialCache[code]) {
      var cached = _financialCache[code];
      // [CLEAN-DATA] seed 생성 가짜 데이터는 peer 비교에서도 표시하지 않음
      if (cached.source !== 'dart' && cached.source !== 'hardcoded') return result;
      var q = cached.quarterly || [];
      if (q.length > 0) {
        var latest = q[0]; // 최신순 정렬 (getFinancialData에서 sort)
        result.roe = typeof latest.roe === 'number' ? latest.roe : _parsePercent(latest.roe);
        result.opm = _parsePercent(latest.opm);
        result.debtRatio = latest.debt_ratio != null ? parseFloat(latest.debt_ratio) : 0;
      }
    }
  } catch (e) {
    console.debug('[PeerGroup] 재무 데이터 접근 실패:', code, e.message);
  }

  return result;
}

/**
 * peer 종목의 재무 데이터 비동기 프리로드
 * getFinancialData()는 내부적으로 _financialCache에 저장하므로
 * 프리로드 후 _renderPeerGroup() 재호출 시 캐시에서 즉시 사용 가능.
 * @param {Array} peers - ALL_STOCKS 항목 배열
 */
async function _preloadPeerFinancials(peers) {
  var loaded = 0;
  for (var i = 0; i < peers.length; i++) {
    if (typeof _financialCache !== 'undefined' && _financialCache[peers[i].code]) continue;
    if (typeof getFinancialData === 'function') {
      try {
        await getFinancialData(peers[i].code, 'quarter');
        loaded++;
      } catch (e) {
        // 개별 종목 실패는 무시 — 테이블에 '-'로 표시
      }
    }
  }
  // 프리로드 후 테이블 재렌더링
  if (loaded > 0) _renderPeerGroup();
}

/**
 * 동종업종 비교 테이블 렌더링
 * 같은 시장 + 같은 세부업종(industry) + 시총 유사도 기준으로 peer 4개 선정.
 * 세부업종 peer가 3개 미만이면 KSIC 광의 업종(KSIC_BROAD_MAP)으로 확장.
 * 종목명 클릭 시 해당 종목으로 전환.
 */
function _renderPeerGroup() {
  var container = document.getElementById('fin-peers');
  if (!container) return;

  if (typeof currentStock === 'undefined' || !currentStock ||
      typeof ALL_STOCKS === 'undefined') {
    container.innerHTML = '<div class="fin-compare-placeholder">데이터 없음</div>';
    return;
  }

  // 현재 종목의 업종 찾기 (industry 우선, sector 폴백)
  var myStock = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
  var myIndustry = myStock ? (myStock.industry || myStock.sector || '') : '';

  if (!myStock) {
    container.innerHTML = '<div class="fin-compare-placeholder">종목 정보 없음</div>';
    return;
  }

  // 섹터 라벨 업데이트 (WICS/FICS 기준 짧은 라벨)
  var titleEl = document.getElementById('fin-peers-title');
  if (titleEl) {
    var segLabel = _getSegmentLabel(myStock);
    titleEl.innerHTML = '동종업종 비교' + (segLabel ? ' <span class="fin-sector-tag">\u00B7 ' + segLabel + '</span>' : '');
  }
  var myMarket = myStock ? myStock.market : '';
  var myCap = myStock ? (myStock.marketCap || 0) : 0;

  if (!myIndustry) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 정보 없음</div>';
    return;
  }

  // 시총 하한 필터 (KOSPI 1000억, KOSDAQ 500억 — 초소형주 제외)
  var capFloor = (myMarket === 'KOSPI') ? 1000 : 500;

  // Step 1: 같은 시장 + 같은 세부업종 + 시총 필터
  var peers = ALL_STOCKS.filter(function(s) {
    if (s.code === currentStock.code) return false;
    if (s.market !== myMarket) return false;
    var sInd = s.industry || s.sector || '';
    if (sInd !== myIndustry) return false;
    if ((s.marketCap || 0) < capFloor) return false;
    return true;
  });

  // 시총 유사도 기준 정렬 (단순 내림차순 대신 현재 종목과 비슷한 규모 우선)
  if (myCap > 0) {
    peers.sort(function(a, b) {
      var aR = Math.min((a.marketCap || 1) / myCap, myCap / (a.marketCap || 1));
      var bR = Math.min((b.marketCap || 1) / myCap, myCap / (b.marketCap || 1));
      if (Math.abs(aR - bR) > 0.1) return bR - aR;  // 유사도 차이 큰 경우 유사도 우선
      return (b.marketCap || 0) - (a.marketCap || 0); // 유사도 비슷하면 시총 내림차순
    });
  } else {
    peers.sort(function(a, b) { return (b.marketCap || 0) - (a.marketCap || 0); });
  }
  peers = peers.slice(0, 4);  // 현재 종목 + 4개 = 총 5개

  // Fallback: 동일 세부업종 peer가 3개 미만이면 광의 업종으로 확장
  if (peers.length < 3) {
    var myBroad = _getBroadIndustry(myIndustry);
    var broadPeers = ALL_STOCKS.filter(function(s) {
      if (s.code === currentStock.code) return false;
      if (s.market !== myMarket) return false;
      if (peers.some(function(p) { return p.code === s.code; })) return false;
      var sInd = s.industry || s.sector || '';
      if (_getBroadIndustry(sInd) !== myBroad) return false;
      if ((s.marketCap || 0) < capFloor) return false;
      return true;
    });
    broadPeers.sort(function(a, b) { return (b.marketCap || 0) - (a.marketCap || 0); });
    peers = peers.concat(broadPeers.slice(0, 4 - peers.length));
  }

  // 현재 종목을 맨 앞에 추가
  peers.unshift(myStock);

  // 재무 데이터 프리로드 필요 여부 확인
  var needsPreload = peers.some(function(p) {
    return typeof _financialCache === 'undefined' || !_financialCache[p.code];
  });
  if (needsPreload && !_peerPreloading) {
    _peerPreloading = true;
    _preloadPeerFinancials(peers).then(function() { _peerPreloading = false; });
  }

  // 테이블 생성 — 현재 캐시된 데이터로 렌더링
  var html = '<table class="fin-peer-table"><thead><tr>' +
    '<th class="fin-peer-name">종목</th>' +
    '<th>ROE</th><th>OPM</th><th>부채</th><th>시총</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < peers.length; i++) {
    var p = peers[i];
    var isCurrent = (p.code === currentStock.code);
    var rowClass = isCurrent ? ' class="fin-peer-current"' : '';
    var prefix = isCurrent ? '\u25B8' : '';  // ▸

    // 재무 데이터 (캐시 또는 빈 값)
    var finData = _getPeerFinancials(p.code);

    // 시총 포맷 (억원 → 조/억 표시)
    var mcap = p.marketCap || 0;
    var mcapText = '-';
    if (mcap >= 10000) {
      mcapText = Math.round(mcap / 10000).toLocaleString() + '조';
    } else if (mcap > 0) {
      mcapText = mcap.toLocaleString() + '억';
    }

    // 종목명: 현재 종목은 강조, 나머지는 클릭 가능
    var nameHtml = isCurrent
      ? '<span class="fin-peer-me">' + prefix + p.name + '</span>'
      : '<a class="fin-peer-link" data-code="' + p.code + '">' + p.name + '</a>';

    html += '<tr' + rowClass + '>' +
      '<td class="fin-peer-name">' + nameHtml + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.roe) + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.opm) + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.debtRatio) + '</td>' +
      '<td class="fin-peer-val fin-peer-mcap">' + mcapText + '</td>' +
    '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // 종목 클릭 이벤트 — innerHTML 교체 시 기존 리스너 자동 제거되므로 중복 없음
  container.onclick = function(e) {
    var link = e.target.closest('.fin-peer-link');
    if (link && typeof selectStock === 'function') {
      selectStock(link.dataset.code);
    }
  };
}

// ══════════════════════════════════════════════════════
//  PER 밴드 차트 (FnGuide/Bloomberg 스타일)
//
//  과거 주가 위에 PER 배수 라인(8x, 12x, 16x, 20x)을
//  오버레이하여 현재 밸류에이션 구간 시각화.
//
//  데이터: dataService.cache 일봉 종가 + _financialCache EPS
// ══════════════════════════════════════════════════════

/**
 * 최근 EPS 추출 (연환산)
 * 우선순위:
 *   1. _financialCache quarterly 최신 분기의 eps 필드
 *   2. 순이익(ni) / 발행주식수 추정 × 4 (연환산)
 * @returns {number} 연환산 EPS (원). 산출 불가 시 0
 */
function _getLatestEPS() {
  if (!currentStock) return 0;

  if (typeof _financialCache !== 'undefined' && _financialCache[currentStock.code]) {
    var data = _financialCache[currentStock.code];
    // [CLEAN-DATA] seed 생성 가짜 데이터의 EPS는 사용하지 않음
    if (data.source !== 'dart' && data.source !== 'hardcoded') return 0;
    var q = data.quarterly || [];
    if (q.length > 0) {
      var latest = q[0]; // 최신순 정렬 (getFinancialData에서 sort)

      // 1순위: eps 필드 직접 사용 (연환산 × 4)
      if (latest.eps && Number(latest.eps) > 0) {
        // 분기 EPS → 연환산 (최근 4분기 합산 시도)
        if (q.length >= 4) {
          var sum = 0;
          for (var i = 0; i < 4; i++) sum += Number(q[i].eps) || 0;
          if (sum > 0) return sum;
        }
        return Number(latest.eps) * 4;
      }

      // 2순위: 순이익 / 발행주식수 추정
      var ni = Number(latest.ni) || 0;
      if (ni > 0 && typeof ALL_STOCKS !== 'undefined') {
        var stockInfo = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
        if (stockInfo && stockInfo.base > 0 && stockInfo.marketCap > 0) {
          // marketCap(억원) → 원, / base(원) = 주식수
          var stockCount = (stockInfo.marketCap * 100000000) / stockInfo.base;
          if (stockCount > 0) {
            // ni(억원) → 원, / 주식수 = 분기 EPS → × 4 연환산
            return (ni * 100000000 / stockCount) * 4;
          }
        }
      }
    }
  }
  return 0;
}

/**
 * 분기 기간 문자열 → 날짜 범위 파싱
 * "2024 Q3" 또는 "2024Q3" → {year, q, startDate, endDate}
 * @param {string} p - 분기 기간 ("2024 Q3" 형식)
 * @returns {object|null} {year, q, startDate, endDate} 또는 null
 */
function _parseQuarterPeriod(p) {
  if (!p) return null;
  var m = p.match(/(\d{4})\s*Q(\d)/);
  if (!m) return null;
  var year = parseInt(m[1]);
  var q = parseInt(m[2]);
  if (q < 1 || q > 4) return null;
  // Q1: Jan 1 - Mar 31, Q2: Apr 1 - Jun 30, Q3: Jul 1 - Sep 30, Q4: Oct 1 - Dec 31
  var starts = ['', '-01-01', '-04-01', '-07-01', '-10-01'];
  var ends   = ['', '-03-31', '-06-30', '-09-30', '-12-31'];
  return {
    year: year,
    q: q,
    startDate: year + starts[q],
    endDate: year + ends[q]
  };
}

/**
 * 발행주식수 추정 (시가총액 / 기준가)
 * @param {string} code - 종목코드
 * @returns {number} 추정 주식수 (0 = 산출 불가)
 */
function _getShareCount(code) {
  if (typeof ALL_STOCKS === 'undefined') return 0;
  var stock = ALL_STOCKS.find(function(s) { return s.code === code; });
  if (!stock || !stock.marketCap || !stock.base || stock.base <= 0) return 0;
  return Math.round(stock.marketCap * 100000000 / stock.base);
}

/**
 * TTM EPS 시계열 구축 (계단형 PER 밴드용)
 *
 * 분기 순이익(ni, 억원)을 4분기 누적(Trailing Twelve Months)하여
 * 분기별 TTM EPS 시계열을 반환한다.
 *
 * Q4 갭 보정: DART는 Q4 개별 공시가 없는 경우가 많음.
 *   연간 ni - (Q1+Q2+Q3 ni) = Q4 ni 로 역산.
 *
 * @param {Array} quarterly - _financialCache quarterly (최신순 정렬, p: "2024 Q3")
 * @param {Array} annual    - _financialCache annual (최신순 정렬, p: "2024")
 * @param {number} shares   - 추정 발행주식수
 * @returns {Array} [{startDate, endDate, ttmEPS, quarter}] 시간순 정렬. 4분기 미만이면 빈 배열.
 */
function _buildTTMEPSTimeSeries(quarterly, annual, shares) {
  if (!quarterly || quarterly.length < 4 || !shares || shares <= 0) return [];

  // 1) 분기 데이터를 시간순(오래된→최신) 복사 + 파싱
  var parsed = [];
  for (var i = 0; i < quarterly.length; i++) {
    var info = _parseQuarterPeriod(quarterly[i].p);
    if (!info) continue;
    parsed.push({
      year: info.year,
      q: info.q,
      startDate: info.startDate,
      endDate: info.endDate,
      ni: Number(quarterly[i].ni) || 0
    });
  }
  // 시간순 정렬 (year ASC, q ASC)
  parsed.sort(function(a, b) { return (a.year - b.year) || (a.q - b.q); });

  // 2) Q4 갭 보정: 연간 데이터에서 Q4 역산
  if (annual && annual.length > 0) {
    // 연간 데이터를 year별 맵으로
    var annualMap = {};
    for (var ai = 0; ai < annual.length; ai++) {
      var yr = parseInt(annual[ai].p);
      if (!isNaN(yr)) annualMap[yr] = Number(annual[ai].ni) || 0;
    }
    // 각 연도별로 Q1+Q2+Q3가 있고 Q4가 없으면 역산
    var yearGroups = {};
    for (var pi = 0; pi < parsed.length; pi++) {
      var key = parsed[pi].year;
      if (!yearGroups[key]) yearGroups[key] = {};
      yearGroups[key][parsed[pi].q] = parsed[pi];
    }
    var yearsToCheck = Object.keys(yearGroups);
    for (var yi = 0; yi < yearsToCheck.length; yi++) {
      var y = parseInt(yearsToCheck[yi]);
      var grp = yearGroups[y];
      if (grp[1] && grp[2] && grp[3] && !grp[4] && annualMap[y] !== undefined) {
        var q4ni = annualMap[y] - (grp[1].ni + grp[2].ni + grp[3].ni);
        parsed.push({
          year: y,
          q: 4,
          startDate: y + '-10-01',
          endDate: y + '-12-31',
          ni: q4ni
        });
      }
    }
    // 재정렬
    parsed.sort(function(a, b) { return (a.year - b.year) || (a.q - b.q); });
  }

  // 3) index 3부터 4분기 누적 TTM EPS 계산
  if (parsed.length < 4) return [];
  var result = [];
  for (var ti = 3; ti < parsed.length; ti++) {
    var ttmNi = parsed[ti].ni + parsed[ti - 1].ni + parsed[ti - 2].ni + parsed[ti - 3].ni;
    // ttmNi는 억원 단위 → 원으로 변환 후 주식수로 나눔
    var ttmEPS = (ttmNi * 100000000) / shares;
    result.push({
      startDate: parsed[ti].startDate,
      endDate: parsed[ti].endDate,
      ttmEPS: ttmEPS,
      quarter: parsed[ti].year + ' Q' + parsed[ti].q
    });
  }
  return result;
}

/**
 * PER 밴드 차트 렌더링 (계단형 / 플랫 자동 전환)
 *
 * TTM EPS 시계열이 2개 이상이면 계단형(stepped) 밴드,
 * 그렇지 않으면 기존 플랫(flat) 수평 밴드로 렌더링.
 *
 * 계단형: 분기별 TTM EPS 변화에 따라 PER 밴드가 수직 스텝으로 이동.
 *         적자(ttmEPS < 0) 구간은 0 아래에 감소된 알파(0.3)로 표시 + "적자" 라벨.
 */
var _perBandRetries = 0;  // 재시도 횟수 제한용

function _drawPERBandChart() {
  var canvas = document.getElementById('fin-per-band');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  // [FIX] 캔버스 크기 동적 계산 — 패널 미표시/레이아웃 전 안전 처리
  var rawW = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  if (rawW <= 0) {
    // 패널이 아직 레이아웃되지 않음 — 최대 5회 재시도 (50ms 간격)
    if (_perBandRetries < 5) {
      _perBandRetries++;
      setTimeout(_drawPERBandChart, 50);
    }
    return;
  }
  _perBandRetries = 0;  // 성공 시 카운터 리셋
  var parentW = Math.max(rawW - 8, 100);  // 최소 100px 보장
  var h = Math.max(120, Math.min(180, Math.round(parentW * 0.55)));
  canvas.width = parentW * dpr;
  canvas.height = h * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // 데이터: 일봉 캔들에서 종가 추출
  if (!currentStock || typeof dataService === 'undefined') return;
  var cacheKey = currentStock.code + '-1d';
  var cached = dataService.cache[cacheKey];
  if (!cached || !cached.candles || cached.candles.length < 10) return;

  var candles_data = cached.candles;
  var closes = candles_data.map(function(c) { return c.close; });

  // ── Step A: TTM EPS 시계열 구축 시도 ──
  var finCache = (typeof _financialCache !== 'undefined') ? _financialCache[currentStock.code] : null;
  // [CLEAN-DATA] seed 생성 가짜 데이터로는 TTM 시계열 구축하지 않음
  var finSource = finCache ? finCache.source : null;
  var isTrustedSource = (finSource === 'dart' || finSource === 'hardcoded');
  var quarterly = (finCache && isTrustedSource) ? finCache.quarterly : null;
  var annual = (finCache && isTrustedSource) ? finCache.annual : null;
  var shares = _getShareCount(currentStock.code);
  var ttmSeries = _buildTTMEPSTimeSeries(quarterly, annual, shares);
  var useStepped = ttmSeries.length >= 2;

  // EPS 추출: 계단형이면 최신 TTM EPS, 아니면 기존 _getLatestEPS()
  var eps = useStepped ? ttmSeries[ttmSeries.length - 1].ttmEPS : _getLatestEPS();
  if (!eps || eps === 0) {
    // 계단형인데 최신 EPS가 0인 경우 — 유효한 마지막 비영 EPS 시도
    if (useStepped) {
      for (var ei = ttmSeries.length - 1; ei >= 0; ei--) {
        if (ttmSeries[ei].ttmEPS !== 0) { eps = ttmSeries[ei].ttmEPS; break; }
      }
    }
    if (!eps || eps === 0) {
      ctx.fillStyle = '#808080';
      ctx.font = "11px 'Pretendard', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EPS 데이터 없음', parentW / 2, h / 2);
      return;
    }
  }

  // ── Step B: EPS per candle 매핑 (계단형 전용) ──
  var epsPerCandle = [];
  if (useStepped) {
    var segIdx = 0;
    for (var ci = 0; ci < candles_data.length; ci++) {
      var date = typeof candles_data[ci].time === 'string'
        ? candles_data[ci].time
        : new Date(candles_data[ci].time * 1000).toISOString().slice(0, 10);
      while (segIdx < ttmSeries.length - 1 && date >= ttmSeries[segIdx + 1].startDate) segIdx++;
      epsPerCandle[ci] = (date >= ttmSeries[0].startDate) ? ttmSeries[segIdx].ttmEPS : null;
    }
  }

  // PER 배수 라인 정의 (저평가→고평가)
  var bands = [
    { per: 8,  color: KRX_COLORS.DOWN_FILL(0.75),    label: '8x' },   // 파랑 (저평가)
    { per: 12, color: KRX_COLORS.MA_LONG_FILL(0.75), label: '12x' },  // 초록
    { per: 16, color: KRX_COLORS.ACCENT_FILL(0.75),  label: '16x' },  // 금색
    { per: 20, color: KRX_COLORS.UP_FILL(0.75),      label: '20x' },  // 빨강 (고평가)
  ];

  // ── Step C: 가격 범위 계산 (주가 + 모든 밴드 포함) ──
  var allPrices = closes.slice();
  if (useStepped) {
    // 계단형: 모든 EPS x 배수 조합의 밴드 가격 포함
    for (var epi = 0; epi < epsPerCandle.length; epi++) {
      if (epsPerCandle[epi] !== null) {
        for (var bxi = 0; bxi < bands.length; bxi++) {
          allPrices.push(epsPerCandle[epi] * bands[bxi].per);
        }
      }
    }
  } else {
    bands.forEach(function(b) { allPrices.push(eps * b.per); });
  }
  var rawMin = allPrices[0], rawMax = allPrices[0];
  for (var pi = 1; pi < allPrices.length; pi++) {
    if (allPrices[pi] < rawMin) rawMin = allPrices[pi];
    if (allPrices[pi] > rawMax) rawMax = allPrices[pi];
  }
  // 음수 가격이 포함될 수 있으므로 (적자 구간) 절대값 기반 패딩
  var padding = (rawMax - rawMin) * 0.05;
  if (padding <= 0) padding = Math.abs(rawMax) * 0.05 || 1;
  var minP = rawMin - padding;
  var maxP = rawMax + padding;
  var rangeP = maxP - minP;
  if (rangeP <= 0) return;

  var padL = 8, padR = 30, padT = 8, padB = 24;
  var chartW = parentW - padL - padR;
  var chartH = h - padT - padB;

  var toX = function(i) { return padL + (i / (closes.length - 1)) * chartW; };
  var toY = function(p) { return padT + (1 - (p - minP) / rangeP) * chartH; };

  // ═══════════════════════════════════════════════════════
  //  STEPPED 렌더링 경로
  // ═══════════════════════════════════════════════════════
  if (useStepped) {

    // ── 1S) 밴드 사이 영역 채우기 (계단형 폴리곤) ──
    for (var bi = 0; bi < bands.length - 1; bi++) {
      var lowerPer = bands[bi].per;
      var upperPer = bands[bi + 1].per;
      var fillAlpha = '0.12';
      ctx.fillStyle = bands[bi].color.replace('0.75', fillAlpha);
      ctx.beginPath();
      var started = false;
      // forward pass: lower band
      for (var fi = 0; fi < closes.length; fi++) {
        var eVal = epsPerCandle[fi];
        if (eVal === null) continue;
        var lp = eVal * lowerPer;
        var fx = toX(fi);
        // vertical step at EPS change
        if (started && fi > 0 && epsPerCandle[fi] !== epsPerCandle[fi - 1] && epsPerCandle[fi - 1] !== null) {
          var prevLp = epsPerCandle[fi - 1] * lowerPer;
          ctx.lineTo(fx, toY(prevLp));
          ctx.lineTo(fx, toY(lp));
        }
        if (!started) { ctx.moveTo(fx, toY(lp)); started = true; }
        else ctx.lineTo(fx, toY(lp));
      }
      // reverse pass: upper band
      for (var ri = closes.length - 1; ri >= 0; ri--) {
        var eValR = epsPerCandle[ri];
        if (eValR === null) continue;
        var up = eValR * upperPer;
        var rx = toX(ri);
        if (ri < closes.length - 1 && epsPerCandle[ri] !== epsPerCandle[ri + 1] && epsPerCandle[ri + 1] !== null) {
          var nextUp = epsPerCandle[ri + 1] * upperPer;
          ctx.lineTo(rx, toY(nextUp));
          ctx.lineTo(rx, toY(up));
        }
        ctx.lineTo(rx, toY(up));
      }
      ctx.closePath();
      ctx.fill();

      // 적자 구간 (lower band가 음수) — 감소된 알파로 재채움
      var hasNeg = false;
      for (var ngi = 0; ngi < epsPerCandle.length; ngi++) {
        if (epsPerCandle[ngi] !== null && epsPerCandle[ngi] < 0) { hasNeg = true; break; }
      }
      if (hasNeg && bi === 0) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = KRX_COLORS.UP_FILL(0.15);
        ctx.fillRect(padL, toY(0), chartW, (padT + chartH) - toY(0));
        ctx.restore();
      }
    }

    // ── 2S) PER 밴드 점선 (계단형) ──
    for (var bdi = 0; bdi < bands.length; bdi++) {
      var bPer = bands[bdi].per;
      ctx.strokeStyle = bands[bdi].color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      var bandStarted = false;
      for (var si = 0; si < closes.length; si++) {
        var sEps = epsPerCandle[si];
        if (sEps === null) continue;
        var bp = sEps * bPer;
        var sx = toX(si);
        var sy = toY(bp);
        if (!bandStarted) { ctx.moveTo(sx, sy); bandStarted = true; }
        else {
          // vertical step at EPS change
          if (si > 0 && epsPerCandle[si] !== epsPerCandle[si - 1] && epsPerCandle[si - 1] !== null) {
            var prevBp = epsPerCandle[si - 1] * bPer;
            ctx.lineTo(sx, toY(prevBp));
            ctx.lineTo(sx, sy);
          } else {
            ctx.lineTo(sx, sy);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 라벨 (우측 — 마지막 캔들의 EPS 기준)
      var lastEps = epsPerCandle[epsPerCandle.length - 1];
      if (lastEps === null) {
        // 끝에서부터 유효한 EPS 탐색
        for (var le = epsPerCandle.length - 1; le >= 0; le--) {
          if (epsPerCandle[le] !== null) { lastEps = epsPerCandle[le]; break; }
        }
      }
      if (lastEps !== null) {
        var labelY = toY(lastEps * bPer);
        ctx.fillStyle = bands[bdi].color.replace('0.75', '0.9');
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(bands[bdi].label, padL + chartW + 3, labelY);
      }
    }

    // 적자 라벨
    var hasNegEps = false;
    for (var nci = 0; nci < epsPerCandle.length; nci++) {
      if (epsPerCandle[nci] !== null && epsPerCandle[nci] < 0) { hasNegEps = true; break; }
    }
    if (hasNegEps) {
      ctx.fillStyle = KRX_COLORS.UP_FILL(0.7);
      ctx.font = "700 10px 'Pretendard', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var zeroY = toY(0);
      if (zeroY < padT + chartH - 14) {
        ctx.fillText('적자', padL + chartW / 2, zeroY + 3);
      }
    }

  // ═══════════════════════════════════════════════════════
  //  FLAT 렌더링 경로 (기존 동작 그대로)
  // ═══════════════════════════════════════════════════════
  } else {
    // ── 1) 밴드 사이 영역 채우기 (반투명 그라디언트) ──
    for (var bi2 = 0; bi2 < bands.length - 1; bi2++) {
      var yTopF = toY(eps * bands[bi2 + 1].per);
      var yBotF = toY(eps * bands[bi2].per);
      ctx.fillStyle = bands[bi2].color.replace('0.75', '0.12');
      ctx.fillRect(padL, yTopF, chartW, yBotF - yTopF);
    }

    // ── 2) PER 밴드 점선 ──
    bands.forEach(function(b) {
      var bandPrice = eps * b.per;
      var y = toY(bandPrice);

      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 라벨 (우측)
      ctx.fillStyle = b.color.replace('0.75', '0.9');
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, padL + chartW + 3, y);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  공통 렌더링 (주가 라인, 현재가 점, X축 라벨, 현재 PER)
  // ═══════════════════════════════════════════════════════

  // ── 3) 주가 라인 (그라디언트 영역 + 실선) ──
  // 영역 채우기
  ctx.beginPath();
  for (var i = 0; i < closes.length; i++) {
    var x = toX(i);
    var y = toY(closes[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(toX(closes.length - 1), padT + chartH);
  ctx.lineTo(toX(0), padT + chartH);
  ctx.closePath();
  var grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, KRX_COLORS.SILVER_FILL(0.12));
  grad.addColorStop(1, KRX_COLORS.SILVER_FILL(0.01));
  ctx.fillStyle = grad;
  ctx.fill();

  // 실선
  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (var j = 0; j < closes.length; j++) {
    var px = toX(j);
    var py = toY(closes[j]);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // ── 4) 현재가 점 ──
  var lastX = toX(closes.length - 1);
  var lastY = toY(closes[closes.length - 1]);
  ctx.fillStyle = '#E8E8E8';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // ── 5) X축 시간 라벨 ──
  var labelCount = Math.min(5, candles_data.length);
  var labelStep = Math.max(1, Math.floor((candles_data.length - 1) / (labelCount - 1)));
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillStyle = KRX_COLORS.WHITE_FILL(0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (var li = 0; li < candles_data.length; li += labelStep) {
    var timeVal = candles_data[li].time;
    var dateStr = typeof timeVal === 'string' ? timeVal : '';
    if (!dateStr && typeof timeVal === 'number') {
      var d = new Date(timeVal * 1000);
      dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    var parts = dateStr.split('-');
    var lbl = parts.length >= 2 ? "'" + parts[0].slice(2) + '.' + parts[1] : dateStr;
    ctx.fillText(lbl, toX(li), padT + chartH + 4);
  }
  // 마지막 라벨 (마지막 캔들)
  if ((candles_data.length - 1) % labelStep !== 0) {
    var lastTime = candles_data[candles_data.length - 1].time;
    var lastDateStr = typeof lastTime === 'string' ? lastTime : '';
    if (!lastDateStr && typeof lastTime === 'number') {
      var ld = new Date(lastTime * 1000);
      lastDateStr = ld.getFullYear() + '-' + String(ld.getMonth() + 1).padStart(2, '0');
    }
    var lp2 = lastDateStr.split('-');
    var lastLbl = lp2.length >= 2 ? "'" + lp2[0].slice(2) + '.' + lp2[1] : lastDateStr;
    ctx.fillText(lastLbl, toX(candles_data.length - 1), padT + chartH + 4);
  }

  // ── 6) 현재 PER 표시 (듀얼 폰트) ──
  // 계단형: 최신 TTM EPS 사용, 플랫: _getLatestEPS() 사용
  var perEps = useStepped ? ttmSeries[ttmSeries.length - 1].ttmEPS : eps;
  if (perEps && perEps > 0) {
    var currentPER = closes[closes.length - 1] / perEps;
    var perNumStr = currentPER.toFixed(1) + 'x';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // "12.5x" 숫자 부분 (JetBrains Mono)
    ctx.fillStyle = KRX_COLORS.ACCENT;
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    var numW = ctx.measureText(perNumStr).width;
    ctx.fillText(perNumStr, padL + chartW - 2, padT + 2);
    // "현재 " 라벨 부분 (Pretendard)
    ctx.font = "10px 'Pretendard', sans-serif";
    ctx.fillText('현재 ', padL + chartW - 2 - numW, padT + 2);
  } else if (perEps && perEps < 0) {
    // 적자 상태 — PER 대신 "적자" 표시
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = KRX_COLORS.UP_FILL(0.9);
    ctx.font = "700 10px 'Pretendard', sans-serif";
    ctx.fillText('적자 (EPS<0)', padL + chartW - 2, padT + 2);
  }
}
