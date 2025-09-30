// netlify/functions/push-cron.ts
import type { Handler } from "@netlify/functions";

// Toutes les 5 minutes
export const config = { schedule: "*/5 * * * *" };

const URL   = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
const INDEX = "push:prefs:index";
const PREFS = "push:prefs:";
const SUBS  = "push:sub:"; // clé où tu stockes la souscription (déjà en place)
const SENT_PREFIX = "push:sent:"; // déduplication

function nowInTZ(tz: string) {
  const d = new Date();
  // récupère heure/min avec Intl (sans libs)
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", weekday: "short", timeZone: tz, hour12: false
  }).formatToParts(d);
  const get = (t:string) => parts.find(p=>p.type===t)?.value || "";
  // weekday: lun., mar., ... -> on mappe sur 1..7
  const wd = (get("weekday")||"").toLowerCase();
  const map: Record<string,number> = { "lun.":1,"mar.":2,"mer.":3,"jeu.":4,"ven.":5,"sam.":6,"dim.":7 };
  const dayNum = map[wd] ?? new Date().getDay() || 7;
  return { hhmm: `${get("hour")}:${get("minute")}`, dayNum };
}

async function kvGet(path: string) {
  const r = await fetch(`${URL}/${path}`, { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

async function kvPost(path: string) {
  return fetch(`${URL}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } });
}

export const handler: Handler = async () => {
  try {
    // 1) Liste de tous les deviceId avec prefs
    const sMembers = await kvGet(`smembers/${INDEX}`); // {result: ["id1","id2",...]}
    const ids: string[] = sMembers?.result || [];
    if (!ids.length) return { statusCode: 200, body: "no prefs" };

    // Import web-push dynamiquement
    const webpush = (await import("web-push")).default;
    const PUB = process.env.VAPID_PUBLIC_KEY!;
    const PRIV= process.env.VAPID_PRIVATE_KEY!;
    const SUBJ= process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const tasks = ids.map(async (deviceId) => {
      // Prefs
      const prefsJson = await kvGet(`get/${PREFS}${deviceId}`); // {result:'{"time":"08:00","days":[1,2], "tz":"Europe/Paris"}'}
      const prefsStr = prefsJson?.result as string | undefined;
      if (!prefsStr) return;

      let prefs: { time: string; days: number[]; tz: string };
      try { prefs = JSON.parse(prefsStr); } catch { return; }

      const { time, days, tz } = prefs;
      const { hhmm, dayNum } = nowInTZ(tz || "UTC");
      if (!days?.includes(dayNum)) return;
      if (hhmm !== time) return; // précision à la minute (cron passe toutes les 5 min)

      // Dédup (ex: 20250930-0800)
      const stamp = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date())
        .split("/")
        .reverse()
        .join(""); // yyyymmdd
      const markKey = `${SENT_PREFIX}${deviceId}:${stamp}-${time.replace(":","")}`;

      const exists = await kvGet(`exists/${markKey}`); // {result: 0|1}
      if (exists?.result === 1) return;

      // Souscription
      const subJson = await kvGet(`get/${SUBS}${deviceId}`);
      const subStr = subJson?.result as string | undefined;
      if (!subStr) return;

      // Envoi
      const payload = JSON.stringify({
        title: "Files Coaching",
        body: "C’est l’heure de ta séance 💪",
        url: "/dashboard",
      });

      try {
        await webpush.sendNotification(JSON.parse(subStr), payload);
        // marque comme envoyé avec TTL (2 jours)
        await kvPost(`setex/${markKey}/172800/1`);
      } catch (e:any) {
        // si 410 -> supprime la souscription + l’index prefs
        const code = Number(e?.statusCode || e?.status || 0);
        if (code === 410) {
          await kvPost(`del/${SUBS}${deviceId}`);
        }
      }
    });

    await Promise.allSettled(tasks);
    return { statusCode: 200, body: "ok" };
  } catch (e:any) {
    console.error("[push-cron] error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
