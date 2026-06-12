import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

// GET responses must never be cached at build time
export const dynamic = "force-dynamic";

export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  // the board only ranks players in the game RIGHT NOW (heartbeat <60s old)
  const active = await prisma.presence.findMany({
    where: { lastSeen: { gt: new Date(Date.now() - 60_000) }, name: { not: "" } },
    orderBy: { lastSeen: "desc" },
    select: { name: true, level: true, acorns: true, homeTier: true, houseLevel: true },
  });
  // a player with two tabs open is still one player
  const byName = new Map<string, (typeof active)[number]>();
  for (const a of active) {
    const cur = byName.get(a.name);
    if (!cur || a.level > cur.level) byName.set(a.name, a);
  }
  const everyone = Array.from(byName.values());
  const players = everyone
    .sort((a, b) => b.level - a.level || b.acorns - a.acorns)
    .slice(0, 10)
    .map(({ name, level, acorns }) => ({ name, level, acorns }));
  const estates = everyone
    .filter((a) => a.homeTier > 0)
    .sort((a, b) => b.homeTier - a.homeTier || b.houseLevel - a.houseLevel || b.level - a.level)
    .slice(0, 10)
    .map(({ name, homeTier, houseLevel }) => ({ name, homeTier, houseLevel }));
  return NextResponse.json({ players, estates, online: everyone.length });
}
