// apps/web/netlify/functions/push-cron.js

exports.config = { schedule: "*/1 * * * *" };

const TZ = "Europe/Paris";

function dayKeyFromParis(date) {
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(date);
  const map = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };
  return map[wd] || "mon";
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

function dateYmdParis(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value || "1970";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function parseDays(daysStr) {
  return String(daysStr || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// (Optionnel) génération “coach”
async function pickCoachMessage(/*supabase, lang*/) {
  // Tu peux plus tard stocker des messages coach dans Supabase si tu veux.
  return {
    title: "Files Le Coach",
    message: "Petite action aujourd’hui, grand impact demain. Tu avances. 💪",
  };
}

async function sendPushToUser(supabase, webpush, userId, payload) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push-cron] supabase subs error:", error.message);
    return 0;
  }
  if (!subs?.length) return 0;

  let ok = 0;

  for (const s of subs) {
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      ok++;
    } catch (e) {
      const code = Number(e?.statusCode || e?.status || 0);
      console.error("[push-cron] push error:", code, e?.message || e);

      if (code === 410 || code === 404) {
        // subscription expirée => nettoyage
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  return ok;
}

exports.handler = async (event) => {
  try {
    // (Optionnel) sécuriser un appel manuel
    if (process.env.CRON_SECRET) {
      const secret =
        event.headers?.["x-cron-secret"] ||
        event.headers?.["X-Cron-Secret"] ||
        event.queryStringParameters?.secret;

      if (secret !== process.env.CRON_SECRET) {
        return { statusCode: 401, body: "Unauthorized" };
      }
    }

    const PUB = process.env.VAPID_PUBLIC_KEY;
    const PRIV = process.env.VAPID_PRIVATE_KEY;
    const SUBJ = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

    if (!PUB || !PRIV) {
      console.error("[push-cron] Missing VAPID keys");
      return { statusCode: 500, body: "missing_vapid_keys" };
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(SUBJ, PUB, PRIV);

    const supabase = getSupabaseAdmin();

    // ✅✅✅ ADD (minimal): test push manuel via ?test_email=
    const testEmail =
      event.queryStringParameters?.test_email ||
      event.headers?.["x-test-email"] ||
      event.headers?.["X-Test-Email"];

    if (testEmail) {
      const email = String(testEmail).trim().toLowerCase();

      const { data: subs, error } = await supabase
        .from("push_subscriptions_email")
        .select("endpoint, p256dh, auth")
        .eq("email", email);

      if (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ ok: false, where: "query", error: error.message }),
        };
      }

      let sent = 0;
      for (const s of subs || []) {
        const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title: "Files (test)", body: "Test push OK ✅", data: { url: "/" } })
          );
          sent++;
        } catch (e) {
          const code = Number(e?.statusCode || e?.status || 0);
          return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, where: "send", code, message: e?.message || String(e) }),
          };
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, email, subs: (subs || []).length, sent }),
      };
    }
    // ✅✅✅ END ADD

    const now = new Date();
    const dayKey = dayKeyFromParis(now); // mon..sun
    const hhmm = timeHHmmParis(now); // HH:mm
    const ymd = dateYmdParis(now); // YYYY-MM-DD
    const sendKeyBase = `${ymd}|${hhmm}|${TZ}`;

    // 1) Messages dus maintenant
    // NB: Supabase n’a pas un "contains dayKey" parfait ici => on filtre en JS (simple et safe)
    const { data: rows, error: msgErr } = await supabase
      .from("motivation_messages")
      .select("id, user_id, target, mode, content, days, time, active")
      .eq("active", true)
      .eq("time", hhmm);

    if (msgErr) {
      console.error("[push-cron] supabase motivation_messages error:", msgErr.message);
      return { statusCode: 500, body: "messages_query_failed" };
    }

    const due = (rows || []).filter((m) => parseDays(m.days).includes(dayKey));
    if (!due.length) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, at: sendKeyBase, due: 0, processed: 0, sent: 0 }) };
    }

    // 2) Précharge recipients pour FRIENDS
    const friendMsgIds = due.filter((m) => m.target === "FRIENDS").map((m) => m.id);
    const recByMsg = {};

    if (friendMsgIds.length) {
      const { data: recs, error: recErr } = await supabase
        .from("motivation_recipients")
        .select("message_id, recipient_user_id")
        .in("message_id", friendMsgIds);

      if (recErr) {
        console.error("[push-cron] supabase recipients error:", recErr.message);
        return { statusCode: 500, body: "recipients_query_failed" };
      }

      for (const r of recs || []) {
        if (!recByMsg[r.message_id]) recByMsg[r.message_id] = [];
        recByMsg[r.message_id].push(r.recipient_user_id);
      }
    }

    let processed = 0;
    let sent = 0;

    for (const msg of due) {
      // 3) Anti-doublon : on lock dans motivation_dispatches
      // IMPORTANT : pour FRIENDS, on lock par recipient pour ne pas bloquer les autres
      if (msg.target === "ME" && msg.mode === "COACH") {
        const send_key = sendKeyBase;

        const ins = await supabase.from("motivation_dispatches").insert({
          message_id: msg.id,
          send_key,
        });

        if (ins.error) {
          // déjà envoyé (unique conflict) => skip
          continue;
        }

        processed++;

        const coach = await pickCoachMessage();
        sent += await sendPushToUser(supabase, webpush, msg.user_id, {
          title: coach.title || "Files Le Coach",
          body: coach.message,
          data: { url: "/dashboard/motivation" },
        });

        continue;
      }

      if (msg.target === "FRIENDS" && msg.mode === "CUSTOM") {
        const recipients = recByMsg[msg.id] || [];
        if (!recipients.length) continue;

        // processed = nombre de messages pris en compte (pas nombre de recipients)
        processed++;

        for (const rid of recipients) {
          const send_key = `${sendKeyBase}|${rid}`;

          const ins = await supabase.from("motivation_dispatches").insert({
            message_id: msg.id,
            send_key,
          });

          if (ins.error) {
            // déjà envoyé à CET ami => skip
            continue;
          }

          sent += await sendPushToUser(supabase, webpush, rid, {
            title: "Files",
            body: msg.content,
            data: { url: "/dashboard/motivation" },
          });
        }

        continue;
      }

      // mode/target inattendus => on skip
      console.warn("[push-cron] skipped message (unexpected target/mode):", msg.id, msg.target, msg.mode);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        at: sendKeyBase,
        due: due.length,
        processed,
        sent,
      }),
    };
  } catch (e) {
    console.error("[push-cron] fatal error", e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
