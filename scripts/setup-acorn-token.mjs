// One-time setup for the $ACORN token on devnet:
//   node scripts/setup-acorn-token.mjs
// Creates (or reuses) the dev wallet, airdrops devnet SOL, creates the mint,
// and prints the env vars to configure. The wallet file is gitignored.

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import bs58 from "bs58";
import fs from "fs";

const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const WALLET_FILE = new URL("../.acorn-dev-wallet.json", import.meta.url).pathname;

const connection = new Connection(RPC, "confirmed");

let wallet;
if (fs.existsSync(WALLET_FILE)) {
  const saved = JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"));
  wallet = Keypair.fromSecretKey(Uint8Array.from(saved.secretKey));
  console.log("reusing dev wallet:", wallet.publicKey.toBase58());
} else {
  wallet = Keypair.generate();
  fs.writeFileSync(
    WALLET_FILE,
    JSON.stringify({ publicKey: wallet.publicKey.toBase58(), secretKey: Array.from(wallet.secretKey) })
  );
  console.log("created dev wallet:", wallet.publicKey.toBase58());
}

let balance = await connection.getBalance(wallet.publicKey);
console.log("balance:", balance / LAMPORTS_PER_SOL, "SOL");

if (balance < 0.5 * LAMPORTS_PER_SOL) {
  for (let i = 0; i < 3; i++) {
    try {
      console.log("requesting devnet airdrop…");
      const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      balance = await connection.getBalance(wallet.publicKey);
      console.log("balance now:", balance / LAMPORTS_PER_SOL, "SOL");
      if (balance >= 0.5 * LAMPORTS_PER_SOL) break;
    } catch (e) {
      console.log("airdrop attempt failed:", e.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

if (balance < 0.05 * LAMPORTS_PER_SOL) {
  console.error("Not enough devnet SOL for the mint — try again later or use https://faucet.solana.com");
  process.exit(1);
}

// $ACORN: 6 decimals, this wallet is the mint authority
const mint = await createMint(connection, wallet, wallet.publicKey, null, 6);
console.log("\n✅ $ACORN mint created\n");
console.log("Set these env vars (local .env AND Vercel production):");
console.log("  DEV_WALLET_SECRET=" + bs58.encode(wallet.secretKey));
console.log("  ACORN_MINT=" + mint.toBase58());
console.log("  SOLANA_RPC=" + RPC);
