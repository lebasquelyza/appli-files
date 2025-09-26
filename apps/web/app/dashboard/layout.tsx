"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/* ========= Icônes (inline, légères) ========= */
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden {...props}>
      <path d="M4 8h16M4 12h16M4 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function IconHome(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...p}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconVideo(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1l4-2.5V18.5L15 16v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconChart(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...p}>
      <path d="M4 20V4M20 20H4M8 16v-5M12 20V8M16 20v-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSettings(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...p}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-9 2.5 2.2-.9a8 8 0 0 0 1.5 0l.8 2.2h6l.8-2.2a8 8 0 0 0 1.5 0l2.2.9 3-5-2-1.5a8 8 0 0 0 0-1.5l2-1.5-3-5-2.2.9a8 8 0 0 0-1.5 0L13 2H7l-.8 2.2a8 8 0 0 0-1.5 0L2.5 3.3l-3 5L1.5 10a8 8 0 0 0 0 1.5L-.5 13l3 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ========= Navigation ========= */
const NAV = [
  { href: "/dashboard/abonnement", label: "abonnement", icon: IconHome },
  { href: "/dashboard/bmi",        label: "bmi",        icon: IconChart },
  { href: "/dashboard/calories",   label: "calories",   icon: IconChart },
  { href: "/dashboard/connect",    label: "connect",    icon: IconVideo },
  { href: "/dashboard/corrector",  label: "corrector",  icon: IconVideo },
  { href: "/dashboard/muscu",      label: "muscu",      icon: IconChart },
  { href: "/dashboard/music",      label: "music",      icon: IconVideo },
  { href: "/dashboard/pricing",    label: "pricing",    icon: IconChart },
  { href: "/dashboard/profile",    label: "profile",    icon: IconHome },
  { href: "/dashboard/progress",   label: "progress",   icon: IconChart },
  { href: "/dashboard/recipes",    label: "recipes",    icon: IconHome },
  { href: "/dashboard/settings",   label: "settings",   icon: IconSettings },
] as const;

/* ========= Barre de chargement (optionnelle) ========= */
function LoadingBar({ show }: { show: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[2px] overflow-hidden transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
      aria-hidden
    >
      <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] bg-foreground/80" />
      <style jsx>{`@keyframes loading{0%{transform:translateX(-100%)}50%{transform:translateX(50%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}

function useActiveTitle(pathname: string | null) {
  return useMemo(() => {
    if (!pathname) return "Dashboard";
    const m = [...NAV].sort((a,b)=>b.href.length-a.href.length).find(r=>pathname?.startsWith(r.href)) || null;
    return m?.label ?? "Dashboard";
  }, [pathname]);
}

/* ========= Layout ========= */
export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useActiveTitle(pathname);

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // iOS 100vh fix
  useEffect(() => {
    const setVH = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    setVH(); window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  // Couleurs brand
  const brandGreen = "#16A34A"; // vert bouton/hamburger
  const lightGreen = "#22C55E"; // vert clair harmonisé

  /* ---- Item de navigation (pastille moderne) ---- */
  const NavItem = ({
    href, label, Icon, active,
  }: {
    href: string; label: string; Icon: any; active: boolean;
  }) => {
    const style: React.CSSProperties = active
      ? {
          background: `linear-gradient(180deg, ${brandGreen} 0%, #0E7A35 100%)`,
          color: "#FFFFFF",
          borderColor: "transparent",
          boxShadow: "0 10px 24px rgba(22,163,74,0.22)",
        }
      : {
          background: `linear-gradient(180deg, ${lightGreen} 0%, #16B455 100%)`,
          color: "#FFFFFF",
          borderColor: "transparent",
          boxShadow: "0 8px 18px rgba(34,197,94,0.20)",
        };

    return (
      <button
        onClick={() =>
          startTransition(() => {
            router.push(href);
            setOpen(false); // ferme au clic
          })
        }
        style={style}
        className="group w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl
                   transition will-change-transform hover:translate-x-[2px] active:scale-[0.99]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 text-current">
          <Icon />
        </span>
        <span className="truncate capitalize flex-1 font-semibold tracking-wide">
          {label}
        </span>
        <span className="opacity-80 group-hover:opacity-100 transition" aria-hidden>›</span>
      </button>
    );
  };

  return (
    <div
      className="flex min-h-[calc(var(--vh,1vh)*100)] flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <LoadingBar show={isPending} />

      {/* ---- Top bar ---- */}
      <div className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-16 px-3 sm:px-4 flex items-center gap-3">
          {/* Hamburger : 64px arrondi, proéminent */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir la navigation"
            style={{ backgroundColor: brandGreen, color: "#fff" }}
            className="h-16 w-16 inline-grid place-items-center rounded-full shadow-2xl
                       hover:brightness-[1.06] active:scale-95 transition"
          >
            <IconMenu />
          </button>
          <div className="flex-1" />
        </div>
      </div>

      {/* ---- Panneau Dashboard (flottant, verre dépoli) ---- */}
      {open && (
        <aside
          className="fixed left-0 top-0 bottom-0 z-50 w-[68%] sm:w-80
                     rounded-r-3xl border border-white/30 shadow-[0_24px_60px_rgba(0,0,0,0.2)]
                     bg-white/70 backdrop-blur-xl
                     animate-in slide-in-from-left duration-200 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          style={{ paddingLeft: "env(safe-area-inset-left)" }}
        >
          {/* démarre sous le header */}
          <div className="pt-16">
            {/* En-tête Dashboard */}
            <div className="px-4 pb-3 flex items-center gap-3">
              <span
                className="grid h-8 w-8 place-items-center rounded-xl"
                style={{ backgroundColor: brandGreen, color: "#fff" }}
              >
                {/* petite icône "stat" */}
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="M4 20V4M20 20H4M8 16v-5M12 20V8M16 20v-7" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
              <span className="text-base font-semibold tracking-wide">Dashboard</span>
            </div>

            {/* Liste des onglets – collés en haut/gauche, pastilles vertes */}
            <nav className="px-3 pb-6 space-y-2">
              {NAV.map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    Icon={Icon}
                    active={!!active}
                  />
                );
              })}
            </nav>
          </div>
        </aside>
      )}

      {/* ---- Contenu de page ---- */}
      <main className="flex-1 px-3 sm:px-4 py-4">
        <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md">
          {children}
        </div>
      </main>
    </div>
  );
}
