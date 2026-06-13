import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { woodBalances, woodMint } from "@/lib/server/token";

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

  // look up the connected wallet for each live player, then their on-chain $WOOD
  const names = everyone.map((e) => e.name);
  const accounts = names.length
    ? await prisma.user.findMany({ where: { name: { in: names } }, select: { name: true, wallet: true } })
    : [];
  const walletByName = new Map(accounts.map((a) => [a.name, a.wallet]));
  const wallets = accounts.map((a) => a.wallet).filter((w): w is string => !!w);
  const balances = wallets.length ? await woodBalances(wallets) : {};
  const woodFor = (name: string) => {
    const w = walletByName.get(name);
    return w ? balances[w] ?? 0 : 0;
  };

  const players = everyone
    .map((e) => ({ name: e.name, level: e.level, wood: woodFor(e.name) }))
    .sort((a, b) => b.wood - a.wood || b.level - a.level)
    .slice(0, 10);
  const estates = everyone
    .filter((a) => a.homeTier > 0)
    .sort((a, b) => b.homeTier - a.homeTier || b.houseLevel - a.houseLevel || b.level - a.level)
    .slice(0, 10)
    .map(({ name, homeTier, houseLevel }) => ({ name, homeTier, houseLevel }));
  return NextResponse.json({ players, estates, online: everyone.length, tokenLive: !!woodMint() });
}
