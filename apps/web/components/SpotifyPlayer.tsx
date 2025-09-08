"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify: any; } }

export default function SpotifyPlayer() {
  const { data: session, status } = useSession();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Inject SDK si nécessaire
    const existing = document.getElementById("spotify-player-sdk");
    if (!existing) {
      const s = document.createElement("script");
      s.id = "spotify-player-sdk";
      s.src = "https://sdk.scdn.co/spotify-player.js";
      s.async = true;
      document.body.appendChild(s);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const token = (session as any).accessToken as string;
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

      player.connect();
    };
  }, [status, session]);

  async function start() {
    setErr(null);
    if (!deviceId) return setErr("Player non prêt (deviceId manquant)");
    // 1) Transférer la lecture au device web
    let r = await fetch("/api/spotify/transfer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, play: false }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return setErr(j?.error?.message || j?.error || `Transfer HTTP ${r.status}`);
    }
    // 2) Démarrer la lecture (reprend contexte ou 1ʳᵉ playlist)
    r = await fetch("/api/spotify/play", { method: "PUT", headers: { "Content-Type": "application/json" } });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return setErr(j?.error?.message || j?.error || `Play HTTP ${r.status}`);
    }
    setPlaying(true);
  }

  if (status !== "authenticated") return null;

  return (
    <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
      {!ready && <p>Initialisation du player…</p>}
      {err && <p style={{ color: "crimson" }}>Erreur: {err}</p>}
      <button disabled={!ready} onClick={start}>
        Lancer la musique
      </button>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        ⚠️ Nécessite Spotify Premium. Si rien ne se lance, assure-toi d’avoir un compte Premium
        et essaye de te reconnecter.
      </p>
    </div>
  );
}
