import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { taskScope } from "@/lib/access";
import { SiteHeader, TaskCard } from "@/components/site-ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tasks" };

export default async function SiteTasks({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const show = (await searchParams).show === "done" ? "done" : "active";
  const tasks = await prisma.task.findMany({
    where: { ...taskScope(u), status: { in: show === "done" ? ["COMPLETED", "VERIFIED"] : ["NOT_STARTED", "IN_PROGRESS"] } },
    include: { project: { select: { name: true } } }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 100,
  });
  return (
    <>
      <SiteHeader title="Tasks" />
      <div className="flex gap-2 px-5 pt-4">{[["active", "Active"], ["done", "Completed"]].map(([k, l]) => <Link key={k} href={`?show=${k}`} className={cn("flex-1 rounded-xl py-2.5 text-center text-sm font-medium", show === k ? "bg-river text-ivory" : "bg-white text-muted ring-1 ring-line")}>{l}</Link>)}</div>
      <div className="space-y-3 p-5">
        {tasks.map((t) => <TaskCard key={t.id} t={t} showProject />)}
        {!tasks.length && <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">{show === "done" ? "Nothing completed yet." : "No active tasks. Enjoy the calm."}</p>}
      </div>
    </>
  );
}
