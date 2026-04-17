// V48-Phase2 — /api/backtest/analyze
// Server-side per-pattern N-bar return statistics + KRX cost-calibration.
// Hides the calibrated cost constants (KRX_COMMISSION/TAX/SLIPPAGE) and the
// fixed-vs-variable cost split formula (Kyle 1985 sqrt-h scaling). The
// client supplies pre-detected pattern occurrences and price candles; the
// server returns per-(type, horizon) summary stats (n, winrate, avgReturn,
// stdReturn, expectancy, sharpe, profitFactor).
//
// Statistical post-processing that is more expensive (Hansen SPA, BH-FDR,
// Walk-Forward) remains client-side and consumes these stats.
//
// Request:  { candles: [{open,high,low,close}], occurrences: [{type,signal,barIndex}],
//             horizons: [1,3,5,10,20], segment: 'kospi_large'|... }
// Response: { stats: { [type]: { signal, horizons: { [h]: {n,winrate,avgReturn,
//             stdReturn,expectancy,sharpe,profitFactor,cost} } } } }

import calibrated from '../../_data/calibrated_constants.json' with { type: 'json' };
import { guardRequest, jsonResponse, forbiddenResponse } from '../../_shared/origin.js';

// IP-protected fallback constants (used when calibrated_constants.json is incomplete).
// These match js/backtester.js:KRX_COMMISSION/TAX/SLIPPAGE but are now server-only.
const FALLBACK_COSTS = {
  commission: 0.03,
  tax: 0.18,
  slippage: 0.10,
};

// Segment-based slippage map — matches js/backtester.js:_getAdaptiveSlippage().
const SEGMENT_SLIPPAGE = {
  kospi_large: 0.04,
  kospi_mid:   0.10,
  kosdaq_large: 0.15,
  kosdaq_small: 0.25,
};

function pickCosts() {
  const c = calibrated && calibrated.costs ? calibrated.costs : null;
  return {
    commission: (c && c.commission != null) ? c.commission : FALLBACK_COSTS.commission,
    tax:        (c && c.tax        != null) ? c.tax        : FALLBACK_COSTS.tax,
    slippage:   (c && c.slippage   != null) ? c.slippage   : FALLBACK_COSTS.slippage,
  };
}

// Per-horizon transaction cost (Kyle 1985 sqrt-h variable, hyperbolic fixed).
function horizonCost(h, costs, segmentSlippage) {
  const hSafe = Math.max(1, h);
  const slippage = segmentSlippage != null ? segmentSlippage : costs.slippage;
  const fixed = (costs.commission + costs.tax) / hSafe;
  const variable = slippage / Math.sqrt(hSafe);
  return fixed + variable;
}

function pctReturn(entryClose, exitClose, signal) {
  if (entryClose == null || exitClose == null || entryClose <= 0) return null;
  const raw = (exitClose - entryClose) / entryClose * 100;
  return signal === 'sell' ? -raw : raw;
}

function summarize(returns, costPct) {
  const n = returns.length;
  if (n === 0) {
    return { n: 0, winrate: null, avgReturn: null, stdReturn: null,
             expectancy: null, sharpe: null, profitFactor: null, cost: costPct };
  }
  let sum = 0, sumSq = 0, wins = 0, grossWin = 0, grossLoss = 0;
  for (const r of returns) {
    const net = r - costPct;
    sum += net;
    sumSq += net * net;
    if (net > 0) { wins++; grossWin += net; }
    else if (net < 0) { grossLoss += -net; }
  }
  const avg = sum / n;
  const variance = Math.max(0, (sumSq / n) - (avg * avg));
  const std = Math.sqrt(variance);
  const winrate = (wins / n) * 100;
  const sharpe = std > 0 ? avg / std : null;
  const pf = grossLoss > 0 ? grossWin / grossLoss : null;
  return {
    n,
    winrate: +winrate.toFixed(2),
    avgReturn: +avg.toFixed(4),
    stdReturn: +std.toFixed(4),
    expectancy: +avg.toFixed(4),
    sharpe: sharpe != null ? +sharpe.toFixed(4) : null,
    profitFactor: pf != null ? +pf.toFixed(3) : null,
    cost: +costPct.toFixed(4),
  };
}

function computeStats({ candles, occurrences, horizons, segment }) {
  if (!Array.isArray(candles) || candles.length < 30) return {};
  if (!Array.isArray(occurrences) || occurrences.length === 0) return {};
  const hList = Array.isArray(horizons) && horizons.length > 0 ? horizons : [1, 3, 5, 10, 20];
  const costs = pickCosts();
  const segSlippage = (segment && SEGMENT_SLIPPAGE[segment] != null)
    ? SEGMENT_SLIPPAGE[segment] : null;

  // Group occurrences by type
  const byType = {};
  for (const occ of occurrences) {
    if (!occ || typeof occ.type !== 'string') continue;
    const idx = occ.barIndex;
    if (!Number.isInteger(idx) || idx < 0 || idx >= candles.length) continue;
    const sig = (occ.signal === 'buy' || occ.signal === 'sell') ? occ.signal : null;
    if (!sig) continue;
    if (!byType[occ.type]) byType[occ.type] = { signal: sig, occurrences: [] };
    byType[occ.type].occurrences.push(idx);
  }

  const stats = {};
  for (const type of Object.keys(byType)) {
    const { signal, occurrences: occIdx } = byType[type];
    const horizonsOut = {};
    for (const h of hList) {
      const cost = horizonCost(h, costs, segSlippage) * 100; // back to %
      const returns = [];
      for (const idx of occIdx) {
        if (idx + h >= candles.length) continue;
        const entry = candles[idx];
        const exit = candles[idx + h];
        if (!entry || !exit) continue;
        const r = pctReturn(entry.close, exit.close, signal);
        if (r != null && Number.isFinite(r)) returns.push(r);
      }
      horizonsOut[h] = summarize(returns, cost);
    }
    stats[type] = { signal, horizons: horizonsOut };
  }
  return stats;
}

export async function onRequestPost({ request }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();
  let body;
  try { body = await request.json(); }
  catch (_) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  // Truncate excessive candle payloads (client-side cap is 500; mirror server-side guard).
  let candles = Array.isArray(body && body.candles) ? body.candles : [];
  if (candles.length > 600) candles = candles.slice(-600);

  const stats = computeStats({
    candles,
    occurrences: (body && body.occurrences) || [],
    horizons: (body && body.horizons) || [1, 3, 5, 10, 20],
    segment: (body && body.segment) || null,
  });
  return jsonResponse({ stats }, guard.origin, { 'Cache-Control': 'no-store' });
}

export async function onRequestOptions({ request }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': guard.origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
