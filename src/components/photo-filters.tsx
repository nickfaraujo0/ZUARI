import Link from "next/link";
import { cn } from "@/lib/utils";
import { inputCls } from "./ui";
import { Select } from "./ui";

export function PhotoFilters({ view, tasks, users, projects, values }: {
  view: string; tasks?: { id: string; title: string }[]; users: { id: string; name: string }[]; projects?: { id: string; name: string }[]; values: Record<string, string | undefined>;
}) {
  return (
    <form className="mb-6 flex flex-wrap items-end gap-3">
      <input type="hidden" name="view" value={view} />
      {projects && <label className="text-[11px] text-muted">Project<Select name="project" defaultValue={values.project} placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="mt-1 h-9 w-48" /></label>}
      <label className="text-[11px] text-muted">Date<input type="date" name="date" defaultValue={values.date} className={cn(inputCls, "mt-1 h-9 w-40")} /></label>
      {tasks && <label className="text-[11px] text-muted">Task<Select name="task" defaultValue={values.task} placeholder="All tasks" options={tasks.map((t) => ({ value: t.id, label: t.title }))} className="mt-1 h-9 w-56" /></label>}
      <label className="text-[11px] text-muted">Taken by<Select name="user" defaultValue={values.user} placeholder="Anyone" options={users.map((u) => ({ value: u.id, label: u.name }))} className="mt-1 h-9 w-44" /></label>
      <button className="h-9 rounded-lg bg-river px-4 text-sm font-medium text-ivory">Filter</button>
      <Link href="?" className="pb-2 text-xs text-muted hover:underline">Clear</Link>
    </form>
  );
}
export function ViewToggle({ view, base }: { view: string; base: string }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
      {[["gallery", "Gallery"], ["journal", "Journal"]].map(([k, l]) => <Link key={k} href={`${base}?view=${k}`} className={cn("rounded-md px-3 py-1", view === k ? "bg-river text-ivory" : "text-muted")}>{l}</Link>)}
    </div>
  );
}
