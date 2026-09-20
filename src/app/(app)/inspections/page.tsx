import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope, requireManagerPage } from "@/lib/access";
import { ensureTemplates } from "@/lib/inspections";
import { deleteTemplate, saveTemplate } from "@/actions/inspections";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { INSPECTION_TONE } from "@/components/inspection";
import { StartInspectionForm } from "@/components/start-inspection";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, PageHeader, Stat } from "@/components/ui";
import { cn, fmtDate } from "@/lib/utils";

export const metadata = { title: "Inspections" };

export default async function Inspections({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requireUser();
  requireManagerPage(u);
  await ensureTemplates(u.companyId);
  const sp = await searchParams;
  const st = ["OPEN", "PASSED", "FAILED"].includes(sp.status ?? "") ? (sp.status as "OPEN") : undefined;
  const base = { companyId: u.companyId, project: projectScope(u) };
  const [list, counts, projects, templates, tasks] = await Promise.all([
    prisma.inspection.findMany({ where: { ...base, ...(st ? { status: st } : {}) }, include: { project: { select: { name: true } }, inspector: { select: { name: true } }, items: { select: { result: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.inspection.groupBy({ by: ["status"], where: base, _count: true }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.inspectionTemplate.findMany({ where: { companyId: u.companyId }, orderBy: { name: "asc" } }),
    prisma.task.findMany({ where: { ...base, status: { in: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true, title: true, project: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0, done = n("PASSED") + n("FAILED");
  return (
    <>
      <PageHeader title="Inspections" sub="Quality and safety checklists. Failed items become snags automatically." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Pass rate" value={done ? `${Math.round((n("PASSED") / done) * 100)}%` : "—"} sub={`${done} completed`} /><Stat label="In progress" value={n("OPEN")} /><Stat label="Passed" value={n("PASSED")} /><Stat label="Failed" value={n("FAILED")} tone={n("FAILED") ? "red" : undefined} /></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHead title="Inspections" action={<div className="flex gap-1 text-xs">{[["", "All"], ["OPEN", "In progress"], ["PASSED", "Passed"], ["FAILED", "Failed"]].map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (sp.status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>} />
            {!list.length ? <EmptyState icon={<ClipboardCheck className="size-5" />} title="No inspections yet" body="Start one from the form, or from ZUARI Site on a phone." /> : (
              <ul className="divide-y divide-line/70 border-t border-line/70">{list.map((i) => (
                <li key={i.id}><Link href={`/inspections/${i.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-stone-50"><span className="min-w-0 flex-1 basis-56"><span className="block text-sm font-medium">{i.title}</span><span className="text-xs text-muted">{i.project.name} · {i.inspector.name} · {fmtDate(i.createdAt)}</span></span><span className="text-xs text-muted">{i.items.filter((x) => x.result === "PASS").length}/{i.items.length} passed</span><Chip tone={INSPECTION_TONE[i.status]} dot>{i.status === "OPEN" ? "In progress" : i.status === "PASSED" ? "Passed" : "Failed"}</Chip></Link></li>))}</ul>
            )}
          </Card>
          <Card>
            <CardHead title="Checklists" sub="Templates your team can start from" />
            <ul className="divide-y divide-line/70 border-t border-line/70">{templates.map((t) => (
              <li key={t.id} className="px-5 py-3"><div className="flex items-center gap-2"><span className="flex-1 text-sm font-medium">{t.name} <span className="text-xs font-normal text-muted">· {t.items.length} items{t.category ? ` · ${t.category}` : ""}</span></span></div>
                <details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary>
                  <div className="mt-2 rounded-lg border border-line bg-stone-50 p-3"><ActionForm action={saveTemplate} submit="Save" size="sm" variant="secondary" className="grid gap-3"><input type="hidden" name="id" value={t.id} /><Field label="Name"><input name="name" required defaultValue={t.name} className={inputCls} /></Field><Field label="Category"><input name="category" defaultValue={t.category ?? ""} className={inputCls} /></Field><Field label="Items (one per line)"><textarea name="items" rows={6} required defaultValue={t.items.join("\n")} className={`${inputCls} h-auto py-2`} /></Field></ActionForm>
                    <ActionForm action={deleteTemplate} hideSubmit className="mt-2"><input type="hidden" name="id" value={t.id} /><ConfirmSubmit message={`Delete checklist “${t.name}”? Past inspections keep their items.`} className="text-xs text-red-700 hover:underline">Delete checklist</ConfirmSubmit></ActionForm></div></details></li>))}</ul>
            <ActionForm action={saveTemplate} reset submit="Add checklist" size="sm" className="grid gap-3 border-t border-line bg-stone-50/60 p-5"><Field label="New checklist name"><input name="name" required className={inputCls} /></Field><Field label="Category"><input name="category" className={inputCls} /></Field><Field label="Items (one per line)"><textarea name="items" rows={4} required className={`${inputCls} h-auto py-2`} /></Field></ActionForm>
          </Card>
        </div>
        <Card className="h-fit p-5"><h2 className="mb-4 text-[15px] font-semibold">Start an inspection</h2><StartInspectionForm projects={projects} templates={templates} tasks={tasks} /></Card>
      </div>
    </>
  );
}
