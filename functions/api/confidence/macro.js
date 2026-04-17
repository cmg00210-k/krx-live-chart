// V48-Phase2 — /api/confidence/macro
// Server-side port of js/appWorker.js:_applyMacroConfidenceToPatterns().
// Moves macro-driven confidence scaling off the client to obscure threshold/weight IP.
//
// Request:  { patterns: [...], context: { industry, volRegime, macro, bonds, kosis,
//             macroComposite, appliedFactors[] } }
// Response: { patterns: [...adjusted], appliedFactors: [...] }
//
// Adjusted patterns retain all original fields; confidence (and confidencePred if present)
// is replaced. p.confidence is rounded to int and clamped per ATR vol regime.

import { guardRequest, jsonResponse, forbiddenResponse } from '../../_shared/origin.js';
import {
  STOVALL_CYCLE, RATE_BETA, getStovallSector, getDynamicCap, clamp,
} from '../../_lib/macro_tables.mjs';

function adjustPatterns(patterns, ctx) {
  const macro = ctx.macro || null;
  const bonds = ctx.bonds || null;
  const kosis = ctx.kosis || null;
  const composite = ctx.macroComposite || null;
  if (!macro && !bonds) return { patterns, appliedFactors: ctx.appliedFactors || [] };

  const applied = new Set(ctx.appliedFactors || []);
  const volRegime = ctx.volRegime || 'mid';
  const industry = ctx.industry || null;
  const sector = getStovallSector(industry);

  const cp = macro && macro.cycle_phase;
  const phase = cp ? cp.phase : null;
  const cliDelta = cp ? cp.delta : null;
  const slope = bonds ? bonds.slope_10y3y : (macro ? macro.term_spread : null);
  const inverted = bonds ? bonds.curve_inverted : false;
  const aaSpread = bonds && bonds.credit_spreads ? bonds.credit_spreads.aa_spread : null;
  const creditRegime = bonds ? bonds.credit_regime : null;
  const fSignal = macro ? macro.foreigner_signal : null;
  const taylorGap = (composite && composite.taylorGap != null)
    ? composite.taylorGap
    : (macro ? macro.taylor_gap : null);

  const out = [];
  for (const orig of patterns) {
    const p = { ...orig };
    const isBuy = (p.signal === 'buy');
    let adj = 1.0;

    // 1. Stovall cycle (sector-aware)
    if (phase) {
      const sectorCycle = sector ? STOVALL_CYCLE[sector] : null;
      if (sectorCycle && sectorCycle[phase] != null) {
        const buyMult = sectorCycle[phase];
        const dampened = 1.0 + (buyMult - 1.0) * 0.5;
        adj *= isBuy ? dampened : (2.0 - dampened);
      } else {
        if (phase === 'expansion')        adj *= isBuy ? 1.06 : 0.94;
        else if (phase === 'peak')        adj *= isBuy ? 0.95 : 1.08;
        else if (phase === 'contraction') adj *= isBuy ? 0.92 : 1.08;
        else if (phase === 'trough')      adj *= isBuy ? 1.10 : 0.90;
      }
    }

    // 2. Yield curve regime
    if (slope != null) {
      if (inverted || slope < 0) {
        adj *= isBuy ? 0.88 : 1.12;
      } else if (taylorGap != null) {
        const isBull = taylorGap < 0;
        const isSteep = slope > 0.20;
        if (isBull && isSteep)        adj *= isBuy ? 1.06 : 0.95;
        else if (isBull && !isSteep)  adj *= isBuy ? 0.97 : 1.03;
        else if (!isBull && isSteep)  adj *= isBuy ? 0.95 : 1.04;
        else                          adj *= isBuy ? 0.90 : 1.10;
      } else {
        if (slope < 0.15)      adj *= isBuy ? 0.96 : 1.04;
        else if (slope > 0.5)  adj *= isBuy ? 1.04 : 0.97;
      }
    }

    // 3. Credit regime (factor guard: skip if RISK_CREDIT applied)
    if (aaSpread != null && !applied.has('RISK_CREDIT')) {
      if (aaSpread > 1.5 || creditRegime === 'stress') {
        adj *= isBuy ? 0.82 : 1.06;
      } else if (aaSpread > 1.0 || creditRegime === 'elevated') {
        adj *= isBuy ? 0.93 : 1.04;
      }
    }

    // 4. Foreigner signal
    if (fSignal != null) {
      if (fSignal > 0.3)       adj *= isBuy ? 1.05 : 0.96;
      else if (fSignal < -0.3) adj *= isBuy ? 0.95 : 1.05;
    }

    // 5. Pattern-specific overrides
    const pType = p.type || p.pattern || '';
    if (pType === 'doubleTop' && !isBuy) {
      if ((phase === 'contraction' || phase === 'peak') && (inverted || (slope != null && slope < 0.15))) {
        adj *= 1.10;
      }
    }
    if (pType === 'doubleBottom' && isBuy) {
      if (phase === 'trough' && slope != null && slope > 0.3) adj *= 1.12;
    }
    if (pType === 'bearishEngulfing' && !isBuy && cliDelta != null && cliDelta < -0.1) {
      adj *= 1.06;
    }
    if (pType === 'hammer' && isBuy) {
      if (phase === 'trough' || phase === 'contraction') adj *= 1.06;
      else if (phase === 'expansion' || phase === 'peak') adj *= 0.96;
    }
    if (pType === 'invertedHammer' && isBuy) {
      if (phase === 'trough' || phase === 'contraction') adj *= 1.05;
      else if (phase === 'expansion' || phase === 'peak') adj *= 0.97;
    }

    // 6. MCS fallback (when mcsV2 not yet applied)
    const mcs = macro ? macro.mcs : null;
    const mcsV2Available = composite && composite.mcsV2 != null;
    if (mcs != null && !mcsV2Available && !applied.has('MACRO_COMPOSITE')) {
      if (mcs > 0.6) {
        const a = 1.0 + (mcs - 0.6) * 0.25;
        adj *= isBuy ? a : (2.0 - a);
      } else if (mcs < 0.4) {
        const a = 1.0 + (0.4 - mcs) * 0.25;
        adj *= isBuy ? (2.0 - a) : a;
      }
    }

    // 7. Taylor rule gap
    if (taylorGap != null && !applied.has('MACRO_TAYLOR_GAP')) {
      const tgNorm = clamp(taylorGap / 2, -1, 1);
      if (tgNorm < -0.25) {
        const t = 1.0 + Math.abs(tgNorm) * 0.05;
        adj *= isBuy ? t : (2.0 - t);
      } else if (tgNorm > 0.25) {
        const t = 1.0 + Math.abs(tgNorm) * 0.05;
        adj *= isBuy ? (2.0 - t) : t;
      }
    }

    // 8. VIX / VRP
    const vix = macro ? macro.vix : null;
    if (vix != null && !applied.has('RISK_VOL_EQUITY')) {
      if (vix > 30)       adj *= 0.93;
      else if (vix > 25)  adj *= isBuy ? 0.97 : 1.02;
      else if (vix < 15)  adj *= isBuy ? 1.03 : 0.98;
    }

    // 9. KR-US rate differential
    const rateDiff = macro ? macro.rate_diff : null;
    if (rateDiff != null) {
      if (rateDiff < -1.5)       adj *= isBuy ? 0.95 : 1.04;
      else if (rateDiff < -0.5)  adj *= isBuy ? 0.98 : 1.02;
      else if (rateDiff > 1.0)   adj *= isBuy ? 1.03 : 0.98;
    }

    // 10. Rate beta x rate direction
    if (taylorGap != null && sector) {
      const rBeta = RATE_BETA[sector];
      if (rBeta != null && rBeta !== 0) {
        const rateDir = clamp(taylorGap / 2, -1, 1);
        const ktb10y = macro ? macro.ktb10y : null;
        const levelAmp = (ktb10y != null && ktb10y > 4.0) ? 1.5 : 1.0;
        const rateAdj = rateDir * rBeta * levelAmp;
        adj *= isBuy ? (1.0 + rateAdj) : (1.0 - rateAdj);
      }
    }

    // 11. KOSIS CLI/CCI gap
    if (kosis && kosis.cli_cci_gap != null) {
      const gap = kosis.cli_cci_gap;
      if (gap > 5)       adj *= isBuy ? 1.04 : 0.97;
      else if (gap < -5) adj *= isBuy ? 0.97 : 1.04;
    }

    const capMult = getDynamicCap('macroMult', volRegime);
    const capConf = getDynamicCap('confidence', volRegime);
    const capPred = getDynamicCap('confidencePred', volRegime);
    adj = clamp(adj, capMult[0], capMult[1]);

    if (adj !== 1.0 && p.confidence != null) {
      p.confidence = clamp(Math.round(p.confidence * adj), capConf[0], capConf[1]);
      if (p.confidencePred != null) {
        p.confidencePred = clamp(Math.round(p.confidencePred * adj), capPred[0], capPred[1]);
      }
    }
    out.push(p);
  }
  return { patterns: out, appliedFactors: Array.from(applied) };
}

export async function onRequestPost({ request }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();
  let body;
  try { body = await request.json(); }
  catch (_) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
  const patterns = Array.isArray(body && body.patterns) ? body.patterns : [];
  const ctx = (body && body.context) || {};
  const result = adjustPatterns(patterns, ctx);
  return jsonResponse(result, guard.origin, { 'Cache-Control': 'no-store' });
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
