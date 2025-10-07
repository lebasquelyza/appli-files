// apps/web/app/dashboard/_components/TopbarGate.tsx
"use client";

import ClientTopbar from "./ClientTopbar";

/**
 * Ce gate dashboard ne fait rien de spécial :
 * on affiche juste la topbar du dashboard.
 * (L'autre gate global, dans app/_components/TopbarGate.tsx,
 * s'occupe de cacher le bouton sur /, /signin, /signup.)
 */
export default function TopbarGate() {
  return <ClientTopbar />;
}
