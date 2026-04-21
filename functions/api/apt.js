// /api/apt -> serves data/backtest/mra_apt_coefficients.json
// Distilled IP: 17-col Ridge coefficients (lambda=2.0, horizon=5d, n=237977) for APT 5-factor model.
// [V48-SEC Phase 7 P7-001] HMAC + session token + rate limit (via guardGet).
// Activation of APT 5-factor on the client would make inference-chain reverse trivial
// if the raw coefficients remained publicly accessible; this endpoint gates them.
import data from '../_data/mra_apt_coefficients.json' with { type: 'json' };
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
