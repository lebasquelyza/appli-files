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
 */
export function syncDoneSessionsToCookie(
  done: Array<{ sessionId: string; title?: string; type?: string }>
) {
  const store = readSessionsCookie();
  const now = new Date().toISOString();

  const keepActive = store.sessions.filter((s) => s.status === "active");

  const doneList: Workout[] = done
    .filter((d) => !!d.sessionId)
    .map((d) => ({
      status: "done",
      sessionId: d.sessionId,
      title: d.title,
      type: d.type,
      endedAt: now,
    }));

  const merged = pruneSessions([...keepActive, ...doneList], 120);

  setCookie("app_sessions", JSON.stringify({ sessions: merged }));
  window.dispatchEvent(new CustomEvent("app:sessions-updated"));
}
