import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProject } from "@/actions/projects";
import { ActionForm } from "@/components/forms";
import { Card, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { addDays, opts, startOfToday, toInputDate, TYPE_LABEL } from "@/lib/utils";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const u = await requireUser();
  if (u.role !== "DIRECTOR") notFound();
  const managers = await prisma.user.findMany({ where: { companyId: u.companyId, active: true, role: { not: "SITE_SUPERVISOR" } }, orderBy: { name: "asc" } });
  const today = startOfToday();
  return (
    <>
      <PageHeader title="New project" sub="Six standard construction phases are created for you — adjust them on the Timeline tab." />
      <Card className="max-w-3xl p-6">
        <ActionForm action={createProject} submit="Create project" className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2"><input name="name" required className={inputCls} placeholder="Dona Paula Villa" /></Field>
          <Field label="Client"><input name="client" required className={inputCls} /></Field>
          <Field label="Location"><input name="location" required className={inputCls} placeholder="Dona Paula, Goa" /></Field>
          <Field label="Project type"><Select name="type" options={opts(TYPE_LABEL)} defaultValue="RESIDENTIAL" /></Field>
          <Field label="Budget (₹)"><input name="budget" type="number" min={0} step="1" required className={inputCls} placeholder="32000000" /></Field>
          <Field label="Start date"><input name="startDate" type="date" required defaultValue={toInputDate(today)} className={inputCls} /></Field>
          <Field label="Expected completion"><input name="expectedEnd" type="date" required defaultValue={toInputDate(addDays(today, 365))} className={inputCls} /></Field>
          <Field label="Project manager" className="sm:col-span-2"><Select name="managerId" required placeholder="Choose a manager…" defaultValue={u.id} options={managers.map((m) => ({ value: m.id, label: `${m.name} · ${m.role === "DIRECTOR" ? "Director" : "Project Manager"}` }))} /></Field>
          <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={3} className={`${inputCls} h-auto py-2`} placeholder="Scope, site notes, key constraints…" /></Field>
        </ActionForm>
      </Card>
    </>
  );
}
