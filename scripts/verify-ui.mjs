// One-off visual/interaction verification (not part of the app).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/Users/jamores/Desktop/Claude-Code/projects/web-traffic-dashboard-app/.screenshots";
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE || "http://localhost:3000";
const log = (...a) => console.log("[verify]", ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1600); // let entrance animations settle

// Full page screenshot
await page.screenshot({ path: `${OUT}/cockpit-full.png`, fullPage: true });
log("saved cockpit-full.png");

// Verify a real map rendered (rsm injects <path class="rsm-geography">)
const geoPaths = await page.locator("path.rsm-geography").count();
const bubbles = await page.locator("g.rsm-marker circle").count();
log("map country paths:", geoPaths, " bubbles:", bubbles);

// KPI values present
const kpiText = await page.locator(".tnum").first().innerText().catch(() => "?");
log("first KPI value:", kpiText);

// Hover a referral-site bar -> tooltip. Bars live inside the "Top referral sites" panel.
const referralPanel = page.locator("section").filter({ hasText: "Top referral sites" });
const firstBar = referralPanel.locator(".bg-accent-grad").first();
const barBox = await firstBar.boundingBox();
if (barBox) {
  await page.mouse.move(barBox.x + barBox.width * 0.5, barBox.y + barBox.height / 2);
  await page.waitForTimeout(400);
}
const barTip = await referralPanel.locator(".bg-ink").count();
log("referral bar tooltip nodes:", barTip);
await page.screenshot({ path: `${OUT}/hover-bar.png` });
log("saved hover-bar.png");

// Hover the featured KPI sparkline
const spark = page.locator("svg[aria-label='Trend sparkline']").first();
const sbox = await spark.boundingBox();
if (sbox) {
  await page.mouse.move(sbox.x + sbox.width * 0.6, sbox.y + sbox.height / 2);
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}/hover-sparkline.png` });
log("saved hover-sparkline.png");

// Hover a geo bubble
const firstBubble = page.locator("g.rsm-marker circle").first();
const bbox = await firstBubble.boundingBox();
if (bbox) {
  await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  await page.waitForTimeout(300);
}
await page.locator("text=Where does the traffic come from?").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/geo-map.png` });
log("saved geo-map.png");

// Switch period to 6M and confirm URL + refetch
const kpiBefore = await page.locator(".tnum").nth(2).innerText().catch(() => "?");
await page.getByTitle("Last 6 months").click();
await page.waitForTimeout(1500);
const url = page.url();
const kpiAfter = await page.locator(".tnum").nth(2).innerText().catch(() => "?");
log("after 6M click, url:", url, "| KPI before:", kpiBefore, "after:", kpiAfter);
await page.screenshot({ path: `${OUT}/cockpit-6m.png`, fullPage: true });
log("saved cockpit-6m.png");

const bannerText = await page.locator("header p").first().innerText().catch(() => "?");
log("banner:", bannerText);

log("console errors:", errors.length ? errors : "none");
await browser.close();
