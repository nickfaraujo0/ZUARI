"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, obj } from "@/lib/action";
import { assertDirector, UserError } from "@/lib/access";

export const updateCompany = action(async (u, fd) => {
  assertDirector(u);
  const d = z.object({
    name: z.string().min(2, "Company name is required").max(80), address: z.string().max(200).optional(), gstin: z.string().max(20).optional(), phone: z.string().max(30).optional(),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || undefined),
  }).parse(obj(fd));
  await prisma.company.update({ where: { id: u.companyId }, data: { name: d.name, address: d.address ?? null, gstin: d.gstin ?? null, phone: d.phone ?? null, email: d.email ?? null } });
  revalidatePath("/", "layout"); return { message: "Company profile saved" };
});

export const updatePhaseTemplate = action(async (u, fd) => {
  assertDirector(u);
  const lines = String(fd.get("phases") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 1 || lines.length > 12) throw new UserError("Enter between 1 and 12 phases, one per line.");
  if (lines.some((l) => l.length > 40)) throw new UserError("Phase names must be 40 characters or fewer.");
  if (new Set(lines.map((l) => l.toLowerCase())).size !== lines.length) throw new UserError("Phase names must be unique.");
  await prisma.company.update({ where: { id: u.companyId }, data: { phaseTemplate: lines } });
  revalidatePath("/", "layout"); return { message: "New projects will start with these phases" };
});

export const updateAutomation = action(async (u, fd) => {
  assertDirector(u);
  const d = z.object({ escalateIssueHours: z.coerce.number().int().min(1).max(72), escalateTaskDays: z.coerce.number().int().min(1).max(30), tallyBankLedger: z.string().min(2, "Enter the bank ledger name").max(80) }).parse(obj(fd));
  await prisma.company.update({ where: { id: u.companyId }, data: d });
  revalidatePath("/", "layout"); return { message: "Saved" };
});
