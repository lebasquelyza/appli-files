"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

/* ====== Icônes ====== */
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path d="M4 8h16M4 12h16M4 16h16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconHome(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...p}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconVideo(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1l4-2.5V18.5L15 16v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconChart(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...p}>
      <path d="M4 20V4M20 20H4M8 16v-5M12 20V8M16 20v-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSettings(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...p}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-9 2.5 2.2-.9a8 8 0 0 0 1.5 0l.8 2.2h6l.8-2.2a8 8 0 0 0 1.5 0l2.2.9 3-5-2-1.5a8 8 0 0 0 0-1.5l2-1.5-3-5-2.2.9a8 8 0 0 0-1.5 0L13 2H7l-.8 2.2a8 8 0 0 0-1.5 0L2.5 3.3l-3 5L1.5 10a8 8 0 0 0 0 1.5L-.5 13l3 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ====== NAV ====== */
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

/* ====== Loading bar ====== */
function LoadingBar({ show }: { show: boolean }) {
  return (
    <div className={`pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[2px] overflow-hidden transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`} aria-hidden>
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useActiveTitle(pathname);

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // iOS 100vh fix
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  const NavLink = ({ href, label, Icon, active }: { href: string; label: string; Icon: any; active: boolean }) => {
    const style: React.CSSProperties = active
      ? { backgroundColor: "#16A34A", color: "#FFFFFF", borderColor: "#16A34A" }
      : { backgroundColor: "#FFFFFF", color: "#15803D", borderColor: "#d1fae5" }; // green-100 approx

    return (
      <button
        onClick={() =>
          startTransition(() => {
            router.push(href);
            setOpen(false);
          })
        }
        // >>>> COULEUR APPLIQUÉE DIRECTEMENT SUR LE BOUTON (plus de noir)
        style={style}
        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition outline-none border shadow-sm"
      >
        <span className="text-current"><Icon /></span>
        <span className="truncate capitalize flex-1">{label}</span>
        {active && <Badge className="ml-auto border-0" style={{ backgroundColor: "rgba(255,255,255,.15)", color: "#fff" }}>actif</Badge>}
      </button>
    );
  };

  return (
    <div className="flex min-h-[calc(var(--vh,1vh)*100)] flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <LoadingBar show={isPending} />

      {/* TOP BAR */}
      <div className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir la navigation"
            style={{ backgroundColor: "#16A34A", color: "#fff" }}
            className="h-10 w-10 inline-grid place-items-center rounded-none shadow-sm"
          >
            <IconMenu />
          </button>
          <div className="flex-1" />
        </div>
      </div>

      {/* DRAWER */}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm pointer-events-none" />

          <aside
            className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-[22rem]
                       bg-gradient-to-b from-background to-muted/40 border-r shadow-xl rounded-r-2xl
                       animate-in slide-in-from-left duration-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            style={{ paddingLeft: "env(safe-area-inset-left)" }}
          >
            {/* tout commence SOUS le header (56px) */}
            <div className="h-full grid grid-cols-[2.2rem_1fr]" style={{ paddingTop: 56 }}>
              {/* colonne gauche : Dashboard, aligné au 1er onglet */}
              <div className="col-[1] h-full flex items-start justify-center">
                <span
                  className="mt-1 text-[12px] font-semibold tracking-wider text-foreground/80 select-none"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  Dashboard
                </span>
              </div>

              {/* colonne droite : liste */}
              <div className="col-[2] h-full overflow-y-auto">
                <nav className="p-2 space-y-2">
                  {NAV.map((item) => {
                    const active = pathname?.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <NavLink
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
            </div>
          </aside>
        </>
      )}

      {/* CONTENU */}
      <main className="flex-1 px-3 sm:px-4 py-4">
        <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md">
          {children}
        </div>
      </main>
    </div>
  );
}
