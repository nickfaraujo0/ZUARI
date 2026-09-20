import { createProject, updateProject } from "@/actions/projects";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { opts, toInputDate, TYPE_LABEL } from "@/lib/utils";

type P = { latitude?: number | null; longitude?: number | null; id: string; name: string; client: string; location: string; type: string; startDate: Date; expectedEnd: Date; budget: number; managerId: string | null; description: string | null };
export function ProjectForm({ managers, project, canPickManager, defaults }: { managers: { id: string; name: string; role: string }[]; project?: P; canPickManager: boolean; defaults: { start: string; end: string; managerId: string } }) {
  return (
    <ActionForm action={project ? updateProject : createProject} submit={project ? "Save changes" : "Create project"} className="grid gap-4 sm:grid-cols-2">
      {project && <input type="hidden" name="projectId" value={project.id} />}
      <Field label="Project name" className="sm:col-span-2"><input name="name" required defaultValue={project?.name} className={inputCls} placeholder="Dona Paula Villa" /></Field>
      <Field label="Client"><input name="client" required defaultValue={project?.client} className={inputCls} /></Field>
      <Field label="Location"><input name="location" required defaultValue={project?.location} className={inputCls} placeholder="Dona Paula, Goa" /></Field>
      <Field label="Project type"><Select name="type" options={opts(TYPE_LABEL)} defaultValue={project?.type ?? "RESIDENTIAL"} /></Field>
      <Field label="Budget (₹)"><input name="budget" type="number" min={0} step="1" required defaultValue={project?.budget} className={inputCls} placeholder="32000000" /></Field>
      <Field label="Start date"><input name="startDate" type="date" required defaultValue={project ? toInputDate(project.startDate) : defaults.start} className={inputCls} /></Field>
      <Field label="Expected completion"><input name="expectedEnd" type="date" required defaultValue={project ? toInputDate(project.expectedEnd) : defaults.end} className={inputCls} /></Field>
      {canPickManager ? (
        <Field label="Project manager" className="sm:col-span-2"><Select name="managerId" required defaultValue={project?.managerId ?? defaults.managerId} options={managers.map((m) => ({ value: m.id, label: `${m.name} · ${m.role === "DIRECTOR" ? "Director" : "Project Manager"}` }))} /></Field>
      ) : project && <p className="text-xs text-muted sm:col-span-2">Only a director can change the project manager.</p>}
      <Field label="Latitude (optional)" hint="For the project map"><input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={project?.latitude ?? ""} className={inputCls} placeholder="15.4569" /></Field>
      <Field label="Longitude (optional)"><input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={project?.longitude ?? ""} className={inputCls} placeholder="73.8025" /></Field>
      <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={3} defaultValue={project?.description ?? ""} className={`${inputCls} h-auto py-2`} placeholder="Scope, site notes, key constraints…" /></Field>
    </ActionForm>
  );
}
