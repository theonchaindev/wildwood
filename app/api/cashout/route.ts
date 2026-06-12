import { NextResponse } from "next/server";
import { prisma, requireDb } from "@/lib/server/db";
import { getSessionUser } from "@/lib/server/auth";

// Play-to-earn exchange rate: 1000 acorns = 0.01 SOL
const ACORNS_PER_SOL = 100_000;
const MIN_CASHOUT = 1000;

export async function POST(req: Request) {
  const dbErr = requireDb();
  if (dbErr) return dbErr;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!user.wallet) {
    return NextResponse.json({ error: "Connect a Phantom wallet to cash out" }, { status: 400 });
  }
  const { acorns } = await req.json().catch(() => ({}));
  if (!Number.isInteger(acorns) || acorns < MIN_CASHOUT) {
    return NextResponse.json({ error: `Minimum cash-out is ${MIN_CASHOUT} acorns` }, { status: 400 });
  }
  const lamports = Math.floor((acorns / ACORNS_PER_SOL) * 1_000_000_000);

  const payout = await prisma.payout.create({
    data: { userId: user.id, wallet: user.wallet, acorns, lamports },
  });

  const secret = process.env.DEV_WALLET_SECRET;
  if (!secret) {
    return NextResponse.json({
      status: "pending",
      lamports,
      message: "Payout queued — the dev wallet isn't configured on this server yet",
    });
  }

  try {
    const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } =
      await import("@solana/web3.js");
    const bs58 = (await import("bs58")).default;
    const connection = new Connection(
      process.env.SOLANA_RPC ?? "https://api.devnet.solana.com",
      "confirmed"
    );
    const devWallet = Keypair.fromSecretKey(bs58.decode(secret));
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: devWallet.publicKey,
        toPubkey: new PublicKey(user.wallet),
        lamports,
      })
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [devWallet]);
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "paid", txSig: sig } });
    return NextResponse.json({ status: "paid", lamports, txSig: sig });
  } catch (e: any) {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "failed" } });
    return NextResponse.json(
      { error: `Payout failed: ${e.message ?? "unknown error"}` },
      { status: 502 }
    );
  }
}
