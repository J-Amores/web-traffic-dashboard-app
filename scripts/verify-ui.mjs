// One-off visual/interaction verification (not part of the app).
// Drives the dark live-ops console at app/page.tsx with real selectors:
//   - dotted world map = <svg> of <rect> pixels; hotspots = transparent rects
//   - big numerals scramble in via useScramble (~1.2s) -> .tabular-nums
//   - KPI trend = MiniSpark wrapper div.cursor-crosshair (inner svg is aria-hidden)
//   - StatCard info-flip = button[aria-label^="Learn more about"]
// There is NO period switcher in this build; the page client-fetches ?period=all.
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
// Wait for the console to finish loading (the "Loading console…" splash is gone)
// and let the scramble-in + map entrance animations settle.
await page.waitForFunction(() => !document.body.innerText.includes("Loading console"), {
  timeout: 15000,
});
await page.waitForTimeout(2000);

// Full page screenshot
await page.screenshot({ path: `${OUT}/console-full.png`, fullPage: true });
log("saved console-full.png");

// Map rendered: dotted-pixel SVG (static + animated <rect>) + transparent hotspots.
const mapPixels = await page.locator("main svg rect").count();
const hotspots = await page.locator('main svg rect[fill="transparent"]').count();
log("map pixels:", mapPixels, " hotspots:", hotspots);

// Hero numeral present and settled (Total sessions). Two "Total sessions"
// headings exist (hidden mobile layout + visible wide layout); pick visible.
const totalSessions = await page
  .locator("h2", { hasText: "Total sessions" })
  .locator("visible=true")
  .first()
  .locator("xpath=following-sibling::div[1]")
  .innerText()
  .catch(() => "?");
log("total sessions:", totalSessions);

// KPI cards by title.
for (const title of ["Session Duration", "Avg Time on Page", "Avg Unique Pageviews"]) {
  const count = await page.locator("h2", { hasText: title }).count();
  log(`KPI card "${title}":`, count ? "present" : "MISSING");
}

// Hover the first KPI sparkline -> month/value tooltip appears.
const spark = page.locator("div.cursor-crosshair").first();
const sbox = await spark.boundingBox();
if (sbox) {
  await page.mouse.move(sbox.x + sbox.width * 0.6, sbox.y + sbox.height / 2);
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}/hover-sparkline.png` });
log("saved hover-sparkline.png  (sparklines found:", await page.locator("div.cursor-crosshair").count(), ")");

// Hover a map hotspot -> country tooltip ("… sessions").
const firstHotspot = page.locator('main svg rect[fill="transparent"]').first();
const hbox = await firstHotspot.boundingBox();
if (hbox) {
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
  await page.waitForTimeout(400);
}
const mapTip = await page.locator("text=/sessions$/").count();
log("map hover tooltip nodes:", mapTip);
await page.screenshot({ path: `${OUT}/geo-map.png` });
log("saved geo-map.png");

// Click a StatCard info button -> PixelGridTransition info-flip.
const infoBtn = page.locator('button[aria-label^="Learn more about"]').first();
if (await infoBtn.count()) {
  await infoBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/info-flip.png` });
  log("saved info-flip.png  (info buttons:", await page.locator('button[aria-label^="Learn more about"]').count(), ")");
}

// List cards present.
for (const title of ["Traffic Channels", "Devices", "Top Referrers", "Most-Visited Pages"]) {
  const count = await page.locator("h2", { hasText: title }).count();
  log(`list card "${title}":`, count ? "present" : "MISSING");
}

const bannerText = await page.locator("header p").first().innerText().catch(() => "?");
log("banner:", bannerText.replace(/\s+/g, " ").trim());

log("console errors:", errors.length ? errors : "none");
await browser.close();
