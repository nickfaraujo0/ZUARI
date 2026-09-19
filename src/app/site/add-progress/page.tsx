import { requireUser } from "@/lib/auth";
import { captureOptions } from "@/lib/site";
import { CaptureForm } from "@/components/capture-form";
import { SiteHeader } from "@/components/site-ui";

export const metadata = { title: "Add Progress" };

export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string; task?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const projects = await captureOptions(u);
  return (<><SiteHeader title="Add Progress" /><CaptureForm userId={u.id} kind="progress" projects={projects} projectId={sp.project} taskId={sp.task} /></>);
}
