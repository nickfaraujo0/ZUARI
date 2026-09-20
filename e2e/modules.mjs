// Phase-2 modules end to end: settings, contractors/suppliers, roles, workforce, materials → procurement → finance,
// documents (versions + audiences), location filters, role scoping, and cross-tenant isolation.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100";
const run = Date.now().toString(36);
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(1); console.log("✓", name); } catch (e) { results.push(0); console.log("✗", name, "\n   ", String(e.message).split("\n").slice(0, 6).join("\n    ")); throw e; } };
const see = (p, t, ms = 8000) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: ms });
const gone = async (p, t) => { if ((await p.getByText(t).locator("visible=true").count()) > 0) throw new Error(`unexpected text: ${t}`); };
const login = async (p, email, pw = "pw-" + run + "-aaa") => { await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click('button:has-text("Sign in")'); };

const browser = await chromium.launch({ channel: "chrome" });
const mk = async (mobile) => { const c = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on("dialog", (x) => x.accept()); return p; };
const d = await mk(), acc = await mk(), sup = await mk(true), eng = await mk(true), con = await mk(true);
const em = (k) => `${k}.${run}@e2e.test`;
const pw = "pw-" + run + "-aaa";
let pid, poId, p2;

try {
  await step("Director signs up, creates a project and gives it map coordinates", async () => {
    await d.goto(`${BASE}/signup`); await d.fill("[name=companyName]", `E2E Modules ${run}`); await d.fill("[name=name]", "Dora Director"); await d.fill("[name=email]", em("dora")); await d.fill("[name=password]", pw);
    await d.click('button:has-text("Create workspace")'); await d.waitForURL("**/dashboard");
    await d.goto(`${BASE}/projects/new`); await d.fill("[name=name]", `Modules Villa ${run}`); await d.fill("[name=client]", "Client"); await d.fill("[name=location]", "Porvorim, Goa"); await d.fill("[name=budget]", "6000000");
    await d.click('button:has-text("Create project")'); await d.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/); pid = d.url().split("/").pop();
    await d.goto(`${BASE}/projects/${pid}/edit`); await d.fill("[name=latitude]", "15.5"); await d.fill("[name=longitude]", "73.9"); await d.click('button:has-text("Save changes")'); await d.waitForURL(`**/projects/${pid}`);
    await d.goto(`${BASE}/map`); await d.locator(".leaflet-marker-icon").first().waitFor({ timeout: 15000 });
  });
  await step("Settings: company profile and default phase template drive new projects", async () => {
    await d.goto(`${BASE}/settings`); await d.fill("[name=address]", "1 Test Road, Goa"); await d.click('button:has-text("Save profile")'); await see(d, "Company profile saved");
    await d.fill("[name=phases]", "Site prep\nStructure\nHandover"); await d.click('button:has-text("Save phases")'); await see(d, "New projects will start");
    await d.goto(`${BASE}/projects/new`); await d.fill("[name=name]", `Second ${run}`); await d.fill("[name=client]", "C2"); await d.fill("[name=location]", "Goa"); await d.fill("[name=budget]", "1000000");
    await d.click('button:has-text("Create project")'); await d.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/); p2 = d.url().split("/").pop();
    await d.goto(`${BASE}/projects/${p2}/timeline`); await see(d, "Handover"); await gone(d, "Foundation");
  });
  await step("Contractors and suppliers can be added", async () => {
    await d.goto(`${BASE}/contractors`); await d.fill("[name=name]", "Test Electricals"); await d.fill("[name=trade]", "Electrical"); await d.click('button:has-text("Add contractor")'); await see(d, "Contractor added");
    await d.goto(`${BASE}/suppliers`); await d.fill("[name=name]", "Test Cement Co"); await d.click('button:has-text("Add supplier")'); await see(d, "Supplier added");
  });
  await step("Director creates accountant, engineer, contractor and supervisor accounts", async () => {
    for (const [k, role, label] of [["acc", "ACCOUNTANT", "Amy Accountant"], ["eng", "SITE_ENGINEER", "Eli Engineer"], ["con", "CONTRACTOR", "Cal Contractor"], ["sup", "SITE_SUPERVISOR", "Sam Supervisor"]]) {
      await d.goto(`${BASE}/team`); await d.fill("[name=name]", label); await d.fill("[name=email]", em(k)); await d.selectOption("[name=role]", role);
      if (role === "CONTRACTOR") await d.selectOption("[name=contractorId]", { label: "Test Electricals" });
      await d.fill("[name=password]", pw); await d.click('button:has-text("Create account")'); await see(d, "can now sign in");
    }
    for (const label of ["Eli Engineer · Site Engineer", "Sam Supervisor · Site Supervisor", "Cal Contractor · Contractor"]) {
      await d.goto(`${BASE}/projects/${pid}/team`); await d.selectOption("select[name=userId]", { label }); await d.click('button:has-text("Add to project")'); await d.waitForTimeout(700);
    }
    await d.goto(`${BASE}/projects/${pid}/team`); await see(d, "Cal Contractor");
  });
  await step("Workforce: add workers and mark attendance; totals appear in the weekly table", async () => {
    await d.goto(`${BASE}/workforce`);
    for (const [n, t] of [["Worker One", "Mason"], ["Worker Two", "Helper"]]) { await d.fill('form [name=name] >> nth=-1', n); await d.fill('form [name=trade] >> nth=-1', t); await d.click('button:has-text("Add worker")'); await see(d, "Worker added"); await d.goto(`${BASE}/workforce`); }
    await d.locator("li", { hasText: "Worker One" }).getByText("Present", { exact: true }).click(); await d.locator("li", { hasText: "Worker Two" }).getByText("Half", { exact: true }).click();
    await d.click('button:has-text("Save attendance")'); await see(d, "Attendance saved: 1 present, 1 half day");
    await d.goto(`${BASE}/workforce`); await see(d, "1.5");
  });
  await step("Materials: receive and consume stock; consuming more than is in stock is refused", async () => {
    await d.goto(`${BASE}/materials`); await d.fill("[name=name]", "Cement"); await d.fill("[name=unit]", "bags"); await d.fill("[name=reorderLevel]", "50"); await d.click('button:has-text("Add material")'); await see(d, "Material added");
    await d.goto(`${BASE}/materials`);
    const log = async (type, qty) => { await d.selectOption("[name=materialId]", { label: "Cement (bags)" }); await d.selectOption("[name=type]", type); await d.fill("[name=quantity]", String(qty)); await d.click('button:has-text("Record")'); };
    await log("RECEIVED", 100); await see(d, "Stock now 100 bags"); await log("CONSUMED", 30); await see(d, "Stock now 70 bags"); await log("CONSUMED", 500); await see(d, "Only 70 bags");
  });
  await step("Supervisor requests material on the phone; manager approves and raises a PO", async () => {
    await login(sup, em("sup")); await sup.waitForURL("**/site"); await sup.goto(`${BASE}/site/materials`);
    await sup.click("summary:has-text('Request material')"); await sup.selectOption("details[open] [name=materialId]", { label: "Cement (bags)" }); await sup.fill("details[open] [name=quantity]", "200"); await sup.click('button:has-text("Send request")'); await see(sup, "Request sent to your project manager");
    await d.goto(`${BASE}/materials`); await d.locator("li", { hasText: "200 bags Cement" }).getByRole("button", { name: "Approve" }).click(); await see(d, "Create PO");
    await d.click("text=Create PO"); await d.waitForURL(/fromRequest=/);
    await d.selectOption("[name=supplierId]", { label: "Test Cement Co" }); await d.fill("[name=rate_0]", "400"); await d.click('button:has-text("Create draft PO")'); await d.waitForURL(/\/procurement\/c/); await see(d, "Order lines");
  });
  await step("Purchase order: approve → order → receive delivery adds stock", async () => {
    await d.goto(`${BASE}/procurement`); await d.locator('a[href^="/procurement/c"]').first().click(); await d.waitForURL(/\/procurement\/c/); poId = d.url().split("/").pop();
    await see(d, "₹80,000"); await d.click('button:has-text("Approve order")'); await see(d, "Mark as ordered"); await d.click('button:has-text("Mark as ordered")'); await see(d, "Receive delivery");
    await d.click('button:has-text("Receive delivery")'); await see(d, "Delivered");
    await d.goto(`${BASE}/materials`); await see(d, "270"); await see(d, "Delivered");
  });
  await step("Finance: accountant budgets and records the invoice; director approves; accountant pays", async () => {
    await login(acc, em("acc")); await acc.waitForURL("**/dashboard");
    await acc.goto(`${BASE}/budget`); await acc.selectOption("[name=category]", "MATERIALS"); await acc.fill("[name=name]", "Cement"); await acc.fill("[name=amount]", "500000"); await acc.click('button:has-text("Add line")'); await see(acc, "Budget line added");
    await acc.goto(`${BASE}/expenses?po=${poId}`); await acc.click('button:has-text("Record expense")'); await see(acc, "awaiting director approval");
    if ((await acc.locator('button:has-text("Approve")').count()) > 0) throw new Error("accountant can approve expenses (segregation of duties broken)");
    await d.goto(`${BASE}/expenses?status=PENDING`); await d.click('button:has-text("Approve")'); await d.waitForTimeout(900);
    await acc.goto(`${BASE}/payments`); await acc.click('button:has-text("Mark paid")'); await see(acc, "Nothing is waiting for payment"); await see(acc, "Bank transfer");
    await acc.goto(`${BASE}/budget`); await see(acc, "₹80,000");
  });
  await step("Documents: upload with audiences, add a version, reject a fake PDF", async () => {
    const up = () => d.locator("form", { has: d.locator("select[name=projectId]") });
    for (const [title, aud] of [["Managers plan", "MANAGERS"], ["Team plan", "PROJECT"], ["External plan", "EXTERNAL"]]) {
      await d.goto(`${BASE}/documents`); await up().locator("[name=projectId]").selectOption({ label: `Modules Villa ${run}` }); await up().locator("[name=title]").fill(title); await up().locator("[name=audience]").selectOption(aud);
      await up().locator("[name=file]").setInputFiles("e2e/site-photo.jpg"); await up().getByRole("button", { name: "Upload", exact: true }).click(); await see(d, "Document uploaded");
    }
    await d.goto(`${BASE}/documents`); await up().locator("[name=projectId]").selectOption({ label: `Modules Villa ${run}` }); await up().locator("[name=title]").fill("Fake"); await up().locator("[name=file]").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is plain text, not a pdf at all") }); await up().getByRole("button", { name: "Upload", exact: true }).click(); await see(d, "Unsupported file");
    await d.goto(`${BASE}/documents`); const card = d.locator("div.rounded-xl", { hasText: "Team plan" }).first(); await card.locator("summary").click();
    await card.locator("input[type=file]").first().setInputFiles("e2e/site-photo.jpg"); await card.locator('button:has-text("Upload new version")').click(); await see(d, "Version 2 is now current");
    await d.goto(`${BASE}/documents`); await see(d, "v2");
  });
  await step("Document audiences: contractor sees only External; supervisor and engineer see Team + External; downloads are access-checked", async () => {
    await con.goto(`${BASE}/login`); await login(con, em("con")); await con.waitForURL("**/site"); await con.goto(`${BASE}/site/drawings`); await see(con, "External plan"); await gone(con, "Team plan"); await gone(con, "Managers plan");
    await sup.goto(`${BASE}/site/drawings`); await see(sup, "Team plan"); await see(sup, "External plan"); await gone(sup, "Managers plan");
    await login(eng, em("eng")); await eng.waitForURL("**/site"); await eng.goto(`${BASE}/site/drawings`); await see(eng, "Team plan"); await gone(eng, "Managers plan");
    await d.goto(`${BASE}/documents`); const href = await d.locator("div.rounded-xl", { hasText: "Managers plan" }).first().locator('a[href^="/api/documents/"]').first().getAttribute("href");
    const own = await d.request.get(BASE + href); if (own.status() !== 200 || !(own.headers()["content-type"] ?? "").includes("image/jpeg")) throw new Error("director could not download own document");
    if ((await con.request.get(BASE + href)).status() !== 404) throw new Error("contractor downloaded a managers-only document");
    if ((await sup.request.get(BASE + href)).status() !== 404) throw new Error("supervisor downloaded a managers-only document");
    const anon = await (await browser.newContext()).newPage(); if ((await anon.request.get(BASE + href)).status() !== 401) throw new Error("anonymous download allowed");
  });
  await step("Location on evidence: supervisor tags block/floor/area; manager filters photos by it", async () => {
    await sup.goto(`${BASE}/site/add-progress?project=${pid}`); await sup.setInputFiles("input[type=file][multiple]", "e2e/site-photo.jpg"); await sup.locator("img[alt=Selected]").waitFor();
    await sup.fill('input[placeholder="Block A"]', "Tower 1"); await sup.fill('input[placeholder="Floor 2"]', "Floor 3"); await sup.fill('input[placeholder="Master bedroom"]', "Lobby");
    await sup.click('button:has-text("Submit progress")'); await see(sup, "Progress submitted");
    await d.goto(`${BASE}/projects/${pid}/photos?block=tower`); await see(d, "Tower 1 · Floor 3 · Lobby");
    await d.goto(`${BASE}/projects/${pid}/photos?block=zzz`); await see(d, "No photos found");
  });
  await step("Daily site report assembles workforce, materials, notes and photos automatically", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await d.goto(`${BASE}/reports/daily?project=${pid}&date=${today}`); await see(d, "Daily Site Report"); await see(d, "1.5"); await see(d, "worker-days"); await see(d, "Tower 1, Floor 3, Lobby"); await see(d, "Cement"); await see(d, "Photos (1)");
  });
  await step("Role scoping: contractor sees only assigned tasks and only own photos; engineer sees all work", async () => {
    await d.goto(`${BASE}/projects/${pid}/tasks`);
    for (const [title, who] of [["Task for contractor", "Cal Contractor · Contractor"], ["Task for supervisor", "Sam Supervisor · Site Supervisor"]]) {
      await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('summary:has-text("Create task")'); await d.fill("[name=title]", title); await d.selectOption("[name=assigneeId]", { label: who }); await d.click('button:has-text("Create task")'); await see(d, "Task created");
    }
    await con.goto(`${BASE}/site/tasks`); await see(con, "Task for contractor"); await gone(con, "Task for supervisor");
    await sup.goto(`${BASE}/site/tasks`); await see(sup, "Task for supervisor"); await gone(sup, "Task for contractor");
    await eng.goto(`${BASE}/site/tasks`); await see(eng, "Task for supervisor"); await see(eng, "Task for contractor");
    await con.goto(`${BASE}/site/progress`); await see(con, "No photos yet");
    await d.goto(`${BASE}/projects/${pid}/photos`); const src = await d.locator('main a img[src^="/api/photos/"]').first().getAttribute("src");
    if ((await con.request.get(BASE + src)).status() !== 404) throw new Error("contractor could open another person's photo");
    if ((await eng.request.get(BASE + src)).status() !== 200) throw new Error("engineer could not open a project photo");
  });
  await step("Tenant isolation for the new modules (other company gets 404s)", async () => {
    const other = await mk(); await login(other, "meera.kamat@konkanbuilders.demo", "zuari-demo-2026"); await other.waitForURL("**/dashboard");
    for (const path of [`/procurement/${poId}`, `/projects/${pid}/documents`, `/projects/${pid}/edit`]) { const r = await other.goto(BASE + path); if (r.status() !== 404) throw new Error(`${path} → ${r.status()}`); }
    await other.goto(`${BASE}/budget`); await gone(other, `Modules Villa ${run}`); await other.goto(`${BASE}/suppliers`); await gone(other, "Test Cement Co");
    await other.goto(`${BASE}/workforce`); await gone(other, "Worker One");
  });
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.includes(0) ? 1 : 0);
}
