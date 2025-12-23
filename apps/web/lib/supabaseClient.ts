// apps/web/lib/pushClient.ts
import { getSupabase } from "@/lib/supabaseClient";

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
 * ✅ Active les notifications ET enregistre la subscription en DB Supabase (vraies notifs).
 * Pré-requis Supabase:
 * - table push_subscriptions (endpoint UNIQUE)
 * - l'utilisateur est connecté via Supabase Auth (getUser)
 */
export async function enableWebPush(vapidPublicKey: string) {
  if (typeof window === "undefined") throw new Error("Client only");
  if (!window.isSecureContext) throw new Error("Web Push nécessite HTTPS (ou localhost)");
  if (!("Notification" in window)) throw new Error("Notifications unsupported");

  const supabase = getSupabase();

  // 0) user connecté Supabase
  const { data, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(`Supabase getUser error: ${userErr.message}`);
  const user = data?.user;
  if (!user) throw new Error("Utilisateur non connecté (Supabase Auth) — impossible d’enregistrer la subscription");

  // 1) Permission notifications
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(`Permission notifications refusée (perm=${perm})`);

  // 2) Subscription navigateur
  const subscription = await ensurePushSubscription(vapidPublicKey);
  const json = subscription.toJSON();

  const endpoint = json?.endpoint;
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Subscription invalide: endpoint/keys manquants");
  }

  // 3) Upsert DB Supabase
  // NOTE: nécessite colonne endpoint UNIQUE pour onConflict
  const device_id = getDeviceId();
  const user_agent = navigator.userAgent;

  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        device_id,
        user_agent,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "endpoint" }
    );

  if (upsertErr) {
    throw new Error(`Supabase upsert push_subscriptions failed: ${upsertErr.message}`);
  }

  return { ok: true };
}
