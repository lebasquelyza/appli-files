"use client";

import { usePathname } from "next/navigation";
// ⬇️ importe la vraie topbar qui existe chez toi
import ClientTopbar from "../dashboard/_components/ClientTopbar";

// Pages où on NE veut PAS afficher le bouton/menu (hamburger)
const HIDE = new Set<string>(["/", "/signin", "/signup"]);

export default function TopbarGate() {
  const pathname = usePathname() || "/";

  if (HIDE.has(pathname)) {
    // Ne rien rendre -> plus de bouton menu sur /, /signin, /signup
    return null;
  }

  return <ClientTopbar />;
}
