// One-off visual/interaction verification (not part of the app).
// First asserts the landing page at "/" (hero + live stats + CTA -> /dashboard),
// then drives the dark live-ops console at "/dashboard" (app/dashboard/page.tsx)
// with real selectors:
//   - dotted world map = <svg> of <rect> pixels; selection glow = <circle>s
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

// --- Landing page at / (hero backdrop + headline + live stats + CTA) ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page
  .locator("h1", { hasText: "Web traffic, in real time" })
  .first()
  .waitFor({ state: "visible", timeout: 15000 });
await page.waitForTimeout(2000);
const landingHeadline = await page.locator("h1").first().innerText().catch(() => "?");
const landingTotal = await page
  .locator("h2", { hasText: "Total sessions" })
  .first()
  .locator("xpath=following-sibling::div[1]")
  .innerText()
  .catch(() => "?");
const landingMapPixels = await page.locator("main svg rect").count();
const cta = page.locator('a[href="/dashboard"]', { hasText: /Enter the console/i });
log("landing headline:", landingHeadline.replace(/\s+/g, " ").trim());
log("landing total sessions:", landingTotal, "| map pixels:", landingMapPixels);
log("landing CTA -> /dashboard:", (await cta.count()) ? "present" : "MISSING");
await page.screenshot({ path: `${OUT}/landing-full.png`, fullPage: true });
log("saved landing-full.png");

// --- Console at /dashboard (full existing assertions below) ---
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
// Wait for the console to finish loading (the "Loading console…" splash is gone)
// and let the scramble-in + map entrance animations settle.
await page.waitForFunction(() => !document.body.innerText.includes("Loading console"), {
  timeout: 15000,
});
await page.waitForTimeout(2000);

// Full page screenshot
await page.screenshot({ path: `${OUT}/console-full.png`, fullPage: true });
log("saved console-full.png");

// Map rendered: dotted-pixel SVG (static + animated <rect>).
const mapPixels = await page.locator("main svg rect").count();
log("map pixels:", mapPixels);

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

// Select a country from the "Top countries by sessions" list — the interaction
// now lives on that list, not the map. Each row is a <button aria-pressed>;
// hovering/focusing it opens the side `CountryPanel` and glows that country on
// the map. Two lists exist (hidden mobile + visible wide layout); target the
// visible one. The panel shows a "<country> N sessions" header, a skeleton
// loader, then real KPI numerals + sparklines + Devices/Channels/Top
// referrers/Top pages bar charts.
const rows = page.locator("button[aria-pressed]").locator("visible=true");
log("country list rows (visible):", await rows.count());
await rows.first().hover();
await page.waitForTimeout(120);
await page.screenshot({ path: `${OUT}/geo-panel-loading.png` });

// Panel card = the unique shadow-2xl wrapper. Wait for real data to land.
const panel = page.locator("div.shadow-2xl").first();
await panel
  .getByText("Top referrers", { exact: true })
  .waitFor({ state: "visible", timeout: 8000 })
  .catch(() => {});
await page.waitForTimeout(900);
const headerText = await page
  .locator("span", { hasText: /\d\s+sessions$/ })
  .first()
  .innerText()
  .catch(() => "?");
const panelLabels = await panel
  .getByText(
    /^(Duration|Time \/ page|Unique PV|Devices|Channels|Top referrers|Top pages \(bounce\))$/,
  )
  .count();
const glow = await page.locator('[data-testid="country-glow"]').count();
log("panel header:", headerText.replace(/\s+/g, " ").trim());
log("panel section labels:", panelLabels, panelLabels >= 7 ? "(ok)" : "(LOW)");
log("map glow circles (selection ring):", glow, glow >= 1 ? "(ok)" : "(none)");
await page.screenshot({ path: `${OUT}/geo-panel.png` });
log("saved geo-panel.png");

// Re-select after moving away: the per-country cache should replay instantly
// (content present within ~150ms, no loader re-flash).
await page.mouse.move(5, 5);
await page.waitForTimeout(250);
await rows.first().hover().catch(() => {});
await page.waitForTimeout(150);
const reHover = await page
  .locator("div.shadow-2xl")
  .first()
  .getByText(/^(Duration|Devices|Channels)$/)
  .count();
log("re-select (cached) labels visible quickly:", reHover, reHover >= 3 ? "(ok)" : "(slow)");

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
