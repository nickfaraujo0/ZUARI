import { requireUser } from "@/lib/auth";
import { DocumentsPage } from "@/components/documents-page";

export const metadata = { title: "Documents" };

export default async function Documents({ searchParams }: { searchParams: Promise<{ category?: string; project?: string }> }) {
  const u = await requireUser();
  return <DocumentsPage u={u} title="Documents" sub="Contracts, BOQs, quotations, invoices, certificates and drawings, with version control." search={await searchParams} base="/documents" />;
}
