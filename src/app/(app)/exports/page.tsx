import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isFinance, isManager } from "@/lib/access";
import { importCsv } from "@/actions/imports";
import { ActionForm } from "@/components/forms";
import { Card, CardHead, Field, inputCls, PageHeader, Select } from "@/components/ui";
import { addDays, startOfToday, toInputDate } from "@/lib/utils";

export const metadata = { title: "Export & import" };
const CSV = [["tasks", "Tasks", "m"], ["issues", "Issues", "m"], ["attendance", "Attendance (last 30 days)", "m"], ["stock", "Stock by project", "m"], ["workers", "Workers", "m"], ["contractors", "Contractors", "b"], ["suppliers", "Suppliers", "b"], ["bills", "Contractor bills", "b"], ["expenses", "Expenses", "f"]] as const;

export default async function Exports() {
  const u = await requireUser();
  if (!isManager(u) && !isFinance(u)) notFound();
  const mgr = isManager(u), fin = isFinance(u), today = startOfToday();
  const list = CSV.filter(([, , who]) => (who === "m" ? mgr : who === "f" ? fin : true));
  return (
    <>
      <PageHeader title="Export & import" sub="Take your data to Excel or Tally, or bring your existing lists in." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Download (Excel-compatible CSV)" />
          <ul className="grid gap-2 border-t border-line p-5 sm:grid-cols-2">{list.map(([k, l]) => <li key={k}><a href={`/api/export/${k}`} className="flex items-center gap-2.5 rounded-lg border border-line px-3.5 py-2.5 text-sm hover:bg-stone-50"><Download className="size-4 text-river" />{l}</a></li>)}</ul>
        </Card>
        {fin && (
          <Card className="p-5">
            <h2 className="mb-1 text-[15px] font-semibold">Tally payment vouchers</h2>
            <p className="mb-4 text-xs text-muted">Paid expenses as Payment vouchers (party debited, bank credited). Ledgers must already exist in Tally, and the bank ledger name comes from Settings. Import a small batch first to check your setup.</p>
            <form action="/api/export/tally" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="From"><input type="date" name="from" defaultValue={toInputDate(addDays(today, -30))} className={inputCls} /></Field><Field label="To"><input type="date" name="to" defaultValue={toInputDate(today)} className={inputCls} /></Field>
              <button className="h-10 rounded-lg bg-river px-5 text-sm font-medium text-ivory">Download XML</button>
            </form>
          </Card>
        )}
        {mgr && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-1 text-[15px] font-semibold">Import from CSV</h2>
            <p className="mb-4 text-xs text-muted">Existing names are skipped, never overwritten. Up to 500 rows. Download a template to see the columns: {["workers", "materials", "suppliers", "contractors"].map((k, i) => <span key={k}>{i ? " · " : ""}<a href={`/api/export/template-${k}`} className="text-river underline">{k}</a></span>)}.</p>
            <ActionForm action={importCsv} reset submit="Import" className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end" submitClass="!mt-0">
              <Field label="What are you importing?"><Select name="kind" options={[{ value: "workers", label: "Workers" }, { value: "materials", label: "Materials" }, { value: "suppliers", label: "Suppliers" }, { value: "contractors", label: "Contractors" }]} /></Field>
              <Field label="CSV file"><input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:font-medium" /></Field>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
