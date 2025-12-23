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

/**
 * Active les notifications ET enregistre la subscription via /api/push/subscribe.
 * Le serveur doit ensuite l'upsert en DB (Supabase) en associant au user connecté.
 */
export async function enableWebPush(vapidPublicKey: string) {
  if (typeof window === "undefined") throw new Error("Client only");
  if (!window.isSecureContext) throw new Error("Web Push nécessite HTTPS (ou localhost)");
  if (!("Notification" in window)) throw new Error("Notifications unsupported");

  // 1) Permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(`Permission notifications refusée (perm=${perm})`);

  // 2) Subscription navigateur
  const subscription = await ensurePushSubscription(vapidPublicKey);
  const subJson = subscription.toJSON();

  if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) {
    throw new Error("Subscription invalide: endpoint/keys manquants");
  }

  // 3) Envoi au serveur (NextAuth session cookies)
  const deviceId = getDeviceId();

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ IMPORTANT: envoie les cookies NextAuth
    body: JSON.stringify({
      deviceId,
      subscription: subJson,
      userAgent: navigator.userAgent,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Subscribe failed (${res.status})`);
  }

  return { ok: true };
}
