"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, obj } from "@/lib/action";
import { UserError } from "@/lib/access";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/services";

const email = z.string().email("Enter a valid email address").transform((s) => s.toLowerCase());
const DUMMY = "$2b$11$C6UzMDM.H6dfI/f/IKcEeO5n1o0mV0m9oGZ0y1XyQ8oX0m8lZ1S3e";

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
  await createSession(user.id);
  redirect("/dashboard");
}, { auth: false });

export const login = action(async (_u, fd) => {
  const d = z.object({ email, password: z.string().min(1, "Enter your password") }).parse(obj(fd));
  const user = await prisma.user.findUnique({ where: { email: d.email } });
  const ok = await verifyPassword(d.password, user?.passwordHash ?? DUMMY); // constant-ish time
  if (!user || !user.active || !ok) throw new UserError("Invalid email or password.");
  await createSession(user.id);
  redirect(homeFor(user));
}, { auth: false });

export async function logout() {
  await destroySession();
  redirect("/login");
}
