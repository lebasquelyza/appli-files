// apps/web/netlify/functions/push-cron.js
exports.config = { schedule: "*/1 * * * *" };

const TZ = "Europe/Paris";

function dayKeyFromParis(date) {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(date);
  return { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" }[wd];
}

function timeHHmmParis(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = parts.find((p) => p.type === "hour")?.value || "00";
  const mm = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hh}:${mm}`;
}

function parseDays(daysStr) {
  return String(daysStr || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ✅ Fallback coach (à toi d'enrichir si tu veux: DB, random pool, etc.)
async function pickCoachMessage() {
  return {
    title: "Files Le Coach",
    message: "Petite action aujourd’hui, grand impact demain 💪",
  };
}

async function sendPushToDevices(supabase, webpush, payload) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions_device")
    .select("endpoint, p256dh, auth")
    .eq("scope", "motivation");

  if (error || !subs?.length) return 0;

  let sent = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      const code = Number(e?.statusCode || e?.status || 0);
      if (code === 404 || code === 410) {
        await supabase.from("push_subscriptions_device").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return sent;
}

exports.handler = async () => {
  const webpush = (await import("web-push")).default;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = getSupabaseAdmin();

  const now = new Date();
  const hhmm = timeHHmmParis(now);
  const dayKey = dayKeyFromParis(now);

  const { data: msgs, error: msgErr } = await supabase
    .from("motivation_messages")
    .select("*")
    .eq("active", true)
    .eq("time", hhmm);

  if (msgErr) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: msgErr.message }) };
  }

  const due = (msgs || []).filter((m) => parseDays(m.days).includes(dayKey));

  let sent = 0;

  for (const msg of due) {
    const custom = (msg?.content || "").trim();

    let title = "Files Le Coach";
    let body = "";

    if (custom) {
      // ✅ 1) Texte client prioritaire
      body = custom;
    } else {
      // ✅ 2) Fallback coach
      const coach = await pickCoachMessage();
      title = coach.title || title;
      body = coach.message || "";
    }

    sent += await sendPushToDevices(supabase, webpush, {
      title,
      body,
      scope: "motivation",
      data: { url: "/dashboard/motivation", scope: "motivation" },
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, at: `${hhmm}|${dayKey}|${TZ}`, due: due.length, sent }),
  };
};
