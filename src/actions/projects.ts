"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj, optId } from "@/lib/action";
import { assertDirector, assertManager, assertProject, isDirector, UserError } from "@/lib/access";
import { logActivity, nextProjectCode, notify, recomputeProgress } from "@/lib/services";
import { parseDate } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const DEFAULT_PHASES = ["Foundation", "Structure", "Masonry", "Electrical", "Plumbing", "Finishing"];

const projectFields = z.object({
  name: z.string().min(2, "Project name is required").max(100),
  client: z.string().min(2, "Client is required").max(100),
  location: z.string().min(2, "Location is required").max(100),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "HOSPITALITY", "INSTITUTIONAL", "OTHER"]),
  startDate: dateStr("Start date"),
  expectedEnd: dateStr("Expected completion"),
  budget: z.coerce.number({ error: "Budget must be a number" }).min(0).max(1e12),
  managerId: cuid("Project manager"),
  description: z.string().max(1000).optional(),
});

export const createProject = action(async (u, fd) => {
  assertDirector(u);
  const d = projectFields.parse(obj(fd));
  const start = parseDate(d.startDate)!, end = parseDate(d.expectedEnd)!;
  if (end <= start) throw new UserError("Expected completion must be after the start date.");
  const manager = await prisma.user.findFirst({ where: { id: d.managerId, companyId: u.companyId, active: true, role: { not: "SITE_SUPERVISOR" } } });
  if (!manager) throw new UserError("Choose a project manager or director from your company.");

  const span = (end.getTime() - start.getTime()) / DEFAULT_PHASES.length;
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        companyId: u.companyId, code: await nextProjectCode(u.companyId), name: d.name, client: d.client, location: d.location, type: d.type,
        startDate: start, expectedEnd: end, budget: d.budget, description: d.description, managerId: manager.id,
        members: { create: [{ companyId: u.companyId, userId: manager.id }] },
        phases: { create: DEFAULT_PHASES.map((name, i) => ({ companyId: u.companyId, name, position: i, startDate: new Date(start.getTime() + span * i), endDate: new Date(start.getTime() + span * (i + 1)) })) },
      },
    });
    await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "PROJECT_CREATED", message: `${u.name} created the project`, detail: p.name }, tx);
    await notify(u.companyId, [manager.id], { type: "PROJECT_ASSIGNED", title: "You manage a new project", body: p.name, href: `/projects/${p.id}` }, u.id, tx);
    return p;
  });
  refresh();
  redirect(`/projects/${project.id}`);
});

export const setProjectStatus = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]) }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  await prisma.project.update({ where: { id: p.id }, data: { status: d.status } });
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "PROJECT_STATUS", message: `${u.name} set project status to ${d.status.replace("_", " ").toLowerCase()}` });
  refresh();
});

export const addMember = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), userId: cuid("Person") }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const person = await prisma.user.findFirst({ where: { id: d.userId, companyId: u.companyId, active: true } });
  if (!person) throw new UserError("That person isn't in your company.");
  await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId: person.id } }, update: {}, create: { companyId: u.companyId, projectId: p.id, userId: person.id } });
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "MEMBER_ADDED", message: `${person.name} added to the project team`, detail: p.name });
  await notify(u.companyId, [person.id], { type: "PROJECT_ASSIGNED", title: "You were added to a project", body: p.name, href: person.role === "SITE_SUPERVISOR" ? "/site" : `/projects/${p.id}` }, u.id);
  refresh();
});

export const removeMember = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), userId: cuid("Person") }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  if (p.managerId === d.userId) throw new UserError("The project manager can't be removed from their own project.");
  await prisma.projectMember.deleteMany({ where: { projectId: p.id, userId: d.userId, companyId: u.companyId } });
  refresh();
});

const phaseFields = z.object({
  name: z.string().min(2, "Phase name is required").max(60),
  startDate: dateStr("Start date"),
  endDate: dateStr("End date"),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export const createPhase = action(async (u, fd) => {
  assertManager(u);
  const d = phaseFields.extend({ projectId: cuid("Project") }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const s = parseDate(d.startDate)!, e = parseDate(d.endDate)!;
  if (e < s) throw new UserError("End date must be on or after the start date.");
  const position = await prisma.projectPhase.count({ where: { projectId: p.id } });
  await prisma.projectPhase.create({ data: { companyId: u.companyId, projectId: p.id, name: d.name, position, startDate: s, endDate: e, progress: d.progress ?? 0 } });
  await recomputeProgress(p.id);
  refresh();
  return { message: "Phase added" };
});

export const updatePhase = action(async (u, fd) => {
  assertManager(u);
  const d = phaseFields.extend({ phaseId: cuid("Phase") }).parse(obj(fd));
  const ph = await prisma.projectPhase.findFirst({ where: { id: d.phaseId, companyId: u.companyId, project: { members: u.role === "DIRECTOR" ? undefined : { some: { userId: u.id } } } } });
  if (!ph) throw new UserError("Phase not found.");
  const s = parseDate(d.startDate)!, e = parseDate(d.endDate)!;
  if (e < s) throw new UserError("End date must be on or after the start date.");
  await prisma.projectPhase.update({ where: { id: ph.id }, data: { name: d.name, startDate: s, endDate: e, progress: d.progress ?? ph.progress } });
  await recomputeProgress(ph.projectId);
  refresh();
  return { message: "Phase saved" };
});

export const deletePhase = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ phaseId: cuid("Phase") }).parse(obj(fd));
  const ph = await prisma.projectPhase.findFirst({ where: { id: d.phaseId, companyId: u.companyId } });
  if (!ph) throw new UserError("Phase not found.");
  await assertProject(u, ph.projectId);
  await prisma.projectPhase.delete({ where: { id: ph.id } });
  await recomputeProgress(ph.projectId);
  refresh();
});

export const updateProject = action(async (u, fd) => {
  assertManager(u);
  const d = projectFields.extend({ projectId: cuid("Project"), managerId: optId }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const start = parseDate(d.startDate)!, end = parseDate(d.expectedEnd)!;
  if (end <= start) throw new UserError("Expected completion must be after the start date.");
  let managerId = p.managerId;
  if (isDirector(u) && d.managerId && d.managerId !== p.managerId) {
    const m = await prisma.user.findFirst({ where: { id: d.managerId, companyId: u.companyId, active: true, role: { not: "SITE_SUPERVISOR" } } });
    if (!m) throw new UserError("Choose a project manager or director from your company.");
    managerId = m.id;
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId: m.id } }, update: {}, create: { companyId: u.companyId, projectId: p.id, userId: m.id } });
    await notify(u.companyId, [m.id], { type: "PROJECT_ASSIGNED", title: "You now manage a project", body: d.name, href: `/projects/${p.id}` }, u.id);
  }
  await prisma.project.update({ where: { id: p.id }, data: { name: d.name, client: d.client, location: d.location, type: d.type, startDate: start, expectedEnd: end, budget: d.budget, description: d.description ?? null, managerId } });
  await logActivity({ companyId: u.companyId, projectId: p.id, actorId: u.id, type: "PROJECT_UPDATED", message: `${u.name} updated the project details`, detail: d.name });
  refresh();
  redirect(`/projects/${p.id}`);
});
