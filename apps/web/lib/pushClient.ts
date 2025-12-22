// apps/web/lib/pushClient.ts
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
    credentials: "include", // ✅ IMPORTANT: envoie les cookies NextAuth
    body: JSON.stringify({ deviceId, subscription }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    const detail = parsed ? JSON.stringify(parsed, null, 2) : (text || "(empty body)");

    throw new Error(`subscribe_api_failed (HTTP ${res.status})\n\n${detail}`);
  }

  return { ok: true };
}
