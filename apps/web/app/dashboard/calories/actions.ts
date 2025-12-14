"use server";

import { cookies } from "next/headers";

type KcalStore = Record<string, number>;
type NotesStore = Record<string, string>;

const TZ = "Europe/Paris";
function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function parseKcalStore(raw?: string): KcalStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: KcalStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
      return out;
    }
  } catch {}
  return {};
}

function parseNotesStore(raw?: string): NotesStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: NotesStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        if (v != null) out[k] = String(v);
      }
      return out;
    }
  } catch {}
  return {};
}

function pruneStore(store: Record<string, unknown>, keepDays = 60) {
  const keys = Object.keys(store).sort(); // "YYYY-MM-DD"
  const toDrop = Math.max(0, keys.length - keepDays);
  for (let i = 0; i < toDrop; i++) delete (store as any)[keys[i]];
}

export type SaveCaloriesResult =
  | { ok: true }
  | { ok: false; error: "bad_date" | "bad_kcal" };

export async function saveCalories(formData: FormData): Promise<SaveCaloriesResult> {
  const date = String(formData.get("date") || todayISO());
  const kcal = Number(formData.get("kcal"));
  const note = (formData.get("note") || "").toString().slice(0, 120);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "bad_date" };
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 50000) return { ok: false, error: "bad_kcal" };

  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);

  store[date] = (store[date] || 0) + Math.round(kcal);
  pruneStore(store, 60);

  jar.set("app.kcals", JSON.stringify(store), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  if (note) {
    const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);
    notes[date] = note;
    pruneStore(notes, 60);
    jar.set("app.kcals.notes", JSON.stringify(notes), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    });
  }

  return { ok: true };
}
