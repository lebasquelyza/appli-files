"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden {...props}>
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

const NAV = [
  { href: "/dashboard/abonnement", label: "abonnement", icon: IconHome },
  { href: "/dashboard/bmi", label: "bmi", icon: IconChart },
  { href: "/dashboard/calories", label: "calories", icon: IconChart },
  { href: "/dashboard/connect", label: "connect", icon: IconVideo },
  { href: "/dashboard/corrector", label: "corrector", icon: IconVideo },
  { href: "/dashboard/muscu", label: "muscu", icon: IconChart },
  { href: "/dashboard/music", label: "music", icon: IconVideo },
  { href: "/dashboard/pricing", label: "pricing", icon: IconChart },
  { href: "/dashboard/profile", label: "profile", icon: IconHome },
  { href: "/dashboard/progress", label: "progress", icon: IconChart },
  { href: "/dashboard/recipes", label: "recipes", icon: IconHome },
  { href: "/dashboard/settings", label: "settings", icon: IconSettings },
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

  const NavItem = ({
    href,
    label,
    Icon,
    active,
  }: {
    href: string;
    label: string;
    Icon: any;
    active: boolean;
  }) => {
    return (
      <button
        onClick={() =>
          startTransition(() => {
            router.push(href);
            setOpen(false);
          })
        }
        className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all ${
          active
            ? "bg-green-600 text-white shadow-md scale-[1.02]"
            : "bg-green-400 text-white hover:bg-green-500"
        }`}
      >
        <Icon />
        <span className="capitalize font-semibold text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div
      className="flex min-h-[calc(var(--vh,1vh)*100)] flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="h-16 flex items-center gap-3 px-4">
          <button
            onClick={() => setOpen(true)}
            className="h-16 w-16 rounded-full bg-green-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {open && (
        <aside
          className="fixed top-0 left-0 bottom-0 z-50 w-[70%] max-w-[20rem] bg-white shadow-2xl p-4 space-y-4 animate-in slide-in-from-left rounded-r-3xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-bold text-green-700">Dashboard</span>
          </div>

          <nav className="flex flex-col gap-2">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={!!active}
                />
              );
            })}
          </nav>
        </aside>
      )}

      <main className="flex-1 px-3 py-4">
        <div className="max-w-screen-md mx-auto">{children}</div>
      </main>
    </div>
  );
}
