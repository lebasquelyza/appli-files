"use client";
import { PageHeader, Section } from "@/components/ui/Page";
import { useState } from "react";

export default function Page() {
  const [h, setH] = useState("170");
  const [w, setW] = useState("70");
  const m = parseFloat(h||"0")/100;
  const imc = m>0 ? (parseFloat(w||"0")/(m*m)) : 0;

  return (
    <>
      <PageHeader title="IMC" subtitle="Calcule ton indice de masse corporelle" />
      <Section title="Calculatrice">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card">
            <label className="label">Taille (cm)</label>
            <input className="input" value={h} onChange={e=>setH(e.target.value)} />
            <label className="label" style={{marginTop:8}}>Poids (kg)</label>
            <input className="input" value={w} onChange={e=>setW(e.target.value)} />
          </div>
          <div className="card">
            <div className="text-3xl font-bold">{imc ? imc.toFixed(1) : "--"}</div>
            <div className="text-sm" style={{color:"#6b7280"}}>18.5–24.9 = normal</div>
          </div>
        </div>
      </Section>
    </>
  );
}
