import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { portfolio } from "@/lib/queries";
import { MapView } from "@/components/map-view";
import { HealthChip } from "@/components/blocks";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Map" };
const COLOR = { ON_TRACK: "#2f8f5b", AT_RISK: "#d99a1c", DELAYED: "#c0392b", DONE: "#3F6868", PAUSED: "#8a8f8d" } as const;

export default async function MapPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const u = await requireUser();
  const projects = await portfolio(u);
  const placed = projects.filter((p) => p.latitude != null && p.longitude != null);
  return (
    <>
      <PageHeader title="Map" sub="Where your projects are, coloured by health." />
      {!placed.length ? (
        <Card><EmptyState icon={<MapPin className="size-5" />} title="No project locations yet" body="Add latitude and longitude when you edit a project (in Google Maps, right-click the site and copy the coordinates)." action={<Link href="/projects" className="text-sm font-medium text-river underline">Go to projects</Link>} /></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MapView focus={(await searchParams).focus} projects={placed.map((p) => ({ id: p.id, name: p.name, location: p.location, lat: p.latitude!, lng: p.longitude!, progress: p.progress, health: p.health.replace("_", " ").toLowerCase(), color: COLOR[p.health] }))} />
          <Card><ul className="divide-y divide-line/70">{projects.map((p) => (
            <li key={p.id}><Link href={p.latitude != null ? `/map?focus=${p.id}` : `/projects/${p.id}/edit`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-xs text-muted">{p.latitude != null ? p.location : "No coordinates — add them"}</span></span><HealthChip health={p.health} /></Link></li>))}</ul></Card>
        </div>
      )}
    </>
  );
}
