import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, isFinance, projectScope } from "@/lib/access";
import { addExpense, approveExpense, deleteExpense } from "@/actions/finance";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { cn, EXPENSE_CATEGORY, EXPENSE_STATUS, EXPENSE_TONE, fmtShort, inr, opts, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Expenses" };

export default async function Expenses({ searchParams }: { searchParams: Promise<{ status?: string; project?: string; category?: string; po?: string }> }) {
  const u = await requireUser();
  if (!isFinance(u)) notFound();
  const sp = await searchParams;
  const where: Prisma.ExpenseWhereInput = { companyId: u.companyId, project: projectScope(u), ...(sp.status && sp.status in EXPENSE_STATUS ? { status: sp.status as "PAID" } : {}), ...(sp.project ? { projectId: sp.project } : {}), ...(sp.category && sp.category in EXPENSE_CATEGORY ? { category: sp.category as "LABOUR" } : {}) };
  const [items, projects, suppliers, contractors, po] = await Promise.all([
    prisma.expense.findMany({ where, include: { project: { select: { name: true } }, supplier: { select: { name: true } }, contractor: { select: { name: true } }, createdBy: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 150 }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contractor.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    sp.po ? prisma.purchaseOrder.findFirst({ where: { id: sp.po, companyId: u.companyId, project: projectScope(u) }, include: { lines: true } }) : null,
  ]);
  const poTotal = po ? po.lines.reduce((s, l) => s + l.quantity * Number(l.rate), 0) : undefined;
  const total = items.reduce((s, e) => s + Number(e.amount), 0);
  const tabs = [["", "All"], ...Object.entries(EXPENSE_STATUS)];
  return (
    <>
      <PageHeader title="Expenses" sub="Costs recorded against projects. Directors approve; then they move to Payments." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHead title={`${items.length} expense${items.length === 1 ? "" : "s"} · ${inr(total)}`} action={<div className="flex gap-1 text-xs">{tabs.map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (sp.status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>} />
          <form className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-3">
            <input type="hidden" name="status" value={sp.status ?? ""} />
            <Select name="project" defaultValue={sp.project} placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="h-9 w-48" />
            <Select name="category" defaultValue={sp.category} placeholder="All categories" options={opts(EXPENSE_CATEGORY)} className="h-9 w-44" />
            <button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory">Filter</button>
          </form>
          {!items.length ? <EmptyState icon={<Receipt className="size-5" />} title="No expenses" body="Record an expense using the form." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-y border-line bg-stone-50/60 text-left text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 font-medium">Expense</th><th className="px-3 font-medium">Project</th><th className="px-3 text-right font-medium">Amount</th><th className="px-3 font-medium">Status</th><th className="px-3" /></tr></thead>
              <tbody>{items.map((e) => (
                <tr key={e.id} className="border-b border-line/70 last:border-0"><td className="whitespace-nowrap px-5 py-2.5 text-[13px]">{fmtShort(e.date)}</td>
                  <td className="px-3"><p className="font-medium">{e.description}</p><p className="text-xs text-muted">{[EXPENSE_CATEGORY[e.category], e.supplier?.name ?? e.contractor?.name, e.invoiceNo && `Inv ${e.invoiceNo}`].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-3 text-muted">{e.project.name}</td><td className="px-3 text-right font-medium tabular-nums">{inr(Number(e.amount))}</td><td className="px-3"><Chip tone={EXPENSE_TONE[e.status]}>{EXPENSE_STATUS[e.status]}</Chip></td>
                  <td className="px-3"><div className="flex justify-end gap-3">
                    {e.status === "PENDING" && isDirector(u) && <ActionForm action={approveExpense} hideSubmit><input type="hidden" name="id" value={e.id} /><button className="rounded-lg bg-river px-3 py-1.5 text-xs font-medium text-ivory">Approve</button></ActionForm>}
                    {e.status === "PENDING" && <ActionForm action={deleteExpense} hideSubmit><input type="hidden" name="id" value={e.id} /><ConfirmSubmit message="Delete this pending expense?" className="text-xs text-red-700 hover:underline">Delete</ConfirmSubmit></ActionForm>}</div></td></tr>))}</tbody></table></div>
          )}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-1 text-[15px] font-semibold">Record an expense</h2>{po && <p className="mb-3 text-xs text-muted">Invoice for {po.number}</p>}
          <ActionForm action={addExpense} reset submit="Record expense" className="mt-3 grid gap-3">
            {po && <input type="hidden" name="poId" value={po.id} />}
            <Field label="Project"><Select name="projectId" required defaultValue={po?.projectId ?? sp.project} placeholder="Choose…" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Category"><Select name="category" defaultValue={po ? "MATERIALS" : "OTHER"} options={opts(EXPENSE_CATEGORY)} /></Field><Field label="Date"><input name="date" type="date" required max={toInputDate(startOfToday())} defaultValue={toInputDate(startOfToday())} className={inputCls} /></Field></div>
            <Field label="Description"><input name="description" required defaultValue={po ? `Materials — ${po.number}` : ""} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Amount (₹)"><input name="amount" type="number" min="1" step="0.01" required defaultValue={poTotal} className={inputCls} /></Field><Field label="Invoice no."><input name="invoiceNo" className={inputCls} /></Field></div>
            <Field label="Supplier"><Select name="supplierId" defaultValue={po?.supplierId} placeholder="—" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field label="Contractor"><Select name="contractorId" placeholder="—" options={contractors.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
