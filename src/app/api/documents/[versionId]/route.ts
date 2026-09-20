import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { docScope } from "@/lib/access";
import { readImage } from "@/lib/storage";

const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

// Documents are private: signed-in users who may see the document's project *and* its audience level.
export async function GET(_req: Request, ctx: { params: Promise<{ versionId: string }> }) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const v = await prisma.documentVersion.findFirst({ where: { id: (await ctx.params).versionId, companyId: u.companyId, document: docScope(u) }, select: { storageKey: true, mime: true, filename: true } });
  if (!v) return new Response("Not found", { status: 404 });
  try {
    const buf = await readImage(v.storageKey);
    return new Response(new Uint8Array(buf), { headers: {
      "Content-Type": v.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `${INLINE.has(v.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(v.filename)}`,
    } });
  } catch { return new Response("Not found", { status: 404 }); }
}
