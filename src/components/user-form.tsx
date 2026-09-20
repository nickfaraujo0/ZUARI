import { createUser } from "@/actions/users";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { ROLE_LABEL } from "@/lib/utils";
import { isSiteRole } from "@/lib/roles";

export function NewUserForm({ projectId, director, contractors = [] }: { projectId?: string; director: boolean; contractors?: { id: string; name: string }[] }) {
  const roles = director ? Object.entries(ROLE_LABEL) : Object.entries(ROLE_LABEL).filter(([r]) => isSiteRole(r));
  return (
    <ActionForm action={createUser} reset submit="Create account" className="space-y-3">
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      <Field label="Full name"><input name="name" required className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" required className={inputCls} /></Field>
      <Field label="Role"><Select name="role" defaultValue="SITE_SUPERVISOR" options={roles.map(([value, label]) => ({ value, label }))} /></Field>
      {contractors.length > 0 && <Field label="Contractor company" hint="Only for the Contractor role"><Select name="contractorId" placeholder="—" options={contractors.map((c) => ({ value: c.id, label: c.name }))} /></Field>}
      <Field label="Phone (optional)"><input name="phone" className={inputCls} /></Field>
      <Field label="Temporary password" hint="Leave blank to generate one"><input name="password" type="text" minLength={8} className={inputCls} autoComplete="off" /></Field>
    </ActionForm>
  );
}
