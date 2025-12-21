// apps/web/lib/pushClient.ts
const DEVICE_ID_KEY = "device:id";

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (self.crypto?.randomUUID?.() ?? String(Math.random())).toString();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function ensurePushSubscription(vapidPublicKey: string) {
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker unsupported");
  if (!("PushManager" in window)) throw new Error("Push API unsupported");
  if (!vapidPublicKey) throw new Error("Missing VAPID public key");

  // ✅ demander la permission (sinon subscribe peut échouer silencieusement)
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  // ✅ s'assurer que le SW est prêt
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    const appKey = urlBase64ToUint8Array(vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey,
    });
  }

  return sub;
}

/**
 * ✅ NEW: assure la subscription ET l'enregistre sur le serveur (Prisma PushSubscription)
 */
export async function enableWebPush(vapidPublicKey: string) {
  const deviceId = getDeviceId();
  const subscription = await ensurePushSubscription(vapidPublicKey);

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // deviceId conservé pour compat rétro, mais le backend n'en a plus besoin
    body: JSON.stringify({ deviceId, subscription }),
  });

  if (!res.ok) {
    let err: any = null;
    try {
      err = await res.json();
    } catch {}
    throw new Error(err?.error || "Failed to subscribe on server");
  }

  return { ok: true, subscription };
}

/**
 * ✅ NEW: désactive web push (unsubscribe navigateur + nettoyage serveur)
 */
export async function disableWebPush() {
  if (!("serviceWorker" in navigator)) return { ok: true };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  if (!sub) return { ok: true };

  // nettoyer serveur (on envoie endpoint)
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  // désabonner navigateur
  try {
    await sub.unsubscribe();
  } catch {}

  return { ok: true };
}
