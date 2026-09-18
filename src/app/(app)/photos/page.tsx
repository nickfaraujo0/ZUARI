import { Images } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { GroupedGallery } from "@/components/blocks";
import { PhotoFilters } from "@/components/photo-filters";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { parseDate } from "@/lib/utils";

export const metadata = { title: "Progress photos" };

export default async function AllPhotos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const day = parseDate(sp.date);
  const where: Prisma.ProgressPhotoWhereInput = {
    companyId: u.companyId, project: projectScope(u),
    ...(sp.project ? { projectId: sp.project } : {}), ...(sp.user ? { userId: sp.user } : {}), ...(day ? { takenAt: { gte: day, lt: new Date(day.getTime() + 864e5) } } : {}),
  };
  const [photos, projects, users] = await Promise.all([
    prisma.progressPhoto.findMany({ where, include: { task: { select: { title: true, phase: { select: { name: true } } } }, user: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { takenAt: "desc" }, take: 200 }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { companyId: u.companyId, photos: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Progress photos" sub="Evidence captured on site, across all projects." />
      <PhotoFilters view="gallery" projects={projects} users={users} values={sp} />
      {photos.length === 0 ? <Card><EmptyState icon={<Images className="size-5" />} title="No photos found" body="Try clearing the filters." /></Card> : <GroupedGallery photos={photos} showProject />}
    </>
  );
}
