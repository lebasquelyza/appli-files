// apps/web/lib/sessionsCookie.ts
"use client";

export type Workout = {
  status: "active" | "done";
  startedAt?: string;
  endedAt?: string;
  sessionId?: string;
  title?: string;
  type?: string;
};

export type Store = { sessions: Workout[] };

function getCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${safe}=([^;]+)`));
  return m ? m[1] : "";
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${
    60 * 60 * 24 * 365
  }; SameSite=Lax`;
}

export function readSessionsCookie(): Store {
  const raw = getCookieValue("app_sessions");
  if (!raw) return { sessions: [] };
  const decoded = decodeURIComponent(raw);
  try {
    const o = JSON.parse(decoded || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

function pruneSessions(list: Workout[], keep = 120): Workout[] {
  const sorted = [...list].sort((a, b) =>
    (a.endedAt || "").localeCompare(b.endedAt || "")
  );
  return sorted.slice(Math.max(0, sorted.length - keep));
}

/**
 * Synchronise la liste "séances faites" (savedIds) vers le cookie `app_sessions` (status:"done").
 * - Ajoute les séances manquantes
 * - Supprime du cookie les "done" qui ne sont plus dans savedIds (optionnel mais utile pour cohérence)
 * - Préserve les séances "active"
 */
export function syncDoneSessionsToCookie(done: Array<{
  sessionId: string;
  title?: string;
  type?: string;
}>) {
  if (typeof window === "undefined") return;

  const store = readSessionsCookie();
  const now = new Date().toISOString();

  const doneIds = new Set(done.map((d) => d.sessionId).filter(Boolean));

  // 1) Garder toutes les "active"
  const keepActive = store.sessions.filter((s) => s.status === "active");

  // 2) Repartir des "done" existantes mais ne garder que celles encore dans doneIds
  const existingDone = store.sessions.filter(
    (s) => s.status === "done" && s.sessionId && doneIds.has(s.sessionId)
  );

  const byId = new Map<string, Workout>();
  for (const s of existingDone) {
    if (s.sessionId) byId.set(s.sessionId, s);
  }

  // 3) Ajouter celles qui manquent
  for (const d of done) {
    if (!d.sessionId) continue;
    if (!byId.has(d.sessionId)) {
      byId.set(d.sessionId, {
        status: "done",
        sessionId: d.sessionId,
        title: d.title,
        type: d.type,
        endedAt: now,
      });
    } else {
      // optionnel: enrichir title/type si manquant
      const cur = byId.get(d.sessionId)!;
      if (!cur.title && d.title) cur.title = d.title;
      if (!cur.type && d.type) cur.type = d.type;
    }
  }

  const merged = pruneSessions([...keepActive, ...byId.values()], 120);

  setCookie("app_sessions", JSON.stringify({ sessions: merged }));

  // 🔔 Notifie les pages (Dashboard) de relire le cookie
  window.dispatchEvent(new CustomEvent("app:sessions-updated"));
}
