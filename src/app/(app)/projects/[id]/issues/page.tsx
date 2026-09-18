import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueScope, requireProject } from "@/lib/access";
import { IssuesList } from "@/components/issues";
import { cn } from "@/lib/utils";

export const metadata = { title: "Issues" };
const OPEN = ["OPEN", "ASSIGNED", "IN_PROGRESS"] as const;

export default async function ProjectIssues({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const show = (await searchParams).show === "closed" ? "closed" : (await searchParams).show === "all" ? "all" : "open";
  const [issues, people] = await Promise.all([
    prisma.issue.findMany({
      where: { ...issueScope(u), projectId: p.id, ...(show === "open" ? { status: { in: [...OPEN] } } : show === "closed" ? { status: { in: ["RESOLVED", "CLOSED"] } } : {}) },
      include: { reporter: { select: { name: true } }, assignee: { select: { name: true } }, task: { select: { title: true } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="mb-4 flex gap-1 text-sm">{[["open", "Open"], ["closed", "Resolved"], ["all", "All"]].map(([k, l]) => <Link key={k} href={`?show=${k}`} className={cn("rounded-full px-3.5 py-1.5", show === k ? "bg-river text-ivory" : "text-muted hover:bg-white")}>{l}</Link>)}</div>
      <IssuesList issues={issues} people={people} />
    </>
  );
}
