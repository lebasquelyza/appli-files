// apps/web/app/dashboard/seance/[id]/PrintButton.tsx
"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
      type="button"
    >
      Imprimer
    </button>
  );
}
