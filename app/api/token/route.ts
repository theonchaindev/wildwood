import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Public token info for the notice board: the CA and how much has been paid out. */
export async function GET() {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const [total, recent] = await Promise.all([
    prisma.payout.aggregate({
      _sum: { acorns: true },
      _count: { id: true },
      where: { status: "paid" },
    }),
    prisma.payout.findMany({
      where: { status: "paid" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { wallet: true, acorns: true, createdAt: true },
    }),
  ]);
  return NextResponse.json({
    mint: process.env.ACORN_MINT ?? null,
    network: (process.env.SOLANA_RPC ?? "devnet").includes("mainnet") ? "mainnet" : "devnet",
    totalAcorns: total._sum.acorns ?? 0,
    totalPayouts: total._count.id ?? 0,
    recent: recent.map((r) => ({
      wallet: `${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}`,
      acorns: r.acorns,
      at: r.createdAt,
    })),
  });
}
