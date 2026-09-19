import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE = "zuari_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: string, version = 0) {
  const token = await new SignJWT({ v: version }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.AUTH_INSECURE_COOKIES !== "1", path: "/", maxAge: MAX_AGE });
}
export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

// The user is always re-read from the database, so role changes and deactivation apply immediately.
export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { company: true } });
    return user && user.active && (payload.v ?? -1) === user.tokenVersion ? user : null;
  } catch {
    return null;
  }
});
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
export const homeFor = (u: { role: string }) => (u.role === "SITE_SUPERVISOR" ? "/site" : "/dashboard");
