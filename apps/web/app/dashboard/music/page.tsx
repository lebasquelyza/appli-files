"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function MusicPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <main className="p-6">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Musique</h1>
        {session ? (
          <button onClick={() => signOut({ callbackUrl: "/dashboard/music" })} className="btn-dash">Se déconnecter</button>
        ) : (
          <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })} className="btn-dash">Se connecter</button>
        )}
      </div>

      <div className="card">Page minimale OK ✅ — on va rajouter les composants un par un.</div>
    </main>
  );
}

