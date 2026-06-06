// Smoke test: hits every endpoint against an already-running server and
// asserts 200 + key sanity invariants. Run AFTER `next build && next start`
// (or `next dev`). Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
//
// Exits non-zero on the first failure.

const BASE = process.env.BASE ?? "http://localhost:3000";

const ROUTES = [
  "/api/health",
  "/api/kpis",
  "/api/breakdown/devices",
  "/api/breakdown/referrers",
  "/api/breakdown/channels",
  "/api/geo",
  "/api/pages",
  "/api/top-performers?metric=sessions&dimension=sourceMedium",
  "/api/filters/options",
];

let failures = 0;

function check(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    failures += 1;
  } else {
    console.log(`  ok: ${msg}`);
  }
}

async function get(route) {
  const res = await fetch(`${BASE}${route}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  for (const route of ROUTES) {
    const { status, body } = await get(route);
    console.log(`\n${route} -> ${status}`);
    check(status === 200, `${route} returns 200`);
    check(body && !body.error, `${route} has no error field`);
  }

  console.log("\n--- invariants ---");
  const health = (await get("/api/health")).body;
  const TOTAL = health.rows;
  check(TOTAL > 0, `health.rows > 0 (got ${TOTAL})`);

  // Default period = latest month vs prior month → current is one month.
  const kpis = (await get("/api/kpis")).body;
  check(
    kpis.sessions?.current > 0 && kpis.sessions?.current < TOTAL,
    `default kpis.sessions.current is one month, 0<n<${TOTAL} (got ${kpis.sessions?.current})`
  );
  check(
    kpis.sessions?.prior > 0,
    `default kpis.sessions.prior > 0 (got ${kpis.sessions?.prior})`
  );
  check(
    kpis.sessions?.deltaPct !== 0,
    `default kpis.sessions.deltaPct is non-zero (got ${kpis.sessions?.deltaPct})`
  );
  check(
    kpis.sessions?.sparkline?.length === 16,
    `default kpis sparkline spans 16 months (got ${kpis.sessions?.sparkline?.length})`
  );
  check(
    kpis.sessionDuration?.current > 0 && kpis.timeOnPage?.current > 0,
    `duration & time-on-page averages > 0`
  );

  // Full-range period covers the whole dataset; prior has no rows → delta 0.
  const kpisAll = (await get("/api/kpis?period=all")).body;
  check(
    kpisAll.sessions?.current === TOTAL,
    `period=all kpis.sessions.current === ${TOTAL} (got ${kpisAll.sessions?.current})`
  );
  check(
    kpisAll.sessions?.prior === 0 && kpisAll.sessions?.deltaPct === 0,
    `period=all prior===0 & delta===0 (got prior=${kpisAll.sessions?.prior}, delta=${kpisAll.sessions?.deltaPct})`
  );

  // Default breakdown is scoped to the current month and consistent with KPIs.
  const devices = (await get("/api/breakdown/devices")).body;
  const sum = devices.reduce((a, d) => a + d.count, 0);
  check(devices.length === 3, `devices length === 3 (got ${devices.length})`);
  check(
    sum === kpis.sessions?.current,
    `devices count sum === current month sessions (sum=${sum}, current=${kpis.sessions?.current})`
  );
  check(
    devices[0]?.device === "Desktop",
    `Desktop is the top device (got ${devices[0]?.device})`
  );

  const channels = (await get("/api/breakdown/channels")).body;
  check(channels.length === 6, `channels length === 6 (got ${channels.length})`);

  // period=all devices sum to the full dataset.
  const devicesAll = (await get("/api/breakdown/devices?period=all")).body;
  const sumAll = devicesAll.reduce((a, d) => a + d.count, 0);
  check(sumAll === TOTAL, `period=all devices count sum === ${TOTAL} (got ${sumAll})`);

  // Pages carry a bounce rate in [0,1].
  const pages = (await get("/api/pages")).body;
  check(pages.length > 0, `pages returns rows (got ${pages.length})`);
  check(
    pages.every((p) => p.bounceRate >= 0 && p.bounceRate <= 1),
    `every page bounceRate in [0,1]`
  );

  // Geo bubbles resolve to mapped coordinates.
  const geo = (await get("/api/geo")).body;
  check(
    geo.length > 0 && geo.every((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng)),
    `geo rows carry finite lat/lng (got ${geo.length})`
  );

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
