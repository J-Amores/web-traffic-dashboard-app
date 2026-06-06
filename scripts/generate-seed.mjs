// Generate the synthetic web-analytics seed straight into Neon.
//
//   node --env-file=.env.local scripts/generate-seed.mjs
//
// Drops the legacy `social_media_posts` table, (re)creates `web_sessions`, and
// inserts ~80k session rows (~5k/month across 16 months) whose aggregates
// reproduce the proportions and headline metrics in the design/ mockups:
//   Total Sessions ≈ 5k/mo, Session Duration ≈ 52s, Unique Pageviews ≈ 1.3,
//   Time on Page ≈ 29s. Device mix Desktop 64% / Mobile 31% / Tablet 5%.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// --- Dimension catalogs (weights need not sum to 1; picker normalizes) -------

const DEVICES = [
  ["Desktop", 0.64],
  ["Mobile", 0.31],
  ["Tablet", 0.05],
];

const CHANNELS = [
  ["Social", 0.26],
  ["Direct", 0.22],
  ["Organic Search", 0.18],
  ["Referral", 0.15],
  ["Paid Search", 0.11],
  ["Display", 0.08],
];

// Referral sites, each tied to a natural medium. source_medium = `source / medium`.
const SOURCES = [
  ["notepage.net", "Referral", 0.16],
  ["google.com", "Organic", 0.15],
  ["indiegogo.com", "Referral", 0.12],
  ["t-shop.com", "Referral", 0.1],
  ["theguardian.com", "Referral", 0.09],
  ["amazon.co.jp", "Referral", 0.08],
  ["vise.com", "Referral", 0.07],
  ["facebook.com", "Social", 0.07],
  ["bing.com", "Organic", 0.05],
  ["ftrapponline.com", "CPC", 0.05],
  ["vsstores.co.jp", "Referral", 0.04],
  ["(direct)", "Direct", 0.02],
];

// Country -> weight. Centroids live in lib/geo.ts (kept in sync with this list).
const COUNTRIES = [
  ["United States", 0.22],
  ["United Kingdom", 0.12],
  ["Germany", 0.09],
  ["France", 0.07],
  ["Italy", 0.06],
  ["Spain", 0.06],
  ["Japan", 0.06],
  ["China", 0.06],
  ["India", 0.06],
  ["Brazil", 0.05],
  ["Mexico", 0.04],
  ["Canada", 0.04],
  ["Australia", 0.03],
  ["United Arab Emirates", 0.03],
  ["Netherlands", 0.02],
  ["South Korea", 0.02],
];

const PAGES = [
  ["Home", "/"],
  ["Pricing", "/pricing"],
  ["Product Tour", "/product"],
  ["Blog", "/blog"],
  ["Docs", "/docs"],
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Careers", "/careers"],
];
// descending popularity weights for the 8 pages
const PAGE_WEIGHTS = [0.3, 0.18, 0.14, 0.11, 0.09, 0.07, 0.06, 0.05];

// --- RNG helpers -------------------------------------------------------------

function pick(catalog) {
  const total = catalog.reduce((s, c) => s + c[c.length - 1], 0);
  let r = Math.random() * total;
  for (const c of catalog) {
    r -= c[c.length - 1];
    if (r <= 0) return c;
  }
  return catalog[catalog.length - 1];
}

function pickPage() {
  const total = PAGE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PAGES.length; i++) {
    r -= PAGE_WEIGHTS[i];
    if (r <= 0) return PAGES[i];
  }
  return PAGES[PAGES.length - 1];
}

// Box-Muller normal.
function normal(mean, sd) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function uuid() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pad = (n) => String(n).padStart(2, "0");

// --- Month plan: 16 months ending 2025-04, mild upward session trend ---------

