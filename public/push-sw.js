/* Cheprabai push service worker — shows message notifications in the OS panel */
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
