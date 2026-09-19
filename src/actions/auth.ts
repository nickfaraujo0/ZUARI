"use server";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, obj } from "@/lib/action";
import { UserError } from "@/lib/access";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/services";
import { appUrl, sendMail } from "@/lib/mail";

const email = z.string().email("Enter a valid email address").transform((s) => s.toLowerCase());
const DUMMY = "$2b$11$C6UzMDM.H6dfI/f/IKcEeO5n1o0mV0m9oGZ0y1XyQ8oX0m8lZ1S3e";
const MAX_FAILS = 5, LOCK_MIN = 15;

export const signup = action(async (_u, fd) => {
  const d = z.object({
    companyName: z.string().min(2, "Company name is required").max(80),
    name: z.string().min(2, "Your name is required").max(80),
    email,
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    title: z.string().max(60).optional(),
  }).parse(obj(fd));
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new UserError("An account with this email already exists.");
  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: d.companyName } });
    const u = await tx.user.create({ data: { companyId: company.id, email: d.email, name: d.name, title: d.title ?? "Director", role: "DIRECTOR", passwordHash: await hashPassword(d.password) } });
    await logActivity({ companyId: company.id, actorId: u.id, type: "COMPANY_CREATED", message: `${company.name} workspace created` }, tx);
    return u;
  });
  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}, { auth: false });

/** Per-account lockout: 5 wrong passwords locks the account for 15 minutes. */
export const login = action(async (_u, fd) => {
  const d = z.object({ email, password: z.string().min(1, "Enter your password") }).parse(obj(fd));
  const user = await prisma.user.findUnique({ where: { email: d.email } });
  const locked = user?.lockedUntil && user.lockedUntil > new Date();
  const ok = await verifyPassword(d.password, user?.passwordHash ?? DUMMY); // constant-ish time
  if (locked) throw new UserError(`Too many failed attempts. Try again in ${Math.ceil((user!.lockedUntil!.getTime() - Date.now()) / 60000)} minutes.`);
  if (!user || !user.active || !ok) {
    if (user) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({ where: { id: user.id }, data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) } : { failedLogins: fails } });
    }
    throw new UserError("Invalid email or password.");
  }
  if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(user.id, user.tokenVersion);
  redirect(homeFor(user));
}, { auth: false });

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ── Self-service password reset ────────────────────────────────
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const GENERIC = "If that email has an account, a reset link is on its way. It expires in 1 hour.";

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export const requestPasswordReset = action(async (_u, fd) => {
  const { email: to } = z.object({ email }).parse(obj(fd));
  const user = await prisma.user.findUnique({ where: { email: to } });
  if (user && user.active && (await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600e3) } } })) < 3) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) } });
    try { await sendMail({ to: user.email, subject: "Reset your ZUARI password", text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${appUrl()}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.` }); }
    catch (e) { console.error("[mail]", e); }
  }
  return { message: GENERIC };
}, { auth: false });

export const completePasswordReset = action(async (_u, fd) => {
  const d = z.object({ token: z.string().min(20, "This reset link is invalid or has expired."), next: z.string().min(8, "Password must be at least 8 characters").max(100), confirm: z.string() }).parse(obj(fd));
  if (d.next !== d.confirm) throw new UserError("The passwords don't match.");
  const rec = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(d.token) }, include: { user: true } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date() || !rec.user.active) throw new UserError("This reset link is invalid or has expired. Request a new one.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(d.next), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } }),
    prisma.passwordReset.updateMany({ where: { userId: rec.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  redirect("/login?reset=1");
}, { auth: false });
