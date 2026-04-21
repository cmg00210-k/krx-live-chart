// ══════════════════════════════════════════════════════
//  Pattern Trace Canvas Renderer — traceCanvas.js
//  8 draw layers (DISTINCT from production 9-layer ISeriesPrimitive contract)
//  Canvas2D only. NO TradingView LWC. NO ISeriesPrimitive.
//
//  Layer order (D1 → D8):
//    D1 candleBodies      — standard OHLC candles (KRX_COLORS.UP/DOWN)
//    D2 srBands           — horizontal dashed S/R lines (ACCENT)
//    D3 nearMissZones     — per-bar 10% gray fill with dash border + hover tooltip
//    D4 detectedZones     — vertical stripe per detected pattern (mint fill 0.18)
//    D5 confluenceLines   — dashed amber arrow from bar to S/R level
//    D6 replayHighlight   — white 8% stripe at current scrubber bar
//    D7 confidenceBars    — stacked horizontal bar (base blue + confluence gold + EB teal)
//    D8 labels            — pill badges with collision avoidance
//
//  Colors from KRX_COLORS. Allowed new additions:
//    #888888           — D3 near-miss gray (no semantic equivalent in KRX_COLORS)
//    rgba(255,180,0,…) — D5 confluence amber (no semantic equivalent in KRX_COLORS)
// ══════════════════════════════════════════════════════

