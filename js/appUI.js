// ══════════════════════════════════════════════════════
//  KRX LIVE — App UI (DOM 이벤트 + 렌더링 + UX 컴포넌트)
//
//  패턴 필터링, HUD, 차트 업데이트, 실시간 틱,
//  검색, 시그널 필터, 토스트, 환경설정, 온보딩 등.
//  appState.js + appWorker.js 전역 변수/함수 참조.
// ══════════════════════════════════════════════════════

/** 오실레이터 하나를 비활성화: 체크박스 해제 + DOM 숨김 + 차트 파괴 */
function _deactivateOscillator(ind) {
  activeIndicators.delete(ind);
  var cb = document.querySelector('#ind-dropdown-menu input[data-ind="' + ind + '"]');
  if (cb) cb.checked = false;
  var m = _OSC_MAP[ind];
  if (m) {
    if (_dom[m.container]) _dom[m.container].style.display = 'none';
    if (_dom[m.label]) _dom[m.label].style.display = 'none';
    if (typeof chartManager !== 'undefined' && chartManager[m.destroy]) {
      chartManager[m.destroy]();
    }
  }
}

/** 즐겨찾기 별 버튼 UI 갱신 */
function _updateStarBtn() {
  var btn = document.getElementById('watchlist-toggle-btn');
  if (!btn || !currentStock) return;
  var isWatched = _getWatchlist().includes(currentStock.code);
  btn.textContent = isWatched ? '\u2605' : '\u2606';
  btn.classList.toggle('active', isWatched);
}

/** 시각화 토글에 따라 패턴 배열 필터링 — 5-Tier Academic Verification System
 *  S+A Tier: 차트에 렌더링 (기본 활성)
 *  B Tier: 감지는 실행, 차트 렌더링 비활성 (학술 검증 후 승격 가능)
 *  D Tier (SUPPRESS): UI 표시 완전 off
 *  D Tier (CONTEXT_ONLY): 표시하되 경고 배지 부착 */
function _filterPatternsForViz(patterns) {
  if (!patterns || !patterns.length) return patterns;
  var result = [];
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    var t = p.type;
    // [D-1] bullishBeltHold 조건부 복원 — Morris (2006), Graham (1949)
    // D-Tier(WR 51.4%, p=0.17) 이지만 경기 저점 + PBR<1.0 조합 시 가치 반전 신호로 유의미
    // 조건: (1) cycle_phase === 'trough', (2) 현재가/BPS < 1.0 (순자산 이하)
    // 두 조건 모두 충족 시 SUPPRESS 해제 → B-Tier CONTEXT_ONLY로 표시 (경고 배지 부착)
    if (t === 'bullishBeltHold') {
      var _d1Restore = false;
      var _d1Macro = _macroLatest;
      var _d1Phase = (_d1Macro && _d1Macro.cycle_phase) ? _d1Macro.cycle_phase.phase : null;
      if (_d1Phase === 'trough') {
        var _d1Pbr = null;
        if (typeof _financialCache !== 'undefined' && currentStock) {
          var _d1Fin = _financialCache[currentStock.code];
          if (_d1Fin && (_d1Fin.source === 'dart' || _d1Fin.source === 'hardcoded')) {
            var _d1Arr = (_d1Fin.quarterly && _d1Fin.quarterly.length) ? _d1Fin.quarterly : _d1Fin.annual;
            if (_d1Arr && _d1Arr.length && _d1Arr[0].bps) {
              var _d1Bps = Number(_d1Arr[0].bps);
              var _d1Price = (currentStock && currentStock.prevClose) ? currentStock.prevClose
                : (typeof candles !== 'undefined' && candles.length) ? candles[candles.length - 1].close : null;
              if (_d1Bps > 0 && _d1Price > 0) {
                _d1Pbr = _d1Price / _d1Bps;
              }
            }
          }
        }
        if (_d1Pbr != null && _d1Pbr < 1.0) {
          _d1Restore = true;
        }
      }
      if (_d1Restore) {
        // shallow copy → 원본 mutation 방지
        var copy = Object.assign({}, p);
        copy._contextOnly = true;
        copy._conditionalRestore = 'trough+PBR<1.0';
        if (vizToggles.candle) result.push(copy);
      }
      continue;
    }
    // D-Tier SUPPRESS: UI 표시 완전 off (백테스트 데이터 수집은 계속)
    if (_SUPPRESS_PATTERNS.has(t)) continue;
    // D-Tier CONTEXT_ONLY: shallow copy 후 플래그 부착
    if (_CONTEXT_ONLY_PATTERNS.has(t)) {
      var copy2 = Object.assign({}, p);
      copy2._contextOnly = true;
      if (t === 'support' || t === 'resistance') {
        if (vizToggles.chart) result.push(copy2);
      } else if (_ACTIVE_CANDLE_TYPES.has(t)) {
        if (vizToggles.candle) result.push(copy2);
      } else if (_ACTIVE_CHART_TYPES.has(t)) {
        if (vizToggles.chart) result.push(copy2);
      } else {
        result.push(copy2);
      }
      continue;
    }
    // S/R: 항상 S-Tier (vizToggles 적용)
    if (t === 'support' || t === 'resistance') { if (vizToggles.chart) result.push(p); continue; }
    // S+A Tier 캔들 패턴만 렌더링
    if (_ACTIVE_CANDLE_TYPES.has(t)) { if (vizToggles.candle) result.push(p); continue; }
    // B-Tier 캔들: 차트 렌더링 제외 (백테스트 데이터만 수집, 원본 mutation 없음)
    if (_TIER_B_CANDLE.has(t)) continue;
    // S+A Tier 차트 패턴만 렌더링
    if (_ACTIVE_CHART_TYPES.has(t)) { if (vizToggles.chart) result.push(p); continue; }
    // B-Tier 차트: 차트 렌더링 제외
    if (_TIER_B_CHART.has(t)) continue;
    result.push(p);
  }
  return result;
}

// ══════════════════════════════════════════════════════
//  [Phase1] Active Pattern HUD + PriceLine 앵커
//  줌인 시에도 목표가/손절가/R:R을 항상 표시
// ══════════════════════════════════════════════════════

/** 패턴 outcome 계산 (active/hit/failed) */
function _getPatternOutcome(p, cndls) {
  if (p.priceTarget == null && p.stopLoss == null) return null;
  var ei = p.endIndex;
  if (ei == null || ei >= cndls.length - 1) return 'active';
  var isBuy = p.signal === 'buy';
  for (var ci = ei + 1; ci < cndls.length; ci++) {
    if (p.priceTarget != null) {
      if (isBuy && cndls[ci].high >= p.priceTarget) return 'hit';
      if (!isBuy && cndls[ci].low <= p.priceTarget) return 'hit';
    }
    if (p.stopLoss != null) {
      if (isBuy && cndls[ci].low <= p.stopLoss) return 'failed';
      if (!isBuy && cndls[ci].high >= p.stopLoss) return 'failed';
    }
  }
  return 'active';
}

/** Active Pattern HUD 업데이트 — 줌 무관 DOM 오버레이 */
function _updateActivePatternHUD(patterns) {
  var hud = document.getElementById('active-pattern-hud');
  if (!hud) return;

  // active 패턴 중 최고 confidence 찾기
  var active = null;
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p.priceTarget == null && p.stopLoss == null) continue;
    var oc = _getPatternOutcome(p, candles);
    if (oc === 'active') { active = p; break; }
  }

  if (!active) { hud.style.display = 'none'; return; }

  var meta = typeof PATTERN_ACADEMIC_META !== 'undefined' ? PATTERN_ACADEMIC_META[active.type] : null;
  var name = meta ? meta.nameKo : active.type;
  var isBuy = active.signal === 'buy';

  document.getElementById('aph-name').textContent = name;
  var dirEl = document.getElementById('aph-dir');
  dirEl.textContent = isBuy ? 'BUY' : 'SELL';
  dirEl.className = 'aph-dir ' + (isBuy ? 'buy' : 'sell');

  var entry = active.endIndex != null && active.endIndex < candles.length
    ? candles[active.endIndex].close : null;

  var targetEl = document.getElementById('aph-target');
  targetEl.textContent = active.priceTarget != null
    ? '\u2191 ' + active.priceTarget.toLocaleString('ko-KR') : '';

  var stopEl = document.getElementById('aph-stop');
  stopEl.textContent = active.stopLoss != null
    ? '\u2193 ' + active.stopLoss.toLocaleString('ko-KR') : '';

  var rrEl = document.getElementById('aph-rr');
  if (entry && active.priceTarget != null && active.stopLoss != null) {
    var reward = Math.abs(active.priceTarget - entry);
    var risk = Math.abs(active.stopLoss - entry);
    rrEl.textContent = risk > 0 ? 'R:R ' + (reward / risk).toFixed(1) : '';
  } else {
    rrEl.textContent = '';
  }

  hud.style.display = '';
}

/** 목표가/손절가 PriceLine 우측 축 앵커 업데이트 */
function _updateTargetPriceLines(patterns) {
  if (!chartManager || !chartManager.candleSeries) return;

  // LINE 모드: _priceLine 시리즈 사용, 기본: candleSeries
  var plSeries = (chartType === 'line' && chartManager.indicatorSeries && chartManager.indicatorSeries._priceLine)
    ? chartManager.indicatorSeries._priceLine : chartManager.candleSeries;

  // 기존 라인 제거 (이전 series에서 제거 시도, 실패 시 무시)
  _activePriceLines.forEach(function(pl) {
    try { plSeries.removePriceLine(pl); } catch (e) {}
    try { chartManager.candleSeries.removePriceLine(pl); } catch (e) {}
  });
  _activePriceLines = [];

  // active 패턴 중 최고 confidence 찾기
  var active = null;
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p.priceTarget == null && p.stopLoss == null) continue;
    var oc = _getPatternOutcome(p, candles);
    if (oc === 'active') { active = p; break; }
  }
  if (!active) return;

  if (active.priceTarget != null) {
    _activePriceLines.push(plSeries.createPriceLine({
      price: active.priceTarget,
      color: KRX_COLORS.FZ_TARGET_BORDER,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '\ubaa9\ud45c',
    }));
  }
  if (active.stopLoss != null) {
    _activePriceLines.push(plSeries.createPriceLine({
      price: active.stopLoss,
      color: KRX_COLORS.PTN_INVALID,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '\uc190\uc808',
    }));
  }
}

/** 렌더러 호출 통합 — 7+개 호출 사이트를 1곳으로 집약 */
function _renderOverlays() {
  var hudPatterns = _filterPatternsForViz(detectedPatterns);
  // 예측 영역 OFF 시 Canvas 렌더러에만 stop/target/priceTarget 제거
  // HUD와 PriceLine은 forecast 토글과 독립 — 줌인 시에도 항상 표시
  var vizPatterns = hudPatterns;
  if (!vizToggles.forecast) {
    vizPatterns = hudPatterns.map(function(p) {
      if (p.priceTarget != null || p.stopLoss != null) {
        var copy = Object.assign({}, p);
        copy.priceTarget = null;
        copy.stopLoss = null;
        return copy;
      }
      return p;
    });
  }
  if (typeof patternRenderer !== 'undefined') {
    patternRenderer.render(chartManager, candles, chartType, vizPatterns);
  }
  var filtSigs = vizToggles.signal ? _filterSignalsByCategory(detectedSignals) : [];
  if (typeof signalRenderer !== 'undefined') {
    signalRenderer.render(chartManager, candles, filtSigs, {
      volumeActive: activeIndicators.has('vol'),
      chartType: chartType,
    });
  }
  chartManager.setHoverData(candles, vizPatterns, filtSigs);
  // [Phase1] Active Pattern HUD + PriceLine — forecast 토글 무관, 항상 업데이트
  _updateActivePatternHUD(hudPatterns);
  _updateTargetPriceLines(hudPatterns);
}

// ══════════════════════════════════════════════════════
//  [FIX-TRUST] 데이터 출처 워터마크 헬퍼
//
//  데모 모드일 때 워터마크에 항상 "(데모 — 실제 데이터 아님)" 포함.
//  사용자가 가짜 차트를 실제 시장 데이터로 오인하는 것을 방지.
// ══════════════════════════════════════════════════════

/**
 * 현재 데이터 모드에 맞는 워터마크 텍스트 생성
 * @param {string} stockName - 종목명
 * @param {string} [suffix] - 추가 접미사 (예: '서버 연결 중...')
 * @returns {string} 워터마크 텍스트
 */
function _buildWatermark(stockName, suffix) {
  if (KRX_API_CONFIG.mode === 'demo') {
    // 데모 모드: 항상 경고 표시
    var demoSuffix = suffix ? suffix + ' | 데모' : '데모 — 실제 데이터 아님';
    return stockName + ' (' + demoSuffix + ')';
  }
  if (KRX_API_CONFIG.mode === 'file') {
    // 파일 모드: CheeseStock 브랜딩 + 모드 표시
    var fileSuffix = suffix ? suffix + ' · 파일' : 'CheeseStock · 파일';
    return stockName + ' (' + fileSuffix + ')';
  }
  if (suffix) {
    return stockName + ' (' + suffix + ')';
  }
  return stockName;
}

// ── 데이터 수신 시각 추적 (Data Freshness Indicator) ──
// _lastDataTime, _freshnessTimer → appState.js에서 선언됨

/**
 * 영업일 기준 날짜 라벨 반환
 * @param {string} lastDateStr - "YYYY-MM-DD" 형식의 마지막 캔들 날짜
 * @param {Date} kstNow - KST 보정된 현재 시각 (local accessor 사용 가능)
 * @returns {string} "오늘" | "어제" | "M/D(요일)"
 */
function _getBusinessDayLabel(lastDateStr, kstNow) {
  var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  var todayStr = kstNow.getFullYear() + '-' + String(kstNow.getMonth() + 1).padStart(2, '0') + '-' + String(kstNow.getDate()).padStart(2, '0');
  if (lastDateStr === todayStr) return '오늘';

  // 직전 영업일 찾기: 오늘에서 하루씩 뒤로 가면서 토/일 건너뜀
  var prev = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
  for (var i = 0; i < 4; i++) { // 최대 4일 뒤로 (금→목→수→화, 또는 월→일→토→금)
    prev.setDate(prev.getDate() - 1);
    if (prev.getDay() !== 0 && prev.getDay() !== 6) break; // 평일 발견
  }
  var prevStr = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0') + '-' + String(prev.getDate()).padStart(2, '0');
  if (lastDateStr === prevStr) return '어제';

  // 그 외: "M/D(요일)" 형식
  var parts = lastDateStr.split('-');
  var lastD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return parseInt(parts[1]) + '/' + parseInt(parts[2]) + '(' + dayNames[lastD.getDay()] + ')';
}

/** 데이터 수신 시각 갱신 표시 (10초마다 자동 갱신) */
function _updateFreshness() {
  var el = document.getElementById('data-freshness');
  if (!el) return;
  if (!_lastDataTime) { el.textContent = ''; el.title = ''; return; }

  var mode = KRX_API_CONFIG.mode;

  // ── WS/실시간 모드: "방금", "X초 전" (수신 시각 기준) ──
  if (mode === 'ws') {
    var diff = Math.floor((Date.now() - _lastDataTime) / 1000);
    if (diff < 5) el.textContent = '방금';
    else if (diff < 60) el.textContent = diff + '초 전';
    else if (diff < 3600) el.textContent = Math.floor(diff / 60) + '분 전';
    else el.textContent = Math.floor(diff / 3600) + '시간 전';
    el.style.color = diff > 300 ? 'var(--neutral)' : diff > 60 ? 'var(--text-sub)' : 'var(--text-muted)';
    el.title = '마지막 실시간 데이터 수신 시각';
    return;
  }

  // ── 파일/데모 모드: 마지막 캔들 날짜 기준 표시 ──
  if (mode === 'demo') {
    el.textContent = '시뮬레이션';
    el.style.color = 'var(--neutral)';
    el.title = '데모 모드 — 실제 데이터가 아닙니다';
    return;
  }

  // file 모드: 마지막 캔들 날짜 + 데이터 로드 시각으로 기준 표시
  var lastDate = '';
  var candleTimeStr = ''; // 분봉이면 캔들 자체 시:분, 일봉이면 없음
  var isIntraday = false;
  if (typeof candles !== 'undefined' && candles.length > 0) {
    var lastTime = candles[candles.length - 1].time;
    if (typeof lastTime === 'string') {
      lastDate = lastTime; // "YYYY-MM-DD" (일봉)
    } else if (lastTime && lastTime.year) {
      lastDate = lastTime.year + '-' + String(lastTime.month).padStart(2, '0') + '-' + String(lastTime.day).padStart(2, '0');
    } else if (typeof lastTime === 'number') {
      isIntraday = true;
      var d = new Date((lastTime + 9 * 3600) * 1000); // KST 보정
      lastDate = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      candleTimeStr = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    }
  }

  if (!lastDate) {
    el.textContent = '';
    el.title = '';
    return;
  }

  // Bug 1 fix: 일봉은 항상 15:30 (KRX 장마감), 분봉만 캔들 시각 사용
  // Last-Modified 헤더는 daily_deploy.bat 실행 시각이므로 일봉에 무의미
  var timeStr = isIntraday ? candleTimeStr : '15:30';

  // Bug 3 fix: KST 변환을 getMarketState()와 동일한 패턴으로 통일
  var now = new Date();
  var utc = now.getTime() + now.getTimezoneOffset() * 60000;
  var kstNow = new Date(utc + 9 * 3600000);

  // Bug 2 fix: 영업일 기준 라벨 (토/일 건너뜀)
  var dateLabel = _getBusinessDayLabel(lastDate, kstNow);

  if (dateLabel === '오늘') {
    el.textContent = '오늘 ' + timeStr + ' 기준';
    el.style.color = 'var(--text-muted)';
  } else if (dateLabel === '어제') {
    el.textContent = '어제 ' + timeStr + ' 마감';
    el.style.color = 'var(--text-muted)';
  } else {
    el.textContent = dateLabel + ' ' + timeStr + ' 마감';
    // 캘린더 일수 기준 경고 색상 (5일+ = 주말 포함 시 약 3영업일)
    var daysDiff = Math.floor((kstNow.getTime() - new Date(lastDate + 'T00:00:00+09:00').getTime()) / 86400000);
    el.style.color = daysDiff > 5 ? 'var(--neutral)' : 'var(--text-sub)';
  }
  el.title = '데이터 기준일: ' + lastDate + ' (파일 모드)';
}

