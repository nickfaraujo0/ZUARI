import { ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/access";
import { Avatar, Card, Chip, EmptyState, LinkButton, Photo } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/utils";

export const metadata = { title: "Site updates" };

export default async function SiteTab({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await requireProject(u, (await params).id);
  const reports = await prisma.siteReport.findMany({ where: { projectId: p.id, companyId: u.companyId }, include: { user: { select: { name: true } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 40 });
  if (!reports.length) return <Card><EmptyState icon={<ClipboardList className="size-5" />} title="No site updates yet" body="Supervisors submit daily updates — work done, workforce, materials — from ZUARI Site on their phone." action={<LinkButton href={`/site/site-update?project=${p.id}`} variant="secondary">Submit one now</LinkButton>} /></Card>;
  const Row = ({ label, text }: { label: string; text?: string | null }) => text ? <div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p><p className="mt-0.5 whitespace-pre-line text-sm">{text}</p></div> : null;
  return (
    <div className="space-y-4">
      {reports.map((r) => (
        <Card key={r.id} className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3"><Avatar name={r.user.name} size={32} /><div><p className="text-sm font-semibold">{r.user.name}</p><p className="text-xs text-muted">{fmtDate(r.createdAt)}, {fmtTime(r.createdAt)}</p></div>{r.workforceCount > 0 && <Chip tone="teal" className="ml-auto">{r.workforceCount} workers on site</Chip>}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Row label="Work completed" text={r.workCompleted} /><Row label="Work planned" text={r.workPlanned} /><Row label="Materials received" text={r.materialsReceived} /><Row label="Notes" text={r.notes} />
          </div>
          {r.photos.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{r.photos.map((ph) => <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noreferrer"><Photo id={ph.id} className="size-24 rounded-lg" /></a>)}</div>}
        </Card>
      ))}
    </div>
  );
}
