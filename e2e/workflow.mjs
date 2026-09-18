// End-to-end acceptance test: office → site → office, plus tenant-isolation checks.
// Run with the dev server up:  node e2e/workflow.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100";
const run = Date.now().toString(36);
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(["✓", name]); console.log("✓", name); } catch (e) { results.push(["✗", name]); console.log("✗", name, "\n   ", String(e.message).split("\n")[0]); throw e; } };
const expectText = (p, t, o = {}) => p.getByText(t).locator("visible=true").first().waitFor({ timeout: 8000, ...o });

const browser = await chromium.launch({ channel: "chrome" });
const office = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const phone = await phoneCtx.newPage();
let supEmail, supPass, projectId;
const errors = [];
for (const p of [office, phone]) p.on("pageerror", (e) => errors.push(e.message));

try {
  await step("Director signs up and creates a company", async () => {
    await office.goto(`${BASE}/signup`);
    await office.fill('[name=companyName]', `E2E Builders ${run}`);
    await office.fill('[name=name]', "Dana Director");
    await office.fill('[name=email]', `dana.${run}@e2e.test`);
    await office.fill('[name=password]', "correct-horse-battery");
    await office.click('button:has-text("Create workspace")');
    await office.waitForURL("**/dashboard");
    await expectText(office, "Good ");
  });
  await step("Empty dashboard shows an empty state, not fake data", async () => { await expectText(office, "No projects yet"); });
  await step("Director creates a project", async () => {
    await office.goto(`${BASE}/projects/new`);
    await office.fill('[name=name]', `E2E Villa ${run}`);
    await office.fill('[name=client]', "Test Client");
    await office.fill('[name=location]', "Porvorim, Goa");
    await office.fill('[name=budget]', "12000000");
    await office.click('button:has-text("Create project")');
    await office.waitForURL(/\/projects\/(?!new)[a-z0-9]+$/);
    projectId = office.url().split("/").pop();
    await expectText(office, `E2E Villa ${run}`);
  });
  await step("Director adds a site supervisor to the project", async () => {
    await office.goto(`${BASE}/projects/${projectId}/team`);
    supEmail = `sam.${run}@e2e.test`;
    await office.fill('[name=name]', "Sam Supervisor");
    await office.fill('[name=email]', supEmail);
    await office.click('button:has-text("Create account")');
    const msg = await office.getByRole("status").first().innerText();
    supPass = msg.match(/password (\S+)/)?.[1];
    if (!supPass) throw new Error("no generated password in: " + msg);
  });
  await step("Director creates and assigns a task", async () => {
    await office.goto(`${BASE}/projects/${projectId}/tasks`);
    await office.click('summary:has-text("Create task")');
    await office.fill('[name=title]', "Electrical conduit — Floor 2");
    await office.selectOption('[name=phaseId]', { label: "Electrical" });
    await office.selectOption('[name=assigneeId]', { label: 'Sam Supervisor · Site Supervisor' });
    await office.fill('[name=dueDate]', new Date().toISOString().slice(0, 10));
    await office.click('button:has-text("Create task")');
    await expectText(office, "Task created");
  });

  await step("Supervisor signs in on the phone and lands on ZUARI Site", async () => {
    await phone.goto(`${BASE}/login`);
    await phone.fill('[name=email]', supEmail); await phone.fill('[name=password]', supPass);
    await phone.click('button:has-text("Sign in")');
    await phone.waitForURL("**/site");
    await expectText(phone, "Good ");
  });
  await step("Supervisor sees the assigned task and notification", async () => {
    await expectText(phone, "Electrical conduit — Floor 2");
    await phone.goto(`${BASE}/site/notifications`);
    await expectText(phone, "New task assigned");
  });
  await step("Supervisor updates the task: status + photo + note", async () => {
    await phone.goto(`${BASE}/site/tasks`);
    await phone.click('text=Electrical conduit — Floor 2');
    await phone.click('text=Update this task');
    await phone.setInputFiles('input[type=file][multiple]', "e2e/site-photo.jpg");
    await phone.locator('img[alt=Selected]').waitFor();
    await phone.click('button:has-text("In progress")');
    await phone.fill('textarea', "Conduits fixed in bedrooms 1 and 2.");
    await phone.click('button:has-text("Submit progress")');
    await expectText(phone, "Progress submitted");
  });
  await step("Supervisor reports an issue with a photo", async () => {
    await phone.goto(`${BASE}/site/report-issue`);
    await phone.fill('input[placeholder^="e.g."]', "Water leakage — Floor 2");
    await phone.click('button:has-text("High")');
    await phone.setInputFiles('input[type=file][multiple]', "e2e/site-photo.jpg");
    await phone.locator('img[alt=Selected]').waitFor();
    await phone.click('button:has-text("Report issue")');
    await expectText(phone, "Issue reported");
  });
  await step("Supervisor submits a site update", async () => {
    await phone.goto(`${BASE}/site/site-update`);
    await phone.click('button[aria-label="More workers"]', { clickCount: 3 });
    await phone.fill('textarea >> nth=0', "Slab shuttering completed.");
    await phone.click('button:has-text("Submit update")');
    await expectText(phone, "Site update submitted");
  });

  await step("Manager sees the updated task and progress", async () => {
    await office.goto(`${BASE}/projects/${projectId}/tasks`);
    await expectText(office, "Electrical conduit — Floor 2");
    if (!(await office.locator('select[name=status]').first().inputValue()).includes("IN_PROGRESS")) throw new Error("task status not updated");
    await office.goto(`${BASE}/projects/${projectId}`);
    const pct = await office.locator('h1 ~ div p.tabular-nums, p.text-5xl').first().innerText();
    if (/^0/.test(pct.trim())) throw new Error("project progress still 0: " + pct);
  });
  await step("Manager sees the progress photo (real image loads)", async () => {
    await office.goto(`${BASE}/projects/${projectId}/photos`);
    const img = office.locator('img[src^="/api/photos/"]').first();
    await img.waitFor();
    if (!(await img.evaluate((i) => i.complete && i.naturalWidth > 0))) throw new Error("image did not load");
    await expectText(office, "Electrical conduit — Floor 2");
  });
  await step("Manager sees the issue, activity feed and site update", async () => {
    await office.goto(`${BASE}/projects/${projectId}/issues`); await expectText(office, "Water leakage — Floor 2");
    await office.goto(`${BASE}/projects/${projectId}`);
    await expectText(office, "uploaded 1 progress photo"); await expectText(office, "New issue reported");
    await office.goto(`${BASE}/projects/${projectId}/site`); await expectText(office, "Slab shuttering completed.");
  });
  await step("Director is notified", async () => { await office.goto(`${BASE}/notifications`); await expectText(office, "Issue reported"); });

  // ── Isolation & authorization ─────────────────────────────────
  const demo = await (await browser.newContext()).newPage();
  await step("Demo company A user cannot open the E2E company's project or photos", async () => {
    await demo.goto(`${BASE}/login`);
    await demo.fill('[name=email]', "nick.araujo@coastalindia.demo"); await demo.fill('[name=password]', "zuari-demo-2026");
    await demo.click('button:has-text("Sign in")'); await demo.waitForURL("**/dashboard");
    const r = await demo.goto(`${BASE}/projects/${projectId}`);
    if (r.status() !== 404) throw new Error("expected 404, got " + r.status());
    await office.goto(`${BASE}/projects/${projectId}/photos`);
    const photoUrl = await office.locator('img[src^="/api/photos/"]').first().getAttribute("src");
    const pr = await demo.request.get(BASE + photoUrl);
    if (pr.status() !== 404) throw new Error("cross-tenant photo status " + pr.status());
  });
  await step("Supervisors are kept off the desktop app and see only their own tasks", async () => {
    await phone.goto(`${BASE}/dashboard`); await phone.waitForURL("**/site");
    const sup = await (await browser.newContext()).newPage();
    await sup.goto(`${BASE}/login`); await sup.fill('[name=email]', "carlos.fernandes@coastalindia.demo"); await sup.fill('[name=password]', "zuari-demo-2026");
    await sup.click('button:has-text("Sign in")'); await sup.waitForURL("**/site");
    await sup.goto(`${BASE}/site/tasks`);
    const body = await sup.locator("body").innerText();
    if (body.includes("Carpentry and joinery") || body.includes("Piling")) throw new Error("supervisor sees unassigned/other-project tasks");
    await expectText(sup, "Electrical Installation");
  });
} finally {
  await browser.close();
  console.log(errors.length ? `\nPage errors: ${errors.join(" | ")}` : "\nNo uncaught page errors.");
  const fails = results.filter((r) => r[0] === "✗").length;
  console.log(`\n${results.length - fails}/${results.length} steps passed`);
  process.exit(fails ? 1 : 0);
}
