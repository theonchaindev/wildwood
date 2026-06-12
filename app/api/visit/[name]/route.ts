import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

// GET responses must never be cached at build time
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const name = decodeURIComponent(params.name).trim();
  let user = await prisma.user.findUnique({ where: { name } });
  if (!user) {
    // forgive the capitalisation — works on sqlite and Postgres alike
    const candidates = await prisma.user.findMany({ take: 500, select: { name: true } });
    const hit = candidates.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (hit) user = await prisma.user.findUnique({ where: { name: hit.name } });
  }
  if (!user) {
    return NextResponse.json(
      { error: "No survivor by that name — guests can't be visited until they make an account" },
      { status: 404 }
    );
  }
  if (!user.save) {
    return NextResponse.json({ error: `${user.name} hasn't played since signing up` }, { status: 404 });
  }
  const save = JSON.parse(user.save);
  if (!save.homeTier || save.homeTier < 1) {
    return NextResponse.json({ error: `${user.name} doesn't own a Haven yet` }, { status: 404 });
  }
  // only the public parts of their homestead
  return NextResponse.json({
    name: user.name,
    homeTier: save.homeTier,
    houseLevel: save.houseLevel ?? 1,
    structures: save.structures ?? [],
    farm: save.farm ?? {},
    pens: save.pens ?? {},
    orchard: save.orchard ?? {},
    hives: save.hives ?? {},
    interiorDecor: save.interiorDecor ?? [],
    level: save.level ?? 1,
  });
}
