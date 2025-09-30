/* Service Worker – Push + affichage notif */
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  self.registration?.navigationPreload?.enable?.();
  clients.claim();
});

/* Reçoit un push et affiche la notif */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "CoachFit";
  const body  = data.body  || "Petit rappel motivation ✨";
  const icon  = data.icon  || "/icon-192.png";
  const badge = data.badge || "/badge.png";
  const url   = data.url   || "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [80, 40, 80],
    })
  );
});

/* Clic sur la notif -> ouvrir/centrer l’onglet */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/dashboard";
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(url)) { return c.focus(); }
    }
    return clients.openWindow(url);
  })());
});
