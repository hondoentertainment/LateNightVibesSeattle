/**
 * Late Night Vibes Seattle — Service Worker
 * Caches static assets and venue data for offline use.
 */
const CACHE_NAME = "lnv-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res.ok && (url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".csv"))) {
          cache.put(event.request, res.clone());
        }
        return res;
      }))
    ).catch(() => caches.match(event.request))
  );
});
