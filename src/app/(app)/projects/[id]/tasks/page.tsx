import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, requireProject, taskScope } from "@/lib/access";
import { TaskForm, TasksTable } from "@/components/tasks";
import { Card, CardHead } from "@/components/ui";
import { cn, TASK_STATUS } from "@/lib/utils";

export const metadata = { title: "Tasks" };

export default async function ProjectTasks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const { status } = await searchParams;
  const statusWhere = status === "open" ? { in: ["NOT_STARTED" as const, "IN_PROGRESS" as const] } : status && status in TASK_STATUS ? (status as keyof typeof TASK_STATUS) : undefined;
  const [tasks, phases, people] = await Promise.all([
    prisma.task.findMany({
      where: { ...taskScope(u), projectId: p.id, ...(statusWhere ? { status: statusWhere } : {}) },
      include: { assignee: { select: { name: true } }, phase: { select: { name: true } } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    prisma.projectPhase.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  const tabs = [["", "All"], ["open", "Open"], ...Object.entries(TASK_STATUS)];
  return (
    <div className="space-y-6">
      {isManager(u) && <Card>
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4"><span className="text-[15px] font-semibold">Create task</span><span className="text-xs text-river">+ New</span></summary>
          <div className="border-t border-line p-5"><TaskForm projectId={p.id} phases={phases} people={people} /></div>
        </details>
      </Card>}
      <Card>
        <CardHead title="Tasks" action={
          <div className="flex gap-1 text-xs">{tabs.map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>
        } />
        <TasksTable tasks={tasks} canManage={isManager(u)} />
      </Card>
    </div>
  );
}