/** 캔들 데이터 수신 시 호출 — 최종 수신 시각 기록 */
function _markDataFresh() {
  _lastDataTime = Date.now();
  _updateFreshness();
}

// 10초마다 freshness 텍스트 갱신
_freshnessTimer = setInterval(_updateFreshness, 10000);
window.addEventListener('beforeunload', function() {
  clearInterval(_freshnessTimer);
  clearInterval(_marketStateTimer);
});

function _cacheDom() {
  _dom.rsiContainer = document.getElementById('rsi-chart-container');
  _dom.rsiLabel     = document.getElementById('rsi-label');
  _dom.macdContainer = document.getElementById('macd-chart-container');
  _dom.macdLabel    = document.getElementById('macd-label');
  _dom.mainContainer = document.getElementById('main-chart-container');
  // OHLC 바 요소 캐시 (crosshair 이동 시마다 호출되므로 DOM 조회 최소화)
  _dom.ohlcOpen  = document.getElementById('ohlc-open');
  _dom.ohlcHigh  = document.getElementById('ohlc-high');
  _dom.ohlcLow   = document.getElementById('ohlc-low');
  _dom.ohlcClose = document.getElementById('ohlc-close');
  _dom.ohlcVol   = document.getElementById('ohlc-vol');
  // [NEW] 추가 지표 서브차트 DOM 캐시
  _dom.stochContainer = document.getElementById('stoch-chart-container');
  _dom.stochLabel = document.getElementById('stoch-label');
  _dom.cciContainer = document.getElementById('cci-chart-container');
  _dom.cciLabel = document.getElementById('cci-label');
  _dom.adxContainer = document.getElementById('adx-chart-container');
  _dom.adxLabel = document.getElementById('adx-label');
  _dom.willrContainer = document.getElementById('willr-chart-container');
  _dom.willrLabel = document.getElementById('willr-label');
  _dom.atrContainer = document.getElementById('atr-chart-container');
  _dom.atrLabel = document.getElementById('atr-label');
  // [UX] 크로스헤어 지표값 DOM 캐시
  _dom.ohlcRsi     = document.getElementById('ohlc-rsi');
  _dom.ohlcRsiVal  = document.getElementById('ohlc-rsi-val');
  _dom.ohlcMacd    = document.getElementById('ohlc-macd');
  _dom.ohlcMacdVal = document.getElementById('ohlc-macd-val');
}

/**
 * 보존된 차트 패턴을 드래그 분석 결과에 병합 (중복 방지)
 * @param {Array} dragPatterns - 드래그 분석으로 감지된 패턴
 * @returns {Array} 병합된 패턴 배열
 */
function _mergeChartPatternStructLines(dragPatterns) {
  var merged = dragPatterns.slice();
  _chartPatternStructLines.forEach(function (chartP) {
    var isDuplicate = merged.some(function (dp) {
      return dp.type === chartP.type &&
             Math.abs((dp.startIndex || 0) - (chartP.startIndex || 0)) < 3;
    });
    if (!isDuplicate) {
      merged.push(chartP);
    }
  });
  // [Fix-1] Active 패턴 보존: 드래그 재분석에서 소실된 active 패턴을 병합
  // HUD/PriceLine이 줌인 시에도 유지되도록 함
  if (_lastActivePattern) {
    var ap = _lastActivePattern;
    var alreadyPresent = merged.some(function (p) {
      return p.type === ap.type &&
             Math.abs((p.startIndex || 0) - (ap.startIndex || 0)) < 3;
    });
    if (!alreadyPresent) {
      // outcome 재확인: 여전히 active인지 검증
      var oc = _getPatternOutcome(ap, candles);
      if (oc === 'active') {
        merged.push(ap);
      }
    }
  }
  return merged;
}

/**
 * 전체 분석 결과에서 차트 패턴 구조선 추출하여 보존
 * @param {Array} patterns - 전체 분석으로 감지된 패턴
 */
function _saveChartPatternStructLines(patterns) {
  _chartPatternStructLines = patterns
    .filter(function (p) { return _CHART_PATTERN_TYPES.has(p.type); })
    .slice();  // 복사본 저장

  // [Fix-1] Active 패턴 보존: priceTarget/stopLoss가 있고 아직 active인 최고 confidence 패턴
  _lastActivePattern = null;
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p.priceTarget == null && p.stopLoss == null) continue;
    var oc = _getPatternOutcome(p, candles);
    if (oc === 'active') { _lastActivePattern = p; break; }
  }
}

// ══════════════════════════════════════════════════════
//  Toast 알림 시스템
//
//  showToast(message, type) — type: 'info'|'success'|'warning'|'error'
//  자동 3초 후 소멸, 수동 닫기 가능, 최대 5개 스택
// ══════════════════════════════════════════════════════

const _TOAST_ICONS = { info: 'i', success: '\u2713', warning: '!', error: '\u2715' };
const _TOAST_MAX = 5;
const _TOAST_DURATION = 3000;

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) return;

  // 최대 개수 제한 — 오래된 것부터 제거
  while (container.children.length >= _TOAST_MAX) {
    container.removeChild(container.firstChild);
  }

  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  var icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = _TOAST_ICONS[type] || 'i';
  var msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;
  var closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.title = '\uB2EB\uAE30';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', function () { _dismissToast(el); });
  el.appendChild(icon);
  el.appendChild(msg);
  el.appendChild(closeBtn);

  container.appendChild(el);

  // 자동 소멸
  var timer = setTimeout(function () { _dismissToast(el); }, _TOAST_DURATION);
  el._toastTimer = timer;
}

