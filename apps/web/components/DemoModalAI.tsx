// apps/web/components/DemoModalAI.tsx
"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

type Props = {
  open: boolean;
  closeHref: string; // on passe une URL (pas de fonction depuis le Server Component)
  exercise: string;
  level?: "debutant" | "intermediaire" | "avance";
  injuries?: string[];
};

export default function DemoModalAI({ open, closeHref, exercise, level, injuries }: Props) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => setIsOpen(open), [open]);

  const handleClose = () => {
    window.location.href = closeHref; // navigation côté client
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 top-[10%] mx-auto w-[min(96vw,680px)] rounded-2xl bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold">Démo IA — {exercise}</h3>
            <button onClick={handleClose} className="rounded-md border px-2 py-1 text-sm">
              Fermer
            </button>
          </div>

          {/* Contenu simple (tu peux brancher ton moteur ici plus tard) */}
          <div className="mt-3 text-sm text-neutral-700 space-y-3">
            <p>
              <b>Niveau:</b> {level || "—"} {injuries?.length ? <span> · <b>Blessures:</b> {injuries.join(", ")}</span> : null}
            </p>
            <div className="rounded-lg border bg-neutral-50 p-3 text-neutral-800">
              <p className="mb-2">
                Voici une courte description pour <b>{exercise}</b> :
              </p>
              <ul className="list-disc pl-5">
                <li>Positionne-toi correctement et engage le tronc.</li>
                <li>Contrôle la phase excentrique (descente) et concentrique (montée).</li>
                <li>Respire régulièrement, garde une amplitude confortable.</li>
              </ul>
            </div>
            {/* Placeholder vidéo : remplace par un lecteur/iframe ou une recherche pilotée plus tard */}
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black/5">
              <iframe
                title={`Demo ${exercise}`}
                className="h-full w-full"
                src={`https://www.youtube.com/embed?autoplay=0&mute=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