const MONTHS = (() => {
  const out = [];
  // anchor last month = 2025-04
  let y = 2024,
    m = 1; // 2024-01
  for (let i = 0; i < 16; i++) {
    out.push([y, m]);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out; // 2024-01 .. 2025-04
})();

// Per-metric monthly multipliers (random walk) so deltas differ per KPI and the
// latest-vs-prior month change is non-trivial (some up, some down) like the mockup.
function walk(base, steps, vol) {
  const arr = [];
  let v = base;
  for (let i = 0; i < steps; i++) {
    v *= 1 + normal(0, vol);
    arr.push(v);
  }
  return arr;
}
const durMul = walk(1, 16, 0.06); // session duration drift
const tonMul = walk(1, 16, 0.06); // time-on-page drift

// Base sessions/month grows ~4300 -> ~5500 (sum ≈ 80k).
function sessionsForMonth(idx) {
  const grow = 4300 + idx * 80; // linear-ish growth
  return Math.round(grow * (1 + normal(0, 0.03)));
}

// --- Row generation ----------------------------------------------------------

function buildRow(year, month, monthIdx) {
  // random day/time within the month
  const day = 1 + Math.floor(Math.random() * 28);
  const hh = Math.floor(Math.random() * 24);
  const mm = Math.floor(Math.random() * 60);
  const ss = Math.floor(Math.random() * 60);
  const ts = `${year}-${pad(month)}-${pad(day)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;

  const [device] = pick(DEVICES);
  const [channel] = pick(CHANNELS);
  const [source, medium] = pick(SOURCES);
  const [country] = pick(COUNTRIES);
  const [pageTitle, pagePath] = pickPage();

  // Mobile sessions are shorter; desktop longer.
  const devFactor = device === "Desktop" ? 1.25 : device === "Mobile" ? 0.8 : 0.95;
  const duration = Math.max(
    1,
    Math.round(normal(52, 34) * devFactor * durMul[monthIdx])
  );
  const timeOnPage = Math.max(
    0,
    Math.round(normal(29, 18) * devFactor * tonMul[monthIdx])
  );

  // pageviews: mostly 1, sometimes more; unique <= pageviews, avg ≈ 1.3.
  const pageviews = 1 + (Math.random() < 0.32 ? 1 : 0) + (Math.random() < 0.08 ? 1 : 0);
  const unique = Math.max(1, Math.min(pageviews, 1 + (Math.random() < 0.3 ? 1 : 0)));

  // Bounce more likely on Social/Display and single-pageview sessions.
  const bounceBias =
    (channel === "Social" || channel === "Display" ? 0.15 : 0) +
    (pageviews === 1 ? 0.2 : -0.15);
  const bounce = Math.random() < 0.4 + bounceBias ? 1 : 0;

  return [
    uuid(),
    ts,
    device,
    channel,
    source,
    medium,
    country,
    pageTitle,
    pagePath,
    duration,
    pageviews,
    unique,
    timeOnPage,
    bounce,
  ];
}

const COLS = [
  "session_id",
  "timestamp",
  "device_category",
  "channel",
  "source",
  "medium",
  "country",
  "page_title",
  "page_path",
  "session_duration_s",
  "pageviews",
  "unique_pageviews",
  "time_on_page_s",
  "bounce",
];

async function main() {
  console.log("Dropping legacy table + recreating web_sessions…");
  await sql`DROP TABLE IF EXISTS social_media_posts`;
  await sql`DROP TABLE IF EXISTS web_sessions`;
  await sql`
    CREATE TABLE web_sessions (
      session_id          TEXT,
      "timestamp"         TIMESTAMP,
      device_category     TEXT,
      channel             TEXT,
      source              TEXT,
      medium              TEXT,
      country             TEXT,
      page_title          TEXT,
      page_path           TEXT,
      session_duration_s  INTEGER,
      pageviews           INTEGER,
      unique_pageviews    INTEGER,
      time_on_page_s      INTEGER,
      bounce              INTEGER
    )`;

  // Build all rows.
  const rows = [];
  MONTHS.forEach(([y, m], idx) => {
    const n = sessionsForMonth(idx);
    for (let i = 0; i < n; i++) rows.push(buildRow(y, m, idx));
  });
  console.log(`Generated ${rows.length} rows. Inserting…`);

  // Batched multi-row INSERT (1000 rows/statement → ~14k params, < 65535 limit).
  const BATCH = 1000;
  const colList = COLS.map((c) => (c === "timestamp" ? '"timestamp"' : c)).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = chunk.map((row) => {
      const ph = row.map((_, j) => `$${params.length + j + 1}`);
      params.push(...row);
      return `(${ph.join(", ")})`;
    });
    const text = `INSERT INTO web_sessions (${colList}) VALUES ${tuples.join(", ")}`;
    await sql(text, params);
    process.stdout.write(`\r  inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");

  console.log("Creating indexes…");
  await sql`CREATE INDEX idx_ws_timestamp ON web_sessions ("timestamp")`;
  await sql`CREATE INDEX idx_ws_device ON web_sessions (device_category)`;
  await sql`CREATE INDEX idx_ws_channel ON web_sessions (channel)`;
  await sql`CREATE INDEX idx_ws_source ON web_sessions (source)`;
  await sql`CREATE INDEX idx_ws_country ON web_sessions (country)`;
  await sql`CREATE INDEX idx_ws_page ON web_sessions (page_title)`;
  await sql`CREATE INDEX idx_ws_medium ON web_sessions (medium)`;

  // Sanity summary.
  const [agg] = await sql`
    SELECT COUNT(*)::int AS rows,
           ROUND(AVG(session_duration_s)::numeric, 1) AS avg_dur,
           ROUND(AVG(unique_pageviews)::numeric, 2) AS avg_upv,
           ROUND(AVG(time_on_page_s)::numeric, 1) AS avg_top,
           ROUND(AVG(bounce)::numeric, 3) AS bounce_rate,
           MIN("timestamp")::text AS min_ts, MAX("timestamp")::text AS max_ts
    FROM web_sessions`;
  console.log("Done.", agg);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
