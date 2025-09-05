"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

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
  // Musique (inchangé)
  const [link,setLink]=useState("https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh");

  // Minuteur (nouveau)
  const [input, setInput] = useState("05:00");     // format mm:ss
  const [remaining, setRemaining] = useState(300); // en secondes
  const [running, setRunning] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const tickRef = useRef<number|null>(null);
  const endBeepRef = useRef<HTMLAudioElement|null>(null);

  useEffect(()=>{ setPermission(Notification?.permission ?? "default"); },[]);

  // Lance / stoppe l’intervalle proprement
  useEffect(()=>{
    if (running && remaining > 0) {
      tickRef.current = window.setInterval(()=> {
        setRemaining(t => {
          if (t <= 1) {
            // Fin du compte à rebours
            window.clearInterval(tickRef.current!);
            tickRef.current = null;
            setRunning(false);
            try {
              endBeepRef.current?.play().catch(()=>{});
            } catch {}
            if (permission === "granted") {
              new Notification("Minuteur terminé ⏰", { body: "Bien joué !" });
            } else {
              alert("Minuteur terminé ⏰");
            }
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

  function setFromInput(v: string) {
    setInput(v);
    const secs = toSeconds(v);
    if (secs > 0) setRemaining(secs);
  }

  function preset(secs: number) {
    setRunning(false);
    setRemaining(secs);
    setInput(toMMSS(secs));
  }

  function startPause() {
    if (remaining <= 0) return;
    setRunning(r => !r);
  }

  function reset() {
    setRunning(false);
    setRemaining(toSeconds(input) || 0);
  }

  function clearAll() {
    setRunning(false);
    setRemaining(0);
    setInput("00:00");
  }

  function askPermission(){
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(setPermission);
  }

  const mmss = toMMSS(remaining);

  return (
    <>
      <PageHeader title="Musique & minuteur" subtitle="Lis ta musique et lance un compte à rebours" />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bloc Musique */}
        <Section title="Musique">
          <label className="label">Lien Spotify</label>
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
        </Section>

        {/* Bloc Minuteur */}
        <Section title="Minuteur">
          <div className="card" style={{display:"grid", gap:12}}>
            {/* Saisie mm:ss */}
            <div>
              <label className="label">Durée (mm:ss)</label>
              <input
                className="input"
                value={input}
                onChange={e=>setFromInput(e.target.value.replace(/[^\d:]/g, ""))}
                placeholder="05:00"
              />
            </div>

            {/* Presets */}
            <div className="flex" style={{gap:8}}>
              <button className="btn-outline" onClick={()=>preset(30)}>30s</button>
              <button className="btn-outline" onClick={()=>preset(60)}>1:00</button>
              <button className="btn-outline" onClick={()=>preset(120)}>2:00</button>
              <button className="btn-outline" onClick={()=>preset(300)}>5:00</button>
            </div>

            {/* Affichage temps restant */}
            <div className="text-3xl font-bold" style={{fontVariantNumeric:"tabular-nums"}}>
              {mmss}
            </div>

            {/* Actions */}
            <div className="flex" style={{gap:8}}>
              <button className="btn" onClick={startPause}>{running ? "Pause" : remaining>0 ? "Démarrer" : "—"}</button>
              <button className="btn-outline" onClick={reset}>Réinitialiser</button>
              <button className="btn-outline" onClick={clearAll}>Effacer</button>
            </div>

            {/* Notifications desktop */}
            <div className="flex items-center justify-between">
              <div className="text-sm" style={{color:"#6b7280"}}>Notifications bureau : {permission}</div>
              <button className="btn-outline" onClick={askPermission}>Autoriser</button>
            </div>
          </div>

          {/* petit bip local à la fin */}
          <audio ref={endBeepRef}>
            <source src="data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAAAAP8AAP8A/wD/AP8A/wD/AP8A/wD/AP8A" type="audio/wav" />
          </audio>
        </Section>
      </div>
    </>
  );
}
