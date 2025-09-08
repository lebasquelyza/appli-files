"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify: any; } }

const playBtn = "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:translate-y-px transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-0";

export default function SpotifyPlayer() {
  const { data: session, status } = useSession();
  const playerRef = useRef<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function initPlayer() {
    const token = (session as any)?.accessToken as string;
    if (!token || !window.Spotify) return;

    const player = new window.Spotify.Player({
      name: "Appli Files Web Player",
      getOAuthToken: (cb: (t: string) => void) => cb(token),
      volume: 0.5,
    });

    player.addListener("ready", ({ device_id }: any) => {
      setDeviceId(device_id);
      setReady(true);
    });
    player.addListener("not_ready", () => setReady(false));
    player.addListener("initialization_error", ({ message }: any) => setErr(message));
    player.addListener("authentication_error", ({ message }: any) => setErr(message));
    player.addListener("account_error", ({ message }: any) => setErr(message));

    playerRef.current = player;
    player.connect();
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    setErr(null);

    if (window.Spotify) {
      initPlayer();
      return;
    }

    if (!document.getElementById("spotify-player-sdk")) {
      const s = document.createElement("script");
      s.id = "spotify-player-sdk";
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      document.body.appendChild(s);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      initPlayer();
    };
  }, [status, session]);

  async function start() {
    setErr(null);
    try { await playerRef.current?.activateElement?.(); } catch {}

    if (!deviceId) {
      setErr("Player non prêt (deviceId manquant)");
      return;
    }

    // Transférer + démarrer
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

    // Lecture explicite sur CE device
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
  }

  if (status !== "authenticated") return null;

  return (
    <div className="space-y-3">
      {!ready && <p className="text-sm text-gray-500">Initialisation du player…</p>}
      {err && <p className="text-sm text-red-600">Erreur: {String(err)}</p>}

      <div className="flex flex-wrap gap-2">
        <button disabled={!ready} onClick={start} className={playBtn}>
          ▶️ Lancer la musique
        </button>
      </div>

      <p className="text-xs text-gray-500">
        ⚠️ Spotify Premium requis. Assure-toi que ton domaine est autorisé dans les “Web Playback SDK origins”.
      </p>
    </div>
  );
}