window.traceCanvas = (() => {
  'use strict';

  // ── DOM references ──
  const canvas = document.getElementById('trace-canvas');
  const ctx    = canvas.getContext('2d');

  // ── State ──
  let _state = {
    trace:       null,
    bars:        [],       // [{time,open,high,low,close,volume}]
    scrubberBar: 0,
    viewOffset:  0,        // first visible bar index
    barsVisible: 80,       // how many bars fit in view
    candleW:     0,        // computed per-render
    chartTop:    40,       // px from canvas top to price area top
    chartBottom: 0,        // px from canvas top to price area bottom
    marginRight: 70,       // px reserved for confidence bar column
    marginLeft:  8,
    priceMin:    0,
    priceMax:    0,
  };

  // ── Hover state for D3 tooltip ──
  let _hover = { barIndex: -1, layerD3Hit: false };
  let _tooltipEl = null;

  // ── Pattern direction lookup (from patternRenderer.js BULLISH_TYPES/BEARISH_TYPES) ──
  const BULLISH_TYPES = new Set([
    'hammer', 'invertedHammer', 'dragonflyDoji',
    'bullishEngulfing', 'bullishHarami', 'bullishHaramiCross',
    'piercingLine', 'morningStar', 'threeWhiteSoldiers',
    'threeInsideUp', 'abandonedBabyBullish', 'risingThreeMethods',
    'tweezerBottom', 'bullishMarubozu', 'bullishBeltHold',
    'doubleBottom', 'inverseHeadAndShoulders',
    'ascendingTriangle', 'fallingWedge', 'cupAndHandle',
  ]);

  const BEARISH_TYPES = new Set([
    'hangingMan', 'shootingStar', 'gravestoneDoji',
    'bearishEngulfing', 'bearishHarami', 'bearishHaramiCross',
    'darkCloud', 'eveningStar', 'threeBlackCrows',
    'threeInsideDown', 'abandonedBabyBearish', 'fallingThreeMethods',
    'tweezerTop', 'bearishMarubozu', 'bearishBeltHold',
    'doubleTop', 'headAndShoulders',
    'descendingTriangle', 'risingWedge',
  ]);

  // Family string → pattern type extraction (e.g. "candle.triple.morningStar" → "morningStar")
  function _familyToType(family) {
    if (!family) return '';
    const parts = family.split('.');
    return parts[parts.length - 1];
  }

  // Get fill color for a detected pattern
  function _detectedFill(family, alpha) {
    const type = _familyToType(family);
    if (BULLISH_TYPES.has(type)) return KRX_COLORS.PTN_BUY_FILL.replace('0.12', String(alpha));
    if (BEARISH_TYPES.has(type)) return KRX_COLORS.PTN_SELL_FILL.replace('0.12', String(alpha));
    // Neutral/unknown — use PTN_NEUTRAL_FILL
    return KRX_COLORS.PTN_NEUTRAL_FILL(alpha);
  }

  // ── Price ↔ Y coordinate ──
  function _priceToY(price) {
    const h = _state.chartBottom - _state.chartTop;
    const range = _state.priceMax - _state.priceMin;
    if (range <= 0) return _state.chartTop + h / 2;
    return _state.chartTop + h * (1 - (price - _state.priceMin) / range);
  }

  // Bar index → center X (returns null if out of view, null, or non-finite).
  // S2.5: null/undefined/NaN inputs now return null instead of NaN, so the 10+
  // call sites that short-circuit on `x === null` handle them correctly.
  function _barToX(barIndex) {
    if (barIndex == null || !isFinite(barIndex)) return null;
    const rel = barIndex - _state.viewOffset;
    if (rel < 0 || rel >= _state.barsVisible) return null;
    return _state.marginLeft + (rel + 0.5) * _state.candleW;
  }

  // ── Compute visible price range ──
  function _computePriceRange() {
    const end   = Math.min(_state.viewOffset + _state.barsVisible, _state.bars.length);
    const slice = _state.bars.slice(_state.viewOffset, end);
    if (!slice.length) { _state.priceMin = 0; _state.priceMax = 1; return; }
    let lo = Infinity, hi = -Infinity;
    for (const b of slice) {
      if (b.low  < lo) lo = b.low;
      if (b.high > hi) hi = b.high;
    }
    const pad = (hi - lo) * 0.08 || hi * 0.02;
    _state.priceMin = lo - pad;
    _state.priceMax = hi + pad;
  }

  // ── DPR-aware resize ──
  function _resize() {
    const dpr  = window.devicePixelRatio || 1;
    const w    = canvas.clientWidth  || canvas.parentElement.clientWidth  || 800;
    const h    = canvas.clientHeight || canvas.parentElement.clientHeight || 600;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Reset transform to avoid DPR accumulation, then apply scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    _state.chartBottom = h - 80; // reserve bottom for D7 confidence bar + scrubber label gap
    _render();
  }

  // ── Compute layout constants before each render ──
  function _prepareLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.width / dpr;
    const nVisible = Math.min(_state.barsVisible, _state.bars.length - _state.viewOffset);
    if (nVisible <= 0) return;
    const chartW = w - _state.marginLeft - _state.marginRight;
    _state.candleW = chartW / _state.barsVisible;
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D1 — Candle Bodies
  // ══════════════════════════════════════════════════════
  function _drawD1Candles() {
    const bars     = _state.bars;
    const viewEnd  = Math.min(_state.viewOffset + _state.barsVisible, bars.length);
    const cw       = _state.candleW;
    const bodyW    = Math.max(1, cw * 0.6);
    const wickW    = Math.max(1, cw * 0.1);

    ctx.save();

    for (let i = _state.viewOffset; i < viewEnd; i++) {
      const b  = bars[i];
      const x  = _barToX(i);
      if (x === null) continue;

      const isUp  = b.close >= b.open;
      const color = isUp ? KRX_COLORS.UP : KRX_COLORS.DOWN;

      const openY  = _priceToY(b.open);
      const closeY = _priceToY(b.close);
      const highY  = _priceToY(b.high);
      const lowY   = _priceToY(b.low);

      const bodyTop    = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth   = wickW;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body — M1 fix: collapsed dead ternary (isUp ? color : color)
      ctx.fillStyle = color;
      ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
    }

    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D2 — SR Bands
  // ══════════════════════════════════════════════════════
  function _drawD2SRBands() {
    if (!_state.trace) return;
    const srLevels = _state.trace.postPipeline && _state.trace.postPipeline.srLevels;
    if (!srLevels || !srLevels.length) return;

    const dpr  = window.devicePixelRatio || 1;
    const w    = canvas.width / dpr;

    // Find max touchCount for proportional line width
    let maxTouch = 1;
    for (const sr of srLevels) {
      if (sr.touchCount > maxTouch) maxTouch = sr.touchCount;
    }

    ctx.save();
    ctx.strokeStyle = KRX_COLORS.ACCENT;
    ctx.setLineDash([5, 3]);

    for (const sr of srLevels) {
      const y = _priceToY(sr.price);
      if (y < _state.chartTop - 4 || y > _state.chartBottom + 4) continue;

      const touchRatio   = sr.touchCount / maxTouch;
      ctx.lineWidth      = 0.5 + touchRatio * 1.5; // 0.5 – 2px
      ctx.globalAlpha    = 0.35 + touchRatio * 0.45;

      ctx.beginPath();
      ctx.moveTo(_state.marginLeft, y);
      ctx.lineTo(w - _state.marginRight, y);
      ctx.stroke();

      // Price label
      ctx.globalAlpha  = 0.7;
      ctx.font         = '10px "JetBrains Mono", monospace';
      ctx.fillStyle    = KRX_COLORS.ACCENT;
      ctx.textAlign    = 'right';
      ctx.setLineDash([]);
      ctx.fillText(sr.price.toLocaleString(), w - _state.marginRight - 4, y - 3);
      ctx.setLineDash([5, 3]);
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D3 — Near-Miss Zones
  //  MVP trace has empty nearMiss[]; layer skeleton ready for Session 2.
  // ══════════════════════════════════════════════════════
  function _drawD3NearMiss() {
    if (!_state.trace) return;
    const perPattern = _state.trace.perPattern;
    if (!perPattern || !perPattern.length) return;

    // Build a map: barIndex → [{gateFailed, measured, threshold, pctMiss}]
    const nearMissMap = new Map();
    for (const pp of perPattern) {
      if (!pp.nearMiss || !pp.nearMiss.length) continue;
      for (const nm of pp.nearMiss) {
        if (!nearMissMap.has(nm.barIndex)) nearMissMap.set(nm.barIndex, []);
        nearMissMap.get(nm.barIndex).push({
          family: pp.family,
          gateFailed: nm.gateFailed,
          measured:   nm.measured,
          threshold:  nm.threshold,
          pctMiss:    nm.pctMiss,
        });
      }
    }

    if (!nearMissMap.size) return;

    const cw = _state.candleW;

    ctx.save();
    // #888888 — new color (no KRX_COLORS semantic equivalent for near-miss gray)
    ctx.fillStyle   = 'rgba(136,136,136,0.10)';
    ctx.strokeStyle = '#888888';
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([2, 3]);

    for (const [barIndex, items] of nearMissMap) {
      const x = _barToX(barIndex);
      if (x === null) continue;

      const rectX = x - cw / 2;
      const rectY = _state.chartTop;
      const rectH = _state.chartBottom - _state.chartTop;

      ctx.fillRect(rectX, rectY, cw, rectH);
      ctx.strokeRect(rectX, rectY, cw, rectH);
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Hover data stored for mousemove handler
    _state._nearMissMap = nearMissMap;
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D4 — Detected Zones
  // ══════════════════════════════════════════════════════
  function _drawD4DetectedZones() {
    if (!_state.trace) return;
    const perPattern = _state.trace.perPattern;
    if (!perPattern || !perPattern.length) return;

    const cw = _state.candleW;

    ctx.save();

    for (const pp of perPattern) {
      if (!pp.detected || !pp.detected.length) continue;
      const fillColor = _detectedFill(pp.family, 0.18);

      for (const det of pp.detected) {
        const x = _barToX(det.barIndex);
        if (x === null) continue;

        ctx.fillStyle = fillColor;
        ctx.fillRect(
          x - cw / 2,
          _state.chartTop,
          cw,
          _state.chartBottom - _state.chartTop
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D5 — Confluence Lines
  //  Dashed amber arrow from detection bar to S/R level price
  // ══════════════════════════════════════════════════════
  function _drawD5ConfluenceLines() {
    if (!_state.trace) return;
    const pp     = _state.trace.perPattern;
    const post   = _state.trace.postPipeline;
    if (!pp || !post || !post.confluenceApplications) return;

    const apps = post.confluenceApplications;
    if (!apps.length) return;

    // rgba(255,180,0,0.7) — new color (no KRX_COLORS semantic equivalent for confluence amber arrow)
    const AMBER = 'rgba(255,180,0,0.7)';

    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.lineWidth   = 1.2;
    ctx.setLineDash([4, 3]);

    for (const app of apps) {
      const patDef = pp[app.patternIdx];
      if (!patDef || !patDef.detected || !patDef.detected.length) continue;

      const det = patDef.detected[0]; // use first detection bar
      const x   = _barToX(det.barIndex);
      if (x === null) continue;

      const srY = _priceToY(app.srLevel);
      const detY = _priceToY(
        _state.bars[det.barIndex] ? _state.bars[det.barIndex].close : app.srLevel
      );

      // Draw dashed line
      ctx.beginPath();
      ctx.moveTo(x, detY);
      ctx.lineTo(x, srY);
      ctx.stroke();

      // Arrowhead at S/R end
      ctx.setLineDash([]);
      const dir   = srY > detY ? 1 : -1;
      const aw    = 5;
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.moveTo(x, srY);
      ctx.lineTo(x - aw, srY - dir * aw);
      ctx.lineTo(x + aw, srY - dir * aw);
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([4, 3]);

      // Delta confidence label
      if (app.deltaConfidence) {
        ctx.setLineDash([]);
        ctx.fillStyle = AMBER;
        ctx.font      = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('+' + app.deltaConfidence, x + 4, (detY + srY) / 2);
        ctx.setLineDash([4, 3]);
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D6 — Replay Highlight
  // ══════════════════════════════════════════════════════
  function _drawD6ReplayHighlight() {
    const idx = _state.scrubberBar;
    const x   = _barToX(idx);
    if (x === null) return;

    const cw = _state.candleW;
    ctx.save();
    ctx.fillStyle   = 'rgba(255,255,255,0.08)';
    ctx.fillRect(
      x - cw / 2,
      _state.chartTop,
      cw,
      _state.chartBottom - _state.chartTop
    );

    // Vertical hairline
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x, _state.chartTop);
    ctx.lineTo(x, _state.chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D7 — Confidence Bars (stacked horizontal, right margin)
  //  base blue | confluence gold | qualityEB teal
  //  Clamp indicator: red right edge when finalConfidence == cap
  // ══════════════════════════════════════════════════════
  function _drawD7ConfidenceBars() {
    if (!_state.trace) return;
    const perPattern = _state.trace.perPattern;
    if (!perPattern || !perPattern.length) return;

    const dpr  = window.devicePixelRatio || 1;
    const w    = canvas.width / dpr;
    const barAreaX = w - _state.marginRight + 6;
    const barAreaW = _state.marginRight - 10;

    // Collect all detected patterns with confidence data
    const items = [];
    for (const pp of perPattern) {
      if (!pp.detected || !pp.detected.length) continue;
      for (const det of pp.detected) {
        if (!det.l3) continue;
        items.push({
          family: pp.family,
          barIndex: det.barIndex,
          l3: det.l3,
        });
      }
    }

    if (!items.length) return;

    // Each item gets a row in the right margin, spaced by chart height
    const rowH    = Math.max(6, Math.min(14, (_state.chartBottom - _state.chartTop) / (items.length + 1)));
    const baseY   = _state.chartTop + 8;

    ctx.save();
    ctx.font      = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    items.forEach((item, idx) => {
      const y        = baseY + idx * (rowH + 4);
      const l3       = item.l3;
      const finalC   = l3.finalConfidence || 0;
      const baseC    = l3.baseConfidence  || 0;

      // Decompose confidence path
      let confluenceD = 0;
      let qualityD    = 0;
      if (l3.confidencePath && l3.confidencePath.length) {
        for (const step of l3.confidencePath) {
          if (step.stage === 'srConfluence') confluenceD += (step.delta || 0);
          if (step.stage === 'quality')      qualityD    += (step.delta || 0);
        }
      }

      const totalC    = Math.min(100, finalC);
      const scaleX    = barAreaW / 100;

      // Background track
      ctx.fillStyle   = 'rgba(42,46,57,0.8)';
      ctx.fillRect(barAreaX, y, barAreaW, rowH);

      // Base segment (blue)
      const baseW     = Math.max(0, baseC) * scaleX;
      ctx.fillStyle   = '#2962ff';
      ctx.fillRect(barAreaX, y, baseW, rowH);

      // Quality EB segment (teal) — stacked after base
      if (qualityD > 0) {
        ctx.fillStyle = '#26C6DA';
        ctx.fillRect(barAreaX + baseW, y, qualityD * scaleX, rowH);
      }

      // Confluence gold segment — stacked after quality
      if (confluenceD > 0) {
        ctx.fillStyle = '#A08830';
        ctx.fillRect(barAreaX + baseW + Math.max(0, qualityD) * scaleX, y, confluenceD * scaleX, rowH);
      }

      // M2 fix: clamp indicator — paint red right edge ONLY when finalConfidence
      // matches an actual numeric ATR cap ceiling recorded in the trace.
      // Path: trace.preAnalyze.regime.dynamicATRCap (not trace.meta.dynamicATRCap).
      // The cap may be { _unavailable: true } at A-MVP — skip entirely if not a number.
      // We also require confidencePath to exist and at least one stage delta to equal
      // the cap value (within tolerance 0.01), confirming this detection was actually clamped.
      const regime  = _state.trace.preAnalyze && _state.trace.preAnalyze.regime;
      const capRaw  = regime && regime.dynamicATRCap;
      const capNum  = (typeof capRaw === 'number') ? capRaw : null;
      if (capNum !== null && l3.confidencePath && l3.confidencePath.length) {
        const TOL = 0.01;
        const wasClamped = l3.confidencePath.some(function (step) {
          return Math.abs(Math.abs(step.delta || 0) - capNum) <= TOL;
        });
        if (wasClamped && finalC >= capNum - TOL) {
          ctx.fillStyle = KRX_COLORS.UP; // L1 fix: use KRX_COLORS.UP instead of '#E05050'
          ctx.fillRect(barAreaX + totalC * scaleX - 2, y, 2, rowH);
        }
      }

      // Label: confidence value
      ctx.fillStyle   = '#d1d4dc';
      ctx.fillText(finalC + '%', barAreaX + barAreaW + 2, y + rowH - 1);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  LAYER D8 — Labels (pill badges + collision avoidance)
  // ══════════════════════════════════════════════════════
  function _drawD8Labels() {
    if (!_state.trace) return;
    const perPattern = _state.trace.perPattern;
    if (!perPattern || !perPattern.length) return;

    // Collect label candidates
    const candidates = [];
    for (const pp of perPattern) {
      if (!pp.detected || !pp.detected.length) continue;
      for (const det of pp.detected) {
        const x = _barToX(det.barIndex);
        if (x === null) continue;

        const type    = _familyToType(pp.family);
        const nameKo  = PATTERN_NAMES_KO[type] || type;
        const conf    = det.l3 ? det.l3.finalConfidence : '';
        const label   = nameKo + (conf ? ' ' + conf + '%' : '');
        const bar     = _state.bars[det.barIndex];
        const baseY   = bar ? _priceToY(bar.high) - 6 : _state.chartTop + 10;

        candidates.push({ x, y: baseY, label, family: pp.family });
      }
    }

    if (!candidates.length) return;

    // Sort by x so collision stacking is left-to-right predictable
    candidates.sort((a, b) => a.x - b.x);

    // Collision avoidance: vertical stack when labels within 40px horizontal
    const placed = [];
    for (const cand of candidates) {
      let finalY = cand.y;
      for (const prev of placed) {
        if (Math.abs(prev.x - cand.x) < 40) {
          // Move this label above the previous one
          finalY = Math.min(finalY, prev.finalY - 18);
        }
      }
      finalY = Math.max(_state.chartTop + 14, finalY);
      cand.finalY = finalY;
      placed.push(cand);
    }

    // Draw pills
    ctx.save();
    ctx.font = '700 11px "Pretendard", "Segoe UI", system-ui, sans-serif';

    for (const cand of placed) {
      const metrics  = ctx.measureText(cand.label);
      const tw       = metrics.width;
      const ph       = 16; // pill height
      const pw       = tw + 12;
      const px       = cand.x - pw / 2;
      const py       = cand.finalY - ph;

      // Pill background
      ctx.fillStyle = KRX_COLORS.TAG_BG(0.88);
      _roundRect(ctx, px, py, pw, ph, 8);
      ctx.fill();

      // Pill border (mint for detected)
      ctx.strokeStyle = 'rgba(150,220,200,0.5)';
      ctx.lineWidth   = 0.5;
      _roundRect(ctx, px, py, pw, ph, 8);
      ctx.stroke();

      // Label text
      ctx.fillStyle  = '#d1d4dc';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cand.label, cand.x, py + ph / 2);
    }

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';
    ctx.globalAlpha  = 1;
    ctx.restore();
  }

  // ── Rounded rect helper (CanvasRenderingContext2D.roundRect not available in all browsers) ──
  function _roundRect(ctx2d, x, y, w, h, r) {
    if (typeof ctx2d.roundRect === 'function') {
      ctx2d.beginPath();
      ctx2d.roundRect(x, y, w, h, r);
    } else {
      ctx2d.beginPath();
      ctx2d.moveTo(x + r, y);
      ctx2d.lineTo(x + w - r, y);
      ctx2d.arcTo(x + w, y, x + w, y + r, r);
      ctx2d.lineTo(x + w, y + h - r);
      ctx2d.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx2d.lineTo(x + r, y + h);
      ctx2d.arcTo(x, y + h, x, y + h - r, r);
      ctx2d.lineTo(x, y + r);
      ctx2d.arcTo(x, y, x + r, y, r);
      ctx2d.closePath();
    }
  }

  // ── Korean pattern name map (subset for labels) ──
  const PATTERN_NAMES_KO = {
    hammer: '해머', invertedHammer: '역해머', hangingMan: '교수형', shootingStar: '유성형',
    doji: '도지', dragonflyDoji: '잠자리도지', gravestoneDoji: '비석도지',
    longLeggedDoji: '긴다리도지', spinningTop: '팽이형',
    bullishEngulfing: '상승장악형', bearishEngulfing: '하락장악형',
    bullishHarami: '상승잉태형', bearishHarami: '하락잉태형',
    piercingLine: '관통형', darkCloud: '먹구름형',
    tweezerBottom: '족집게바닥', tweezerTop: '족집게천장',
    morningStar: '샛별형', eveningStar: '석별형',
    threeWhiteSoldiers: '적삼병', threeBlackCrows: '흑삼병',
    threeInsideUp: '상승삼내형', threeInsideDown: '하락삼내형',
    bullishMarubozu: '양봉마루보주', bearishMarubozu: '음봉마루보주',
    bullishBeltHold: '강세띠두름', bearishBeltHold: '약세띠두름',
    bullishHaramiCross: '상승잉태십자', bearishHaramiCross: '하락잉태십자',
    stickSandwich: '막대샌드위치',
    abandonedBabyBullish: '상승버려진아기', abandonedBabyBearish: '하락버려진아기',
    risingThreeMethods: '상승삼법형', fallingThreeMethods: '하락삼법형',
    doubleBottom: '이중바닥', doubleTop: '이중천장',
    headAndShoulders: '헤드앤숄더', inverseHeadAndShoulders: '역헤드앤숄더',
    ascendingTriangle: '상승삼각형', descendingTriangle: '하락삼각형',
    symmetricTriangle: '대칭삼각형',
    risingWedge: '상승쐐기형', fallingWedge: '하락쐐기형',
    channel: '채널', cupAndHandle: '컵앤핸들',
  };

  // ── Chart background + grid ──
  function _drawBackground() {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.width  / dpr;
    const h   = canvas.height / dpr;

    ctx.save();
    ctx.fillStyle = KRX_COLORS.CHART_BG;
    ctx.fillRect(0, 0, w, h);

    // Horizontal grid lines
    const gridLines = 5;
    ctx.strokeStyle = KRX_COLORS.CHART_GRID_HORZ;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    const range = _state.priceMax - _state.priceMin;
    for (let i = 0; i <= gridLines; i++) {
      const price = _state.priceMin + (range * i) / gridLines;
      const y     = _priceToY(price);
      ctx.beginPath();
      ctx.moveTo(_state.marginLeft, y);
      ctx.lineTo(w - _state.marginRight, y);
      ctx.stroke();

      // Price axis label
      ctx.fillStyle = KRX_COLORS.CHART_TEXT;
      ctx.font      = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(price).toLocaleString(), w - _state.marginRight - 4, y - 2);
    }

    // Time axis labels (approximate — every N bars)
    const barStep = Math.max(1, Math.floor(_state.barsVisible / 6));
    const viewEnd = Math.min(_state.viewOffset + _state.barsVisible, _state.bars.length);
    ctx.fillStyle   = KRX_COLORS.CHART_TEXT;
    ctx.font        = '9px "JetBrains Mono", monospace';
    ctx.textAlign   = 'center';
    for (let i = _state.viewOffset; i < viewEnd; i += barStep) {
      const b = _state.bars[i];
      if (!b) continue;
      const x   = _barToX(i);
      if (x === null) continue;
      const lbl = typeof b.time === 'string'
        ? b.time.slice(5)             // "MM-DD" from "YYYY-MM-DD"
        : new Date(b.time * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
      ctx.fillText(lbl, x, _state.chartBottom + 12);
    }

    ctx.restore();
  }

  // ── Confidence bar legend (D7 column header) ──
  function _drawD7Legend() {
    const dpr  = window.devicePixelRatio || 1;
    const w    = canvas.width / dpr;
    const lx   = w - _state.marginRight + 6;

    ctx.save();
    ctx.font      = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#787b86';
    ctx.textAlign = 'left';
    ctx.fillText('conf', lx, _state.chartTop - 4);
    ctx.restore();
  }

  // ── Master render ──
  function _render() {
    if (!_state.bars.length) return;
    _prepareLayout();
    _computePriceRange();
    _drawBackground();     // clears and draws grid

    // D1 → D8 in order (save/restore pair is per layer, not global)
    _drawD1Candles();      // D1
    _drawD2SRBands();      // D2
    _drawD3NearMiss();     // D3
    _drawD4DetectedZones(); // D4
    _drawD5ConfluenceLines(); // D5
    _drawD6ReplayHighlight(); // D6
    _drawD7Legend();
    _drawD7ConfidenceBars(); // D7
    _drawD8Labels();        // D8
  }

  // ── Tooltip setup ──
  function _initTooltip() {
    _tooltipEl = document.createElement('div');
    _tooltipEl.id = 'trace-tooltip';
    document.body.appendChild(_tooltipEl);
  }

  function _showTooltip(e, html) {
    if (!_tooltipEl) return;
    _tooltipEl.innerHTML = html;
    _tooltipEl.classList.add('visible');
    _tooltipEl.style.left = (e.clientX + 12) + 'px';
    _tooltipEl.style.top  = (e.clientY + 12) + 'px';
  }

  function _hideTooltip() {
    if (_tooltipEl) _tooltipEl.classList.remove('visible');
  }

  // ── Mouse event handlers — stored as named references for removeEventListener (M3) ──
  function _onMouseMove(e) {
    const rect  = canvas.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const cw    = _state.candleW;
    if (!cw) return;

    const relBar = Math.floor((mx - _state.marginLeft) / cw);
    const barIdx = _state.viewOffset + relBar;

    // D3 near-miss tooltip
    const nm = _state._nearMissMap && _state._nearMissMap.get(barIdx);
    if (nm && nm.length) {
      // H2: escape every user-controlled field; coerce numerics
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const fnum = (v) => { const n = Number(v); return isFinite(n) ? n : NaN; };
      let html = '<strong>Near Miss</strong><br>';
      for (const n of nm) {
        const measNum = fnum(n.measured);
        const threshNum = fnum(n.threshold);
        const pctNum = fnum(n.pctMiss);
        html += `<span class="tooltip-label">Gate:</span> ${esc(n.gateFailed != null ? n.gateFailed : '?')}<br>`;
        html += `<span class="tooltip-label">Measured:</span> ${isFinite(measNum) ? measNum : '?'}<br>`;
        html += `<span class="tooltip-label">Threshold:</span> ${isFinite(threshNum) ? threshNum : '?'}<br>`;
        html += `<span class="tooltip-label">Miss:</span> ${isFinite(pctNum) ? pctNum.toFixed(1) + '%' : '?'}<br>`;
      }
      _showTooltip(e, html);
      return;
    }

    _hideTooltip();
  }

  function _onMouseLeave() {
    _hideTooltip();
  }

  // ── ResizeObserver — M3: guard against double-init ──
  let _resizeObserver = null;
  function _initResize() {
    if (_resizeObserver) return; // already initialized — skip
    if (typeof ResizeObserver !== 'undefined') {
      _resizeObserver = new ResizeObserver(() => _resize());
      _resizeObserver.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', _resize);
    }
  }

  // ── Public API ──

  function load(trace) {
    _state.trace        = trace;
    _state.bars         = trace.bars || [];
    _state.scrubberBar  = 0;
    _state.viewOffset   = 0;
    _state._nearMissMap = null;

    // Show as many bars as possible; cap at 250 for performance
    const maxVisible   = Math.min(250, _state.bars.length);
    _state.barsVisible = Math.min(maxVisible, 120);

    // If bars.length > barsVisible, start from end (most recent)
    if (_state.bars.length > _state.barsVisible) {
      _state.viewOffset = _state.bars.length - _state.barsVisible;
    }

    // Tail-follow: if enabled and bar count grew, auto-advance to last bar
    if (_state.tailFollow && _state.bars.length > 0) {
      _state.scrubberBar = _state.bars.length - 1;
      _state.viewOffset  = Math.max(0, _state.bars.length - _state.barsVisible);
    }

    _resize();
  }

  function setScrubberBar(idx) {
    _state.scrubberBar = idx;
    // Pan view to keep scrubber bar visible
    if (idx < _state.viewOffset) {
      _state.viewOffset = Math.max(0, idx - 5);
    } else if (idx >= _state.viewOffset + _state.barsVisible) {
      _state.viewOffset = Math.max(0, idx - _state.barsVisible + 5);
    }
    _render();
  }

  function getBarCount() {
    return _state.bars.length;
  }

  function resize() {
    _resize();
  }

  /**
   * setTailFollow(bool) — enable or disable tail-follow mode.
   * When true, the next load() call with more bars than before
   * automatically advances scrubberBar to bars.length-1.
   * pattern-trace.js sets this based on user interaction with the scrubber.
   */
  function setTailFollow(enabled) {
    _state.tailFollow = !!enabled;
  }

  /**
   * destroy() — M3: tear down ResizeObserver and mouse listeners.
   * Called from pattern-trace.js beforeunload handler.
   * Does NOT remove the canvas DOM element (viewer owns that).
   */
  function destroy() {
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    } else {
      // Fallback path: remove window listener
      window.removeEventListener('resize', _resize);
    }
    canvas.removeEventListener('mousemove', _onMouseMove);
    canvas.removeEventListener('mouseleave', _onMouseLeave);
  }

  // ── Init ──
  // Extend _state with tail-follow flag (default off; live-scan sets via setTailFollow)
  _state.tailFollow = false;

  _initTooltip();
  _initResize();
  canvas.addEventListener('mousemove', _onMouseMove);
  canvas.addEventListener('mouseleave', _onMouseLeave);
  // Initial blank render
  _resize();

  return { load, setScrubberBar, getBarCount, resize, setTailFollow, destroy };

})();
