// Inventory: warehouses, items, receipts, transfers (warehouse↔site↔site), write-offs, counts, dated history,
// concurrency safety, exports, access rules, tenant isolation and the seeded demo scenario.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
const BASE = process.env.BASE ?? "http://localhost:3100";
const run = Date.now().toString(36), pw = "pw-" + run + "-aaa", em = (k) => `${k}.${run}@e2e.test`;
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(1); console.log("✓", name); } catch (e) { results.push(0); console.log("✗", name, "\n   ", String(e.message).split("\n").slice(0, 5).join("\n    ")); throw e; } };
const see = (p, t, ms = 12000) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: ms });
const gone = async (p, t) => { if ((await p.getByText(t).locator("visible=true").count()) > 0) throw new Error(`unexpected text: ${t}`); };
const login = async (p, email, pass = pw) => { await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", pass); await p.click('button:has-text("Sign in")'); };
const prisma = new PrismaClient();
const IST = 5.5 * 3600e3, ago = (n) => new Date(Date.now() + IST - n * 864e5).toISOString().slice(0, 10);
const shown = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const browser = await chromium.launch({ channel: "chrome" });
const mk = async (mobile) => { const c = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on("dialog", (x) => x.accept()); return p; };
const d = await mk(), d2 = await mk(), acc = await mk(), sup = await mk(true);
let A, itemId, trId, companyId;
const F = (p, btn) => p.locator("form", { has: p.locator(`button:has-text("${btn}")`) });
const row = (p) => p.locator("tr", { hasText: "Drill machine" }).first();
const cells = async (p) => (await row(p).locator("td").allInnerTexts()).map((x) => x.trim());
const transfer = async (p, from, to, qty, o = {}) => {
  await p.goto(`${BASE}/inventory`); const f = F(p, "Record transfer");
  await f.locator("[name=from]").selectOption({ label: from }); await f.locator("[name=to]").selectOption({ label: to }); await f.locator("[name=item_0]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=qty_0]").fill(String(qty));
  if (o.date) await f.locator("[name=date]").fill(o.date); if (o.vehicle) await f.locator("[name=vehicle]").fill(o.vehicle); if (o.driver) await f.locator("[name=driver]").fill(o.driver); if (o.note) await f.locator("[name=note]").fill(o.note);
  await f.getByRole("button", { name: "Record transfer" }).click();
};

try {
  await step("Setup: director, two sites, a supervisor on Site A only, an accountant", async () => {
    await d.goto(`${BASE}/signup`); await d.fill("[name=companyName]", `E2E Inventory ${run}`); await d.fill("[name=name]", "Ira Director"); await d.fill("[name=email]", em("ira")); await d.fill("[name=password]", pw); await d.click('button:has-text("Create workspace")'); await d.waitForURL("**/dashboard");
    for (const n of ["Inv Site A", "Inv Site B"]) { await d.goto(`${BASE}/projects/new`); await d.fill("[name=name]", `${n} ${run}`); await d.fill("[name=client]", "Client"); await d.fill("[name=location]", "Goa"); await d.fill("[name=budget]", "1000000"); await d.click('button:has-text("Create project")'); await d.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/); if (n.endsWith("A")) A = d.url().split("/").pop(); }
    for (const [k, role, name] of [["sup", "SITE_SUPERVISOR", "Sid Supervisor"], ["acc", "ACCOUNTANT", "Amy Accountant"]]) { await d.goto(`${BASE}/team`); await d.fill("[name=name]", name); await d.fill("[name=email]", em(k)); await d.selectOption("[name=role]", role); await d.fill("[name=password]", pw); await d.click('button:has-text("Create account")'); await see(d, "can now sign in"); }
    await d.goto(`${BASE}/projects/${A}/team`); await d.selectOption("select[name=userId]", { label: "Sid Supervisor · Site Supervisor" }); await d.click('button:has-text("Add to project")'); await d.waitForTimeout(700);
    companyId = (await prisma.user.findUnique({ where: { email: em("ira") } })).companyId; await login(sup, em("sup")); await sup.waitForURL("**/site"); await login(acc, em("acc")); await acc.waitForURL("**/dashboard");
  });
  await step("Catalogue: two warehouses and two items", async () => {
    await d.goto(`${BASE}/inventory/manage`);
    for (const w of ["Bambolim Warehouse", "Ponda Store"]) { await F(d, "Add warehouse").locator("[name=name]").fill(w); await F(d, "Add warehouse").getByRole("button", { name: "Add warehouse" }).click(); await see(d, "Warehouse added"); await d.goto(`${BASE}/inventory/manage`); }
    for (const [n, c] of [["Drill machine", "6500"], ["Scaffold frame", "1400"]]) { const f = F(d, "Add item"); await f.locator("[name=name]").fill(n); await f.locator("[name=unitCost]").fill(c); await f.getByRole("button", { name: "Add item" }).click(); await see(d, "Item added"); await d.goto(`${BASE}/inventory/manage`); }
    itemId = (await prisma.inventoryItem.findFirst({ where: { companyId, name: "Drill machine" } })).id;
  });
  await step("Receive 40 drills at the Bambolim warehouse", async () => {
    await d.goto(`${BASE}/inventory`); await d.click("summary:has-text('Receive new stock')"); const f = F(d, "Add stock");
    await f.locator("[name=itemId]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=at]").selectOption({ label: "Bambolim Warehouse" }); await f.locator("[name=quantity]").fill("40"); await f.locator("[name=note]").fill("Opening stock"); await f.getByRole("button", { name: "Add stock" }).click(); await see(d, "40 nos of Drill machine added at Bambolim Warehouse");
    await d.goto(`${BASE}/inventory`); const c = await cells(d); if (!c.includes("40")) throw new Error("matrix does not show 40: " + c.join("|"));
  });
  await step("Send 10 drills from Bambolim to Site A: the challan records the date, vehicle and driver; balances update", async () => {
    await transfer(d, "Bambolim Warehouse", `Inv Site A ${run}`, 10, { date: ago(3), vehicle: "GA-07-T-4821", driver: "Ramesh Gaonkar", note: "For finishing works" });
    await d.waitForURL(/\/inventory\/transfers\/c/); trId = d.url().split("/").pop();
    await see(d, "Date of transport"); await see(d, shown(3)); await see(d, "GA-07-T-4821"); await see(d, "Ramesh Gaonkar"); await see(d, "Bambolim Warehouse"); await see(d, `Inv Site A ${run}`); await see(d, "10 nos");
    await d.goto(`${BASE}/inventory`); const c = await cells(d); if (!c.includes("30") || !c.includes("10")) throw new Error("expected 30 at the warehouse and 10 at the site: " + c.join("|"));
  });
  await step("Guards: can't move more than is there, can't move to the same place", async () => {
    await transfer(d, "Bambolim Warehouse", `Inv Site B ${run}`, 50); await see(d, "Only 30 nos of Drill machine at Bambolim Warehouse");
    await transfer(d, "Bambolim Warehouse", "Bambolim Warehouse", 1); await see(d, "two different locations");
    const c = await cells(d); if (!c.includes("30")) throw new Error("balance changed after refused transfers");
  });
  await step("Site → site and site → warehouse moves; write-off; stock count", async () => {
    await transfer(d, `Inv Site A ${run}`, `Inv Site B ${run}`, 4, { date: ago(2) }); await d.waitForURL(/\/inventory\/transfers\/c/);
    await transfer(d, `Inv Site B ${run}`, "Ponda Store", 3, { date: ago(1) }); await d.waitForURL(/\/inventory\/transfers\/c/);
    await d.goto(`${BASE}/inventory`); await d.click("summary:has-text('Write off lost or damaged')"); let f = F(d, "Write off");
    await f.locator("[name=itemId]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=at]").selectOption({ label: `Inv Site A ${run}` }); await f.locator("[name=quantity]").fill("1"); await f.locator("[name=note]").fill("Motor burnt out"); await f.getByRole("button", { name: "Write off" }).click(); await see(d, "written off at");
    await f.locator("[name=itemId]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=at]").selectOption({ label: `Inv Site B ${run}` }); await f.locator("[name=quantity]").fill("99"); await f.getByRole("button", { name: "Write off" }).click(); await see(d, "Only 1 nos");
    await d.goto(`${BASE}/inventory`); await d.click("summary:has-text('Stock count correction')"); f = F(d, "Correct to counted");
    await f.locator("[name=itemId]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=at]").selectOption({ label: "Bambolim Warehouse" }); await f.locator("[name=counted]").fill("28"); await f.getByRole("button", { name: "Correct to counted" }).click(); await see(d, "Recorded -2");
    await d.goto(`${BASE}/inventory`); const c = (await cells(d)).join("|"); for (const n of ["28", "5", "1", "3", "37"]) if (!c.split("|").includes(n)) throw new Error(`expected ${n} in ${c}`);
  });
  await step("Item and location history are dated and complete", async () => {
    await d.goto(`${BASE}/inventory/items/${itemId}`); await see(d, "Where it is now"); await see(d, "Written off"); await see(d, "Stock count"); await see(d, "Opening stock"); await see(d, shown(3)); await see(d, shown(1));
    const order = await d.locator("table tbody tr td:first-child").allInnerTexts(); if (!order.length) throw new Error("no history rows");
    await d.goto(`${BASE}/inventory/at/p-${A}`); await see(d, "Movements at this location"); await see(d, "from Bambolim Warehouse"); await see(d, `to Inv Site B ${run}`);
    await d.goto(`${BASE}/inventory/transfers`); await see(d, "TR-"); if ((await d.locator('a[href^="/inventory/transfers/c"]').count()) !== 3) throw new Error("expected 3 transfers in the log");
    await d.locator('select[name=at]').selectOption({ label: `Inv Site B ${run}` }); await d.click('button:has-text("Filter")'); await d.waitForURL(/at=/); if ((await d.locator('a[href^="/inventory/transfers/c"]').count()) !== 2) throw new Error("location filter should give 2 transfers");
    await d.goto(`${BASE}/projects/${A}`); await see(d, "Equipment on site"); await see(d, "Drill machine");
  });
  await step("Two simultaneous transfers can't both spend the same stock", async () => {
    const go = async (p) => { if (p !== d) { await login(p, em("ira")); await p.waitForURL("**/dashboard"); } await p.goto(`${BASE}/inventory`); const f = F(p, "Record transfer"); await f.locator("[name=from]").selectOption({ label: "Bambolim Warehouse" }); await f.locator("[name=to]").selectOption({ label: `Inv Site B ${run}` }); await f.locator("[name=item_0]").selectOption({ label: "Drill machine (nos)" }); await f.locator("[name=qty_0]").fill("20"); return f; };
    const [f1, f2] = await Promise.all([go(d), go(d2)]);
    await Promise.all([f1.getByRole("button", { name: "Record transfer" }).click(), f2.getByRole("button", { name: "Record transfer" }).click()]); await d.waitForTimeout(4000);
    const sum = await prisma.inventoryTxn.aggregate({ where: { companyId, itemId, warehouse: { name: "Bambolim Warehouse" } }, _sum: { quantity: true } }), n = await prisma.inventoryTransfer.count({ where: { companyId } });
    if (sum._sum.quantity !== 8) throw new Error(`Bambolim should hold 8 after exactly one 20-unit transfer, holds ${sum._sum.quantity}`); if (n !== 4) throw new Error(`expected 4 transfers, found ${n}`);
  });
  await step("Exports include quantities, dates, vehicle and driver", async () => {
    const inv = await (await d.request.get(`${BASE}/api/export/inventory`)).text(), tr = await (await d.request.get(`${BASE}/api/export/inventory-transfers`)).text();
    if (!inv.includes("Drill machine") || !inv.includes("Bambolim Warehouse") || !inv.includes("Warehouse")) throw new Error("inventory csv incomplete");
    if (!tr.includes("GA-07-T-4821") || !tr.includes("Ramesh Gaonkar") || !tr.includes(ago(3))) throw new Error("transfer csv incomplete");
  });
  await step("Access: site staff see only their site read-only; accountant views without editing; other companies get 404", async () => {
    await sup.goto(`${BASE}/site/inventory`); await see(sup, `Inv Site A ${run}`); await see(sup, "Drill machine"); await gone(sup, `Inv Site B ${run}`.replace(/^/, "")); 
    await sup.goto(`${BASE}/inventory`); await sup.waitForURL("**/site"); if ((await sup.request.get(`${BASE}/api/export/inventory`)).status() !== 404) throw new Error("supervisor exported inventory");
    await acc.goto(`${BASE}/inventory`); await see(acc, "Where everything is"); await see(acc, "₹"); if ((await acc.locator('button:has-text("Record transfer")').count()) > 0) throw new Error("accountant sees the transfer form"); if ((await acc.goto(`${BASE}/inventory/manage`)).status() !== 404) throw new Error("accountant reached setup");
    const other = await mk(); await login(other, "meera.kamat@konkanbuilders.demo", "zuari-demo-2026"); await other.waitForURL("**/dashboard");
    for (const p of [`/inventory/transfers/${trId}`, `/inventory/items/${itemId}`, `/inventory/at/p-${A}`]) { const r = await other.goto(BASE + p); if (r.status() !== 404) throw new Error(`${p} → ${r.status()}`); }
    await other.goto(`${BASE}/inventory`); await gone(other, "Drill machine");
  });
  await step("Seeded demo: the Bambolim → Dona Paula transfer of 10 drills is on record", async () => {
    const dm = await mk(); await login(dm, "nick.araujo@coastalindia.demo", "zuari-demo-2026"); await dm.waitForURL("**/dashboard");
    await dm.goto(`${BASE}/inventory`); await see(dm, "Where everything is"); await see(dm, "Drill machine (18 V)"); await see(dm, "Bambolim Warehouse");
    await dm.goto(`${BASE}/inventory/transfers`); await dm.locator("tr", { hasText: "Dona Paula Villa" }).filter({ hasText: "10 × Drill machine" }).first().locator("a").first().click(); await dm.waitForURL(/\/inventory\/transfers\/c/);
    for (const t of ["Bambolim Warehouse", "Dona Paula Villa", "10 nos", "GA-07-T-4821", "Ramesh Gaonkar", "For finishing works"]) await see(dm, t);
  });
} finally {
  await browser.close(); await prisma.$disconnect();
  console.log(`\n${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.includes(0) ? 1 : 0);
}
