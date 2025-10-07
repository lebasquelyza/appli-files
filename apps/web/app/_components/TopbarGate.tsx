// apps/web/app/_components/TopbarGate.tsx
"use client";

import { usePathname } from "next/navigation";
// ⬇️ Chemin CORRECT vers le composant réel
import ClientTopbar from "../dashboard/_components/ClientTopbar";

// Pages où on cache le bouton/menu (page d’accueil, login, signup)
const HIDE_PATHS = new Set<string>(["/", "/signin", "/signup"]);

export default function TopbarGate() {
  const pathname = usePathname() || "/";
  if (HIDE_PATHS.has(pathname)) return null;
  return <ClientTopbar />;
}
