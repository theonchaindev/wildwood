import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

// Pick / change the display name (used by wallet accounts on first login)
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== "string") return NextResponse.json({ error: "Name required" }, { status: 400 });
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return NextResponse.json({ error: "Name must be 2–16 characters" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { name: trimmed } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "That name is taken" }, { status: 409 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } });
  return NextResponse.json({ name: trimmed });
}
