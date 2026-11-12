// ==============================================================================
// HOMICHO AMMUNITION ENGINEERING INDUSTRY - DPM SERVICE WORKER (PWA & OTA ENGINE)
// ==============================================================================

const SW_VERSION = "1.0.1";
const CACHE_NAME = `haei-dpm-v${SW_VERSION}`;

// Pre-cached assets essential for offline shell
const PRECACHE_ASSETS = [
  "/offline",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
];

// Install Event: Pre-cache core offline shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Precache asset fetch failure:", err);
        });
      })
      .then(() => {
        // If there's no existing active controller (first install), activate immediately
        if (!self.registration.active) {
          return self.skipWaiting();
        }
        // If there is an active controller, do NOT skipWaiting;
        // wait for the user to trigger the Over-The-Air (OTA) update!
      })
  );
});

// Activate Event: Clean up stale cache buckets from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log(`[SW] Purging outdated cache bucket: ${name}`);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
      .then(() => {
        // Notify all connected client windows of successful activation
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "SW_ACTIVATED",
              version: SW_VERSION,
            });
          });
        });
      })
  );
});

// Message Event: Listen for Over-The-Air (OTA) user commands
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    console.log("[SW] Received SKIP_WAITING signal. Activating new worker...");
    self.skipWaiting();
  }

  if (event.data.type === "GET_VERSION") {
    event.ports[0]?.postMessage({
      version: SW_VERSION,
      cacheName: CACHE_NAME,
    });
  }
});

// Fetch Event: Intelligent routing with offline resilience and instant cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http/https GET requests
  if (!url.protocol.startsWith("http") || request.method !== "GET") return;

  // Ignore cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Do not intercept or cache /api/version or /sw.js so update checks are always live
  if (url.pathname === "/api/version" || url.pathname === "/sw.js") return;

  // 1. Navigation Requests (HTML pages) -> Network-First with Cache and /offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the successfully fetched page
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed (offline or unreachable)
          const cache = await caches.open(CACHE_NAME);
          const cachedPage = await cache.match(request);
          if (cachedPage) return cachedPage;

          const offlinePage = await cache.match("/offline");
          if (offlinePage) return offlinePage;

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - DPM</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h1>You are offline</h1><p>Homicho Ammunition Engineering Industry</p><a href="/">Retry</a></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. Static Assets (/_next/static/, /icons/, fonts, styles) -> Cache-First with Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. API & Dynamic Requests (/api/, etc.) -> Network-First with graceful 503 fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(async () => {
        return new Response(
          JSON.stringify({
            error: "Offline",
            message: "Cannot complete network operation while offline.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }
});
