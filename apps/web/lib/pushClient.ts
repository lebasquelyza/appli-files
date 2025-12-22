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
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker unsupported");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function ensurePushSubscription(vapidPublicKey: string) {
  if (!("PushManager" in window)) throw new Error("Push API unsupported");
  if (!vapidPublicKey) throw new Error("Missing VAPID public key");

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

export async function enableWebPush(vapidPublicKey: string) {
  if (typeof window === "undefined") throw new Error("Client only");
  if (!window.isSecureContext) throw new Error("Web Push nécessite HTTPS (ou localhost)");
  if (!("Notification" in window)) throw new Error("Notifications unsupported");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(`Permission notifications refusée (perm=${perm})`);

  const subscription = await ensurePushSubscription(vapidPublicKey);

  const deviceId = getDeviceId();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, subscription }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // On essaie de parser en JSON pour afficher proprement
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    const detail =
      parsed ? JSON.stringify(parsed, null, 2) : (text || "(empty body)");

    throw new Error(
      `subscribe_api_failed (HTTP ${res.status})\n\n${detail}`
    );
  }

  return { ok: true };
}
