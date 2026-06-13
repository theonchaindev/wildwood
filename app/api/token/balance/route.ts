import { NextResponse } from "next/server";
import { woodBalance, woodMint } from "@/lib/server/token";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  const wood = await woodBalance(wallet);
  return NextResponse.json({ wood, mint: woodMint(), live: !!woodMint() });
}
