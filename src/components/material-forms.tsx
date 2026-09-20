import { logMaterial, requestMaterial } from "@/actions/materials";
import { ActionForm } from "./forms";
import { Field, inputCls, Select } from "./ui";
import { TXN } from "@/lib/utils";

type M = { id: string; name: string; unit: string };
export function LogMaterialForm({ projectId, materials, suppliers = [], types, mobile, defaultType }: { projectId: string; materials: M[]; suppliers?: { id: string; name: string }[]; types: (keyof typeof TXN)[]; mobile?: boolean; defaultType?: keyof typeof TXN }) {
  const c = mobile ? `${inputCls} !h-12 !text-base` : inputCls;
  return (
    <ActionForm action={logMaterial} reset submit="Record" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Material"><Select name="materialId" required placeholder="Choose…" className={mobile ? "!h-12 !text-base" : ""} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="What happened"><Select name="type" defaultValue={defaultType ?? types[0]} className={mobile ? "!h-12 !text-base" : ""} options={types.map((t) => ({ value: t, label: t === "ADJUSTMENT" ? "Adjustment (±)" : TXN[t] }))} /></Field>
        <Field label="Quantity"><input name="quantity" type="number" step="any" required inputMode="decimal" className={c} /></Field>
      </div>
      {suppliers.length > 0 && <Field label="Supplier (optional)"><Select name="supplierId" placeholder="—" className={mobile ? "!h-12 !text-base" : ""} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></Field>}
      <Field label="Note (optional)"><input name="note" className={c} placeholder="Delivery challan no., where used…" /></Field>
    </ActionForm>
  );
}
export function RequestMaterialForm({ projectId, materials, mobile }: { projectId: string; materials: M[]; mobile?: boolean }) {
  const c = mobile ? `${inputCls} !h-12 !text-base` : inputCls;
  return (
    <ActionForm action={requestMaterial} reset submit="Send request" size={mobile ? "lg" : "md"} submitClass={mobile ? "w-full" : ""} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Material"><Select name="materialId" required placeholder="Choose…" className={mobile ? "!h-12 !text-base" : ""} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Quantity"><input name="quantity" type="number" step="any" min="0" required inputMode="decimal" className={c} /></Field><Field label="Needed by"><input name="neededBy" type="date" className={c} /></Field></div>
      <Field label="Note (optional)"><input name="note" className={c} placeholder="Why it is needed, urgency…" /></Field>
    </ActionForm>
  );
}
