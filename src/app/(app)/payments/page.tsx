import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFinance, projectScope } from "@/lib/access";
import { payExpense } from "@/actions/finance";
import { ActionForm } from "@/components/forms";
import { Card, CardHead, Chip, inputCls, PageHeader, Select, Stat } from "@/components/ui";
import { EXPENSE_CATEGORY, fmtDate, fmtShort, formatINR, inr, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Payments" };
const METHODS = [{ value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }, { value: "CASH", label: "Cash" }];

export default async function Payments() {
  const u = await requireUser();
  if (!isFinance(u)) notFound();
  const base = { companyId: u.companyId, project: projectScope(u) };
  const inc = { project: { select: { name: true } }, supplier: { select: { name: true } }, contractor: { select: { name: true } } };
  const [due, pending, paid] = await Promise.all([
    prisma.expense.findMany({ where: { ...base, status: "APPROVED" }, include: inc, orderBy: { date: "asc" } }),
    prisma.expense.findMany({ where: { ...base, status: "PENDING" }, include: inc, orderBy: { date: "asc" } }),
    prisma.expense.findMany({ where: { ...base, status: "PAID" }, include: inc, orderBy: { paidAt: "desc" }, take: 40 }),
  ]);
  const t = (l: { amount: unknown }[]) => l.reduce((s, e) => s + Number(e.amount), 0);
  return (
    <>
      <PageHeader title="Payments" sub="Approved expenses waiting to be paid, and payment history." />
      <div className="mb-6 grid grid-cols-3 gap-4"><Stat label="Ready to pay" value={formatINR(t(due))} sub={`${due.length} approved`} tone={due.length ? "amber" : undefined} /><Stat label="Awaiting approval" value={formatINR(t(pending))} sub={`${pending.length} pending`} /><Stat label="Paid (latest 40)" value={formatINR(t(paid))} /></div>
      <div className="space-y-6">
        <Card>
          <CardHead title="Ready to pay" />
          {!due.length ? <p className="px-5 pb-6 text-sm text-muted">Nothing is waiting for payment.</p> : (
            <ul className="divide-y divide-line/70 border-t border-line/70">{due.map((e) => (
              <li key={e.id} className="flex flex-wrap items-end gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-60"><p className="text-sm font-medium">{e.description}</p><p className="text-xs text-muted">{[e.project.name, e.supplier?.name ?? e.contractor?.name, e.invoiceNo && `Inv ${e.invoiceNo}`, EXPENSE_CATEGORY[e.category], fmtShort(e.date)].filter(Boolean).join(" · ")}</p></div>
                <span className="text-base font-semibold tabular-nums">{inr(Number(e.amount))}</span>
                <ActionForm action={payExpense} submit="Mark paid" size="sm" className="flex flex-wrap items-end gap-2" submitClass="!mt-0">
                  <input type="hidden" name="id" value={e.id} />
                  <Select name="method" options={METHODS} className="h-9 w-36" /><input name="reference" placeholder="Reference / UTR" className={`${inputCls} h-9 w-40`} /><input name="paidOn" type="date" required max={toInputDate(startOfToday())} defaultValue={toInputDate(startOfToday())} className={`${inputCls} h-9 w-40`} />
                </ActionForm>
              </li>))}</ul>)}
        </Card>
        <Card>
          <CardHead title="Payment history" />
          <ul className="divide-y divide-line/70 border-t border-line/70">{paid.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><span className="min-w-0 flex-1 basis-56"><span className="font-medium">{e.description}</span><span className="block text-xs text-muted">{e.project.name} · {e.supplier?.name ?? e.contractor?.name ?? "—"}</span></span><Chip>{METHODS.find((m) => m.value === e.paymentMethod)?.label ?? "Paid"}</Chip><span className="w-28 text-xs text-muted">{e.paymentRef ?? ""}</span><span className="w-24 text-xs text-muted">{e.paidAt ? fmtDate(e.paidAt) : ""}</span><span className="w-28 text-right font-medium tabular-nums">{inr(Number(e.amount))}</span></li>)}{!paid.length && <li className="px-5 py-6 text-sm text-muted">No payments yet.</li>}</ul>
        </Card>
      </div>
    </>
  );
}
