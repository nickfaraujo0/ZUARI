"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj } from "@/lib/action";
import { assertManager, assertProject, UserError } from "@/lib/access";
import { appUrl } from "@/lib/mail";
import { shareHash } from "@/lib/share";

/** Creates a no-login, read-only link for the client. The token is shown once and only its hash is stored. */
export const createShare = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ projectId: cuid("Project"), label: z.string().max(60).optional(), days: z.coerce.number().int().min(1).max(365).optional() }).parse(obj(fd));
  const p = await assertProject(u, d.projectId);
  const token = randomBytes(32).toString("base64url");
  await prisma.clientShare.create({ data: { companyId: u.companyId, projectId: p.id, tokenHash: shareHash(token), label: d.label, expiresAt: d.days ? new Date(Date.now() + d.days * 864e5) : null, createdById: u.id } });
  revalidatePath("/", "layout");
  return { message: `Client link (copy it now, it won't be shown again): ${appUrl()}/share/${token}` };
});
export const revokeShare = action(async (u, fd) => {
  assertManager(u);
  const r = await prisma.clientShare.updateMany({ where: { id: z.object({ id: cuid("Link") }).parse(obj(fd)).id, companyId: u.companyId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) throw new UserError("Link not found.");
  revalidatePath("/", "layout");
});
/** Only photos a manager explicitly marks are visible on the client page. */
export const toggleClientVisible = action(async (u, fd) => {
  assertManager(u);
  const { photoId } = z.object({ photoId: cuid("Photo") }).parse(obj(fd));
  const ph = await prisma.progressPhoto.findFirst({ where: { id: photoId, companyId: u.companyId } });
  if (!ph) throw new UserError("Photo not found.");
  await assertProject(u, ph.projectId);
  await prisma.progressPhoto.update({ where: { id: ph.id }, data: { clientVisible: !ph.clientVisible } });
  revalidatePath("/", "layout");
});
