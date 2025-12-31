import { cookies } from "next/headers";

export type AppleRecent = {
  type: string;
  start: string;
  end: string;
  duration?: number;
  distanceKm?: number;
  energyKcal?: number;
}[];

export function readAppleRecent(): AppleRecent {
  const b64 = cookies().get("apple_health_recent")?.value || "";
  if (!b64) return [];
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** ✅ Nouveau : pas par jour (YYYY-MM-DD -> steps) */
export function readAppleStepsDaily(): Record<string, number> {
  const b64 = cookies().get("apple_health_steps_daily")?.value || "";
  if (!b64) return {};
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object") return obj as Record<string, number>;
    return {};
  } catch {
    return {};
  }
}

export function fmtAppleType(t: string) {
  return t.replace(/^HKWorkoutActivityType/, "");
}
export function fmtAppleDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
export function fmtDuration(min?: number) {
  if (!min || min <= 0) return "";
  if (min < 90) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m} min`;
}
export function fmtKm(km?: number) {
  if (!km || km <= 0) return "";
  return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
}
