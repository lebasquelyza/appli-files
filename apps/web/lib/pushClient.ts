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
