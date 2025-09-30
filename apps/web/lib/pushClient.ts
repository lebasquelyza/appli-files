export async function ensurePushSubscription(vapidPublicKey: string) {
  if (!("serviceWorker" in navigator)) throw new Error("no sw");
  if (!("PushManager" in window)) throw new Error("no push");

  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  // clé publique en Uint8Array
  const vapidUint8 = urlBase64ToUint8Array(vapidPublicKey);
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidUint8,
  });
}

export function getDeviceId() {
  let id = localStorage.getItem("device.id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
    localStorage.setItem("device.id", id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
