// End-to-end playthrough: npm run dev, then node tests/e2e-play.mjs [COUNTRY]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const country = process.argv[2] || "VNM";
const names = { VNM: "Viet Nam", BRA: "Brazil", GHA: "Ghana", IND: "India", KEN: "Kenya", DEU: "Germany", PER: "Peru", ETH: "Ethiopia", NGA: "Nigeria" };
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: Number(process.env.WIDTH || 1440), height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const GREEDY = !!process.env.GREEDY; // pick the temptation every turn
const tag = GREEDY ? "greedy-" : "";
const shot = (n) => page.screenshot({ path: `output/${tag}${country}-${n}.png`, fullPage: true });
await page.goto(BASE);
await page.waitForSelector("text=Proof that change is possible", { timeout: 60000 });
await page.waitForTimeout(900);
await shot("1-landing");
await page.getByRole("button", { name: "Make your move" }).click();
await page.waitForSelector("text=countries from the World Bank", { timeout: 60000 });
await page.fill('input[aria-label="Search countries"]', names[country]);
await page.getByRole("button", { name: names[country], exact: true }).click();
await page.waitForSelector("text=Take office in", { timeout: 180000 });
await shot("2-setup");
await page.getByRole("button", { name: "Take office" }).click();
await page.waitForSelector("text=National briefing", { timeout: 180000 });
await shot("3-briefing");
await page.getByRole("button", { name: "Begin turn 1" }).click();
let turn = 1;
try {
for (turn = 1; turn <= 10; turn++) {
  await page.getByRole("button", { name: /Face this turn/ }).click();
  if (turn === 1) await shot("4-decision");
  if (await page.getByText("Consult the advisor").count()) throw new Error("The AI advisor should be removed");
  if (!(await page.getByText("Why here:").count())) throw new Error("Options should explain why they fit the country");
  const tempting = page.locator('[data-harmful="true"]:not([disabled])');
  if (!(await page.locator('[data-harmful="true"]').count())) throw new Error("Each turn should mix in a disguised harmful option");
  if (await page.getByText("Temptation", { exact: false }).count()) throw new Error("Harmful options must not be labeled before choosing");
  if (await page.locator('textarea[aria-label="Write your own policy"]').count()) throw new Error("Write-your-own policy should be removed");
  const choseHarmful = GREEDY && (await tempting.count()) > 0;
  if (choseHarmful) await tempting.first().click();
  else {
    const options = page.locator("[data-policy]:not([disabled])");
    const n = await options.count();
    if (!n) throw new Error("No affordable policy on turn " + turn);
    await options.nth(turn % n).click();
  }
  await page.waitForTimeout(300);
  if (turn === 1) await shot("5-consequence");
  if (choseHarmful && !(await page.getByText("The fine print").count())) throw new Error("Harmful choices should reveal their fine print after enacting");
  if (choseHarmful && turn === 1) await shot("5b-fine-print");
  await page.getByRole("button", { name: "See how the world reacts" }).click();
  await page.waitForSelector("text=Political news", { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes("In the real ") || document.body.innerText.includes("has no data for these years"), null, { timeout: 120000 });
  if (turn === 1 || turn === 6) await shot(`6-reaction-t${turn}`);
  await page.getByRole("button", { name: turn === 10 ? "Reveal history" : /Advance to/ }).click();
  if (turn === 2) await shot("7-briefing-t3");
}
} catch (e) {
  await shot("fail");
  console.log("FAILED on turn", turn, e.message.split("\n")[0], "errors:", errors);
  await browser.close();
  process.exit(1);
}
await page.waitForSelector("text=History Delta", { timeout: 180000 });
await page.waitForSelector("text=Your chronicle", { timeout: 60000 });
await page.waitForTimeout(800);
await shot("8-reveal");
if (!(await page.getByText("Humanity's next move is yours").count())) throw new Error("The reveal should close with the game's message");
if (GREEDY && !(await page.getByText("hidden accounts").count())) throw new Error("The reveal should report the hidden fortune");
console.log("title:", await page.locator("h1").first().textContent());
console.log("errors:", errors.length ? errors : "none");
await browser.close();
