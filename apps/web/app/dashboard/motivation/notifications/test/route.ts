import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // ici tu devrais utiliser la session (next-auth) pour trouver l’email réel
  const email = "test@example.com"; // à remplacer par l’email du user

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_email: email,
      title: "Notif de test 🔔",
      message:
        "Ceci est une vraie notification stockée en base. Tu peux maintenant les lister, marquer comme lues, etc.",
      created_at: now,
      source: "Files Coaching (test)",
      read: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "supabase error" }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    message: data.message,
    createdAt: data.created_at,
    read: data.read,
    source: data.source,
    rating: data.rating,
  });
}
