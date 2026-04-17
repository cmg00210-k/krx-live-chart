// [V48-SEC Phase 3] KV-backed sliding window rate limiter.
//
// Design:
//   - KV namespace binding: env.RATE_LIMIT_KV (defined in wrangler.toml).
//   - Key format: "rl:<scope>:<identifier>" where scope in
//     {'ip','sess','ep'} and identifier is an IP, session id, or endpoint.
//   - Each key stores a JSON { t: [timestamps_in_seconds] } that gets
//     truncated on every call to keep only timestamps inside the window.
//   - KV consistency is eventual (last-write-wins). For a single user hitting
//     limits of 100-1000/min, the ~60 seconds of inconsistency is acceptable.
//     If stricter concurrency is needed later, migrate to Durable Objects.
//
// Contract:
//   checkRateLimit(env, key, maxRequests, windowSec)
//     -> { allowed: true }
//     or { allowed: false, retryAfter: seconds_until_oldest_expires }
//
//   rateLimitFailResponse(retryAfter, origin)
//     -> Response 429 with Retry-After header and JSON body
//
// Helper combineChecks runs multiple checks and returns the first failure;
// typical usage is { ipKey, sessionKey, endpointKey } together.

const KV_TTL_MARGIN_SEC = 60;  // keep KV entry slightly longer than window

/**
 * Check whether a key has exceeded its rate limit in the last windowSec.
 * If not, append current timestamp and return allowed.
 */
export async function checkRateLimit(env, key, maxRequests, windowSec) {
  const kv = env && env.RATE_LIMIT_KV;
  if (!kv) {
    // KV not bound — fail open in dev, but log via return field.
    return { allowed: true, kvMissing: true };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - windowSec;

  let entry;
  try {
    const raw = await kv.get(key);
    entry = raw ? JSON.parse(raw) : { t: [] };
  } catch (_) {
    entry = { t: [] };
  }

  // Prune out-of-window timestamps.
  const kept = (entry.t || []).filter((ts) => ts > windowStart);

  if (kept.length >= maxRequests) {
    const oldest = kept[0];
    const retryAfter = Math.max(1, (oldest + windowSec) - nowSec);
    return { allowed: false, retryAfter, current: kept.length, limit: maxRequests };
  }

  kept.push(nowSec);
  try {
    await kv.put(key, JSON.stringify({ t: kept }), {
      expirationTtl: windowSec + KV_TTL_MARGIN_SEC,
    });
  } catch (_) { /* KV write failure falls through — we already decided to allow */ }

  return { allowed: true, current: kept.length, limit: maxRequests };
}

/**
 * Run multiple rate-limit checks in parallel. Return the first failure, or
 * allowed=true if all pass.
 *
 * specs: array of { key, max, window }
 */
export async function combineChecks(env, specs) {
  if (!specs || specs.length === 0) return { allowed: true };
  const results = await Promise.all(
    specs.map((s) => checkRateLimit(env, s.key, s.max, s.window).catch(() => ({ allowed: true })))
  );
  for (let i = 0; i < results.length; i++) {
    if (!results[i].allowed) {
      return Object.assign({ which: specs[i].name || ('spec_' + i) }, results[i]);
    }
  }
  return { allowed: true };
}

/**
 * Standardised 429 response.
 * Sets Retry-After header AND includes retryAfter in JSON body so both
 * HTTP-aware and JSON-only clients can react.
 */
export function rateLimitFailResponse(retryAfter, origin) {
  const ra = Math.max(1, Math.ceil(retryAfter || 1));
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Retry-After': String(ra),
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(
    JSON.stringify({ error: 'rate_limit', retryAfter: ra }),
    { status: 429, headers },
  );
}

/**
 * Shortcut: extract client IP from request. Cloudflare adds CF-Connecting-IP;
 * never trust X-Forwarded-For (spoofable). Falls back to 'unknown' for local
 * dev where CF-Connecting-IP is absent.
 */
export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP')
    || request.headers.get('cf-connecting-ip')
    || 'unknown'
  );
}

/**
 * Pre-configured rate limits per endpoint class. Tuned against V48 Phase 2
 * production observation (normal users = 3-5 calls/min; drag spikes = 10-20;
 * 50x buffer applied).
 */
export const LIMITS = {
  // Heavy POST endpoints: confidence macro/phase8, backtest analyze.
  // Expect multiple calls per stock selection + pattern analysis cycle.
  heavy_post: { maxIp: 1000, maxSession: 500, window: 60 },

  // Light GET endpoints: constants, flow, hmm, eva. Typically fetched once
  // per page load + on-demand refresh. Keep strict.
  light_get: { maxIp: 100, maxSession: 50, window: 60 },

  // Session initialization: ONE per 15 minutes is normal; 10/min/IP is
  // generous upper bound that still blocks automation.
  session_init: { maxIp: 10, maxSession: 0, window: 60 },
};
