import Link from "next/link";
import { prisma } from "@/lib/db";
import { canUploadDocs, isManager, projectScope } from "@/lib/access";
import { loadDocs } from "@/lib/docs";
import type { SessionUser } from "@/lib/auth";
import { DocumentList, UploadForm } from "./documents";
import { Card, PageHeader } from "./ui";
import { cn, DOC_CATEGORY } from "@/lib/utils";

/** Shared by /documents, /drawings and a project's Documents tab. */
export async function DocumentsPage({ u, title, sub, fixedCategory, projectId, search, base, embedded }: { u: SessionUser; title: string; sub: string; fixedCategory?: keyof typeof DOC_CATEGORY; projectId?: string; search: { category?: string; project?: string }; base: string; embedded?: boolean }) {
  const category = fixedCategory ?? (search.category && search.category in DOC_CATEGORY ? (search.category as keyof typeof DOC_CATEGORY) : undefined);
  const filterProject = projectId ?? search.project;
  const [docs, projects] = await Promise.all([
    loadDocs(u, { ...(category ? { category } : {}), ...(filterProject ? { projectId: filterProject } : {}) }),
    prisma.project.findMany({ where: projectScope(u), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const upload = canUploadDocs(u);
  return (
    <>
      {!embedded && <PageHeader title={title} sub={sub} />}
      {!fixedCategory && <div className="mb-4 flex flex-wrap gap-1 text-sm">{[["", "All"], ...Object.entries(DOC_CATEGORY)].map(([k, l]) => <Link key={k} href={`${base}${k ? `?category=${k}` : ""}`} className={cn("rounded-full px-3.5 py-1.5", (category ?? "") === k ? "bg-river text-ivory" : "text-muted hover:bg-white")}>{l}</Link>)}</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DocumentList docs={docs} canUpload={upload} canManage={isManager(u)} showProject={!projectId} />
        {upload && <Card className="h-fit p-5"><h2 className="mb-4 text-[15px] font-semibold">Upload a document</h2><UploadForm projects={projects} projectId={projectId ?? search.project} category={category} /></Card>}
      </div>
    </>
  );
}
