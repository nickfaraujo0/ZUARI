"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapProject = { id: string; name: string; location: string; lat: number; lng: number; progress: number; health: string; color: string };

/** Interactive project map. Tiles come from OpenStreetMap; marker colour follows project health. */
export function MapView({ projects, focus }: { projects: MapProject[]; focus?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined, cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      const pts: [number, number][] = [];
      for (const p of projects) {
        const icon = L.divIcon({ className: "", iconSize: [38, 38], iconAnchor: [19, 19], html: `<div style="width:38px;height:38px;border-radius:50%;background:${p.color};color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px Inter,system-ui,sans-serif;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">${p.progress}%</div>` });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
        const pop = document.createElement("div");
        pop.style.font = "13px Inter,system-ui,sans-serif";
        const b = document.createElement("b"); b.textContent = p.name; pop.append(b, document.createElement("br"), document.createTextNode(`${p.location} · ${p.health}`), document.createElement("br"));
        const a = document.createElement("a"); a.href = `/projects/${p.id}`; a.textContent = "Open project →"; a.style.color = "#123C36"; pop.append(a);
        m.bindPopup(pop);
        pts.push([p.lat, p.lng]);
        if (p.id === focus) m.openPopup();
      }
      if (pts.length === 1) map.setView(pts[0], 13); else map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [projects, focus]);
  return <div ref={el} className="h-[560px] w-full overflow-hidden rounded-xl border border-line" role="application" aria-label="Map of projects" />;
}
