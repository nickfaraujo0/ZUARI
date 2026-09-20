import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, requireProject } from "@/lib/access";
import { addWarranty, deleteWarranty } from "@/actions/handover";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { Card, CardHead, Chip, Field, inputCls, LinkButton, Stat } from "@/components/ui";
import { addDays, fmtDate, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Handover" };

export default async function Handover({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const [warranties, insp, snags, docs] = await Promise.all([
    prisma.warranty.findMany({ where: { projectId: p.id, companyId: u.companyId }, orderBy: { endDate: "asc" } }),
    prisma.inspection.groupBy({ by: ["status"], where: { projectId: p.id, companyId: u.companyId }, _count: true }),
    prisma.issue.count({ where: { projectId: p.id, companyId: u.companyId, inspectionItemId: { not: null }, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.document.count({ where: { projectId: p.id, companyId: u.companyId, category: { in: ["DRAWING", "CERTIFICATE", "CONTRACT"] } } }),
  ]);
  const today = startOfToday(), canEdit = isManager(u), n = (s: string) => insp.find((i) => i.status === s)?._count ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Inspections passed" value={n("PASSED")} sub={`${n("FAILED")} failed · ${n("OPEN")} open`} /><Stat label="Open snags" value={snags} tone={snags ? "amber" : undefined} sub="from inspections" /><Stat label="Drawings & certificates" value={docs} /><Stat label="Warranties" value={warranties.length} /></div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-[15px] font-semibold">Project Passport</h2><p className="text-sm text-muted">A printable record of the project: stages, key photos, drawings, certificates, inspections, snags, safety record and warranties.</p></div><LinkButton href={`/projects/${p.id}/passport`}>Open Project Passport</LinkButton></Card>
      <Card>
        <CardHead title="Warranties & defect liability" sub="Coverage you owe or are owed after handover" />
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {warranties.map((w) => { const left = Math.ceil((w.endDate.getTime() - today.getTime()) / 864e5); return (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><span className="min-w-0 flex-1 basis-56"><span className="font-medium">{w.item}</span><span className="block text-xs text-muted">{[w.provider, `${fmtDate(w.startDate)} → ${fmtDate(w.endDate)}`, w.notes].filter(Boolean).join(" · ")}</span></span>
              <Chip tone={left < 0 ? "red" : left <= 60 ? "amber" : "green"} dot>{left < 0 ? `Expired ${-left} d ago` : left <= 60 ? `Expires in ${left} d` : `${left} days left`}</Chip>
              {canEdit && <ActionForm action={deleteWarranty} hideSubmit><input type="hidden" name="id" value={w.id} /><ConfirmSubmit message="Remove this warranty?" className="text-xs text-red-700 hover:underline">Remove</ConfirmSubmit></ActionForm>}</li>); })}
          {!warranties.length && <li className="px-5 py-6 text-sm text-muted">No warranties recorded.</li>}
        </ul>
        {canEdit && <ActionForm action={addWarranty} reset submit="Add warranty" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5 sm:grid-cols-5" submitClass="sm:col-span-5 !mt-0 w-fit"><input type="hidden" name="projectId" value={p.id} />
          <Field label="Covers" className="sm:col-span-2"><input name="item" required className={inputCls} placeholder="Waterproofing — terrace" /></Field><Field label="Provider"><input name="provider" className={inputCls} /></Field>
          <Field label="From"><input name="startDate" type="date" required defaultValue={toInputDate(today)} className={inputCls} /></Field><Field label="Until"><input name="endDate" type="date" required defaultValue={toInputDate(addDays(today, 365 * 5))} className={inputCls} /></Field></ActionForm>}
      </Card>
      <p className="text-xs text-muted"><Link href={`/projects/${p.id}/documents`} className="text-river underline">Manage documents</Link> · Warranties expiring within 30 days notify the project manager.</p>
    </div>
  );
}
