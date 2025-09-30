// apps/web/netlify/functions/push-cron.ts
import type { Handler } from "@netlify/functions";

// Planifie l'exécution toutes les 5 minutes
export const config = { schedule: "*/5 * * * *" };

// === ENV requis (à définir sur Netlify) ===
// UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex: mailto:admin@example.com)

const URL = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
const INDEX = "push:prefs:index"; // Set Redis de tous les deviceId avec prefs
const PREFS = "push:prefs:";      // Hash JSON des prefs par deviceId
const SUBS = "push:sub:";         // Souscriptions Web Push par deviceId
const SENT_PREFIX = "push:sent:"; // Dédup (clé par jour/heure)

// Utilitaires Upstash REST
async function kvGet(path: string) {
  const r = await fetch(`${URL}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  return r.json();
}
async function kvPost(path: string) {
  return fetch(`${URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

// Calcule l'heure HH:mm et le numéro de jour local (1=Mon .. 7=Sun) dans un TZ donné
function nowInTZ(tz: string) {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    timeZone: tz,
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = (get("weekday") || "").toLowerCase(); // mon, tue, wed, thu, fri, sat, sun (en-US)
  const map: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };
  const dayNum = map[wd] ?? 0;
  const hhmm = `${get("hour")}:${get("minute")}`;
  return { hhmm, dayNum };
}

// yyyymmdd (dans le TZ du device)
function yyyymmddInTZ(tz: string) {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d) // "YYYY-MM-DD"
    .replaceAll("-", "");
  return parts; // "yyyymmdd"
}

export const handler: Handler = async () => {
  try {
    const PUB = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) {
      console.error("[push-cron] Missing VAPID keys");
      return { statusCode: 500, body: "missing_vapid_keys" };
    }

    // 1) Récupère la liste des deviceId avec préférences
    const setRes = await kvGet(`smembers/${INDEX}`); // {result: [...]}
    const deviceIds: string[] = setRes?.result || [];
    if (!deviceIds.length) return { statusCode: 200, body: "no-prefs" };

    // 2) Import web-push dynamiquement (CJS)
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    // 3) Traite chaque device
    const jobs = deviceIds.map(async (deviceId) => {
      // 3.1 Prefs du device
      const prefsJson = await kvGet(`get/${PREFS}${deviceId}`); // {result: string}
      const prefsStr = prefsJson?.result as string | undefined;
      if (!prefsStr) return;

      let prefs: { time: string; days: number[]; tz: string };
      try {
        prefs = JSON.parse(prefsStr);
      } catch {
        return;
      }
      const tz = prefs.tz || "UTC";
      const { hhmm, dayNum } = nowInTZ(tz);

      // 3.2 Vérifie la fenêtre (jour + heure "HH:mm" exacte)
      if (!Array.isArray(prefs.days) || !prefs.days.includes(dayNum)) return;
      if (prefs.time !== hhmm) return;

      // 3.3 Déduplication quotidienne (éviter multi-envois)
      const stamp = yyyymmddInTZ(tz); // yyyymmdd local
      const dedupKey = `${SENT_PREFIX}${deviceId}:${stamp}-${hhmm.replace(":", "")}`;
      const exists = await kvGet(`exists/${dedupKey}`); // {result: 0|1}
      if (exists?.result === 1) return;

      // 3.4 Récupère la souscription
      const subJson = await kvGet(`get/${SUBS}${deviceId}`);
      const subStr = subJson?.result as string | undefined;
      if (!subStr) return;

      // 3.5 Envoie la notification
      const payload = JSON.stringify({
        title: "Files Coaching",
        body: "C’est l’heure de ta séance 💪",
        url: "/dashboard",
      });

      try {
        await webpush.sendNotification(JSON.parse(subStr), payload);

        // 3.6 Marque comme envoyé (TTL 2 jours = 172800s)
        await kvPost(`setex/${dedupKey}/172800/1`);
      } catch (e: any) {
        const code = Number(e?.statusCode || e?.status || 0);
        console.error(`[push-cron] send error for ${deviceId}:`, code, e?.message || e);
        if (code === 410) {
          // abonnement expiré : on supprime la souscription
          await kvPost(`del/${SUBS}${deviceId}`);
          // (optionnel) retirer le device de l'index prefs si tu veux "nettoyer"
          // await kvPost(`srem/${INDEX}/${deviceId}`);
        }
      }
    });

    await Promise.allSettled(jobs);
    return { statusCode: 200, body: "ok" };
  } catch (e: any) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
