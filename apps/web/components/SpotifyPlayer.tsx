"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify: any; } }

type NowPlaying = { name: string; artists: string; image: string | null; };

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
      s.id = "spotify-player-sdk"; s.src = "https://sdk.scdn.co/spotify-player.js"; s.async = true;
      document.body.appendChild(s);
    }
    window.onSpotifyWebPlaybackSDKReady = () => initPlayer();
  }, [status, session]);

  async function start() {
    setErr(null);
    try { await playerRef.current?.activateElement?.(); } catch {}
    if (!deviceId) { setErr("Player non prêt (deviceId manquant)"); return; }

    let r = await fetch("/api/spotify/transfer", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, play: true }),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({}));
      setErr(j?.error?.message || j?.error || `Transfer HTTP ${r.status}`); return; }

    r = await fetch("/api/spotify/play", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({}));
      setErr(j?.error?.reason || j?.error?.message || j?.error || `Play HTTP ${r.status}`); return; }

    setTimeout(() => playerRef.current?.getCurrentState().then(readState).catch(() => {}), 700);
  }

  const toggle = async () => { try { await playerRef.current?.togglePlay(); } catch {} };
  const next = async () => { try { await playerRef.current?.nextTrack(); } catch {} };
  const prev = async () => { try { await playerRef.current?.previousTrack(); } catch {} };

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

      {/* Lancer sur ce device */}
      <div className="flex flex-wrap gap-4">
        <button disabled={!ready} onClick={start} className="btn-dash">Lancer la musique</button>
      </div>
    </section>
  );
}
