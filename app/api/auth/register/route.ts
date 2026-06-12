import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { hashPassword, createSession } from "@/lib/server/auth";

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const { name, password } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Name and password required" }, { status: 400 });
  }
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return NextResponse.json({ error: "Name must be 2–16 characters" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { name: trimmed } });
  if (existing) {
    return NextResponse.json({ error: "That name is taken" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { name: trimmed, passHash: hashPassword(password) },
  });
  await createSession(user.id);
  return NextResponse.json({ name: user.name, save: null, pendingAcorns: 0 });
}
