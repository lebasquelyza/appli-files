// apps/web/app/music/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ConnectSpotifyButton from "@/components/ConnectSpotifyButton";

export const dynamic = "force-dynamic";

export default async function MusicPage() {
  const session = await getServerSession(authOptions);
  const spotify = (session as any)?.spotify;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Musique</h1>
      {!spotify?.accessToken ? (
        <ConnectSpotifyButton />
      ) : (
        <div>Spotify est connecté ✅</div>
      )}
    </main>
  );
}
