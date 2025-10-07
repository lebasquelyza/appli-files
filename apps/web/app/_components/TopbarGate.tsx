// apps/web/app/dashboard/_components/TopbarGate.tsx
"use client";

import { usePathname } from "next/navigation";
import ClientTopbar from "./ClientTopbar"; // ✅ bon chemin

// Si tu veux cacher la topbar pour certaines sous-routes du dashboard, ajoute-les ici
const HIDE = new Set<string>([]);

export default function TopbarGate() {
  const pathname = usePathname() || "/dashboard";
  if (HIDE.has(pathname)) return null;
  return <ClientTopbar />;
}
