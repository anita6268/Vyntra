const CACHE_NAME = "vyntra-cache-v1";
const PRECACHE_URLS = ["/", "/index.html", "/assets/index.js", "/assets/index.css", "/vite.svg", "/avatar.png", "/sounds/notification.mp3"];

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

  if (isApi || isSocket || isAuth) {
    event.respondWith(fetch(event.request).catch(() => new Response("Offline", { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200 && !isApi && !isSocket && !isAuth) {
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
