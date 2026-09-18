import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueScope, projectScope, taskScope } from "@/lib/access";
import { Card, CardHead, Chip, PageHeader } from "@/components/ui";
import { ISSUE_STATUS, TASK_STATUS } from "@/lib/utils";

export const metadata = { title: "Search" };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const has = (f: string) => ({ [f]: { contains: q, mode: "insensitive" as const } });
  const [projects, tasks, issues] = q ? await Promise.all([
    prisma.project.findMany({ where: { ...projectScope(u), OR: [has("name"), has("client"), has("location"), has("code")] }, take: 8 }),
    prisma.task.findMany({ where: { ...taskScope(u), OR: [has("title"), has("description")] }, include: { project: { select: { name: true } } }, take: 10 }),
    prisma.issue.findMany({ where: { ...issueScope(u), OR: [has("title"), has("description"), has("area")] }, include: { project: { select: { name: true } } }, take: 10 }),
  ]) : [[], [], []];
  const none = q && !projects.length && !tasks.length && !issues.length;
  return (
    <>
      <PageHeader title="Search" sub={q ? `Results for “${q}”` : "Search projects, tasks and issues"} />
      {none && <p className="text-sm text-muted">Nothing found. Try a project name, client, or task title.</p>}
      <div className="grid max-w-3xl gap-5">
        {projects.length > 0 && <Card><CardHead title="Projects" /><ul className="divide-y divide-line/70 border-t border-line/70">{projects.map((p) => <li key={p.id}><Link href={`/projects/${p.id}`} className="flex justify-between px-5 py-3 text-sm hover:bg-stone-50"><span className="font-medium">{p.name}</span><span className="text-muted">{p.location}</span></Link></li>)}</ul></Card>}
        {tasks.length > 0 && <Card><CardHead title="Tasks" /><ul className="divide-y divide-line/70 border-t border-line/70">{tasks.map((t) => <li key={t.id}><Link href={`/projects/${t.projectId}/tasks/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-stone-50"><span><span className="font-medium">{t.title}</span><span className="block text-xs text-muted">{t.project.name}</span></span><Chip>{TASK_STATUS[t.status]}</Chip></Link></li>)}</ul></Card>}
        {issues.length > 0 && <Card><CardHead title="Issues" /><ul className="divide-y divide-line/70 border-t border-line/70">{issues.map((i) => <li key={i.id}><Link href={`/projects/${i.projectId}/issues`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-stone-50"><span><span className="font-medium">{i.title}</span><span className="block text-xs text-muted">{i.project.name}</span></span><Chip>{ISSUE_STATUS[i.status]}</Chip></Link></li>)}</ul></Card>}
      </div>
    </>
  );
}
