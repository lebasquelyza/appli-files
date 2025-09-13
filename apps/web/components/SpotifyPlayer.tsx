"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify: any;
    __sp_player?: Spotify.Player | null;
    __sp_deviceId?: string | null;
  }
}

type NowPlaying = { name: string; artists: string; image: string | null };

// --- Web API helper (utilise directement le token de session) ---
async function spFetch<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
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

  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  function readState(state: any) {
    if (!state) return; // on laisse le polling REST s'occuper du visuel
    setPaused(state.paused);
    const t = state.track_window?.current_track;
    if (!t) return;
    const name = t.name as string;
    const artists = (t.artists || []).map((a: any) => a.name).join(", ");
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
      const artists = item?.artists?.map((a: any) => a.name).join(", ");
      const image = item?.album?.images?.[0]?.url || null;
      setPaused(!is_playing);
      setDeviceName(data?.device?.name ?? null);
      if (name) setNow({ name, artists: artists ?? "", image });
      else setNow(null);
    } catch {
      // pas grave : on garde l'affichage courant
    }
  }

  function initPlayer() {
    if (!token || !window.Spotify) return;

    // 🔁 Réutiliser un singleton pour que la musique survive aux navigations
    if (window.__sp_player) {
      playerRef.current = window.__sp_player;
      if (window.__sp_deviceId) setDeviceId(window.__sp_deviceId);
      setReady(true);
      // Sync REST pour afficher ce qui joue (même autre device)
      void refreshFromRest();
      return;
    }

    const player = new window.Spotify.Player({
      name: "Appli Files Web Player",
      getOAuthToken: (cb: (t: string) => void) => cb(token),
      volume: 0.6,
    });

    player.addListener("ready", ({ device_id }: any) => {
      window.__sp_deviceId = device_id;
      setDeviceId(device_id);
      setReady(true);
      // Pas de transfer auto -> la musique peut continuer ailleurs.
      // On synchronise l'UI avec le REST:
      void refreshFromRest();
      player.getCurrentState().then(readState).catch(() => {});
    });
    player.addListener("not_ready", () => setReady(false));
    player.addListener("initialization_error", ({ message }: any) => setErr(message));
    player.addListener("authentication_error", ({ message }: any) => setErr(message));
    player.addListener("account_error", ({ message }: any) => setErr(message));
    player.addListener("player_state_changed", (state: any) => readState(state));

    window.__sp_player = player;
    playerRef.current = player;
    player.connect();
  }

  // Charger SDK + init
  useEffect(() => {
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

    // ⚠️ Pas de disconnect à l'unmount -> la musique continue
    return () => {
      // rien
    };
  }, [status, token]);

  // Poll léger pour rester sync si lecture change ailleurs (mobile/app)
  useEffect(() => {
    if (!token) return;
    void refreshFromRest();
    pollRef.current = window.setInterval(() => { void refreshFromRest(); }, 6000);
    const onVis = () => { if (!document.hidden) void refreshFromRest(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token]);

  // === Actions ===
  // Transférer le contrôle vers le Web Player sans couper la musique
  const controlHere = async () => {
    setErr(null);
    if (!deviceId || !token) { setErr("Player non prêt (deviceId/token)"); return; }
    try {
      // équivalent de ton /api/spotify/transfer, mais direct REST ici
      await spFetch(token, "/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [deviceId], play: true }),
      });
      // On rafraîchit l'état affiché
      setTimeout(() => { void refreshFromRest(); }, 700);
    } catch (e: any) {
      setErr(e?.message ?? "Transfer error");
    }
  };

  const start = async () => {
    // garde ton bouton “Lancer la musique” si tu veux démarrer ici directement
    await controlHere();
  };

  const toggle = async () => {
    try { await playerRef.current?.togglePlay(); } catch {}
    // petit refresh REST pour caler l'UI si toggle vient d'ailleurs
    setTimeout(() => { void refreshFromRest(); }, 500);
  };
  const next = async () => {
    try { await playerRef.current?.nextTrack(); } catch {}
    setTimeout(() => { void refreshFromRest(); }, 500);
  };
  const prev = async () => {
    try { await playerRef.current?.previousTrack(); } catch {}
    setTimeout(() => { void refreshFromRest(); }, 500);
  };

  if (status !== "authenticated") return null;

  return (
    <section className="space-y-6">
      {!ready && <p className="text-sm" style={{color:"var(--muted)"}}>Initialisation du player…</p>}
      {err && <p className="text-sm" style={{color:"#dc2626"}}>Erreur: {String(err)}</p>}

      {/* En lecture */}
      <div
        className="flex items-center gap-6 rounded-[14px]"
        style={{ background:"var(--bg)", border:"1px solid rgba(0,0,0,.08)", boxShadow:"var(--shadow)", padding:"22px" }}
      >
        <div
          style={{
            width: 88, height: 88, borderRadius: "12px",
            background: "var(--panel)", border: "1px solid rgba(0,0,0,.06)",
            overflow: "hidden", flex: "0 0 auto"
          }}
        >
          {now?.image ? (
            <img src={now.image} alt="" width={88} height={88} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate" style={{fontWeight:700, fontSize:"1.05rem"}}>
            {now?.name || "Rien en lecture"}
          </div>
          <div className="truncate" style={{color:"var(--muted)", fontSize:".95rem"}}>
            {now?.artists || (paused ? "En pause" : "Prêt")}
          </div>
          {deviceName && (
            <div className="text-xs" style={{color:"var(--muted)"}}>
              Appareil : {deviceName}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={prev} className="icon-btn" aria-label="Piste précédente" title="Piste précédente">
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M18 6h-2v12h2V6zM14.5 12L6 18V6l8.5 6z"/>
            </svg>
          </button>
          <button onClick={toggle} className="icon-btn" aria-label={paused ? "Lecture" : "Pause"} title={paused ? "Lecture" : "Pause"}>
            {paused ? (
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            ) : (
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z"/>
              </svg>
            )}
          </button>
          <button onClick={next} className="icon-btn" aria-label="Piste suivante" title="Piste suivante">
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zM9.5 12l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Contrôle du device Web */}
      <div className="flex flex-wrap gap-4">
        <button disabled={!ready} onClick={start} className="btn-dash">Lancer la musique</button>
        {/* S'affiche si on n'est pas déjà sur ce device */}
        {!deviceName?.toLowerCase?.().includes("appli files web player") && deviceId && (
          <button disabled={!ready} onClick={controlHere} className="btn-dash">📲 Contrôler ici</button>
        )}
      </div>
    </section>
  );
}
