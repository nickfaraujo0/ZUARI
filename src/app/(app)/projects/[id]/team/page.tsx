import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDirector, isManager, requireProject } from "@/lib/access";
import { addMember, removeMember } from "@/actions/projects";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { NewUserForm } from "@/components/user-form";
import { Avatar, Card, CardHead, Chip, Field, Select } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/utils";

export const metadata = { title: "Team" };

export default async function TeamTab({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const [members, others, taskCounts, contractors] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId: p.id, companyId: u.companyId }, include: { user: true }, orderBy: { addedAt: "asc" } }),
    prisma.user.findMany({ where: { companyId: u.companyId, active: true, memberships: { none: { projectId: p.id } } }, orderBy: { name: "asc" } }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { projectId: p.id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } }, _count: true }),
    prisma.contractor.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const canManage = isManager(u);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <CardHead title="Project team" sub={`${members.length} member${members.length === 1 ? "" : "s"}`} />
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {members.map(({ user }) => (
            <li key={user.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={user.name} size={36} />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{user.name}{user.id === p.managerId && <Chip tone="sand" className="ml-2">Project manager</Chip>}</p><p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]} · {user.email}</p></div>
              <span className="text-xs text-muted">{taskCounts.find((t) => t.assigneeId === user.id)?._count ?? 0} open tasks</span>
              {canManage && user.id !== p.managerId && (
                <ActionForm action={removeMember} hideSubmit><input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="userId" value={user.id} /><ConfirmSubmit message={`Remove ${user.name} from this project?`} className="text-xs text-red-700 hover:underline">Remove</ConfirmSubmit></ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {canManage && (
        <div className="space-y-6">
          {others.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold">Add existing person</h2>
              <ActionForm action={addMember} reset submit="Add to project" variant="secondary">
                <input type="hidden" name="projectId" value={p.id} />
                <Field label="Person"><Select name="userId" required placeholder="Choose…" options={others.map((o) => ({ value: o.id, label: `${o.name} · ${ROLE_LABEL[o.role]}` }))} /></Field>
              </ActionForm>
            </Card>
          )}
          <Card className="p-5"><h2 className="mb-1 text-[15px] font-semibold">Add someone new</h2><p className="mb-4 text-xs text-muted">Creates their account and adds them to this project.</p><NewUserForm projectId={p.id} director={isDirector(u)} contractors={contractors} /></Card>
        </div>
      )}
    </div>
  );
}
