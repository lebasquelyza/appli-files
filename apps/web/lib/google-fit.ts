import { cookies } from "next/headers";

export type GfActivity = {
  id: string;
  name: string;
  start: string; // ISO
  end: string;   // ISO
  distanceKm?: number;
  steps?: number;
  caloriesKcal?: number;
  type?: string;
};

async function ensureAccessToken(): Promise<string | null> {
  const jar = cookies();
  const at = jar.get("gf_access_token")?.value || null;
  const rt = jar.get("gf_refresh_token")?.value || null;
  const exp = Number(jar.get("gf_expires_at")?.value || 0);
  const now = Math.floor(Date.now()/1000);

  if (at && exp > now + 60) return at;
  if (!rt) return at;

  // refresh
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: rt,
    }),
    cache: "no-store",
  });
  if (!res.ok) return at;

  const payload = await res.json() as { access_token: string; expires_in: number; };
  const newAt = payload.access_token;
  const expiresAt = Math.floor(Date.now()/1000) + (payload.expires_in || 3500);

  cookies().set("gf_access_token", newAt, { path:"/", httpOnly:true, sameSite:"lax", secure:true, maxAge: 60*60 });
  cookies().set("gf_expires_at", String(expiresAt), { path:"/", httpOnly:true, sameSite:"lax", secure:true, maxAge: 60*60 });
  return newAt;
}

// Liste les sessions des 14 derniers jours
export async function fetchGfRecentActivities(days = 14): Promise<GfActivity[]> {
  const at = await ensureAccessToken();
  if (!at) return [];

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const params = new URLSearchParams({
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });

  const sessRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?${params}`, {
    headers: { Authorization: `Bearer ${at}` },
    cache: "no-store",
  });

  if (!sessRes.ok) return [];

  const sess = await sessRes.json() as { session: any[] };
  const sessions = Array.isArray(sess.session) ? sess.session : [];

  // Optionnel : on enrichit via aggregate (distance/calories/steps)
  const body = {
    aggregateBy: [
      { dataTypeName: "com.google.distance.delta" },
      { dataTypeName: "com.google.calories.expended" },
      { dataTypeName: "com.google.step_count.delta" },
    ],
    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
    startTimeMillis: start.getTime(),
    endTimeMillis: end.getTime(),
  };

  const aggRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${at}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let daily: Record<string, { distanceKm?: number; caloriesKcal?: number; steps?: number }> = {};
  if (aggRes.ok) {
    const agg = await aggRes.json();
    const buckets = Array.isArray(agg.bucket) ? agg.bucket : [];
    for (const b of buckets) {
      const dateKey = new Date(Number(b.startTimeMillis)).toISOString().slice(0,10);
      const out = daily[dateKey] || (daily[dateKey] = {});
      for (const ds of (b.dataset || [])) {
        const points = ds.point || [];
        for (const p of points) {
          const fields = p.value?.[0];
          if (!fields) continue;
          if (ds.dataSourceId?.includes("distance")) {
            // mètres → km
            out.distanceKm = (out.distanceKm || 0) + (fields.fpVal || 0)/1000;
          } else if (ds.dataSourceId?.includes("calories")) {
            out.caloriesKcal = (out.caloriesKcal || 0) + (fields.fpVal || 0);
          } else if (ds.dataSourceId?.includes("step_count")) {
            out.steps = (out.steps || 0) + (fields.intVal || 0);
          }
        }
      }
    }
  }

  const acts: GfActivity[] = sessions.map((s: any) => {
    const startISO = s.startTimeMillis ? new Date(Number(s.startTimeMillis)).toISOString() : s.startTime;
    const endISO = s.endTimeMillis ? new Date(Number(s.endTimeMillis)).toISOString() : s.endTime;
    const dayKey = (startISO || "").slice(0,10);
    const enrich = daily[dayKey] || {};

    return {
      id: s.id || `${startISO}-${endISO}`,
      name: s.name || s.activityType || "Session",
      start: startISO,
      end: endISO,
      distanceKm: enrich.distanceKm ? Math.round(enrich.distanceKm * 100) / 100 : undefined,
      steps: enrich.steps,
      caloriesKcal: enrich.caloriesKcal ? Math.round(enrich.caloriesKcal) : undefined,
      type: s.activityType,
    };
  }).sort((a,b)=> (b.start||"").localeCompare(a.start||"")).slice(0, 6);

  // Option : stocker un résumé en cookie pour affichage RSC rapide
  cookies().set("google_fit_recent", Buffer.from(JSON.stringify(acts), "utf8").toString("base64"), {
    path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60*30,
  });

  return acts;
}

export function readGfRecentFromCookie(): GfActivity[] {
  try {
    const b64 = cookies().get("google_fit_recent")?.value;
    if (!b64) return [];
    const json = Buffer.from(b64, "base64").toString("utf8");
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export const fmtKm = (km?: number) => typeof km === "number" ? `${km.toFixed(2)} km` : "";
export const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";
