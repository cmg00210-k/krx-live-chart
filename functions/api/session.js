// [V48-SEC Phase 3] POST /api/session — issue a short-lived session token.
//
// This endpoint bootstraps the HMAC-signed request chain. It is the only
// /api/* endpoint that does NOT require HMAC verification (chicken-and-egg:
// the client has no secret until this response lands). It IS origin-gated
// and IP-rate-limited.
//
// Request : POST /api/session   (body can be empty or {} — future versions
//                                 may accept a client nonce for binding)
// Response: {
//   sessionId  : string  (UUID v4)
//   token      : string  "b64url(payload).b64url(sig)"
//   secret     : string  base64 HMAC-SHA256 ephemeral key (per-session)
//   expiresAt  : number  ms epoch of expiry (iat + 15 min)
//   issuedAt   : number  ms epoch of mint
//   serverTime : number  ms epoch NOW — client can compute clock skew
// }
//
// IP rate limit: 10/min/IP (see rate_limit.js LIMITS.session_init). Automated
// mass-minting is blocked; normal users mint once per ~15 minutes.

import { guardRequest, forbiddenResponse } from '../_shared/origin.js';
import { mintSession } from '../_shared/session.js';
import {
  checkRateLimit, rateLimitFailResponse, clientIp, LIMITS,
} from '../_shared/rate_limit.js';

export async function onRequestPost({ request, env }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();

  // IP rate limit BEFORE secret work (cheap check first).
  const ip = clientIp(request);
  const rl = await checkRateLimit(
    env,
    'rl:ip:session:' + ip,
    LIMITS.session_init.maxIp,
    LIMITS.session_init.window,
  );
  if (!rl.allowed) return rateLimitFailResponse(rl.retryAfter, guard.origin);

  if (!env || !env.CHEESESTOCK_HMAC_SECRET) {
    // Dev hole: secret not bound. Fail closed to avoid accidental prod gap.
    return new Response(
      JSON.stringify({ error: 'session_disabled' }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': guard.origin,
          'Vary': 'Origin',
        },
      },
    );
  }

  let session;
  try {
    session = await mintSession(env);
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'session_mint_failed' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': guard.origin,
          'Vary': 'Origin',
        },
      },
    );
  }

  const body = {
    sessionId: session.sessionId,
    token: session.token,
    secret: session.secret,
    expiresAt: session.expiresAt,
    issuedAt: session.issuedAt,
    serverTime: Date.now(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': guard.origin,
      'Access-Control-Allow-Credentials': 'false',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
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
