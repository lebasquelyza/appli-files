// apps/web/app/api/motivation/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions"; // adapte le chemin si besoin
import { prisma } from "@/lib/prisma"; // adapte selon ton projet

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

function daysArrayToString(days: DayKey[]): string {
  return days.join(",");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { target, content, days, time } = body as {
    target: "ME" | "FRIENDS";
    content: string;
    days: DayKey[];
    time: string; // "HH:mm"
  };

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { error: "Missing content" },
      { status: 400 }
    );
  }

  if (content.length > 240) {
    return NextResponse.json(
      { error: "Content too long (max 240 chars)" },
      { status: 400 }
    );
  }

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json(
      { error: "At least one day is required" },
      { status: 400 }
    );
  }

  if (!time || typeof time !== "string") {
    return NextResponse.json(
      { error: "Missing time" },
      { status: 400 }
    );
  }

  if (target !== "ME" && target !== "FRIENDS") {
    return NextResponse.json(
      { error: "Invalid target" },
      { status: 400 }
    );
  }

  const msg = await prisma.motivationMessage.create({
    data: {
      userId: session.user.id as string,
      target,
      content,
      days: daysArrayToString(days),
      time,
      active: true,
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
