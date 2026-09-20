"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj } from "@/lib/action";
import { assertOperations, docScope, UserError } from "@/lib/access";
import { logActivity, notify, projectStewards } from "@/lib/services";

/** Drop a pin on a drawing: creates an issue anchored to a spot (0–1 coordinates) on the current drawing version. */
export const pinIssue = action(async (u, fd) => {
  assertOperations(u);
  const d = z.object({ documentId: cuid("Drawing"), x: z.coerce.number().min(0).max(1), y: z.coerce.number().min(0).max(1), title: z.string().min(3, "Give the issue a short title").max(140), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), description: z.string().max(1000).optional() }).parse(obj(fd));
  const doc = await prisma.document.findFirst({ where: { id: d.documentId, ...docScope(u) }, include: { versions: { orderBy: { version: "desc" }, take: 1 }, project: { select: { name: true, managerId: true } } } });
  if (!doc) throw new UserError("Drawing not found.");
  if (!doc.versions[0]?.mime.startsWith("image/")) throw new UserError("Only image drawings (PNG/JPG/WebP) can be pinned.");
  await prisma.issue.create({ data: { companyId: u.companyId, projectId: doc.projectId, title: d.title, description: d.description, severity: d.severity, reporterId: u.id, documentId: doc.id, pinX: d.x, pinY: d.y, docVersion: doc.currentVersion } });
  await logActivity({ companyId: u.companyId, projectId: doc.projectId, actorId: u.id, type: "ISSUE", message: "New issue pinned on a drawing", detail: `${d.title} — ${doc.title}` });
  await notify(u.companyId, await projectStewards(u.companyId, doc.project.managerId), { type: "ISSUE_REPORTED", title: "Issue pinned on a drawing", body: `${d.title} — ${doc.title}`, href: `/projects/${doc.projectId}/issues` }, u.id);
  revalidatePath("/", "layout");
  return { message: "Issue pinned" };
});
