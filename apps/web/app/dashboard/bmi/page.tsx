"use client";
import { Section } from "@/components/ui/Page";
import { useState } from "react";

export default function Page() {
  const [h, setH] = useState("170");
  const [w, setW] = useState("70");
  const m = parseFloat(h || "0") / 100;
  const imc = m > 0 ? parseFloat(w || "0") / (m * m) : 0;

  return (
    <div
      className="container"
      style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}
    >
      {/* Header — mêmes tailles + même placement que les autres pages */}
      <div className="page-header">
        <div>
          <h1
            className="h1"
            style={{ marginBottom: 2, fontSize: "clamp(20px, 2.2vw, 24px)", lineHeight: 1.15 }}
          >
            IMC
          </h1>
          <p
            className="lead"
            style={{ marginTop: 4, fontSize: "clamp(12px, 1.6vw, 14px)", lineHeight: 1.35, color: "#4b5563" }}
          >
            Calcule ton indice de masse corporelle
          </p>
        </div>
      </div>

      <Section title="Calculatrice">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card">
            <label className="label">Taille (cm)</label>
            <input className="input" value={h} onChange={(e) => setH(e.target.value)} />
            <label className="label" style={{ marginTop: 8 }}>
              Poids (kg)
            </label>
            <input className="input" value={w} onChange={(e) => setW(e.target.value)} />
          </div>
          <div className="card">
            <div className="text-3xl font-bold">{imc ? imc.toFixed(1) : "--"}</div>
            <div className="text-sm" style={{ color: "#6b7280" }}>
              18.5–24.9 = normal
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
