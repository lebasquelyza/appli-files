import { NextResponse } from "next/server";

export const runtime = "nodejs"; // s'assure d'être côté serveur

function toVideoUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}
function toEmbedUrl(id: string) {
  return `https://www.youtube.com/embed/${id}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const max = Math.min(Number(searchParams.get("max") || 5), 10);
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY", items: [] },
      { status: 500 }
    );
  }
  if (!q.trim()) {
    return NextResponse.json({ items: [] });
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(max));
  // Requête FR, orientée “démonstration exercice”
  url.searchParams.set("q", `${q} exercice démonstration tutoriel`);
  url.searchParams.set("relevanceLanguage", "fr");
  url.searchParams.set("regionCode", "FR");
  url.searchParams.set("safeSearch", "moderate");

  const r = await fetch(url.toString());
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ error: `YouTube error: ${t}` }, { status: 502 });
  }

  const data: any = await r.json();
  const items = (data.items || []).map((it: any) => {
    const id = it?.id?.videoId as string;
    const s = it?.snippet || {};
    return {
      id,
      title: s.title,
      channel: s.channelTitle,
      thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url,
      url: toVideoUrl(id),
      embed: toEmbedUrl(id),
      publishedAt: s.publishedAt,
    };
  });

  return NextResponse.json({ items });
}
