"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj } from "@/lib/action";
import { assertDirector, assertFinance, assertManager, assertProject, UserError } from "@/lib/access";
import { billTotals } from "@/lib/bills";
import { logActivity, notify } from "@/lib/services";
import { inr, parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const LINES = 8;
const idOnly = z.object({ id: cuid("Bill") });

export const createBill = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), contractorId: cuid("Contractor"), periodFrom: dateStr("Period start"), periodTo: dateStr("Period end"), retentionPct: z.coerce.number().min(0).max(30).default(5), tdsPct: z.coerce.number().min(0).max(30).default(1), gstPct: z.coerce.number().min(0).max(28).default(18), notes: z.string().max(500).optional() }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const c = await prisma.contractor.findFirst({ where: { id: d.contractorId, companyId: u.companyId, active: true } });
  if (!c) throw new UserError("Choose an active contractor.");
  const from = parseDate(d.periodFrom)!, to = parseDate(d.periodTo)!;
  if (to < from) throw new UserError("The period end must be on or after the start.");
  // Quantities already certified on earlier bills for the same work item, so the bill shows cumulative progress.
  const earlier = await prisma.rABillLine.findMany({ where: { companyId: u.companyId, bill: { projectId: p.id, contractorId: c.id, status: { in: ["CERTIFIED", "INVOICED"] } } }, select: { description: true, quantity: true } });
  const prev = new Map<string, number>();
  for (const e of earlier) prev.set(e.description.toLowerCase(), (prev.get(e.description.toLowerCase()) ?? 0) + e.quantity);
  const lines = [];
  for (let i = 0; i < LINES; i++) {
    const description = String(fd.get(`desc_${i}`) ?? "").trim(), qty = Number(fd.get(`qty_${i}`)), rate = Number(fd.get(`rate_${i}`));
    if (!description && !qty && !rate) continue;
    if (!description || !(qty > 0) || !(rate >= 0)) throw new UserError(`Line ${i + 1}: enter a description, a quantity above zero and a rate.`);
    lines.push({ companyId: u.companyId, description, unit: String(fd.get(`unit_${i}`) ?? "").trim() || "nos", quantity: qty, rate, prevQuantity: prev.get(description.toLowerCase()) ?? 0 });
  }
  if (!lines.length) throw new UserError("Add at least one measured item.");
  let bill;
  for (let attempt = 0; attempt < 3 && !bill; attempt++) {
    try { bill = await prisma.rABill.create({ data: { companyId: u.companyId, projectId: p.id, contractorId: c.id, number: `RA-${new Date().getFullYear()}-${String((await prisma.rABill.count({ where: { companyId: u.companyId } })) + 1 + attempt).padStart(4, "0")}`, periodFrom: from, periodTo: to, retentionPct: d.retentionPct, tdsPct: d.tdsPct, gstPct: d.gstPct, notes: d.notes, createdById: u.id, lines: { create: lines } } }); }
    catch (e) { if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e; }
  }
  refresh(); redirect(`/bills/${bill!.id}`);
});

async function load(u: { companyId: string }, id: string) {
  const b = await prisma.rABill.findFirst({ where: { id, companyId: u.companyId }, include: { lines: true, contractor: true, project: { select: { name: true, managerId: true } } } });
  if (!b) throw new UserError("Bill not found.");
  return b;
}
const directors = async (companyId: string) => (await prisma.user.findMany({ where: { companyId, role: "DIRECTOR", active: true }, select: { id: true } })).map((x) => x.id);

export const submitBill = action(async (u, fd) => {
  assertManager(u);
  const b = await load(u, idOnly.parse(obj(fd)).id); await assertProject(u, b.projectId);
  if (b.status !== "DRAFT") throw new UserError("Only draft bills can be submitted.");
  await prisma.rABill.update({ where: { id: b.id }, data: { status: "SUBMITTED" } });
  await notify(u.companyId, await directors(u.companyId), { type: "BILL", title: "Contractor bill awaiting certification", body: `${b.number} · ${b.contractor.name} — ${b.project.name}`, href: `/bills/${b.id}` }, u.id);
  refresh();
});
export const certifyBill = action(async (u, fd) => {
  assertDirector(u);
  const b = await load(u, idOnly.parse(obj(fd)).id);
  if (b.status !== "SUBMITTED") throw new UserError("Only submitted bills can be certified.");
  await prisma.rABill.update({ where: { id: b.id }, data: { status: "CERTIFIED", certifiedById: u.id } });
  await logActivity({ companyId: u.companyId, projectId: b.projectId, actorId: u.id, type: "FINANCE", message: `${b.number} certified`, detail: `${b.contractor.name} — ${b.project.name}` });
  const fin = await prisma.user.findMany({ where: { companyId: u.companyId, role: "ACCOUNTANT", active: true }, select: { id: true } });
  await notify(u.companyId, [b.createdById, ...fin.map((x) => x.id)], { type: "BILL", title: "Contractor bill certified", body: `${b.number} · ${b.contractor.name}`, href: `/bills/${b.id}` }, u.id);
  refresh();
});
export const reopenBill = action(async (u, fd) => {
  assertDirector(u);
  const b = await load(u, idOnly.parse(obj(fd)).id);
  if (b.status !== "SUBMITTED" && b.status !== "CERTIFIED") throw new UserError("This bill can't be sent back.");
  await prisma.rABill.update({ where: { id: b.id }, data: { status: "DRAFT", certifiedById: null } });
  await notify(u.companyId, [b.createdById], { type: "BILL", title: "Contractor bill sent back for changes", body: b.number, href: `/bills/${b.id}` }, u.id);
  refresh();
});
/** A certified bill becomes a pending SUBCONTRACT expense for the net payable, which then follows approval → payment. */
export const invoiceBill = action(async (u, fd) => {
  assertFinance(u);
  const b = await load(u, idOnly.parse(obj(fd)).id);
  if (b.status !== "CERTIFIED") throw new UserError("Only certified bills can be invoiced.");
  const t = billTotals(b.lines.map((l) => ({ quantity: l.quantity, rate: Number(l.rate) })), b.retentionPct, b.tdsPct, b.gstPct);
  const e = await prisma.$transaction(async (tx) => {
    const ex = await tx.expense.create({ data: { companyId: u.companyId, projectId: b.projectId, category: "SUBCONTRACT", description: `RA bill ${b.number} — ${b.contractor.name}`, amount: Math.round(t.net * 100) / 100, date: startOfToday(), invoiceNo: b.number, contractorId: b.contractorId, createdById: u.id } });
    await tx.rABill.update({ where: { id: b.id }, data: { status: "INVOICED", expenseId: ex.id } });
    return ex;
  });
  await notify(u.companyId, await directors(u.companyId), { type: "EXPENSE", title: "Expense awaiting approval", body: `${inr(Number(e.amount))} · ${b.number} — ${b.project.name}`, href: "/expenses?status=PENDING" }, u.id);
  refresh(); return { message: `Expense of ${inr(t.net)} created and sent for approval` };
});
export const deleteBill = action(async (u, fd) => {
  assertManager(u);
  const b = await load(u, idOnly.parse(obj(fd)).id); await assertProject(u, b.projectId);
  if (b.status !== "DRAFT") throw new UserError("Only draft bills can be deleted.");
  await prisma.rABill.delete({ where: { id: b.id } });
  refresh(); redirect("/bills");
});
