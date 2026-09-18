"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, obj } from "@/lib/action";
import { assertManager, assertProject, isDirector, UserError } from "@/lib/access";
import { hashPassword } from "@/lib/auth";
import { logActivity, notify } from "@/lib/services";
import { ROLE_LABEL } from "@/lib/utils";

export const createUser = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({
    name: z.string().min(2, "Name is required").max(80),
    email: z.string().email("Enter a valid email address").transform((s) => s.toLowerCase()),
    role: z.enum(["DIRECTOR", "PROJECT_MANAGER", "SITE_SUPERVISOR"]),
    title: z.string().max(60).optional(),
    phone: z.string().max(30).optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
    projectId: z.string().optional(),
  }).parse(obj(fd));
  if (!isDirector(u) && d.role !== "SITE_SUPERVISOR") throw new UserError("Project managers can only add site supervisors.");
  const project = d.projectId ? await assertProject(u, d.projectId) : null;
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new UserError("An account with this email already exists.");
  const password = d.password ?? `Zu-${randomBytes(4).toString("hex")}`;
  const person = await prisma.user.create({
    data: {
      companyId: u.companyId, email: d.email, name: d.name, role: d.role, title: d.title, phone: d.phone, passwordHash: await hashPassword(password),
      ...(project ? { memberships: { create: { companyId: u.companyId, projectId: project.id } } } : {}),
    },
  });
  await logActivity({ companyId: u.companyId, projectId: project?.id, actorId: u.id, type: "USER_ADDED", message: `${person.name} joined as ${ROLE_LABEL[person.role]}`, detail: project?.name });
  if (project) await notify(u.companyId, [person.id], { type: "PROJECT_ASSIGNED", title: "You were added to a project", body: project.name, href: "/site" });
  revalidatePath("/", "layout");
  return { message: `${person.name} can now sign in with ${person.email} and password ${password} — share it securely.` };
});
