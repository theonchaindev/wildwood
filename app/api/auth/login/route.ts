import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { verifyPassword, createSession } from "@/lib/server/auth";

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const { name, password } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Name and password required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { name: name.trim() } });
  if (!user || !verifyPassword(password, user.passHash)) {
    return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
  }
  await createSession(user.id);
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
