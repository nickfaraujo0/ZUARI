import { redirect } from "next/navigation";
import { getUser, homeFor } from "@/lib/auth";
import { Logo } from "@/components/ui";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  if (u) redirect(homeFor(u));
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-river-deep text-ivory lg:block">
        <svg className="absolute inset-0 size-full opacity-[.16]" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <path key={i} d={`M-50 ${520 + i * 26} C 150 ${470 + i * 22}, 320 ${610 + i * 20}, 520 ${540 + i * 24} S 800 ${470 + i * 26}, 860 ${520 + i * 24}`} fill="none" stroke="#7EA7A1" strokeWidth="1.2" />
          ))}
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-river-deep via-transparent to-river-deep/40" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo dark size={44} />
          <div>
            <h2 className="font-serif text-6xl font-medium leading-[1.02]">Build.<br />Manage.<br />Deliver.</h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ivory/70">The operating system for construction. From site activity to executive decisions, every project stays connected.</p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-ivory/50">Goa · India · Beyond structures</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo size={36} /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
