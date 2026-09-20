import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector } from "@/lib/access";
import { updateAutomation, updateCompany, updatePhaseTemplate } from "@/actions/settings";
import { ActionForm } from "@/components/forms";
import { Card, Field, inputCls, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const u = await requireUser();
  if (!isDirector(u)) notFound();
  const [c, users, projects] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: u.companyId } }),
    prisma.user.count({ where: { companyId: u.companyId, active: true } }), prisma.project.count({ where: { companyId: u.companyId } }),
  ]);
  return (
    <>
      <PageHeader title="Settings" sub="Company profile and project defaults." />
      <div className="mb-6 grid max-w-xl grid-cols-2 gap-4"><Stat label="Active users" value={users} /><Stat label="Projects" value={projects} /></div>
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Company profile</h2>
          <ActionForm action={updateCompany} submit="Save profile" className="grid gap-3">
            <Field label="Company name"><input name="name" required defaultValue={c.name} className={inputCls} /></Field>
            <Field label="Address"><input name="address" defaultValue={c.address ?? ""} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="GSTIN"><input name="gstin" defaultValue={c.gstin ?? ""} className={inputCls} /></Field><Field label="Phone"><input name="phone" defaultValue={c.phone ?? ""} className={inputCls} /></Field></div>
            <Field label="Email"><input name="email" type="email" defaultValue={c.email ?? ""} className={inputCls} /></Field>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-[15px] font-semibold">Default project phases</h2><p className="mb-4 text-xs text-muted">Every new project is created with these phases, in this order. Existing projects are not changed.</p>
          <ActionForm action={updatePhaseTemplate} submit="Save phases" className="grid gap-3"><Field label="One phase per line"><textarea name="phases" rows={9} required defaultValue={c.phaseTemplate.join("\n")} className={`${inputCls} h-auto py-2 font-mono text-[13px]`} /></Field></ActionForm>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 text-[15px] font-semibold">Automation &amp; accounting</h2><p className="mb-4 text-xs text-muted">When an unanswered serious issue or an overdue high-priority task is escalated to Directors, and the bank ledger used in Tally exports.</p>
          <ActionForm action={updateAutomation} submit="Save" className="grid gap-3 sm:grid-cols-3">
            <Field label="Escalate unanswered High/Critical issues after (hours)"><input name="escalateIssueHours" type="number" min={1} max={72} required defaultValue={c.escalateIssueHours} className={inputCls} /></Field>
            <Field label="Escalate High/Urgent tasks overdue by (days)"><input name="escalateTaskDays" type="number" min={1} max={30} required defaultValue={c.escalateTaskDays} className={inputCls} /></Field>
            <Field label="Tally bank ledger name"><input name="tallyBankLedger" required defaultValue={c.tallyBankLedger} className={inputCls} /></Field>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
