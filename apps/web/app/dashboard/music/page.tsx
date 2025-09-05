"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";
import SpotifyPlayer from "@/components/SpotifyPlayer";

/** Helpers minuteur **/
function toSeconds(mmss: string) {
  const [mm = "0", ss = "0"] = mmss.split(":");
  const m = parseInt(mm || "0", 10);
  const s = parseInt(ss || "0", 10);
  if (Number.isNaN(m) || Number.isNaN(s) || m < 0 || s < 0 || s > 59) return 0;
  return m * 60 + s;
}
function toMMSS(total: number) {
  const m = Math.max(0, Math.floor(total / 60));
  const s = Math.max(0, total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Page(){
  /** Lien de secours (embed) — toujours dispo si l’utilisateur ne veut pas se connecter */
  const [link,setLink]=useState("https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh");

  /** Minuteur avec chime mixé (WebAudio) **/
  const [input, setInput] = useState("05:00");
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const tickRef = useRef<number|null>(null);

  const audioCtxRef = useRef<AudioContext|null>(null);
  const masterGainRef = useRef<GainNode|null>(null);
  const [volume, setVolume] = useState(0.8);

  function ensureAudioContext() {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }
    if (audioCtxRef.current.state !== "running") {
      audioCtxRef.current.resume().catch(()=>{});
    }
  }
  function playChime() {
    ensureAudioContext();
    const ctx = audioCtxRef.current;
    const mg = masterGainRef.current;
    if (!ctx || !mg) return;
    const now = ctx.currentTime;
    const tones = [
      { f: 880,  t: 0.00, dur: 0.18, gain: 0.9 },
      { f: 1318, t: 0.18, dur: 0.18, gain: 0.9 },
      { f: 1760, t: 0.36, dur: 0.22, gain: 0.8 },
      { f: 1318, t: 0.62, dur: 0.22, gain: 0.7 },
      { f: 1760, t: 0.88, dur: 0.30, gain: 0.6 },
    ];
    tones.forEach(({ f, t, dur, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(gain, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);
      osc.connect(g).connect(mg);
      osc.start(now + t);
      osc.stop(now + t + dur + 0.02);
    });
  }
  useEffect(()=>{ if(masterGainRef.current){ masterGainRef.current.gain.value = volume; } },[volume]);
  useEffect(()=>{ setPermission(typeof Notification !== "undefined" ? Notification.permission : "default"); },[]);
  function askPermission(){ if (typeof Notification === "undefined") return; Notification.requestPermission().then(setPermission); }

  useEffect(()=>{
    if (running && remaining > 0) {
      tickRef.current = window.setInterval(()=> {
        setRemaining(t => {
          if (t <= 1) {
            if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
            setRunning(false);
            playChime();
            if (permission === "granted") { try { new Notification("Minuteur terminé ⏰", { body: "Bien joué !" }); } catch {} }
            else { alert("Minuteur terminé ⏰"); }
            return 0;
          }
          return t - 1;
        });
      }, 1000) as any;
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    } else {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    }
  }, [running, remaining, permission]);

  function setFromInput(v: string) { setInput(v); const secs = toSeconds(v); if (secs >= 0) setRemaining(secs); }
  function preset(secs: number) { setRunning(false); setRemaining(secs); setInput(toMMSS(secs)); }
  function startPause() { if (remaining <= 0) return; ensureAudioContext(); setRunning(r => !r); }
  function reset() { setRunning(false); setRemaining(toSeconds(input) || 0); }
  function clearAll() { setRunning(false); setRemaining(0); setInput("00:00"); }

  const mmss = toMMSS(remaining);

  return (
    <>
      <PageHeader title="Musique & minuteur" subtitle="Connecte Spotify et lance un compte à rebours" />
      <div className="grid gap-6 lg:grid-cols-2">

        <Section title="Spotify (compte Premium)">
          {/* Player SDK (contrôles natifs dans l'app) */}
          <SpotifyPlayer />
          {/* Fallback embed (lien) */}
          <div className="card">
            <label className="label">Ou lis un lien Spotify (embed)</label>
            <input className="input" value={link} onChange={e=>setLink(e.target.value)} />
            <div className="aspect-video rounded-xl overflow-hidden" style={{marginTop:10}}>
              <iframe
                src={link.replace("open.spotify.com","open.spotify.com/embed")}
                width="100%"
                height="100%"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          </div>
        </Section>

        <Section title="Minuteur">
          <div className="card" style={{display:"grid", gap:12}}>
            <div>
              <label className="label">Durée (mm:ss)</label>
              <input className="input" value={input} onChange={e=>setFromInput(e.target.value.replace(/[^\d:]/g, ""))} placeholder="05:00" />
            </div>

            <div className="flex" style={{gap:8}}>
              <button className="btn-outline" onClick={()=>preset(30)}>30s</button>
              <button className="btn-outline" onClick={()=>preset(60)}>1:00</button>
              <button className="btn-outline" onClick={()=>preset(120)}>2:00</button>
              <button className="btn-outline" onClick={()=>preset(300)}>5:00</button>
            </div>

            <div className="text-3xl font-bold" style={{fontVariantNumeric:"tabular-nums"}}>{mmss}</div>

            <div className="flex" style={{gap:8}}>
              <button className="btn" onClick={startPause}>{running ? "Pause" : remaining>0 ? "Démarrer" : "—"}</button>
              <button className="btn-outline" onClick={reset}>Réinitialiser</button>
              <button className="btn-outline" onClick={clearAll}>Effacer</button>
              <button className="btn-outline" onClick={()=>{ ensureAudioContext(); playChime(); }} title="Tester le son">Tester le son 🔊</button>
            </div>

            <div className="flex items-center justify-between" style={{gap:10}}>
              <div className="text-sm" style={{color:"#6b7280"}}>Volume du son</div>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e)=>setVolume(parseFloat(e.target.value))} style={{width:160}} />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm" style={{color:"#6b7280"}}>Notifications bureau : {permission}</div>
              <button className="btn-outline" onClick={askPermission}>Autoriser</button>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