function _dismissToast(el) {
  if (!el || !el.parentNode) return;
  if (el._toastTimer) clearTimeout(el._toastTimer);
  el.classList.add('toast-dismiss');
  el.addEventListener('transitionend', function () {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, { once: true });
  // transitionend가 실패할 경우 대비 (탭 비활성 등)
  setTimeout(function () {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 400);
}

// ══════════════════════════════════════════════════════
//  사용자 환경설정 저장/복원 (localStorage)
//
//  단일 키 'krx-prefs'에 JSON 객체로 저장:
//    { stock, timeframe, chartType, patternEnabled }
// ══════════════════════════════════════════════════════

const _PREFS_KEY = 'krx-prefs';

function _loadPrefs() {
  try {
    var raw = localStorage.getItem(_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _savePrefs(partial) {
  try {
    var prev = _loadPrefs() || {};
    var merged = Object.assign(prev, partial);
    localStorage.setItem(_PREFS_KEY, JSON.stringify(merged));
  } catch (e) {
    // localStorage 비활성 또는 용량 초과 — 무시
  }
}

/**
 * 복원된 환경설정을 툴바 UI에 반영
 * - 타임프레임 버튼 active 클래스
 * - 차트 타입 버튼 active 클래스
 * - 패턴 토글 버튼 + 관련 패널 표시
 */
function _applyPrefsToUI() {
  // 타임프레임 버튼
  document.querySelectorAll('.tf-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tf === currentTimeframe);
  });

  // 차트 타입 버튼
  document.querySelectorAll('.ct-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.ct === chartType);
  });

  // 패턴 토글 버튼 + 관련 UI
  var pBtn = document.getElementById('pattern-toggle');
  if (pBtn) pBtn.classList.toggle('active', patternEnabled);
  var summaryWrap = document.getElementById('pattern-summary-wrap');
  if (summaryWrap) summaryWrap.style.display = patternEnabled ? '' : 'none';
  // 시각화 레이어 토글 복원
  var vizWrapEl = document.getElementById('viz-toggle-wrap');
  if (vizWrapEl) vizWrapEl.style.display = patternEnabled ? '' : 'none';
  document.querySelectorAll('#viz-toggle-menu input[data-viz]').forEach(function(cb) {
    cb.checked = vizToggles[cb.dataset.viz] !== false;
  });
  var filterWrap = document.getElementById('signal-filter-wrap');
  if (filterWrap) filterWrap.style.display = (patternEnabled && vizToggles.signal) ? '' : 'none';
  var retArea = document.getElementById('return-stats-area');
  if (retArea) retArea.style.display = patternEnabled ? '' : 'none';

  // 통합 탭 패널: 활성 탭 반영
  if (window.matchMedia('(max-width: 1200px)').matches) {
    _switchRpTab(_rpActiveTab);
  }

  // 지표 체크박스 동기화 (activeIndicators ↔ DOM)
  document.querySelectorAll('#ind-dropdown-menu input[data-ind]').forEach(function (cb) {
    cb.checked = activeIndicators.has(cb.dataset.ind);
  });
  var indToggle = document.getElementById('ind-dropdown-toggle');
  if (indToggle) indToggle.classList.toggle('has-active', activeIndicators.size > 0);
  // 전체 선택/해제 체크박스 상태 동기화
  _syncIndSelectAll();
  _syncVizSelectAll();

  // 사이드바: 복원된 종목 활성 표시
  if (currentStock && typeof sidebarManager !== 'undefined' && sidebarManager.setActive) {
    sidebarManager.setActive(currentStock.code);
  }
}

// ══════════════════════════════════════════════════════
//  앱 로딩 오버레이 제어
// ══════════════════════════════════════════════════════

/** 로딩 오버레이 텍스트 변경 */
function _setLoadingText(text, sub) {
  var el = document.getElementById('app-loading-text');
  var subEl = document.getElementById('app-loading-sub');
  if (el) el.textContent = text || '';
  if (subEl) subEl.textContent = sub || '';
}

/** 로딩 오버레이 페이드아웃 후 숨김 */
function _hideLoadingOverlay() {
  var overlay = document.getElementById('app-loading-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  setTimeout(function() { overlay.classList.add('hidden'); }, 400);
}

// ══════════════════════════════════════════════════════
//  연결 가이드 (WS 서버 미감지 시)
// ══════════════════════════════════════════════════════

/**
 * WS 서버 프로브 실패 시 로딩 오버레이에 연결 가이드를 표시.
 * 사용자가 주소 입력 / 파일 모드 / 데모 모드를 선택하면 onResolved() 호출.
 * @param {Function} onResolved - 모드 확정 후 호출될 콜백
 */
function _showConnectionGuide(onResolved) {
  var overlay = document.getElementById('app-loading-overlay');
  var spinner = overlay ? overlay.querySelector('.app-loading-spinner') : null;
  var text = document.getElementById('app-loading-text');
  var sub = document.getElementById('app-loading-sub');
  var guide = document.getElementById('conn-guide');
  var urlInput = document.getElementById('conn-guide-url');

  // 스피너 + 텍스트 숨기고 가이드 표시
  if (spinner) spinner.style.display = 'none';
  if (text) text.style.display = 'none';
  if (sub) sub.style.display = 'none';
  if (guide) guide.style.display = '';
  if (urlInput) urlInput.value = KRX_API_CONFIG.wsUrl || _defaultWsUrl;

  // [FIX-H6] 이벤트 리스너 중복 등록 방지 — replaceChildren으로 기존 리스너 제거
  var retryBtn = document.getElementById('conn-guide-retry');
  if (retryBtn) {
    var newRetry = retryBtn.cloneNode(true);
    retryBtn.parentNode.replaceChild(newRetry, retryBtn);
    newRetry.addEventListener('click', async function() {
      var url = urlInput.value.trim();
      if (!url) return;
      this.textContent = '연결 중...'; this.disabled = true;
      KRX_API_CONFIG.wsUrl = url;
      _savePrefs({ wsUrl: url });
      var ok = await dataService.probeWsServer(url, 5000);
      if (ok) {
        KRX_API_CONFIG.mode = 'ws';
        guide.style.display = 'none';
        if (spinner) spinner.style.display = '';
        if (text) { text.style.display = ''; text.textContent = '연결 성공! 데이터 로드 중...'; }
        if (sub) sub.style.display = '';
        onResolved();
      } else {
        this.textContent = '연결'; this.disabled = false;
        showToast('서버 연결 실패 — 주소를 확인하세요', 'error');
      }
    });
  }

  // 파일 모드 버튼
  var fileBtn = document.getElementById('conn-guide-file');
  if (fileBtn) {
    var newFile = fileBtn.cloneNode(true);
    fileBtn.parentNode.replaceChild(newFile, fileBtn);
    newFile.addEventListener('click', function() {
      KRX_API_CONFIG.mode = 'file';
      guide.style.display = 'none';
      onResolved();
    });
  }

  // 데모 모드 버튼
  var demoBtn = document.getElementById('conn-guide-demo');
  if (demoBtn) {
    var newDemo = demoBtn.cloneNode(true);
    demoBtn.parentNode.replaceChild(newDemo, demoBtn);
    newDemo.addEventListener('click', function() {
      KRX_API_CONFIG.mode = 'demo';
      guide.style.display = 'none';
      onResolved();
    });
  }
}

// ══════════════════════════════════════════════════════
//  연결 설정 패널 상태 업데이트
// ══════════════════════════════════════════════════════

/**
 * 연결 패널의 상태 표시 (dot + 텍스트) 업데이트
 * @param {string} status - 연결 상태 키
 */
function _updateConnPanel(status) {
  var dot = document.getElementById('conn-panel-dot');
  var text = document.getElementById('conn-panel-text');
  if (!dot || !text) return;
  var map = {
    'connected': ['ok', '연결됨'],
    'ready': ['ok', '실시간 준비 완료'],
    'login_pending': ['pending', '로그인 대기 중...'],
    'reconnecting': ['pending', '재연결 중...'],
    'disconnected': ['fail', '연결 끊김'],
    'failed': ['fail', '연결 실패'],
    'login_failed': ['fail', '로그인 실패'],
  };
  var m = map[status] || ['', status];
  dot.className = 'conn-dot ' + m[0];
  text.textContent = m[1];
}

// ══════════════════════════════════════════════════════
//  온보딩 툴팁 투어 (5단계, 첫 방문자)
//
//  localStorage 'krx_onboarding_v2' 키로 완료 여부 관리.
//  오버레이는 pointer-events:none → 앱 사용을 차단하지 않음.
//  각 스텝의 target 요소가 DOM에 없으면 자동 스킵.
// ══════════════════════════════════════════════════════

var ONBOARDING_KEY = 'krx_onboarding_v2';

function showOnboarding() {
  // 이미 투어 완료했으면 표시하지 않음
  try { if (localStorage.getItem(ONBOARDING_KEY)) return; } catch(e) { return; }

  // ── 5단계 투어 정의 ──
  var steps = [
    {
      target: '#sidebar',
      text: '종목을 클릭하여 차트를 확인하세요.\n검색창에서 종목명/코드로 빠르게 찾을 수 있습니다.',
      position: 'right'
    },
    {
      target: '#main-chart-container',
      text: '마우스 휠로 줌, 드래그로 스크롤할 수 있습니다.\n크로스헤어로 OHLCV를 실시간 확인합니다.',
      position: 'center'
    },
    {
      target: '#draw-toolbar',
      text: '추세선, 수평선, 피보나치 등 6가지 드로잉 도구를 제공합니다.\n키보드 단축키(T/H/V/R/G)도 지원합니다.',
      position: 'right'
    },
    {
      target: '#ind-dropdown-toggle',
      text: '13가지 기술적 지표를 추가할 수 있습니다.\n우클릭으로 파라미터(기간, 표준편차 등)를 변경하세요.',
      position: 'bottom'
    },
    {
      target: '#pattern-toggle',
      text: '패턴 버튼으로 26종 캔들/차트 패턴을 자동 감지합니다.\n감지 결과는 차트 위에 시각화되고 수익률 통계도 확인할 수 있습니다.',
      position: 'bottom'
    }
  ];

  var currentStep = 0;
  var overlay = null;

  // ── 진행 바 (도트) HTML 생성 ──
  function _buildProgressDots(activeIdx) {
    var html = '<div class="ob-progress">';
    for (var i = 0; i < steps.length; i++) {
      var cls = 'ob-dot';
      if (i === activeIdx) cls += ' active';
      else if (i < activeIdx) cls += ' done';
      html += '<span class="' + cls + '"></span>';
    }
    html += '</div>';
    return html;
  }

  // ── 이전 툴팁 / 하이라이트 제거 ──
  function _cleanup() {
    var prev = document.querySelector('.onboarding-tooltip');
    if (prev) prev.remove();
    var hl = document.querySelector('.onboarding-highlight');
    if (hl) hl.classList.remove('onboarding-highlight');
  }

  // ── 투어 종료 (완료 또는 건너뛰기) ──
  function _endTour() {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch(e) {}
    _cleanup();
    if (overlay && overlay.parentNode) {
      overlay.style.animation = 'obFadeIn .2s ease reverse forwards';
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }
  }

  // ── 특정 스텝 표시 ──
  function _showStep(idx) {
    _cleanup();

    // 모든 스텝 완료
    if (idx >= steps.length) {
      _endTour();
      return;
    }

    var step = steps[idx];
    var target = document.querySelector(step.target);

    // target 요소가 없으면 다음 스텝으로 건너뜀
    if (!target) {
      _showStep(idx + 1);
      return;
    }

    currentStep = idx;

    // 하이라이트 적용
    target.classList.add('onboarding-highlight');

    // 대상 요소가 보이도록 스크롤
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 툴팁 생성
    var tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.setAttribute('data-pos', step.position);

    var isLast = (idx === steps.length - 1);

    tooltip.innerHTML =
      '<div class="ob-text">' + step.text.replace(/\n/g, '<br>') + '</div>' +
      '<div class="ob-actions">' +
        '<span class="ob-counter">' + (idx + 1) + ' / ' + steps.length + '</span>' +
        '<button class="ob-skip">\uAC74\uB108\uB6F0\uAE30</button>' +
        '<button class="ob-next">' + (isLast ? '\uC644\uB8CC' : '\uB2E4\uC74C') + '</button>' +
      '</div>' +
      _buildProgressDots(idx);

    document.body.appendChild(tooltip);

    // ── 위치 계산 ──
    var rect = target.getBoundingClientRect();
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var gap = 12; // 요소와 툴팁 사이 간격

    var left, top;

    switch (step.position) {
      case 'right':
        left = rect.right + gap;
        top = rect.top + Math.min(20, rect.height / 2 - th / 2);
        // 화면 오른쪽 넘어가면 왼쪽으로 배치
        if (left + tw > window.innerWidth - 8) {
          left = rect.left - tw - gap;
          tooltip.setAttribute('data-pos', 'left');
        }
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - tw / 2;
        top = rect.bottom + gap;
        // 화면 아래 넘어가면 위로
        if (top + th > window.innerHeight - 8) {
          top = rect.top - th - gap;
          tooltip.setAttribute('data-pos', 'top');
        }
        break;
      case 'center':
        // 차트 영역 중앙에 표시
        left = rect.left + rect.width / 2 - tw / 2;
        top = rect.top + rect.height / 2 - th / 2;
        break;
      default:
        left = rect.right + gap;
        top = rect.top;
    }

    // 화면 경계 보정
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // ── 이벤트 바인딩 ──
    tooltip.querySelector('.ob-next').addEventListener('click', function() {
      _showStep(idx + 1);
    });

    tooltip.querySelector('.ob-skip').addEventListener('click', function() {
      _endTour();
    });
  }

  // ── 투어 시작 (앱 로드 완료 후 1.5초 딜레이) ──
  setTimeout(function() {
    // 오버레이 생성
    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);

    // 오버레이 클릭 시에도 다음 스텝 (pointer-events:none이므로 실제로는 작동하지 않지만 안전 장치)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _showStep(currentStep + 1);
    });

    // Esc 키로 투어 종료
    var _escHandler = function(e) {
      if (e.key === 'Escape') {
        _endTour();
        document.removeEventListener('keydown', _escHandler);
      }
    };
    document.addEventListener('keydown', _escHandler);

    _showStep(0);
  }, 1500);
}

// ══════════════════════════════════════════════════════
//  실시간 데이터 (Kiwoom WebSocket → 데모 폴백)
// ══════════════════════════════════════════════════════

// ── rAF 배치 틱 업데이트 ──────────────────────────────
// WS에서 16ms(60fps) 안에 여러 틱이 올 수 있음.
// 매 틱마다 차트를 다시 그리면 CPU 낭비 → 프레임당 1회만 렌더.
// 데이터(candles, price 등)는 즉시 반영하되, 무거운 렌더링만 배치.
var _pendingTickData = null;  // 다음 rAF에서 적용할 마지막 틱 데이터
var _tickRafId = 0;

/**
 * rAF 콜백 — 배치된 틱 데이터로 차트 렌더링 1회 실행
 */
function _flushTickRender() {
  _tickRafId = 0;
  var data = _pendingTickData;
  if (!data) return;
  _pendingTickData = null;

  // 캔들이 있을 때만 차트 업데이트
  if (data.candles && data.candles.length > 0) {
    candles = dataService._sanitizeCandles(data.candles, currentTimeframe);
    _markDataFresh();  // WS 캔들 수신 시각 기록

    // WS에서 받은 캔들을 dataService 캐시에도 반영 (L1 메모리 + L2 IDB)
    if (currentStock) {
      var cacheKey = currentStock.code + '-' + currentTimeframe;
      var cacheEntry = { candles: candles, lastUpdate: Date.now() };
      dataService.cache[cacheKey] = cacheEntry;
      // 일봉이면 IndexedDB에도 저장 (다음 페이지 로드 시 즉시 사용)
      if (currentTimeframe === '1d' && typeof _idb !== 'undefined') {
        _idb.set(cacheKey, cacheEntry);
      }
    }

    updateChartFull();
    updateStockInfo();
    updateOHLCBar(null);
    sidebarManager.updatePrices();

    // 서버 캔들 수신 성공 → 워터마크를 종목명으로 복원 + 로딩 오버레이 숨김
    if (currentStock) {
      chartManager.setWatermark(_buildWatermark(currentStock.name));
    }
    _hideLoadingOverlay();
  }

  chartManager.updatePriceLines(data.currentPrice, data.dayHigh, data.dayLow, data.previousClose);
}

function startRealtimeTick() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (_realtimeUnsub) { _realtimeUnsub(); _realtimeUnsub = null; }
  if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }
  // rAF 배치 초기화
  _pendingTickData = null;
  if (_tickRafId) { cancelAnimationFrame(_tickRafId); _tickRafId = 0; }

  _realtimeUnsub = realtimeProvider.onTick((data) => {
    // 에러는 즉시 처리 (배치하지 않음 — 사용자 피드백 지연 방지)
    if (data.error) {
      updateLiveStatus('offline');
      // WS 모드: 재연결을 기다림
      // WS 외: 정적 차트 모드 전환 (file=실제 데이터, demo=시뮬레이션)
      if (KRX_API_CONFIG.mode !== 'ws' && !tickTimer && !_realtimeMode) {
        startDemoTick();
      }
      return;
    }

    _realtimeMode = true;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

    // WebSocket 연결 상태 표시 (경량 — 즉시 처리)
    var liveLabel = realtimeProvider.mode === 'ws' ? 'ws' : 'live';
    updateLiveStatus(liveLabel);

    // 빈 캔들은 로그만 남기고 배치하지 않음
    if (!data.candles || data.candles.length === 0) {
      console.log('[KRX] WS 캔들 수신: 빈 배열 (실시간 틱 대기 중)');
      // 가격 라인은 캔들 없이도 업데이트 가능
      chartManager.updatePriceLines(data.currentPrice, data.dayHigh, data.dayLow, data.previousClose);
      return;
    }

    // 최신 틱 데이터만 보관 (이전 미렌더링 틱은 덮어씀)
    _pendingTickData = data;

    // 이미 rAF 예약되어 있으면 다음 프레임에서 최신 데이터로 렌더
    if (!_tickRafId) {
      _tickRafId = requestAnimationFrame(_flushTickRender);
    }
  });

  realtimeProvider.start(currentStock, currentTimeframe);

  // WS 모드: 서버 응답 대기 (Kiwoom 로그인+TR 포함하면 시간 소요 가능)
  if (KRX_API_CONFIG.mode === 'ws') {
    // WS 모드: 서버 재연결은 realtimeProvider 내부에서 자동 처리
    // 서버 미연결 시 file 모드 일봉 데이터로 정적 차트 표시 (Naver 사용 안 함)
    _fallbackTimer = setTimeout(async () => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected) {
        console.warn('[KRX] WS 서버 연결 대기 중 (10초 타임아웃)...');
        updateLiveStatus('offline');

        // 차트가 비어있으면 file 모드 폴백 시도 (일봉만 — 분봉은 서버 전용)
        if (candles.length === 0 && currentStock) {
          if (currentTimeframe === '1d') {
            const fallbackCandles = await dataService._fileGetCandles(currentStock);
            if (fallbackCandles.length > 0) {
              candles = fallbackCandles;
              _markDataFresh();  // 폴백 데이터 수신 시각 기록
              const cacheKey = `${currentStock.code}-${currentTimeframe}`;
              const cacheEntry = { candles, lastUpdate: Date.now() };
              dataService.cache[cacheKey] = cacheEntry;
              // 일봉 file 폴백도 IDB에 저장 (다음 로드 시 즉시 사용)
              if (typeof _idb !== 'undefined') { _idb.set(cacheKey, cacheEntry); }
              updateChartFull();
              updateStockInfo();
              _updatePriceLinesFromCandles();  // [FIX] WS 폴백 시 가격선 1회 생성
              updateOHLCBar(null);
              chartManager.setWatermark(_buildWatermark(currentStock.name));
              console.log('[KRX] WS 미연결 — file 폴백 일봉 로드: %s (%d건)',
                currentStock.code, candles.length);
            }
          } else {
            // 분봉: 서버 미연결 시 빈 차트 + 안내 메시지 (가짜 데이터 생성 안 함)
            chartManager.setWatermark(_buildWatermark(currentStock.name, '분봉 — 서버 연결 필요'));
            console.log('[KRX] WS 미연결 — 분봉 데이터 없음: %s %s (서버 재연결 대기)',
              currentStock.code, currentTimeframe);
          }
        }
        // 서버 재연결 시 onTick 콜백에서 자동 복구
      }
    }, 10000);
  } else {
    // file/demo 모드: 짧은 대기 후 정적 차트 모드 전환
    _fallbackTimer = setTimeout(() => {
      _fallbackTimer = null;
      if (!realtimeProvider.connected && !tickTimer) {
        console.log('[KRX] 실시간 연결 실패, 정적 모드 시작 (%s)', KRX_API_CONFIG.mode);
        startDemoTick();
      }
    }, 4000);
  }
}

function startDemoTick() {
  _realtimeMode = false;
  // rAF 배치 취소 (데모/정적 모드에서는 WS 틱 없음)
  _pendingTickData = null;
  if (_tickRafId) { cancelAnimationFrame(_tickRafId); _tickRafId = 0; }
  // file 모드: 실제 데이터임을 표시 / demo 모드: 시뮬레이션 데이터임을 경고
  var statusLabel = (KRX_API_CONFIG.mode === 'file') ? 'file' : 'demo';
  updateLiveStatus(statusLabel);
  // 정적 차트만 표시 (랜덤 틱 생성하지 않음)
  // 키움 서버 연결 전까지는 초기 로드된 데이터로 정적 차트 유지
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

// ── 전체 차트 업데이트 ──
function updateChartFull() {
  const now = Date.now();
  if (patternEnabled && now - _lastPatternAnalysis > 3000) {

    // Worker가 준비되어 있으면 비동기 분석 요청
    var _workerWillRender = false;
    if (_analysisWorker && _workerReady) {
      _requestWorkerAnalysis();
      _workerWillRender = true;  // Worker 콜백에서 full 렌더링 예정
    } else {
      // [OPT] 메인 스레드 동기 분석을 지연 실행 — 차트 렌더링 우선
      // 패턴 분석(50-200ms)이 차트 최초 렌더를 차단하지 않도록
      // 먼저 빈 패턴으로 차트를 그린 뒤, 다음 프레임에서 분석 + 재렌더
      var _deferredVersion = _workerVersion;
      setTimeout(async function() {
        if (_deferredVersion !== _workerVersion) return;  // stale 방지
        await _analyzeOnMainThread();  // [V48-Phase2.5] async (서버 fetch wrapper 위임)
        if (_deferredVersion !== _workerVersion) return;  // stale 재검증
        // 분석 완료 후 차트 + 오버레이 통합 렌더 (vizToggles 필터 적용)
        chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns, indParams);
        _renderOverlays();
      }, 0);
    }

    _lastPatternAnalysis = now;
  } else if (!patternEnabled) {
    detectedPatterns = [];
    detectedSignals = [];
  }

  // [OPT] Worker 분석 요청 시: 패턴 없이 차트만 렌더 (Worker 콜백에서 재렌더 예정)
  // → 이중 렌더링 제거 (stale 패턴으로 full 렌더 후 즉시 새 패턴으로 재렌더하는 낭비 방지)
  // [FIX] 시리즈 교체 감지용: updateMain 내 _swapMainSeries()가 candleSeries를 교체할 수 있음
  var _seriesBefore = chartManager.candleSeries;

  chartManager.updateMain(candles, chartType, activeIndicators,
    _workerWillRender ? [] : detectedPatterns, indParams);

  // [FIX] 시리즈 타입 전환(candlestick↔bar) 시 drawingTools 재연결
  // _swapMainSeries()가 candleSeries를 교체하면 drawingTools의 내부 참조가 stale됨
  // patternRenderer/signalRenderer는 render() 시 자동 재연결하지만 drawingTools는 수동 필요
  if (_seriesBefore !== chartManager.candleSeries &&
      typeof drawingTools !== 'undefined' && drawingTools.getActiveTool !== undefined) {
    drawingTools.detach();
    _initDrawingTools();
  }

  // 오버레이 통합 렌더 (vizToggles 필터 적용)
  // Worker가 렌더 예정이면 빈 상태로 렌더 (Worker 콜백에서 _renderOverlays 재호출)
  if (_workerWillRender) {
    // Worker 대기 중: 빈 오버레이로 클리어
    if (typeof patternRenderer !== 'undefined') {
      patternRenderer.render(chartManager, candles, chartType, []);
    }
    if (typeof signalRenderer !== 'undefined') {
      signalRenderer.render(chartManager, candles, [], {
        volumeActive: activeIndicators.has('vol'),
        chartType: chartType,
      });
    }
    chartManager.setHoverData(candles, [], []);
  } else {
    _renderOverlays();
  }

  if (activeIndicators.has('rsi')) {
    _dom.rsiContainer.style.display = 'block';
    if (_dom.rsiLabel) _dom.rsiLabel.style.display = 'block';
    if (!chartManager.rsiChart) chartManager.createRSIChart(_dom.rsiContainer);
    chartManager.updateRSI(candles, indParams);
    // 서브차트 라벨에 커스텀 기간 반영
    if (_dom.rsiLabel) _dom.rsiLabel.textContent = 'RSI (' + (indParams.rsi ? indParams.rsi.period : 14) + ')';
  } else {
    _dom.rsiContainer.style.display = 'none';
    if (_dom.rsiLabel) _dom.rsiLabel.style.display = 'none';
    chartManager.destroyRSI();
  }

  if (activeIndicators.has('macd')) {
    _dom.macdContainer.style.display = 'block';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'block';
    if (!chartManager.macdChart) chartManager.createMACDChart(_dom.macdContainer);
    chartManager.updateMACD(candles, indParams);
    // 서브차트 라벨에 커스텀 파라미터 반영
    var mp = indParams.macd || { fast: 12, slow: 26, signal: 9 };
    if (_dom.macdLabel) _dom.macdLabel.textContent = 'MACD (' + mp.fast + ', ' + mp.slow + ', ' + mp.signal + ')';
  } else {
    _dom.macdContainer.style.display = 'none';
    if (_dom.macdLabel) _dom.macdLabel.style.display = 'none';
    chartManager.destroyMACD();
  }

  // [NEW] Stochastic
  if (activeIndicators.has('stoch') && _dom.stochContainer) {
    _dom.stochContainer.style.display = 'block';
    if (_dom.stochLabel) _dom.stochLabel.style.display = 'block';
    if (!chartManager.stochChart) chartManager.createStochasticChart(_dom.stochContainer);
    chartManager.updateStochastic(candles, indParams);
  } else if (_dom.stochContainer) {
    _dom.stochContainer.style.display = 'none';
    if (_dom.stochLabel) _dom.stochLabel.style.display = 'none';
    chartManager.destroyStochastic();
  }

  // [NEW] CCI
  if (activeIndicators.has('cci') && _dom.cciContainer) {
    _dom.cciContainer.style.display = 'block';
    if (_dom.cciLabel) _dom.cciLabel.style.display = 'block';
    if (!chartManager.cciChart) chartManager.createCCIChart(_dom.cciContainer);
    chartManager.updateCCI(candles, indParams);
  } else if (_dom.cciContainer) {
    _dom.cciContainer.style.display = 'none';
    if (_dom.cciLabel) _dom.cciLabel.style.display = 'none';
    chartManager.destroyCCI();
  }

  // [NEW] ADX
  if (activeIndicators.has('adx') && _dom.adxContainer) {
    _dom.adxContainer.style.display = 'block';
    if (_dom.adxLabel) _dom.adxLabel.style.display = 'block';
    if (!chartManager.adxChart) chartManager.createADXChart(_dom.adxContainer);
    chartManager.updateADX(candles, indParams);
  } else if (_dom.adxContainer) {
    _dom.adxContainer.style.display = 'none';
    if (_dom.adxLabel) _dom.adxLabel.style.display = 'none';
    chartManager.destroyADX();
  }

  // [NEW] Williams %R
  if (activeIndicators.has('willr') && _dom.willrContainer) {
    _dom.willrContainer.style.display = 'block';
    if (_dom.willrLabel) _dom.willrLabel.style.display = 'block';
    if (!chartManager.willrChart) chartManager.createWilliamsRChart(_dom.willrContainer);
    chartManager.updateWilliamsR(candles, indParams);
  } else if (_dom.willrContainer) {
    _dom.willrContainer.style.display = 'none';
    if (_dom.willrLabel) _dom.willrLabel.style.display = 'none';
    chartManager.destroyWilliamsR();
  }

  // [NEW] ATR
  if (activeIndicators.has('atr') && _dom.atrContainer) {
    _dom.atrContainer.style.display = 'block';
    if (_dom.atrLabel) _dom.atrLabel.style.display = 'block';
    if (!chartManager.atrChart) chartManager.createATRChart(_dom.atrContainer);
    chartManager.updateATR(candles, indParams);
  } else if (_dom.atrContainer) {
    _dom.atrContainer.style.display = 'none';
    if (_dom.atrLabel) _dom.atrLabel.style.display = 'none';
    chartManager.destroyATR();
  }

}

