"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, obj } from "@/lib/action";
import { UserError } from "@/lib/access";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

export const updateProfile = action(async (u, fd) => {
  const d = z.object({ name: z.string().min(2, "Name is required").max(80), title: z.string().max(60).optional(), phone: z.string().max(30).optional() }).parse(obj(fd));
  await prisma.user.update({ where: { id: u.id }, data: { name: d.name, title: d.title ?? null, phone: d.phone ?? null } });
  revalidatePath("/", "layout");
  return { message: "Profile saved" };
});

export const changePassword = action(async (u, fd) => {
  const d = z.object({ current: z.string({ error: "Enter your current password" }), next: z.string().min(8, "New password must be at least 8 characters").max(100), confirm: z.string() }).parse(obj(fd));
  if (d.next !== d.confirm) throw new UserError("The new passwords don't match.");
  if (!(await verifyPassword(d.current, u.passwordHash))) throw new UserError("Your current password is incorrect.");
  // Bumping tokenVersion signs out every other device; this one gets a fresh session.
  const updated = await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(d.next), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  await createSession(u.id, updated.tokenVersion);
  return { message: "Password changed. Other devices were signed out." };
});
