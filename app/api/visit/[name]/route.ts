import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await prisma.user.findUnique({ where: { name: params.name } });
  if (!user?.save) {
    return NextResponse.json({ error: "No forager by that name (or they have no save yet)" }, { status: 404 });
  }
  const save = JSON.parse(user.save);
  if (!save.homeTier || save.homeTier < 1) {
    return NextResponse.json({ error: `${user.name} doesn't own a homestead yet` }, { status: 404 });
  }
  // only the public parts of their homestead
  return NextResponse.json({
    name: user.name,
    homeTier: save.homeTier,
    structures: save.structures ?? [],
    farm: save.farm ?? {},
    coop: save.coop ?? { owned: false, hens: 0 },
    level: save.level ?? 1,
  });
}
