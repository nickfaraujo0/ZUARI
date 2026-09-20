import { prisma } from "@/lib/db";
import { readImage } from "@/lib/storage";
import { shareHash } from "@/lib/share";

// Public, but only for photos a manager marked client-visible, through a valid (unrevoked, unexpired) link.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const share = await prisma.clientShare.findUnique({ where: { tokenHash: shareHash(token) } });
  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt < new Date())) return new Response("Not found", { status: 404 });
  const ph = await prisma.progressPhoto.findFirst({ where: { id, projectId: share.projectId, companyId: share.companyId, clientVisible: true }, select: { storageKey: true, mime: true } });
  if (!ph) return new Response("Not found", { status: 404 });
  try { return new Response(new Uint8Array(await readImage(ph.storageKey)), { headers: { "Content-Type": ph.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } }); } catch { return new Response("Not found", { status: 404 }); }
}
