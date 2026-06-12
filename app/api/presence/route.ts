import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const GHOST_WINDOW_MS = 8_000; // how fresh a position must be to render the player

// Real-time sync: each playing browser posts its position ~1×/second and gets
// every other live player's position back in the same response.
export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const body = await req.json().catch(() => ({}));
  const { id, name, x, z, rot, location, level, look } = body;
  if (typeof id !== "string" || id.length < 8 || id.length > 64) {
    return NextResponse.json({ error: "Bad client id" }, { status: 400 });
  }
  const data = {
    lastSeen: new Date(),
    name: typeof name === "string" ? name.slice(0, 16) : "",
    x: typeof x === "number" && isFinite(x) ? x : 0,
    z: typeof z === "number" && isFinite(z) ? z : 0,
    rot: typeof rot === "number" && isFinite(rot) ? rot : 0,
    location: location === "forest" ? "forest" : "away",
    level: Number.isInteger(level) ? level : 1,
    look: typeof look === "string" ? look.slice(0, 600) : "{}",
  };
  const [, players] = await Promise.all([
    prisma.presence.upsert({ where: { id }, update: data, create: { id, ...data } }),
    // other players currently walking the shared forest
    data.location === "forest"
      ? prisma.presence.findMany({
          where: {
            id: { not: id },
            location: "forest",
            lastSeen: { gt: new Date(Date.now() - GHOST_WINDOW_MS) },
          },
          take: 24,
          select: { id: true, name: true, x: true, z: true, rot: true, level: true, look: true },
        })
      : Promise.resolve([]),
  ]);
  // opportunistic cleanup of long-gone sessions
  if (Math.random() < 0.05) {
    await prisma.presence.deleteMany({
      where: { lastSeen: { lt: new Date(Date.now() - 3_600_000) } },
    });
  }
  return NextResponse.json({ ok: true, players });
}
