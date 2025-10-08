// apps/web/app/dashboard/_components/ClientTopbar.tsx
"use client";

export default function ClientTopbar() {
  return (
    <header
      className="fixed inset-x-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 h-10 flex items-center justify-between">
        {/* Titre statique, plus de bouton */}
        <span className="font-bold text-lg leading-none select-none">
          Files Coaching
        </span>
        <div />
      </div>
    </header>
  );
}
