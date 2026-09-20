// Tier 1: inspections + verify gate, drawing pins, safety, delay log + weather, quantity progress,
// photo compare, client portal, handover pack. Uses a local weather stub (server must run with WEATHER_API_BASE=http://localhost:3199).
import http from "node:http";
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100";
const run = Date.now().toString(36);
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(1); console.log("✓", name); } catch (e) { results.push(0); console.log("✗", name, "\n   ", String(e.message).split("\n").slice(0, 5).join("\n    ")); throw e; } };
const see = (p, t, ms = 9000) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: ms });
const gone = async (p, t) => { if ((await p.getByText(t).locator("visible=true").count()) > 0) throw new Error(`unexpected text: ${t}`); };
const pw = "pw-" + run + "-aaa", em = (k) => `${k}.${run}@e2e.test`;
const login = async (p, email, pass = pw) => { await p.goto(`${BASE}/login`); await p.fill("[name=email]", email); await p.fill("[name=password]", pass); await p.click('button:has-text("Sign in")'); };

// Weather stub: 7 recorded days (heavy rain 5 and 2 days ago) + 7 forecast days (heavy rain in 3 days).
const IST = 5.5 * 3600e3;
const stub = http.createServer((_q, res) => {
  const t0 = Math.floor((Date.now() + IST) / 864e5) * 864e5;
  const days = Array.from({ length: 14 }, (_, i) => new Date(t0 + (i - 7) * 864e5).toISOString().slice(0, 10));
  const rain = [0, 0, 30, 0, 0, 20, 0, 0, 0, 0, 40, 5, 0, 0], prob = [null, null, null, null, null, null, null, 10, 10, 20, 90, 60, 10, 10];
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ daily: { time: days, precipitation_sum: rain, precipitation_probability_max: prob } }));
}).listen(3199);

const browser = await chromium.launch({ channel: "chrome" });
const mk = async (mobile) => { const c = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on("dialog", (x) => x.accept()); return p; };
const d = await mk(), sup = await mk(true), eng = await mk(true);
let pid, share;
const lat = (15.5 + (Date.now() % 100000) / 1e6).toFixed(6);
const today = new Date(Date.now() + IST), plus = (n) => new Date(today.getTime() + n * 864e5).toISOString().slice(0, 10);

