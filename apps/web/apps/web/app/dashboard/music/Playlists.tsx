"use client";
import { useEffect, useState } from "react";

export default function Playlists() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/spotify/playlists", { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setData(j);
      } catch (e: any) {
        setErr(e.message || "Erreur");
      }
    })();
  }, []);

  if (err) return <p style={{color:"crimson"}}>Erreur: {err}</p>;
  if (!data) return <p>Chargement des playlists…</p>;

  const items = data.items ?? [];
  if (!items.length) return <p>Aucune playlist trouvée.</p>;

  return (
    <ul style={{marginTop:12, lineHeight:1.8}}>
      {items.map((p: any) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