// ── 패턴/시그널 카테고리 분류 (사이드바 pill 용) ──
// patterns.js 타입 → candle, signalEngine 타입 → indicator/volume
const _CANDLE_PATTERN_TYPES = new Set([
  'hammer', 'shootingStar', 'bullishEngulfing', 'bearishEngulfing',
  'morningStar', 'eveningStar', 'threeWhiteSoldiers', 'threeBlackCrows',
  'piercingLine', 'darkCloud', 'dragonflyDoji', 'gravestoneDoji',
  'tweezerBottom', 'tweezerTop', 'bullishMarubozu', 'bearishMarubozu',
]);
// _CHART_PATTERN_TYPES는 상단(61줄)에서 이미 정의됨
const _VOLUME_SIGNAL_TYPES = new Set([
  'volumeBreakout', 'volumeSelloff', 'volumeExhaustion',
]);
const _INDICATOR_SIGNAL_TYPES = new Set([
  'goldenCross', 'deadCross', 'maAlignment_bull', 'maAlignment_bear',
  'macdBullishCross', 'macdBearishCross',
  'macdBullishDivergence', 'macdBearishDivergence',
  'macdHiddenBullishDivergence', 'macdHiddenBearishDivergence',
  'rsiOversold', 'rsiOversoldExit', 'rsiOverbought', 'rsiOverboughtExit',
  'rsiBullishDivergence', 'rsiBearishDivergence',
  'rsiHiddenBullishDivergence', 'rsiHiddenBearishDivergence',
  'bbLowerBounce', 'bbUpperBreak', 'bbSqueeze',
  'ichimokuBullishCross', 'ichimokuBearishCross',
  'ichimokuCloudBreakout', 'ichimokuCloudBreakdown',
  'hurstTrending', 'hurstMeanReverting',
  'stochasticOversold', 'stochasticOverbought',
]);

/**
 * 패턴/시그널을 3카테고리로 분류하여 카운트 + 이름 반환
 * @param {Array} patterns - patternEngine.analyze() 결과
 * @param {Array} signals  - signalEngine.analyze() 결과
 * @returns {{ candle: number, indicator: number, volume: number, names: string[] }}
 */
function _categorizePatterns(patterns, signals) {
  const result = { candle: 0, indicator: 0, volume: 0, names: [] };

  // patternEngine 결과: 캔들패턴 + 차트패턴 (이름도 수집)
  for (const p of patterns) {
    const type = p.type || p.pattern;
    if (_CANDLE_PATTERN_TYPES.has(type)) {
      result.candle++;
      // PATTERN_ACADEMIC_META (patternPanel.js 전역)에서 한글명 조회
      const meta = typeof PATTERN_ACADEMIC_META !== 'undefined' ? PATTERN_ACADEMIC_META[type] : null;
      result.names.push(meta && meta.nameKo ? meta.nameKo : type);
    } else if (_CHART_PATTERN_TYPES.has(type)) {
      // 차트 패턴(H&S, 삼각형 등)은 지표 카테고리로 분류
      result.indicator++;
      const meta = typeof PATTERN_ACADEMIC_META !== 'undefined' ? PATTERN_ACADEMIC_META[type] : null;
      result.names.push(meta && meta.nameKo ? meta.nameKo : type);
    } else {
      result.candle++;  // 알 수 없는 타입은 캔들 기본값
    }
  }

  // signalEngine 결과: 지표 시그널 + 거래량 시그널
  for (const s of signals) {
    if (s.type === 'composite') continue;  // 복합 시그널은 개별 구성요소로 이미 카운트됨
    if (_VOLUME_SIGNAL_TYPES.has(s.type)) {
      result.volume++;
    } else if (_INDICATOR_SIGNAL_TYPES.has(s.type)) {
      result.indicator++;
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════
//  OHLC 정보 바
// ══════════════════════════════════════════════════════

function updateOHLCBar(data) {
  let d = data;
  if (!d && candles.length) {
    const last = candles[candles.length - 1];
    d = { open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume };
  }
  if (!d) return;

  // 캐시된 DOM 참조 사용 (매 crosshair 이동마다 getElementById 호출 방지)
  const oO = _dom.ohlcOpen;
  const oH = _dom.ohlcHigh;
  const oL = _dom.ohlcLow;
  const oC = _dom.ohlcClose;
  const oV = _dom.ohlcVol;
  if (!oO) return;

  const cls = (d.close || 0) >= (d.open || 0) ? 'up' : 'dn';
  oO.textContent = d.open != null ? d.open.toLocaleString() : '—';
  oH.textContent = d.high != null ? d.high.toLocaleString() : '—';
  oL.textContent = d.low != null ? d.low.toLocaleString() : '—';
  oC.textContent = d.close != null ? d.close.toLocaleString() : '—';
  // OHLC 전체에 동일한 방향 색상 적용 (벤치마크: TradingView, 키움)
  oO.className = 'ohlc-val ' + cls;
  oH.className = 'ohlc-val ' + cls;
  oL.className = 'ohlc-val ' + cls;
  oC.className = 'ohlc-val ' + cls;
  if (oV && d.volume != null) oV.textContent = formatVol(d.volume);

  // [UX] 크로스헤어 RSI/MACD 지표값 표시 (캐시된 계산값 사용, 재계산 없음)
  var idx = d._idx;  // crosshair 콜백에서 전달받은 인덱스
  if (idx == null && candles.length) idx = candles.length - 1;

  if (_dom.ohlcRsi) {
    if (activeIndicators.has('rsi') && chartManager._lastRsiValues && idx != null) {
      var rsiVal = chartManager._lastRsiValues[idx];
      if (rsiVal != null) {
        _dom.ohlcRsi.style.display = '';
        _dom.ohlcRsiVal.textContent = rsiVal.toFixed(1);
        _dom.ohlcRsiVal.style.color = rsiVal > 70 ? KRX_COLORS.UP : rsiVal < 30 ? KRX_COLORS.DOWN : '';
      } else {
        _dom.ohlcRsi.style.display = 'none';
      }
    } else {
      _dom.ohlcRsi.style.display = 'none';
    }
  }
  if (_dom.ohlcMacd) {
    if (activeIndicators.has('macd') && chartManager._lastMacdValues && idx != null) {
      var macdVal = chartManager._lastMacdValues.macdLine[idx];
      if (macdVal != null) {
        _dom.ohlcMacd.style.display = '';
        _dom.ohlcMacdVal.textContent = macdVal.toFixed(0);
        _dom.ohlcMacdVal.style.color = macdVal >= 0 ? KRX_COLORS.UP : KRX_COLORS.DOWN;
      } else {
        _dom.ohlcMacd.style.display = 'none';
      }
    } else {
      _dom.ohlcMacd.style.display = 'none';
    }
  }
}

function formatVol(v) {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '억';
  if (v >= 1e4) return Math.floor(v / 1e4).toLocaleString() + '만';
  return v.toLocaleString();
}

// ══════════════════════════════════════════════════════
//  라이브 상태 표시
// ══════════════════════════════════════════════════════

let _prevLiveStatus = null;

function updateLiveStatus(status) {
  const dot = document.getElementById('live-status');
  const label = document.getElementById('live-label');
  if (!dot) return;
  dot.className = 'live-dot ' + status;
  if (label) {
    label.className = 'live-label ' + status;
    // 상태별 라벨 텍스트 — file 모드 추가 (실제 데이터 사용 중 표시)
    var labelMap = {
      live: 'LIVE',
      ws: 'WS',
      file: 'FILE',
      demo: 'DEMO',
      offline: 'OFFLINE'
    };
    label.textContent = labelMap[status] || 'OFFLINE';
  }
  dot.title = {
    live: 'Kiwoom 실시간',
    ws: 'Kiwoom WebSocket 실시간',
    file: '파일 모드 (실제 일봉 데이터)',
    demo: '데모 모드 (시뮬레이션)',
    offline: '연결 끊김'
  }[status] || '';

  // 상태 변경 시에만 toast 알림 (중복 방지)
  if (status !== _prevLiveStatus) {
    _prevLiveStatus = status;
    var toastMap = {
      live: ['Kiwoom 실시간 연결됨', 'success'],
      ws:   ['WebSocket 실시간 연결됨', 'success'],
      file: ['파일 모드 — 실제 일봉 데이터', 'info'],
      demo: ['데모 모드 \u2014 표시되는 모든 데이터는 시뮬레이션입니다', 'warning'],
      offline: ['실시간 연결 끊김', 'warning']
    };
    var t = toastMap[status];
    if (t) showToast(t[0], t[1]);
  }
}

// ══════════════════════════════════════════════════════
//  장 상태 표시 (KST 기준)
// ══════════════════════════════════════════════════════

/**
 * 현재 KST 시각 기준 장 상태 반환.
 * - open:   09:00~15:30 평일
 * - pre:    08:00~09:00 평일
 * - after:  15:30~16:00 평일
 * - closed: 그 외 / 주말
 */
function getMarketState() {
  const now = new Date();
  // KST = UTC+9
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const day = kst.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return 'closed';

  const hhmm = kst.getHours() * 100 + kst.getMinutes();
  if (hhmm >= 900 && hhmm < 1530) return 'open';
  if (hhmm >= 800 && hhmm < 900)  return 'pre';
  if (hhmm >= 1530 && hhmm < 1600) return 'after';
  return 'closed';
}

let _marketStateTimer = null;

function updateMarketState() {
  const el = document.getElementById('market-state');
  if (!el) return;
  const state = getMarketState();
  const labels = { open: '장중', pre: '장전', after: '장후', closed: '장마감' };
  el.textContent = labels[state];
  el.className = 'market-state ' + state;
}

function startMarketStateTimer() {
  // [FIX] 기존 타이머 정리 (중복 방지)
  if (_marketStateTimer) clearInterval(_marketStateTimer);
  updateMarketState();
  // 매 30초마다 갱신
  _marketStateTimer = setInterval(updateMarketState, 30000);
}

// ══════════════════════════════════════════════════════
//  종목 선택
// ══════════════════════════════════════════════════════

async function selectStock(code) {
  const version = ++_selectVersion;
  currentStock = ALL_STOCKS.find(s => s.code === code);
  if (!currentStock) return;

  // 종목 선택 저장
  _savePrefs({ stock: code });

  sidebarManager.setActive(code);

  // 최근 조회 종목 기록 (사이드바 연동)
  if (typeof sidebarManager !== 'undefined' && sidebarManager.setRecentStock) {
    sidebarManager.setRecentStock(code);
  }

  // [FIX] 레이스 컨디션 수정: 비동기 getCandles() 전에 worker/drag 버전 증가
  _lastPatternAnalysis = 0;
  _workerVersion++;
  _workerPending = false;
  _dragVersion++;
  if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
  _chartPatternStructLines = [];
  _lastActivePattern = null;
  detectedPatterns = [];
  detectedSignals = [];
  signalStats = null;
  _activePriceLines = [];
  _prevPrice = null;
  _prevPatternCount = -1;
  if (typeof backtester !== 'undefined') backtester.invalidateCache();

  // [OPT] 로딩 shimmer를 기존 차트 위에 표시 (빈 차트 노출 방지)
  _dom.mainContainer.classList.add('chart-loading');

  // [OPT] 데이터를 먼저 fetch — 차트 destroy/recreate 전에 데이터 준비
  var newCandles;
  try {
    newCandles = await dataService.getCandles(currentStock, currentTimeframe);
  } catch (e) {
    console.error('[KRX] 캔들 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 데이터 로드 실패', 'error');
    newCandles = [];
  }
  if (version !== _selectVersion) return;

  // 데이터 준비 완료 → 차트 재생성 + 즉시 데이터 투입
  candles = newCandles;

  chartManager.destroyAll();
  chartManager.createMainChart(_dom.mainContainer);
  _cacheDom();  // [FIX] 차트 재생성 후 DOM 캐시 갱신

  // 드로잉 도구 재연결 (차트 재생성 후)
  if (typeof drawingTools !== 'undefined') {
    drawingTools.detach();
    drawingTools.setStockCode(code);
    _initDrawingTools();
  }

  // 로딩 해제
  _dom.mainContainer.classList.remove('chart-loading');

  if (candles.length > 0) {
    _markDataFresh();  // 종목 변경 데이터 수신 시각 기록
    updateChartFull();
    updateStockInfo();
    _updatePriceLinesFromCandles();  // [FIX] 종목 변경 시 가격선 1회 생성
    updateOHLCBar(null);
    // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
    if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
      // 분봉 JSON 실제 로드 여부: Unix 타임스탬프(숫자)면 분봉, 문자열(YYYY-MM-DD)이면 일봉 폴백
      var _hasIntraday = candles.length > 0 && typeof candles[0].time === 'number';
      chartManager.setWatermark(_buildWatermark(currentStock.name, _hasIntraday ? '' : '일봉 — 분봉 데이터 미제공'));
    } else {
      chartManager.setWatermark(_buildWatermark(currentStock.name));
    }
  } else if (KRX_API_CONFIG.mode === 'ws') {
    console.log('[KRX] WS 모드 — 서버 캔들 수신 대기 중...');
    chartManager.setWatermark(_buildWatermark(currentStock.name, '서버 연결 중...'));
  } else if (KRX_API_CONFIG.mode === 'file') {
    chartManager.setWatermark(_buildWatermark(currentStock.name, '데이터 없음'));
  } else {
    chartManager.setWatermark(_buildWatermark(currentStock.name));
  }
  updateFinancials();

  // [FIX] OHLC 바 RAF 디바운스
  chartManager.onCrosshairMove(function(param) {
    cancelAnimationFrame(_ohlcRafId);
    _ohlcRafId = requestAnimationFrame(function() { updateOHLCBar(param); });
  });
  chartManager.onPatternHover(handlePatternTooltip);

  startRealtimeTick();

  // 즐겨찾기 별 버튼 갱신
  _updateStarBtn();
}

// ══════════════════════════════════════════════════════
//  종목 정보 업데이트
// ══════════════════════════════════════════════════════

function updateStockInfo() {
  if (!candles.length) return;
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const prevClose = prev ? prev.close : last.open;  // 전일 종가, 없으면 당일 시가
  const change = last.close - prevClose;
  const pct = prevClose > 0 ? ((change / prevClose) * 100).toFixed(2) : '0.00';
  const cls = change >= 0 ? 'up' : 'dn';
  const sign = change >= 0 ? '\u25B2' : '\u25BC';

  document.getElementById('stock-name').textContent = currentStock.name;
  document.getElementById('stock-code').textContent = currentStock.code;
  // [FIX-TRUST] 데모 모드일 때 시장명 옆에 데모 표시
  var _marketSuffix = currentStock.market;
  if (typeof isRealData === 'function' && !isRealData()) {
    _marketSuffix += ' (데모)';
  }
  document.getElementById('stock-market').textContent = _marketSuffix;

  const priceEl = document.getElementById('stock-price');
  const changeEl = document.getElementById('stock-change');
  priceEl.textContent = last.close.toLocaleString();
  priceEl.className = 'sh-price ' + cls;
  changeEl.textContent =
    `${sign} ${Math.abs(change).toLocaleString()} (${change >= 0 ? '+' : ''}${pct}%)`;
  changeEl.className = 'sh-change ' + cls;

  // 시가/고가/저가/거래량 업데이트 (stock-header 상세)
  const shOpen = document.getElementById('sh-open');
  const shHigh = document.getElementById('sh-high');
  const shLow = document.getElementById('sh-low');
  const shVol = document.getElementById('sh-volume');
  if (shOpen) shOpen.textContent = last.open ? last.open.toLocaleString() : '\u2014';
  if (shHigh) shHigh.textContent = last.high ? last.high.toLocaleString() : '\u2014';
  if (shLow) shLow.textContent = last.low ? last.low.toLocaleString() : '\u2014';
  if (shVol) shVol.textContent = last.volume ? formatVol(last.volume) : '\u2014';

  // 가격 변화 flash 효과
  if (_prevPrice !== null && last.close !== _prevPrice) {
    const flashCls = last.close > _prevPrice ? 'price-flash-up' : 'price-flash-down';
    priceEl.classList.add(flashCls);
    changeEl.classList.add(flashCls);
    const cleanup = () => {
      priceEl.classList.remove('price-flash-up', 'price-flash-down');
      changeEl.classList.remove('price-flash-up', 'price-flash-down');
    };
    priceEl.addEventListener('animationend', cleanup, { once: true });
  }
  _prevPrice = last.close;

  // [FIX] 가격선 업데이트는 각 호출 경로에서 명시적으로 수행
  // updateStockInfo() 내부에서 updatePriceLines()를 호출하면
  // _flushTickRender() 등에서 이중 호출되어 중복 라벨 발생
  // → 가격선은 호출 경로별로 1회만 생성되도록 분리
}

/** [FIX] 캔들 데이터 기반 가격선 표시 — 현재가 + 전일종가 (고/저점은 updateVisibleHighLow에서 처리) */
function _updatePriceLinesFromCandles() {
  if (!candles.length) return;
  var lastC = candles[candles.length - 1];
  var prevC = candles.length >= 2 ? candles[candles.length - 2] : null;
  // 고/저가는 chart.js의 updateVisibleHighLow()가 visible range 기반으로 처리
  // updatePriceLines 시그니처 유지 (currentPrice, dayHigh, dayLow, prevClose) — high/low는 0 전달
  chartManager.updatePriceLines(
    lastC.close,
    0,
    0,
    prevC ? prevC.close : lastC.open
  );
  // visible range 기반 고/저점 설정
  if (typeof chartManager.updateVisibleHighLow === 'function') {
    chartManager.updateVisibleHighLow(candles);
  }
}

// ── 재무지표: financials.js로 분리됨 ──
// ── 함수: updateFinancials, _getMarketCapEok, _calcCAGR, _calcInvestmentScore,
//          _calcFinChanges, drawOPMSparkline, _sparklineLabel, drawFinTrendChart ──

// ── 패턴 패널: patternPanel.js로 분리됨 ──
// ── 함수: renderPatternPanel, updatePatternSummaryBar, updatePatternHistoryBar,
//          updatePatternHistoryTable, drawReturnCurve, _calcYTicks,
//          updateReturnStatsGrid, renderPatternCards ──
// ── PATTERN_ACADEMIC_META 상수도 patternPanel.js에 위치 ──



// ══════════════════════════════════════════════════════
//  시그널 카테고리 필터 (작업 1)
//
//  왜: 22종 시그널이 동시 표시되면 차트가 혼잡. 사용자가
//  관심 카테고리(MA/MACD/RSI/BB/Vol/복합)만 선택적으로
//  표시할 수 있어야 분석 효율이 올라감.
// ══════════════════════════════════════════════════════

function initSignalFilter() {
  // 시그널 필터 (레이어 드롭다운 내 통합)
  const filterWrap = document.getElementById('signal-filter-wrap');

  if (filterWrap) {
    // 시그널 상세 필터 체크박스 변경
    filterWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const cat = cb.dataset.cat;
        if (cb.checked) {
          activeSignalCategories.add(cat);
        } else {
          activeSignalCategories.delete(cat);
        }
        _applySignalFilter();
      });
    });
  }

  // ── 시각화 레이어 토글 (4카테고리) ──
  var vizWrap = document.getElementById('viz-toggle-wrap');
  var vizBtn = document.getElementById('viz-toggle-btn');
  var vizMenu = document.getElementById('viz-toggle-menu');

  if (vizBtn && vizMenu) {
    vizBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      // 다른 드롭다운 닫기
      if (typeof indDropdownMenu !== 'undefined' && indDropdownMenu) indDropdownMenu.classList.remove('show');
      vizMenu.classList.toggle('show');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#viz-toggle-wrap')) {
        vizMenu.classList.remove('show');
      }
    });
    vizMenu.querySelectorAll('input[data-viz]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        vizToggles[cb.dataset.viz] = cb.checked;
        _savePrefs({ vizToggles: vizToggles });
        // 전체 선택/해제 체크박스 상태 동기화
        _syncVizSelectAll();
        // 시그널 필터 가시성 연동
        if (filterWrap) {
          filterWrap.style.display = (patternEnabled && vizToggles.signal) ? '' : 'none';
        }
        _renderOverlays();
        // 패턴 패널도 갱신
        if (typeof renderPatternPanel === 'function') {
          renderPatternPanel(_filterPatternsForViz(detectedPatterns));
        }
      });
    });
  }

  // 패턴 상세 팝업 열기/닫기
  const detailBtn = document.getElementById('psb-detail-btn');
  const popup = document.getElementById('pattern-detail-popup');
  const popupClose = document.getElementById('pdp-close');

  if (detailBtn && popup) {
    detailBtn.addEventListener('click', () => {
      popup.classList.toggle('show');
    });
  }
  if (popupClose && popup) {
    popupClose.addEventListener('click', () => {
      popup.classList.remove('show');
    });
  }
  // 팝업 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (popup && popup.classList.contains('show')) {
      if (!e.target.closest('#pattern-detail-popup') && !e.target.closest('#psb-detail-btn')) {
        popup.classList.remove('show');
      }
    }
  });
}

