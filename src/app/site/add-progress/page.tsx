import { requireUser } from "@/lib/auth";
import { captureOptions, locationSuggestions } from "@/lib/site";
import { CaptureForm } from "@/components/capture-form";
import { SiteHeader } from "@/components/site-ui";
import { tFor } from "@/lib/i18n";

export const metadata = { title: "Add Progress" };

export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string; task?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const projects = await captureOptions(u);
  return (<><SiteHeader title={tFor(u.locale)("Add Progress")} /><CaptureForm suggest={await locationSuggestions(u)} userId={u.id} kind="progress" projects={projects} projectId={sp.project} taskId={sp.task} /></>);
}
