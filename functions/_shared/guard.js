// [V48-SEC Phase 3] Unified request guard composing 4 layers:
//   1. Origin  (existing Phase 1 gate)
//   2. HMAC    (verify request signature + timestamp skew + nonce replay)
//   3. Token   (Authorization: Bearer <session token>)
//   4. Rate limit (IP + session, KV sliding window)
//
// A single call per endpoint keeps the flow visible:
//
//   export async function onRequestPost({ request, env }) {
//     const g = await guardPost(request, env, 'heavy_post');
//     if (!g.ok) return g.response;
//     const body = JSON.parse(g.body || '{}');
//     // ... business logic
//     return jsonResponse(result, g.origin, { 'Cache-Control': 'no-store' });
//   }
//
// limitClass selects the rate-limit bucket (see rate_limit.js LIMITS):
//   'heavy_post' : confidence macro/phase8, backtest analyze
//   'light_get'  : constants, flow, hmm, eva

import { guardRequest, forbiddenResponse } from './origin.js';
import { verifyHmacPost, verifyHmacGet, hmacFailResponse } from './hmac.js';
import { verifyToken, tokenFailResponse } from './session.js';
import {
  combineChecks, rateLimitFailResponse, clientIp, LIMITS,
} from './rate_limit.js';

function _resolveLimit(limitClass) {
  return LIMITS[limitClass] || LIMITS.heavy_post;
}

async function _rateLimitAll(request, env, origin, sessionId, limitClass) {
  const lim = _resolveLimit(limitClass);
  const ip = clientIp(request);
  const specs = [{
    name: 'ip',
    key: 'rl:ip:' + limitClass + ':' + ip,
    max: lim.maxIp,
    window: lim.window,
  }];
  if (lim.maxSession && sessionId) {
    specs.push({
      name: 'sess',
      key: 'rl:sess:' + limitClass + ':' + sessionId,
      max: lim.maxSession,
      window: lim.window,
    });
  }
  const rl = await combineChecks(env, specs);
  if (!rl.allowed) {
    return { ok: false, response: rateLimitFailResponse(rl.retryAfter, origin) };
  }
  return { ok: true };
}

/**
 * Full guard for POST endpoints. Returns on success:
 *   { ok: true, origin, body, sessionId }
 * Returns on failure:
 *   { ok: false, response }  -- caller should `return g.response;`
 */
export async function guardPost(request, env, limitClass) {
  const g = guardRequest(request);
  if (!g.ok) return { ok: false, response: forbiddenResponse() };

  const h = await verifyHmacPost(request, env);
  if (!h.ok) return { ok: false, response: hmacFailResponse(h.reason, g.origin) };

  const t = await verifyToken(request, env);
  if (!t.ok) return { ok: false, response: tokenFailResponse(t.reason, g.origin) };

  const rl = await _rateLimitAll(request, env, g.origin, t.sessionId, limitClass || 'heavy_post');
  if (!rl.ok) return rl;

  return { ok: true, origin: g.origin, body: h.body, sessionId: t.sessionId };
}

/**
 * Full guard for GET endpoints.
 * Returns { ok: true, origin, sessionId } on success.
 */
export async function guardGet(request, env, limitClass) {
  const g = guardRequest(request);
  if (!g.ok) return { ok: false, response: forbiddenResponse() };

  const h = await verifyHmacGet(request, env);
  if (!h.ok) return { ok: false, response: hmacFailResponse(h.reason, g.origin) };

  const t = await verifyToken(request, env);
  if (!t.ok) return { ok: false, response: tokenFailResponse(t.reason, g.origin) };

  const rl = await _rateLimitAll(request, env, g.origin, t.sessionId, limitClass || 'light_get');
  if (!rl.ok) return rl;

  return { ok: true, origin: g.origin, sessionId: t.sessionId };
}

/**
 * OPTIONS preflight — origin-gated only. HMAC / token are not sent on preflight.
 * `methods` should be "GET, OPTIONS" or "POST, OPTIONS" per endpoint.
 */
export function preflightResponse(request, methods) {
  const g = guardRequest(request);
  if (!g.ok) return forbiddenResponse();
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': g.origin,
      'Access-Control-Allow-Methods': methods || 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CheeseStock-Signature, X-CheeseStock-Timestamp',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