try {
  await step("Setup: director, project with coordinates, supervisor and engineer", async () => {
    await d.goto(`${BASE}/signup`); await d.fill("[name=companyName]", `E2E Tier1 ${run}`); await d.fill("[name=name]", "Tia Director"); await d.fill("[name=email]", em("tia")); await d.fill("[name=password]", pw); await d.click('button:has-text("Create workspace")'); await d.waitForURL("**/dashboard");
    await d.goto(`${BASE}/projects/new`); await d.fill("[name=name]", `Tier1 Villa ${run}`); await d.fill("[name=client]", "Client"); await d.fill("[name=location]", "Goa"); await d.fill("[name=budget]", "5000000"); await d.click('button:has-text("Create project")'); await d.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/); pid = d.url().split("/").pop();
    await d.goto(`${BASE}/projects/${pid}/edit`); await d.fill("[name=latitude]", lat); await d.fill("[name=longitude]", "73.9"); await d.click('button:has-text("Save changes")'); await d.waitForURL(`**/projects/${pid}`);
    for (const [k, role, name] of [["sup", "SITE_SUPERVISOR", "Sid Supervisor"], ["eng", "SITE_ENGINEER", "Eli Engineer"]]) { await d.goto(`${BASE}/team`); await d.fill("[name=name]", name); await d.fill("[name=email]", em(k)); await d.selectOption("[name=role]", role); await d.fill("[name=password]", pw); await d.click('button:has-text("Create account")'); await see(d, "can now sign in"); await d.goto(`${BASE}/projects/${pid}/team`); await d.selectOption("select[name=userId]", { label: `${name} · ${role === "SITE_ENGINEER" ? "Site Engineer" : "Site Supervisor"}` }); await d.click('button:has-text("Add to project")'); await d.waitForTimeout(600); }
    await login(sup, em("sup")); await sup.waitForURL("**/site"); await login(eng, em("eng")); await eng.waitForURL("**/site");
    for (const [n, t] of [["Worker A", "Mason"], ["Worker B", "Helper"]]) { await d.goto(`${BASE}/workforce`); await d.fill('form [name=name] >> nth=-1', n); await d.fill('form [name=trade] >> nth=-1', t); await d.click('button:has-text("Add worker")'); await see(d, "Worker added"); }
  });
  await step("Quantity task: weather-sensitive, measured in m³; supervisor logs quantity and progress follows", async () => {
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('summary:has-text("Create task")'); await d.fill("[name=title]", "Slab concrete pour"); await d.selectOption("[name=assigneeId]", { label: "Sid Supervisor · Site Supervisor" });
    await d.fill("[name=startDate]", plus(0)); await d.fill("[name=dueDate]", plus(5)); await d.fill("[name=quantityTotal]", "100"); await d.fill("[name=quantityUnit]", "m³"); await d.check("[name=weatherSensitive]"); await d.click('button:has-text("Create task")'); await see(d, "Task created");
    await sup.goto(`${BASE}/site/tasks`); await sup.click("text=Slab concrete pour"); await sup.click("text=Update this task"); await see(sup, "Quantity completed today");
    await sup.fill('input[inputmode="decimal"]', "30"); await sup.click('button:has-text("Submit progress")'); await see(sup, "Progress submitted");
    await d.goto(`${BASE}/projects/${pid}/tasks`); await see(d, "30/100 m³"); await see(d, "30%");
    await sup.goto(`${BASE}/site/tasks`); await sup.click("text=Slab concrete pour"); await sup.click("text=Update this task"); await sup.fill('input[inputmode="decimal"]', "70"); await sup.click('button:has-text("Submit progress")'); await see(sup, "Progress submitted");
    await d.goto(`${BASE}/projects/${pid}/tasks`); await see(d, "100/100 m³"); if ((await d.locator('select[name=status]').first().inputValue()) !== "COMPLETED") throw new Error("task not auto-completed at full quantity");
  });
  await step("Weather: rain outlook on the project, at-risk task flagged, dashboard alert", async () => {
    // new open weather-sensitive task inside the wet window
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.click('summary:has-text("Create task")'); await d.fill("[name=title]", "Terrace waterproofing"); await d.fill("[name=startDate]", plus(1)); await d.fill("[name=dueDate]", plus(5)); await d.check("[name=weatherSensitive]"); await d.click('button:has-text("Create task")'); await see(d, "Task created");
    await d.goto(`${BASE}/projects/${pid}`); await see(d, "Rain outlook"); await see(d, "Weather-sensitive work at risk"); await see(d, "Terrace waterproofing");
    await d.goto(`${BASE}/dashboard`); await see(d, "Weather alerts");
  });
  await step("Delay log: heavy-rain days offered from records, manual and mobile entries, totals", async () => {
    await d.goto(`${BASE}/projects/${pid}/timeline`); await d.click('button:has-text("heavy-rain days as delays")'); await d.waitForTimeout(1200); await d.goto(`${BASE}/projects/${pid}/timeline`); await see(d, "2 days lost");
    await d.selectOption('select[name=cause] >> nth=-1', "MATERIAL"); await d.fill('input[name=days] >> nth=-1', "2"); await d.click('button:has-text("Log delay")'); await d.waitForTimeout(900); await d.goto(`${BASE}/projects/${pid}/timeline`); await see(d, "4 days lost");
    await sup.goto(`${BASE}/site/delay`); await sup.selectOption("[name=projectId]", { label: `Tier1 Villa ${run}` }); await sup.selectOption("[name=cause]", "LABOUR"); await sup.click('button:has-text("Log delay")'); await see(sup, "Delay logged");
  });
  await step("Inspection fails → snag raised; task can't be verified until a re-inspection passes", async () => {
    await eng.goto(`${BASE}/site/inspections`); await eng.click("summary:has-text('Start an inspection')");
    await eng.selectOption("[name=projectId]", { label: `Tier1 Villa ${run}` }); await eng.selectOption("[name=templateId]", { label: "Pre-pour check · Structure" }); await eng.selectOption("[name=taskId]", { label: `Tier1 Villa ${run} · Slab concrete pour` }); await eng.click('button:has-text("Start inspection")'); await eng.waitForURL(/\/site\/inspections\/c/);
    const rows = eng.locator("form ul li"), n = await rows.count();
    for (let i = 0; i < n; i++) await rows.nth(i).getByText(i === 1 ? "Fail" : "Pass", { exact: true }).click();
    await eng.click('button:has-text("Finish inspection")'); await see(eng, "Add a note for the failed item");
    await rows.nth(1).locator("input[name^=n_]").fill("Stirrups too wide at C4"); await eng.click('button:has-text("Finish inspection")'); await see(eng, "Start re-inspection");
    await d.goto(`${BASE}/issues`); await see(d, "Pre-pour check: Reinforcement"); await see(d, "Snag");
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.locator("tr", { hasText: "Slab concrete pour" }).locator("select[name=status]").selectOption("VERIFIED"); await see(d, "latest inspection for this task failed");
    const before = eng.url(); await eng.click('button:has-text("Start re-inspection")'); await eng.waitForURL((u) => u.href !== before); if ((await eng.locator("form ul li").count()) !== 1) throw new Error("re-inspection should only contain the failed item");
    await eng.locator("form ul li").first().getByText("Pass", { exact: true }).click(); await eng.click('button:has-text("Finish inspection")'); await see(eng, "Passed");
    await d.goto(`${BASE}/issues?show=closed`); await see(d, "Pre-pour check: Reinforcement");
    await d.goto(`${BASE}/projects/${pid}/tasks`); await d.locator("tr", { hasText: "Slab concrete pour" }).locator("select[name=status]").selectOption("VERIFIED"); await d.waitForTimeout(1200); await d.goto(`${BASE}/projects/${pid}/tasks`);
    if ((await d.locator("tr", { hasText: "Slab concrete pour" }).locator("select[name=status]").inputValue()) !== "VERIFIED") throw new Error("task could not be verified after a passing re-inspection");
  });
  await step("Drawing pins: pin an issue on a drawing (desktop) and see it on the phone", async () => {
    const up = () => d.locator("form", { has: d.locator("select[name=projectId]") });
    await d.goto(`${BASE}/documents`); await up().locator("[name=projectId]").selectOption({ label: `Tier1 Villa ${run}` }); await up().locator("[name=title]").fill("Kitchen plan"); await up().locator("[name=file]").setInputFiles("e2e/site-photo.jpg"); await up().getByRole("button", { name: "Upload", exact: true }).click(); await see(d, "Document uploaded");
    await d.goto(`${BASE}/documents`); await d.click('a:has-text("View & pin issues")'); await d.waitForURL(/\/documents\/c/);
    await d.locator('[role=img] img').click({ position: { x: 200, y: 120 } }); await d.fill("input[name=title]", "Door swing clashes with island"); await d.click('button:has-text("Pin issue")'); await d.locator("button[data-pin]").first().waitFor();
    await d.goto(`${BASE}/issues`); await see(d, "Pinned on drawing");
    await eng.goto(`${BASE}/site/drawings`); await eng.click("text=Kitchen plan"); await eng.locator("button[data-pin]").first().waitFor();
  });
  await step("Safety: near miss + toolbox talk from the phone; manager closes the report", async () => {
    await sup.goto(`${BASE}/site/safety`); await sup.fill("textarea[name=description]", "Ladder placed on loose bricks"); await sup.click('button:has-text("Submit report")'); await see(sup, "Safety report submitted");
    const tb = sup.locator("details", { hasText: "Record a toolbox talk" }); await tb.locator("summary").click(); await tb.locator("input[name=topic]").fill("Ladder safety"); await tb.locator("input[type=checkbox]").nth(0).check(); await tb.locator("input[type=checkbox]").nth(1).check(); await tb.getByRole("button", { name: "Record toolbox talk" }).click(); await see(sup, "Toolbox talk recorded (2 attendees)");
    await d.goto(`${BASE}/safety`); await see(d, "Ladder placed on loose bricks"); await see(d, "Ladder safety"); await d.fill("input[name=actionsTaken]", "Ladder base secured, briefing held"); await d.click('button:has-text("Close with action taken")'); await see(d, "Closed");
  });
  await step("Compare: same-location photos give a before/after slider and a time-lapse", async () => {
    for (let i = 0; i < 2; i++) { await sup.goto(`${BASE}/site/add-progress?project=${pid}`); await sup.setInputFiles("input[type=file][multiple]", "e2e/site-photo.jpg"); await sup.locator("img[alt=Selected]").waitFor(); await sup.fill('input[placeholder="Block A"]', "Tower 1"); await sup.fill('input[placeholder="Floor 2"]', "Floor 3"); await sup.fill('input[placeholder="Master bedroom"]', "Lobby"); await sup.click('button:has-text("Submit progress")'); await see(sup, "Progress submitted"); }
    await d.goto(`${BASE}/projects/${pid}/compare`); await see(d, "Tower 1 · Floor 3 · Lobby"); await d.locator('input[aria-label="Compare slider"]').waitFor({ state: "attached" }); await d.click('button:has-text("Time-lapse")'); await d.locator('button[aria-label="Play"]').waitFor();
  });
  await step("Client portal: shared link shows only marked photos; revoke kills it", async () => {
    await d.goto(`${BASE}/projects/${pid}`); await d.fill('input[name=label]', "Test client"); await d.click('button:has-text("Create link")'); await see(d, "/share/");
    share = (await d.getByRole("status").first().innerText()).match(/https?:\/\/\S+\/share\/(\S+)/)?.[1]; if (!share) throw new Error("no share link");
    await d.goto(`${BASE}/projects/${pid}/photos`); const ids = await d.locator('main a img[src^="/api/photos/"]').evaluateAll((els) => els.map((e) => e.getAttribute("src").split("/").pop()));
    await d.getByRole("button", { name: "Share", exact: true }).first().click(); await see(d, "Shared ✓");
    const anon = await (await browser.newContext()).newPage(); await anon.goto(`${BASE}/share/${share}`); await see(anon, `Tier1 Villa ${run}`); await gone(anon, "Slab concrete pour");
    const img = anon.locator("img[src^='/api/share/']").first(); await img.waitFor(); const direct = await anon.request.get(BASE + (await img.getAttribute("src"))); if (direct.status() !== 200 || !(direct.headers()["content-type"] ?? "").startsWith("image/")) throw new Error("client photo route returned " + direct.status()); await img.scrollIntoViewIfNeeded(); await anon.waitForFunction(() => [...document.images].some((i) => i.src.includes("/api/share/") && i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const shared = (await img.getAttribute("src")).split("/").pop(), other = ids.find((x) => x !== shared);
    if ((await anon.request.get(`${BASE}/api/share/${share}/photos/${other}`)).status() !== 404) throw new Error("un-shared photo reachable through the client link");
    if ((await anon.request.get(`${BASE}/api/photos/${shared}`)).status() !== 401) throw new Error("internal photo route open to anonymous");
    await d.goto(`${BASE}/projects/${pid}`); await d.click('button:has-text("Revoke")'); await d.waitForTimeout(900);
    if ((await anon.goto(`${BASE}/share/${share}`)).status() !== 404) throw new Error("revoked link still works");
  });
  await step("Handover: warranty tracker and printable Project Passport", async () => {
    await d.goto(`${BASE}/projects/${pid}/handover`); await d.fill("[name=item]", "Roof waterproofing"); await d.click('button:has-text("Add warranty")'); await d.waitForTimeout(900); await d.goto(`${BASE}/projects/${pid}/handover`); await see(d, "days left");
    await d.goto(`${BASE}/projects/${pid}/passport`); await see(d, "Project Passport"); await see(d, "Quality inspections"); await see(d, "Pre-pour check"); await see(d, "Financial data is intentionally excluded"); await see(d, "Roof waterproofing");
  });
  await step("Seeded demo: inspections, safety, pinned drawing, compare and the demo client link", async () => {
    const dm = await mk(); await login(dm, "nick.araujo@coastalindia.demo", "zuari-demo-2026"); await dm.waitForURL("**/dashboard");
    await dm.goto(`${BASE}/inspections`); await see(dm, "Pass rate"); await see(dm, "Plumbing pressure test"); await dm.goto(`${BASE}/safety`); await see(dm, "Days without incident"); await see(dm, "Open trench");
    await dm.goto(`${BASE}/projects`); const href = await dm.locator('a:has-text("Dona Paula Villa")').first().getAttribute("href");
    await dm.goto(`${BASE}${href}/compare`); await see(dm, "Main house · Ground floor · Living room"); await dm.goto(`${BASE}${href}/handover`); await see(dm, "Waterproofing — terrace"); await see(dm, "Expires in");
    await dm.goto(`${BASE}/drawings`); await dm.locator("div.rounded-xl", { hasText: "Ground floor plan" }).filter({ hasText: "Dona Paula Villa" }).first().locator('a:has-text("View & pin issues")').click(); await dm.locator("button[data-pin]").first().waitFor();
    const anon = await (await browser.newContext()).newPage(); await anon.goto(`${BASE}/share/demo-client-link-dona-paula-villa-2026-0000000000`); await see(anon, "Dona Paula Villa"); await anon.locator("img[src^='/api/share/']").first().waitFor();
  });
} finally {
  await browser.close(); stub.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.includes(0) ? 1 : 0);
}
