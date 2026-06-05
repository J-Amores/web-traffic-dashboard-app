// Smoke test: hits every endpoint against an already-running server and
// asserts 200 + key sanity invariants. Run AFTER `next build && next start`
// (or `next dev`). Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
//
// Exits non-zero on the first failure.

const BASE = process.env.BASE ?? "http://localhost:3000";

const ROUTES = [
  "/api/health",
  "/api/kpis",
  "/api/breakdown/platforms",
  "/api/breakdown/brands",
  "/api/geo",
  "/api/breakdown/channels",
  "/api/breakdown/products",
  "/api/top-performers?metric=avgImpressions&dimension=brand",
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

  // Critical invariants.
  console.log("\n--- invariants ---");
  const health = (await get("/api/health")).body;
  check(health.rows === 12000, `health.rows === 12000 (got ${health.rows})`);

  const kpis = (await get("/api/kpis")).body;
  check(
    kpis.totalPosts?.current === 12000,
    `kpis.totalPosts.current === 12000 (got ${kpis.totalPosts?.current})`
  );

  const platforms = (await get("/api/breakdown/platforms")).body;
  const sum = platforms.reduce((a, p) => a + p.count, 0);
  check(platforms.length === 5, `platforms length === 5 (got ${platforms.length})`);
  check(sum === 12000, `platforms count sum === 12000 (got ${sum})`);

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
