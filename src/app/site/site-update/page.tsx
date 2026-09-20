import { requireUser } from "@/lib/auth";
import { captureOptions } from "@/lib/site";
import { CaptureForm } from "@/components/capture-form";
import { SiteHeader } from "@/components/site-ui";
import { tFor } from "@/lib/i18n";

export const metadata = { title: "Site Update" };

export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string; task?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const projects = await captureOptions(u);
  return (<><SiteHeader title={tFor(u.locale)("Site Update")} /><CaptureForm userId={u.id} kind="update" projects={projects} projectId={sp.project} taskId={sp.task} /></>);
}
