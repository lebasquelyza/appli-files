import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as any)?.id as string | undefined;
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accepted = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: meId }, { addresseeId: meId }],
    },
    orderBy: { updatedAt: "desc" },
  });

  const friendIds = accepted.map((r) => (r.requesterId === meId ? r.addresseeId : r.requesterId));

  const friends = await prisma.appUser.findMany({
    where: { id: { in: friendIds } },
  });

  return NextResponse.json(
    friends.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
    }))
  );
}
