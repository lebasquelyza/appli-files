// apps/web/netlify/functions/push-cron.js

// Planifie l'exécution toutes les 5 minutes
exports.config = { schedule: "*/5 * * * *" };

// ENV requis sur Netlify :
// UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const INDEX = "push:prefs:index"; // Set Redis de tous les deviceId avec prefs
const PREFS = "push:prefs:";      // JSON des prefs par deviceId
const SUBS  = "push:sub:";        // Souscriptions Web Push par deviceId
const SENT_PREFIX = "push:sent:"; // Dédup (clé par jour/heure)

// Utils Upstash REST
async function kvGet(path) {
  const r = await fetch(`${URL}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  return r.json();
}
async function kvPost(path) {
  return fetch(`${URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

// HH:mm et n° jour (1..7) dans un TZ donné
function nowInTZ(tz) {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", weekday: "short", timeZone: tz, hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const wd = (get("weekday") || "").toLowerCase(); // mon..sun
  const map = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:7 };
  return { hhmm: `${get("hour")}:${get("minute")}`, dayNum: map[wd] ?? 0 };
}

// yyyymmdd dans un TZ
function yyyymmddInTZ(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).replaceAll("-", "");
}

exports.handler = async () => {
  try {
    const PUB  = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) {
      console.error("[push-cron] Missing VAPID keys");
      return { statusCode: 500, body: "missing_vapid_keys" };
    }

    const setRes = await kvGet(`smembers/${INDEX}`);
    const deviceIds = setRes?.result || [];
    if (!deviceIds.length) return { statusCode: 200, body: "no-prefs" };

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const jobs = deviceIds.map(async (deviceId) => {
      const prefsJson = await kvGet(`get/${PREFS}${deviceId}`);
      const prefsStr = prefsJson?.result;
      if (!prefsStr) return;

      let prefs;
      try { prefs = JSON.parse(prefsStr); } catch { return; }
      const tz = prefs.tz || "UTC";
      const { hhmm, dayNum } = nowInTZ(tz);
      if (!Array.isArray(prefs.days) || !prefs.days.includes(dayNum)) return;
      if (prefs.time !== hhmm) return;

      const stamp = yyyymmddInTZ(tz);
      const dedupKey = `${SENT_PREFIX}${deviceId}:${stamp}-${hhmm.replace(":","")}`;
      const exists = await kvGet(`exists/${dedupKey}`);
      if (exists?.result === 1) return;

      const subJson = await kvGet(`get/${SUBS}${deviceId}`);
      const subStr = subJson?.result;
      if (!subStr) return;

      const payload = JSON.stringify({
        title: "Files Coaching",
        body: "C’est l’heure de ta séance 💪",
        url: "/dashboard",
      });

      try {
        await webpush.sendNotification(JSON.parse(subStr), payload);
        await kvPost(`setex/${dedupKey}/172800/1`); // TTL 2 jours
      } catch (e) {
        const code = Number(e?.statusCode || e?.status || 0);
        console.error(`[push-cron] send error for ${deviceId}:`, code, e?.message || e);
        if (code === 410) {
          await kvPost(`del/${SUBS}${deviceId}`); // souscription expirée
        }
      }
    });

    await Promise.allSettled(jobs);
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
