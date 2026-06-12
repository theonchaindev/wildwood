import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

// POST = accept (buy) an open offer; DELETE = cancel your own offer
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in to trade" }, { status: 401 });
  const offer = await prisma.offer.findUnique({ where: { id: params.id } });
  if (!offer || offer.status !== "open") {
    return NextResponse.json({ error: "Offer no longer available" }, { status: 404 });
  }
  if (offer.sellerId === user.id) {
    return NextResponse.json({ error: "That's your own offer" }, { status: 400 });
  }
  // 5% market fee — an acorn sink to balance the play-to-earn faucet
  const fee = Math.floor(offer.price * 0.05);
  const proceeds = offer.price - fee;
  await prisma.$transaction([
    prisma.offer.update({ where: { id: offer.id }, data: { status: "sold" } }),
    prisma.user.update({
      where: { id: offer.sellerId },
      data: { pendingAcorns: { increment: proceeds } },
    }),
  ]);
  return NextResponse.json({ item: offer.item, qty: offer.qty, price: offer.price, fee });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const offer = await prisma.offer.findUnique({ where: { id: params.id } });
  if (!offer || offer.sellerId !== user.id || offer.status !== "open") {
    return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  }
  await prisma.offer.update({ where: { id: offer.id }, data: { status: "cancelled" } });
  return NextResponse.json({ item: offer.item, qty: offer.qty });
}
