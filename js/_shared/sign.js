// [V48-SEC Phase 3] Client-side HMAC signing + session initialization.
//
// Globals exposed (follows project's no-bundler convention):
//   _HMAC_SECRET         string | null  — per-session ephemeral secret (base64)
//   _SESSION_TOKEN       string | null  — Bearer token for Authorization header
//   _SESSION_EXPIRES     number         — ms epoch of token expiry
//   _SESSION_ID          string | null  — sid echoed by server (debug/log)
//   _SERVER_TIME_SKEW_MS number         — clientNow - serverNow at mint time
//   _initSession()       Promise<void>  — call once at app start; self-reschedules
//   _signPost(url, body) Promise<Response>  — signed POST, retries once on 401
//   _signGet(url)        Promise<Response>  — signed GET, retries once on 401
//   _sessionReady()      boolean        — true once init has provisioned a token
//
// Design notes:
//   - Session init is mandatory. If it fails, every signed call throws. The
//     Phase 2.5 policy (server-first, no client fallback) applies: broken
//     server means degraded UI, not silent miscomputation.
//   - Automatic refresh is scheduled 60 seconds before expiry. If the page
//     is idle and refresh fails, the next signed call will hit 401 and trigger
//     one retry with a fresh init.
//   - _retryCount per-call caps infinite 401 loops at 1 retry.
//   - Server provides serverTime in mint response; we compute and store skew
//     so we sign with server-aligned timestamps (avoids skew 401 on drifted
//     client clocks).

var _HMAC_SECRET = null;
var _SESSION_TOKEN = null;
var _SESSION_EXPIRES = 0;
var _SESSION_ID = null;
var _SERVER_TIME_SKEW_MS = 0;

var _sessionInitInFlight = null;  // Promise de-duplication
var _sessionRefreshTimer = null;

// ---- Web Crypto helpers -----------------------------------------------------

function _utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

function _bytesToBase64(bytes) {
  var bin = '';
  for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function _hmacSha256Base64(message, secretBase64) {
  // Import the base64 secret as raw key bytes.
  var secretBin = atob(secretBase64);
  var secretBytes = new Uint8Array(secretBin.length);
  for (var i = 0; i < secretBin.length; i++) secretBytes[i] = secretBin.charCodeAt(i);

  var key = await crypto.subtle.importKey(
    'raw', secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  var sig = await crypto.subtle.sign('HMAC', key, _utf8Bytes(message));
  return _bytesToBase64(new Uint8Array(sig));
}

// ---- Server time alignment --------------------------------------------------

function _signedTimestamp() {
  // Use server-aligned clock. If the local clock is 2 minutes fast, we
  // subtract that 2 minutes so the server sees our timestamp as "now".
  return String(Date.now() - _SERVER_TIME_SKEW_MS);
}

// ---- Public: session readiness ---------------------------------------------

function _sessionReady() {
  return !!(_HMAC_SECRET && _SESSION_TOKEN && _SESSION_EXPIRES > Date.now());
}

// ---- Session init -----------------------------------------------------------

async function _fetchSession() {
  var clientBeforeFetch = Date.now();
  var resp = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    credentials: 'same-origin',
  });
  if (!resp.ok) {
    var errText = await resp.text().catch(function() { return ''; });
    throw new Error('[session] /api/session failed: ' + resp.status + ' ' + errText);
  }
  var body = await resp.json();
  if (!body || !body.token || !body.secret || !body.expiresAt) {
    throw new Error('[session] malformed response');
  }
  var clientAfterFetch = Date.now();
  // Approximate network round-trip midpoint as "the instant server time
  // was captured". serverTime + (RTT/2) ~= client receive time.
  var rtt = clientAfterFetch - clientBeforeFetch;
  var clientMidpoint = clientBeforeFetch + Math.floor(rtt / 2);
  _SERVER_TIME_SKEW_MS = clientMidpoint - (body.serverTime || clientMidpoint);

  _HMAC_SECRET     = body.secret;
  _SESSION_TOKEN   = body.token;
  _SESSION_EXPIRES = body.expiresAt;
  _SESSION_ID      = body.sessionId;

  _scheduleRefresh();
  try { console.log('[session] initialized sid=' + (body.sessionId || '?').slice(0, 8)
    + '... expires in ' + Math.round((body.expiresAt - Date.now()) / 1000) + 's'
    + ' skew=' + _SERVER_TIME_SKEW_MS + 'ms'); } catch (_) {}
}

