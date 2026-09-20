// Demo data for the Phase-2 modules: workforce, materials, procurement, finance, documents, map, locations.
import type { PrismaClient, ExpenseCategory, ExpenseStatus, PoStatus } from "@prisma/client";
import { plan } from "./scene";
import { storeDocument } from "../src/lib/storage";
import { logActivity } from "../src/lib/services";

type Ctx = { prisma: PrismaClient; co: string; U: Record<string, string>; day: (n: number) => Date; at: (daysAgo: number, h: number, m?: number) => Date; IST: number };

const rand = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const L = (lakhs: number) => Math.round(lakhs * 100000);

function pdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const content = [`BT /F1 20 Tf 60 780 Td (${esc(lines[0])}) Tj ET`, ...lines.slice(1).map((l, i) => `BT /F1 11 Tf 60 ${740 - i * 20} Td (${esc(l)}) Tj ET`)].join("\n");
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

export async function seedPhase2({ prisma, co, U, day, at, IST }: Ctx) {
  const P = Object.fromEntries((await prisma.project.findMany({ where: { companyId: co } })).map((p) => [p.name, p]));
  const DONA = "Dona Paula Villa", CAND = "Candolim Residence", PAN = "Panaji Commercial Centre";
  const mgr: Record<string, string> = { [DONA]: U.priya, [CAND]: U.priya, [PAN]: U.rohan };
  const CON = Object.fromEntries((await prisma.contractor.findMany({ where: { companyId: co } })).map((c) => [c.name, c.id]));

  // ── Company profile & map coordinates ──
  await prisma.company.update({ where: { id: co }, data: { address: "12, Patto Plaza, Panaji, Goa 403001", gstin: "30AAECC1234F1Z5", phone: "+91 832 222 0101", email: "office@coastalindia.demo" } });
  for (const [n, lat, lng] of [[DONA, 15.4527, 73.809], [CAND, 15.5187, 73.7623], [PAN, 15.4989, 73.8278]] as const) await prisma.project.update({ where: { id: P[n].id }, data: { latitude: lat, longitude: lng } });

  // ── Suppliers, materials ──
  const S: Record<string, string> = {};
  let g = 0;
  for (const [k, name, cat, contact, phone] of [["cement", "Mandovi Cement Depot", "Cement", "Anil Prabhu", "+91 98230 44101"], ["steel", "Sagar Steel Traders", "Steel", "Mohan Sagar", "+91 98230 44102"], ["tiles", "Ponda Tiles & Sanitaryware", "Tiles, sanitary", "Rita Faleiro", "+91 98230 44103"], ["agg", "Bicholim Aggregates", "Sand & aggregates", "Kashinath Sawant", "+91 98230 44104"], ["elec", "Panaji Electricals Supply", "Electrical", "Jyoti Kakodkar", "+91 98230 44105"]] as const)
    S[k] = (await prisma.supplier.create({ data: { companyId: co, name, category: cat, contactName: contact, phone, email: `${k}@supplier.demo`, gstin: `30ABCDE${1000 + ++g}F1Z${g}`, address: "Goa" } })).id;
  const M: Record<string, string> = {};
  for (const [k, name, unit, cat, reorder] of [["cement", "Cement OPC 53", "bags", "Cement", 100], ["steel", "TMT steel Fe500", "t", "Steel", 2], ["sand", "River sand", "m³", "Aggregates", 10], ["agg", "Aggregate 20 mm", "m³", "Aggregates", 10], ["brick", "Red laterite bricks", "nos", "Masonry", 2000], ["tile", "Vitrified tiles 2×2", "boxes", "Finishing", 30], ["conduit", "PVC conduit 25 mm", "m", "Electrical", 200], ["wire", "Copper wire 2.5 sq mm", "coils", "Electrical", 5], ["cpvc", "CPVC pipe 1 in", "m", "Plumbing", 100], ["putty", "Wall putty", "bags", "Finishing", 20], ["paint", "Emulsion paint", "litres", "Finishing", 40], ["wproof", "Waterproofing compound", "kg", "Plumbing", 50]] as const)
    M[k] = (await prisma.material.create({ data: { companyId: co, name, unit, category: cat, reorderLevel: reorder } })).id;

  // ── Workers & attendance ──
  const workers: [string, string, number, string | null, string][] = [
    ["Ramesh Gaonkar", "Mason", 900, null, DONA], ["Sunil Naik", "Mason", 900, null, DONA], ["Prakash Velip", "Helper", 600, null, DONA], ["Anil Kamat", "Helper", 600, null, DONA],
    ["Deepak Shirodkar", "Electrician", 1000, "Fernandes Electricals", DONA], ["Manoj Salgaonkar", "Plumber", 950, "Goa Plumbing Works", DONA], ["Rajesh Fal Desai", "Carpenter", 1000, "Sahyadri Interiors", DONA], ["Vinod Borkar", "Painter", 850, "Sahyadri Interiors", DONA],
    ["Santosh Parab", "Mason", 900, "Konkan Civil Contractors", CAND], ["Ganesh Mandrekar", "Helper", 600, "Konkan Civil Contractors", CAND], ["Lucas Fernandes", "Bar bender", 850, null, CAND], ["Ashok Gawas", "Electrician", 1000, "Fernandes Electricals", CAND], ["Ismail Shaikh", "Helper", 600, null, CAND],
    ["Dattaram Kerkar", "Mason", 900, "Konkan Civil Contractors", PAN], ["Yogesh Lotlikar", "Mason", 900, null, PAN], ["Nilesh Chodankar", "Bar bender", 850, null, PAN], ["Ravi Kumar", "Helper", 600, null, PAN], ["Salim Khan", "Helper", 600, null, PAN], ["Bhaskar Sawant", "Machine operator", 1100, null, PAN], ["Mahesh Raut", "Helper", 600, null, PAN],
  ];
  const r = rand(11);
  for (const [name, trade, rate, con, home] of workers) {
    const w = await prisma.worker.create({ data: { companyId: co, name, trade, dailyRate: rate, contractorId: con ? CON[con] : null, phone: "+91 97650 " + String(10000 + Math.floor(r() * 89999)) } });
    for (let i = 0; i < 14; i++) {
      const d = day(-i);
      if (new Date(d.getTime() + IST).getUTCDay() === 0) continue; // Sundays off
      const x = r(), status = x < 0.82 ? "PRESENT" : x < 0.92 ? "HALF" : "ABSENT";
      await prisma.attendance.create({ data: { companyId: co, projectId: P[home].id, workerId: w.id, date: d, status, overtimeHours: status === "PRESENT" && r() < 0.2 ? 2 : 0, markedById: home === PAN ? U.joao : home === CAND ? U.anita : U.carlos } });
    }
  }

  // ── Purchase orders (+ stock received for delivered ones) ──
  let poN = 0;
  const po = async (project: string, sup: string, status: PoStatus, daysAgo: number, expect: number | null, lines: [string | null, string, number, string, number][], notes?: string) => {
    const p = P[project], number = `PO-${new Date().getFullYear()}-${String(++poN).padStart(4, "0")}`;
    const done = status === "DELIVERED";
    const o = await prisma.purchaseOrder.create({ data: { companyId: co, projectId: p.id, supplierId: S[sup], number, status, orderDate: at(daysAgo, 11), expectedDate: expect != null ? day(expect) : null, notes, createdById: mgr[project], approvedById: status === "DRAFT" ? null : U.nick, deliveredAt: done ? at(Math.max(0, daysAgo - 3), 15) : null, createdAt: at(daysAgo, 11), lines: { create: lines.map(([mk, description, quantity, unit, rate]) => ({ companyId: co, materialId: mk ? M[mk] : null, description, quantity, unit, rate })) } }, include: { lines: true } });
    if (done) for (const l of o.lines) if (l.materialId) await prisma.materialTxn.create({ data: { companyId: co, projectId: p.id, materialId: l.materialId, type: "RECEIVED", quantity: l.quantity, supplierId: S[sup], poId: o.id, userId: mgr[project], note: number, createdAt: at(Math.max(0, daysAgo - 3), 15) } });
    await logActivity({ companyId: co, projectId: p.id, actorId: mgr[project], type: "PROCUREMENT", message: `${number} ${done ? "delivered — stock updated" : status === "DRAFT" ? "raised" : status.toLowerCase()}`, detail: project, createdAt: at(daysAgo, 11) });
    return o;
  };
  const po1 = await po(DONA, "elec", "DELIVERED", 15, null, [["conduit", "PVC conduit 25 mm", 600, "m", 38], ["wire", "Copper wire 2.5 sq mm", 12, "coils", 2100]]);
  await po(DONA, "tiles", "ORDERED", 6, 4, [["tile", "Vitrified tiles 2×2", 220, "boxes", 720]], "Deliver to ground floor store");
  const po3 = await po(CAND, "cement", "DELIVERED", 22, null, [["cement", "Cement OPC 53", 300, "bags", 390]]);
  await po(CAND, "steel", "DRAFT", 1, 12, [["steel", "TMT steel Fe500", 6, "t", 62000]], "Awaiting director approval");
  const po5 = await po(PAN, "steel", "ORDERED", 5, 3, [["steel", "TMT steel Fe500", 4, "t", 62000]]);
  await po(PAN, "agg", "APPROVED", 2, 6, [["agg", "Aggregate 20 mm", 60, "m³", 1450], ["sand", "River sand", 30, "m³", 1800]]);

  // ── Other stock movements (received without PO, and consumption) ──
  const tx = (project: string, mk: string, type: "RECEIVED" | "CONSUMED", quantity: number, daysAgo: number, by: string, note?: string) =>
    prisma.materialTxn.create({ data: { companyId: co, projectId: P[project].id, materialId: M[mk], type, quantity, userId: U[by], note, createdAt: at(daysAgo, 12) } });
  await tx(DONA, "conduit", "CONSUMED", 380, 9, "carlos", "GF + FF conduits"); await tx(DONA, "wire", "CONSUMED", 7, 5, "carlos");
  await tx(DONA, "tile", "RECEIVED", 150, 20, "carlos", "Challan 4471"); await tx(DONA, "tile", "CONSUMED", 128, 8, "carlos", "Ground floor");
  await tx(DONA, "putty", "RECEIVED", 40, 25, "carlos"); await tx(DONA, "putty", "CONSUMED", 30, 4, "carlos");
  await tx(CAND, "cement", "CONSUMED", 210, 10, "anita", "Boundary wall + partitions"); await tx(CAND, "sand", "RECEIVED", 40, 18, "anita"); await tx(CAND, "sand", "CONSUMED", 28, 6, "anita");
  await tx(CAND, "brick", "RECEIVED", 8000, 24, "anita"); await tx(CAND, "brick", "CONSUMED", 5200, 5, "anita");
  await tx(PAN, "cement", "RECEIVED", 500, 30, "joao"); await tx(PAN, "cement", "CONSUMED", 470, 3, "joao", "GF slab pour");
  await tx(PAN, "steel", "RECEIVED", 18, 35, "joao"); await tx(PAN, "steel", "CONSUMED", 15.4, 3, "joao");

  // ── Material requests ──
  const mr = (project: string, mk: string, quantity: number, status: "REQUESTED" | "APPROVED" | "ORDERED", by: string, daysAgo: number, poId?: string, note?: string) =>
    prisma.materialRequest.create({ data: { companyId: co, projectId: P[project].id, materialId: M[mk], quantity, status, requestedById: U[by], decidedById: status === "REQUESTED" ? null : mgr[project], poId, note, neededBy: day(6), createdAt: at(daysAgo, 9) } });
  await mr(DONA, "conduit", 300, "REQUESTED", "carlos", 0, undefined, "First floor bedrooms — running short");
  await mr(DONA, "wproof", 80, "APPROVED", "carlos", 1, undefined, "Bathroom waterproofing starts tomorrow");
  await mr(CAND, "cement", 150, "REQUESTED", "anita", 0);
  await mr(PAN, "steel", 4, "ORDERED", "joao", 7, po5.id);
  await prisma.notification.create({ data: { companyId: co, userId: U.priya, type: "MATERIAL_REQUEST", title: "Material requested", body: "300 m PVC conduit 25 mm — Dona Paula Villa", href: "/materials", createdAt: at(0, 9) } });

  // ── Budget & expenses ──
  for (const [n, pct] of [[DONA, 1], [CAND, 1], [PAN, 1]] as const) {
    const b = Number(P[n].budget);
    for (const [cat, share, name] of [["MATERIALS", 0.4, "Materials"], ["LABOUR", 0.25, "Site labour"], ["SUBCONTRACT", 0.15, "Specialist subcontractors"], ["EQUIPMENT", 0.05, "Equipment hire"], ["OVERHEADS", 0.05, "Site overheads"]] as const)
      await prisma.budgetLine.create({ data: { companyId: co, projectId: P[n].id, category: cat, name, amount: Math.round(b * share * pct) } });
  }
  let inv = 100;
  const ex = (project: string, cat: ExpenseCategory, description: string, lakhs: number, daysAgo: number, status: ExpenseStatus, o: { sup?: string; con?: string; poId?: string; amount?: number } = {}) =>
    prisma.expense.create({ data: { companyId: co, projectId: P[project].id, category: cat, description, amount: o.amount ?? L(lakhs), date: day(-daysAgo), invoiceNo: `INV-${++inv}`, supplierId: o.sup ? S[o.sup] : null, contractorId: o.con ? CON[o.con] : null, poId: o.poId, status, approvedById: status === "PENDING" ? null : U.nick, paidAt: status === "PAID" ? day(-Math.max(0, daysAgo - 4)) : null, paymentMethod: status === "PAID" ? (inv % 3 === 0 ? "UPI" : "BANK_TRANSFER") : null, paymentRef: status === "PAID" ? `UTR${884000 + inv}` : null, createdById: U.maria, createdAt: at(daysAgo, 14) } });
  // Dona Paula Villa
  for (const [d, desc, l, dy, sup] of [["MATERIALS", "Steel & cement — structure", 45, 200, "steel"], ["MATERIALS", "Bricks, sand and aggregates", 32, 130, "agg"], ["MATERIALS", "Tiles and sanitary fittings", 21, 40, "tiles"]] as const) await ex(DONA, d, desc, l, dy, "PAID", { sup });
  await ex(DONA, "MATERIALS", "Electrical materials — " + po1.number, 0, 12, "APPROVED", { sup: "elec", poId: po1.id, amount: 600 * 38 + 12 * 2100 });
  for (const [desc, l, dy] of [["Labour — Jun", 20, 95], ["Labour — Jul", 21, 65], ["Labour — Aug", 21, 30]] as const) await ex(DONA, "LABOUR", desc, l, dy, "PAID");
  await ex(DONA, "SUBCONTRACT", "Electrical works — RA bill 1", 18, 45, "PAID", { con: "Fernandes Electricals" }); await ex(DONA, "SUBCONTRACT", "Civil works — final bill", 23, 110, "PAID", { con: "Konkan Civil Contractors" });
  await ex(DONA, "SUBCONTRACT", "Plumbing works — RA bill 1", 6.5, 3, "PENDING", { con: "Goa Plumbing Works" });
  await ex(DONA, "EQUIPMENT", "Shuttering & scaffolding hire", 9, 150, "PAID"); await ex(DONA, "OVERHEADS", "Site office, security, insurance", 11, 60, "PAID");
  // Candolim Residence
  for (const [desc, l, dy, sup] of [["Cement and steel", 50, 150, "cement"], ["Bricks and sand", 35, 60, "agg"], ["Fittings & tiles advance", 20, 15, "tiles"]] as const) await ex(CAND, "MATERIALS", desc, l, dy, "PAID", { sup });
  await ex(CAND, "MATERIALS", "Cement — " + po3.number, 0, 18, "PAID", { sup: "cement", poId: po3.id, amount: 300 * 390 });
  for (const [desc, dy] of [["Labour — Jun", 90], ["Labour — Jul", 62], ["Labour — Aug", 33], ["Labour — Sep (part)", 6]] as const) await ex(CAND, "LABOUR", desc, 17, dy, "PAID");
  await ex(CAND, "SUBCONTRACT", "Foundation & retaining wall", 40, 170, "PAID", { con: "Konkan Civil Contractors" }); await ex(CAND, "SUBCONTRACT", "Electrical rough-in — RA bill 1", 22, 12, "PAID", { con: "Fernandes Electricals" });
  await ex(CAND, "SUBCONTRACT", "Boundary wall — RA bill", 8.5, 2, "PENDING", { con: "Konkan Civil Contractors" });
  await ex(CAND, "EQUIPMENT", "Excavator & mixer hire", 14, 140, "PAID"); await ex(CAND, "OVERHEADS", "Site overheads", 13, 50, "PAID");
  // Panaji Commercial Centre
  for (const [desc, l, dy, sup] of [["Cement and RMC", 60, 100, "cement"], ["TMT steel — piles & raft", 55, 120, "steel"], ["Aggregates", 20, 45, "agg"]] as const) await ex(PAN, "MATERIALS", desc, l, dy, "PAID", { sup });
  await ex(PAN, "LABOUR", "Labour — Jul & Aug", 40, 40, "PAID"); await ex(PAN, "LABOUR", "Labour — Sep (part)", 15, 5, "APPROVED");
  await ex(PAN, "SUBCONTRACT", "Piling contractor — final bill", 70, 95, "PAID", { con: "Konkan Civil Contractors" }); await ex(PAN, "SUBCONTRACT", "Shuttering subcontract", 12, 4, "PENDING");
  await ex(PAN, "EQUIPMENT", "Piling rig & crane hire", 18, 110, "PAID"); await ex(PAN, "OVERHEADS", "Site overheads, approvals", 12, 30, "PAID"); await ex(PAN, "MATERIALS", "Steel — instalment", 9, 8, "APPROVED", { sup: "steel" });

  // ── Documents (generated drawings + PDFs, with version history) ──
  const file = (b: Buffer, name: string) => new File([new Uint8Array(b)], name);
  const doc = async (project: string, title: string, category: "DRAWING" | "CONTRACT" | "CERTIFICATE", audience: "MANAGERS" | "PROJECT" | "EXTERNAL", discipline: string | null, versions: [Buffer, string, string, number, string | null, string][]) => {
    const p = P[project];
    const d = await prisma.document.create({ data: { companyId: co, projectId: p.id, title, category, audience, discipline, currentVersion: versions.length, createdAt: at(versions[0][3], 10) } });
    let v = 0;
    for (const [buf, filename, by, daysAgo, note] of versions.map((x) => [x[0], x[1], x[2], x[3], x[4]] as const)) {
      const s = await storeDocument(file(buf, filename), co, p.id);
      await prisma.documentVersion.create({ data: { companyId: co, documentId: d.id, version: ++v, storageKey: s.key, filename: s.filename, mime: s.mime, size: s.size, note, uploadedById: U[by], createdAt: at(daysAgo, 10) } });
    }
    await logActivity({ companyId: co, projectId: p.id, actorId: U[versions[versions.length - 1][2]], type: "DOCUMENT", message: `${title} uploaded`, detail: project, createdAt: at(versions[versions.length - 1][3], 10) });
  };
  let seed = 3;
  for (const [n, eng] of [[DONA, "vikram"], [CAND, "vikram"], [PAN, "rohan"]] as const) {
    const short = n.split(" ")[0];
    await doc(n, "Ground floor plan", "DRAWING", "PROJECT", "Architectural", [[await plan(`${short} — Ground floor plan`, ++seed, "A"), "ground-floor-plan-revA.png", "nick", 200, "Issued for construction"], [await plan(`${short} — Ground floor plan`, ++seed, "B"), "ground-floor-plan-revB.png", eng === "rohan" ? "priya" : "priya", 30, "Revised kitchen and utility layout"]] as never);
    await doc(n, "Electrical layout — first floor", "DRAWING", "PROJECT", "Electrical", [[await plan(`${short} — Electrical layout`, ++seed, "A"), "electrical-first-floor.png", eng, 60, null]] as never);
    await doc(n, "Structural details", "DRAWING", "EXTERNAL", "Structural", [[await plan(`${short} — Structural details`, ++seed, "A"), "structural-details.png", "nick", 210, "Shared with contractors"]] as never);
    await doc(n, "Construction contract", "CONTRACT", "MANAGERS", null, [[pdf([`Construction contract - ${n}`, "Between Coastal India Constructions and the Client.", "Scope: as per approved drawings and BOQ.", "Payment terms: milestone based, see schedule.", "This is a demo document generated by ZUARI."]), "contract.pdf", "nick", 260, null]] as never);
    await doc(n, "Site inspection certificate", "CERTIFICATE", "PROJECT", null, [[pdf([`Inspection certificate - ${n}`, "Foundation inspection completed and approved.", "Inspected by the structural consultant.", "Demo document generated by ZUARI."]), "inspection-certificate.pdf", eng, 150, null]] as never);
  }

  // ── Location (block / floor / area) on evidence ──
  const locs: [string, string, string, string, string][] = [
    [DONA, "Electrical Installation", "Main house", "First floor", "Bedrooms"], [DONA, "Conduit laying — first floor", "Main house", "First floor", "Corridor"], [DONA, "Conduit laying — ground floor", "Main house", "Ground floor", "Living room"], [DONA, "Ground floor brickwork", "Main house", "Ground floor", "Living room"],
    [DONA, "Drainage and soil pipes", "Main house", "Ground floor", "Bathrooms"], [DONA, "Wall putty and primer", "Main house", "Ground floor", "Living room"], [CAND, "Wiring — ground floor", "Main house", "Ground floor", "Living room"],
    [CAND, "First floor brickwork", "Main house", "First floor", "All rooms"], [PAN, "Ground floor slab", "Block A", "Ground floor", "Slab"], [PAN, "Ground floor columns", "Block A", "Ground floor", "Grid B–D"], [PAN, "Basement block work", "Block A", "Basement", "East wall"],
  ];
  for (const [n, title, block, floor, area] of locs) {
    const t = await prisma.task.findFirst({ where: { projectId: P[n].id, title } });
    if (!t) continue;
    await prisma.progressUpdate.updateMany({ where: { taskId: t.id }, data: { block, floor, locationArea: area } });
    await prisma.progressPhoto.updateMany({ where: { taskId: t.id }, data: { block, floor, locationArea: area } });
  }
  for (const [title, block, floor] of [["Water leakage — Floor 2", "Main house", "First floor"], ["Cracks in boundary wall — east side", "Boundary", "Ground"], ["Rebar spacing deviation — GF columns C4, C5", "Block A", "Ground floor"], ["Waterlogging near material storage", "Site yard", "Ground"]] as const)
    await prisma.issue.updateMany({ where: { companyId: co, title }, data: { block, floor } });
  console.log("  ✓ Phase 2 modules (workforce, materials, procurement, finance, documents)");
}
