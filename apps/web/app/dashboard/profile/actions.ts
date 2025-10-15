// apps/web/app/dashboard/profile/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: "active" | "done";
  date: string;
  plannedMin?: number;
  startedAt?: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
};

type Store = { sessions: Workout[] };

function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch {}
  return { sessions: [] };
}

function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

function toYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export async function addSessionAction(formData: FormData) {
  const title = (formData.get("title") || "").toString().trim();
  const type = (formData.get("type") || "muscu").toString() as WorkoutType;
  const date = (formData.get("date") || toYMD()).toString();
  const plannedMinStr = (formData.get("plannedMin") || "")
    .toString()
    .replace(",", ".");
  const note = (formData.get("note") || "").toString().slice(0, 240);
  const startNow = (formData.get("startNow") || "").toString() === "1";

  if (!title) redirect("/dashboard/profile?error=titre");

  const store = parseStore(cookies().get("app_sessions")?.value);

  const w: Workout = {
    id: uid(),
    title,
    type,
    status: "active",
    date,
    plannedMin: plannedMinStr ? Number(plannedMinStr) : undefined,
    startedAt: startNow ? new Date().toISOString() : undefined,
    note: note || undefined,
    createdAt: new Date().toISOString(),
  };

  const next: Store = { sessions: [w, ...store.sessions].slice(0, 300) };

  cookies().set("app_sessions", JSON.stringify(next), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  redirect("/dashboard/profile?success=1");
}
