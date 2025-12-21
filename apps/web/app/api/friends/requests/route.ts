import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as any)?.id as string | undefined;
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.friendRequest.findMany({
    where: { addresseeId: meId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const fromUsers = await prisma.appUser.findMany({
    where: { id: { in: requests.map((r) => r.requesterId) } },
  });

  const fromMap = new Map(fromUsers.map((u) => [u.id, u]));

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      from: {
        id: r.requesterId,
        email: fromMap.get(r.requesterId)?.email ?? null,
        name: fromMap.get(r.requesterId)?.name ?? null,
        image: fromMap.get(r.requesterId)?.image ?? null,
      },
    }))
  );
}
