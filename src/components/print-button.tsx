"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-lg bg-river px-4 py-2 text-sm font-medium text-ivory print:hidden">Print / save as PDF</button>;
}
