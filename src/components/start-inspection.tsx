import { startInspection } from "@/actions/inspections";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { cn } from "@/lib/utils";

export function StartInspectionForm({ projects, templates, tasks, defaultProject, mobile }: { projects: { id: string; name: string }[]; templates: { id: string; name: string; category: string | null }[]; tasks: { id: string; title: string; project: { name: string } }[]; defaultProject?: string; mobile?: boolean }) {
  const c = mobile ? "!h-12 !text-base" : "";
  return (
    <ActionForm action={startInspection} submit="Start inspection" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""} className="grid gap-3">
      <Field label="Project"><Select name="projectId" required defaultValue={defaultProject} placeholder="Choose…" className={c} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
      <Field label="Checklist"><Select name="templateId" placeholder="— my own items —" className={c} options={templates.map((t) => ({ value: t.id, label: t.category ? `${t.name} · ${t.category}` : t.name }))} /></Field>
      <Field label="Link to a task (optional)" hint="A linked task can only be Verified after its inspection passes"><Select name="taskId" placeholder="—" className={c} options={tasks.map((t) => ({ value: t.id, label: `${t.project.name} · ${t.title}` }))} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Block"><input name="block" className={cn(inputCls, c)} placeholder="Block A" /></Field><Field label="Floor"><input name="floor" className={cn(inputCls, c)} placeholder="Floor 2" /></Field><Field label="Area"><input name="area" className={cn(inputCls, c)} placeholder="Slab" /></Field>
      </div>
      <details className="text-sm"><summary className="cursor-pointer text-river">Custom checklist</summary><div className="mt-2 grid gap-2"><input name="title" placeholder="Title (needed for custom)" className={cn(inputCls, c)} /><textarea name="custom" rows={4} placeholder="One item per line" className={cn(inputCls, "h-auto py-2", mobile && "!text-base")} /></div></details>
    </ActionForm>
  );
}
