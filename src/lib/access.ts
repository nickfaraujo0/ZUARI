import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getUser, type SessionUser } from "./auth";

import { UserError } from "./errors";
export { UserError };

export const isDirector = (u: SessionUser) => u.role === "DIRECTOR";
export const isManager = (u: SessionUser) => u.role !== "SITE_SUPERVISOR";

/** Every project query must go through this: tenant + membership. Directors see the whole company. */
export const projectScope = (u: SessionUser): Prisma.ProjectWhereInput => ({
  companyId: u.companyId,
  ...(isDirector(u) ? {} : { members: { some: { userId: u.id } } }),
});

/** Supervisors only ever see tasks assigned to them. */
export const taskScope = (u: SessionUser): Prisma.TaskWhereInput => ({
  companyId: u.companyId,
  project: projectScope(u),
  ...(isManager(u) ? {} : { assigneeId: u.id }),
});

export const issueScope = (u: SessionUser): Prisma.IssueWhereInput => ({
  companyId: u.companyId,
  project: projectScope(u),
  ...(isManager(u) ? {} : { OR: [{ reporterId: u.id }, { assigneeId: u.id }] }),
});

export const getProject = (u: SessionUser, id: string) => prisma.project.findFirst({ where: { id, ...projectScope(u) } });

/** For pages: 404 instead of leaking that a project exists. Cached per request (layout + page share it). */
const loadProject = cache(async (id: string) => {
  const u = await getUser();
  return u ? prisma.project.findFirst({ where: { id, ...projectScope(u) }, include: { manager: true } }) : null;
});
export async function requireProject(_u: SessionUser, id: string) {
  const p = await loadProject(id);
  if (!p) notFound();
  return p;
}

/** For actions: throws a user-facing error. */
export async function assertProject(u: SessionUser, id: string) {
  const p = await getProject(u, id);
  if (!p) throw new UserError("You don't have access to that project.");
  return p;
}
export function assertManager(u: SessionUser) {
  if (!isManager(u)) throw new UserError("Only managers can do that.");
}
export function assertDirector(u: SessionUser) {
  if (!isDirector(u)) throw new UserError("Only directors can do that.");
}
