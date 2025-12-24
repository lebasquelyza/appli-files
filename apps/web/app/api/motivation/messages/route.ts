// apps/web/app/api/motivation/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Target = "ME" | "FRIENDS";

function normalizeTarget(target: string): Target {
  return target === "FRIENDS" ? "FRIENDS" : "ME";
}

function validateDays(days: unknown): days is DayKey[] {
  if (!Array.isArray(days)) return false;
  const allowed: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return days.every((d) => allowed.includes(d as DayKey));
}

function daysArrayToString(days: DayKey[]): string {
  return days.join(",");
}

function isValidTimeHHmm(time: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { target, content, days, time, recipientIds } = body as {
      target: string;
      content?: string;
      days: DayKey[];
      time: string;
      recipientIds?: string[];
    };

    const normTarget = normalizeTarget(target);

    if (!validateDays(days) || days.length === 0) {
      return NextResponse.json({ error: "At least one valid day is required" }, { status: 400 });
    }

    if (!time || typeof time !== "string" || !isValidTimeHHmm(time)) {
      return NextResponse.json({ error: "Invalid time (expected HH:mm)" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ✅ ME => COACH
    if (normTarget === "ME") {
      const msg = await supabase
        .from("motivation_messages")
        .insert({
          user_id: userId,
          target: "ME",
          mode: "COACH",
          content: (content ?? "").trim().slice(0, 240),
          days: daysArrayToString(days),
          time,
          active: true,
        })
        .select("*")
        .single();

      if (msg.error) return NextResponse.json({ error: msg.error.message }, { status: 500 });
      return NextResponse.json(msg.data, { status: 201 });
    }

    // ✅ FRIENDS => CUSTOM + recipients
    const trimmed = (content ?? "").trim();
    if (!trimmed) return NextResponse.json({ error: "Missing content" }, { status: 400 });
    if (trimmed.length > 240) return NextResponse.json({ error: "Content too long (max 240 chars)" }, { status: 400 });

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: "Select at least one friend" }, { status: 400 });
    }

    // Vérifie ACCEPTED (Prisma)
    const relations = await prisma.friendRequest.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: { in: recipientIds } },
          { addresseeId: userId, requesterId: { in: recipientIds } },
        ],
      },
    });

    const friendSet = new Set<string>();
    for (const r of relations) {
      friendSet.add(r.requesterId === userId ? r.addresseeId : r.requesterId);
    }

    const invalid = recipientIds.filter((id) => !friendSet.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "Some recipients are not your accepted friends" }, { status: 400 });
    }

    const msg = await supabase
      .from("motivation_messages")
      .insert({
        user_id: userId,
        target: "FRIENDS",
        mode: "CUSTOM",
        content: trimmed,
        days: daysArrayToString(days),
        time,
        active: true,
      })
      .select("*")
      .single();

    if (msg.error) return NextResponse.json({ error: msg.error.message }, { status: 500 });

    const rows = recipientIds.map((rid) => ({
      message_id: msg.data.id,
      recipient_user_id: rid,
    }));

    const rec = await supabase.from("motivation_recipients").insert(rows);
    if (rec.error) return NextResponse.json({ error: rec.error.message }, { status: 500 });

    return NextResponse.json(
      {
        ...msg.data,
        recipients: recipientIds.map((rid) => ({ recipientUserId: rid })),
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();

    const msgs = await supabase
      .from("motivation_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (msgs.error) return NextResponse.json({ error: msgs.error.message }, { status: 500 });

    const ids = (msgs.data || []).map((m: any) => m.id);
    let recipientsByMsg: Record<string, Array<{ recipientUserId: string }>> = {};

    if (ids.length) {
      const recs = await supabase
        .from("motivation_recipients")
        .select("message_id, recipient_user_id")
        .in("message_id", ids);

      if (recs.error) return NextResponse.json({ error: recs.error.message }, { status: 500 });

      for (const r of recs.data || []) {
        const mid = (r as any).message_id as string;
        const rid = (r as any).recipient_user_id as string;
        if (!recipientsByMsg[mid]) recipientsByMsg[mid] = [];
        recipientsByMsg[mid].push({ recipientUserId: rid });
      }
    }

    const payload = (msgs.data || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      target: m.target,
      mode: m.mode,
      content: m.content,
      days: m.days,
      time: m.time,
      active: m.active,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      recipients: recipientsByMsg[m.id] || [],
    }));

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: "fatal", message: String(e?.message || e) }, { status: 500 });
  }
}
