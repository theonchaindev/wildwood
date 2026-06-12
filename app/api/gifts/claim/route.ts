import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "Bad gift id" }, { status: 400 });
  const gift = await prisma.gift.findUnique({ where: { id } });
  if (!gift || gift.toName !== user.name || gift.claimed) {
    return NextResponse.json({ error: "Gift not found (or already opened)" }, { status: 404 });
  }
  await prisma.gift.update({ where: { id }, data: { claimed: true } });
  return NextResponse.json({ ok: true, gift });
}
