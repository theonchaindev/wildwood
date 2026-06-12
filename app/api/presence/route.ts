import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

// Heartbeat: each playing browser (guest or account) pings every ~25s.
export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const { id, name } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || id.length < 8 || id.length > 64) {
    return NextResponse.json({ error: "Bad client id" }, { status: 400 });
  }
  const safeName = typeof name === "string" ? name.slice(0, 16) : "";
  await prisma.presence.upsert({
    where: { id },
    update: { lastSeen: new Date(), name: safeName },
    create: { id, name: safeName },
  });
  // opportunistic cleanup of long-gone sessions
  if (Math.random() < 0.1) {
    await prisma.presence.deleteMany({
      where: { lastSeen: { lt: new Date(Date.now() - 3_600_000) } },
    });
  }
  return NextResponse.json({ ok: true });
}
