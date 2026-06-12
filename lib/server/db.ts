import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Returns a friendly 503 if the database isn't configured (e.g. fresh Vercel
 * deploy before DATABASE_URL is set), so the client can show a clear message
 * instead of a 500.
 */
export function requireDb(): NextResponse | null {
  const url = process.env.DATABASE_URL;
  // SQLite is for local dev only — on Vercel the bundled file is read-only,
  // so treat it as "no database" rather than half-working
  const usable = url && !(process.env.VERCEL && url.startsWith("file:"));
  if (!usable) {
    return NextResponse.json(
      { error: "Online features aren't live yet — the server database isn't configured" },
      { status: 503 }
    );
  }
  return null;
}
