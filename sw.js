// ══════════════════════════════════════════════════════
//  CheeseStock Service Worker — 오프라인 캐싱
//  정적 자산: Stale-While-Revalidate (캐시 즉시 반환 + 백그라운드 갱신)
//  데이터 파일: Network-First (최신 데이터 우선)
//  WebSocket/비-GET 요청: 무시 (인터셉트 불가)
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'cheesestock-v82';

// 오프라인 시에도 앱 실행에 필요한 정적 자산 목록
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/css/style.css',
  '/js/colors.js',
  '/js/data.js',
  '/js/api.js',
  '/js/indicators.js',
  '/js/patterns.js',
  '/js/signalEngine.js',
  '/js/chart.js',
  '/js/patternRenderer.js',
  '/js/signalRenderer.js',
  '/js/backtester.js',
  '/js/sidebar.js',
  '/js/patternPanel.js',
  '/js/financials.js',
  '/js/drawingTools.js',
  '/js/realtimeProvider.js',
  '/js/analysisWorker.js',
  '/js/screenerWorker.js',
  '/js/appState.js',
  '/js/appWorker.js',
  '/js/appUI.js',
  '/js/app.js',
  '/lib/lightweight-charts.standalone.production.js',
];

// ── Install: 정적 자산 캐싱 + orphan 제거 (V48-Phase2.5) ──
// 같은 CACHE_NAME 안에 STATIC_ASSETS 목록에 없는 옛 hashed 번들(예: Phase 1
// bundled 시기의 worker.<hash>.js / app.<hash>.js)이 누적될 수 있어, install
// 시점에 명시적으로 제거한다. data/* 파일은 별도 (network-first).
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async function(cache) {
      // 1) 새 STATIC_ASSETS 캐싱 (기존 동작)
      await Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] 캐싱 실패:', url, err.message);
          });
        })
      );
      // 2) orphan 제거 — 현재 STATIC_ASSETS에 없고 /data/ 경로도 아닌 캐시 항목 삭제
      try {
        var requests = await cache.keys();
        var validUrls = new Set(
          STATIC_ASSETS.map(function(u) { return new URL(u, self.location.origin).href; })
        );
        for (var i = 0; i < requests.length; i++) {
          var req = requests[i];
          if (!validUrls.has(req.url) && req.url.indexOf('/data/') === -1) {
            await cache.delete(req);
            console.log('[SW] orphan 제거:', req.url);
          }
        }
      } catch (e) {
        console.warn('[SW] orphan 정리 실패:', e && e.message);
      }
    })
  );
  // 대기 중인 이전 SW 즉시 교체
  self.skipWaiting();
});

// ── Activate: 이전 버전 캐시 정리 + 클라이언트에 sw-updated 알림 ──
self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    var keys = await caches.keys();
    await Promise.all(
      keys
        .filter(function(k) { return k !== CACHE_NAME; })
        .map(function(k) { return caches.delete(k); })
    );
    // 현재 열린 모든 탭에 즉시 적용
    await self.clients.claim();
    // [V48-Phase2.5] 활성 클라이언트에 신규 SW 활성화 알림 → toast 트리거
    try {
      var clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (var i = 0; i < clients.length; i++) {
        clients[i].postMessage({ type: 'sw-updated', version: CACHE_NAME });
      }
    } catch (e) { /* ignore */ }
  })());
});

// ── Fetch: 요청 유형별 캐싱 전략 ──
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // WebSocket 요청 — Service Worker가 인터셉트할 수 없음 (무시)
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // GET 이외의 요청은 캐싱 불가 — 네트워크로 직접 전달
  if (event.request.method !== 'GET') return;

  // 외부 CDN 리소스 (Lightweight Charts, Pretendard, JetBrains Mono 등)
  // — Cache-First + 네트워크 갱신 (stale-while-revalidate)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        // 캐시된 응답이 있으면 즉시 반환하면서 백그라운드 갱신
        var fetchPromise = fetch(event.request).then(function(response) {
          if (response && response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() { return cached; });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 데이터 파일 (data/*.json) — Network-First (최신 데이터 우선)
  // 네트워크 실패 시 캐시 폴백 (오프라인 지원)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // 성공한 응답을 캐시에 저장 (다음 오프라인 대비)
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // 네트워크 실패 → 캐시 폴백
        return caches.match(event.request);
      })
    );
    return;
  }

  // 정적 자산 (HTML, CSS, JS) — Stale-While-Revalidate
  // 캐시 즉시 반환 + 백그라운드에서 네트워크 갱신 → 다음 방문 시 최신 반영
  // ignoreSearch: ?v=N 쿼리 무시하여 사전 캐시(/js/x.js)와 실제 요청(/js/x.js?v=12) 매칭
  event.respondWith(
    caches.match(event.request, {ignoreSearch: true}).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() { return cached; });

      return cached || fetchPromise;
    })
  );
});
