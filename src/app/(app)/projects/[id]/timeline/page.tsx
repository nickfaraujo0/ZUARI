import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, requireProject } from "@/lib/access";
import { createPhase, deletePhase, updatePhase } from "@/actions/projects";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { Card, CardHead, Field, inputCls } from "@/components/ui";
import { fmtDate, fmtShort, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Timeline" };
const DAY = 864e5;

export default async function Timeline({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const phases = await prisma.projectPhase.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" }, include: { _count: { select: { tasks: true } } } });
  const min = Math.min(p.startDate.getTime(), ...phases.map((x) => x.startDate.getTime()));
  const max = Math.max(p.expectedEnd.getTime(), ...phases.map((x) => x.endDate.getTime()));
  const span = Math.max(max - min, DAY);
  const at = (t: number) => `${(((t - min) / span) * 100).toFixed(2)}%`;
  const months: Date[] = [];
  for (let d = new Date(min); d.getTime() <= max; ) { months.push(new Date(d)); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
  const today = startOfToday().getTime();
  const canEdit = isManager(u);
  return (
    <div className="space-y-6">
      <Card>
        <CardHead title="Construction timeline" sub={`${fmtDate(p.startDate)} → ${fmtDate(p.expectedEnd)}`} />
        <div className="overflow-x-auto px-5 pb-5">
          <div className="min-w-[720px]">
            <div className="relative ml-40 h-7 border-b border-line text-[11px] text-muted">
              {months.map((m, i) => <span key={i} className="absolute top-0 -translate-x-0 border-l border-line pl-1.5" style={{ left: at(Math.max(m.getTime(), min)) }}>{m.toLocaleDateString("en-IN", { month: "short", year: months.length > 12 ? "2-digit" : undefined, timeZone: "UTC" })}</span>)}
            </div>
            <div className="relative">
              {today >= min && today <= max && <div className="absolute bottom-0 top-0 z-10 ml-40 w-px bg-laterite" style={{ left: `calc((100% - 10rem) * ${(today - min) / span})` }}><span className="absolute -top-0.5 -translate-x-1/2 rounded bg-laterite px-1 text-[9px] text-white">Today</span></div>}
              {phases.map((ph) => {
                const done = ph.progress >= 100;
                return (
                  <div key={ph.id} className="flex h-11 items-center border-b border-line/60 last:border-0">
                    <div className="w-40 shrink-0 pr-3"><p className="text-sm font-medium leading-tight">{ph.name}</p><p className="text-[11px] text-muted">{done ? "Complete" : ph.progress > 0 ? `${ph.progress}%` : "Not started"}</p></div>
                    <div className="relative h-full flex-1">
                      <div className="absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-md bg-teal/20 ring-1 ring-inset ring-teal/30" style={{ left: at(ph.startDate.getTime()), width: `calc(${at(ph.endDate.getTime())} - ${at(ph.startDate.getTime())})` }} title={`${fmtShort(ph.startDate)} – ${fmtShort(ph.endDate)}`}>
                        <div className={`h-full ${done ? "bg-teal" : "bg-river"}`} style={{ width: `${ph.progress}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!phases.length && <p className="py-8 text-center text-sm text-muted">No phases yet. Add the first one below.</p>}
            </div>
          </div>
        </div>
      </Card>

      {canEdit && (
        <Card>
          <CardHead title="Manage phases" sub="Phase progress follows its tasks automatically. Phases without tasks use the value you set." />
          <div className="divide-y divide-line/70 border-t border-line/70">
            {phases.map((ph) => (
              <div key={ph.id} className="flex flex-wrap items-end gap-3 px-5 py-3">
                <ActionForm action={updatePhase} hideSubmit={false} submit="Save" size="sm" variant="secondary" className="flex flex-1 flex-wrap items-end gap-3" submitClass="!mt-0">
                  <input type="hidden" name="phaseId" value={ph.id} />
                  <Field label="Name" className="w-44"><input name="name" defaultValue={ph.name} required className={inputCls} /></Field>
                  <Field label="Start"><input type="date" name="startDate" defaultValue={toInputDate(ph.startDate)} className={inputCls} /></Field>
                  <Field label="End"><input type="date" name="endDate" defaultValue={toInputDate(ph.endDate)} className={inputCls} /></Field>
                  <Field label={ph._count.tasks ? `Progress (from ${ph._count.tasks} tasks)` : "Progress %"} className="w-40"><input type="number" name="progress" min={0} max={100} defaultValue={ph.progress} disabled={ph._count.tasks > 0} className={inputCls} /></Field>
                </ActionForm>
                <ActionForm action={deletePhase} hideSubmit><input type="hidden" name="phaseId" value={ph.id} /><ConfirmSubmit message={`Delete phase “${ph.name}”? Its tasks stay but lose their phase.`} className="pb-2 text-xs text-red-700 hover:underline">Delete</ConfirmSubmit></ActionForm>
              </div>
            ))}
            <ActionForm action={createPhase} reset submit="Add phase" size="sm" className="flex flex-wrap items-end gap-3 bg-stone-50/60 px-5 py-4" submitClass="!mt-0">
              <input type="hidden" name="projectId" value={p.id} />
              <Field label="New phase" className="w-44"><input name="name" required className={inputCls} placeholder="Handover" /></Field>
              <Field label="Start"><input type="date" name="startDate" required defaultValue={toInputDate(p.startDate)} className={inputCls} /></Field>
              <Field label="End"><input type="date" name="endDate" required defaultValue={toInputDate(p.expectedEnd)} className={inputCls} /></Field>
            </ActionForm>
          </div>
        </Card>
      )}
    </div>
  );
}
