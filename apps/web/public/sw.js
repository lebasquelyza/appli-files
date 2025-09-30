self.addEventListener("push", (event) => {
  console.log("[sw] push event", event);
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const title = data.title || "Notification";
  const body  = data.body  || "";
  const url   = data.url   || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icon-192.png",
      badge: "/icon-192.png"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

