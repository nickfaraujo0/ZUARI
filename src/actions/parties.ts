"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, obj } from "@/lib/action";
import { assertManager, UserError } from "@/lib/access";

const refresh = () => revalidatePath("/", "layout");
const base = {
  name: z.string().min(2, "Name is required").max(100),
  contactName: z.string().max(80).optional(), phone: z.string().max(30).optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || undefined),
  gstin: z.string().max(20).optional(), notes: z.string().max(1000).optional(),
};
const contractor = z.object({ ...base, trade: z.string().min(2, "Trade is required").max(60) });
const supplier = z.object({ ...base, category: z.string().max(60).optional(), address: z.string().max(200).optional() });
const active = z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true"));

export const createContractor = action(async (u, fd) => {
  assertManager(u);
  const d = contractor.parse(obj(fd));
  await prisma.contractor.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Contractor added" };
});
export const updateContractor = action(async (u, fd) => {
  assertManager(u);
  const d = contractor.extend({ id: cuid("Contractor"), active }).parse(obj(fd));
  const { id, ...rest } = d;
  const r = await prisma.contractor.updateMany({ where: { id, companyId: u.companyId }, data: { ...rest, contactName: rest.contactName ?? null, phone: rest.phone ?? null, email: rest.email ?? null, gstin: rest.gstin ?? null, notes: rest.notes ?? null } });
  if (!r.count) throw new UserError("Contractor not found.");
  refresh(); return { message: "Saved" };
});
export const createSupplier = action(async (u, fd) => {
  assertManager(u);
  const d = supplier.parse(obj(fd));
  await prisma.supplier.create({ data: { ...d, companyId: u.companyId } });
  refresh(); return { message: "Supplier added" };
});
export const updateSupplier = action(async (u, fd) => {
  assertManager(u);
  const d = supplier.extend({ id: cuid("Supplier"), active }).parse(obj(fd));
  const { id, ...rest } = d;
  const r = await prisma.supplier.updateMany({ where: { id, companyId: u.companyId }, data: { ...rest, contactName: rest.contactName ?? null, phone: rest.phone ?? null, email: rest.email ?? null, gstin: rest.gstin ?? null, notes: rest.notes ?? null, category: rest.category ?? null, address: rest.address ?? null } });
  if (!r.count) throw new UserError("Supplier not found.");
  refresh(); return { message: "Saved" };
});
