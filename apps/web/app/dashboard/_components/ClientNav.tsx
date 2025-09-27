// apps/web/app/dashboard/_components/ClientNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ClientNav() {
  const pathname = usePathname();

  const Item = ({ href, label, icon }: { href: string; label: string; icon: string }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition
        ${active ? "bg-black text-white" : "hover:bg-gray-100 text-gray-800"}`}
        aria-current={active ? "page" : undefined}
      >
        <span className={`text-base leading-none ${active ? "" : "opacity-80 group-hover:opacity-100"}`}>{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="space-y-1">
      <Item href="/dashboard" label="Accueil" icon="🏠" />
      <Item href="/dashboard/calories" label="Calories" icon="🔥" />
      <Item href="/dashboard/corrector" label="Correcteur IA" icon="🧠" />
      <Item href="/dashboard/profile" label="Profil" icon="💪" />
      <Item href="/dashboard/abonnement" label="Abonnement" icon="💳" />
      <div className="h-2" />
      <Item href="/dashboard/files-coaching" label="Files Coaching" icon="📁" />
    </nav>
  );
}
