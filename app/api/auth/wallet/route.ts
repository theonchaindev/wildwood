import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth";

const SECRET = new TextEncoder().encode(process.env.WW_JWT_SECRET ?? "wildwood-dev");

// GET: issue a short-lived nonce the wallet must sign
export async function GET() {
  const nonce = crypto.randomUUID();
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(SECRET);
  return NextResponse.json({ nonce, token });
}

// POST: verify the signature and log in / register by wallet
export async function POST(req: Request) {
  const { pubkey, signature, nonce, token } = await req.json().catch(() => ({}));
  if (![pubkey, signature, nonce, token].every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "Bad wallet login" }, { status: 400 });
  }
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.nonce !== nonce) throw new Error("nonce mismatch");
  } catch {
    return NextResponse.json({ error: "Login expired — try again" }, { status: 401 });
  }
  const message = new TextEncoder().encode(`Wildwood login: ${nonce}`);
  let ok = false;
  try {
    ok = nacl.sign.detached.verify(message, bs58.decode(signature), bs58.decode(pubkey));
  } catch {
    ok = false;
  }
  if (!ok) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { wallet: pubkey } });
  const isNew = !user;
  if (!user) {
    const shortName = `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
    user = await prisma.user.create({
      data: {
        name: shortName,
        wallet: pubkey,
        passHash: "wallet-only", // no password login for wallet accounts
      },
    });
  }
  await createSession(user.id);
  const pendingAcorns = user.pendingAcorns;
  if (pendingAcorns > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { pendingAcorns: 0 } });
  }
  return NextResponse.json({
    name: user.name,
    wallet: user.wallet,
    isNew,
    save: user.save ? JSON.parse(user.save) : null,
    pendingAcorns,
  });
}
