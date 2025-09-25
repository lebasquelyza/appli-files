"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Icônes SVG inline (aucune lib externe) */
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconVideo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1l4-2.5V18.5L15 16v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path d="M4 20V4M20 20H4M8 16v-5M12 20V8M16 20v-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-9 2.5 2.2-.9a8 8 0 0 0 1.5 0l.8 2.2h6l.8-2.2a8 8 0 0 0 1.5 0l2.2.9 3-5-2-1.5a8 8 0 0 0 0-1.5l2-1.5-3-5-2.2.9a8 8 0 0 0-1.5 0L13 2H7l-.8 2.2a8 8 0 0 0-1.5 0L2.5 3.3l-3 5L1.5 10a8 8 0 0 0 0 1.5L-.5 13l3 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Séparateur simple */
function Separator({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-border ${className}`} />;
}

/** NAV: toutes les entrées demandées sous /dashboard/... */
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

function useActiveTitle(pathname: string | null) {
  return useMemo(() => {
    if (!pathname) return "Dashboard";
    const match =
      [...NAV].sort((a, b) => b.href.length - a.href.length).find((r) => pathname.startsWith(r.href)) ||
      null;
    return match?.label ?? "Dashboard";
  }, [pathname]);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = useActiveTitle(pathname);
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-[calc(var(--vh,1vh)*100)] flex flex-col">
      {/* TOP BAR */}
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-xl h-9 w-9 p-0 inline-grid place-items-center"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir la navigation"
          >
            <IconMenu />
          </Button>
          <div className="flex-1 truncate text-base font-medium">{title}</div>
        </div>
      </div>

      {/* DRAWER */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[84%] sm:w-80 bg-background border-r shadow-lg animate-in slide-in-from-left"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4">
              <div className="text-base font-medium">Navigation</div>
            </div>
            <Separator />
            <nav className="p-2 space-y-1">
              {NAV.map((item) => {
                const ActiveIcon = item.icon;
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    ].join(" ")}
                  >
                    <ActiveIcon />
                    <span className="truncate">{item.label}</span>
                    {active && <Badge variant="secondary" className="ml-auto">actif</Badge>}
                  </Link>
                );
              })}
            </nav>
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
