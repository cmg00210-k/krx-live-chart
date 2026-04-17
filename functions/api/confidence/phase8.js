// V48-Phase2 — /api/confidence/phase8
// Server-side port of js/appWorker.js:_applyPhase8ConfidenceToPatterns().
// Loads flow_signals.json + eva_scores.json + hmm_regimes.json from _data/
// (Phase 1 protected) and applies MCS / HMM regime / foreign-flow / IV adjustments.
//
// Request:  { patterns: [...], context: { code, volRegime, macroComposite,
//             optionsAnalytics, krxGroupDown, staleSources[], appliedFactors[] } }
// Response: { patterns: [...adjusted], appliedFactors: [...] }

import flowSignals from '../../_data/flow_signals.json' with { type: 'json' };
// hmm_regimes / eva_scores currently unused server-side beyond the embedded
// HMM regime label inside flow_signals.stocks[code].hmmRegimeLabel. Loading
// them anyway primes the bundle so future Phase 8 expansions can reference
// without an extra import round.
import { guardRequest, jsonResponse, forbiddenResponse } from '../../_shared/origin.js';
import { REGIME_CONFIDENCE_MULT, MCS_THRESHOLDS, getDynamicCap, clamp } from '../../_lib/macro_tables.mjs';

function adjustPatterns(patterns, ctx) {
  if (!patterns || patterns.length === 0) return { patterns, appliedFactors: ctx.appliedFactors || [] };

  const applied = new Set(ctx.appliedFactors || []);
  const stale = new Set(ctx.staleSources || []);
  const krxDown = !!ctx.krxGroupDown;
  const code = ctx.code || null;
  const volRegime = ctx.volRegime || 'mid';
  const composite = ctx.macroComposite || null;
  const oa = (ctx.optionsAnalytics && ctx.optionsAnalytics.analytics) || null;

  const out = patterns.map((p) => ({ ...p }));

  // MCS adjustment (mcsV2 from macro_composite)
  if (!applied.has('MACRO_COMPOSITE') && composite && composite.mcsV2 != null) {
    let mcs = composite.mcsV2;
    if (mcs > 0 && mcs <= 1.0) mcs = mcs * 100;
    for (const p of out) {
      if (p.confidence == null) continue;
      if (mcs >= MCS_THRESHOLDS.strong_bull && p.signal === 'buy') p.confidence *= 1.05;
      else if (mcs <= MCS_THRESHOLDS.strong_bear && p.signal === 'sell') p.confidence *= 1.05;
    }
    applied.add('MACRO_COMPOSITE');
  }

  // HMM regime + foreign flow (uses server-side flow_signals.json)
  if (code && !krxDown && flowSignals && !stale.has('flow_signals') &&
      flowSignals.flowDataCount > 0 && flowSignals.stocks && flowSignals.stocks[code]) {
    const flow = flowSignals.stocks[code];
    const regime = flow.hmmRegimeLabel || null;
    const mult = REGIME_CONFIDENCE_MULT[regime] || REGIME_CONFIDENCE_MULT[null];
    const hasFlowData = flow.foreignMomentum != null || flow.retailContrarian != null ||
                        flow.institutionalAlignment != null;
    const applyHMM = !applied.has('REGIME_HMM');
    const applyForeign = hasFlowData && !applied.has('FLOW_FOREIGN');
    for (const p of out) {
      if (p.confidence == null) continue;
      if (applyHMM) {
        const dir = p.signal === 'buy' ? 'buy' : 'sell';
        p.confidence *= mult[dir];
      }
      if (applyForeign) {
        if (flow.foreignMomentum === 'buy' && p.signal === 'buy') p.confidence *= 1.03;
        else if (flow.foreignMomentum === 'sell' && p.signal === 'sell') p.confidence *= 1.03;
      }
    }
    if (applyHMM) applied.add('REGIME_HMM');
    if (applyForeign) applied.add('FLOW_FOREIGN');
  }

  // Options IV/HV adjustment
  if (!applied.has('FLOW_OPTIONS') && !krxDown && !stale.has('options_analytics') && oa) {
    let ivHvFired = false;
    let optionsApplied = false;
    if (oa.atmIV != null && oa.historicalVol != null && oa.historicalVol > 0) {
      const ratio = oa.atmIV / oa.historicalVol;
      if (ratio > 1.5) {
        ivHvFired = true; optionsApplied = true;
        const disc = ratio > 2.0 ? 0.90 : 0.93;
        for (const p of out) {
          if (p.confidence == null) continue;
          p.confidence *= disc;
        }
      }
    }
    if (!ivHvFired && oa.straddleImpliedMove != null && oa.straddleImpliedMove > 3.5) {
      optionsApplied = true;
      for (const p of out) {
        if (p.confidence == null) continue;
        p.confidence *= 0.93;
      }
    }
    if (optionsApplied) applied.add('FLOW_OPTIONS');
  }

  // Terminal clamp (matches client _capConf/_capPred)
  const capConf = getDynamicCap('confidence', volRegime);
  const capPred = getDynamicCap('confidencePred', volRegime);
  for (const p of out) {
    if (p.confidence != null) {
      p.confidence = clamp(p.confidence, capConf[0], capConf[1]);
    }
    if (p.confidencePred != null) {
      p.confidencePred = clamp(p.confidencePred, capPred[0], capPred[1]);
    }
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
