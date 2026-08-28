/* Cheprabai push + offline service worker
   – Caches the app shell on install for instant offline loads
   – Shows push notifications from the backend
   – Handles notification clicks to focus/open the app */

const CACHE_NAME = "cheprabai-shell-v1";

// App shell assets to precache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/logo192.png",
  "/favicon-32x32.png",
  "/manifest.json"
];

/* ================= INSTALL: Precache app shell ================= */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

/* ================= ACTIVATE: Clean old caches ================= */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* ================= FETCH: Network-first with shell fallback ================= */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/socket.io") ||
      url.origin !== self.location.origin) return;

  // JS/CSS bundles: stale-while-revalidate
  if (/\.(js|css)$/.test(url.pathname) || url.pathname.includes("/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navigation: network-first, fallback to cached shell
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        return caches.match("/index.html");
      })
    );
    return;
  }

  // Images/fonts: cache-first
  if (/\.(png|jpg|jpeg|svg|gif|ico|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

/* ================= PUSH: Show OS notification ================= */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "New message", body: "" }; }
  const title = data.title || "Cheprabai";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/logo192.png",
      badge: "/favicon-32x32.png",
      tag: data.tag || "cheprabai",
      renotify: true,
      data: { roomId: data.roomId || null },
      vibrate: [80, 40, 80]
    })
  );
});

/* ================= NOTIFICATION CLICK: Focus or open ================= */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;
  const target = roomId ? `/?room=${encodeURIComponent(roomId)}` : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
