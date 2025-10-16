// apps/web/app/dashboard/seance/[id]/PrintButton.tsx
"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-[.99]"
      aria-label="Imprimer"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M6 7V3h12v4M6 17v4h12v-4M4 13V9h16v4M8 13h8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Imprimer
    </button>
  );
}
