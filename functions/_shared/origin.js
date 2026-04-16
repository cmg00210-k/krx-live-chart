// Origin validation for Pages Functions serving distilled IP JSONs.
// Blocks cross-origin fetches from competitors while allowing first-party clients.
// Note: Origin headers can be spoofed by non-browser clients (curl, scripts).
// This is defense-in-depth; combined with JS bundle obfuscation raises scraping cost.

const ALLOWED_ORIGINS = new Set([
  'https://cheesestock.co.kr',
  'https://www.cheesestock.co.kr',
  'https://cheesestock.pages.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);

const ALLOWED_ORIGIN_SUFFIXES = [
  '.cheesestock.pages.dev',
];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  for (const suffix of ALLOWED_ORIGIN_SUFFIXES) {
    if (origin.endsWith(suffix)) return true;
  }
  return false;
}

export function jsonResponse(data, origin, extraHeaders) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'false',
    'Vary': 'Origin',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    ...(extraHeaders || {}),
  };
  return new Response(JSON.stringify(data), { status: 200, headers });
}

export function forbiddenResponse() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function guardRequest(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  if (isAllowedOrigin(origin)) return { ok: true, origin };
  if (!origin && referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin)) return { ok: true, origin: refOrigin };
    } catch (_) {}
  }
  return { ok: false };
}
