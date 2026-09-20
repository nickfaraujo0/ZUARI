import { rm } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, type Priority, type Role, type TaskStatus } from "@prisma/client";
import { scene } from "./scene";
import { storeImage } from "../src/lib/storage";
import { logActivity, notify, recomputeProgress } from "../src/lib/services";
import { seedPhase2 } from "./seed-phase2";
import { phoneKey } from "../src/lib/phone";
import { seedPhase3, DEMO_SHARE_TOKEN } from "./seed-phase3";
import { seedInventory } from "./seed-inventory";

const prisma = new PrismaClient();
const PASSWORD = "zuari-demo-2026";
const DAY = 864e5, IST = 5.5 * 3600e3;
const today = new Date(Math.floor((Date.now() + IST) / DAY) * DAY - IST);
const day = (n: number) => new Date(today.getTime() + n * DAY);
const at = (daysAgo: number, h: number, m = 0) => new Date(Math.min(today.getTime() - daysAgo * DAY + (h * 60 + m) * 60000, Date.now() - 90_000));

const PEOPLE: Record<string, { name: string; role: Role; title: string; phone: string; contractor?: string }> = {
  nick: { name: "Nick Araujo", role: "DIRECTOR", title: "Director", phone: "+91 98220 10001" },
  priya: { name: "Priya Naik", role: "PROJECT_MANAGER", title: "Senior Project Manager", phone: "+91 98220 10002" },
  rohan: { name: "Rohan Desai", role: "PROJECT_MANAGER", title: "Project Manager", phone: "+91 98220 10003" },
  carlos: { name: "Carlos Fernandes", role: "SITE_SUPERVISOR", title: "Site Supervisor", phone: "+91 98220 10004" },
  anita: { name: "Anita D'Souza", role: "SITE_SUPERVISOR", title: "Site Engineer", phone: "+91 98220 10005" },
  joao: { name: "João Pereira", role: "SITE_SUPERVISOR", title: "Site Supervisor", phone: "+91 98220 10006" },
  maria: { name: "Maria Gomes", role: "ACCOUNTANT", title: "Accounts Manager", phone: "+91 98220 10007" },
  vikram: { name: "Vikram Shetty", role: "SITE_ENGINEER", title: "Site Engineer", phone: "+91 98220 10008" },
  suresh: { name: "Suresh Fernandes", role: "CONTRACTOR", title: "Electrical Contractor", phone: "+91 98220 10009", contractor: "Fernandes Electricals" },
};
const email = (k: string) => `${PEOPLE[k].name.toLowerCase().normalize("NFD").replace(/[̀-ͯ']/g, "").replace(/\s+/g, ".")}@coastalindia.demo`;

