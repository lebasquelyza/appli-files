"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export default function SpotifyPlayer(){
  const { data: session, status } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const playerRef = useRef<any>(null);

  // Charge le SDK
  useEffect(() => {
    if (!token) return;
    if (document.getElementById("spotify-sdk")) return; // déjà chargé
    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  }, [token]);

  // Instancie le player quand le SDK est prêt
  useEffect(() => {
    if (!token) return;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Files Coaching Player",
        getOAuthToken: (cb: (t: string)=>void) => { cb(token); },
        volume: 0.6,
      });

      player.addListener("ready", ({ device_id }: any) => {
        setDeviceId(device_id);
        setReady(true);
        // Transfert de la lecture vers notre device (ne démarre pas automatiquement)
        fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type":"application/json" },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(()=>{});
      });

      player.addListener("not_ready", ({ device_id }: any) => {
        if (deviceId === device_id) setActive(false);
      });

      player.addListener("player_state_changed", (state: any) => {
        setActive(!!state);
      });

      player.connect();
      playerRef.current = player;
    };
  }, [token]);

  if (status === "loading") {
    return <div className="card">Chargement de la session…</div>;
  }

  if (!token) {
    return (
      <div className="card">
        <p>Connecte ton compte Spotify pour contrôler ta musique depuis Files.</p>
        <button className="btn" onClick={()=>signIn("spotify", { callbackUrl: "/dashboard/music" })}>
          Se connecter à Spotify
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{display:"grid", gap:12}}>
      <div className="font-semibold">Spotify intégré {ready ? "— prêt ✅" : "— initialisation…"}</div>
      <div className="text-sm" style={{color:"#6b7280"}}>
        Device: {deviceId ?? "—"} | Actif: {active ? "oui" : "non"}
      </div>

      <div className="flex" style={{gap:8}}>
        <button className="btn" onClick={()=>playerRef.current?.togglePlay()}>Lecture / Pause</button>
        <button className="btn-outline" onClick={()=>playerRef.current?.previousTrack()}>⏮️ Précédent</button>
        <button className="btn-outline" onClick={()=>playerRef.current?.nextTrack()}>⏭️ Suivant</button>
      </div>

      <div className="flex items-center justify-between" style={{gap:10}}>
        <span className="text-sm" style={{color:"#6b7280"}}>Volume</span>
        <input type="range" min={0} max={1} step={0.01}
          defaultValue={0.6}
          onChange={(e)=>playerRef.current?.setVolume(parseFloat(e.target.value))}
          style={{width:160}}
        />
      </div>

      <p className="text-sm" style={{color:"#6b7280"}}>
        Astuce: ouvre l’app Spotify, démarre une lecture puis reviens ici — clique “Lecture / Pause”.
      </p>
    </div>
  );
}
