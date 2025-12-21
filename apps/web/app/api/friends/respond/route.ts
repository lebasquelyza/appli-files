import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as any)?.id as string | undefined;
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const requestId = body?.requestId as string | undefined;
  const action = body?.action as "ACCEPT" | "DECLINE" | undefined;

  if (!requestId || !action) {
    return NextResponse.json({ error: "Missing requestId/action" }, { status: 400 });
  }

  const reqRow = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.addresseeId !== meId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (reqRow.status !== "PENDING") return NextResponse.json({ error: "Not pending" }, { status: 400 });

  const nextStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";

  const updated = await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: nextStatus },
  });

  return NextResponse.json({ ok: true, request: updated });
}
