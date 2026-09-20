import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, isFinance, isManager, projectScope } from "@/lib/access";
import { billTotals } from "@/lib/bills";
import { certifyBill, deleteBill, invoiceBill, reopenBill, submitBill } from "@/actions/bills";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { PrintButton } from "@/components/print-button";
import { Chip } from "@/components/ui";
import { BILL_STATUS, BILL_TONE, fmtDate, inr, num } from "@/lib/utils";

export const metadata = { title: "Contractor bill" };
const btn = "rounded-lg px-4 py-2 text-sm font-medium";
function Act({ id, action, label, tone = "primary" }: { id: string; action: typeof submitBill; label: string; tone?: "primary" | "ghost" | "danger" }) {
  return <ActionForm action={action} hideSubmit><input type="hidden" name="id" value={id} />{tone === "danger" ? <ConfirmSubmit message="Delete this draft bill?" className={`${btn} border border-red-200 text-red-700`}>{label}</ConfirmSubmit> : <button className={`${btn} ${tone === "ghost" ? "border border-line bg-white" : "bg-river text-ivory"}`}>{label}</button>}</ActionForm>;
}

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const b = await prisma.rABill.findFirst({ where: { id: (await params).id, companyId: u.companyId, project: projectScope(u) }, include: { lines: true, contractor: true, project: { select: { name: true, code: true } }, expense: { select: { id: true, status: true } } } });
  if (!b || (!isManager(u) && !isFinance(u))) notFound();
  const t = billTotals(b.lines.map((l) => ({ quantity: l.quantity, rate: Number(l.rate) })), b.retentionPct, b.tdsPct, b.gstPct);
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-xl border border-line bg-white p-8 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.3em] text-muted">Running account bill</p><h1 className="font-serif text-4xl font-semibold text-river-deep">{b.number}</h1></div><div className="flex items-center gap-3 print:hidden"><Chip tone={BILL_TONE[b.status]}>{BILL_STATUS[b.status]}</Chip><PrintButton /></div></div>
      <div className="grid gap-x-8 gap-y-1 border-y border-line py-3 text-sm sm:grid-cols-2"><p><span className="text-muted">Contractor</span> <b>{b.contractor.name}</b></p><p><span className="text-muted">Project</span> {b.project.name} <span className="font-mono text-xs text-muted">{b.project.code}</span></p><p><span className="text-muted">Period</span> {fmtDate(b.periodFrom)} – {fmtDate(b.periodTo)}</p><p><span className="text-muted">GSTIN</span> {b.contractor.gstin ?? "—"}</p></div>
      <table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted"><th className="py-2 font-medium">Item</th><th className="text-right font-medium">Previous</th><th className="text-right font-medium">This bill</th><th className="text-right font-medium">Cumulative</th><th className="text-right font-medium">Rate</th><th className="text-right font-medium">Amount</th></tr></thead>
        <tbody>{b.lines.map((l) => <tr key={l.id} className="border-b border-line/60"><td className="py-2 font-medium">{l.description} <span className="text-xs font-normal text-muted">{l.unit}</span></td><td className="text-right tabular-nums text-muted">{num(l.prevQuantity)}</td><td className="text-right tabular-nums">{num(l.quantity)}</td><td className="text-right tabular-nums">{num(l.prevQuantity + l.quantity)}</td><td className="text-right tabular-nums">{inr(Number(l.rate))}</td><td className="text-right tabular-nums">{inr(l.quantity * Number(l.rate))}</td></tr>)}</tbody></table>
      <div className="ml-auto max-w-xs space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-muted">Gross value</span><span className="tabular-nums">{inr(t.gross)}</span></div><div className="flex justify-between"><span className="text-muted">+ GST {b.gstPct}%</span><span className="tabular-nums">{inr(t.gst)}</span></div><div className="flex justify-between"><span className="text-muted">− Retention {b.retentionPct}%</span><span className="tabular-nums">{inr(t.retention)}</span></div><div className="flex justify-between"><span className="text-muted">− TDS {b.tdsPct}%</span><span className="tabular-nums">{inr(t.tds)}</span></div><div className="flex justify-between border-t border-charcoal/30 pt-2 text-base font-semibold"><span>Net payable</span><span className="tabular-nums">{inr(t.net)}</span></div></div>
      {b.notes && <p className="text-sm text-muted">{b.notes}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 print:hidden">
        {b.status === "DRAFT" && isManager(u) && <><Act id={b.id} action={submitBill} label="Submit for certification" /><Act id={b.id} action={deleteBill} label="Delete draft" tone="danger" /></>}
        {b.status === "SUBMITTED" && isDirector(u) && <><Act id={b.id} action={certifyBill} label="Certify bill" /><Act id={b.id} action={reopenBill} label="Send back" tone="ghost" /></>}
        {b.status === "SUBMITTED" && !isDirector(u) && <p className="text-sm text-muted">Waiting for a Director to certify.</p>}
        {b.status === "CERTIFIED" && isFinance(u) && <Act id={b.id} action={invoiceBill} label="Create expense for payment" />}
        {b.status === "CERTIFIED" && isDirector(u) && <Act id={b.id} action={reopenBill} label="Send back" tone="ghost" />}
        {b.status === "CERTIFIED" && !isFinance(u) && <p className="text-sm text-muted">Certified. Finance will raise the expense.</p>}
        {b.expense && <Link href="/expenses" className="text-sm text-river underline">Expense: {b.expense.status.toLowerCase()} →</Link>}
        <Link href="/bills" className="ml-auto text-sm text-muted hover:underline">← All bills</Link>
      </div>
    </article>
  );
}
