import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Unclaimed gifts waiting for the signed-in player. */
export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const gifts = await prisma.gift.findMany({
    where: { toName: user.name, claimed: false },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return NextResponse.json({ gifts });
}

/** Send a tip (acorns) or items to another player. */
export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to send gifts" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const acorns = Number.isInteger(body.acorns) ? Math.max(0, Math.min(10_000, body.acorns)) : 0;
  const qty = Number.isInteger(body.qty) ? Math.max(0, Math.min(99, body.qty)) : 0;
  const item = typeof body.item === "string" && qty > 0 ? body.item.slice(0, 40) : null;
  if (!to || to === user.name) {
    return NextResponse.json({ error: "Pick another forager to gift" }, { status: 400 });
  }
  if (acorns === 0 && !item) {
    return NextResponse.json({ error: "The gift is empty!" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { name: to } });
  if (!target) return NextResponse.json({ error: "No forager by that name" }, { status: 404 });
  const gift = await prisma.gift.create({
    data: { toName: to, fromName: user.name, item, qty: item ? qty : 0, acorns },
  });
  return NextResponse.json({ ok: true, gift });
}
