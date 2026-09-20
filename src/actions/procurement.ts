"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj, optDate, optId } from "@/lib/action";
import { assertDirector, assertManager, assertProject, UserError } from "@/lib/access";
import { logActivity, notify } from "@/lib/services";
import { parseDate } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const LINES = 5;

async function nextNumber(companyId: string) {
  const n = await prisma.purchaseOrder.count({ where: { companyId } });
  return `PO-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;
}

export const createPO = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), supplierId: cuid("Supplier"), expectedDate: optDate, notes: z.string().max(500).optional(), requestId: optId }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  if (!(await prisma.supplier.findFirst({ where: { id: d.supplierId, companyId: u.companyId, active: true } }))) throw new UserError("Choose an active supplier.");
  const mats = new Map((await prisma.material.findMany({ where: { companyId: u.companyId } })).map((m) => [m.id, m]));
  const lines = [];
  for (let i = 0; i < LINES; i++) {
    const mid = String(fd.get(`mat_${i}`) ?? "") || undefined, mat = mid ? mats.get(mid) : undefined;
    const desc = String(fd.get(`desc_${i}`) ?? "").trim() || mat?.name || "";
    const qty = Number(fd.get(`qty_${i}`));
    if (!desc && !qty) continue;
    if (!desc || !(qty > 0)) throw new UserError(`Line ${i + 1}: enter a description and a quantity above zero.`);
    if (mid && !mat) throw new UserError(`Line ${i + 1}: unknown material.`);
    const rate = Number(fd.get(`rate_${i}`) || 0);
    if (!(rate >= 0)) throw new UserError(`Line ${i + 1}: rate can't be negative.`);
    lines.push({ companyId: u.companyId, materialId: mat?.id, description: desc, quantity: qty, unit: String(fd.get(`unit_${i}`) ?? "").trim() || mat?.unit || "nos", rate });
  }
  if (!lines.length) throw new UserError("Add at least one line to the purchase order.");
  const req = d.requestId ? await prisma.materialRequest.findFirst({ where: { id: d.requestId, companyId: u.companyId, projectId: project.id, status: "APPROVED", poId: null } }) : null;
  let po;
  for (let attempt = 0; attempt < 3 && !po; attempt++) {
    try {
      po = await prisma.purchaseOrder.create({ data: { companyId: u.companyId, projectId: project.id, supplierId: d.supplierId, number: await nextNumber(u.companyId), expectedDate: parseDate(d.expectedDate), notes: d.notes, createdById: u.id, lines: { create: lines } } });
    } catch (e) { if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e; }
  }
  if (!po) throw new UserError("Could not allocate a PO number, try again.");
  if (req) await prisma.materialRequest.update({ where: { id: req.id }, data: { poId: po.id, status: "ORDERED" } });
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "PROCUREMENT", message: `${u.name} raised ${po.number}`, detail: project.name });
  refresh();
  redirect(`/procurement/${po.id}`);
});

async function loadPO(u: { companyId: string }, id: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId: u.companyId }, include: { lines: true, project: { select: { name: true, managerId: true } } } });
  if (!po) throw new UserError("Purchase order not found.");
  return po;
}
const idOnly = z.object({ poId: cuid("Purchase order") });

export const approvePO = action(async (u, fd) => {
  assertDirector(u);
  const po = await loadPO(u, idOnly.parse(obj(fd)).poId);
  if (po.status !== "DRAFT") throw new UserError("Only draft orders can be approved.");
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "APPROVED", approvedById: u.id } });
  await logActivity({ companyId: u.companyId, projectId: po.projectId, actorId: u.id, type: "PROCUREMENT", message: `${po.number} approved by ${u.name}`, detail: po.project.name });
  await notify(u.companyId, [po.createdById], { type: "PO", title: "Purchase order approved", body: po.number, href: `/procurement/${po.id}` }, u.id);
  refresh();
});
export const markOrdered = action(async (u, fd) => {
  assertManager(u);
  const po = await loadPO(u, idOnly.parse(obj(fd)).poId);
  await assertProject(u, po.projectId);
  if (po.status !== "APPROVED") throw new UserError("Approve the order before sending it.");
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "ORDERED" } });
  refresh();
});
export const cancelPO = action(async (u, fd) => {
  assertManager(u);
  const po = await loadPO(u, idOnly.parse(obj(fd)).poId);
  await assertProject(u, po.projectId);
  if (po.status === "DELIVERED" || po.status === "CANCELLED") throw new UserError("This order can't be cancelled.");
  await prisma.$transaction([
    prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } }),
    prisma.materialRequest.updateMany({ where: { poId: po.id }, data: { poId: null, status: "APPROVED" } }),
  ]);
  refresh();
});
/** Receiving a delivery books each material line into the project's stock ledger. */
export const receivePO = action(async (u, fd) => {
  assertManager(u);
  const po = await loadPO(u, idOnly.parse(obj(fd)).poId);
  await assertProject(u, po.projectId);
  if (po.status !== "ORDERED" && po.status !== "APPROVED") throw new UserError("Only approved or ordered purchase orders can be received.");
  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    for (const l of po.lines) if (l.materialId) await tx.materialTxn.create({ data: { companyId: u.companyId, projectId: po.projectId, materialId: l.materialId, type: "RECEIVED", quantity: l.quantity, supplierId: po.supplierId, poId: po.id, userId: u.id, note: po.number } });
    await tx.materialRequest.updateMany({ where: { poId: po.id }, data: { status: "FULFILLED" } });
    await logActivity({ companyId: u.companyId, projectId: po.projectId, actorId: u.id, type: "PROCUREMENT", message: `${po.number} delivered — stock updated`, detail: po.project.name }, tx);
  });
  refresh(); return { message: "Delivery recorded and stock updated" };
});
