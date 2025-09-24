"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Menu, Activity, Settings, Video, Home } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/dashboard/corrector", label: "Correcteur", icon: Video },
  { href: "/dashboard/progress", label: "Progression", icon: Activity },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-[calc(var(--vh,1vh)*100)] flex flex-col">
      {/* TOP BAR */}
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[84%] sm:w-80 p-0">
              <div className="p-4">
                <SheetHeader>
                  <SheetTitle className="text-base">Navigation</SheetTitle>
                </SheetHeader>
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
                      onClick={() => setMenuOpen(false)}
                      className={[
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <ActiveIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active && <Badge variant="secondary" className="ml-auto">actif</Badge>}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex-1 truncate text-base font-medium">
            {title}
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <main className="flex-1 px-3 sm:px-4 py-4">
        <div className="mx-auto w-full max-w-screen-sm sm:max-w-screen-md">
          {children}
        </div>
      </main>
    </div>
  );
}
