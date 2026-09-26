/**
 * Vyntra service worker.
 *
 * Strategy:
 *  - App shell ("/" and "/index.html"): NETWORK-FIRST — the cache is only an
 *    offline fallback. index.html is a flat URL whose contents change on every
 *    deploy (it references new hashed JS/CSS), so a cache-first read would
 *    trap users on the previous build. Network-first always fetches the latest
 *    shell; cached bundles are looked up again only because they are hashed.
 *  - /api, /socket.io, /auth, /subscriptions, /calls: NETWORK ONLY with
 *    credentials:"include" (the jwt cookie must be forwarded through the SW on
 *    cross-origin Vercel->Render requests) and cache:"no-store".
 *  - Hashed static assets (a new build is a new URL): STALE-WHILE-REVALIDATE.
 */

const CACHE_NAME = "vyntra-cache-v2"; // bump = migrate users off the old cache-first shell
// Only precache assets that exist at runtime. Vite emits hashed JS/CSS, so the
// previous flat /assets/index.js & /assets/index.css (404 -> SPA fallback) are
// dropped: precaching a non-existent flat URL can reject cache.addAll() and
// abort install, which leaves the OLD sw.js stuck in control forever.
const PRECACHE_URLS = ["/", "/index.html", "/vite.svg", "/avatar.png", "/sounds/notification.mp3"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  const isApi = url.pathname.startsWith("/api/");
  const isSocket = url.pathname.startsWith("/socket.io/");
  const isAuth = /\/api\/auth\//.test(url.pathname) || /\/api\/subscriptions\//.test(url.pathname) || /\/api\/calls\//.test(url.pathname);

  // API / socket / auth: always network. Pin credentials:"include" so the jwt
  // cookie is forwarded through the SW on cross-origin requests, and cache:
  // "no-store" so responses are never served from or synthesised by the cache.
  if (isApi || isSocket || isAuth) {
    event.respondWith(
      fetch(new Request(event.request, { credentials: "include", cache: "no-store" }))
        .catch(() => new Response("Offline", { status: 503 }))
    );
    return;
  }

  const isAppShell = url.pathname === "/" || url.pathname === "/index.html";

  if (isAppShell) {
    // Network-first for the app shell: fetch fresh HTML (which references the
    // latest hashed bundles), cache it as an offline fallback, and fall back to
    // the cache only when the network is unavailable.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Hashed static assets (Vite gives each a unique URL per build): cache-first
  // for speed, refreshed in the background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "Vyntra";
    const options = {
      body: data.body || "",
      icon: data.icon || "/vite.svg",
      badge: data.badge || "/vite.svg",
      data: data.url ? { url: data.url } : undefined,
      requireInteraction: false,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // ignore malformed push payload
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === new URL(url, self.origin).href && "focus" in client) {
          return client.focus();
        }
      }
      if ("openWindow" in self.clients) {
        return self.clients.openWindow(url);
      }
    })
  );
});
