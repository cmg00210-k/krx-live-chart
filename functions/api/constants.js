// /api/constants -> serves data/backtest/calibrated_constants.json
// Distilled IP: Theil-Sen calibrated constants from offline backtest.
// [V48-SEC Phase 3] HMAC + session token + rate limit (via guardGet).
import data from '../_data/calibrated_constants.json' with { type: 'json' };
import { jsonResponse } from '../_shared/origin.js';
import { guardGet, preflightResponse } from '../_shared/guard.js';

export async function onRequestGet({ request, env }) {
  const g = await guardGet(request, env, 'light_get');
  if (!g.ok) return g.response;
  return jsonResponse(data, g.origin, { 'Cache-Control': 'no-store' });
}

export async function onRequestOptions({ request }) {
  return preflightResponse(request, 'GET, OPTIONS');
}
