// Small server-rendered SVG charts (no client JS, no chart library).
export const CHART = { spent: "#123C36", committed: "#7EA7A1", remaining: "#D6C3A0", ink: "#18201E", grid: "#E4DFD2", muted: "#6B7572" };

export function Donut({ parts, size = 176, thickness = 24, children }: { parts: { label: string; value: number; color: string }[]; size?: number; thickness?: number; children?: React.ReactNode }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const offsets = parts.reduce<number[]>((a, p, i) => [...a, (a[i] ?? 0) + (Math.max(0, p.value) / total) * c], [0]);
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((Math.max(0, p.value) / total) * 100)}%`).join(", ")}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.grid} strokeWidth={thickness} />
        {parts.map((p, i) => { const len = (Math.max(0, p.value) / total) * c; return <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offsets[i]} />; })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Bars({ data, height = 150, color = CHART.spent, unit = "" }: { data: { label: string; value: number }[]; height?: number; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length), pad = 28;
  return (
    <svg viewBox={`0 0 ${data.length * 40} ${height + pad}`} className="h-52 w-full" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}${unit}`).join(", ")}>
      <line x1="0" x2={data.length * 40} y1={height} y2={height} stroke={CHART.grid} />
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 16);
        return (
          <g key={i}>
            <rect x={i * 40 + 8} y={height - h} width="24" height={Math.max(h, d.value ? 2 : 0)} rx="3" fill={color}><title>{`${d.label}: ${d.value}${unit}`}</title></rect>
            {d.value > 0 && <text x={i * 40 + 20} y={height - h - 4} textAnchor="middle" fontSize="9" fill={CHART.ink}>{d.value >= 1000 ? `${Math.round(d.value / 100) / 10}k` : d.value}</text>}
            <text x={i * 40 + 20} y={height + 14} textAnchor="middle" fontSize="9" fill={CHART.muted}>{d.label}</text>
          </g>
        );
      })}
      <desc>{w}</desc>
    </svg>
  );
}

export const Legend = ({ items }: { items: { label: string; color: string; value?: string }[] }) => (
  <ul className="space-y-2 text-sm">{items.map((i) => <li key={i.label} className="flex items-center gap-2.5"><span className="size-2.5 rounded-sm" style={{ background: i.color }} /><span className="flex-1 text-muted">{i.label}</span>{i.value && <span className="whitespace-nowrap font-medium tabular-nums">{i.value}</span>}</li>)}</ul>
);
