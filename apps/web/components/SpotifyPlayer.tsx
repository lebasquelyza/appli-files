"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify: any; } }

export default function SpotifyPlayer() {
  const { data: session, status } = useSession();
  const playerRef = useRef<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);

  async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchDevices() {
    const r = await fetch("/api/spotify/devices", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setDevices(j.devices || []);
    return j;
  }

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

    // 1) Transférer la lecture vers le device web et démarrer (play:true)
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

    // Laisse Spotify activer le device
    await sleep(600);

    // 2) Démarrer lecture explicite sur ce device (avec device_id)
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

    await fetchDevices();
  }

  if (status !== "authenticated") return null;

  return (
    <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
      {!ready && <p>Initialisation du player…</p>}
      {err && <p style={{ color: "crimson" }}>Erreur: {String(err)}</p>}

      <div style={{display:"flex", gap:8}}>
        <button disabled={!ready} onClick={start}>Lancer la musique</button>
        <button onClick={fetchDevices} type="button">Voir mes appareils</button>
      </div>

      {!!devices.length && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          <div>Appareils détectés :</div>
          <ul>
            {devices.map((d:any) => (
              <li key={d.id}>
                {d.name} {d.is_active ? "(actif)" : ""} — {d.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        ⚠️ Spotify Premium requis. Vérifie aussi que ton domaine est autorisé dans
        “Web Playback SDK origins” du Spotify Dashboard.
      </p>
    </div>
  );
}
