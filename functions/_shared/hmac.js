// [V48-SEC Phase 3] Shared HMAC verification utility for Pages Functions.
//
// Design:
//   - HMAC-SHA256 via Web Crypto API (SubtleCrypto) — Workers-compatible.
//   - Dual-key support (CURRENT + PREV) for zero-downtime 90-day rotation.
//     Both env.CHEESESTOCK_HMAC_SECRET (current) and
//     env.CHEESESTOCK_HMAC_SECRET_PREV (grace window) are tried in order.
//   - Timestamp skew window: +/- 300 seconds (5 minutes).
//   - Nonce replay defense: each signature is recorded once in RATE_LIMIT_KV
//     with TTL = skew window. Duplicate signatures within window -> 'replay'.
//   - Body is read once (Workers limitation) and returned in result so the
//     caller can re-parse JSON.parse(hmacResult.body) without consuming the
//     stream twice.
//
// Request headers the client must set:
//   X-CheeseStock-Timestamp  : millisecond epoch, string
//   X-CheeseStock-Signature  : base64(HMAC-SHA256(`${ts}.${payload}`, secret))
//   Authorization            : Bearer <session-token>   (checked elsewhere)
//
// Payload that signs:
//   POST: `${ts}.${bodyText}`          (body as raw text, pre-JSON.parse)
//   GET : `${ts}.${pathname}${search}` (URL path + query)
//
// Reasons returned on failure (reason field):
//   'missing' - header(s) not present
//   'skew'    - timestamp outside +/- 300s window
//   'invalid' - signature mismatch on both CURRENT and PREV keys
//   'replay'  - nonce already seen within skew window
//   'disabled'- no secret configured in env (dev hole)
//
// Usage:
//   const r = await verifyHmacPost(request, env);
//   if (!r.ok) return hmacFailResponse(r.reason);
//   const body = JSON.parse(r.body || '{}');

const SKEW_MS = 300_000;               // 5 minutes
const NONCE_TTL_SEC = 310;             // slightly longer than skew to avoid race at window edge

// ---- Web Crypto helpers -----------------------------------------------------

async function _importKey(secretStr) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function _signToBase64(key, message) {
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  // base64 encode (Workers has btoa but needs binary string)
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Constant-time string comparison. Both inputs are base64 strings of equal
// expected length; the early-return-on-length-mismatch is fine because the
// correct length is public knowledge (it's fixed by the algorithm).
function _timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Try CURRENT then PREV key; return true if either matches.
async function _verifySignature(message, providedSig, env) {
  const secretNow = env && env.CHEESESTOCK_HMAC_SECRET;
  const secretPrev = env && env.CHEESESTOCK_HMAC_SECRET_PREV;
  if (!secretNow && !secretPrev) return { matched: false, reason: 'disabled' };

  if (secretNow) {
    const k = await _importKey(secretNow);
    const expected = await _signToBase64(k, message);
    if (_timingSafeEqual(providedSig, expected)) return { matched: true, which: 'current' };
  }
  if (secretPrev) {
    const k = await _importKey(secretPrev);
    const expected = await _signToBase64(k, message);
    if (_timingSafeEqual(providedSig, expected)) return { matched: true, which: 'prev' };
  }
  return { matched: false, reason: 'invalid' };
}

// ---- Nonce replay defense ---------------------------------------------------

// We reuse RATE_LIMIT_KV for nonce storage. Each signature is unique per
// (timestamp, body) so a cached key means replay. TTL is set to the skew
// window + small margin so expired nonces auto-clean.
async function _checkAndStoreNonce(sig, env) {
  const kv = env && env.RATE_LIMIT_KV;
  if (!kv) return { ok: true, skipped: true };  // KV not bound in dev — soft pass
  const key = 'nonce:' + sig;
  try {
    const existing = await kv.get(key);
    if (existing) return { ok: false, replay: true };
    // Put (non-blocking). We don't await to reduce latency; the window is
    // long enough that the next request from the same signer will still see
    // the record by the time the put propagates.
    await kv.put(key, '1', { expirationTtl: NONCE_TTL_SEC });
    return { ok: true };
  } catch (_) {
    // KV failure should not hard-fail a legitimate request. Log-and-allow.
    return { ok: true, kvError: true };
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * Verify HMAC signature on a POST request.
 * Returns { ok, reason, body, which } where body is the raw request body text
 * (caller should JSON.parse it). which indicates which key matched ('current'
 * or 'prev') — useful for logging rotation grace-window usage.
 */
export async function verifyHmacPost(request, env) {
  const sig = request.headers.get('X-CheeseStock-Signature') || '';
  const ts = request.headers.get('X-CheeseStock-Timestamp') || '';
  if (!sig || !ts) return { ok: false, reason: 'missing', body: '' };

  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > SKEW_MS) {
    return { ok: false, reason: 'skew', body: '' };
  }

  // Read body ONCE. Workers consume Request body on first read.
  let body = '';
  try { body = await request.text(); } catch (_) { body = ''; }

  const verdict = await _verifySignature(ts + '.' + body, sig, env);
  if (!verdict.matched) {
    return { ok: false, reason: verdict.reason || 'invalid', body };
  }

  const nonceR = await _checkAndStoreNonce(sig, env);
  if (!nonceR.ok && nonceR.replay) {
    return { ok: false, reason: 'replay', body };
  }

  return { ok: true, reason: null, body, which: verdict.which };
}

/**
 * Verify HMAC signature on a GET request. Payload is `${ts}.${pathname}${search}`.
 * No body to return (GET).
 */
export async function verifyHmacGet(request, env) {
  const sig = request.headers.get('X-CheeseStock-Signature') || '';
  const ts = request.headers.get('X-CheeseStock-Timestamp') || '';
  if (!sig || !ts) return { ok: false, reason: 'missing' };

  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > SKEW_MS) {
    return { ok: false, reason: 'skew' };
  }

  const url = new URL(request.url);
  const payload = ts + '.' + url.pathname + url.search;

  const verdict = await _verifySignature(payload, sig, env);
  if (!verdict.matched) {
    return { ok: false, reason: verdict.reason || 'invalid' };
  }

  const nonceR = await _checkAndStoreNonce(sig, env);
  if (!nonceR.ok && nonceR.replay) {
    return { ok: false, reason: 'replay' };
  }

  return { ok: true, reason: null, which: verdict.which };
}

/**
 * Standardised 401 response for HMAC failures.
 * Cache-Control: no-store ensures CDN never caches auth rejections.
 */
export function hmacFailResponse(reason, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(
    JSON.stringify({ error: 'hmac_' + (reason || 'invalid') }),
    { status: 401, headers },
  );
}

/**
 * Compute expected HMAC signature for a payload. Used by /api/session to sign
 * the session token payload, and by tests.
 */
export async function signPayload(message, secret) {
  const k = await _importKey(secret);
  return _signToBase64(k, message);
}
