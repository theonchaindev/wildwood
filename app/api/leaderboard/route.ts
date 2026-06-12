import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const [players, online] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ level: "desc" }, { acorns: "desc" }],
      take: 10,
      select: { name: true, level: true, acorns: true },
    }),
    // true count: live heartbeats from playing browsers (guests included)
    prisma.presence.count({
      where: { lastSeen: { gt: new Date(Date.now() - 60_000) } },
    }),
  ]);
  return NextResponse.json({ players, online });
}
