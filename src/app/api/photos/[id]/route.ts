import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/access";
import { readImage } from "@/lib/storage";

// Photos are private project evidence: served only to signed-in users who can access the project.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const photo = await prisma.progressPhoto.findFirst({ where: { id, companyId: u.companyId, project: projectScope(u) }, select: { storageKey: true, mime: true } });
  if (!photo) return new Response("Not found", { status: 404 });
  try {
    const buf = await readImage(photo.storageKey);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
