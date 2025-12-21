// apps/web/lib/appSessions.ts
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

function parseSessions(raw?: string): Store {
  try {
    const o = JSON.parse(raw || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

function readSessionsCookie(): Store {
  const raw = getCookieValue("app_sessions");
  return parseSessions(raw ? decodeURIComponent(raw) : "{}");
}

function pruneSessions(list: Workout[], keep = 120): Workout[] {
  const sorted = [...list].sort((a, b) =>
    (a.endedAt || "").localeCompare(b.endedAt || "")
  );
  return sorted.slice(Math.max(0, sorted.length - keep));
}

/**
 * Sync la liste "Séance faite" -> cookie app_sessions (done)
 * Préserve les "active"
 * Déclenche app:sessions-updated (Dashboard)
 *
 * ✅ NEW: conserve les séances DONE pendant 1 mois (30 jours),
 * même si un nouveau programme est généré.
 * - Ne réécrit pas endedAt si déjà présent (sinon ça ne périme jamais)
 * - Supprime les DONE expirées (> 30 jours)
 */
export function syncDoneSessionsToCookie(
  done: Array<{ sessionId: string; title?: string; type?: string }>
) {
  const store = readSessionsCookie();
  const now = new Date().toISOString();

  const keepActive = store.sessions.filter((s) => s.status === "active");

  // ✅ garder l'historique DONE non expiré (≤ 30 jours)
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const keepDoneHistory = store.sessions.filter((s) => {
    if (s.status !== "done") return false;
    if (!s.endedAt) return true; // si pas de date, on garde
    const t = new Date(s.endedAt).getTime();
    if (Number.isNaN(t)) return true;
    return Date.now() - t <= monthMs;
  });

  // ✅ index des DONE existantes pour préserver endedAt
  const prevById = new Map<string, Workout>();
  for (const s of keepDoneHistory) {
    const id = (s.sessionId || "").trim();
    if (!id) continue;
    prevById.set(id, s);
  }

  const doneList: Workout[] = done
    .filter((d) => !!d.sessionId)
    .map((d) => {
      const id = String(d.sessionId).trim();
      const prev = prevById.get(id);
      return {
        status: "done",
        sessionId: id,
        title: d.title ?? prev?.title,
        type: d.type ?? prev?.type,
        startedAt: prev?.startedAt,
        endedAt: prev?.endedAt || now, // ✅ ne pas écraser si déjà présent
      };
    });

  // ✅ dédoublonnage: préférer l'entrée "doneList" (upsert) sur l'historique
  const doneIds = new Set(doneList.map((d) => d.sessionId!).filter(Boolean));
  const keepDoneWithoutDuplicates = keepDoneHistory.filter((s) => {
    const id = (s.sessionId || "").trim();
    return !id || !doneIds.has(id);
  });

  const merged = pruneSessions(
    [...keepActive, ...keepDoneWithoutDuplicates, ...doneList],
    120
  );

  setCookie("app_sessions", JSON.stringify({ sessions: merged }));
  window.dispatchEvent(new CustomEvent("app:sessions-updated"));
}
