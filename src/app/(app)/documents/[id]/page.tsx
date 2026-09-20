import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { docScope, issueScope } from "@/lib/access";
import { PinViewer } from "@/components/pin-viewer";
import { Card, CardHead, Chip, PageHeader } from "@/components/ui";
import { ISSUE_STATUS, ISSUE_TONE, SEVERITY, DOC_CATEGORY } from "@/lib/utils";

export const metadata = { title: "Drawing" };

export default async function DrawingPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const doc = await prisma.document.findFirst({ where: { id: (await params).id, ...docScope(u) }, include: { project: { select: { name: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!doc) notFound();
  const v = doc.versions[0], image = v?.mime.startsWith("image/");
  const issues = await prisma.issue.findMany({ where: { ...issueScope(u), documentId: doc.id }, orderBy: { createdAt: "asc" } });
  const pins = issues.filter((i) => i.pinX != null && i.docVersion === doc.currentVersion);
  const older = issues.length - pins.length;
  return (
    <>
      <PageHeader title={doc.title} sub={`${doc.project.name} · ${DOC_CATEGORY[doc.category]} · v${doc.currentVersion}`} actions={<><Link href={`/projects/${doc.projectId}/documents`} className="text-sm text-river hover:underline">← Documents</Link><a href={`/api/documents/${v.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">Open file</a></>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {image ? <PinViewer documentId={doc.id} src={`/api/documents/${v.id}`} canPin={u.role !== "ACCOUNTANT"} issuesHref={`/projects/${doc.projectId}/issues`} pins={pins.map((i) => ({ id: i.id, x: i.pinX!, y: i.pinY!, title: i.title, severity: i.severity, status: i.status }))} />
          : <Card className="p-6 text-sm text-muted">Pinning works on image drawings (PNG, JPG, WebP). This file is a {v?.mime.split("/")[1]?.toUpperCase()} — open it, or upload an image export of the drawing as a new version.</Card>}
        <Card><CardHead title={`Pinned issues (${issues.length})`} sub={older ? `${older} pinned on earlier versions` : undefined} />
          <ul className="divide-y divide-line/70 border-t border-line/70">{issues.map((i, n) => <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-river text-[11px] font-bold text-ivory">{i.pinX != null && i.docVersion === doc.currentVersion ? pins.indexOf(i) + 1 : n + 1}</span><span className="min-w-0 flex-1 truncate">{i.title}<span className="block text-xs text-muted">{SEVERITY[i.severity]}{i.docVersion !== doc.currentVersion ? ` · v${i.docVersion}` : ""}</span></span><Chip tone={ISSUE_TONE[i.status]}>{ISSUE_STATUS[i.status]}</Chip></li>)}{!issues.length && <li className="px-5 py-6 text-sm text-muted">No pins yet.</li>}</ul></Card>
      </div>
    </>
  );
}
