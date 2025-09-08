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

    // si SDK déjà chargé
    if (window.Spotify) {
      initPlayer();
      return;
    }

    // injecte le SDK
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
    // important pour Safari/Chrome: activer l'élément audio après une interaction utilisateur
    try { await playerRef.current?.activateElement?.(); } catch {}

    if (!deviceId) {
      setErr("Player non prêt (deviceId manquant)"); 
      return;
    }

    // 1) Transférer la lecture au device web
    let r = await fetch("/api/spotify/transfer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, play: false }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j?.error?.message || j?.error || `Transfer HTTP ${r.status}`);
      return;
    }

    // 2) Démarrer la lecture (reprend contexte ou 1ʳᵉ playlist)
    r = await fetch("/api/spotify/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j?.error?.reason || j?.error?.message || j?.error || `Play HTTP ${r.status}`);
      return;
    }

    // 3) Optionnel: rafraîchir la liste des devices pour diagnostic
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
        ⚠️ Nécessite Spotify Premium. Si rien ne se lance, vérifie: Premium, domaine autorisé dans
        Spotify Dashboard, puis reconnecte-toi pour accepter les scopes playback.
      </p>
    </div>
  );
}
