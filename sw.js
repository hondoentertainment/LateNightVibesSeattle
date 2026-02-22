/**
 * Late Night Vibes Seattle — Service Worker
 * Caches static assets and venue data for offline use.
 */
const CACHE_NAME = "lnv-v4";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/recommend.html",
  "/planner.html",
  "/neighborhoods.html",
  "/styles.css",
  "/recommend.css",
  "/planner.css",
  "/neighborhoods.css",
  "/admin.css",
  "/app.js",
  "/recommend.js",
  "/planner.js",
  "/neighborhoods.js",
  "/lib/core.js",
  "/lib/user-preferences.js",
  "/lib/events.js",
  "/lib/geo.js",
  "/lib/features.js",
  "/lib/crawl-history.js",
  "/lib/favorites-backup.js",
  "/lib/share-plan.js",
  "/venue_list_500plus.csv",
  "/manifest.json",
  "/og-image.png",
  "/splash/splash-1170x2532.png",
  "/splash/splash-750x1334.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  const isCSV = url.pathname.endsWith(".csv");

  if (isCSV) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (
            res.ok &&
            (url.pathname.endsWith(".html") ||
              url.pathname.endsWith(".js") ||
              url.pathname.endsWith(".css") ||
              url.pathname.endsWith(".png") ||
              url.pathname.endsWith(".json"))
          ) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
