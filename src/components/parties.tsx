import { createContractor, createSupplier, updateContractor, updateSupplier } from "@/actions/parties";
import { ActionForm } from "./forms";
import { Card, CardHead, Chip, EmptyState, Field, inputCls, Select } from "./ui";
import { Building2 } from "lucide-react";

export type Party = { id: string; name: string; trade?: string | null; category?: string | null; contactName: string | null; phone: string | null; email: string | null; gstin: string | null; address?: string | null; notes: string | null; active: boolean; counts: string };
const statusOpts = [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

export function PartyForm({ kind, item }: { kind: "contractor" | "supplier"; item?: Party }) {
  const isC = kind === "contractor";
  const act = item ? (isC ? updateContractor : updateSupplier) : isC ? createContractor : createSupplier;
  return (
    <ActionForm action={act} reset={!item} submit={item ? "Save" : `Add ${kind}`} size={item ? "sm" : "md"} variant={item ? "secondary" : "primary"} className="grid gap-3 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Company name" className="sm:col-span-2"><input name="name" required defaultValue={item?.name} className={inputCls} /></Field>
      {isC ? <Field label="Trade"><input name="trade" required defaultValue={item?.trade ?? ""} className={inputCls} placeholder="Electrical, Plumbing…" /></Field> : <Field label="Category"><input name="category" defaultValue={item?.category ?? ""} className={inputCls} placeholder="Cement, Steel, Tiles…" /></Field>}
      <Field label="Contact person"><input name="contactName" defaultValue={item?.contactName ?? ""} className={inputCls} /></Field>
      <Field label="Phone"><input name="phone" defaultValue={item?.phone ?? ""} className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={item?.email ?? ""} className={inputCls} /></Field>
      <Field label="GSTIN"><input name="gstin" defaultValue={item?.gstin ?? ""} className={inputCls} /></Field>
      {!isC && <Field label="Address"><input name="address" defaultValue={item?.address ?? ""} className={inputCls} /></Field>}
      {item && <Field label="Status"><Select name="active" defaultValue={String(item.active)} options={statusOpts} /></Field>}
      <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} className={`${inputCls} h-auto py-2`} /></Field>
    </ActionForm>
  );
}

export function PartyTable({ kind, items, canEdit }: { kind: "contractor" | "supplier"; items: Party[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHead title={kind === "contractor" ? "Contractors" : "Suppliers"} sub={`${items.filter((i) => i.active).length} active`} />
      {!items.length ? <EmptyState icon={<Building2 className="size-5" />} title={`No ${kind}s yet`} body={canEdit ? `Add your first ${kind} using the form.` : undefined} /> : (
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {items.map((i) => (
            <li key={i.id} className={`px-5 py-3.5 ${i.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{i.name}</p><p className="text-xs text-muted">{[i.trade ?? i.category, i.contactName, i.phone, i.email].filter(Boolean).join(" · ") || "No contact details"}</p></div>
                {i.gstin && <span className="font-mono text-[11px] text-muted">{i.gstin}</span>}
                <Chip tone={i.active ? "green" : "grey"}>{i.active ? "Active" : "Inactive"}</Chip><span className="text-xs text-muted">{i.counts}</span>
              </div>
              {canEdit && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-river">Edit</summary><div className="mt-3 rounded-lg border border-line bg-stone-50 p-4"><PartyForm kind={kind} item={i} /></div></details>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
