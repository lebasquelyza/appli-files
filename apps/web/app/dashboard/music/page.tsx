"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
    __sp_player?: any | null;
    __sp_deviceId?: string | null;
  }
}

type NowPlaying = { name: string; artists: string; image: string | null };

function isMobileSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iOS & iPadOS (iPad annonce Safari mobile depuis iPadOS 13)
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/\bMac\b/.test(navigator.platform) && "ontouchend" in window);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return iOS && safari;
}
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// --- Web API helper ---
async function spFetch<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${res.status} ${path}`);
  return res.json();
}

export default function SpotifyPlayer() {
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    // ❗️Ne pas initialiser le SDK sur mobile (surtout iOS/Safari) → on passe en fallback
    if (isMobile() || isMobileSafari()) {
      setUnsupported(true);
    }
  }, []);

  function readState(state: any) {
    if (!state) return;
    setPaused(Boolean(state.paused));
    const t = state.track_window?.current_track;
    if (!t) return;
    const name = String(t.name ?? "");
    const artists = (t.artists || []).map((a: any) => a?.name).filter(Boolean).join(", ");
    const image = t.album?.images?.[0]?.url || null;
    setNow({ name, artists, image });
  }

  async function refreshFromRest() {
    if (!token) return;
    try {
      const data = await spFetch<any>(token, "/me/player");
      const is_playing = !!data?.is_playing;
      const item = data?.item;
      const name = item?.name as string | undefined;
      const artists = item?.artists?.map((a: any) => a?.name).filter(Boolean).join(", ");
      const image = item?.album?.images?.[0]?.url || null;
      setPaused(!is_playing);
      setDeviceName(data?.device?.name ?? null);
      if (name) setNow({ name, artists: artists ?? "", image });
      else setNow(null);
    } catch {
      // silencieux
    }
  }

  function initPlayer() {
    if (!token || !window.Spotify) return;

    // Réutilise un singleton si déjà initialisé
    if (window.__sp_player) {
      playerRef.current = window.__sp_player;
      if (window.__sp_deviceId) setDeviceId(window.__sp_deviceId);
      setReady(true);
      void refreshFromRest();
      return;
    }

    const player = new window.Spotify.Player({
      name: "Appli Files Web Player",
      getOAuthToken: (cb: (t: string) => void) => cb(token),
      volume: 0.6,
    });

    player.addListener("ready", (ev: any) => {
      const did = ev?.device_id ?? null;
      window.__sp_deviceId = did;
      if (did) setDeviceId(did);
      setReady(true);
      void refreshFromRest();
      player.getCurrentState().then((st: any) => readState(st)).catch(() => {});
    });

    player.addListener("not_ready", () => setReady(false));
    player.addListener("initialization_error", (e: any) => setErr(e?.message ?? "initialization_error"));
    player.addListener("authentication_error", (e: any) => setErr(e?.message ?? "authentication_error"));
    player.addListener("account_error", (e: any) => setErr(e?.message ?? "account_error"));
    player.addListener("playback_error", (e: any) => setErr(e?.message ?? "playback_error"));
    player.addListener("player_state_changed", (state: any) => readState(state));

    window.__sp_player = player;
    playerRef.current = player;
    player.connect();
  }

  // Charger SDK + init (desktop uniquement)
  useEffect(() => {
    if (unsupported) return;
    if (status !== "authenticated" || !token) return;
    setErr(null);

    const startInit = () => initPlayer();

    if (window.Spotify) {
      startInit();
    } else {
      if (!document.getElementById("spotify-player-sdk")) {
        const s = document.createElement("script");
        s.id = "spotify-player-sdk";
        s.src = "https://sdk.scdn.co/spotify-player.js";
        s.async = true;
        document.body.appendChild(s);
      }
      window.onSpotifyWebPlaybackSDKReady = () => startInit();
    }

    return () => {};
  }, [status, token, unsupported]);

  // Poll léger pour rester sync si lecture change ailleurs (desktop uniquement)
  useEffect(() => {
    if (!token || unsupported) return;
    void refreshFromRest();
    pollRef.current = window.setInterval(() => { void refreshFromRest(); }, 6000);
    const onVis = () => { if (!document.hidden) void refreshFromRest(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token, unsupported]);

  // === Actions desktop (SDK) ===
  const controlHere = async () => {
    setErr(null);
    if (!deviceId || !token) { setErr("Player non prêt (deviceId/token)"); return; }
    try {
      await spFetch(token, "/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [deviceId], play: true }),
      });
      setTimeout(() => { void refreshFromRest(); }, 700);
    } catch (e: any) {
      setErr(e?.message ?? "Transfer error");
    }
  };
  const start = async () => { await controlHere(); };
  const toggle = async () => { try { await playerRef.current?.togglePlay(); } catch {} setTimeout(() => { void refreshFromRest(); }, 500); };
  const next = async () => { try { await playerRef.current?.nextTrack(); } catch {} setTimeout(() => { void refreshFromRest(); }, 500); };
  const prev = async () => { try { await playerRef.current?.previousTrack(); } catch {} setTimeout(() => { void refreshFromRest(); }, 500); };

  // === Rendu ===
  if (status !== "authenticated") return null;

  // Fallback mobile : pas de SDK → on propose d'ouvrir l'app Spotify / transférer la lecture
  if (unsupported) {
    return (
      <section className="space-y-4">
        <div className="card">
          <p className="text-sm" style={{ color: "var(--muted, #6b7280)" }}>
            Le lecteur intégré n’est pas disponible sur ce navigateur mobile.
          </p>
          <div className="flex gap-3 mt-2">
            <a className="btn-dash" href="spotify://" aria-label="Ouvrir Spotify">Ouvrir Spotify</a>
            <a className="btn-dash" href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer">Ouvrir sur le web</a>
          </div>
          <p className="text-xs" style={{ color: "var(--muted, #6b7280)", marginTop: 8 }}>
            Astuce : lance la lecture dans Spotify puis reviens ici — la piste en cours s’affichera.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {!ready && <p className="text-sm" style={{ color: "var(--muted)" }}>Initialisation du player…</p>}
      {err && <p className="text-sm" style={{ color: "#dc2626" }}>Erreur: {String(err)}</p>}

      <div className="flex items-center gap-6 rounded-[14px]"
           style={{ background: "var(--bg)", border: "1px solid rgba(0,0,0,.08)", boxShadow: "var(--shadow)", padding: "22px" }}>
        <div style={{ width: 88, height: 88, borderRadius: 12, background: "var(--panel)", border: "1px solid rgba(0,0,0,.06)", overflow: "hidden", flex: "0 0 auto" }}>
          {now?.image ? <img src={now.image} alt="" width={88} height={88} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate" style={{ fontWeight: 700, fontSize: "1.05rem" }}>
            {now?.name || "Rien en lecture"}
          </div>
          <div className="truncate" style={{ color: "var(--muted)", fontSize: ".95rem" }}>
            {now?.artists || (paused ? "En pause" : "Prêt")}
          </div>
          {deviceName && <div className="text-xs" style={{ color: "var(--muted)" }}>Appareil : {deviceName}</div>}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={prev} className="icon-btn" aria-label="Piste précédente" title="Piste précédente">
            <svg className="icon" viewBox="0 0 24 24"><path d="M18 6h-2v12h2V6zM14.5 12L6 18V6l8.5 6z"/></svg>
          </button>
          <button onClick={toggle} className="icon-btn" aria-label={paused ? "Lecture" : "Pause"} title={paused ? "Lecture" : "Pause"}>
            {paused ? <svg className="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    : <svg className="icon" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>}
          </button>
          <button onClick={next} className="icon-btn" aria-label="Piste suivante" title="Piste suivante">
            <svg className="icon" viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6l-8.5 6z"/></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button disabled={!ready} onClick={start} className="btn-dash">Lancer la musique</button>
      </div>
    </section>
  );
}

