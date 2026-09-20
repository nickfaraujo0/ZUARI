import { Images } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isManager, requireProject } from "@/lib/access";
import { GroupedGallery } from "@/components/blocks";
import { PhotoFilters, ViewToggle } from "@/components/photo-filters";
import { Card, EmptyState } from "@/components/ui";
import { parseDate } from "@/lib/utils";

export const metadata = { title: "Photos" };

export default async function PhotosTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const sp = await searchParams;
  const view = sp.view === "journal" ? "journal" : "gallery";
  const day = parseDate(sp.date);
  const where: Prisma.ProgressPhotoWhereInput = {
    projectId: p.id, companyId: u.companyId,
    ...(sp.task ? { taskId: sp.task } : {}), ...(sp.user ? { userId: sp.user } : {}),
    ...(sp.block ? { block: { contains: sp.block, mode: "insensitive" as const } } : {}), ...(sp.floor ? { floor: { contains: sp.floor, mode: "insensitive" as const } } : {}),
    ...(day ? { takenAt: { gte: day, lt: new Date(day.getTime() + 864e5) } } : {}),
  };
  const [photos, tasks, users] = await Promise.all([
    prisma.progressPhoto.findMany({ where, include: { task: { select: { title: true, phase: { select: { name: true } } } }, user: { select: { name: true } } }, orderBy: { takenAt: view === "journal" ? "asc" : "desc" }, take: 300 }),
    prisma.task.findMany({ where: { projectId: p.id, photos: { some: {} } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { companyId: u.companyId, photos: { some: { projectId: p.id } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{view === "journal" ? "A chronological record — watch the project being built." : "Every photo is evidence, tied to a task, a person and a time."}</p>
        <ViewToggle view={view} base={`/projects/${p.id}/photos`} />
      </div>
      <PhotoFilters view={view} tasks={tasks} users={users} values={sp} />
      {photos.length === 0 ? <Card><EmptyState icon={<Images className="size-5" />} title="No photos found" body="Progress photos captured in ZUARI Site appear here, grouped by date and activity." /></Card> : <GroupedGallery photos={photos} shareToggle={isManager(u)} groupBy={view === "journal" ? "phase" : "task"} />}
    </>
  );
}
