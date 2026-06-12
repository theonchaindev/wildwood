import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./db";

const SECRET = new TextEncoder().encode(process.env.WW_JWT_SECRET ?? "wildwood-dev");
const COOKIE = "ww-session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function getSessionUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    return await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}
