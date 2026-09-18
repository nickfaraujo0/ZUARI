import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, taskScope } from "@/lib/access";
import { DeleteTask, TaskForm } from "@/components/tasks";
import { Avatar, Card, CardHead, Chip, Photo } from "@/components/ui";
import { fmtDate, fmtTime, TASK_STATUS, TASK_TONE } from "@/lib/utils";

export const metadata = { title: "Edit task" };

export default async function EditTask({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const u = await requireUser();
  const { id, taskId } = await params;
  const p = await requireProject(u, id);
  const task = await prisma.task.findFirst({ where: { id: taskId, ...taskScope(u), projectId: p.id } });
  if (!task) notFound();
  const [phases, people, updates] = await Promise.all([
    prisma.projectPhase.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { companyId: u.companyId, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.progressUpdate.findMany({ where: { taskId: task.id, companyId: u.companyId }, include: { user: { select: { name: true } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <CardHead title="Edit task" action={<Link href={`/projects/${p.id}/tasks`} className="text-xs text-river hover:underline">← All tasks</Link>} />
        <div className="border-t border-line p-5"><TaskForm projectId={p.id} phases={phases} people={people} task={task} /><div className="mt-6 border-t border-line pt-4"><DeleteTask taskId={task.id} /></div></div>
      </Card>
      <Card>
        <CardHead title="Site evidence" sub={`${updates.length} update${updates.length === 1 ? "" : "s"} from site`} />
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {updates.map((up) => (
            <li key={up.id} className="space-y-2 px-5 py-4">
              <div className="flex items-center gap-2 text-sm"><Avatar name={up.user.name} size={24} /><span className="font-medium">{up.user.name}</span><span className="text-xs text-muted">{fmtDate(up.createdAt)}, {fmtTime(up.createdAt)}</span></div>
              {up.statusAfter && up.statusAfter !== up.statusBefore && <Chip tone={TASK_TONE[up.statusAfter]}>{TASK_STATUS[up.statusAfter]}{up.progress != null ? ` · ${up.progress}%` : ""}</Chip>}
              {up.note && <p className="text-sm text-charcoal/80">{up.note}</p>}
              {up.photos.length > 0 && <div className="flex flex-wrap gap-2">{up.photos.map((ph) => <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noreferrer"><Photo id={ph.id} className="size-20 rounded-md" /></a>)}</div>}
            </li>
          ))}
          {!updates.length && <li className="px-5 py-8 text-sm text-muted">No site updates on this task yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
