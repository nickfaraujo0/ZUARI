import { FileText } from "lucide-react";
import { addDocumentVersion, deleteDocument, updateDocument, uploadDocument } from "@/actions/documents";
import { ActionForm, ConfirmSubmit } from "./forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, Select } from "./ui";
import type { DocRow } from "@/lib/docs";
import { DOC_AUDIENCE, DOC_CATEGORY, fmtDate, opts } from "@/lib/utils";

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx";

export function UploadForm({ projects, projectId, category }: { projects: { id: string; name: string }[]; projectId?: string; category?: string }) {
  return (
    <ActionForm action={uploadDocument} reset submit="Upload" className="grid gap-3">
      <Field label="Project"><Select name="projectId" required defaultValue={projectId} placeholder="Choose…" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
      <Field label="Title"><input name="title" required className={inputCls} placeholder="Ground floor plan — Rev B" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select name="category" defaultValue={category ?? "DRAWING"} options={opts(DOC_CATEGORY)} /></Field><Field label="Visible to"><Select name="audience" defaultValue="PROJECT" options={opts(DOC_AUDIENCE)} /></Field></div>
      <Field label="Discipline (optional)"><input name="discipline" className={inputCls} placeholder="Architectural, Structural, MEP…" /></Field>
      <Field label="File" hint="PDF, image, Word, Excel or PowerPoint · up to 25 MB"><input type="file" name="file" accept={ACCEPT} required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-river file:px-3 file:py-2 file:text-sm file:font-medium file:text-ivory" /></Field>
    </ActionForm>
  );
}

export function DocumentList({ docs, canUpload, canManage, showProject = true }: { docs: DocRow[]; canUpload: boolean; canManage: boolean; showProject?: boolean }) {
  if (!docs.length) return <Card><EmptyState icon={<FileText className="size-5" />} title="No documents yet" body="Drawings, contracts, BOQs, invoices and certificates you upload appear here, with version history." /></Card>;
  return (
    <div className="space-y-3">
      {docs.map((d) => {
        const cur = d.versions[0];
        return (
          <Card key={d.id}>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-river/5 text-river"><FileText className="size-5" /></span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-semibold leading-snug">{d.title}</p>
                <p className="text-xs text-muted">{[showProject && d.project.name, d.discipline, `v${d.currentVersion}`, cur && `${cur.uploadedBy.name} · ${fmtDate(cur.createdAt)}`, cur && kb(cur.size)].filter(Boolean).join(" · ")}</p>
              </div>
              <Chip tone="sand">{DOC_CATEGORY[d.category]}</Chip>{d.audience !== "PROJECT" && <Chip tone={d.audience === "MANAGERS" ? "dark" : "teal"}>{DOC_AUDIENCE[d.audience]}</Chip>}
              {cur?.mime.startsWith("image/") && <a href={`/documents/${d.id}`} className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium hover:bg-stone-50">View &amp; pin issues</a>}
              {cur && <a href={`/api/documents/${cur.id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-river px-3.5 py-2 text-sm font-medium text-ivory hover:bg-river-soft">Open v{cur.version}</a>}
            </div>
            <details className="border-t border-line/70">
              <summary className="cursor-pointer px-5 py-2.5 text-xs font-medium text-river">Version history ({d.versions.length}){canUpload || canManage ? " · manage" : ""}</summary>
              <div className="space-y-4 px-5 pb-5">
                <ul className="divide-y divide-line/70 rounded-lg border border-line">
                  {d.versions.map((v) => <li key={v.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm"><span className="font-mono text-xs">v{v.version}</span>{v.version === d.currentVersion && <Chip tone="green">Current</Chip>}<span className="min-w-0 flex-1 basis-48 truncate">{v.filename}{v.note ? <span className="text-muted"> — {v.note}</span> : null}</span><span className="text-xs text-muted">{v.uploadedBy.name} · {fmtDate(v.createdAt)} · {kb(v.size)}</span><a href={`/api/documents/${v.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-river hover:underline">Open</a></li>)}
                </ul>
                {canUpload && (
                  <ActionForm action={addDocumentVersion} reset submit="Upload new version" size="sm" variant="secondary" className="flex flex-wrap items-end gap-3" submitClass="!mt-0">
                    <input type="hidden" name="documentId" value={d.id} />
                    <input type="file" name="file" accept={ACCEPT} required className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:font-medium" />
                    <input name="note" placeholder="What changed?" className={`${inputCls} h-9 w-56`} />
                  </ActionForm>
                )}
                {canManage && (
                  <div className="flex flex-wrap items-end gap-6 border-t border-line/70 pt-4">
                    <ActionForm action={updateDocument} submit="Save details" size="sm" variant="secondary" className="flex flex-wrap items-end gap-3" submitClass="!mt-0">
                      <input type="hidden" name="documentId" value={d.id} />
                      <Field label="Title" className="w-56"><input name="title" defaultValue={d.title} required className={`${inputCls} h-9`} /></Field>
                      <Field label="Type"><Select name="category" defaultValue={d.category} options={opts(DOC_CATEGORY)} className="h-9" /></Field>
                      <Field label="Visible to"><Select name="audience" defaultValue={d.audience} options={opts(DOC_AUDIENCE)} className="h-9" /></Field>
                    </ActionForm>
                    <ActionForm action={deleteDocument} hideSubmit><input type="hidden" name="documentId" value={d.id} /><ConfirmSubmit message={`Delete “${d.title}” and all ${d.versions.length} versions? This can't be undone.`} className="pb-2 text-xs text-red-700 hover:underline">Delete document</ConfirmSubmit></ActionForm>
                  </div>
                )}
              </div>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
export { CardHead };
