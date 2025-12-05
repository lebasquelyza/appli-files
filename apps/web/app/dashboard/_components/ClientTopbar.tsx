// apps/web/app/dashboard/_components/ClientTopbar.tsx
"use client";

export default function ClientTopbar() {
  const changeLang = (lang: "fr" | "en") => {
    try {
      document.cookie = [
        `fc-lang=${lang}`,
        "Path=/",
        "SameSite=Lax",
        "Max-Age=31536000", // 1 an
      ].join("; ");
      // on recharge pour que les pages serveur (comme /dashboard/avis) lisent la nouvelle langue
      window.location.reload();
    } catch {
      // ignore
    }
  };

  return (
    <header
      className="fixed inset-x-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 h-10 flex items-center justify-between">
        {/* Titre */}
        <span className="font-bold text-lg leading-none select-none">
          Files Coaching
        </span>

        {/* Switch langue à droite */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeLang("fr")}
            className="px-2 py-0.5 rounded-full text-[11px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => changeLang("en")}
            className="px-2 py-0.5 rounded-full text-[11px] border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
