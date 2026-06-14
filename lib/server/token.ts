// Reads on-chain $WILD (SPL token) balances. Returns 0 when the mint isn't
// configured yet or the wallet has no token account. Cached briefly so the
// leaderboard doesn't hammer the RPC.

const TOKEN_DECIMALS = 6;
const CACHE_MS = 30_000;
const cache = new Map<string, { v: number; at: number }>();

export function woodMint(): string | null {
  return process.env.ACORN_MINT ?? null;
}

export async function woodBalance(wallet: string): Promise<number> {
  const mint = process.env.ACORN_MINT;
  if (!mint || !wallet) return 0;
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
  let v = 0;
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");
    const conn = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
    const ata = await getAssociatedTokenAddress(new PublicKey(mint), new PublicKey(wallet));
    const acc = await getAccount(conn, ata);
    v = Number(acc.amount) / 10 ** TOKEN_DECIMALS;
  } catch {
    v = 0; // no token account yet, or bad address
  }
  cache.set(wallet, { v, at: Date.now() });
  return v;
}

/** Balances for several wallets at once. */
export async function woodBalances(wallets: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(wallets.map(async (w) => { out[w] = await woodBalance(w); }));
  return out;
}
