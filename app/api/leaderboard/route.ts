import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

// GET responses must never be cached at build time
export const dynamic = "force-dynamic";

export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const [players, estates, online] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ level: "desc" }, { acorns: "desc" }],
      take: 10,
      select: { name: true, level: true, acorns: true },
    }),
    prisma.user.findMany({
      where: { homeTier: { gt: 0 } },
      orderBy: [{ homeTier: "desc" }, { houseLevel: "desc" }, { level: "desc" }],
      take: 10,
      select: { name: true, homeTier: true, houseLevel: true },
    }),
    // true count: live heartbeats from playing browsers (guests included)
    prisma.presence.count({
      where: { lastSeen: { gt: new Date(Date.now() - 60_000) } },
    }),
  ]);
  return NextResponse.json({ players, estates, online });
}
