"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, dateStr, obj, optId } from "@/lib/action";
import { assertDirector, assertFinance, assertProject, UserError } from "@/lib/access";
import { logActivity, notify } from "@/lib/services";
import { inr, parseDate, startOfToday } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const CATS = ["LABOUR", "MATERIALS", "SUBCONTRACT", "EQUIPMENT", "OVERHEADS", "OTHER"] as const;

export const addBudgetLine = action(async (u, fd) => {
  assertFinance(u);
  const d = z.object({ projectId: cuid("Project"), category: z.enum(CATS), name: z.string().min(2, "Describe the budget line").max(100), amount: z.coerce.number({ error: "Enter an amount" }).positive("Amount must be above zero").max(1e12) }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  await prisma.budgetLine.create({ data: { companyId: u.companyId, projectId: p.id, category: d.category, name: d.name, amount: d.amount } });
  refresh(); return { message: "Budget line added" };
});
export const deleteBudgetLine = action(async (u, fd) => {
  assertFinance(u);
  const { id } = z.object({ id: cuid("Line") }).parse(obj(fd));
  const r = await prisma.budgetLine.deleteMany({ where: { id, companyId: u.companyId } });
  if (!r.count) throw new UserError("Budget line not found.");
  refresh();
});

export const addExpense = action(async (u, fd) => {
  assertFinance(u);
  const d = z.object({ projectId: cuid("Project"), category: z.enum(CATS), description: z.string().min(2, "Describe the expense").max(200), amount: z.coerce.number({ error: "Enter an amount" }).positive("Amount must be above zero").max(1e12), date: dateStr("Date"), invoiceNo: z.string().max(60).optional(), supplierId: optId, contractorId: optId, poId: optId }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  if (parseDate(d.date)! > new Date(startOfToday().getTime() + 864e5)) throw new UserError("The date can't be in the future.");
  if (d.supplierId && !(await prisma.supplier.findFirst({ where: { id: d.supplierId, companyId: u.companyId } }))) throw new UserError("Unknown supplier.");
  if (d.contractorId && !(await prisma.contractor.findFirst({ where: { id: d.contractorId, companyId: u.companyId } }))) throw new UserError("Unknown contractor.");
  if (d.poId && !(await prisma.purchaseOrder.findFirst({ where: { id: d.poId, companyId: u.companyId, projectId: p.id } }))) throw new UserError("That purchase order isn't part of this project.");
  if (d.invoiceNo && d.supplierId && (await prisma.expense.findFirst({ where: { companyId: u.companyId, supplierId: d.supplierId, invoiceNo: d.invoiceNo } }))) throw new UserError("An expense with this supplier and invoice number is already recorded.");
  await prisma.expense.create({ data: { companyId: u.companyId, projectId: p.id, category: d.category, description: d.description, amount: d.amount, date: parseDate(d.date)!, invoiceNo: d.invoiceNo, supplierId: d.supplierId, contractorId: d.contractorId, poId: d.poId, createdById: u.id } });
  const dirs = await prisma.user.findMany({ where: { companyId: u.companyId, role: "DIRECTOR", active: true }, select: { id: true } });
  await notify(u.companyId, dirs.map((x) => x.id), { type: "EXPENSE", title: "Expense awaiting approval", body: `${inr(d.amount)} · ${d.description} — ${p.name}`, href: "/expenses?status=PENDING" }, u.id);
  refresh(); return { message: "Expense recorded — awaiting director approval" };
});

const idOnly = z.object({ id: cuid("Expense") });
export const approveExpense = action(async (u, fd) => {
  assertDirector(u);
  const { id } = idOnly.parse(obj(fd));
  const e = await prisma.expense.findFirst({ where: { id, companyId: u.companyId, status: "PENDING" }, include: { project: { select: { name: true } } } });
  if (!e) throw new UserError("That expense was already handled.");
  await prisma.expense.update({ where: { id }, data: { status: "APPROVED", approvedById: u.id } });
  await logActivity({ companyId: u.companyId, projectId: e.projectId, actorId: u.id, type: "FINANCE", message: `${u.name} approved ${inr(Number(e.amount))}`, detail: `${e.description} — ${e.project.name}` });
  await notify(u.companyId, [e.createdById], { type: "EXPENSE", title: "Expense approved", body: `${inr(Number(e.amount))} · ${e.description}`, href: "/payments" }, u.id);
  refresh();
});
export const deleteExpense = action(async (u, fd) => {
  assertFinance(u);
  const { id } = idOnly.parse(obj(fd));
  const r = await prisma.expense.deleteMany({ where: { id, companyId: u.companyId, status: "PENDING" } });
  if (!r.count) throw new UserError("Only pending expenses can be deleted.");
  refresh();
});
export const payExpense = action(async (u, fd) => {
  assertFinance(u);
  const d = idOnly.extend({ method: z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "CASH"]), reference: z.string().max(80).optional(), paidOn: dateStr("Payment date") }).parse(obj(fd));
  const e = await prisma.expense.findFirst({ where: { id: d.id, companyId: u.companyId, status: "APPROVED" }, include: { project: { select: { name: true } } } });
  if (!e) throw new UserError("Only approved expenses can be paid.");
  await prisma.expense.update({ where: { id: e.id }, data: { status: "PAID", paidAt: parseDate(d.paidOn), paymentMethod: d.method, paymentRef: d.reference } });
  await logActivity({ companyId: u.companyId, projectId: e.projectId, actorId: u.id, type: "FINANCE", message: `${inr(Number(e.amount))} paid`, detail: `${e.description} — ${e.project.name}` });
  refresh(); return { message: "Payment recorded" };
});
