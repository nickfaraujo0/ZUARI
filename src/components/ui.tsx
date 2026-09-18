import Link from "next/link";
import { cn, initials, type Tone } from "@/lib/utils";

export function Logo({ dark = false, size = 28, wordmark = true, className }: { dark?: boolean; size?: number; wordmark?: boolean; className?: string }) {
  const c = dark ? "#F5F2EA" : "#123C36";
  return (
    <span className={cn("inline-flex items-center gap-3", className)} style={{ color: c }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <path d="M10 10h44v6L27 44h27v6H10v-6l27-28H10z" fill="currentColor" />
        <path d="M16 46 46 16" stroke="#7EA7A1" strokeWidth="4.5" opacity=".9" />
      </svg>
      {wordmark && <span className="font-medium tracking-[0.38em] text-[1.05em]" style={{ fontSize: size * 0.62 }}>ZUARI</span>}
    </span>
  );
}

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("rounded-xl border border-line bg-white shadow-card", className)}>{children}</div>
);
export const CardHead = ({ title, action, sub }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
    <div><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>{sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}</div>
    {action}
  </div>
);
export const Eyebrow = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("text-[11px] font-medium uppercase tracking-[0.16em] text-muted", className)}>{children}</p>
);

const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  teal: "bg-teal/10 text-teal ring-teal/25",
  grey: "bg-stone-100 text-stone-600 ring-stone-200",
  sand: "bg-sand-soft text-[#7a6236] ring-sand",
  dark: "bg-river text-ivory ring-river",
};
const DOT: Record<Tone, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", teal: "bg-teal", grey: "bg-stone-400", sand: "bg-sand", dark: "bg-mist" };
export const Chip = ({ tone = "grey", children, dot, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
    {dot && <span className={cn("size-1.5 rounded-full", DOT[tone])} />}
    {children}
  </span>
);

export function Progress({ value, className, tone = "river", thin }: { value: number; className?: string; tone?: "river" | "teal" | "amber"; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={cn("w-full overflow-hidden rounded-full bg-stone-200/70", thin ? "h-1.5" : "h-2", className)}>
      <div className={cn("h-full rounded-full", tone === "river" ? "bg-river" : tone === "teal" ? "bg-teal" : "bg-amber-500")} style={{ width: `${v}%` }} />
    </div>
  );
}

export const Avatar = ({ name, size = 32, dark }: { name: string; size?: number; dark?: boolean }) => (
  <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium", dark ? "bg-ivory text-river" : "bg-river text-ivory")} style={{ width: size, height: size, fontSize: size * 0.38 }} title={name}>
    {initials(name)}
  </span>
);

const BTN = {
  primary: "bg-river text-ivory hover:bg-river-soft disabled:opacity-60",
  secondary: "bg-white text-charcoal border border-line hover:bg-stone-50",
  ghost: "text-river hover:bg-river/5",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  sand: "bg-sand text-river-deep hover:brightness-95",
};
export const btn = (v: keyof typeof BTN = "primary", size: "sm" | "md" | "lg" = "md") =>
  cn("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[.98] disabled:cursor-not-allowed", BTN[v], size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-14 px-6 text-base rounded-xl" : "h-10 px-4 text-sm");
export const LinkButton = ({ href, variant, size, className, children }: { href: string; variant?: keyof typeof BTN; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode }) => (
  <Link href={href} className={cn(btn(variant, size), className)}>{children}</Link>
);

export const inputCls = "w-full rounded-lg border border-line bg-white px-3 h-10 text-sm outline-none transition placeholder:text-stone-400 focus:border-river focus:ring-2 focus:ring-river/15 disabled:bg-stone-50";
export const Field = ({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("block", className)}>
    <span className="mb-1.5 block text-xs font-medium text-charcoal/80">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
);
export const Select = ({ name, options, defaultValue, placeholder, className, required, ...rest }: { name: string; options: { value: string; label: string }[]; defaultValue?: string | null; placeholder?: string; className?: string; required?: boolean } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "defaultValue" | "name">) => (
  <select name={name} defaultValue={defaultValue ?? ""} required={required} className={cn(inputCls, "pr-8", className)} {...rest}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

export const EmptyState = ({ title, body, action, icon }: { title: string; body?: string; action?: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-river/5 text-river">{icon}</div>
    <p className="font-medium">{title}</p>
    {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const PageHeader = ({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="font-serif text-4xl font-semibold leading-tight text-river-deep">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const Stat = ({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "red" | "amber" }) => (
  <Card className="p-4">
    <Eyebrow>{label}</Eyebrow>
    <p className={cn("mt-2 text-[28px] font-semibold leading-none tracking-tight", tone === "red" && "text-red-700", tone === "amber" && "text-amber-700")}>{value}</p>
    {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
  </Card>
);

export const Photo = ({ id, className, alt = "Site photo" }: { id: string; className?: string; alt?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`/api/photos/${id}`} alt={alt} loading="lazy" decoding="async" className={cn("bg-stone-200 object-cover", className)} />
);
