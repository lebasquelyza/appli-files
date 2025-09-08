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

    // 1) Transférer la lecture vers le device web et démarrer
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

    await sleep(600);

    // 2) Démarrer lecture explicite sur CE device
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
    <div className="space-y-3">
      {!ready && <p className="text-sm text-gray-500">Initialisation du player…</p>}
      {err && <p className="text-sm text-red-600">Erreur: {String(err)}</p>}

      <div className="flex flex-wrap gap-2">
        <button disabled={!ready} onClick={start} className="btn">
          Lancer la musique
        </button>
        <button onClick={fetchDevices} type="button" className="btn btn-outline">
          Voir mes appareils
        </button>
      </div>

      {!!devices.length && (
        <div className="border rounded-lg p-3">
          <div className="text-sm text-gray-600 mb-1">Appareils détectés :</div>
          <ul className="text-sm leading-6">
            {devices.map((d:any) => (
              <li key={d.id}>
                {d.name} {d.is_active ? "(actif)" : ""} — {d.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        ⚠️ Spotify Premium requis. Assure-toi que ton domaine est autorisé dans les “Web Playback SDK origins”.
      </p>
    </div>
  );
}
