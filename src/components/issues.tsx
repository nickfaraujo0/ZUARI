import { AlertTriangle } from "lucide-react";
import { updateIssue } from "@/actions/issues";
import { ActionForm } from "./forms";
import { Avatar, Chip, EmptyState, Photo, Select, inputCls } from "./ui";
import { fmtDate, fmtTime, ISSUE_STATUS, ISSUE_TONE, opts, SEVERITY, SEVERITY_TONE, toInputDate } from "@/lib/utils";

type Row = {
  id: string; title: string; description: string | null; area: string | null; block?: string | null; floor?: string | null; severity: keyof typeof SEVERITY; status: keyof typeof ISSUE_STATUS; createdAt: Date; dueDate: Date | null; assigneeId: string | null;
  reporter: { name: string }; assignee: { name: string } | null; task: { title: string } | null; photos: { id: string }[]; project?: { name: string }; inspectionItemId?: string | null; documentId?: string | null;
};

export function IssuesList({ issues, people, showProject, canManage = true }: { issues: Row[]; people: { id: string; name: string }[]; showProject?: boolean; canManage?: boolean }) {
  if (!issues.length) return <EmptyState icon={<AlertTriangle className="size-5" />} title="No issues here" body="Issues reported from site show up instantly with their photos, severity and location." />;
  return (
    <ul className="space-y-4">
      {issues.map((i) => (
        <li key={i.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <div className="flex flex-col gap-4 p-5 md:flex-row">
            {i.photos.length > 0 && (
              <div className="flex shrink-0 gap-2">{i.photos.slice(0, 2).map((p) => <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer"><Photo id={p.id} className="size-24 rounded-lg" alt={i.title} /></a>)}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Chip tone={SEVERITY_TONE[i.severity]} dot>{SEVERITY[i.severity]}</Chip><Chip tone={ISSUE_TONE[i.status]}>{ISSUE_STATUS[i.status]}</Chip>{i.inspectionItemId && <Chip tone="sand">Snag</Chip>}{i.documentId && <Chip tone="teal">Pinned on drawing</Chip>}</div>
              <h3 className="mt-2 text-base font-semibold leading-snug">{i.title}</h3>
              {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {showProject && i.project && <span className="font-medium text-charcoal">{i.project.name}</span>}
                {(i.area || i.task || i.block || i.floor) && <span>{[i.block, i.floor, i.area, i.task?.title].filter(Boolean).join(" · ")}</span>}
                <span className="flex items-center gap-1.5"><Avatar name={i.reporter.name} size={18} />{i.reporter.name}</span>
                <span>{fmtDate(i.createdAt)}, {fmtTime(i.createdAt)}</span>
                {i.dueDate && <span>Due {fmtDate(i.dueDate)}</span>}
              </p>
            </div>
          </div>
          {canManage && (
            <ActionForm action={updateIssue} hideSubmit className="flex flex-wrap items-end gap-3 border-t border-line bg-stone-50/60 px-5 py-3">
              <input type="hidden" name="issueId" value={i.id} />
              <label className="text-[11px] text-muted">Status<Select name="status" defaultValue={i.status} options={opts(ISSUE_STATUS)} className="mt-1 h-9 w-36" /></label>
              <label className="text-[11px] text-muted">Severity<Select name="severity" defaultValue={i.severity} options={opts(SEVERITY)} className="mt-1 h-9 w-28" /></label>
              <label className="text-[11px] text-muted">Assign to<Select name="assigneeId" defaultValue={i.assigneeId} placeholder="Unassigned" options={people.map((p) => ({ value: p.id, label: p.name }))} className="mt-1 h-9 w-44" /></label>
              <label className="text-[11px] text-muted">Due<input type="date" name="dueDate" defaultValue={toInputDate(i.dueDate)} className={`${inputCls} mt-1 h-9 w-40`} /></label>
              <button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory hover:bg-river-soft">Update</button>
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  );
}
