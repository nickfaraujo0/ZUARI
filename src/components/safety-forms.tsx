import { logToolbox, reportSafety } from "@/actions/safety";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { cn, SEVERITY, startOfToday, toInputDate } from "@/lib/utils";

const KINDS = [{ value: "NEAR_MISS", label: "Near miss" }, { value: "HAZARD", label: "Hazard spotted" }, { value: "INCIDENT", label: "Incident / injury" }];
export function ReportSafetyForm({ projects, defaultProject, mobile }: { projects: { id: string; name: string }[]; defaultProject?: string; mobile?: boolean }) {
  const c = mobile ? "!h-12 !text-base" : "";
  return (
    <ActionForm action={reportSafety} reset submit="Submit report" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""} className="grid gap-3">
      <Field label="Project"><Select name="projectId" required defaultValue={defaultProject} placeholder="Choose…" className={c} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select name="kind" defaultValue="NEAR_MISS" className={c} options={KINDS} /></Field><Field label="Severity"><Select name="severity" defaultValue="MEDIUM" className={c} options={Object.entries(SEVERITY).map(([value, label]) => ({ value, label }))} /></Field></div>
      <Field label="What happened?"><textarea name="description" required rows={3} className={cn(inputCls, "h-auto py-2", mobile && "!text-base")} placeholder="Describe the event and where it happened" /></Field>
      <div className="grid grid-cols-3 gap-2"><Field label="Block"><input name="block" className={cn(inputCls, c)} /></Field><Field label="Floor"><input name="floor" className={cn(inputCls, c)} /></Field><Field label="Injured"><input name="injuredCount" type="number" min={0} defaultValue={0} className={cn(inputCls, c)} /></Field></div>
      <Field label="Action taken (optional)"><input name="actionsTaken" className={cn(inputCls, c)} placeholder="First aid given, area cordoned…" /></Field>
    </ActionForm>
  );
}
export function ToolboxForm({ projects, workers, defaultProject, mobile }: { projects: { id: string; name: string }[]; workers: { id: string; name: string; trade: string }[]; defaultProject?: string; mobile?: boolean }) {
  const c = mobile ? "!h-12 !text-base" : "";
  return (
    <ActionForm action={logToolbox} reset submit="Record toolbox talk" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""} className="grid gap-3">
      <Field label="Project"><Select name="projectId" required defaultValue={defaultProject} placeholder="Choose…" className={c} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
      <div className="grid grid-cols-[1fr_auto] gap-3"><Field label="Topic"><input name="topic" required className={cn(inputCls, c)} placeholder="Working at height, PPE, fire safety…" /></Field><Field label="Date"><input name="date" type="date" max={toInputDate(startOfToday())} defaultValue={toInputDate(startOfToday())} className={cn(inputCls, c)} /></Field></div>
      <fieldset><legend className="mb-1.5 text-xs font-medium text-charcoal/80">Attended</legend>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-white p-2">{workers.map((w) => <label key={w.id} className={cn("flex items-center gap-3 rounded-md px-2 hover:bg-stone-50", mobile ? "py-2.5" : "py-1.5")}><input type="checkbox" name={`w_${w.id}`} className="size-5 accent-[#123C36]" /><span className="text-sm">{w.name} <span className="text-xs text-muted">· {w.trade}</span></span></label>)}{!workers.length && <p className="p-2 text-sm text-muted">Add workers under Workforce first.</p>}</div></fieldset>
      <Field label="Notes (optional)"><input name="notes" className={cn(inputCls, c)} /></Field>
    </ActionForm>
  );
}
