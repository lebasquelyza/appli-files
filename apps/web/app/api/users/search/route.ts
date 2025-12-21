// apps/web/app/api/users/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const meId = (session?.user as any)?.id as string | undefined;

  if (!meId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  // SQLite/Prisma: pas de `mode: "insensitive"` (selon connecteur/collation)
  // -> on fait un search simple "contains"
  const users = await prisma.appUser.findMany({
    where: {
      id: { not: meId },
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  return NextResponse.json(users);
}
