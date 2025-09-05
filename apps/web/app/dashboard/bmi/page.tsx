"use client";
import { useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page(){
  const [size,setSize]=useState("170"); const [weight,setWeight]=useState("70");
  const h=parseFloat(size)/100; const w=parseFloat(weight); const bmi=h>0&&w>0?(w/(h*h)):0; const r=Math.round(bmi*10)/10;
  const status=(v:number)=> !isFinite(v)||v<=0?"-": v<18.5? "Insuffisance pondérale" : v<25? "Corpulence normale" : v<30? "Surpoids":"Obésité";

  return (
    <>
      <PageHeader title="Calcul IMC" subtitle="Indice de Masse Corporelle" />
      <Section title="Mon IMC">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Taille (cm)</label><input className="input" type="number" value={size} onChange={e=>setSize(e.target.value)} /></div>
          <div><label className="label">Poids (kg)</label><input className="input" type="number" value={weight} onChange={e=>setWeight(e.target.value)} /></div>
        </div>
        <div className="text-3xl font-bold" style={{marginTop:10}}>{isFinite(r)?r:"-"} <span className="text-base font-normal" style={{color:"#6b7280"}}>IMC</span></div>
        <div className="text-sm" style={{color:"#6b7280"}}>{status(r as any)}</div>
      </Section>
    </>
  );
}