/**
 * 시그널 카테고리 필터 적용
 * signalEngine의 _signalCategory() 분류 기준과 동일하게 필터링 후
 * signalRenderer에 필터된 시그널만 전달
 */
function _applySignalFilter() {
  if (!detectedSignals.length) return;

  const filtered = _filterSignalsByCategory(detectedSignals);

  // 시그널 Canvas 재렌더링
  if (typeof signalRenderer !== 'undefined') {
    signalRenderer.render(chartManager, candles, filtered, {
      volumeActive: activeIndicators.has('vol'),
      chartType: chartType,
    });
  }

  // 호버 데이터도 갱신
  chartManager.setHoverData(candles, detectedPatterns, filtered);
}

/**
 * activeSignalCategories에 따라 시그널 배열 필터링
 * signalEngine._signalCategory() 직접 호출 (중복 로직 제거)
 */
function _filterSignalsByCategory(signals) {
  return signals.filter(s => {
    // ── 5-Tier 시그널 필터링 ──
    var sType = s.type;
    // D-Tier 시그널: 차트 렌더링 완전 제거
    if (_TIER_D_SIGNALS.has(sType)) return false;
    // 복합시그널 Tier 필터링
    if (s.source === 'composite' || sType === 'composite') {
      if (!activeSignalCategories.has('composite')) return false;
      var compId = s.compositeId || s.id || '';
      // D-Tier 복합시그널 제거
      if (_TIER_D_COMPOSITES.has(compId)) return false;
      // B-Tier 복합시그널 비활성 (학술 검증 후 승격 가능)
      if (_TIER_B_COMPOSITES.has(compId)) return false;
      // S+A Tier만 렌더링
      return _ACTIVE_COMPOSITES.has(compId);
    }
    // B-Tier 개별 시그널: 차트 렌더링 비활성
    if (_TIER_B_SIGNALS.has(sType)) return false;
    // 카테고리 필터 적용
    const cat = signalEngine._signalCategory(sType);
    return activeSignalCategories.has(cat);
  });
}


// ══════════════════════════════════════════════════════
//  패턴/시그널 호버 툴팁 (작업 2)
//
//  왜: Canvas2D 위 도형은 DOM 이벤트를 받을 수 없음.
//  subscribeCrosshairMove()에서 시간 비교로 근접 패턴을
//  감지하고 HTML 툴팁으로 상세 정보를 표시.
//  LWC 공식 문서 권장 패턴.
// ══════════════════════════════════════════════════════

function handlePatternTooltip(data) {
  const tooltip = document.getElementById('pattern-tooltip');
  if (!tooltip) return;

  if (!data || !data.items || !data.items.length) {
    tooltip.classList.remove('show');
    return;
  }

  // 툴팁 내용 빌드
  const html = data.items.map(item => {
    const sc = item.signal === 'buy' ? 'buy' : item.signal === 'sell' ? 'sell' : 'neutral';
    const st = item.signal === 'buy' ? '매수' : item.signal === 'sell' ? '매도' : '중립';

    // 학술 설명 조회 (패턴 소스인 경우)
    let academicDescHtml = '';
    if (item.source === 'pattern' && item.type) {
      const itemMeta = PATTERN_ACADEMIC_META[item.type];
      if (itemMeta) {
        // 학술 설명 2줄 제한 (약 80자)
        const desc = itemMeta.academicDesc;
        const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
        academicDescHtml = `<div class="pt-academic">${shortDesc}</div>`;
      }
    }

    const confColor = (item.confidence || 0) >= 60 ? KRX_COLORS.UP :
                      (item.confidence || 0) >= 40 ? KRX_COLORS.ACCENT : KRX_COLORS.DOWN;
    const confText = item.confidence != null ? `<span class="pt-conf" style="color:${confColor}">${item.confidence}%</span>` : '';

    let meta = '';
    const metaParts = [];
    if (item.stopLoss) metaParts.push(`<span class="pt-sl">SL ${item.stopLoss.toLocaleString()}</span>`);
    if (item.priceTarget) metaParts.push(`<span class="pt-tp">TP ${item.priceTarget.toLocaleString()}</span>`);
    if (item.strength) {
      const strLabel = item.strength === 'strong' ? '강' : item.strength === 'medium' ? '중' : '약';
      metaParts.push(`<span>${strLabel}</span>`);
    }
    if (item.tier) metaParts.push(`<span>Tier ${item.tier}</span>`);
    if (item.confluence) metaParts.push(`<span style="color:${KRX_COLORS.NEUTRAL}">합류</span>`);
    if (metaParts.length) meta = `<div class="pt-meta">${metaParts.join('')}</div>`;

    // ── 예상 수익률 (priceTarget 기반 + 리스크/리워드 비율 바) ──
    //  벤치마크: Autochartist Forecast Zone의 "Expected Move" 표시
    //  TrendSpider의 "Projected Move" + R:R ratio 바
    let forecastHtml = '';
    if (item.source === 'pattern' && item.priceTarget && item.stopLoss) {
      // 진입가: chart.js에서 전달받은 실제 패턴 완성 봉 종가
      const entry = item.entryPrice || ((item.priceTarget + item.stopLoss) / 2);
      const reward = Math.abs(item.priceTarget - entry);
      const risk = Math.abs(entry - item.stopLoss);
      const rr = risk > 0 ? (reward / risk).toFixed(1) : '--';
      const retPct = entry > 0 ? ((item.priceTarget - entry) / entry * 100).toFixed(1) : '--';
      const retSign = parseFloat(retPct) >= 0 ? '+' : '';
      const retCls = parseFloat(retPct) >= 0 ? 'up' : 'dn';

      // R:R 비율 바 (시각적 리스크/리워드)
      const rrNum = parseFloat(rr);
      const rewardPct = rrNum > 0 ? Math.min(80, Math.round(rrNum / (1 + rrNum) * 100)) : 50;

      forecastHtml = `<div class="pt-forecast"><div class="pt-forecast-row"><span class="pt-forecast-ret ${retCls}">${retSign}${retPct}%</span><span class="pt-forecast-rr">R:R ${rr}</span></div><div class="pt-rr-bar"><div class="pt-rr-reward" style="width:${rewardPct}%"></div></div></div>`;
    }

    // ── 과거 수익률 (backtester 연동) ──
    //  벤치마크: TradingView Auto Chart Patterns의 "Historical Performance"
    //  Thomas Bulkowski 통계 스타일: 샘플 수 + 5일 후 평균 수익률 + 승률
    let backtestHtml = '';
    if (item.source === 'pattern' && item.type && typeof backtester !== 'undefined' && candles && candles.length >= 50) {
      try {
        const btResult = backtester.backtest(candles, item.type);
        if (btResult && btResult.sampleSize > 0) {
          const h5 = btResult.horizons[5];
          if (h5 && h5.n > 0) {
            const btRetSign = h5.mean >= 0 ? '+' : '';
            const btRetCls = h5.mean >= 0 ? 'up' : 'dn';
            backtestHtml = `<div class="pt-backtest"><span class="pt-bt-label">과거 ${btResult.sampleSize}회</span><span class="pt-bt-ret ${btRetCls}">${btRetSign}${h5.mean.toFixed(1)}% (5D)</span><span class="pt-bt-win">${h5.winRate.toFixed(0)}%승</span></div>`;
          }
        }
      } catch (e) { /* backtester 오류 무시 */ }
    }

    return `<div class="pt-header"><span class="pt-name">${item.name}</span><span class="pt-signal ${sc}">${st}</span>${confText}</div><div class="pt-desc">${item.description}</div>${academicDescHtml}${forecastHtml}${backtestHtml}${meta}`;
  }).join('<div style="border-top:1px solid rgba(255,255,255,0.04);margin:4px 0"></div>');

  tooltip.innerHTML = html;

  // 위치 계산: 크로스헤어 point 기준
  if (data.point) {
    const chartWrap = document.getElementById('chart-wrap');
    if (chartWrap) {
      const wrapRect = chartWrap.getBoundingClientRect();
      const chartContainer = document.getElementById('main-chart-container');
      const chartRect = chartContainer ? chartContainer.getBoundingClientRect() : wrapRect;

      // chart-wrap 내 상대 좌표로 변환
      let left = data.point.x + (chartRect.left - wrapRect.left) + 16;
      let top = data.point.y + (chartRect.top - wrapRect.top) - 10;

      // 우측 넘침 방지
      const tooltipWidth = 240;
      if (left + tooltipWidth > wrapRect.width) {
        left = data.point.x + (chartRect.left - wrapRect.left) - tooltipWidth - 16;
      }
      // 하단 넘침 방지
      if (top + 120 > wrapRect.height) {
        top = Math.max(4, wrapRect.height - 130);
      }
      // 상단 넘침 방지
      if (top < 30) top = 30;

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
  }

  tooltip.classList.add('show');
}


// ══════════════════════════════════════════════════════
//  패턴 패널 ↔ 차트 연동 (작업 3)
//
//  왜: 우측 패턴 패널에서 항목 클릭 시 차트가 해당 봉으로
//  스크롤되어야 자연스러운 분석 흐름이 됨.
//  setVisibleLogicalRange()로 해당 봉을 화면 중앙에 배치.
// ══════════════════════════════════════════════════════

function scrollChartToPattern(time, index) {
  if (!chartManager.mainChart || !candles.length) return;

  const ts = chartManager.mainChart.timeScale();
  const totalBars = candles.length;

  // 화면에 보이는 봉 수 계산
  const visRange = ts.getVisibleLogicalRange();
  let visibleBars = 60; // 기본값
  if (visRange) {
    visibleBars = Math.max(20, Math.round(visRange.to - visRange.from));
  }

  // 해당 봉을 화면 중앙에 배치
  const half = Math.floor(visibleBars / 2);
  const centerIdx = index != null ? index : candles.findIndex(c => c.time === time);
  if (centerIdx < 0) return;

  const from = Math.max(0, centerIdx - half);
  const to = from + visibleBars;

  ts.setVisibleLogicalRange({ from, to });
}


// ══════════════════════════════════════════════════════
//  검색 이벤트
// ══════════════════════════════════════════════════════

const searchInput = document.getElementById('search-input');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { dropdown.classList.remove('show'); return; }
  const matches = dataService.searchStocks(q).slice(0, 10);
  dropdown.innerHTML = '';
  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'search-item';
    empty.style.color = '#555e78';
    empty.textContent = '검색 결과 없음';
    dropdown.appendChild(empty);
  } else {
    matches.forEach(s => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.dataset.code = s.code;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = s.name;
      const codeSpan = document.createElement('span');
      codeSpan.className = 'code';
      codeSpan.textContent = s.code;
      const marketSpan = document.createElement('span');
      marketSpan.className = 'market-tag ' + s.market.toLowerCase();
      marketSpan.textContent = s.market;
      item.appendChild(nameSpan);
      item.appendChild(codeSpan);
      item.appendChild(marketSpan);
      item.addEventListener('click', () => {
        selectStock(item.dataset.code);
        searchInput.value = '';
        dropdown.classList.remove('show');
      });
      dropdown.appendChild(item);
    });
  }
  dropdown.classList.add('show');
});

