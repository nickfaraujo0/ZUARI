import Link from "next/link";
import { FolderKanban, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { portfolio } from "@/lib/queries";
import { formatINR, TYPE_LABEL } from "@/lib/utils";
import { HealthChip } from "@/components/blocks";
import { Avatar, Card, EmptyState, LinkButton, PageHeader, Photo, Progress } from "@/components/ui";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const u = await requireUser();
  const projects = await portfolio(u);
  return (
    <>
      <PageHeader title="Projects" sub={`${projects.length} project${projects.length === 1 ? "" : "s"} ${u.role === "DIRECTOR" ? "across your company" : "assigned to you"}`} actions={u.role === "DIRECTOR" ? <LinkButton href="/projects/new">New project</LinkButton> : undefined} />
      {projects.length === 0 ? (
        <Card><EmptyState icon={<FolderKanban className="size-5" />} title="No projects yet" body={u.role === "DIRECTOR" ? "Create a project to plan phases, assign tasks and follow progress from site." : "A director will add you to a project."} action={u.role === "DIRECTOR" ? <LinkButton href="/projects/new">Create your first project</LinkButton> : undefined} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group overflow-hidden rounded-xl border border-line bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative h-44 bg-gradient-to-br from-river to-river-soft">
                {p.cover && <Photo id={p.cover} className="h-44 w-full transition duration-500 group-hover:scale-[1.03]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-river-deep/80 via-transparent to-transparent" />
                <div className="absolute left-4 top-4"><HealthChip health={p.health} /></div>
                <div className="absolute inset-x-4 bottom-3 text-ivory"><p className="font-mono text-[11px] text-ivory/70">{p.code}</p><h2 className="font-serif text-2xl font-semibold leading-tight">{p.name}</h2></div>
              </div>
              <div className="space-y-3 p-4">
                <p className="flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5" />{p.location} · {TYPE_LABEL[p.type]}</p>
                <div className="flex items-center gap-3"><Progress value={p.progress} /><span className="text-sm font-semibold tabular-nums">{p.progress}%</span></div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-2">{p.manager && <Avatar name={p.manager.name} size={22} />}{p.manager?.name ?? "No manager"}</span>
                  <span>{formatINR(p.budget)}{p.openIssues ? ` · ${p.openIssues} open issue${p.openIssues === 1 ? "" : "s"}` : ""}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
