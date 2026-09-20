import { requireUser } from "@/lib/auth";
import { DocumentsPage } from "@/components/documents-page";

export const metadata = { title: "Drawings" };

export default async function Drawings({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await requireUser();
  return <DocumentsPage u={u} title="Drawings" sub="Architectural, structural and services drawings. The latest version is always the current one." fixedCategory="DRAWING" search={await searchParams} base="/drawings" />;
}