// Enter 키로 첫 번째 검색 결과 선택
searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = dropdown.querySelector('.search-item[data-code]');
  if (first) {
    selectStock(first.dataset.code);
    searchInput.value = '';
    dropdown.classList.remove('show');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-wrap')) dropdown.classList.remove('show');
});

// ══════════════════════════════════════════════════════
//  툴바 이벤트
// ══════════════════════════════════════════════════════

// ── 차트 타입 ──
document.querySelectorAll('.ct-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartType = btn.dataset.ct;
    _savePrefs({ chartType: chartType });
    updateChartFull();
    _updatePriceLinesFromCandles();
  });
});

// ── 타임프레임 ──
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeframe = btn.dataset.tf;
    _savePrefs({ timeframe: currentTimeframe });

    // [OPT] 빠른 타임프레임 전환 시 이전 fetch 결과 무시
    var myTfVersion = ++_tfVersion;

    // [FIX] 레이스 컨디션 수정: 비동기 fetch 전에 상태 초기화
    _lastPatternAnalysis = 0;
    _workerVersion++;
    _workerPending = false;
    _dragVersion++;
    if (_dragDebounceTimer) { clearTimeout(_dragDebounceTimer); _dragDebounceTimer = null; }
    _chartPatternStructLines = [];
    _lastActivePattern = null;
    detectedPatterns = [];
    detectedSignals = [];
    _activePriceLines = [];
    _prevPrice = null;
    _prevPatternCount = -1;

    // [OPT] 로딩 shimmer를 기존 차트 위에 표시 (빈 차트 노출 방지)
    _dom.mainContainer.classList.add('chart-loading');

    // [OPT] 데이터를 먼저 fetch — 차트 destroy/recreate 전에 데이터 준비
    // 캐시 히트 시 즉시 반환 (~0ms), 네트워크 fetch 시에만 대기
    // 기존: destroyAll → createChart → await fetch (빈 차트 노출)
    // 변경: await fetch → destroyAll → createChart → setData (즉시 렌더)
    var newCandles;
    try {
      newCandles = await dataService.getCandles(currentStock, currentTimeframe);
    } catch (e) {
      console.error('[KRX] 캔들 데이터 로드 실패:', e);
      newCandles = [];
    }

    // [OPT] stale 결과 무시 — 이미 다른 타임프레임으로 전환됨
    if (myTfVersion !== _tfVersion) return;

    // 데이터 준비 완료 → 차트 재생성 + 즉시 데이터 투입
    candles = newCandles;

    chartManager.destroyAll();
    chartManager.createMainChart(_dom.mainContainer);
    _cacheDom();  // [FIX] 차트 재생성 후 DOM 캐시 갱신
    // [FIX] OHLC 바 RAF 디바운스
    chartManager.onCrosshairMove(function(param) {
      cancelAnimationFrame(_ohlcRafId);
      _ohlcRafId = requestAnimationFrame(function() { updateOHLCBar(param); });
    });
    chartManager.onPatternHover(handlePatternTooltip);
    // 드로잉 도구 재연결 (차트 재생성 후)
    if (typeof drawingTools !== 'undefined') {
      drawingTools.detach();
      _initDrawingTools();
    }

    // 로딩 해제
    _dom.mainContainer.classList.remove('chart-loading');
    if (candles.length > 0) {
      _markDataFresh();  // 타임프레임 변경 데이터 수신 시각 기록
      updateChartFull();
      updateStockInfo();
      _updatePriceLinesFromCandles();  // [FIX] 타임프레임 변경 시 가격선 1회 생성
      updateOHLCBar(null);
      // file 모드 + 분봉: 일봉 데이터 표시 중임을 안내
      if (currentTimeframe !== '1d' && KRX_API_CONFIG.mode === 'file') {
        var _hasIntraday = candles.length > 0 && typeof candles[0].time === 'number';
        chartManager.setWatermark(_buildWatermark(currentStock.name, _hasIntraday ? '' : '일봉 — 분봉 데이터 미제공'));
      } else {
        chartManager.setWatermark(_buildWatermark(currentStock.name));
      }
    } else if (KRX_API_CONFIG.mode === 'ws') {
      console.log('[KRX] WS 모드 — %s 캔들 서버 수신 대기 중...', currentTimeframe);
      chartManager.setWatermark(_buildWatermark(currentStock.name, currentTimeframe + ' 로드 중...'));
    } else if (KRX_API_CONFIG.mode === 'file') {
      chartManager.setWatermark(_buildWatermark(currentStock.name, '데이터 없음'));
    } else {
      chartManager.setWatermark(_buildWatermark(currentStock.name));
    }
    startRealtimeTick();
  });
});

// ── 지표 드롭다운 토글 ──
const indDropdownToggle = document.getElementById('ind-dropdown-toggle');
const indDropdownMenu = document.getElementById('ind-dropdown-menu');

if (indDropdownToggle && indDropdownMenu) {
  // 드롭다운 열기/닫기
  indDropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    // 다른 드롭다운 닫기
    var vizM = document.getElementById('viz-toggle-menu');
    if (vizM) vizM.classList.remove('show');
    indDropdownMenu.classList.toggle('show');
  });

  // 드롭다운 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!indDropdownToggle.closest('.ind-dropdown-wrap').contains(e.target)) {
      indDropdownMenu.classList.remove('show');
    }
  });

  // 체크박스 변경 시 지표 토글 (data-ind 속성이 있는 체크박스만 — select-all 제외)
  // [2-slot 모델] 오실레이터 그룹은 상호 배제 (investing.com 스타일)
  indDropdownMenu.querySelectorAll('input[data-ind]').forEach(cb => {
    cb.addEventListener('change', () => {
      const ind = cb.dataset.ind;
      if (cb.checked) {
        // 오실레이터 상호 배제: 새 오실레이터 ON → 기존 오실레이터 OFF
        if (OSCILLATOR_GROUP.includes(ind)) {
          OSCILLATOR_GROUP.forEach(other => {
            if (other !== ind && activeIndicators.has(other)) {
              _deactivateOscillator(other);
            }
          });
        }
        activeIndicators.add(ind);
      } else {
        activeIndicators.delete(ind);
      }
      // 활성 지표가 있으면 드롭다운 버튼에 accent 표시
      indDropdownToggle.classList.toggle('has-active', activeIndicators.size > 0);
      // 전체 선택/해제 체크박스 상태 동기화
      _syncIndSelectAll();
      // 지표 상태를 localStorage에 저장
      _savePrefs({ indicators: Array.from(activeIndicators) });
      updateChartFull();
    });
  });
}

// ── 지표 전체 선택/해제 ──
// [2-slot 모델] Murphy 세트 전부 활성이면 체크, 아니면 해제
function _syncIndSelectAll() {
  var selectAll = document.getElementById('ind-select-all');
  if (!selectAll) return;
  // S+A Tier 추천 세트 (Kalman D-tier 제외, EMA 조건부)
  var murphySet = ['vol', 'ma', 'bb', 'ich', 'macd', 'rsi'];
  var allMurphy = murphySet.every(function(ind) { return activeIndicators.has(ind); });
  selectAll.checked = allMurphy;
}

// [2-slot 모델] 전체 선택 → Murphy 추천 콤보 (vol + ma + bb + macd + rsi) 또는 전체 해제
// 오실레이터 7개 동시 활성화 방지
var indSelectAll = document.getElementById('ind-select-all');
if (indSelectAll) {
  indSelectAll.addEventListener('change', function() {
    var checked = indSelectAll.checked;
    // S+A Tier 추천 세트: 오버레이(vol, ma, bb, ich) + MACD + RSI
    // D-Tier 제외: Kalman(weight=0, ρ>0.90 EMA), EMA(MACD 활성시 중복)
    var murphySet = new Set(['vol', 'ma', 'bb', 'ich', 'macd', 'rsi']);
    document.querySelectorAll('#ind-dropdown-menu input[data-ind]').forEach(function(cb) {
      var ind = cb.dataset.ind;
      var shouldBeOn = checked && murphySet.has(ind);
      if (cb.checked !== shouldBeOn) {
        cb.checked = shouldBeOn;
        if (shouldBeOn) {
          activeIndicators.add(ind);
        } else {
          // 기존 오실레이터 파괴 (DOM + 차트)
          if (OSCILLATOR_GROUP.includes(ind) && activeIndicators.has(ind)) {
            _deactivateOscillator(ind);
          } else {
            activeIndicators.delete(ind);
          }
        }
      }
    });
    var indTogBtn = document.getElementById('ind-dropdown-toggle');
    if (indTogBtn) indTogBtn.classList.toggle('has-active', activeIndicators.size > 0);
    _savePrefs({ indicators: Array.from(activeIndicators) });
    updateChartFull();
  });
}

// ── 표시(viz) 전체 선택/해제 ──
function _syncVizSelectAll() {
  var selectAll = document.getElementById('viz-select-all');
  if (!selectAll) return;
  var allCbs = document.querySelectorAll('#viz-toggle-menu input[data-viz]');
  var allChecked = true;
  allCbs.forEach(function(cb) { if (!cb.checked) allChecked = false; });
  selectAll.checked = allChecked && allCbs.length > 0;
}

var vizSelectAll = document.getElementById('viz-select-all');
if (vizSelectAll) {
  vizSelectAll.addEventListener('change', function() {
    var checked = vizSelectAll.checked;
    document.querySelectorAll('#viz-toggle-menu input[data-viz]').forEach(function(cb) {
      if (cb.checked !== checked) {
        cb.checked = checked;
        vizToggles[cb.dataset.viz] = checked;
      }
    });
    _savePrefs({ vizToggles: vizToggles });
    // 시그널 필터 가시성 연동
    var filterWrap = document.getElementById('signal-filter-wrap');
    if (filterWrap) filterWrap.style.display = (patternEnabled && vizToggles.signal) ? '' : 'none';
    _renderOverlays();
    if (typeof renderPatternPanel === 'function') {
      renderPatternPanel(_filterPatternsForViz(detectedPatterns));
    }
  });
}

// ── 패턴 토글 ──
const patternBtn = document.getElementById('pattern-toggle');
if (patternBtn) {
  patternBtn.addEventListener('click', () => {
    patternEnabled = !patternEnabled;
    _savePrefs({ patternEnabled: patternEnabled });
    patternBtn.classList.toggle('active', patternEnabled);

    // 패턴 요약 바 표시/숨김
    const summaryWrap = document.getElementById('pattern-summary-wrap');
    if (summaryWrap) summaryWrap.style.display = patternEnabled ? '' : 'none';

    // 시각화 레이어 토글 표시/숨김
    const vizWrapEl = document.getElementById('viz-toggle-wrap');
    if (vizWrapEl) vizWrapEl.style.display = patternEnabled ? '' : 'none';

    // 시그널 필터 드롭다운 표시/숨김
    const filterWrap = document.getElementById('signal-filter-wrap');
    var sfTitle = document.getElementById('signal-filter-title');
    var sfWrap = document.getElementById('signal-filter-wrap');
    if (sfTitle) sfTitle.style.display = vizToggles.signal ? '' : 'none';
    if (sfWrap) sfWrap.style.display = vizToggles.signal ? '' : 'none';

    // 과거 수익률 영역 표시/숨김
    const retArea = document.getElementById('return-stats-area');
    if (retArea) retArea.style.display = patternEnabled ? '' : 'none';

    if (!patternEnabled) {
      detectedPatterns = [];
      detectedSignals = [];
      renderPatternPanel([]);
      // 툴팁 숨기기
      const tt = document.getElementById('pattern-tooltip');
      if (tt) tt.classList.remove('show');
      // 상세 팝업 닫기
      const popup = document.getElementById('pattern-detail-popup');
      if (popup) popup.classList.remove('show');
      // 과거 수익률 바 숨기기
      const phBar = document.getElementById('pattern-history-bar');
      if (phBar) phBar.style.display = 'none';
    } else {
      _lastPatternAnalysis = 0;
    }
    updateChartFull();
  });
}


// ── 통합 탭 패널 (<=1200px: C+D 통합) ──
// >1200px: C열(패턴) + D열(재무) 분리 — 기존 4열 그리드
// <=1200px: #right-panel 내 탭 바로 재무/패턴 전환, #pp-cards DOM 이동

/** 활성 탭 ID ('fin' | 'pattern') */
var _rpActiveTab = 'fin';

/** 탭 스크롤 위치 보존 */
var _tabScrollPos = { fin: 0, pattern: 0 };

/**
 * #pp-cards DOM 이동: C열 ↔ D열 탭
 * <=1200px일 때 #pp-cards를 #rp-pattern-content로 이동
 * >1200px로 복귀 시 원래 #pp-content로 복원
 */
function _migratePpCards(toTab) {
  var ppCards = document.getElementById('pp-cards');
  if (!ppCards) return;
  var target = toTab
    ? document.getElementById('rp-pattern-content')
    : document.getElementById('pp-content');
  if (target && ppCards.parentElement !== target) {
    target.appendChild(ppCards);
  }
}

/**
 * 탭 전환: 인디케이터 슬라이딩 + 콘텐츠 교체
 */
function _switchRpTab(tabId) {
  var tabBar = document.getElementById('rp-tab-bar');
  if (!tabBar) return;
  var tabs = tabBar.querySelectorAll('.rp-tab');
  var indicator = tabBar.querySelector('.rp-tab-indicator');
  var finContent = document.getElementById('fin-content');
  var patternContent = document.getElementById('rp-pattern-content');

  // 현재 탭 스크롤 위치 저장
  var curContent = tabId === 'fin' ? patternContent : finContent;
  if (curContent) _tabScrollPos[_rpActiveTab] = curContent.scrollTop;

  _rpActiveTab = tabId;

  // 탭 버튼 active 상태
  tabs.forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });

  // 콘텐츠 전환
  if (finContent) finContent.classList.toggle('active', tabId === 'fin');
  if (patternContent) patternContent.classList.toggle('active', tabId === 'pattern');

  // 인디케이터 슬라이딩
  if (indicator) {
    var activeBtn = tabBar.querySelector('.rp-tab.active');
    if (activeBtn) {
      indicator.style.left = activeBtn.offsetLeft + 'px';
      indicator.style.width = activeBtn.offsetWidth + 'px';
    }
  }

  // 새 탭 스크롤 위치 복원
  var newContent = tabId === 'fin' ? finContent : patternContent;
  if (newContent) newContent.scrollTop = _tabScrollPos[tabId] || 0;
}

