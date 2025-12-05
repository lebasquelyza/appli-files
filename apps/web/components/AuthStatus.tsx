"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthStatus() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;

  if (!session) {
    return (
      <button onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}>
        Se connecter
      </button>
    );
  }

  const name = session.user?.name ?? "Connecté";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>{name}</span>
      <button onClick={() => signOut({ callbackUrl: "/" })}>Se déconnecter</button>
    </div>
  );
}
