import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ clé sécurisée côté serveur
);

export async function GET(req: Request) {
  // ici tu peux utiliser next-auth pour récupérer l’email
  // ou un header, etc. Pour l’exemple, on prend un query param
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_email", email)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "supabase error" }, { status: 500 });
  }

  const mapped = data.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    createdAt: n.created_at,
    read: n.read,
    source: n.source,
    rating: n.rating,
  }));

  return NextResponse.json(mapped);
}
