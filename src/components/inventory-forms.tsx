import { adjustCount, createTransfer, receiveStock, writeOff } from "@/actions/inventory";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { WRITE_OFF_REASONS } from "@/lib/inventory";
import { opts, startOfToday, toInputDate } from "@/lib/utils";

type Wh = { id: string; name: string }; type Item = { id: string; name: string; unit: string };
const today = () => toInputDate(startOfToday());

export function LocationSelect({ name, warehouses, projects, defaultValue, label }: { name: string; warehouses: Wh[]; projects: Wh[]; defaultValue?: string; label: string }) {
  return (
    <Field label={label}>
      <select name={name} required defaultValue={defaultValue ?? ""} className={`${inputCls} pr-8`}>
        <option value="">Choose…</option>
        {warehouses.length > 0 && <optgroup label="Warehouses">{warehouses.map((w) => <option key={w.id} value={`w:${w.id}`}>{w.name}</option>)}</optgroup>}
        {projects.length > 0 && <optgroup label="Sites">{projects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>}
      </select>
    </Field>
  );
}
const itemOpts = (items: Item[]) => items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
const DateField = () => <Field label="Date"><input name="date" type="date" required max={today()} defaultValue={today()} className={inputCls} /></Field>;

export function TransferForm(p: { warehouses: Wh[]; projects: Wh[]; items: Item[]; from?: string }) {
  return (
    <ActionForm action={createTransfer} submit="Record transfer" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><LocationSelect label="From" name="from" defaultValue={p.from} {...p} /><LocationSelect label="To" name="to" {...p} /></div>
      <div className="grid gap-3 sm:grid-cols-3"><DateField /><Field label="Vehicle (optional)"><input name="vehicle" className={inputCls} placeholder="GA-07-T-1234" /></Field><Field label="Driver (optional)"><input name="driver" className={inputCls} /></Field></div>
      <div className="space-y-2"><div className="grid grid-cols-[1fr_110px] gap-2 text-[11px] uppercase tracking-wider text-muted"><span>Item</span><span>Quantity</span></div>
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="grid grid-cols-[1fr_110px] gap-2"><Select name={`item_${i}`} placeholder="—" options={itemOpts(p.items)} /><input name={`qty_${i}`} type="number" step="any" min="0" className={inputCls} /></div>)}</div>
      <Field label="Note (optional)"><input name="note" className={inputCls} placeholder="Purpose, gate pass no., who received…" /></Field>
    </ActionForm>
  );
}
export function ReceiveForm(p: { warehouses: Wh[]; projects: Wh[]; items: Item[] }) {
  return (
    <ActionForm action={receiveStock} reset submit="Add stock" className="grid gap-3">
      <Field label="Item"><Select name="itemId" required placeholder="Choose…" options={itemOpts(p.items)} /></Field>
      <LocationSelect label="Received at" name="at" {...p} />
      <div className="grid grid-cols-2 gap-3"><Field label="Quantity"><input name="quantity" type="number" step="any" min="0" required className={inputCls} /></Field><DateField /></div>
      <Field label="Note (optional)"><input name="note" className={inputCls} placeholder="Supplier, invoice no., opening balance…" /></Field>
    </ActionForm>
  );
}
export function WriteOffForm(p: { warehouses: Wh[]; projects: Wh[]; items: Item[] }) {
  return (
    <ActionForm action={writeOff} reset submit="Write off" variant="secondary" className="grid gap-3">
      <Field label="Item"><Select name="itemId" required placeholder="Choose…" options={itemOpts(p.items)} /></Field>
      <LocationSelect label="Lost / damaged at" name="at" {...p} />
      <div className="grid grid-cols-2 gap-3"><Field label="Quantity"><input name="quantity" type="number" step="any" min="0" required className={inputCls} /></Field><Field label="Reason"><Select name="reason" defaultValue="DAMAGED" options={opts(WRITE_OFF_REASONS)} /></Field></div>
      <DateField /><Field label="Note (optional)"><input name="note" className={inputCls} /></Field>
    </ActionForm>
  );
}
export function CountForm(p: { warehouses: Wh[]; projects: Wh[]; items: Item[] }) {
  return (
    <ActionForm action={adjustCount} reset submit="Correct to counted" variant="secondary" className="grid gap-3">
      <Field label="Item"><Select name="itemId" required placeholder="Choose…" options={itemOpts(p.items)} /></Field>
      <LocationSelect label="Counted at" name="at" {...p} />
      <div className="grid grid-cols-2 gap-3"><Field label="Quantity counted"><input name="counted" type="number" step="any" min="0" required className={inputCls} /></Field><DateField /></div>
      <Field label="Note (optional)"><input name="note" className={inputCls} /></Field>
    </ActionForm>
  );
}
