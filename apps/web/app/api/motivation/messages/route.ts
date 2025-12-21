// apps/web/app/api/motivation/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/**
 * POST /api/motivation/messages
 * - ME    => crée une programmation COACH (Files Le Coach)
 * - FRIENDS => crée une programmation CUSTOM + recipients sélectionnés
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { target, content, days, time, recipientIds } = body as {
    target: string;
    content?: string;
    days: DayKey[];
    time: string; // HH:mm
    recipientIds?: string[]; // NEW for FRIENDS
  };

  const normTarget = normalizeTarget(target);

  if (!validateDays(days) || days.length === 0) {
    return NextResponse.json({ error: "At least one valid day is required" }, { status: 400 });
  }

  if (!time || typeof time !== "string" || !isValidTimeHHmm(time)) {
    return NextResponse.json({ error: "Invalid time (expected HH:mm)" }, { status: 400 });
  }

  if (normTarget === "ME") {
    // COACH mode: le contenu réellement envoyé sera choisi au moment du cron
    const msg = await prisma.motivationMessage.create({
      data: {
        userId,
        target: "ME",
        mode: "COACH",
        content: (content ?? "").slice(0, 240), // ignoré pour l'envoi, mais gardé si tu veux
        days: daysArrayToString(days),
        time,
        active: true,
      },
    });

    return NextResponse.json(msg, { status: 201 });
  }

  // FRIENDS: CUSTOM + recipients obligatoires
  const trimmed = (content ?? "").trim();
  if (!trimmed) return NextResponse.json({ error: "Missing content" }, { status: 400 });
  if (trimmed.length > 240) {
    return NextResponse.json({ error: "Content too long (max 240 chars)" }, { status: 400 });
  }

  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: "Select at least one friend" }, { status: 400 });
  }

  // Vérifie que ce sont bien des amis ACCEPTED (sinon on refuse)
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

  const msg = await prisma.motivationMessage.create({
    data: {
      userId,
      target: "FRIENDS",
      mode: "CUSTOM",
      content: trimmed,
      days: daysArrayToString(days),
      time,
      active: true,
      recipients: {
        create: recipientIds.map((rid) => ({
          recipientUserId: rid,
        })),
      },
    },
    include: { recipients: true },
  });

  return NextResponse.json(msg, { status: 201 });
}

/**
 * GET /api/motivation/messages
 * Liste les programmations de l'utilisateur connecté
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await prisma.motivationMessage.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    include: { recipients: true },
  });

  return NextResponse.json(messages);
}
