import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { docScope, issueScope } from "@/lib/access";
import { PinViewer } from "@/components/pin-viewer";
import { SiteHeader } from "@/components/site-ui";

export const metadata = { title: "Drawing" };

export default async function SiteDrawing({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const doc = await prisma.document.findFirst({ where: { id: (await params).id, ...docScope(u) }, include: { project: { select: { name: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!doc) notFound();
  const v = doc.versions[0];
  const pins = (await prisma.issue.findMany({ where: { ...issueScope(u), documentId: doc.id, docVersion: doc.currentVersion, pinX: { not: null } }, orderBy: { createdAt: "asc" } }));
  return (
    <>
      <SiteHeader title={doc.title} back="/site/drawings" />
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted">{doc.project.name} · v{doc.currentVersion}</p>
        {v.mime.startsWith("image/") ? <PinViewer mobile documentId={doc.id} src={`/api/documents/${v.id}`} canPin={u.role !== "ACCOUNTANT"} issuesHref="/site/tasks" pins={pins.map((i) => ({ id: i.id, x: i.pinX!, y: i.pinY!, title: i.title, severity: i.severity, status: i.status }))} />
          : <a href={`/api/documents/${v.id}`} target="_blank" rel="noreferrer" className="block rounded-2xl bg-river p-4 text-center font-semibold text-ivory">Open {v.mime.split("/")[1]?.toUpperCase()}</a>}
      </div>
    </>
  );
}
