import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { taskScope } from "@/lib/access";
import { TasksTable } from "@/components/tasks";
import { Card, CardHead, PageHeader } from "@/components/ui";
import { cn, TASK_STATUS } from "@/lib/utils";

export const metadata = { title: "Tasks" };

export default async function AllTasks({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requireUser();
  const { status } = await searchParams;
  const st = status === "open" ? { in: ["NOT_STARTED" as const, "IN_PROGRESS" as const] } : status && status in TASK_STATUS ? (status as keyof typeof TASK_STATUS) : undefined;
  const tasks = await prisma.task.findMany({
    where: { ...taskScope(u), ...(st ? { status: st } : {}) },
    include: { assignee: { select: { name: true } }, phase: { select: { name: true } }, project: { select: { name: true } } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 200,
  });
  const tabs = [["", "All"], ["open", "Open"], ...Object.entries(TASK_STATUS)];
  return (
    <>
      <PageHeader title="Tasks" sub="Across all your projects. Create tasks from inside a project." />
      <Card>
        <CardHead title={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`} action={<div className="flex gap-1 text-xs">{tabs.map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-full px-3 py-1", (status ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-stone-100")}>{l}</Link>)}</div>} />
        <TasksTable tasks={tasks} showProject />
      </Card>
    </>
  );
}
