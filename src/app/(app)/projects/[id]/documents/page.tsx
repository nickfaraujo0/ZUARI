import { requireUser } from "@/lib/auth";
import { requireProject } from "@/lib/access";
import { DocumentsPage } from "@/components/documents-page";

export const metadata = { title: "Documents" };

export default async function ProjectDocuments({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  return <DocumentsPage embedded u={u} title="Documents" sub="" projectId={p.id} search={await searchParams} base={`/projects/${p.id}/documents`} />;
}
