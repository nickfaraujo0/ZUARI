import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { docScope } from "./access";
import type { SessionUser } from "./auth";

export async function loadDocs(u: SessionUser, extra: Prisma.DocumentWhereInput = {}) {
  return prisma.document.findMany({
    where: { ...docScope(u), ...extra },
    include: { project: { select: { id: true, name: true } }, versions: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" }, take: 150,
  });
}
export type DocRow = Awaited<ReturnType<typeof loadDocs>>[number];
