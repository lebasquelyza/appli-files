// apps/web/app/dashboard/music/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MusicPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Musique</h1>
      <div>Ping — route /dashboard/music OK ✅</div>
    </main>
  );
}


