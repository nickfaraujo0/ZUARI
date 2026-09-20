import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { addDelay } from "@/actions/delays";
import { ActionForm } from "@/components/forms";
import { SiteHeader } from "@/components/site-ui";
import { Field, inputCls, Select } from "@/components/ui";
import { opts, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Log a delay" };
const CAUSE = { WEATHER: "Weather", MATERIAL: "Material not available", APPROVAL: "Waiting for approval", LABOUR: "Labour shortage", DESIGN: "Design / drawing issue", EQUIPMENT: "Equipment breakdown", OTHER: "Other" };

export default async function SiteDelay() {
  const u = await requireUser();
  const projects = await prisma.project.findMany({ where: { ...projectScope(u), status: { not: "COMPLETED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const c = "!h-12 !text-base";
  return (
    <>
      <SiteHeader title="Log a delay" back="/site/more" />
      <div className="p-5"><p className="mb-4 text-sm text-muted">Record days lost and why. It builds the evidence for extension-of-time claims.</p>
        <ActionForm action={addDelay} reset submit="Log delay" size="lg" submitClass="w-full" className="grid gap-3">
          <Field label="Project"><Select name="projectId" required defaultValue={projects.length === 1 ? projects[0].id : undefined} placeholder="Choose…" className={c} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="Cause"><Select name="cause" defaultValue="WEATHER" className={c} options={opts(CAUSE)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Date"><input name="date" type="date" required max={toInputDate(startOfToday())} defaultValue={toInputDate(startOfToday())} className={`${inputCls} ${c}`} /></Field><Field label="Days lost"><input name="days" type="number" step="0.25" min="0.25" defaultValue={1} className={`${inputCls} ${c}`} /></Field></div>
          <Field label="What happened?"><textarea name="note" rows={3} className={`${inputCls} h-auto py-2 !text-base`} placeholder="Heavy rain stopped concreting from 11 am…" /></Field>
        </ActionForm></div>
    </>
  );
}