(function initRpTabPanel() {
  var tabBar = document.getElementById('rp-tab-bar');
  if (!tabBar) return;

  var tabs = tabBar.querySelectorAll('.rp-tab');
  var indicator = tabBar.querySelector('.rp-tab-indicator');
  var mqTabMode = window.matchMedia('(max-width: 1200px)');

  // 탭 클릭 핸들러
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      _switchRpTab(tab.dataset.tab);
      _savePrefs({ rpActiveTab: _rpActiveTab });
    });
  });

  // 인디케이터 초기 위치
  function positionIndicator() {
    if (!indicator) return;
    var activeBtn = tabBar.querySelector('.rp-tab.active');
    if (activeBtn) {
      indicator.style.left = activeBtn.offsetLeft + 'px';
      indicator.style.width = activeBtn.offsetWidth + 'px';
    }
  }

  // matchMedia: 탭 모드 전환 시 DOM 이동
  function onModeChange(e) {
    if (e.matches) {
      // <=1200px: 탭 모드 진입 — #pp-cards를 D열 탭으로 이동
      _migratePpCards(true);
      requestAnimationFrame(positionIndicator);
    } else {
      // >1200px: 데스크탑 복원 — #pp-cards를 C열로 복귀
      _migratePpCards(false);
      // 재무 탭을 항상 활성으로 리셋 (D열은 재무 전용)
      _rpActiveTab = 'fin';
      _switchRpTab('fin');
    }
  }

  mqTabMode.addEventListener('change', onModeChange);

  // 초기 상태
  if (mqTabMode.matches) {
    _migratePpCards(true);
    requestAnimationFrame(positionIndicator);
  }

  // 리사이즈 시 인디케이터 위치 재계산
  window.addEventListener('resize', function() {
    if (mqTabMode.matches) positionIndicator();
  });
})();

// ══════════════════════════════════════════════════════
//  사이드바 드로어 (1024px 이하)
//  - 1024px 이하에서 사이드바는 슬라이드 오버레이 드로어
//  - 기존 #sidebar-toggle 햄버거로 열기/닫기
//  - 백드롭 #sb-backdrop 클릭 시 닫기
// ══════════════════════════════════════════════════════
(function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sbBackdrop = document.getElementById('sb-backdrop');
  const sbToggle = document.getElementById('sidebar-toggle');
  if (!sidebar || !sbToggle) return;

  const mq = window.matchMedia('(max-width: 1024px)');

  function isMobile() { return mq.matches; }

  function openDrawer() {
    sidebar.classList.add('sb-drawer-open');
    if (sbBackdrop) sbBackdrop.classList.add('sb-bd-visible');
  }
  function closeDrawer() {
    sidebar.classList.remove('sb-drawer-open');
    if (sbBackdrop) sbBackdrop.classList.remove('sb-bd-visible');
  }

  // 모바일에서 햄버거 버튼 동작 오버라이드
  sbToggle.addEventListener('click', (e) => {
    if (!isMobile()) return; // 1024px 초과: 기존 sidebarManager.toggle()이 처리
    e.stopImmediatePropagation(); // sidebarManager의 리스너보다 먼저 잡기
    if (sidebar.classList.contains('sb-drawer-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }, true); // capture: true로 sidebarManager보다 먼저 실행

  // 백드롭 클릭 시 닫기
  if (sbBackdrop) {
    sbBackdrop.addEventListener('click', closeDrawer);
  }

  // 사이드바 내 종목 클릭 시 자동 닫기
  sidebar.addEventListener('click', (e) => {
    if (!isMobile()) return;
    if (e.target.closest('.sb-item')) {
      setTimeout(closeDrawer, 150);
    }
  });

  // 뷰포트가 넓어지면 드로어 상태 초기화
  mq.addEventListener('change', (e) => {
    if (!e.matches) closeDrawer();
  });
})();

// ══════════════════════════════════════════════════════
//  모바일 재무지표 바텀시트 (768px 이하)
//  - #fin-toggle FAB 버튼으로 열기/닫기
//  - #rp-backdrop 클릭 시 닫기
// ══════════════════════════════════════════════════════
(function initMobileFinSheet() {
  const rpanel = document.getElementById('right-panel');
  const finToggle = document.getElementById('fin-toggle');
  const rpBackdrop = document.getElementById('rp-backdrop');
  if (!rpanel || !finToggle) return;

  function openSheet() {
    rpanel.classList.add('rp-sheet-open');
    finToggle.classList.add('rp-open');
    finToggle.innerHTML = '&#10005;';   // X 아이콘
    if (rpBackdrop) rpBackdrop.classList.add('rp-bd-visible');
  }
  function closeSheet() {
    rpanel.classList.remove('rp-sheet-open');
    finToggle.classList.remove('rp-open');
    finToggle.innerHTML = '&#8942;';    // 세로 점 3개 아이콘
    if (rpBackdrop) rpBackdrop.classList.remove('rp-bd-visible');
  }

  finToggle.addEventListener('click', () => {
    if (rpanel.classList.contains('rp-sheet-open')) {
      closeSheet();
    } else {
      openSheet();
    }
  });

  if (rpBackdrop) {
    rpBackdrop.addEventListener('click', closeSheet);
  }

  // 뷰포트가 넓어지면 바텀시트 상태 초기화
  const mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', (e) => {
    if (!e.matches) closeSheet();
  });
})();

// ══════════════════════════════════════════════════════
//  드로잉 도구 초기화
//
//  좌측 수직 툴바 버튼 이벤트 + 차트 클릭 핸들러 연결
//  drawingTools.js에 정의된 드로잉 엔진과 app.js를 연결하는 글루 코드
// ══════════════════════════════════════════════════════

// [OPT] 드로잉 버튼 이벤트 리스너는 한 번만 등록 (중복 방지 플래그)
var _drawBtnsInitialized = false;
// [OPT] mouseup 이벤트 리스너도 한 번만 등록
var _drawMouseUpInitialized = false;

function _initDrawingTools() {
  if (typeof drawingTools === 'undefined') return;

  // 드로잉 도구 연결: primitive를 차트에 부착
  drawingTools.attach(chartManager);
  drawingTools.setStockCode(currentStock ? currentStock.code : null);

  // [OPT] 툴바 버튼 클릭 이벤트 — 한 번만 등록 (매 TF 전환마다 누적 방지)
  if (!_drawBtnsInitialized) {
    _drawBtnsInitialized = true;
    document.querySelectorAll('.draw-btn').forEach(function(btn) {
      var tool = btn.dataset.tool;
      // 색상 버튼은 도구 전환 대신 색상 선택기를 토글
      if (tool === 'color') {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          drawingTools.toggleColorPicker();
        });
        return;
      }
      btn.addEventListener('click', function() {
        drawingTools.setTool(tool);
      });
    });
  }

  // 메인 차트 클릭/크로스헤어 이벤트 — 차트 재생성마다 재등록 필요
  // (destroyAll()로 차트 객체가 교체되므로 subscribeClick/subscribeCrosshairMove 재등록)
  if (chartManager.mainChart) {
    chartManager.mainChart.subscribeClick(function(param) {
      console.log('[Draw] click event', { tool: drawingTools.getActiveTool(), time: param.time, point: param.point });
      if (!drawingTools.getActiveTool()) return;
      if (!param.time) return;

      var price = null;
      var targetSeries = chartManager.candleSeries;
      if (!targetSeries || (chartType === 'line' && chartManager.indicatorSeries._priceLine)) {
        targetSeries = chartManager.indicatorSeries._priceLine || chartManager.candleSeries;
      }
      if (param.point && targetSeries) {
        price = targetSeries.coordinateToPrice(param.point.y);
      }
      if (price == null) {
        var sd = param.seriesData && param.seriesData.get(targetSeries);
        if (sd) price = sd.close;
      }
      if (price == null) return;

      console.log('[Draw] click resolved', { price, time: param.time });
      drawingTools.handleChartClick(price, param.time);
    });

    chartManager.mainChart.subscribeCrosshairMove(function(param) {
      if (!drawingTools.getActiveTool()) return;
      if (!param.time) return;

      var price = null;
      var moveSeries = chartManager.candleSeries;
      if (!moveSeries || (chartType === 'line' && chartManager.indicatorSeries._priceLine)) {
        moveSeries = chartManager.indicatorSeries._priceLine || chartManager.candleSeries;
      }
      if (param.point && moveSeries) {
        price = moveSeries.coordinateToPrice(param.point.y);
      }
      if (price == null) return;

      drawingTools.handleChartMouseMove(price, param.time);
    });
  }

  // [OPT] mouseup 이벤트 — 한 번만 등록 (DOM 요소는 변경되지 않음)
  if (!_drawMouseUpInitialized) {
    _drawMouseUpInitialized = true;
    var chartWrapEl = document.getElementById('chart-wrap');
    if (chartWrapEl) {
      chartWrapEl.addEventListener('mouseup', function() {
        if (typeof drawingTools !== 'undefined') {
          drawingTools.handleChartMouseUp();
        }
      });
    }
  }
}


// ══════════════════════════════════════════════════════
//  키보드 단축키
//
//  1-6: 타임프레임 전환, C: 차트타입 순환, P: 패턴 토글
//  T/H/V/R/G: 드로잉 도구, Del: 삭제 도구
//  / 또는 F: 검색 포커스, Escape: 검색 블러 + 팝업 닫기
//  입력 필드 포커스 중에는 무시 (Escape 제외)
// ══════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable);

  // Escape: 항상 동작 — 검색 블러, 모든 팝업/드롭다운 닫기
  if (e.key === 'Escape') {
    // 검색 입력 블러
    if (searchInput && document.activeElement === searchInput) {
      searchInput.blur();
      searchInput.value = '';
    }
    // 사이드바 검색 블러
    const sbInput = document.getElementById('sb-search-input');
    if (sbInput && document.activeElement === sbInput) {
      sbInput.blur();
      sbInput.value = '';
    }
    // 검색 드롭다운 닫기
    if (dropdown) dropdown.classList.remove('show');
    // 패턴 상세 팝업 닫기
    const popup = document.getElementById('pattern-detail-popup');
    if (popup) popup.classList.remove('show');
    // 지표 드롭다운 닫기
    if (indDropdownMenu) indDropdownMenu.classList.remove('show');
    // 시그널 필터 드롭다운 닫기
    const sfMenu = document.getElementById('viz-toggle-menu');
    if (sfMenu) sfMenu.classList.remove('show');
    // 모바일 사이드바 드로어 닫기
    const sidebarEl = document.getElementById('sidebar');
    const sbBd = document.getElementById('sb-backdrop');
    if (sidebarEl && sidebarEl.classList.contains('sb-drawer-open')) {
      sidebarEl.classList.remove('sb-drawer-open');
      if (sbBd) sbBd.classList.remove('sb-bd-visible');
    }
    // 모바일 재무지표 바텀시트 닫기
    const rpEl = document.getElementById('right-panel');
    const rpBd = document.getElementById('rp-backdrop');
    const finBtn = document.getElementById('fin-toggle');
    if (rpEl && rpEl.classList.contains('rp-sheet-open')) {
      rpEl.classList.remove('rp-sheet-open');
      if (finBtn) { finBtn.classList.remove('rp-open'); finBtn.innerHTML = '\u22EE'; }
      if (rpBd) rpBd.classList.remove('rp-bd-visible');
    }
    // 드로잉 도구 해제
    if (typeof drawingTools !== 'undefined' && drawingTools.getActiveTool()) {
      drawingTools.setTool(drawingTools.getActiveTool()); // 토글 해제
    }
    return;
  }

  // 입력 필드에서는 나머지 단축키 무시
  if (isInput) return;

  // Ctrl/Alt/Meta 조합은 무시 (브라우저 기본 단축키 보존)
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const key = e.key;

  // Arrow Up/Down: 사이드바 종목 키보드 네비게이션
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    e.preventDefault();
    const items = [...document.querySelectorAll('.sb-item:not([style*="display: none"])')];
    if (!items.length) return;

    const current = document.querySelector('.sb-item.kb-focus') || document.querySelector('.sb-item.active');
    let idx = items.indexOf(current);

    // 기존 포커스 제거
    items.forEach(i => i.classList.remove('kb-focus'));

    if (key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
    else idx = Math.max(idx - 1, 0);

    items[idx].classList.add('kb-focus');
    items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 디바운스된 종목 선택 (200ms) — 빠른 화살표 연타 시 마지막 위치만 로드
    clearTimeout(_kbNavTimer);
    _kbNavTimer = setTimeout(() => {
      const code = items[idx].dataset.code;
      if (code) selectStock(code);
    }, 200);
    return;
  }

  // 1-6: 타임프레임 전환 (기존 .tf-btn 클릭을 프로그래밍 방식으로 트리거)
  const tfMap = { '1': '1m', '2': '5m', '3': '15m', '4': '30m', '5': '1h', '6': '1d', '7': '1w', '8': '1M' };
  if (tfMap[key]) {
    const tfBtn = document.querySelector(`.tf-btn[data-tf="${tfMap[key]}"]`);
    if (tfBtn && !tfBtn.classList.contains('active')) {
      tfBtn.click();
    }
    e.preventDefault();
    return;
  }

  // C: 차트 타입 순환 (candle → line → bar → candle)
  if (key === 'c' || key === 'C') {
    const types = ['candle', 'line', 'bar', 'heikin'];
    const curIdx = types.indexOf(chartType);
    const nextType = types[(curIdx + 1) % types.length];
    const ctBtn = document.querySelector(`.ct-btn[data-ct="${nextType}"]`);
    if (ctBtn) ctBtn.click();
    e.preventDefault();
    return;
  }

  // P: 패턴 토글
  if (key === 'p' || key === 'P') {
    const pBtn = document.getElementById('pattern-toggle');
    if (pBtn) pBtn.click();
    e.preventDefault();
    return;
  }

  // 드로잉 도구 단축키: S=선택, T=추세선, H=수평선, V=수직선, R=사각형, G=피보나치, Delete=삭제
  if (typeof drawingTools !== 'undefined') {
    const drawKeyMap = {
      s: 'select', S: 'select',
      t: 'trendline', T: 'trendline',
      h: 'hline', H: 'hline',
      v: 'vline', V: 'vline',
      r: 'rect', R: 'rect',
      g: 'fib', G: 'fib',
    };
    if (drawKeyMap[key]) {
      drawingTools.setTool(drawKeyMap[key]);
      e.preventDefault();
      return;
    }
    if (key === 'Delete') {
      drawingTools.setTool('eraser');
      e.preventDefault();
      return;
    }
  }

  // / 또는 F: 검색 포커스
  if (key === '/' || key === 'f' || key === 'F') {
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    e.preventDefault();
    return;
  }
});


// [REMOVED] 스크린샷 내보내기 — screenshot-btn 미구현으로 dead code 제거 (2026-04-06 audit)


// ══════════════════════════════════════════════════════
//  즐겨찾기 토글 버튼
// ══════════════════════════════════════════════════════
document.getElementById('watchlist-toggle-btn')?.addEventListener('click', function () {
  if (!currentStock) return;
  var added = _toggleWatchlist(currentStock.code);
  _updateStarBtn();
  showToast(currentStock.name + (added ? ' 즐겨찾기 추가' : ' 즐겨찾기 제거'), 'info');
  // 사이드바 즐겨찾기 섹션 갱신
  if (typeof sidebarManager !== 'undefined' && sidebarManager.renderWatchlist) {
    sidebarManager.renderWatchlist();
  }
});


// ══════════════════════════════════════════════════════
//  지표 파라미터 우클릭 팝업
// ══════════════════════════════════════════════════════

/** 지표 체크박스에 커스텀 표시 업데이트 */
function _markCustomParams() {
  document.querySelectorAll('#ind-dropdown-menu .ind-check').forEach(function (label) {
    var cb = label.querySelector('input[data-ind]');
    if (!cb) return;
    var ind = cb.dataset.ind;
    var defaults = DEFAULT_IND_PARAMS[ind];
    var current = indParams[ind];
    if (!defaults || !current) { label.classList.remove('param-custom'); return; }
    var isCustom = false;
    for (var k in defaults) {
      if (current[k] !== defaults[k]) { isCustom = true; break; }
    }
    label.classList.toggle('param-custom', isCustom);
  });
}

