import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueScope } from "@/lib/access";
import { IssuesList } from "@/components/issues";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Issues" };

export default async function AllIssues({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const s = (await searchParams).show;
  const show = s === "closed" || s === "all" ? s : "open";
  const [issues, people] = await Promise.all([
    prisma.issue.findMany({
      where: { ...issueScope(u), ...(show === "open" ? { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } : show === "closed" ? { status: { in: ["RESOLVED", "CLOSED"] } } : {}) },
      include: { reporter: { select: { name: true } }, assignee: { select: { name: true } }, task: { select: { title: true } }, photos: { select: { id: true } }, project: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100,
    }),
    prisma.user.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Issues" sub="Snags and problems reported from site, across all projects." />
      <div className="mb-4 flex gap-1 text-sm">{[["open", "Open"], ["closed", "Resolved"], ["all", "All"]].map(([k, l]) => <Link key={k} href={`?show=${k}`} className={cn("rounded-full px-3.5 py-1.5", show === k ? "bg-river text-ivory" : "text-muted hover:bg-white")}>{l}</Link>)}</div>
      <IssuesList issues={issues} people={people} showProject />
    </>
  );
}
