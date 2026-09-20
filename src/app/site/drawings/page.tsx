import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadDocs } from "@/lib/docs";
import { SiteHeader } from "@/components/site-ui";
import { Chip } from "@/components/ui";
import { DOC_CATEGORY, fmtShort } from "@/lib/utils";

export const metadata = { title: "Drawings" };

export default async function SiteDrawings() {
  const u = await requireUser();
  const docs = (await loadDocs(u)).sort((a, b) => Number(b.category === "DRAWING") - Number(a.category === "DRAWING"));
  return (
    <>
      <SiteHeader title="Drawings & documents" back="/site/more" />
      <div className="space-y-3 p-5">
        {!docs.length && <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Nothing has been shared with you yet.</p>}
        {docs.map((d) => (
          <a key={d.id} href={d.versions[0].mime.startsWith("image/") ? `/site/drawings/${d.id}` : `/api/documents/${d.versions[0].id}`} target={d.versions[0].mime.startsWith("image/") ? undefined : "_blank"} rel="noreferrer" className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card active:scale-[.99]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-river text-ivory"><FileText className="size-6" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{d.title}</span><span className="block text-sm text-muted">{d.project.name} · v{d.currentVersion} · {fmtShort(d.versions[0].createdAt)}</span></span>
            <Chip tone="sand">{DOC_CATEGORY[d.category]}</Chip>
          </a>
        ))}
      </div>
    </>
  );
}
