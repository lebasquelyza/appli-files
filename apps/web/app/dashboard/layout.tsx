"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden {...props}>
      <path d="M4 8h16M4 12h16M4 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const NAV = [
  { href: "/dashboard/abonnement", label: "abonnement", icon: IconHome },
  { href: "/dashboard/bmi", label: "bmi", icon: IconHome },
  { href: "/dashboard/calories", label: "calories", icon: IconHome },
  { href: "/dashboard/connect", label: "connect", icon: IconHome },
  { href: "/dashboard/corrector", label: "corrector", icon: IconHome },
  { href: "/dashboard/muscu", label: "muscu", icon: IconHome },
  { href: "/dashboard/music", label: "music", icon: IconHome },
  { href: "/dashboard/pricing", label: "pricing", icon: IconHome },
  { href: "/dashboard/profile", label: "profile", icon: IconHome },
  { href: "/dashboard/progress", label: "progress", icon: IconHome },
  { href: "/dashboard/recipes", label: "recipes", icon: IconHome },
  { href: "/dashboard/settings", label: "settings", icon: IconHome },
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const setVH = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  return (
    <div className="flex min-h-[calc(var(--vh,1vh)*100)] flex-col">
      {/* --- TOP BAR --- */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b flex items-center px-4 h-16">
        <button
          onClick={() => setOpen(!open)}
          className="h-14 w-14 rounded-full bg-green-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <IconMenu />
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      {open && (
        <aside
          className="fixed top-0 left-0 bottom-0 z-50 w-[75%] max-w-[20rem] bg-white shadow-xl p-4 flex flex-col animate-in slide-in-from-left"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <h2 className="text-2xl font-bold text-green-700 mb-6 pl-2">Dashboard</h2>

          {/* Navigation en colonne */}
          <nav className="flex flex-col gap-3">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    startTransition(() => {
                      router.push(item.href);
                      setOpen(false); // ← ferme au clic
                    });
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl text-left transition-all ${
                    active
                      ? "bg-green-600 text-white shadow-md scale-[1.02]"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  <Icon />
                  <span className="capitalize text-base font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* --- CONTENU --- */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="max-w-screen-md mx-auto">{children}</div>
      </main>
    </div>
  );
}

