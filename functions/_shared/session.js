// [V48-SEC Phase 3] Session token helpers.
//
// Design:
//   - Compact 2-part token: base64url(payload).base64url(sig)
//     payload = JSON { sid, iat, exp }   (sid = session UUID, ms epoch)
//   - Signed with master secret (CHEESESTOCK_HMAC_SECRET); PREV key also
//     accepted for grace-window rotation.
//   - 15-minute default lifetime. Client refreshes 1 minute before expiry.
//   - Per-session ephemeral HMAC secret is derived, NOT stored. Given
//     sessionId + master, the server can re-derive on demand. This means no
//     KV read on every request — cheaper and more resilient.
//
// Ephemeral secret derivation:
//   secret = base64(HMAC-SHA256(masterSecret, sessionId))
//   Returned to client as `secret` field in /api/session response.
//   Client signs every subsequent request with this derived secret.
//
// IMPORTANT: for Phase 3 verifyHmacPost/verifyHmacGet currently validates
// against the MASTER secret directly (simpler implementation). A future
// Phase 3.1 refinement can switch to per-session secret validation once
// sessionId is threaded from the Authorization header into hmac.js. For
// now, the session token provides the session binding, and HMAC provides
// request authenticity — both enforced in parallel.

import { signPayload } from './hmac.js';

const DEFAULT_LIFETIME_MS = 15 * 60 * 1000;  // 15 minutes

// ---- base64url helpers ------------------------------------------------------

function _b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try { return atob(s); } catch (_) { return null; }
}

// ---- Ephemeral secret -------------------------------------------------------

/**
 * Derive a per-session HMAC secret from master secret + session id.
 * Output is base64 string suitable for use as the client's signing key.
 */
export async function deriveSessionSecret(sessionId, masterSecret) {
  if (!sessionId || !masterSecret) {
    throw new Error('deriveSessionSecret: sessionId and masterSecret required');
  }
  return signPayload('session:' + sessionId, masterSecret);
}

// ---- Token sign / verify ----------------------------------------------------

/**
 * Sign a session token.
 *   payload = { sid, iat, exp }
 *   token   = base64url(JSON.stringify(payload)) + "." + base64url(sig)
 * sig is the raw base64 HMAC of the encoded payload segment.
 */
export async function signSessionToken(payload, masterSecret) {
  const body = JSON.stringify(payload);
  const bodyB64 = _b64urlEncode(body);
  const sig = await signPayload(bodyB64, masterSecret);
  return bodyB64 + '.' + _b64urlEncode(sig);
}

/**
 * Verify a session token from Authorization: Bearer <token> header.
 * Returns { ok, sessionId, reason } where reason is:
 *   'missing'   - no Authorization header or not Bearer
 *   'malformed' - token doesn't split into 2 parts or payload isn't JSON
 *   'invalid'   - signature mismatch (both CURRENT and PREV keys tried)
 *   'expired'   - exp < now
 */
export async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, sessionId: null, reason: 'missing' };
  const token = auth.slice(7).trim();

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, sessionId: null, reason: 'malformed' };
  const [bodyB64, sigB64] = parts;

  const bodyJson = _b64urlDecode(bodyB64);
  if (!bodyJson) return { ok: false, sessionId: null, reason: 'malformed' };

  let payload;
  try { payload = JSON.parse(bodyJson); }
  catch (_) { return { ok: false, sessionId: null, reason: 'malformed' }; }

  if (!payload || typeof payload.sid !== 'string' || typeof payload.exp !== 'number') {
    return { ok: false, sessionId: null, reason: 'malformed' };
  }

  const providedSigRaw = _b64urlDecode(sigB64);
  if (providedSigRaw == null) return { ok: false, sessionId: null, reason: 'malformed' };

  // Recompute expected sig with CURRENT and PREV master secrets.
  const secretNow = env && env.CHEESESTOCK_HMAC_SECRET;
  const secretPrev = env && env.CHEESESTOCK_HMAC_SECRET_PREV;
  if (!secretNow && !secretPrev) {
    // No secrets configured — treat as invalid rather than silently pass.
    return { ok: false, sessionId: null, reason: 'invalid' };
  }

  let matched = false;
  if (secretNow) {
    const expected = await signPayload(bodyB64, secretNow);
    if (expected === providedSigRaw) matched = true;
  }
  if (!matched && secretPrev) {
    const expected = await signPayload(bodyB64, secretPrev);
    if (expected === providedSigRaw) matched = true;
  }
  if (!matched) return { ok: false, sessionId: null, reason: 'invalid' };

  if (Date.now() >= payload.exp) {
    return { ok: false, sessionId: payload.sid, reason: 'expired' };
  }

  return { ok: true, sessionId: payload.sid, reason: null, payload };
}

/**
 * Mint a fresh session: sid + derived secret + signed token + expiry.
 * Called by functions/api/session.js.
 */
export async function mintSession(env, lifetimeMs) {
  const masterSecret = env && env.CHEESESTOCK_HMAC_SECRET;
  if (!masterSecret) throw new Error('mintSession: CHEESESTOCK_HMAC_SECRET missing');

  const sid = (typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : _fallbackUuid();
  const now = Date.now();
  const exp = now + (lifetimeMs || DEFAULT_LIFETIME_MS);
  const payload = { sid, iat: now, exp };
  const token = await signSessionToken(payload, masterSecret);
  const secret = await deriveSessionSecret(sid, masterSecret);
  return { sessionId: sid, token, secret, expiresAt: exp, issuedAt: now };
}

function _fallbackUuid() {
  // Workers always expose crypto.randomUUID — this is just belt-and-braces.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16)
    + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

/**
 * Standardised 401 for token failures.
 */
export function tokenFailResponse(reason, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  const code = (reason === 'expired') ? 'token_expired' : ('token_' + (reason || 'invalid'));
  return new Response(JSON.stringify({ error: code }), { status: 401, headers });
}
