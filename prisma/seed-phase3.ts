// Demo data for inspections, safety, delays, quantities, weather flags, warranties, client link and drawing pins.
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { ensureTemplates } from "../src/lib/inspections";
import { logActivity } from "../src/lib/services";

type Ctx = { prisma: PrismaClient; co: string; U: Record<string, string>; day: (n: number) => Date; at: (daysAgo: number, h: number, m?: number) => Date };
export const DEMO_SHARE_TOKEN = "demo-client-link-dona-paula-villa-2026-0000000000";

export async function seedPhase3({ prisma, co, U, day, at }: Ctx) {
  await ensureTemplates(co);
  const P = Object.fromEntries((await prisma.project.findMany({ where: { companyId: co } })).map((p) => [p.name, p]));
  const DONA = "Dona Paula Villa", CAND = "Candolim Residence", PAN = "Panaji Commercial Centre";
  const tpl = Object.fromEntries((await prisma.inspectionTemplate.findMany({ where: { companyId: co } })).map((t) => [t.name, t]));
  const taskId = async (project: string, title: string) => (await prisma.task.findFirst({ where: { projectId: P[project].id, title } }))?.id;

  // ── Inspections (+ snags from failed items) ──
  const inspect = async (project: string, template: string, task: string | null, by: string, daysAgo: number, o: { fails?: number[]; open?: boolean; loc?: [string, string, string]; notes?: Record<number, string>; parent?: string; onlyItems?: string[] } = {}) => {
    const t = tpl[template], items = o.onlyItems ?? t.items, fails = o.fails ?? [];
    const created = at(daysAgo, 11);
    const ins = await prisma.inspection.create({ data: { companyId: co, projectId: P[project].id, taskId: task ? await taskId(project, task) : null, templateId: t.id, parentId: o.parent, title: o.parent ? `Re-inspection: ${template}` : template, block: o.loc?.[0], floor: o.loc?.[1], locationArea: o.loc?.[2], status: o.open ? "OPEN" : fails.length ? "FAILED" : "PASSED", inspectorId: U[by], createdAt: created, completedAt: o.open ? null : new Date(created.getTime() + 40 * 60000), items: { create: items.map((text, position) => ({ companyId: co, position, text, result: o.open ? "PENDING" : fails.includes(position) ? "FAIL" : "PASS", note: fails.includes(position) ? (o.notes?.[position] ?? "Not as specified") : null })) } }, include: { items: true } });
    for (const it of ins.items) if (it.result === "FAIL") await prisma.issue.create({ data: { companyId: co, projectId: ins.projectId, taskId: ins.taskId, title: `${template}: ${it.text}`.slice(0, 140), description: it.note, severity: "MEDIUM", reporterId: U[by], block: o.loc?.[0], floor: o.loc?.[1], area: o.loc?.[2], inspectionItemId: it.id, createdAt: created } });
    if (!o.open) await logActivity({ companyId: co, projectId: ins.projectId, actorId: U[by], type: "INSPECTION", message: fails.length ? `Inspection failed: ${template}` : `Inspection passed: ${template}`, detail: P[project].name, createdAt: new Date(created.getTime() + 40 * 60000) });
    return ins;
  };
  await inspect(DONA, "Electrical rough-in", "Conduit laying — first floor", "vikram", 6, { loc: ["Main house", "First floor", "Corridor"] });
  await inspect(DONA, "PPE & site safety", null, "vikram", 3);
  await inspect(DONA, "Plumbing pressure test", "Drainage and soil pipes", "vikram", 1, { fails: [2], loc: ["Main house", "Ground floor", "Bathrooms"], notes: { 2: "Pressure dropped 0.4 bar in 30 min at the WC joint" } });
  await inspect(CAND, "Brickwork / blockwork", "First floor brickwork", "anita", 9, { loc: ["Main house", "First floor", "All rooms"] });
  const bad = await inspect(PAN, "Pre-pour check", "Ground floor slab", "joao", 4, { fails: [1, 3], loc: ["Block A", "Ground floor", "Slab"], notes: { 1: "Stirrup spacing wider than drawing at C4, C5", 3: "Two sleeves missing near grid D" } });
  await inspect(PAN, "Pre-pour check", "Ground floor slab", "joao", 0, { open: true, parent: bad.id, onlyItems: [tpl["Pre-pour check"].items[1], tpl["Pre-pour check"].items[3]], loc: ["Block A", "Ground floor", "Slab"] });

  // ── Safety ──
  const inc = (project: string, kind: "INCIDENT" | "NEAR_MISS" | "HAZARD", severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", description: string, by: string, daysAgo: number, o: { injured?: number; closed?: boolean; actions?: string; loc?: [string, string] } = {}) =>
    prisma.safetyIncident.create({ data: { companyId: co, projectId: P[project].id, kind, severity, description, reportedById: U[by], injuredCount: o.injured ?? 0, closed: o.closed ?? false, closedAt: o.closed ? at(Math.max(0, daysAgo - 1), 16) : null, actionsTaken: o.actions, block: o.loc?.[0], floor: o.loc?.[1], createdAt: at(daysAgo, 10) } });
  await inc(DONA, "NEAR_MISS", "MEDIUM", "Plank slipped from first-floor scaffold; nobody below at the time", "carlos", 12, { closed: true, actions: "Scaffold re-tied and inspected; toolbox talk held", loc: ["Main house", "First floor"] });
  await inc(CAND, "HAZARD", "HIGH", "Open trench near the gate without barricade", "anita", 2, { loc: ["Boundary", "Ground"] });
  await inc(PAN, "INCIDENT", "MEDIUM", "Worker cut finger while handling steel bars; first aid given on site", "joao", 21, { injured: 1, closed: true, actions: "Gloves issued to all bar benders; PPE check added weekly" });
  const workers = await prisma.worker.findMany({ where: { companyId: co }, orderBy: { name: "asc" } });
  const talk = async (project: string, topic: string, by: string, daysAgo: number, pick: (w: { name: string }, i: number) => boolean) => {
    const t = await prisma.toolboxTalk.create({ data: { companyId: co, projectId: P[project].id, topic, conductedById: U[by], date: day(-daysAgo), createdAt: at(daysAgo, 8) } });
    await prisma.toolboxAttendee.createMany({ data: workers.filter(pick).map((w) => ({ talkId: t.id, workerId: w.id })) });
  };
  await talk(DONA, "Working at height and scaffold checks", "carlos", 11, (_w, i) => i % 2 === 0);
  await talk(DONA, "PPE: helmets, shoes and gloves", "carlos", 3, (_w, i) => i % 3 !== 0);
  await talk(PAN, "Handling and cutting steel safely", "joao", 20, (_w, i) => i % 2 === 1);
  await talk(CAND, "Excavation safety and barricading", "anita", 1, (_w, i) => i % 3 === 0);

  // ── Delays ──
  const delay = (project: string, dAgo: number, cause: "WEATHER" | "MATERIAL" | "APPROVAL" | "LABOUR" | "DESIGN", days: number, note: string, by: string) => prisma.delayLog.create({ data: { companyId: co, projectId: P[project].id, date: day(-dAgo), cause, days, note, createdById: U[by] } });
  await delay(DONA, 40, "WEATHER", 1, "Heavy rain — concreting stopped", "carlos"); await delay(DONA, 39, "WEATHER", 1, "Site waterlogged", "carlos"); await delay(DONA, 22, "MATERIAL", 2, "Tiles delivery late from supplier", "priya");
  await delay(CAND, 15, "LABOUR", 2, "Masons on festival leave", "anita"); await delay(CAND, 30, "APPROVAL", 3, "Waiting for panchayat approval of boundary wall", "priya");
  await delay(PAN, 18, "WEATHER", 1, "Heavy rain — piling yard flooded", "joao"); await delay(PAN, 17, "WEATHER", 1, "Heavy rain continued", "joao");

  // ── Quantity-measured tasks & weather-sensitive work ──
  for (const [n, title, total, done, unit] of [[CAND, "Boundary wall", 120, 72, "m"], [PAN, "Ground floor slab", 250, 200, "m³"], [PAN, "Basement block work", 900, 540, "m²"]] as const)
    await prisma.task.updateMany({ where: { projectId: P[n].id, title }, data: { quantityTotal: total, quantityDone: done, quantityUnit: unit } });
  for (const [n, title] of [[DONA, "External painting"], [CAND, "Boundary wall"], [CAND, "Plastering"], [PAN, "First floor slab"], [PAN, "Facade blockwork"], [PAN, "Facade cladding"]] as const)
    await prisma.task.updateMany({ where: { projectId: P[n].id, title }, data: { weatherSensitive: true } });

  // ── Warranties ──
  for (const [item, provider, startAgo, months] of [["Waterproofing — terrace and bathrooms", "Goa Plumbing Works", 60, 60], ["Electrical installation", "Fernandes Electricals", 60, 24], ["Paint finish", "Sahyadri Interiors", 345, 12], ["Vitrified tiles", "Ponda Tiles & Sanitaryware", 30, 12]] as const) {
    const start = day(-startAgo), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + months);
    await prisma.warranty.create({ data: { companyId: co, projectId: P[DONA].id, item, provider, startDate: start, endDate: end } });
  }

  // ── Client portal (fixed demo token) + curated photos ──
  await prisma.clientShare.create({ data: { companyId: co, projectId: P[DONA].id, tokenHash: createHash("sha256").update(DEMO_SHARE_TOKEN).digest("hex"), label: "Mr & Mrs Kamat", createdById: U.priya } });
  const recent = await prisma.progressPhoto.findMany({ where: { projectId: P[DONA].id, inspectionId: null }, orderBy: { takenAt: "desc" }, take: 9, select: { id: true } });
  await prisma.progressPhoto.updateMany({ where: { id: { in: recent.map((r) => r.id) } }, data: { clientVisible: true } });

  // ── Issue pinned on a drawing ──
  const plan = await prisma.document.findFirst({ where: { projectId: P[DONA].id, title: "Ground floor plan" } });
  if (plan) await prisma.issue.create({ data: { companyId: co, projectId: P[DONA].id, title: "Kitchen door swing collides with island", description: "Door cannot open fully; consider sliding door.", severity: "MEDIUM", reporterId: U.vikram, documentId: plan.id, pinX: 0.62, pinY: 0.28, docVersion: plan.currentVersion, createdAt: at(4, 15) } });
  console.log("  ✓ Phase 3 (inspections, safety, delays, quantities, warranties, client link, pins)");
}
