import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const entries = await prisma.guestbook.findMany({
    where: { owner: params.name },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, author: true, text: true, createdAt: true },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to leave a message" }, { status: 401 });
  if (user.name === params.name) {
    return NextResponse.json({ error: "You can't sign your own guestbook!" }, { status: 400 });
  }
  const owner = await prisma.user.findUnique({ where: { name: params.name } });
  if (!owner) return NextResponse.json({ error: "No forager by that name" }, { status: 404 });
  const { text } = await req.json().catch(() => ({}));
  const clean = typeof text === "string" ? text.trim().slice(0, 120) : "";
  if (clean.length < 2) return NextResponse.json({ error: "Write a little something!" }, { status: 400 });
  // one entry per visitor per day keeps the book readable
  const already = await prisma.guestbook.findFirst({
    where: {
      owner: params.name,
      author: user.name,
      createdAt: { gt: new Date(Date.now() - 24 * 3600_000) },
    },
  });
  if (already) {
    return NextResponse.json({ error: "You've already signed today — come back tomorrow" }, { status: 429 });
  }
  const entry = await prisma.guestbook.create({
    data: { owner: params.name, author: user.name, text: clean },
  });
  return NextResponse.json({ ok: true, entry });
}