function _scheduleRefresh() {
  if (_sessionRefreshTimer) {
    try { clearTimeout(_sessionRefreshTimer); } catch (_) {}
  }
  var msUntilRefresh = _SESSION_EXPIRES - Date.now() - 60_000;  // 1 min early
  if (msUntilRefresh < 5_000) msUntilRefresh = 5_000;             // floor
  _sessionRefreshTimer = setTimeout(function() {
    _initSession().catch(function(err) {
      try { console.warn('[session] refresh failed:', err && err.message); } catch (_) {}
    });
  }, msUntilRefresh);
}

async function _initSession() {
  if (_sessionInitInFlight) return _sessionInitInFlight;
  _sessionInitInFlight = (async function() {
    try {
      await _fetchSession();
    } finally {
      _sessionInitInFlight = null;
    }
  })();
  return _sessionInitInFlight;
}

// ---- Public: signed fetch wrappers -----------------------------------------

async function _signPost(url, bodyObj, _retryCount) {
  if (!_HMAC_SECRET || !_SESSION_TOKEN) {
    // Allow a one-shot init if Phase 3 client was wired but app.js didn't
    // call _initSession() at startup (defensive guard).
    await _initSession();
  }
  var ts = _signedTimestamp();
  var bodyStr = (bodyObj == null) ? '' : JSON.stringify(bodyObj);
  var sig = await _hmacSha256Base64(ts + '.' + bodyStr, _HMAC_SECRET);

  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _SESSION_TOKEN,
      'X-CheeseStock-Timestamp': ts,
      'X-CheeseStock-Signature': sig,
    },
    body: bodyStr,
    credentials: 'same-origin',
  });

  // One retry on token_expired / hmac_skew by re-initializing session.
  if (resp.status === 401 && !_retryCount) {
    var parsed = await resp.clone().json().catch(function() { return null; });
    var code = parsed && parsed.error;
    if (code === 'token_expired' || code === 'hmac_skew' || code === 'hmac_missing') {
      try { await _initSession(); }
      catch (e) { return resp; }  // init failed — surface original 401
      return _signPost(url, bodyObj, 1);
    }
  }
  return resp;
}

async function _signGet(url, _retryCount) {
  if (!_HMAC_SECRET || !_SESSION_TOKEN) {
    await _initSession();
  }
  var urlObj;
  try { urlObj = new URL(url, self.location.origin); }
  catch (_) { urlObj = { pathname: url, search: '' }; }
  var pathAndQuery = urlObj.pathname + (urlObj.search || '');

  var ts = _signedTimestamp();
  var sig = await _hmacSha256Base64(ts + '.' + pathAndQuery, _HMAC_SECRET);

  var resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + _SESSION_TOKEN,
      'X-CheeseStock-Timestamp': ts,
      'X-CheeseStock-Signature': sig,
    },
    credentials: 'same-origin',
  });

  if (resp.status === 401 && !_retryCount) {
    var parsed = await resp.clone().json().catch(function() { return null; });
    var code = parsed && parsed.error;
    if (code === 'token_expired' || code === 'hmac_skew' || code === 'hmac_missing') {
      try { await _initSession(); }
      catch (e) { return resp; }
      return _signGet(url, 1);
    }
  }
  return resp;
}

// Expose on window for cross-script access under defer model.
try {
  self._HMAC_SECRET = _HMAC_SECRET;
  self._initSession = _initSession;
  self._signPost = _signPost;
  self._signGet = _signGet;
  self._sessionReady = _sessionReady;
} catch (_) {}
