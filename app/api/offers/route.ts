import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  const offers = await prisma.offer.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({
    offers: offers.map((o) => ({
      id: o.id,
      sellerName: o.sellerName,
      item: o.item,
      qty: o.qty,
      price: o.price,
      mine: user ? o.sellerId === user.id : false,
    })),
  });
}

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in to post offers" }, { status: 401 });
  const { item, qty, price } = await req.json().catch(() => ({}));
  if (typeof item !== "string" || !Number.isInteger(qty) || !Number.isInteger(price)) {
    return NextResponse.json({ error: "Bad offer" }, { status: 400 });
  }
  if (qty < 1 || qty > 99 || price < 1 || price > 99999 || item.length > 30) {
    return NextResponse.json({ error: "Offer out of range" }, { status: 400 });
  }
  const openCount = await prisma.offer.count({ where: { sellerId: user.id, status: "open" } });
  if (openCount >= 5) {
    return NextResponse.json({ error: "You already have 5 open offers" }, { status: 400 });
  }
  const offer = await prisma.offer.create({
    data: { sellerId: user.id, sellerName: user.name, item, qty, price },
  });
  return NextResponse.json({ id: offer.id });
}
