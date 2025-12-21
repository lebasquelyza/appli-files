// apps/web/lib/pushClient.ts
const DEVICE_ID_KEY = "device:id";

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).toString();
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

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker non supporté");
  }
  // sw.js doit être dans /public/sw.js
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function ensurePushSubscription(vapidPublicKey: string) {
  if (!("PushManager" in window)) throw new Error("Push API non supportée");
  if (!vapidPublicKey) throw new Error("VAPID public key manquante");

  const reg = await registerSW();

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
 * Active les notifications (permission + subscription + save backend)
 */
export async function enableWebPush(vapidPublicKey: string) {
  // 1) Secure context obligatoire (https ou localhost)
  if (!window.isSecureContext) {
    throw new Error("Web Push nécessite HTTPS (ou localhost)");
  }

  // 2) Permission notifications
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Permission notifications refusée");
  }

  // 3) Subscription
  const subscription = await ensurePushSubscription(vapidPublicKey);

  // 4) Save subscription backend
  const deviceId = getDeviceId();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, subscription }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`subscribe api failed: ${JSON.stringify(j)}`);
  }

  return { ok: true };
}