// [title, progress, assignee, due (days from today, null = phase end), priority]
type T = [string, number, string | null, number | null, Priority?];
type Ph = [name: string, startOffset: number, endOffset: number, tasks: T[]];
type Photo = [daysAgo: number, h: number, m: number, task: string, scene: number, count: number, by: string, note: string | null];
type Issue = { title: string; area: string; description: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED"; by: string; to?: string; daysAgo: number; h: number; due?: number; scene: number };
type Report = [daysAgo: number, by: string, workers: number, done: string, planned: string, materials: string, notes: string | null];

const PROJECTS: { name: string; client: string; location: string; type: "RESIDENTIAL" | "COMMERCIAL"; budget: number; start: number; end: number; manager: string; team: string[]; description: string; phases: Ph[]; photos: Photo[]; issues: Issue[]; reports: Report[] }[] = [
  {
    name: "Dona Paula Villa", client: "Mr. & Mrs. Kamat", location: "Dona Paula, Goa", type: "RESIDENTIAL", budget: 32_000_000, start: -300, end: 75, manager: "priya", team: ["carlos", "joao", "vikram", "suresh"],
    description: "Three-bedroom sea-facing villa with laterite cladding, deep verandahs and a courtyard plunge pool.",
    phases: [
      ["Foundation", -300, -240, [["Excavation and PCC", 100, "joao", null], ["Footing reinforcement and casting", 100, "joao", null], ["Plinth beam and backfilling", 100, "joao", null]]],
      ["Structure", -240, -150, [["Ground floor columns and slab", 100, "joao", null], ["First floor columns and slab", 100, "joao", null], ["Terrace slab and parapet", 100, "joao", null], ["Staircase casting", 100, "joao", null]]],
      ["Masonry", -150, -75, [["Ground floor brickwork", 100, "joao", null], ["First floor brickwork", 100, "carlos", null], ["Internal plastering", 100, "carlos", null]]],
      ["Electrical", -90, 10, [["Conduit laying — ground floor", 100, "carlos", null], ["Conduit laying — first floor", 100, "carlos", null], ["Electrical Installation", 50, "carlos", 0, "HIGH"], ["DB and main panel installation", 38, "suresh", 3]]],
      ["Plumbing", -60, 20, [["Water supply lines", 100, "carlos", null], ["Drainage and soil pipes", 100, "carlos", null], ["Bathroom Waterproofing", 0, "carlos", 1, "HIGH"], ["Sanitary fixtures", 40, "carlos", 5]]],
      ["Finishing", -20, 75, [["Wall putty and primer", 80, "carlos", 6], ["Flooring — vitrified tiles", 64, "carlos", 9], ["Carpentry and joinery", 0, null, 30], ["External painting", 0, null, 55]]],
    ],
    photos: [
      [230, 11, 0, "Footing reinforcement and casting", 0, 3, "joao", "Footing steel checked before the pour."], [180, 10, 30, "Ground floor columns and slab", 1, 3, "joao", null],
      [130, 9, 50, "First floor columns and slab", 1, 2, "joao", "First floor slab cast, curing started."], [95, 15, 10, "Ground floor brickwork", 2, 3, "joao", null],
      [60, 11, 20, "First floor brickwork", 2, 2, "carlos", "Brickwork complete up to lintel level."], [14, 10, 40, "Conduit laying — ground floor", 3, 3, "carlos", "GF conduits complete and tested."],
      [9, 16, 0, "Water supply lines", 4, 2, "carlos", null], [5, 9, 30, "Wall putty and primer", 5, 2, "carlos", "First coat done in living room."],
      [2, 11, 10, "Conduit laying — first floor", 3, 3, "carlos", null], [1, 15, 45, "Drainage and soil pipes", 4, 2, "carlos", "Pressure test passed."],
      [0, 10, 42, "Electrical Installation", 3, 3, "carlos", "Conduits fixed in first-floor bedrooms; DB location marked."],
    ],
    issues: [
      { title: "Water leakage — Floor 2", area: "Master bathroom", description: "Damp patch on the ceiling below the master bathroom slab.", severity: "MEDIUM", status: "ASSIGNED", by: "carlos", to: "priya", daysAgo: 0, h: 9, due: 3, scene: 4 },
      { title: "Skirting tile delivery short by 40 sq ft", area: "Ground floor", description: "Supplier delivered fewer boxes than ordered.", severity: "LOW", status: "RESOLVED", by: "carlos", to: "priya", daysAgo: 8, h: 12, scene: 5 },
    ],
    reports: [[1, "carlos", 42, "Drainage pressure test; conduit fixing in first-floor bedrooms.", "DB installation; bathroom waterproofing prep.", "PVC conduit 300 m, junction boxes 60.", null], [2, "carlos", 38, "Wall putty first coat — living and dining.", "Conduit fixing first floor.", "Putty 20 bags.", "Light rain after 3 pm."], [3, "carlos", 44, "Floor tile layout; plumbing rough-in checks.", "Drainage pressure test.", "Vitrified tiles 60 boxes.", null]],
  },
  {
    name: "Candolim Residence", client: "The Almeida Family", location: "Candolim, Goa", type: "RESIDENTIAL", budget: 58_000_000, start: -220, end: 160, manager: "priya", team: ["anita", "joao", "vikram"],
    description: "Contemporary two-storey residence, 300 m from the beach, with a rooftop terrace.",
    phases: [
      ["Foundation", -220, -170, [["Site clearing and excavation", 100, "anita", null], ["Raft foundation", 100, "anita", null], ["Retaining wall", 100, "anita", null]]],
      ["Structure", -170, -100, [["Ground floor slab", 100, "anita", null], ["First floor slab", 100, "anita", null], ["Roof slab", 100, "anita", null]]],
      ["Masonry", -110, -10, [["Ground floor brickwork", 100, "anita", null], ["First floor brickwork", 100, "anita", null], ["Boundary wall", 60, "anita", -2, "HIGH"], ["Internal partition walls", 28, "joao", -4, "URGENT"]]],
      ["Electrical", -40, 40, [["Conduit laying", 80, "anita", 4], ["Wiring — ground floor", 40, "anita", 10], ["Wiring — first floor", 0, "anita", 22]]],
      ["Plumbing", -10, 70, [["Water supply lines", 36, "joao", 12], ["Drainage", 0, "joao", 25], ["Sanitary rough-in", 0, "joao", 40]]],
      ["Finishing", 30, 160, [["Plastering", 0, null, 80], ["Flooring", 0, null, 130]]],
    ],
    photos: [[180, 10, 0, "Raft foundation", 0, 3, "anita", null], [130, 11, 30, "Ground floor slab", 1, 2, "anita", null], [80, 9, 40, "First floor slab", 1, 3, "anita", "Slab cast, 7-day curing plan agreed."], [45, 14, 0, "Ground floor brickwork", 2, 2, "anita", null], [10, 10, 15, "First floor brickwork", 2, 3, "anita", null], [4, 12, 0, "Conduit laying", 3, 2, "anita", null], [1, 16, 20, "Water supply lines", 4, 2, "joao", null], [0, 9, 20, "Wiring — ground floor", 3, 2, "anita", "Started wiring the living room circuits."]],
    issues: [
      { title: "Cracks in boundary wall — east side", area: "East boundary", description: "Hairline vertical cracks near the corner column, roughly 2 m long.", severity: "HIGH", status: "OPEN", by: "anita", daysAgo: 1, h: 10, due: 2, scene: 2 },
      { title: "Delay in switchgear delivery", area: "Store room", description: "Supplier now quoting an extra week.", severity: "LOW", status: "IN_PROGRESS", by: "anita", to: "priya", daysAgo: 4, h: 15, due: 6, scene: 3 },
    ],
    reports: [[1, "anita", 27, "Boundary wall courses; conduit tracing GF.", "Crack assessment; wiring GF.", "Cement 120 bags, sand 8 t.", null], [3, "anita", 31, "Partition walls upto sill level.", "Boundary wall lintel.", "Bricks 4,000.", "Two workers absent."]],
  },
  {
    name: "Panaji Commercial Centre", client: "Mandovi Retail LLP", location: "Panaji, Goa", type: "COMMERCIAL", budget: 94_000_000, start: -150, end: 330, manager: "rohan", team: ["joao"],
    description: "Basement plus four-storey retail and office building on the Altinho road.",
    phases: [
      ["Foundation", -150, -80, [["Piling", 100, "joao", null], ["Pile cap and raft", 100, "joao", null], ["Basement retaining walls", 100, "joao", null]]],
      ["Structure", -90, 10, [["Basement slab", 100, "joao", null], ["Ground floor columns", 100, "joao", null], ["Ground floor slab", 80, "joao", 2, "HIGH"], ["First floor columns", 20, "joao", -3, "URGENT"], ["First floor slab", 0, "joao", 20]]],
      ["Masonry", -30, 60, [["Basement block work", 60, "joao", -5, "HIGH"], ["Ground floor block work", 40, "joao", 12], ["First floor block work", 0, null, 35], ["Facade blockwork", 0, null, 55]]],
      ["Electrical", 20, 120, [["Basement conduit", 21, "joao", -1, "MEDIUM"], ["Ground floor conduit", 0, "joao", 30], ["Main LT panel procurement", 0, null, 45]]],
      ["Plumbing", 60, 180, [["Fire fighting risers", 0, null, 80], ["Sewage treatment plant", 0, null, 120]]],
      ["Finishing", 150, 330, [["Facade cladding", 0, null, 250], ["Interior fit-out", 0, null, 320]]],
    ],
    photos: [[120, 9, 0, "Piling", 0, 3, "joao", "Pile load test witnessed by consultant."], [85, 11, 0, "Pile cap and raft", 0, 2, "joao", null], [40, 10, 30, "Basement slab", 1, 3, "joao", null], [12, 15, 0, "Ground floor columns", 1, 2, "joao", null], [3, 10, 10, "Ground floor slab", 1, 3, "joao", "Shuttering and rebar inspected, pour tomorrow."], [1, 14, 30, "Basement block work", 2, 2, "joao", null], [0, 8, 50, "Basement conduit", 3, 1, "joao", null]],
    issues: [
      { title: "Waterlogging near material storage", area: "North side", description: "Rain water pooling around cement store; bags at risk.", severity: "HIGH", status: "IN_PROGRESS", by: "joao", to: "rohan", daysAgo: 2, h: 11, due: 1, scene: 1 },
      { title: "Rebar spacing deviation — GF columns C4, C5", area: "Grid C", description: "Stirrup spacing measured wider than drawing; needs engineer review before further casting.", severity: "CRITICAL", status: "OPEN", by: "joao", daysAgo: 0, h: 8, due: 1, scene: 1 },
    ],
    reports: [[1, "joao", 56, "Ground floor slab shuttering; basement block work.", "GF slab reinforcement; pour.", "Steel 2.4 t, cement 300 bags.", "Waterlogging in yard after rain."], [2, "joao", 61, "Column casting, grid B–D.", "Slab shuttering.", "RMC 24 m³.", null]],
  },
];

async function main() {
  const old = await prisma.company.findMany({ where: { name: { in: ["Coastal India Constructions", "Konkan Builders"] } }, select: { id: true } });
  for (const c of old) { await prisma.company.delete({ where: { id: c.id } }); await rm(path.resolve(process.env.UPLOAD_DIR ?? "./uploads", c.id), { recursive: true, force: true }); }

  const hash = await bcrypt.hash(PASSWORD, 11);
  const co = await prisma.company.create({ data: { name: "Coastal India Constructions" } });
  const CON: Record<string, string> = {};
  for (const [name, trade, contact] of [["Fernandes Electricals", "Electrical", "Suresh Fernandes"], ["Goa Plumbing Works", "Plumbing", "Anthony Rodrigues"], ["Konkan Civil Contractors", "Civil & masonry", "Pandurang Naik"], ["Sahyadri Interiors", "Finishing & carpentry", "Meghna Kamat"]] as const)
    CON[name] = (await prisma.contractor.create({ data: { companyId: co.id, name, trade, contactName: contact, phone: "+91 98905 " + String(20000 + Object.keys(CON).length * 111), email: `${trade.split(" ")[0].toLowerCase()}@contractor.demo`, gstin: `30CONTR${1000 + Object.keys(CON).length}F1Z1` } })).id;
  const U: Record<string, string> = {};
  for (const [k, p] of Object.entries(PEOPLE)) U[k] = (await prisma.user.create({ data: { companyId: co.id, email: email(k), name: p.name, role: p.role, title: p.title, phone: p.phone, phoneKey: phoneKey(p.phone), contractorId: p.contractor ? CON[p.contractor] : null, passwordHash: hash } })).id;
  const nm = (k: string) => PEOPLE[k].name;
  let n = 0;

  for (const [pi, def] of PROJECTS.entries()) {
    const project = await prisma.project.create({
      data: { companyId: co.id, code: `ZU-${String(pi + 1).padStart(4, "0")}`, name: def.name, client: def.client, location: def.location, type: def.type, budget: def.budget, startDate: day(def.start), expectedEnd: day(def.end), managerId: U[def.manager], description: def.description,
        members: { create: [def.manager, ...def.team].map((k) => ({ companyId: co.id, userId: U[k] })) } },
    });
    const taskIds = new Map<string, string>();
    for (const [i, [name, s, e, tasks]] of def.phases.entries()) {
      const phase = await prisma.projectPhase.create({ data: { companyId: co.id, projectId: project.id, name, position: i, startDate: day(s), endDate: day(e) } });
      for (const [title, prog, who, due, prio] of tasks) {
        const status: TaskStatus = prog === 100 ? (i <= 1 ? "VERIFIED" : "COMPLETED") : prog === 0 ? "NOT_STARTED" : "IN_PROGRESS";
        const dueDate = day(due ?? e);
        const t = await prisma.task.create({ data: { companyId: co.id, projectId: project.id, phaseId: phase.id, title, assigneeId: who ? U[who] : null, createdById: U[def.manager], priority: prio ?? "MEDIUM", status, progress: prog, startDate: day(due != null ? due - 14 : s), dueDate, completedAt: prog === 100 ? new Date(dueDate.getTime() - 2 * DAY) : null, createdAt: day(s - 5) } });
        taskIds.set(title, t.id);
      }
    }
    await logActivity({ companyId: co.id, projectId: project.id, actorId: U.nick, type: "PROJECT_CREATED", message: `${nm("nick")} created the project`, detail: def.name, createdAt: day(def.start - 3) });

    for (const [da, h, m, task, sc, count, by, note] of def.photos) {
      const when = at(da, h, m);
      const stored = [];
      for (let k = 0; k < count; k++) stored.push(await storeImage(await scene(sc, ++n), co.id, project.id));
      const taskId = taskIds.get(task)!;
      await prisma.progressUpdate.create({ data: { companyId: co.id, projectId: project.id, taskId, userId: U[by], note, createdAt: when, photos: { create: stored.map((s, k) => ({ companyId: co.id, projectId: project.id, taskId, userId: U[by], storageKey: s.key, mime: s.mime, size: s.size, takenAt: new Date(when.getTime() + k * 60000) })) } } });
      await logActivity({ companyId: co.id, projectId: project.id, actorId: U[by], type: "PHOTOS", message: `${nm(by)} uploaded ${count} progress photo${count > 1 ? "s" : ""}`, detail: task, createdAt: when });
    }
    for (const r of def.issues) {
      const when = at(r.daysAgo, r.h, 5), s = await storeImage(await scene(r.scene, ++n), co.id, project.id);
      await prisma.issue.create({ data: { companyId: co.id, projectId: project.id, title: r.title, area: r.area, description: r.description, severity: r.severity, status: r.status, reporterId: U[r.by], assigneeId: r.to ? U[r.to] : null, dueDate: r.due != null ? day(r.due) : null, resolvedAt: r.status === "RESOLVED" ? new Date(when.getTime() + DAY) : null, createdAt: when, photos: { create: [{ companyId: co.id, projectId: project.id, userId: U[r.by], storageKey: s.key, mime: s.mime, size: s.size, takenAt: when }] } } });
      await logActivity({ companyId: co.id, projectId: project.id, actorId: U[r.by], type: "ISSUE", message: "New issue reported", detail: `${r.title} — ${r.area}`, createdAt: when });
      if (r.status !== "RESOLVED" && r.daysAgo <= 2) await notify(co.id, [U[def.manager], U.nick], { type: "ISSUE_REPORTED", title: r.severity === "CRITICAL" || r.severity === "HIGH" ? "Urgent issue reported" : "Issue reported", body: `${r.title} — ${def.name}`, href: `/projects/${project.id}/issues` });
    }
    for (const [da, by, workers, done, planned, materials, notes] of def.reports) {
      const when = at(da, 17, 30);
      await prisma.siteReport.create({ data: { companyId: co.id, projectId: project.id, userId: U[by], date: when, createdAt: when, workforceCount: workers, workCompleted: done, workPlanned: planned, materialsReceived: materials, notes } });
      await logActivity({ companyId: co.id, projectId: project.id, actorId: U[by], type: "SITE_UPDATE", message: `${nm(by)} submitted a site update`, detail: `${workers} workers on site`, createdAt: when });
    }
    await recomputeProgress(project.id);
    console.log(`  ✓ ${def.name}`);
  }

  // A few recent, human-scale events for the activity feed and notifications.
  const dona = await prisma.project.findFirstOrThrow({ where: { companyId: co.id, name: "Dona Paula Villa" } });
  await logActivity({ companyId: co.id, projectId: dona.id, actorId: U.carlos, type: "TASK_STATUS", message: "Electrical Installation marked In Progress", detail: `by ${nm("carlos")}`, createdAt: at(0, 10, 18) });
  await logActivity({ companyId: co.id, projectId: dona.id, actorId: U.priya, type: "TASK_ASSIGNED", message: `Bathroom Waterproofing assigned to ${nm("carlos")}`, detail: dona.name, createdAt: at(1, 16, 5) });
  const bw = await prisma.task.findFirstOrThrow({ where: { projectId: dona.id, title: "Bathroom Waterproofing" } });
  await notify(co.id, [U.carlos], { type: "TASK_ASSIGNED", title: "New task assigned", body: "Bathroom Waterproofing", href: `/site/tasks/${bw.id}` });
  await notify(co.id, [U.priya, U.nick], { type: "PROGRESS", title: "Progress submitted", body: `${nm("carlos")} · Electrical Installation`, href: `/projects/${dona.id}/photos` });

  await seedPhase2({ prisma, co: co.id, U, day, at, IST });
  await seedPhase3({ prisma, co: co.id, U, day, at });
  await seedInventory({ prisma, co: co.id, U, day, at });

  // Second tenant — proves isolation.
  const kb = await prisma.company.create({ data: { name: "Konkan Builders" } });
  const meera = await prisma.user.create({ data: { companyId: kb.id, email: "meera.kamat@konkanbuilders.demo", name: "Meera Kamat", role: "DIRECTOR", title: "Director", passwordHash: hash } });
  const ponda = await prisma.project.create({ data: { companyId: kb.id, code: "ZU-0001", name: "Ponda Warehouse", client: "Sahyadri Logistics", location: "Ponda, Goa", type: "COMMERCIAL", budget: 21_000_000, startDate: day(-90), expectedEnd: day(120), managerId: meera.id, members: { create: [{ companyId: kb.id, userId: meera.id }] }, phases: { create: [{ companyId: kb.id, name: "Structure", position: 0, startDate: day(-90), endDate: day(30), progress: 40 }] } } });
  await recomputeProgress(ponda.id);

  const ps = await prisma.project.findMany({ where: { companyId: co.id }, select: { name: true, progress: true } });
  console.log("\nProgress:", ps.map((p) => `${p.name} ${p.progress}%`).join(" · "));
  console.log(`\nDemo sign-ins (password: ${PASSWORD})\n  Director   ${email("nick")}\n  Manager    ${email("priya")}\n  Supervisor ${email("carlos")}   → opens ZUARI Site (/site)\n  Accountant ${email("maria")}   → finance only\n  Engineer   ${email("vikram")}   → ZUARI Site, sees all work\n  Contractor ${email("suresh")}   → ZUARI Site, own tasks only\n  Other co.  meera.kamat@konkanbuilders.demo\n  Client link http://localhost:3100/share/${DEMO_SHARE_TOKEN}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
