// ══════════════════════════════════════════════════════════════════════════
//  tracePanel.js  —  Side-panel controller for Pattern Trace debug viewer
//
//  DOM owner: #trace-panel (aside in pattern-trace.html)
//
//  Exported API on window.tracePanel:
//    .load(trace)            — build full panel DOM from trace JSON v1
//    .onFilterChange(cb)     — register callback(checkedFamilies: Set<string>)
//    .showError(msg)         — display error state in panel
//
//  Sections rendered:
//    1. Header  (stock meta + engine versions + event count)
//    2. Regime card (6 weight bars from preAnalyze.regime)
//    3. EB Shrinkage N0 slider  (live Wilson CI recompute)
//    4. Family filter (45 checkboxes in 5 collapsible groups)
//       - BH-FDR badge, Wilson CI, sample power per row
//    5. Pattern detection cards (sorted by confidence, clickable to scrubber)
//    6. Near-miss summary
//    7. S/R levels
//    8. Aggregate stats + unexplained rejection counter + anti-predictor alerts
//
//  Statistical formulas:
//    Wilson 95% CI: (p + z²/2n ± z√(p(1-p)/n + z²/4n²)) / (1 + z²/n), z=1.96
//    EB shrinkage:  shrunk_wr = (N·raw + N0·grand_mean) / (N + N0)
//    BH-FDR:        cross-asset threshold q/√2631 ≈ 9.62e-4  (q=0.05)
//    Power rule:    n_min = 10/p  (Cohen)
//
//  Dependencies: js/colors.js → KRX_COLORS  (loaded before this file)
//  Zero production-file touch.  No eval on user input.
// ══════════════════════════════════════════════════════════════════════════

