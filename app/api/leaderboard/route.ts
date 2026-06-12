import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export async function GET() {
  const [players, online] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ level: "desc" }, { acorns: "desc" }],
      take: 10,
      select: { name: true, level: true, acorns: true },
    }),
    prisma.user.count({
      where: { lastSeen: { gt: new Date(Date.now() - 60_000) } },
    }),
  ]);
  return NextResponse.json({ players, online });
}