/** 팝업 열기 */
function _openParamPopup(ind, anchorEl) {
  var popup = document.getElementById('ind-param-popup');
  var fields = document.getElementById('ind-param-fields');
  if (!popup || !fields) return;

  var params = indParams[ind];
  if (!params) return;

  _activeParamInd = ind;

  // 필드 생성
  var html = '';
  for (var key in params) {
    var label = _PARAM_LABELS[key] || key;
    html += '<div class="ind-param-row">' +
      '<label>' + label + '</label>' +
      '<input type="number" data-key="' + key + '" value="' + params[key] + '" min="1" max="999" step="' + (key === 'stdDev' ? '0.1' : '1') + '">' +
      '</div>';
  }
  fields.innerHTML = html;

  // 타이틀 업데이트
  var nameMap = { ma: 'MA', ema: 'EMA', bb: '볼린저', rsi: 'RSI', macd: 'MACD', ich: '일목균형표' };
  popup.querySelector('.ind-param-title').textContent = (nameMap[ind] || ind) + ' 설정';

  // 위치 계산
  var rect = anchorEl.getBoundingClientRect();
  popup.style.display = '';
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';
}

/** 팝업 닫기 */
function _closeParamPopup() {
  var popup = document.getElementById('ind-param-popup');
  if (popup) popup.style.display = 'none';
  _activeParamInd = null;
}

// 적용 버튼
document.getElementById('ind-param-apply')?.addEventListener('click', function () {
  if (!_activeParamInd) return;
  var fields = document.getElementById('ind-param-fields');
  if (!fields) return;

  var ind = _activeParamInd;
  var params = indParams[ind] || {};
  fields.querySelectorAll('input[data-key]').forEach(function (input) {
    var val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) {
      params[input.dataset.key] = val;
    }
  });
  indParams[ind] = params;
  _saveIndParams(indParams);
  _markCustomParams();
  _closeParamPopup();
  updateChartFull();
  showToast(ind.toUpperCase() + ' 파라미터 적용 완료', 'success');
});

// 초기화 버튼
document.getElementById('ind-param-reset')?.addEventListener('click', function () {
  if (!_activeParamInd || !DEFAULT_IND_PARAMS[_activeParamInd]) return;
  var ind = _activeParamInd;
  indParams[ind] = JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS[ind]));
  _saveIndParams(indParams);
  _markCustomParams();
  _closeParamPopup();
  updateChartFull();
  showToast(ind.toUpperCase() + ' 파라미터 초기화', 'info');
});

// 팝업 외부 클릭 시 닫기
document.addEventListener('click', function (e) {
  var popup = document.getElementById('ind-param-popup');
  if (!popup || popup.style.display === 'none') return;
  if (!popup.contains(e.target)) {
    _closeParamPopup();
  }
});

// 지표 체크박스에 우클릭 이벤트 바인딩
document.querySelectorAll('#ind-dropdown-menu .ind-check').forEach(function (label) {
  label.addEventListener('contextmenu', function (e) {
    var cb = label.querySelector('input[data-ind]');
    if (!cb) return;
    var ind = cb.dataset.ind;
    // 파라미터가 정의된 지표만 팝업 열기
    if (!DEFAULT_IND_PARAMS[ind]) return;
    e.preventDefault();
    e.stopPropagation();
    _openParamPopup(ind, label);
  });
});

// 초기 커스텀 표시
_markCustomParams();


// ══════════════════════════════════════════════════════
//  Local Notification API (P3c — 웹 Push 알림)
//  서버 불필요: 브라우저 Notification API + SW showNotification
//  탭 백그라운드 시 패턴 감지를 브라우저 알림으로 전달
// ══════════════════════════════════════════════════════

var _notifEnabled = false;
var _notifLastTag = '';  // 중복 방지

/** 알림 권한 요청 */
function _requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    _notifEnabled = true;
    _updateNotifBtn();
    return;
  }
  if (Notification.permission === 'denied') {
    showToast('브라우저 설정에서 알림을 허용해주세요', 'warning');
    return;
  }
  Notification.requestPermission().then(function(perm) {
    _notifEnabled = (perm === 'granted');
    _updateNotifBtn();
    if (_notifEnabled) {
      showToast('패턴 알림이 활성화되었습니다', 'success');
    }
  });
}

/** 벨 버튼 상태 업데이트 */
function _updateNotifBtn() {
  var btn = document.getElementById('notif-btn');
  if (!btn) return;
  btn.classList.toggle('notif-active', _notifEnabled);
}

/** 패턴 감지 시 로컬 알림 전송 (백그라운드 탭용) */
function _notifyPatterns(patterns) {
  if (!_notifEnabled || !patterns || patterns.length === 0) return;
  if (document.visibilityState === 'visible') return;  // 포그라운드면 toast로 충분

  var stockName = currentStock ? currentStock.name : '';
  var body = patterns.slice(0, 3).map(function(p) {
    return _getPatternKo(p.type);
  }).join(', ');
  var tag = 'ptn-' + (currentStock ? currentStock.code : '') + '-' + patterns.length;
  if (tag === _notifLastTag) return;  // 중복 방지
  _notifLastTag = tag;

  // SW showNotification 우선 (백그라운드 탭에서도 안정적)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(function(reg) {
      reg.showNotification(stockName + ' — ' + patterns.length + '개 패턴', {
        body: body,
        icon: 'img/favicon.svg',
        tag: tag,
        renotify: false,
        silent: true,
      });
    });
  } else {
    // 폴백: 직접 Notification
    new Notification(stockName + ' — ' + patterns.length + '개 패턴', { body: body, tag: tag });
  }
}

// 벨 버튼 이벤트
(function() {
  var btn = document.getElementById('notif-btn');
  if (!btn) return;
  // SW 등록 완료 후 버튼 표시
  if ('Notification' in window) {
    btn.style.display = 'flex';
    if (Notification.permission === 'granted') {
      _notifEnabled = true;
      _updateNotifBtn();
    }
  }
  btn.addEventListener('click', function() {
    if (_notifEnabled) {
      _notifEnabled = false;
      _updateNotifBtn();
      showToast('패턴 알림이 비활성화되었습니다', 'info');
    } else {
      _requestNotifPermission();
    }
  });
})();


// ══════════════════════════════════════════════════════
//  전종목 패턴 스크리너 (P3 — Benchmark P1 최고 ROI)
//  Worker batch scan: ALL_STOCKS 순회, 종목별 패턴 분석
// ══════════════════════════════════════════════════════

var _screenerRunning = false;
var _screenerResults = [];
var _screenerAbort = false;

/** 패턴 한글명 매핑 (patternRenderer PATTERN_NAMES_KO 재사용) */
function _getPatternKo(type) {
  if (typeof patternRenderer !== 'undefined' && patternRenderer.PATTERN_NAMES_KO) {
    return patternRenderer.PATTERN_NAMES_KO[type] || type;
  }
  return type;
}

/** 패턴 방향 판별 */
function _getPatternDirection(p) {
  var bull = ['hammer','invertedHammer','bullishEngulfing','bullishHarami','piercingLine','morningStar',
    'threeWhiteSoldiers','threeInsideUp','tweezerBottom','bullishMarubozu',
    'bullishBeltHold','bullishHaramiCross','stickSandwich',
    'abandonedBabyBullish','dragonflyDoji',
    'risingThreeMethods','cupAndHandle',
    'doubleBottom','inverseHeadAndShoulders','ascendingTriangle','fallingWedge'];
  var bear = ['shootingStar','hangingMan','bearishEngulfing','bearishHarami','darkCloud','eveningStar',
    'threeBlackCrows','threeInsideDown','tweezerTop','bearishMarubozu',
    'bearishBeltHold','bearishHaramiCross',
    'abandonedBabyBearish','gravestoneDoji',
    'fallingThreeMethods',
    'doubleTop','headAndShoulders','descendingTriangle','risingWedge'];
  if (bull.indexOf(p.type) !== -1) return 'bullish';
  if (bear.indexOf(p.type) !== -1) return 'bearish';
  return 'neutral';
}

/** 스크리너 결과 렌더 */
function _renderScreenerResults(results, ptnFilter, dirFilter) {
  var container = document.getElementById('sb-screener-results');
  if (!container) return;
  var filtered = results;
  if (ptnFilter) filtered = filtered.filter(function(r) { return r.type === ptnFilter; });
  if (dirFilter) filtered = filtered.filter(function(r) { return r.dir === dirFilter; });
  // 신뢰도 내림차순
  filtered.sort(function(a, b) { return b.confidence - a.confidence; });
  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px">결과 없음</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < Math.min(filtered.length, 200); i++) {
    var r = filtered[i];
    var dirCls = r.dir === 'bullish' ? 'bullish' : r.dir === 'bearish' ? 'bearish' : 'neutral';
    var chgCls = r.change >= 0 ? 'up' : 'down';
    var chgSign = r.change >= 0 ? '+' : '';
    html += '<div class="sb-item" data-code="' + r.code + '" style="cursor:pointer">'
      + '<div class="sb-row1">'
      + '<span class="sb-name">' + r.name + '</span>'
      + '<span class="sb-screener-ptn-badge ' + dirCls + '">' + _getPatternKo(r.type) + '</span>'
      + '</div>'
      + '<div class="sb-row2">'
      + '<span class="sb-code">' + r.code + '</span>'
      + '<span style="flex:1"></span>'
      + '<span class="sb-change ' + chgCls + '">' + chgSign + r.change.toFixed(1) + '%</span>'
      + '</div></div>';
  }
  container.innerHTML = html;

  // 클릭 이벤트: 종목 선택
  container.querySelectorAll('.sb-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var code = el.dataset.code;
      if (code && typeof selectStock === 'function') selectStock(code);
    });
  });
}

/** 스크리너 패턴 select 옵션 동적 생성 */
function _populateScreenerPatternSelect() {
  var sel = document.getElementById('sb-screener-ptn');
  if (!sel || sel.children.length > 1) return;
  var types = [
    'hammer','shootingStar','bullishEngulfing','bearishEngulfing',
    'morningStar','eveningStar','threeWhiteSoldiers','threeBlackCrows',
    'doubleBottom','doubleTop','headAndShoulders','inverseHeadAndShoulders',
    'ascendingTriangle','descendingTriangle','fallingWedge','risingWedge'
  ];
  types.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t;
    opt.textContent = _getPatternKo(t);
    sel.appendChild(opt);
  });
}

/** 전종목 배치 스캔 실행 (Worker 병렬화) */
async function _startScreenerScan() {
  if (_screenerRunning) {
    _screenerAbort = true;
    return;
  }
  _screenerRunning = true;
  _screenerAbort = false;
  _screenerResults = [];

  var runBtn = document.getElementById('sb-screener-run');
  var statusEl = document.getElementById('sb-screener-status');
  var progressEl = document.getElementById('sb-screener-progress');
  var progressBar = document.getElementById('sb-screener-progress-bar');

  if (runBtn) { runBtn.textContent = '중지'; }
  if (progressEl) progressEl.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';

  var stocks = typeof dataService !== 'undefined' ? dataService.getStocks() : [];
  var total = stocks.length;
  var scanned = 0;

  // ── Worker 생성 ────────────────────────────────────
  var screenerWorker = null;
  var workerReady = false;
  try {
    screenerWorker = new Worker('js/screenerWorker.js?v=11');
  } catch (workerErr) {
    console.warn('[Screener] Worker 생성 실패, 메인 스레드 폴백:', workerErr.message);
  }

  // Worker 결과 수신 대기용 resolve 함수 (한 번에 1종목씩 직렬 처리)
  var _pendingResolve = null;

  if (screenerWorker) {
    screenerWorker.onmessage = function(e) {
      var msg = e.data;
      if (msg.type === 'ready') {
        workerReady = true;
        return;
      }
      if (msg.type === 'scan-result') {
        // Worker 분석 결과를 메인 스레드에서 수집
        var patterns = msg.patterns || [];
        for (var j = 0; j < patterns.length; j++) {
          var p = patterns[j];
          _screenerResults.push({
            code: msg.code,
            name: msg.name,
            type: p.type,
            dir: _getPatternDirection(p),
            confidence: p.confidence || 50,
            change: 0,  // Worker에서는 stock 객체 미전송; 아래에서 보정
          });
        }
        if (_pendingResolve) { _pendingResolve(); _pendingResolve = null; }
        return;
      }
      if (msg.type === 'error') {
        // Worker 내 에러 — 해당 종목 건너뛰기
        if (_pendingResolve) { _pendingResolve(); _pendingResolve = null; }
      }
    };
    screenerWorker.onerror = function() {
      // Worker 전체 에러 — 대기 중인 Promise 해제
      if (_pendingResolve) { _pendingResolve(); _pendingResolve = null; }
    };

    // Worker ready 대기 (최대 3초)
    var readyStart = Date.now();
    while (!workerReady && Date.now() - readyStart < 3000) {
      await new Promise(function(r) { setTimeout(r, 50); });
    }
    if (!workerReady) {
      console.warn('[Screener] Worker ready 타임아웃, 메인 스레드 폴백');
      screenerWorker.terminate();
      screenerWorker = null;
    }
  }

  // ── 스캔 루프 ──────────────────────────────────────
  for (var i = 0; i < total; i++) {
    if (_screenerAbort) break;
    var stock = stocks[i];

    try {
      // I/O는 메인 스레드 (IndexedDB/fetch)
      var candles = await dataService.getCandles(stock, '1d');

      if (candles && candles.length >= 30) {
        if (screenerWorker) {
          // ── Worker 경로: CPU 분석을 Worker에 위임 ──
          var scanDone = new Promise(function(resolve) {
            _pendingResolve = resolve;
            screenerWorker.postMessage({
              type: 'scan',
              code: stock.code,
              name: stock.name,
              candles: candles,
              market: stock.market,
            });
          });
          // 타임아웃 5초 — 단일 종목이 Worker를 차단하지 않도록
          var timeout = new Promise(function(resolve) { setTimeout(resolve, 5000); });
          await Promise.race([scanDone, timeout]);

          // change 보정 (Worker에서 stock 객체를 보내지 않으므로)
          for (var k = _screenerResults.length - 1; k >= 0; k--) {
            if (_screenerResults[k].code === stock.code && _screenerResults[k].change === 0) {
              _screenerResults[k].change = stock.changePercent || 0;
            } else {
              break;  // 역순 탐색, 다른 종목 도달 시 중단
            }
          }
        } else {
          // ── 폴백: 메인 스레드 분석 (Worker 생성 실패 시) ──
          var patterns = patternEngine.analyze(candles, { market: stock.market });
          var recent = patterns.filter(function(p) {
            var idx = p.endIndex != null ? p.endIndex : p.startIndex;
            return idx != null && idx >= candles.length - 5;
          });
          for (var j = 0; j < recent.length; j++) {
            var p = recent[j];
            _screenerResults.push({
              code: stock.code,
              name: stock.name,
              type: p.type,
              dir: _getPatternDirection(p),
              confidence: p.confidence || 50,
              change: stock.changePercent || 0,
            });
          }
        }
      }
    } catch (ex) { /* skip failed stock */ }

    scanned++;
    if (statusEl) statusEl.textContent = scanned + ' / ' + total;
    if (progressBar) progressBar.style.width = (scanned / total * 100).toFixed(1) + '%';
    // UI 응답성 유지 — 10종목마다 yield
    if (scanned % 10 === 0) await new Promise(function(r) { setTimeout(r, 0); });
  }

  // ── 정리 ───────────────────────────────────────────
  if (screenerWorker) {
    screenerWorker.terminate();
    screenerWorker = null;
  }

  _screenerRunning = false;
  if (runBtn) { runBtn.textContent = '전종목 스캔'; }
  if (statusEl) {
    statusEl.textContent = _screenerResults.length + '개 패턴 (' + scanned + '종목 스캔)';
  }
  if (progressBar) progressBar.style.width = '100%';

  // 결과 렌더
  var ptnSel = document.getElementById('sb-screener-ptn');
  var dirSel = document.getElementById('sb-screener-dir');
  _renderScreenerResults(_screenerResults, ptnSel ? ptnSel.value : '', dirSel ? dirSel.value : '');
}

// 스크리너 이벤트 바인딩
(function() {
  var runBtn = document.getElementById('sb-screener-run');
  if (runBtn) {
    runBtn.addEventListener('click', _startScreenerScan);
  }
  var ptnSel = document.getElementById('sb-screener-ptn');
  var dirSel = document.getElementById('sb-screener-dir');
  if (ptnSel) {
    ptnSel.addEventListener('change', function() {
      _renderScreenerResults(_screenerResults, ptnSel.value, dirSel ? dirSel.value : '');
    });
  }
  if (dirSel) {
    dirSel.addEventListener('change', function() {
      _renderScreenerResults(_screenerResults, ptnSel ? ptnSel.value : '', dirSel.value);
    });
  }
  // 패턴 옵션 동적 생성 (DOM 로드 후)
  setTimeout(_populateScreenerPatternSelect, 500);
})();
