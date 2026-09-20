import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getUser, type SessionUser } from "./auth";
import { UserError } from "./errors";
import { isSiteRole } from "./roles";
export { UserError };

/*
 * Roles
 *  DIRECTOR         everything, whole company
 *  PROJECT_MANAGER  manages assigned projects (tasks, people, procurement, workforce, documents)
 *  ACCOUNTANT       whole company, read-only on operations; owns budgets, expenses, payments
 *  SITE_ENGINEER    mobile; sees all work in member projects; can verify tasks and upload drawings
 *  SITE_SUPERVISOR  mobile; sees only tasks assigned to them
 *  CONTRACTOR       mobile; external: assigned tasks and own photos only, no internal documents
 */
type U = Pick<SessionUser, "role">;
export const isDirector = (u: U) => u.role === "DIRECTOR";
export const isManager = (u: U) => u.role === "DIRECTOR" || u.role === "PROJECT_MANAGER";
export const isFinance = (u: U) => u.role === "DIRECTOR" || u.role === "ACCOUNTANT";
export const isSite = (u: U) => isSiteRole(u.role);
export const canUploadDocs = (u: U) => isManager(u) || u.role === "SITE_ENGINEER";
const seesWholeCompany = (u: U) => u.role === "DIRECTOR" || u.role === "ACCOUNTANT";
const seesAllTasks = (u: U) => isManager(u) || u.role === "ACCOUNTANT" || u.role === "SITE_ENGINEER";

/** Every project query must go through this: tenant + membership. */
export const projectScope = (u: SessionUser): Prisma.ProjectWhereInput => ({
  companyId: u.companyId,
  ...(seesWholeCompany(u) ? {} : { members: { some: { userId: u.id } } }),
});
export const taskScope = (u: SessionUser): Prisma.TaskWhereInput => ({
  companyId: u.companyId, project: projectScope(u), ...(seesAllTasks(u) ? {} : { assigneeId: u.id }),
});
export const issueScope = (u: SessionUser): Prisma.IssueWhereInput => ({
  companyId: u.companyId, project: projectScope(u), ...(seesAllTasks(u) ? {} : { OR: [{ reporterId: u.id }, { assigneeId: u.id }] }),
});
/** Contractors only ever see their own photos. */
export const photoScope = (u: SessionUser): Prisma.ProgressPhotoWhereInput => ({
  companyId: u.companyId, project: projectScope(u), ...(u.role === "CONTRACTOR" ? { userId: u.id } : {}),
});
/** Documents are filtered by audience: managers/accountant see all; site staff see PROJECT+EXTERNAL; contractors only EXTERNAL. */
export const docScope = (u: SessionUser): Prisma.DocumentWhereInput => ({
  companyId: u.companyId, project: projectScope(u),
  ...(isManager(u) || u.role === "ACCOUNTANT" ? {} : { audience: { in: u.role === "CONTRACTOR" ? ["EXTERNAL"] : ["PROJECT", "EXTERNAL"] } }),
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
  if (!isManager(u)) throw new UserError("Only directors and project managers can do that.");
}
export function assertDirector(u: SessionUser) {
  if (!isDirector(u)) throw new UserError("Only directors can do that.");
}
export function assertFinance(u: SessionUser) {
  if (!isFinance(u)) throw new UserError("Only directors and accountants can do that.");
}

/** Site activity (capture, attendance, stock) is for managers and site roles; accountants are finance-only. */
export function assertOperations(u: SessionUser) {
  if (u.role === "ACCOUNTANT") throw new UserError("Accountants can't record site activity.");
}
/** Pages that only managers use: everyone else gets a 404 (nav hides them too). */
export function requireManagerPage(u: SessionUser) {
  if (!isManager(u)) notFound();
}
