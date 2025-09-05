"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string|null>(null);
  const [text, setText] = useState(""); const [tips, setTips] = useState<string[]>([]);
  useEffect(()=>{(async()=>{try{ const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false });
    if(videoRef.current) videoRef.current.srcObject = stream;
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = e=>setChunks(p=>[...p,e.data]);
    mr.onstop = ()=>{ const blob = new Blob(chunks, { type:"video/webm" }); setUrl(URL.createObjectURL(blob)); setChunks([]); };
    mediaRecorderRef.current = mr;}catch(e){ console.error(e); }})()},[chunks]);
  function start(){ setUrl(null); setRecording(true); mediaRecorderRef.current?.start(); }
  function stop(){ setRecording(false); mediaRecorderRef.current?.stop(); }
  async function ask(){ const j = await (await fetch("/api/ai/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ text })})).json(); setTips(j.tips||[]); }

  return (
    <>
      <PageHeader title="Files te corrige" subtitle="Filme-toi, décris tes sensations et reçois des tips" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Enregistrement">
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" style={{background:"rgba(0,0,0,.06)"}} />
          <div className="flex gap-8" style={{marginTop:12}}>
            {!recording ? <button className="btn" onClick={start}>Enregistrer</button> : <button className="btn" onClick={stop}>Stop</button>}
            {url && <a className="btn-outline" href={url} download="exercice.webm">Télécharger</a>}
          </div>
        </Section>

        <Section title="Tes sensations">
          <textarea className="input" style={{height:120}} value={text} onChange={e=>setText(e.target.value)} placeholder="Ex: gêne au genou droit en squat…" />
          <div style={{marginTop:10}}><button className="btn" onClick={ask}>Obtenir des tips</button></div>
          <ul className="list-disc pl-6" style={{marginTop:10}}>{tips.map((t,i)=><li key={i}>{t}</li>)}</ul>
        </Section>
      </div>
    </>
  );
}
