# Evaluator Report — Iteration 1

**Verdict: PASS** (all deterministic gates green)

Run date: 2026-06-06
Branch: main

## Gates

| Gate | Result | Detail |
|---|---|---|
| Build | PASS | `next build` — Compiled successfully; 11 routes emitted (`/` static, 10 API dynamic). No build errors. |
| Typecheck | PASS | `tsc --noEmit` — exit 0, no type errors. |
| Tests | PASS | No `test` script defined; `npm run smoke` is the project's deterministic suite. Ran against `next start` (prod build) on :3137 with live Neon DB. 18 route checks + 16 invariants, all passed. |

## Test detail (smoke suite)

All 9 API routes return 200 with no error field. Invariants verified:
- `health.rows = 79011` (> 0)
- default KPIs scoped to one month (`sessions.current=5631`, `prior=5298`, `deltaPct=6.29`), sparkline = 16 months
- `period=all` totals reconcile to 79011; prior=0/delta=0 as expected
- devices breakdown sums to current-month sessions; Desktop top; 3 devices, 6 channels
- pages bounceRate in [0,1]; geo rows carry finite lat/lng (16 rows)

## Notes for next builder

- There are no unit/spec test files in the repo. `npm run smoke` is treated as the tests gate; it requires a running server (`next build && next start`) and a reachable Neon DB (`DATABASE_URL` in `.env.local`). Both were available this run.
- Lint was not part of the requested gate (build + typecheck + tests only) and was not run.
- No failures — no action required.
