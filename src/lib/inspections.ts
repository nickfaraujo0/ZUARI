import "server-only";
import { prisma } from "./db";

export const DEFAULT_TEMPLATES: { name: string; category: string; items: string[] }[] = [
  { name: "Pre-pour check", category: "Structure", items: ["Shuttering aligned, plumb and rigid", "Reinforcement as per drawing (dia, spacing, laps)", "Cover blocks in place", "Embedded conduits and sleeves fixed", "Formwork cleaned, no debris or standing water", "Concrete mix and slump approved"] },
  { name: "Brickwork / blockwork", category: "Masonry", items: ["Alignment and plumb within tolerance", "Mortar mix and joint thickness correct", "Lintels and sill bands provided", "Curing arranged", "Openings match drawings"] },
  { name: "Waterproofing", category: "Finishing", items: ["Surface prepared, cleaned and primed", "Coating layers and overlap as specified", "Turn-ups and corners treated", "Ponding test 24 h passed, no leakage"] },
  { name: "Electrical rough-in", category: "MEP", items: ["Conduit routes as per layout", "Junction boxes at correct heights", "Earthing provisions made", "Circuit labelling done", "Insulation resistance test passed"] },
  { name: "Plumbing pressure test", category: "MEP", items: ["Pipe sizes and materials as specified", "Supports and clamps fixed", "Pressure test held for the required period", "Slope of drainage lines correct", "No visible leakage at joints"] },
  { name: "PPE & site safety", category: "Safety", items: ["Helmets worn by all workers", "Safety shoes and gloves in use", "Harness used at height", "Scaffolding tagged and stable", "Edge protection and barricades in place", "First-aid kit stocked and accessible", "Fire extinguisher available and valid"] },
  { name: "Handover / punch list", category: "Handover", items: ["Paint finish and touch-ups", "Flooring and skirting free of damage", "Doors and windows operate; locks work", "Electrical points, switches and fixtures working", "Plumbing fixtures working, no leaks", "Cleaning completed", "Keys, manuals and warranties handed over"] },
];

/** Creates the standard checklists the first time a company opens Inspections. */
export async function ensureTemplates(companyId: string) {
  if (await prisma.inspectionTemplate.count({ where: { companyId } })) return;
  await prisma.inspectionTemplate.createMany({ data: DEFAULT_TEMPLATES.map((t) => ({ companyId, ...t })), skipDuplicates: true });
}

/**
 * A task that has inspections can only be verified once its latest completed inspection passed.
 * Tasks with no inspections are not gated. Returns an error message, or null when verification is allowed.
 */
export async function inspectionGate(companyId: string, taskId: string): Promise<string | null> {
  const list = await prisma.inspection.findMany({ where: { companyId, taskId }, select: { status: true, completedAt: true } });
  if (!list.length) return null;
  const done = list.filter((i) => i.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  if (!done.length) return "This task has an inspection that hasn't been completed yet. Complete it before verifying.";
  if (done[0].status !== "PASSED") return "The latest inspection for this task failed. Re-inspect and pass it before verifying.";
  if (list.some((i) => i.status === "OPEN")) return "There is an open inspection on this task. Finish it before verifying.";
  return null;
}
