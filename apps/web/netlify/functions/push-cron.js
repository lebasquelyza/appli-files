// netlify/functions/push-cron.ts
import type { Handler } from "@netlify/functions";

export const config = { schedule: "*/5 * * * *" };

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_MAP_FR_SHORT: Record<string, DayKey> = {
  "lun.": "mon",
  "mar.": "tue",
  "mer.": "wed",
  "jeu.": "thu",
  "ven.": "fri",
  "sam.": "sat",
  "dim.": "sun",
};

function nowParis() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    timeZone: "Europe/Paris",
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const wd = (get("weekday") || "").toLowerCase();
  const dayKey = DAY_MAP_FR_SHORT[wd] || "mon";
  const hhmm = `${get("hour")}:${get("minute")}`;
  return { hhmm, dayKey };
}

function stampParis() {
  const ymd = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("");
  return ymd;
}

function parseDays(daysStr: string): DayKey[] {
  return (daysStr || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean) as DayKey[];
}

export const handler: Handler = async () => {
  try {
    const supabase = getSupabaseAdmin();

    // web-push setup
    const webpush = (await import("web-push")).default;
    const PUB = process.env.VAPID_PUBLIC_KEY!;
    const PRIV = process.env.VAPID_PRIVATE_KEY!;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!PUB || !PRIV) throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    // 1) Messages actifs
    const { data: msgs, error: msgErr } = await supabase
      .from("motivation_messages")
      .select("id, user_id, target, mode, content, days, time, active")
      .eq("active", true);

    if (msgErr) throw new Error(msgErr.message);
    if (!msgs?.length) return { statusCode: 200, body: "no messages" };

    // 2) Filtre "dus maintenant" (Europe/Paris)
    const { hhmm, dayKey } = nowParis();
    const due = (msgs as any[]).filter((m) => {
      if (hhmm !== m.time) return false;
      const days = parseDays(m.days);
      return days.includes(dayKey);
    });

    if (!due.length) return { statusCode: 200, body: "no due" };

    // 3) Recipients FRIENDS
    const friendMsgIds = due.filter((m) => m.target === "FRIENDS").map((m) => m.id);
    let recByMsg: Record<string, string[]> = {};

    if (friendMsgIds.length) {
      const { data: recs, error: recErr } = await supabase
        .from("motivation_recipients")
        .select("message_id, recipient_user_id")
        .in("message_id", friendMsgIds);

      if (recErr) throw new Error(recErr.message);

      for (const r of (recs as any[]) || []) {
        const mid = r.message_id as string;
        const rid = r.recipient_user_id as string;
        if (!recByMsg[mid]) recByMsg[mid] = [];
        recByMsg[mid].push(rid);
      }
    }

    // 4) Build jobs (userId + payload + dedupKey)
    const ymd = stampParis();
    const sendJobs: Array<{ messageId: string; toUserId: string; payload: string; sendKey: string }> = [];

    for (const m of due as any[]) {
      const baseKey = `${ymd}-${String(m.time || "").replace(":", "")}`;

      if (m.target === "ME") {
        const payload = JSON.stringify({
          title: "Files Coaching",
          body: "C’est l’heure de ta séance 💪",
          url: "/dashboard",
        });

        // dedup par message+minute (OK)
        sendJobs.push({ messageId: m.id, toUserId: m.user_id, payload, sendKey: baseKey });
      } else {
        const recipients = recByMsg[m.id] || [];
        if (!recipients.length) continue;

        const payload = JSON.stringify({
          title: "Files Coaching",
          body: m.content || "Motivation 💪",
          url: "/dashboard/motivation",
        });

        for (const rid of recipients) {
          // IMPORTANT: inclut rid sinon collision unique(message_id, send_key) -> 1 seul ami recevrait
          sendJobs.push({ messageId: m.id, toUserId: rid, payload, sendKey: `${baseKey}:${rid}` });
        }
      }
    }

    if (!sendJobs.length) return { statusCode: 200, body: "no targets" };

    // 5) Subs des users ciblés
    const uniqueUserIds = Array.from(new Set(sendJobs.map((j) => j.toUserId)));
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id, device_id")
      .in("user_id", uniqueUserIds);

    if (subErr) throw new Error(subErr.message);
    if (!subs?.length) return { statusCode: 200, body: "no subs" };

    const subsByUser: Record<string, any[]> = {};
    for (const s of subs as any[]) {
      const uid = s.user_id as string;
      if (!subsByUser[uid]) subsByUser[uid] = [];
      subsByUser[uid].push(s);
    }

    // 6) Envoi + anti-doublon via motivation_dispatches
    const tasks = sendJobs.flatMap((job) => {
      const userSubs = subsByUser[job.toUserId] || [];
      return userSubs.map(async (s) => {
        // Dédup : unique(message_id, send_key)
        const { error: dErr } = await supabase
          .from("motivation_dispatches")
          .insert({ message_id: job.messageId, send_key: job.sendKey });

        // si déjà envoyé (conflit), on skip silencieusement
        if (dErr) return;

        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };

        try {
          await webpush.sendNotification(subscription, job.payload);
        } catch (e: any) {
          const code = Number(e?.statusCode || e?.status || 0);
          if (code === 410) {
            // subscription invalide => delete
            await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      });
    });

    await Promise.allSettled(tasks);
    return { statusCode: 200, body: "ok" };
  } catch (e: any) {
    console.error("[push-cron] error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