window.tracePanel = (function () {
  'use strict';

  // ── Statistical constants ─────────────────────────────────────────────
  var Z_96         = 1.96;
  var BH_FDR_CROSS = 9.62e-4;   // q/sqrt(2631), q=0.05
  var DEFAULT_N0   = 35;
  var DEFAULT_GRAND = 45.0;     // grand-mean win-rate % fallback

  // ── 45-pattern taxonomy ───────────────────────────────────────────────
  var TAXONOMY = [
    // candle.single (13)
    { key: 'doji',                family: 'candle.single', nameKo: '도지' },
    { key: 'hammer',              family: 'candle.single', nameKo: '해머' },
    { key: 'invertedHammer',      family: 'candle.single', nameKo: '역해머' },
    { key: 'hangingMan',          family: 'candle.single', nameKo: '교수형' },
    { key: 'shootingStar',        family: 'candle.single', nameKo: '유성형' },
    { key: 'dragonflyDoji',       family: 'candle.single', nameKo: '잠자리도지' },
    { key: 'gravestoneDoji',      family: 'candle.single', nameKo: '비석도지' },
    { key: 'longLeggedDoji',      family: 'candle.single', nameKo: '긴다리도지' },
    { key: 'spinningTop',         family: 'candle.single', nameKo: '팽이형' },
    { key: 'bullishMarubozu',     family: 'candle.single', nameKo: '양봉마루보주' },
    { key: 'bearishMarubozu',     family: 'candle.single', nameKo: '음봉마루보주' },
    { key: 'bullishBeltHold',     family: 'candle.single', nameKo: '강세띠두름' },
    { key: 'bearishBeltHold',     family: 'candle.single', nameKo: '약세띠두름' },
    // candle.double (10)
    { key: 'bullishEngulfing',    family: 'candle.double', nameKo: '상승장악형' },
    { key: 'bearishEngulfing',    family: 'candle.double', nameKo: '하락장악형' },
    { key: 'bullishHarami',       family: 'candle.double', nameKo: '상승잉태형' },
    { key: 'bearishHarami',       family: 'candle.double', nameKo: '하락잉태형' },
    { key: 'bullishHaramiCross',  family: 'candle.double', nameKo: '상승잉태십자' },
    { key: 'bearishHaramiCross',  family: 'candle.double', nameKo: '하락잉태십자' },
    { key: 'piercingLine',        family: 'candle.double', nameKo: '관통형' },
    { key: 'darkCloud',           family: 'candle.double', nameKo: '먹구름형' },
    { key: 'tweezerBottom',       family: 'candle.double', nameKo: '족집게바닥' },
    { key: 'tweezerTop',          family: 'candle.double', nameKo: '족집게천장' },
    // candle.triple (9)
    { key: 'threeWhiteSoldiers',  family: 'candle.triple', nameKo: '적삼병' },
    { key: 'threeBlackCrows',     family: 'candle.triple', nameKo: '흑삼병' },
    { key: 'morningStar',         family: 'candle.triple', nameKo: '샛별형' },
    { key: 'eveningStar',         family: 'candle.triple', nameKo: '석별형' },
    { key: 'threeInsideUp',       family: 'candle.triple', nameKo: '상승삼내형' },
    { key: 'threeInsideDown',     family: 'candle.triple', nameKo: '하락삼내형' },
    { key: 'abandonedBabyBullish',family: 'candle.triple', nameKo: '상승버려진아기' },
    { key: 'abandonedBabyBearish',family: 'candle.triple', nameKo: '하락버려진아기' },
    { key: 'stickSandwich',       family: 'candle.triple', nameKo: '막대샌드위치' },
    // candle.multi (2)
    { key: 'risingThreeMethods',  family: 'candle.multi',  nameKo: '상승삼법형' },
    { key: 'fallingThreeMethods', family: 'candle.multi',  nameKo: '하락삼법형' },
    // chart (11)
    { key: 'doubleBottom',            family: 'chart', nameKo: '이중바닥' },
    { key: 'doubleTop',               family: 'chart', nameKo: '이중천장' },
    { key: 'headAndShoulders',        family: 'chart', nameKo: '헤드앤숄더' },
    { key: 'inverseHeadAndShoulders', family: 'chart', nameKo: '역헤드앤숄더' },
    { key: 'ascendingTriangle',       family: 'chart', nameKo: '상승삼각형' },
    { key: 'descendingTriangle',      family: 'chart', nameKo: '하락삼각형' },
    { key: 'symmetricTriangle',       family: 'chart', nameKo: '대칭삼각형' },
    { key: 'risingWedge',             family: 'chart', nameKo: '상승쐐기형' },
    { key: 'fallingWedge',            family: 'chart', nameKo: '하락쐐기형' },
    { key: 'channel',                 family: 'chart', nameKo: '채널' },
    { key: 'cupAndHandle',            family: 'chart', nameKo: '컵앤핸들' },
  ];

  // Korean name lookup (flat map for rendering cards)
  var PATTERN_NAMES_KO = {};
  TAXONOMY.forEach(function (t) { PATTERN_NAMES_KO[t.key] = t.nameKo; });

  // ── Group definitions ─────────────────────────────────────────────────
  var GROUPS = [
    { id: 'candle.single', label: 'CANDLE · SINGLE',  count: 13 },
    { id: 'candle.double', label: 'CANDLE · DOUBLE',  count: 10 },
    { id: 'candle.triple', label: 'CANDLE · TRIPLE',  count: 9  },
    { id: 'candle.multi',  label: 'CANDLE · MULTI',   count: 2  },
    { id: 'chart',         label: 'CHART PATTERNS',   count: 11 },
  ];

  // ── Module state ──────────────────────────────────────────────────────
  var _filterCallbacks = [];
  var _checkedKeys     = new Set(TAXONOMY.map(function (t) { return t.key; }));
  var _n0              = DEFAULT_N0;

  // ── Utilities ─────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _fmt(n, dp) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(dp != null ? dp : 1);
  }

  function _familyToKey(family) {
    if (!family) return '';
    var parts = family.split('.');
    return parts[parts.length - 1];
  }

  function _panelEl() {
    return document.getElementById('trace-panel');
  }

  // ── Statistical formulas ──────────────────────────────────────────────
  function _wilsonCI(p, n) {
    // Wilson 95% CI; p in [0,1]; returns {lo, hi} or null if n < 1
    if (!n || n < 1) return null;
    var z2     = Z_96 * Z_96;
    var center = (p + z2 / (2 * n)) / (1 + z2 / n);
    var margin = (Z_96 / (1 + z2 / n)) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) };
  }

  function _shrink(rawPct, n, n0, grandMean) {
    var gm = (grandMean != null && !isNaN(grandMean)) ? grandMean : DEFAULT_GRAND;
    return (n * rawPct + n0 * gm) / (n + n0);
  }

  function _wilsonStr(rawPct, n, n0, grandMean) {
    if (rawPct == null || n == null) return '—';
    var shrunk = _shrink(rawPct, n, n0, grandMean);
    var p01    = shrunk / 100;
    var ci     = _wilsonCI(p01, n);
    if (!ci) return _fmt(shrunk, 1) + '%';
    return _fmt(shrunk, 1) + '% [' + _fmt(ci.lo * 100, 1) + ',' + _fmt(ci.hi * 100, 1) + ']';
  }

  // ── Build perPattern index ────────────────────────────────────────────
  function _buildPpIndex(trace) {
    var idx = {};
    if (!trace || !Array.isArray(trace.perPattern)) return idx;
    trace.perPattern.forEach(function (pp) {
      if (!pp || !pp.family) return;
      idx[_familyToKey(pp.family)] = pp;
    });
    return idx;
  }

  // ── Fire filter callbacks ─────────────────────────────────────────────
  function _fireFilter() {
    var copy = new Set(_checkedKeys);
    _filterCallbacks.forEach(function (cb) { try { cb(copy); } catch (e) {} });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 1 — Header
  // ══════════════════════════════════════════════════════════════════════
  function _renderHeader(trace) {
    var meta = trace.meta || {};
    var stockLine = [
      meta.stockCode || '—',
      meta.market    || '—',
      meta.timeframe || '—',
      (meta.barCount != null ? meta.barCount : (trace.bars ? trace.bars.length : '—')) + ' bars',
    ].join(' · ');

    var engineLine = [
      'pattern.js v' + (meta.patternEngineVersion || '?'),
      'signal.js v'  + (meta.signalEngineVersion  || '?'),
      (meta.durationMs != null ? meta.durationMs + 'ms' : '—'),
      'traceLevel=' + (meta.traceLevel || '?'),
    ].join(' · ');

    var eventsBadge = '';
    if (meta.eventsEmitted != null) {
      var capped = meta.ringBufferCapped
        ? ' <span class="tp-warn-tag">ring-capped</span>' : '';
      eventsBadge = ' <span class="tp-badge">' + meta.eventsEmitted + ' events' + capped + '</span>';
    }

    return '<div class="panel-section-title">' + _esc(stockLine) + eventsBadge + '</div>' +
           '<div class="meta-table" style="padding:0 14px 8px;font-size:11px;color:#787b86">' +
             _esc(engineLine) + '<br>' +
             (meta.generatedAt ? meta.generatedAt.slice(0, 19).replace('T', ' ') : '') +
           '</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 2 — Regime card
  // ══════════════════════════════════════════════════════════════════════
  var REGIME_FIELDS = [
    { key: 'hurstWeight',   label: 'Hurst Weight',  lo: 0.6, hi: 1.4 },
    { key: 'volWeight',     label: 'Vol Weight',    lo: 0.7, hi: 1.4 },
    { key: 'meanRevWeight', label: 'MeanRev Weight',lo: 0.6, hi: 1.0 },
    { key: 'regimeWeight',  label: 'Regime Weight', lo: null, hi: null },
    { key: 'dynamicATRCap', label: 'ATR Cap',       lo: null, hi: null },
    { key: 'amhDecayFactor',label: 'AMH Decay',     lo: null, hi: null },
  ];

  function _renderRegime(trace) {
    var pre    = trace.preAnalyze;
    var regime = pre && pre.regime;
    var cache  = pre && pre.indicatorCacheSummary;
    var html   = '<div class="panel-section-title">Regime / Pre-analyze</div>';

    if (!regime) {
      html += '<div style="padding:6px 14px;font-size:11px;color:#787b86">Not captured at mvp level</div>';
    } else {
      html += '<table class="meta-table"><tbody>';
      REGIME_FIELDS.forEach(function (f) {
        var val = regime[f.key];
        if (val == null) return;
        var oor = f.lo != null && (val < f.lo || val > f.hi);
        var pct = Math.min(100, Math.max(0, (val / 2) * 100)).toFixed(1);
        html += '<tr><td style="white-space:nowrap">' + f.label + '</td>' +
                '<td><div style="display:flex;align-items:center;gap:6px">' +
                  '<div style="flex:1;height:4px;background:#2a2e39;border-radius:2px">' +
                    '<div style="width:' + pct + '%;height:4px;border-radius:2px;background:' +
                      (oor ? '#FFB432' : '#26a69a') + '"></div>' +
                  '</div>' +
                  '<span class="' + (oor ? 'tp-warn-text' : '') + '" style="width:52px;text-align:right">' +
                    Number(val).toFixed(4) +
                  '</span>' +
                '</div></td></tr>';
      });
      html += '</tbody></table>';
    }

    if (cache) {
      html += '<table class="meta-table"><tbody>';
      ['atr14.last', 'ma20.last', 'rsi14.last'].forEach(function (k) {
        if (cache[k] == null) return;
        var v = cache[k];
        var disp = k === 'rsi14.last' ? Number(v).toFixed(1) : Number(v).toLocaleString();
        html += '<tr><td>' + k + '</td><td>' + disp + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 3 — N0 slider  (rendered into DOM directly for event binding)
  // ══════════════════════════════════════════════════════════════════════
  function _buildN0SliderEl() {
    var wrap = document.createElement('div');
    wrap.className = 'panel-section-title';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 14px';
    wrap.innerHTML =
      '<span>EB N\u2080 <strong id="tp-n0-val">' + _n0 + '</strong></span>' +
      '<input id="tp-n0-slider" type="range" min="5" max="200" value="' + _n0 + '"' +
             ' style="flex:1" aria-label="Empirical Bayes N0 prior strength">';
    return wrap;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 4 — Family filter (45 checkboxes)
  // ══════════════════════════════════════════════════════════════════════
  function _buildFamilySection(ppIdx) {
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div class="panel-section-title">Pattern Families (45)</div>';

    GROUPS.forEach(function (grp) {
      var members = TAXONOMY.filter(function (t) { return t.family === grp.id; });
      var totalDet = 0, totalNM = 0;
      members.forEach(function (t) {
        var pp = ppIdx[t.key];
        if (!pp) return;
        totalDet += (pp.detected  || []).length;
        totalNM  += (pp.nearMiss  || []).length;
      });

      var details = document.createElement('details');
      details.className = 'tp-group';
      details.setAttribute('open', '');

      var summary = document.createElement('summary');
      summary.className = 'tp-group-header';
      summary.setAttribute('aria-label', grp.label + ' pattern group');
      summary.innerHTML =
        '<span class="tp-group-label">' + grp.label + ' (' + grp.count + ')</span>' +
        (totalDet ? ' <span class="tp-det-count">' + totalDet + '</span>' : '') +
        (totalNM  ? ' <span class="tp-nm-count">·' + totalNM + ' NM</span>' : '') +
        ' <button class="tp-toggle-all" aria-label="Toggle all">all</button>';
      details.appendChild(summary);

      // all-on/off toggle
      summary.querySelector('.tp-toggle-all').addEventListener('click', function (e) {
        e.stopPropagation();
        var allOn = members.every(function (t) { return _checkedKeys.has(t.key); });
        members.forEach(function (t) {
          var cb = document.getElementById('tp-cb-' + t.key);
          if (allOn) { _checkedKeys.delete(t.key); if (cb) cb.checked = false; }
          else        { _checkedKeys.add(t.key);    if (cb) cb.checked = true;  }
        });
        _fireFilter();
      });

      // table of rows
      var tbl = document.createElement('table');
      tbl.className = 'tp-family-table';
      tbl.setAttribute('role', 'group');
      tbl.setAttribute('aria-label', grp.label + ' checkboxes');
      var thead = document.createElement('thead');
      thead.innerHTML =
        '<tr>' +
          '<th></th>' +
          '<th>Pattern</th>' +
          '<th title="Detected count">Det</th>' +
          '<th title="Near-miss count">NM</th>' +
          '<th title="EB-shrunk Wilson CI">WR (shrunk)</th>' +
          '<th title="BH-FDR p-value badge">BH</th>' +
          '<th title="Sample power (Cohen n>=10/p)">Pwr</th>' +
        '</tr>';
      tbl.appendChild(thead);

      var tbody = document.createElement('tbody');
      members.forEach(function (t) {
        tbody.appendChild(_buildFamilyRow(t, ppIdx[t.key]));
      });
      tbl.appendChild(tbody);
      details.appendChild(tbl);
      wrap.appendChild(details);
    });
    return wrap;
  }

  function _buildFamilyRow(taxonomy, pp) {
    var key     = taxonomy.key;
    var detList = (pp && pp.detected) || [];
    var nmList  = (pp && pp.nearMiss) || [];

    // Best l3 stats from first detection with l3
    var bestL3 = null;
    for (var i = 0; i < detList.length; i++) {
      if (detList[i] && detList[i].l3) { bestL3 = detList[i].l3; break; }
    }

    var wr      = bestL3 && bestL3.wr;
    var rawWR   = wr ? wr.raw    : null;
    var wrN     = wr ? wr.N      : null;
    var grand   = wr ? (wr.grandMean != null ? wr.grandMean : DEFAULT_GRAND) : DEFAULT_GRAND;
    var pVal    = bestL3 ? bestL3.pValue : null;
    var bhThr   = bestL3 ? (bestL3.bhFdrThreshold || BH_FDR_CROSS) : BH_FDR_CROSS;
    var antiP   = bestL3 ? bestL3.antiPredictor : null;
    var inv     = bestL3 ? bestL3.inverted : null;
    var finConf = bestL3 ? bestL3.finalConfidence : null;

    // Wilson CI string
    var wStr = _wilsonStr(rawWR, wrN, _n0, grand);

    // BH-FDR
    var bhHtml = '<span class="muted">—</span>';
    if (pVal != null) {
      var bhPass = pVal <= bhThr;
      bhHtml = '<span class="tp-mono" style="font-size:10px">' + pVal.toExponential(2) + '</span>' +
               ' <span class="tp-bh-' + (bhPass ? 'pass' : 'fail') + '">' +
               (bhPass ? 'P' : 'F') + '</span>';
    }

    // Sample power
    var pwrHtml = '<span class="muted">—</span>';
    if (pVal != null && wrN != null) {
      var strong = wrN >= (10 / pVal);
      pwrHtml = '<span class="tp-pwr-' + (strong ? 'strong' : 'weak') + '">' +
                (strong ? 'OK' : 'low') + '</span>';
    }

    // Anti-predictor inline icon
    var antiIcon = '';
    if (rawWR != null && wrN != null && finConf != null && finConf > 50 &&
        antiP === true && inv === false) {
      var shrunk = _shrink(rawWR, wrN, _n0, grand);
      if (shrunk < 48) {
        antiIcon = ' <span class="tp-anti-icon" title="anti-predictor: WR(shrunk)<48 but conf>50">&#9888;</span>';
      }
    }

    var tr = document.createElement('tr');
    tr.className = 'tp-pattern-row' + (detList.length > 0 ? ' tp-has-det' : '');

    // Checkbox
    var tdCb = document.createElement('td');
    var lbl  = document.createElement('label');
    lbl.htmlFor   = 'tp-cb-' + key;
    lbl.className = 'tp-cb-label';
    var cb = document.createElement('input');
    cb.type  = 'checkbox';
    cb.id    = 'tp-cb-' + key;
    cb.checked = _checkedKeys.has(key);
    cb.setAttribute('aria-label', taxonomy.nameKo + ' filter');
    cb.addEventListener('change', function () {
      if (cb.checked) _checkedKeys.add(key); else _checkedKeys.delete(key);
      _fireFilter();
    });
    lbl.appendChild(cb);
    tdCb.appendChild(lbl);
    tr.appendChild(tdCb);

    // Name
    var tdName = document.createElement('td');
    tdName.className = 'tp-col-name';
    tdName.innerHTML =
      '<span class="tp-key">' + _esc(key) + '</span>' +
      '<span class="muted" style="font-size:10px"> ' + _esc(taxonomy.nameKo) + '</span>' +
      antiIcon;
    tr.appendChild(tdName);

    // Det / NM
    var tdDet = document.createElement('td');
    tdDet.innerHTML = detList.length > 0
      ? '<strong class="tp-det-count">' + detList.length + '</strong>'
      : '<span class="muted">0</span>';
    tr.appendChild(tdDet);

    var tdNM = document.createElement('td');
    tdNM.innerHTML = nmList.length > 0
      ? '<span class="tp-nm-count">' + nmList.length + '</span>'
      : '<span class="muted">—</span>';
    tr.appendChild(tdNM);

    // Wilson CI cell — data attrs for live slider refresh
    var tdWR = document.createElement('td');
    tdWR.className = 'tp-wilson-cell tp-mono';
    tdWR.setAttribute('data-key',     key);
    tdWR.setAttribute('data-raw-wr',  rawWR  != null ? rawWR  : '');
    tdWR.setAttribute('data-wr-n',    wrN    != null ? wrN    : '');
    tdWR.setAttribute('data-grand',   grand);
    tdWR.style.fontSize = '10px';
    tdWR.textContent = wStr;
    tr.appendChild(tdWR);

    // BH
    var tdBH = document.createElement('td');
    tdBH.innerHTML = bhHtml;
    tr.appendChild(tdBH);

    // Power
    var tdPwr = document.createElement('td');
    tdPwr.innerHTML = pwrHtml;
    tr.appendChild(tdPwr);

    return tr;
  }

  // Live Wilson CI refresh
  function _refreshWilsonCells() {
    var cells = document.querySelectorAll('.tp-wilson-cell');
    cells.forEach(function (td) {
      var rawWR = parseFloat(td.getAttribute('data-raw-wr'));
      var wrN   = parseFloat(td.getAttribute('data-wr-n'));
      var grand = parseFloat(td.getAttribute('data-grand'));
      if (isNaN(rawWR) || isNaN(wrN)) return;
      td.textContent = _wilsonStr(rawWR, wrN, _n0, isNaN(grand) ? DEFAULT_GRAND : grand);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 5 — Pattern detection cards
  // ══════════════════════════════════════════════════════════════════════
  function _renderPatternCards(trace) {
    var perPattern = trace.perPattern;
    if (!perPattern || !perPattern.length) {
      return '<div class="panel-section-title">패턴</div>' +
             '<p style="padding:10px 14px;font-size:11px;color:#787b86">감지된 패턴 없음</p>';
    }

    var items = [];
    perPattern.forEach(function (pp) {
      if (!pp.detected || !pp.detected.length) return;
      pp.detected.forEach(function (det) { items.push({ pp: pp, det: det }); });
    });

    items.sort(function (a, b) {
      var ca = a.det.l3 ? (a.det.l3.finalConfidence || 0) : 0;
      var cb = b.det.l3 ? (b.det.l3.finalConfidence || 0) : 0;
      return cb - ca;
    });

    var html = '<div class="panel-section-title">패턴 (' + items.length + ')</div>';

    items.forEach(function (item) {
      var pp      = item.pp;
      var det     = item.det;
      var type    = _familyToKey(pp.family);
      var nameKo  = PATTERN_NAMES_KO[type] || type;
      var l3      = det.l3 || {};
      var conf    = l3.finalConfidence != null ? l3.finalConfidence : '?';
      var confNum = typeof conf === 'number' ? conf : 0;

      var confColor = '#787b86';
      if (confNum >= 70) confColor = '#26a69a';
      else if (confNum >= 55) confColor = '#A08830';
      else if (confNum >= 40) confColor = '#ff9800';

      var stopStr   = l3.stopLoss    ? Number(l3.stopLoss).toLocaleString()    : '—';
      var targetStr = l3.priceTarget ? Number(l3.priceTarget).toLocaleString() : '—';

      var wrHtml = '';
      if (l3.wr) {
        var wr = l3.wr;
        wrHtml = '<div class="pattern-card-meta" style="margin-top:4px">' +
          '<span>EB shrunk: ' + (wr.shrunk != null ? Number(wr.shrunk).toFixed(1) : '?') + '%</span>' +
          '<span>N=' + (wr.N || '?') + '</span>' +
          '<span>N\u2080=' + (wr.N0 != null ? wr.N0 : '35') + '</span>' +
          '</div>';
      }

      var pathHtml = '';
      if (l3.confidencePath && l3.confidencePath.length) {
        var steps = l3.confidencePath.map(function (s) {
          return _esc(s.stage) + '(' + (s.delta >= 0 ? '+' : '') + s.delta + ')';
        }).join(' > ');
        pathHtml = '<div class="pattern-card-meta" style="word-break:break-all;margin-top:2px">' + steps + '</div>';
      }

      var warnHtml = '';
      if (l3.antiPredictor && !l3.inverted && confNum > 50) {
        warnHtml = '<div style="color:#ff8a80;font-size:10px;margin-top:4px">Anti-predictor 경고</div>';
      }

      html += '<div class="pattern-card" data-bar="' + det.barIndex + '">' +
        '<div class="pattern-card-header">' +
          '<span class="pattern-card-name">' + _esc(nameKo) + '</span>' +
          '<span class="pattern-card-conf" style="color:' + confColor + '">' + conf + '%</span>' +
        '</div>' +
        '<div class="pattern-card-meta">' +
          '<span>Bar ' + (det.barIndex != null ? det.barIndex : '?') + '</span>' +
          '<span>' + _esc(l3.outcome || '?') + '</span>' +
          '<span>SL:' + stopStr + '</span>' +
          '<span>TP:' + targetStr + '</span>' +
        '</div>' +
        wrHtml + pathHtml + warnHtml +
        '<div class="conf-bar-wrap">' +
          '<div class="conf-bar-fill" style="width:' + confNum + '%"></div>' +
        '</div>' +
        '</div>';
    });
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 6 — Near-miss summary
  // ══════════════════════════════════════════════════════════════════════
  function _renderNearMiss(trace) {
    var perPattern = trace.perPattern;
    if (!perPattern) return '';
    var total = 0;
    perPattern.forEach(function (pp) { total += (pp.nearMiss && pp.nearMiss.length) || 0; });
    if (!total) return '';

    var html = '<div class="panel-section-title">Near Miss (' + total + ')</div>';
    perPattern.forEach(function (pp) {
      if (!pp.nearMiss || !pp.nearMiss.length) return;
      var type = _familyToKey(pp.family);
      pp.nearMiss.forEach(function (nm) {
        // H2: coerce barIndex to Number, escape gateFailed
        var barIdxNum = Number(nm.barIndex);
        html += '<div class="sr-row">' +
          '<span class="sr-price">' + _esc(PATTERN_NAMES_KO[type] || type) + ' Bar' + (isFinite(barIdxNum) ? barIdxNum : '?') + '</span>' +
          '<span class="sr-touch" style="color:#ff8a80">' +
            _esc(nm.gateFailed || '?') +
            (nm.pctMiss != null ? ' ' + Number(nm.pctMiss).toFixed(1) + '%' : '') +
          '</span>' +
          '</div>';
      });
    });
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 7 — S/R levels
  // ══════════════════════════════════════════════════════════════════════
  function _renderSRLevels(trace) {
    var post = trace.postPipeline;
    if (!post || !post.srLevels || !post.srLevels.length) return '';

    var levels = post.srLevels.slice().sort(function (a, b) { return b.price - a.price; });
    var html = '<div class="panel-section-title">S/R 레벨 (' + levels.length + ')</div>';
    levels.forEach(function (sr) {
      // H2: coerce touchCount to Number before interpolation
      var tcNum = Number(sr.touchCount);
      html += '<div class="sr-row">' +
        '<span class="sr-price">' + Number(sr.price).toLocaleString() + '</span>' +
        '<span class="sr-touch">터치 ' + (isFinite(tcNum) ? tcNum : '?') + '회 · str ' +
          (sr.strength != null ? Number(sr.strength).toFixed(2) : '?') +
        '</span>' +
        '</div>';
    });
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Section 8 — Aggregate stats + unexplained rejection + anti-predictor
  // ══════════════════════════════════════════════════════════════════════
  function _renderAggregateStats(trace) {
    var perPattern = trace.perPattern;
    if (!perPattern || !perPattern.length) return '';

    var totalConsidered = 0, totalDetected = 0, totalNear = 0, totalUnexplained = 0;
    var antiCards = [];

    perPattern.forEach(function (pp) {
      var agg = pp.aggregateRejected;
      if (agg) {
        totalConsidered  += agg.considered        || 0;
        totalDetected    += agg.detected          || 0;
        totalNear        += agg.nearMiss          || 0;
        totalUnexplained += agg.unexplainedReject || 0;
      }

      // Anti-predictor card collection
      if (!pp.detected) return;
      pp.detected.forEach(function (det) {
        if (!det || !det.l3) return;
        var l3 = det.l3;
        if (l3.antiPredictor === true && l3.inverted === false &&
            l3.finalConfidence != null && l3.finalConfidence > 50) {
          var shrunk = null;
          if (l3.wr && l3.wr.raw != null && l3.wr.N != null) {
            shrunk = _shrink(l3.wr.raw, l3.wr.N, _n0, l3.wr.grandMean);
          }
          if (shrunk == null || shrunk < 48) {
            antiCards.push({ family: pp.family, barIndex: det.barIndex, conf: l3.finalConfidence, shrunk: shrunk });
          }
        }
      });
    });

    var html = '<div class="panel-section-title">집계 통계</div>';
    if (totalConsidered) {
      html += '<table class="meta-table"><tbody>' +
        '<tr><td>총 검토</td><td>' + totalConsidered + '</td></tr>' +
        '<tr><td>감지됨</td><td style="color:#26a69a">' + totalDetected + '</td></tr>' +
        '<tr><td>Near Miss</td><td style="color:#ff9800">' + totalNear + '</td></tr>' +
        '<tr><td>미설명 기각 <span class="tp-help" title="Main-thread 14-stage cascade not traced in MVP. See appWorker.js L309-336.">?</span></td>' +
          '<td style="color:#787b86">' + totalUnexplained + '</td></tr>' +
        '</tbody></table>';
    } else {
      html += '<div style="padding:6px 14px;font-size:11px;color:#787b86">Not captured at mvp level</div>';
    }

    if (antiCards.length > 0) {
      html += '<div class="panel-section-title" style="color:#ff8a80">Anti-Predictor Alerts (' + antiCards.length + ')</div>';
      antiCards.forEach(function (c) {
        // H2: coerce numerics before interpolation
        var barIdxNum = Number(c.barIndex);
        var confNum   = Number(c.conf);
        html += '<div class="pattern-card" style="border-color:#ff8a80">' +
          '<span style="color:#ff8a80;font-weight:700">' + _esc(c.family) + '</span>' +
          ' bar#' + (isFinite(barIdxNum) ? barIdxNum : '?') +
          ' WR(shrunk)=' + (c.shrunk != null ? _fmt(c.shrunk, 1) + '%' : '—') +
          ' conf=' + (isFinite(confNum) ? confNum : '?') +
          ' <span class="tp-tag-anti">antiPredictor=true, inverted=false</span>' +
          '</div>';
      });
    }
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public: load
  // ══════════════════════════════════════════════════════════════════════
  function load(trace) {
    var panel = _panelEl();
    if (!panel) return;
    panel.innerHTML = '';

    // Static HTML sections
    var staticHtml =
      _renderHeader(trace) +
      _renderRegime(trace) +
      _renderPatternCards(trace) +
      _renderNearMiss(trace) +
      _renderSRLevels(trace) +
      _renderAggregateStats(trace);

    panel.innerHTML = staticHtml;

    // N0 slider (interactive — must be DOM element not HTML string)
    var regimeNode = panel.querySelector('[data-section="regime"]');
    var n0El = _buildN0SliderEl();
    panel.insertBefore(n0El, panel.firstChild.nextSibling || null);
    var slider = n0El.querySelector('#tp-n0-slider');
    var valLbl = n0El.querySelector('#tp-n0-val');
    if (slider) {
      slider.addEventListener('input', function () {
        _n0 = parseInt(slider.value, 10);
        if (valLbl) valLbl.textContent = _n0;
        _refreshWilsonCells();
      });
    }

    // Family filter section (DOM-built for checkbox interactivity)
    var ppIdx   = _buildPpIndex(trace);
    var famSect = _buildFamilySection(ppIdx);
    // Insert after regime card (third child after header + n0 slider + regime)
    // Locate the aggregate stats divider and insert before pattern cards
    var firstCardDiv = panel.querySelector('.pattern-card');
    if (firstCardDiv) {
      var cardTitle = firstCardDiv.previousElementSibling;
      // Insert family section before the pattern cards title
      panel.insertBefore(famSect, cardTitle || firstCardDiv);
    } else {
      panel.appendChild(famSect);
    }

    // Click on pattern card -> jump scrubber
    panel.querySelectorAll('.pattern-card[data-bar]').forEach(function (card) {
      card.addEventListener('click', function () {
        var barIdx = parseInt(card.dataset.bar, 10);
        if (!isNaN(barIdx)) {
          var scrubber = document.getElementById('trace-scrubber');
          if (scrubber) {
            scrubber.value = barIdx;
            scrubber.dispatchEvent(new Event('input'));
          }
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public: showError
  // ══════════════════════════════════════════════════════════════════════
  function showError(msg) {
    var panel = _panelEl();
    if (panel) {
      panel.innerHTML =
        '<div class="error-card"><strong>로드 실패</strong><br>' + _esc(msg) + '</div>';
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public: onFilterChange
  // ══════════════════════════════════════════════════════════════════════
  function onFilterChange(cb) {
    if (typeof cb === 'function') _filterCallbacks.push(cb);
  }

  return { load: load, showError: showError, onFilterChange: onFilterChange };

})();
