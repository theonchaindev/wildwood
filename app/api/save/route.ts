import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const pendingAcorns = user.pendingAcorns;
  if (pendingAcorns > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { pendingAcorns: 0 } });
  }
  return NextResponse.json({
    name: user.name,
    save: user.save ? JSON.parse(user.save) : null,
    pendingAcorns,
  });
}

export async function PUT(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad save data" }, { status: 400 });
  }
  const json = JSON.stringify(body);
  if (json.length > 200_000) {
    return NextResponse.json({ error: "Save too large" }, { status: 413 });
  }
  const newAcorns = Number.isInteger(body.acorns) ? body.acorns : 0;
  const newLevel = Number.isInteger(body.level) ? body.level : 1;
  // levels never go down in this game — a save with a LOWER level than the
  // stored one is stale (old tab, wiped browser, …). Keep the better save
  // and tell the client so it can pull it back down.
  if (newLevel < user.level) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } });
    return NextResponse.json({ ok: true, keptServer: true });
  }
  // anti-cheat heuristic: flag implausible earning rates (the save still
  // applies — strikes only gate cash-outs, so honest play is uninterrupted)
  const minutes = Math.max(0.5, (Date.now() - user.lastSeen.getTime()) / 60_000);
  const rate = (newAcorns - user.acorns) / minutes;
  const strike = rate > 8000 && newAcorns > 50_000 ? 1 : 0;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      save: json,
      level: newLevel,
      acorns: newAcorns,
      homeTier: Number.isInteger(body.homeTier) ? body.homeTier : 0,
      houseLevel: Number.isInteger(body.houseLevel) ? body.houseLevel : 1,
      flagged: { increment: strike },
      lastSeen: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
