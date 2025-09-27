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
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
          active ? "bg-emerald-100 text-emerald-800" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className="space-y-2">
      <Item href="/dashboard" label="Accueil" icon="🏠" />
      <Item href="/dashboard/calories" label="Calories" icon="🔥" />
      <Item href="/dashboard/corrector" label="Correcteur IA" icon="🧠" />
      <Item href="/dashboard/profile" label="Profil" icon="💪" />
      <Item href="/dashboard/abonnement" label="Abonnement" icon="💳" />
    </nav>
  );
}
