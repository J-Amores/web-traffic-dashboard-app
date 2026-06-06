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

// Hover a map hotspot -> country mini-dashboard PANEL.
// The panel (`CountryPanel`) mounts in <main>, shows a "<country> N sessions"
// header + colored bullet, a skeleton loader, then settles to real KPI numerals
// + Devices/Channels/Top referrers/Top pages lists. Hotspots are tiny (18px)
// transparent <rect>s; many countries' anchor dots project off-screen, so we
// iterate until a hover lands on one whose panel actually opens.
const hotspotLoc = page.locator('main svg rect[fill="transparent"]');
const hotspotN = await hotspotLoc.count();
let openedAt = -1;
let panelCountry = "?";
for (let i = 0; i < hotspotN; i++) {
  try {
    await hotspotLoc.nth(i).hover({ timeout: 800 });
  } catch {
    continue; // off-screen / zero-box hotspot
  }
  await page.waitForTimeout(120);
  if ((await page.getByText("Top referrers", { exact: true }).count()) > 0) {
    openedAt = i;
    break;
  }
}
log("country panel opened on hotspot index:", openedAt);
// Let the per-country fetch resolve and the numerals settle.
await page.waitForTimeout(1200);
const panel = page.locator("div.z-20").filter({ hasText: "sessions" }).first();
panelCountry = (await panel.innerText().catch(() => "?"))
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 80);
const panelLabels = await page
  .locator("main")
  .getByText(/^(Duration|Time \/ page|Unique PV|Devices|Channels|Top referrers|Top pages)$/)
  .count();
log("country panel header+kpis:", panelCountry);
log("country panel section labels:", panelLabels, panelLabels >= 7 ? "(ok)" : "(LOW)");
await page.screenshot({ path: `${OUT}/geo-panel.png` });
log("saved geo-panel.png");

// Re-hover the SAME hotspot after moving away: the per-country cache should
// replay instantly (panel content present within ~150ms, no loader re-flash).
if (openedAt >= 0) {
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  await hotspotLoc.nth(openedAt).hover({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(150);
  const reHover = await page
    .locator("main")
    .getByText(/^(Duration|Devices|Channels)$/)
    .count();
  log("re-hover (cached) labels visible quickly:", reHover, reHover >= 3 ? "(ok)" : "(slow)");
}

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
