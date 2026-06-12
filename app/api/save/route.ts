import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
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
  await prisma.user.update({
    where: { id: user.id },
    data: {
      save: json,
      level: Number.isInteger(body.level) ? body.level : 1,
      acorns: Number.isInteger(body.acorns) ? body.acorns : 0,
      lastSeen: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
