// End-to-end playthrough: npm run dev, then node tests/e2e-play.mjs [COUNTRY]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const country = process.argv[2] || "VNM";
const names = { VNM: "Viet Nam", BRA: "Brazil", GHA: "Ghana", IND: "India", KEN: "Kenya", DEU: "Germany", PER: "Peru", ETH: "Ethiopia" };
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: Number(process.env.WIDTH || 1440), height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `output/${country}-${n}.png`, fullPage: true });
await page.goto(BASE);
await shot("1-landing");
await page.getByRole("button", { name: "Choose your nation" }).click();
await page.waitForSelector("text=countries from the World Bank", { timeout: 60000 });
await page.fill('input[aria-label="Search countries"]', names[country]);
await page.getByRole("button", { name: names[country], exact: true }).click();
await page.waitForSelector("text=Take office in", { timeout: 180000 });
await page.fill("#seed", "judge-demo-1");
await shot("2-setup");
await page.getByRole("button", { name: "Take office" }).click();
await page.waitForSelector("text=National briefing", { timeout: 180000 });
await shot("3-briefing");
await page.getByRole("button", { name: "Begin turn 1" }).click();
let turn = 1;
try {
for (turn = 1; turn <= 10; turn++) {
  await page.getByRole("button", { name: /Face this turn/ }).click();
  if (turn === 1) {
    await page.getByRole("button", { name: "Consult the advisor" }).click();
    await page.waitForSelector("text=Recommendation:", { timeout: 60000 });
    await shot("4-decision");
  }
  const options = page.locator("[data-policy]:not([disabled])");
  const n = await options.count();
  if (!n) throw new Error("No affordable policy on turn " + turn);
  await options.nth(turn % n).click();
  await page.waitForTimeout(300);
  if (turn === 1) await shot("5-consequence");
  await page.getByRole("button", { name: "See how the world reacts" }).click();
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
await page.waitForSelector("text=AI advisor's timeline", { timeout: 60000 });
await page.waitForFunction(() => !document.body.innerText.includes("AI is playing turn"), null, { timeout: 180000 });
await page.waitForTimeout(800);
await shot("8-reveal");
console.log("title:", await page.locator("h1").first().textContent());
console.log("errors:", errors.length ? errors : "none");
await browser.close();
