// 서비스워커 — 앱 셸 캐싱으로 오프라인/재방문 시 즉시 로딩
// (Streamlit은 서비스워커 기반 오프라인 PWA를 제공하지 않습니다)
const CACHE = "ev-subsidy-v1";
const APP_SHELL = ["/", "/dashboard", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API/백엔드 호출은 항상 네트워크 우선 (캐시하지 않음)
  if (url.pathname.startsWith("/api") || url.port === "8000") return;

  // 페이지 내비게이션: 네트워크 우선, 실패 시 캐시 폴백(오프라인)
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // 정적 자원: 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
