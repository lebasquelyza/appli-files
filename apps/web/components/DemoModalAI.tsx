"use client";

import { useEffect, useMemo, useState } from "react";

type DemoData = {
  animation?: string;     // ex: squat.glb (si tu ajoutes le rendu 3D plus tard)
  tempo?: string;         // ex: 3011
  cues?: string[];        // consignes courtes
  errors?: string[];      // erreurs fréquentes
  progression?: string;   // variante plus dure
  regression?: string;    // variante plus facile
  camera?: string;        // suggestion angle caméra
  videoKeywords?: string; // mots-clés pour le fallback vidéo
};

export default function DemoModalAI({
  open,
  onClose,
  exercise,
  level,
  injuries,
}: {
  open: boolean;
  onClose: () => void;
  exercise: string;
  level?: string;
  injuries?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<DemoData | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setData(null);

    (async () => {
      try {
        const res = await fetch("/api/exo-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exercise,
            level: level || "débutant",
            injuries: injuries || [],
            language: "fr",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Erreur IA");
        setData(json as DemoData);
      } catch (e: any) {
        setError(e?.message || "Erreur IA");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, exercise, level, injuries]);

  // Fallback vidéo (YouTube embed search) — simple, pas de clé API
  const embedSrc = useMemo(() => {
    const q = data?.videoKeywords || `${exercise} exercice tutoriel`;
    return `https://www.youtube.com/embed?autoplay=1&rel=0&modestbranding=1&listType=search&list=${encodeURIComponent(q)}`;
  }, [data?.videoKeywords, exercise]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(17,24,39,.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"
        style={{ overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="font-semibold">Démo IA — {exercise}</div>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm border border-gray-200 hover:bg-gray-50">Fermer</button>
        </div>

        <div className="grid md:grid-cols-[2fr_1fr] gap-0">
          {/* Player / 3D placeholder */}
          <div className="p-4">
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-200 bg-black/2">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-600">
                  Chargement de la démo IA…
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-red-700 bg-red-50">
                  {error}
                </div>
              ) : (
                <iframe
                  src={embedSrc}
                  className="w-full h-full"
                  title={`Demo ${exercise}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {/* Placeholders pour l'avatar 3D futur
            {data?.animation && (
              <div className="mt-2 text-xs text-gray-600">
                Animation 3D suggérée : <code>{data.animation}</code> (hook à brancher avec three.js)
              </div>
            )} */}
          </div>

          {/* Infos IA */}
          <div className="border-t md:border-l md:border-t-0 border-gray-200 max-h-[70vh] overflow-auto p-4">
            {loading && <div className="text-sm text-gray-500">Analyse IA…</div>}
            {!loading && !error && (
              <div className="space-y-3 text-sm">
                {data?.tempo && (
                  <div>
                    <div className="font-semibold">Tempo</div>
                    <div className="text-gray-700">{data.tempo}</div>
                  </div>
                )}
                {!!(data?.cues?.length) && (
                  <div>
                    <div className="font-semibold">Consignes clés</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {data!.cues!.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {!!(data?.errors?.length) && (
                  <div>
                    <div className="font-semibold">Erreurs fréquentes</div>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {data!.errors!.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {(data?.regression || data?.progression) && (
                  <div className="grid grid-cols-1 gap-2">
                    {data?.regression && (
                      <div>
                        <div className="font-semibold">Régression</div>
                        <div className="text-gray-700">{data.regression}</div>
                      </div>
                    )}
                    {data?.progression && (
                      <div>
                        <div className="font-semibold">Progression</div>
                        <div className="text-gray-700">{data.progression}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
