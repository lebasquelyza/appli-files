// apps/web/public/sw.js
self.addEventListener("push", (event) => {
  console.log("[sw] push event", event);

  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = {};
  }

  const title = data.title || "Files";
  const body = data.body || "";
  // ✅ supporte les 2 formats : { url } ou { data: { url } }
  const url = data?.data?.url || data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // ✅ si une fenêtre existe déjà, on la focus
      for (const client of clientList) {
        if ("focus" in client) {
          // si l'app est déjà ouverte, focus et (optionnel) navigate
          return client.focus();
        }
      }
      // sinon on ouvre
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

