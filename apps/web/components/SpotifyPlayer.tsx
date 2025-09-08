"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify: any; } }

type NowPlaying = {
  name: string;
  artists: string;
  image: string | null;
};

export default function SpotifyPlayer() {
  const { data: session, status } = useSession();
  const playerRef = useRef<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [paused, setPaused] = useState(true);
  const [now, setNow] = useState<NowPlaying | null>(null);

  function readState(state: any) {
    if (!state) { setNow(null); return; }
    setPaused(state.paused);
    const t = state.track_window?.current_track;
    if (!t) { setNow(null); return; }
    const name = t.name as string;
    const artists = (t.artists || []).map((a: any) => a.name).join(", ");
    const image = t.album?.images?.[0]?.url || null;
    setNow({ name, artists, image });
  }

  function initPlayer() {
    const token = (session as any)?.accessToken as string;
    if (!token || !window.Spotify) return;

    const player = new window.Spotify.Player({
      name: "Appli Files Web Player",
      getOAuthToken: (cb: (t: string) => void) => cb(token),
      volume: 0.6,
    });

    player.addListener("ready", ({ device_id }: any) => {
      setDeviceId(device_id);
      setReady(true);
      // récupère l'état courant au démarrage
      player.getCurrentState().then(readState).catch(() => {});
    });
    player.addListener("not_ready", () => setReady(false));
    player.addListener("initialization_error", ({ message }: any) => setErr(message));
    player.addListener("authentication_error", ({ message }: any) => setErr(message));
    player.addListener("account_error", ({ message }: any) => setErr(message));
    player.addListener("player_state_changed", (state: any) => readState(state));

    playerRef.current = player;
    player.connect();
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    setErr(null);

    if (window.Spotify) { initPlayer(); return; }

    if (!document.getElementById("spotify-player-sdk")) {
      const s = document.createElement("script");
      s.id = "spotify-player-sdk";
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      document.body.appendChild(s);
    }
    window.onSpotifyWebPlaybackSDKReady = () => initPlayer();
  }, [status, session]);

  async function start() {
    setErr(null);
    try { await playerRef.current?.activateElement?.(); } catch {}

    if (!deviceId) { setErr("Player non prêt (deviceId manquant)"); return; }

    // Transférer + démarrer sur CE device
    let r = await fetch("/api/spotify/transfer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, play: true }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j?.error?.message || j?.error || `Transfer HTTP ${r.status}`);
      return;
    }

    // Optionnel: relancer lecture si rien ne part
    r = await fetch("/api/spotify/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j?.error?.reason || j?.error?.message || j?.error || `Play HTTP ${r.status}`);
      return;
    }

    // maj état après démarrage
    setTimeout(() => playerRef.current?.getCurrentState().then(readState).catch(() => {}), 600);
  }

  // Contrôles via le SDK (sur ce device)
  const toggle = async () => { try { await playerRef.current?.togglePlay(); } catch {} };
  const next = async () => { try { await playerRef.current?.nextTrack(); } catch {} };
  const prev = async () => { try { await playerRef.current?.previousTrack(); } catch {} };

  if (status !== "authenticated") return null;

  return (
    <div className="space-y-4">
      {!ready && <p className="text-sm" style={{color:"var(--muted)"}}>Initialisation du player…</p>}
      {err && <p className="text-sm" style={{color:"#dc2626"}}>Erreur: {String(err)}</p>}

      {/* En lecture */}
      <div
        className="p-4 rounded-[14px] flex items-center gap-4"
        style={{ background:"var(--bg)", border:"1px solid rgba(0,0,0,.08)", boxShadow:"var(--shadow)" }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: "12px",
            background: "var(--panel)", border: "1px solid rgba(0,0,0,.06)",
            overflow: "hidden", flex: "0 0 auto"
          }}
        >
          {now?.image ? (
            <img src={now.image} alt="" width={64} height={64} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate" style={{fontWeight:700}}>
            {now?.name || "Rien en lecture"}
          </div>
          <div className="truncate" style={{color:"var(--muted)", fontSize:".9rem"}}>
            {now?.artists || (paused ? "En pause" : "Prêt")}
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex items-center gap-2">
          <button onClick={prev} className="btn-dash" title="Piste précédente">⏮️</button>
          <button onClick={toggle} className="btn-dash" title={paused ? "Lecture" : "Pause"}>
            {paused ? "▶️" : "⏸️"}
          </button>
          <button onClick={next} className="btn-dash" title="Piste suivante">⏭️</button>
        </div>
      </div>

      {/* Bouton pour démarrer sur ce device si rien ne part */}
      <div className="flex flex-wrap gap-2">
        <button disabled={!ready} onClick={start} className="btn-dash">
          ▶️ Lancer la musique
        </button>
      </div>
    </div>
  );
}
