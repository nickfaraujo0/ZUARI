"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, files, obj, optId } from "@/lib/action";
import { assertManager, assertProject, isSite, projectScope, UserError } from "@/lib/access";
import { ensureTemplates } from "@/lib/inspections";
import { logActivity, notify, projectStewards } from "@/lib/services";
import { storeFiles } from "@/lib/storage";

const refresh = () => revalidatePath("/", "layout");
const RESULTS = ["PASS", "FAIL", "NA"] as const;

function assertInspector(u: { role: string }) {
  if (u.role === "CONTRACTOR" || u.role === "ACCOUNTANT") throw new UserError("You can't run inspections.");
}
const detailHref = (u: { role: string }, id: string) => (isSite(u as never) ? `/site/inspections/${id}` : `/inspections/${id}`);

export const startInspection = action(async (u, fd) => {
  assertInspector(u);
  const d = z.object({ projectId: cuid("Project"), templateId: optId, title: z.string().max(120).optional(), taskId: optId, block: z.string().max(60).optional(), floor: z.string().max(60).optional(), area: z.string().max(80).optional(), custom: z.string().max(2000).optional() }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  await ensureTemplates(u.companyId);
  const tpl = d.templateId ? await prisma.inspectionTemplate.findFirst({ where: { id: d.templateId, companyId: u.companyId } }) : null;
  if (d.templateId && !tpl) throw new UserError("Unknown checklist.");
  const items = tpl ? tpl.items : (d.custom ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!items.length) throw new UserError("Choose a checklist or enter your own items (one per line).");
  const title = d.title || tpl?.name;
  if (!title) throw new UserError("Give the inspection a title.");
  if (d.taskId && !(await prisma.task.findFirst({ where: { id: d.taskId, projectId: project.id, companyId: u.companyId } }))) throw new UserError("That task isn't part of this project.");
  const ins = await prisma.inspection.create({ data: { companyId: u.companyId, projectId: project.id, taskId: d.taskId, templateId: tpl?.id, title, block: d.block, floor: d.floor, locationArea: d.area, inspectorId: u.id, items: { create: items.map((text, position) => ({ companyId: u.companyId, position, text })) } } });
  revalidatePath("/", "layout");
  redirect(detailHref(u, ins.id));
});

export const saveInspection = action(async (u, fd) => {
  assertInspector(u);
  const d = z.object({ inspectionId: cuid("Inspection"), intent: z.enum(["save", "finish"]).default("save"), note: z.string().max(1000).optional() }).parse(obj(fd));
  const ins = await prisma.inspection.findFirst({ where: { id: d.inspectionId, companyId: u.companyId, project: projectScope(u) }, include: { items: { include: { issues: { select: { id: true } } }, orderBy: { position: "asc" } }, project: { select: { id: true, name: true, managerId: true } }, parent: { include: { items: { include: { issues: true } } } } } });
  if (!ins) throw new UserError("Inspection not found.");
  if (ins.status !== "OPEN") throw new UserError("This inspection is already complete.");
  const marks = ins.items.map((i) => {
    const r = String(fd.get(`r_${i.id}`) ?? ""), note = String(fd.get(`n_${i.id}`) ?? "").trim().slice(0, 300);
    return { item: i, result: (RESULTS as readonly string[]).includes(r) ? (r as (typeof RESULTS)[number]) : ("PENDING" as const), note: note || null };
  });
  const bad = marks.find((m) => m.result === "FAIL" && !m.note);
  if (bad) throw new UserError(`Add a note for the failed item: “${bad.item.text}”.`);
  const finish = d.intent === "finish";
  if (finish && marks.some((m) => m.result === "PENDING")) throw new UserError("Mark every item Pass, Fail or N/A before finishing.");
  const stored = await storeFiles(files(fd), u.companyId, ins.projectId);
  const fails = marks.filter((m) => m.result === "FAIL");

  await prisma.$transaction(async (tx) => {
    for (const m of marks) await tx.inspectionItem.update({ where: { id: m.item.id }, data: { result: m.result, note: m.note } });
    if (stored.length) await tx.progressPhoto.createMany({ data: stored.map((s) => ({ companyId: u.companyId, projectId: ins.projectId, taskId: ins.taskId, userId: u.id, inspectionId: ins.id, block: ins.block, floor: ins.floor, locationArea: ins.locationArea, storageKey: s.key, mime: s.mime, size: s.size })) });
    await tx.inspection.update({ where: { id: ins.id }, data: { note: d.note ?? ins.note, ...(finish ? { status: fails.length ? "FAILED" : "PASSED", completedAt: new Date() } : {}) } });
    if (!finish) return;
    // Each failed item becomes a snag (issue) so it is tracked to closure.
    for (const m of fails) if (!m.item.issues.length) await tx.issue.create({ data: { companyId: u.companyId, projectId: ins.projectId, taskId: ins.taskId, title: `${ins.title}: ${m.item.text}`.slice(0, 140), description: m.note, severity: "MEDIUM", reporterId: u.id, block: ins.block, floor: ins.floor, area: ins.locationArea, inspectionItemId: m.item.id } });
    // A passing re-inspection closes the snags raised by the items it re-checked.
    if (ins.parent) {
      const cleared = marks.filter((m) => m.result !== "FAIL").map((m) => m.item.text);
      const ids = ins.parent.items.filter((pi) => pi.result === "FAIL" && cleared.includes(pi.text)).flatMap((pi) => pi.issues.filter((x) => !["RESOLVED", "CLOSED"].includes(x.status)).map((x) => x.id));
      if (ids.length) await tx.issue.updateMany({ where: { id: { in: ids } }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    }
    await logActivity({ companyId: u.companyId, projectId: ins.projectId, actorId: u.id, type: "INSPECTION", message: fails.length ? `Inspection failed: ${ins.title}` : `Inspection passed: ${ins.title}`, detail: fails.length ? `${fails.length} snag${fails.length > 1 ? "s" : ""} raised · ${ins.project.name}` : ins.project.name }, tx);
    await notify(u.companyId, await projectStewards(u.companyId, ins.project.managerId), { type: "INSPECTION", title: fails.length ? "Inspection failed" : "Inspection passed", body: `${ins.title}${fails.length ? ` — ${fails.length} snag(s)` : ""}`, href: `/inspections/${ins.id}` }, u.id, tx);
  });
  refresh();
  return { message: finish ? (fails.length ? `Inspection failed — ${fails.length} snag${fails.length > 1 ? "s" : ""} raised` : "Inspection passed") : "Progress saved" };
});

export const reinspect = action(async (u, fd) => {
  assertInspector(u);
  const { inspectionId } = z.object({ inspectionId: cuid("Inspection") }).parse(obj(fd));
  const ins = await prisma.inspection.findFirst({ where: { id: inspectionId, companyId: u.companyId, project: projectScope(u), status: "FAILED" }, include: { items: true } });
  if (!ins) throw new UserError("Only a failed inspection can be re-inspected.");
  if (await prisma.inspection.findFirst({ where: { parentId: ins.id, status: "OPEN" } })) throw new UserError("A re-inspection is already open.");
  const failed = ins.items.filter((i) => i.result === "FAIL");
  const child = await prisma.inspection.create({ data: { companyId: u.companyId, projectId: ins.projectId, taskId: ins.taskId, templateId: ins.templateId, parentId: ins.id, title: `Re-inspection: ${ins.title.replace(/^Re-inspection: /, "")}`, block: ins.block, floor: ins.floor, locationArea: ins.locationArea, inspectorId: u.id, items: { create: failed.map((f, position) => ({ companyId: u.companyId, position, text: f.text })) } } });
  redirect(detailHref(u, child.id));
});

const tpl = z.object({ name: z.string().min(2, "Name the checklist").max(80), category: z.string().max(40).optional(), items: z.string().min(2, "Add at least one item") });
const parseItems = (s: string) => { const l = s.split("\n").map((x) => x.trim()).filter(Boolean); if (!l.length || l.length > 40) throw new UserError("Enter 1–40 checklist items, one per line."); return l; };
export const saveTemplate = action(async (u, fd) => {
  assertManager(u);
  const d = tpl.extend({ id: optId }).parse(obj(fd));
  const data = { name: d.name, category: d.category ?? null, items: parseItems(d.items) };
  if (d.id) { const r = await prisma.inspectionTemplate.updateMany({ where: { id: d.id, companyId: u.companyId }, data }); if (!r.count) throw new UserError("Checklist not found."); }
  else await prisma.inspectionTemplate.create({ data: { ...data, companyId: u.companyId } });
  refresh(); return { message: "Checklist saved" };
});
export const deleteTemplate = action(async (u, fd) => {
  assertManager(u);
  await prisma.inspectionTemplate.deleteMany({ where: { id: z.object({ id: cuid("Checklist") }).parse(obj(fd)).id, companyId: u.companyId } });
  refresh();
});
