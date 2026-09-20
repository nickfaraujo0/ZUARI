"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj } from "@/lib/action";
import { assertDirector, assertManager, assertProject, isDirector, projectScope, UserError } from "@/lib/access";
import { hashPassword } from "@/lib/auth";
import { phoneKey } from "@/lib/phone";
import { logActivity, notify } from "@/lib/services";
import { ROLE_LABEL } from "@/lib/utils";
import { isSiteRole } from "@/lib/roles";

export const createUser = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({
    name: z.string().min(2, "Name is required").max(80),
    email: z.string().email("Enter a valid email address").transform((s) => s.toLowerCase()),
    role: z.enum(["DIRECTOR", "PROJECT_MANAGER", "ACCOUNTANT", "SITE_ENGINEER", "SITE_SUPERVISOR", "CONTRACTOR"]),
    contractorId: z.string().optional(),
    title: z.string().max(60).optional(),
    phone: z.string().max(30).optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(100).optional(),
    projectId: z.string().optional(),
  }).parse(obj(fd));
  if (!isDirector(u) && !isSiteRole(d.role)) throw new UserError("Project managers can only add site staff and contractors.");
  if (d.contractorId && !(await prisma.contractor.findFirst({ where: { id: d.contractorId, companyId: u.companyId } }))) throw new UserError("Choose a contractor from your company.");
  const project = d.projectId ? await assertProject(u, d.projectId) : null;
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new UserError("An account with this email already exists.");
  const password = d.password ?? `Zu-${randomBytes(4).toString("hex")}`;
  const person = await prisma.user.create({
    data: {
      companyId: u.companyId, phoneKey: phoneKey(d.phone), email: d.email, name: d.name, role: d.role, contractorId: d.role === "CONTRACTOR" ? d.contractorId : undefined, title: d.title, phone: d.phone, passwordHash: await hashPassword(password),
      ...(project ? { memberships: { create: { companyId: u.companyId, projectId: project.id } } } : {}),
    },
  });
  await logActivity({ companyId: u.companyId, projectId: project?.id, actorId: u.id, type: "USER_ADDED", message: `${person.name} joined as ${ROLE_LABEL[person.role]}`, detail: project?.name });
  if (project) await notify(u.companyId, [person.id], { type: "PROJECT_ASSIGNED", title: "You were added to a project", body: project.name, href: "/site" });
  revalidatePath("/", "layout");
  return { message: `${person.name} can now sign in with ${person.email} and password ${password} — share it securely.` };
});

/** Managers issue a fresh temporary password (there is no email delivery in the MVP). Directors: anyone; PMs: supervisors on their projects. */
export const resetPassword = action(async (u, fd) => {
  assertManager(u);
  const { userId } = z.object({ userId: cuid("Person") }).parse(obj(fd));
  const target = await prisma.user.findFirst({ where: { id: userId, companyId: u.companyId } });
  if (!target || target.id === u.id) throw new UserError("Person not found.");
  if (!isDirector(u) && (!isSiteRole(target.role) || !(await prisma.projectMember.findFirst({ where: { userId: target.id, project: projectScope(u) } }))))
    throw new UserError("You can only reset passwords for site staff on your projects.");
  const password = `Zu-${randomBytes(4).toString("hex")}`;
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  return { message: `Temporary password for ${target.name}: ${password} — share it securely and ask them to change it under Profile.` };
});

export const setUserActive = action(async (u, fd) => {
  assertDirector(u);
  const d = z.object({ userId: cuid("Person"), active: z.enum(["true", "false"]) }).parse(obj(fd));
  const target = await prisma.user.findFirst({ where: { id: d.userId, companyId: u.companyId } });
  if (!target || target.id === u.id) throw new UserError("You can't change your own access.");
  const active = d.active === "true";
  await prisma.user.update({ where: { id: target.id }, data: { active, ...(active ? {} : { tokenVersion: { increment: 1 } }) } });
  revalidatePath("/", "layout");
  return { message: active ? `${target.name} can sign in again.` : `${target.name} was deactivated and signed out.` };
});
