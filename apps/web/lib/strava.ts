import { cookies } from "next/headers";

type StravaActivity = {
  id: number;
  name: string;
  type: string;             // Run, Ride, Walk...
  start_date_local: string; // ISO
  distance: number;         // mètres
  moving_time: number;      // secondes
  total_elevation_gain: number;
  average_speed?: number;   // m/s
};

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

export async function getValidStravaAccessToken(): Promise<string | null> {
  const jar = cookies();
  const access = jar.get("strava_access_token")?.value || "";
  const refresh = jar.get("strava_refresh_token")?.value || "";
  const expiresAt = Number(jar.get("strava_expires_at")?.value || 0); // unix seconds

  const now = Math.floor(Date.now() / 1000);
  if (access && now < expiresAt - 60) {
    return access; // encore valide
  }

  // Refresh flow
  if (!refresh) return null;
  const client_id = process.env.STRAVA_CLIENT_ID!;
  const client_secret = process.env.STRAVA_CLIENT_SECRET!;

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      client_id,
      client_secret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const newAccess = String(payload?.access_token || "");
  const newRefresh = String(payload?.refresh_token || refresh);
  const newExpires = Number(payload?.expires_at || 0);

  if (!newAccess) return null;

  // MAJ cookies
  jar.set("strava_access_token", newAccess, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 8 });
  jar.set("strava_refresh_token", newRefresh, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
  jar.set("strava_expires_at", String(newExpires), { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });

  return newAccess;
}

export async function fetchRecentActivities(limit = 6): Promise<StravaActivity[]> {
  const token = await getValidStravaAccessToken();
  if (!token) return [];
  const url = new URL(STRAVA_ACTIVITIES_URL);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as StravaActivity[];
}

/* Helpers UI */
export function fmtKm(meters: number) {
  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
}
export function fmtPaceOrSpeed(activity: StravaActivity) {
  // Si type Run/Walk -> allure min/km ; sinon vitesse km/h
  const m = activity.moving_time;
  const km = activity.distance / 1000;
  if (!m || !km) return "";
  const isRun = /run|walk/i.test(activity.type);
  if (isRun) {
    const secPerKm = m / km;
    const mm = Math.floor(secPerKm / 60);
    const ss = Math.round(secPerKm % 60).toString().padStart(2, "0");
    return `${mm}:${ss} /km`;
  } else {
    const kmh = (activity.distance / 1000) / (m / 3600);
    return `${kmh.toFixed(1)} km/h`;
  }
}
export function fmtDate(frIso: string) {
  try {
    const d = new Date(frIso);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return frIso; }
}
export type { StravaActivity };
