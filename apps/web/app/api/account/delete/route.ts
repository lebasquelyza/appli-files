// app/api/account/delete/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Vérifier le token pour obtenir l'UID
  const supaAnon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: userData, error: uErr } = await supaAnon.auth.getUser(token);
  if (uErr || !userData?.user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Supprimer avec la clé service role (sécurité: ne JAMAIS l’exposer au client)
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: dErr } = await admin.auth.admin.deleteUser(userData.user.id);

  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
