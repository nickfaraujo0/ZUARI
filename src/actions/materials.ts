"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj, optId } from "@/lib/action";
import { assertManager, assertOperations, assertProject, isManager, UserError } from "@/lib/access";
import { stockFor } from "@/lib/materials";
import { logActivity, notify, projectStewards } from "@/lib/services";
import { parseDate, TXN } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const material = z.object({ name: z.string().min(2, "Name is required").max(80), unit: z.string().min(1, "Unit is required").max(20), category: z.string().max(60).optional(), reorderLevel: z.coerce.number().min(0).default(0) });

export const createMaterial = action(async (u, fd) => {
  assertManager(u);
  const d = material.parse(obj(fd));
  if (await prisma.material.findFirst({ where: { companyId: u.companyId, name: { equals: d.name, mode: "insensitive" } } })) throw new UserError("That material already exists.");
  await prisma.material.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Material added" };
});
export const updateMaterial = action(async (u, fd) => {
  assertManager(u);
  const d = material.extend({ id: cuid("Material"), active: z.enum(["true", "false"]) }).parse(obj(fd));
  const r = await prisma.material.updateMany({ where: { id: d.id, companyId: u.companyId }, data: { name: d.name, unit: d.unit, category: d.category ?? null, reorderLevel: d.reorderLevel, active: d.active === "true" } });
  if (!r.count) throw new UserError("Material not found.");
  refresh(); return { message: "Saved" };
});

/** Site staff record deliveries and consumption; only managers may post adjustments. Contractors have no stock access. */
export const logMaterial = action(async (u, fd) => {
  assertOperations(u);
  if (u.role === "CONTRACTOR") throw new UserError("Contractors can't update stock.");
  const d = z.object({ projectId: cuid("Project"), materialId: cuid("Material"), type: z.enum(["RECEIVED", "CONSUMED", "ADJUSTMENT"]), quantity: z.coerce.number({ error: "Enter a quantity" }).refine((n) => n !== 0, "Quantity can't be zero"), note: z.string().max(300).optional(), supplierId: optId }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  if (d.type === "ADJUSTMENT" && !isManager(u)) throw new UserError("Only managers can post stock adjustments.");
  if (d.type !== "ADJUSTMENT" && d.quantity < 0) throw new UserError("Quantity must be positive.");
  const mat = await prisma.material.findFirst({ where: { id: d.materialId, companyId: u.companyId, active: true } });
  if (!mat) throw new UserError("Choose a material from the catalogue.");
  if (d.supplierId && !(await prisma.supplier.findFirst({ where: { id: d.supplierId, companyId: u.companyId } }))) throw new UserError("Unknown supplier.");
  const stock = (await stockFor(u.companyId, project.id)).get(mat.id)?.stock ?? 0;
  if (d.type === "CONSUMED" && d.quantity > stock + 1e-9) throw new UserError(`Only ${stock} ${mat.unit} of ${mat.name} in stock at this project.`);
  await prisma.materialTxn.create({ data: { companyId: u.companyId, projectId: project.id, materialId: mat.id, type: d.type, quantity: d.quantity, note: d.note, supplierId: d.supplierId, userId: u.id } });
  const after = stock + (d.type === "CONSUMED" ? -d.quantity : d.quantity);
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "MATERIAL", message: `${u.name} ${TXN[d.type].toLowerCase()} ${d.quantity} ${mat.unit} ${mat.name}`, detail: project.name });
  if (mat.reorderLevel > 0 && after <= mat.reorderLevel && d.type === "CONSUMED") await notify(u.companyId, await projectStewards(u.companyId, project.managerId), { type: "LOW_STOCK", title: "Low stock", body: `${mat.name}: ${after} ${mat.unit} left at ${project.name}`, href: `/materials?project=${project.id}` }, u.id);
  refresh(); return { message: `${TXN[d.type]}: ${d.quantity} ${mat.unit} ${mat.name}. Stock now ${after} ${mat.unit}.` };
});

export const requestMaterial = action(async (u, fd) => {
  assertOperations(u);
  if (u.role === "CONTRACTOR") throw new UserError("Contractors can't raise material requests.");
  const d = z.object({ projectId: cuid("Project"), materialId: cuid("Material"), quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Quantity must be positive"), neededBy: z.string().optional(), note: z.string().max(300).optional() }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  const mat = await prisma.material.findFirst({ where: { id: d.materialId, companyId: u.companyId, active: true } });
  if (!mat) throw new UserError("Choose a material from the catalogue.");
  await prisma.materialRequest.create({ data: { companyId: u.companyId, projectId: project.id, materialId: mat.id, quantity: d.quantity, neededBy: parseDate(d.neededBy), note: d.note, requestedById: u.id } });
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "MATERIAL", message: `${u.name} requested ${d.quantity} ${mat.unit} ${mat.name}`, detail: project.name });
  await notify(u.companyId, await projectStewards(u.companyId, project.managerId), { type: "MATERIAL_REQUEST", title: "Material requested", body: `${d.quantity} ${mat.unit} ${mat.name} — ${project.name}`, href: "/materials" }, u.id);
  refresh(); return { message: "Request sent to your project manager" };
});

export const decideRequest = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ requestId: cuid("Request"), decision: z.enum(["APPROVED", "REJECTED"]) }).parse(obj(fd));
  const r = await prisma.materialRequest.findFirst({ where: { id: d.requestId, companyId: u.companyId, status: "REQUESTED" }, include: { material: true } });
  if (!r) throw new UserError("That request was already decided.");
  await assertProject(u, r.projectId);
  await prisma.materialRequest.update({ where: { id: r.id }, data: { status: d.decision, decidedById: u.id } });
  await notify(u.companyId, [r.requestedById], { type: "MATERIAL_REQUEST", title: `Material request ${d.decision === "APPROVED" ? "approved" : "declined"}`, body: `${r.quantity} ${r.material.unit} ${r.material.name}`, href: "/site/materials" }, u.id);
  refresh();
});
