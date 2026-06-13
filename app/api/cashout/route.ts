import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

// Play-to-earn conversion: 1 acorn = 1 $WOOD (SPL token, 6 decimals),
// minted straight to the player's connected wallet.
const MIN_CASHOUT = 100;
const TOKEN_DECIMALS = 6;

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!user.wallet) {
    return NextResponse.json({ error: "Connect a Phantom wallet to convert" }, { status: 400 });
  }
  const { acorns } = await req.json().catch(() => ({}));
  if (!Number.isInteger(acorns) || acorns < MIN_CASHOUT) {
    return NextResponse.json({ error: `Minimum conversion is ${MIN_CASHOUT} acorns` }, { status: 400 });
  }
  // guard rails: flagged accounts and burst withdrawals wait for review
  if (user.flagged >= 3) {
    return NextResponse.json({ error: "Account under review — conversions paused" }, { status: 403 });
  }
  const recent = await prisma.payout.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) }, status: { not: "failed" } },
  });
  if (recent) {
    return NextResponse.json({ error: "One conversion per hour — try again later" }, { status: 429 });
  }
  const dayTotal = await prisma.payout.aggregate({
    _sum: { acorns: true },
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 3600_000) }, status: { not: "failed" } },
  });
  if ((dayTotal._sum.acorns ?? 0) + acorns > 5000) {
    return NextResponse.json({ error: "Daily conversion cap is 5,000 acorns" }, { status: 429 });
  }
  const rawAmount = acorns * 10 ** TOKEN_DECIMALS; // 1:1, in token base units

  const payout = await prisma.payout.create({
    data: { userId: user.id, wallet: user.wallet, acorns, lamports: rawAmount },
  });

  const secret = process.env.DEV_WALLET_SECRET;
  const mintAddr = process.env.ACORN_MINT;
  if (!secret || !mintAddr) {
    return NextResponse.json({
      status: "pending",
      acorns,
      message: "Conversion queued — the $WOOD mint isn't configured on this server yet",
    });
  }

  try {
    const { Connection, Keypair, PublicKey } = await import("@solana/web3.js");
    const { getOrCreateAssociatedTokenAccount, mintTo } = await import("@solana/spl-token");
    const bs58 = (await import("bs58")).default;
    const connection = new Connection(
      process.env.SOLANA_RPC ?? "https://api.devnet.solana.com",
      "confirmed"
    );
    const devWallet = Keypair.fromSecretKey(bs58.decode(secret));
    const mint = new PublicKey(mintAddr);
    const owner = new PublicKey(user.wallet);
    // the player's $WOOD account (created for them on first conversion)
    const ata = await getOrCreateAssociatedTokenAccount(connection, devWallet, mint, owner);
    const sig = await mintTo(connection, devWallet, mint, ata.address, devWallet, rawAmount);
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "paid", txSig: sig } });
    return NextResponse.json({ status: "paid", acorns, txSig: sig, mint: mintAddr });
  } catch (e: any) {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "failed" } });
    return NextResponse.json(
      { error: `Conversion failed: ${e.message ?? "unknown error"}` },
      { status: 502 }
    );
  }
}
