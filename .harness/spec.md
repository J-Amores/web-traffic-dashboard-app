# Spec — Country hover mini-dashboard

## Mode
- kind: **feature** (change on existing repo)
- gate: **phase-b** (deterministic + runtime + visual + rubric)

## Detected stack (do not change)
- Next.js 14 App Router, TypeScript strict, Tailwind v3 (dark `--ds-*` tokens,
  Geist Mono), framer-motion (already used in `components/console/*`).
- Data: Neon Postgres `web_sessions` via `@neondatabase/serverless`. Read-only
  for this feature.
- Client fetch helper: `fetchJson` (`lib/client.ts`). Formatters in
  `lib/format.ts`. Country meta in `lib/country-meta.ts`. Motion helpers in
  `lib/motion.ts` (`useScramble`).

## Scope (in)
- `components/console/DottedMap.tsx` — hotspot hover wiring + panel mount.
- A new panel component, e.g. `components/console/CountryPanel.tsx`
  (or co-located), holding the mini-dashboard, fetch + cache + loading state.
- Reuse existing primitives/styles; match the dark mono console aesthetic
  (`bg-[var(--ds-background-200)]`, `border-[var(--ds-gray-200)]`, mono,
  `tabular-nums`).

## Scope (out — do not touch)
- No API/route changes, no SQL changes, no seed changes (country filter already
  supported server-side).
- No new npm dependencies (use framer-motion + Tailwind already present).
- No mobile/touch interaction, no click-to-pin, no period switching.
- No changes to the card grid, hero numerals, or sparklines beyond what the
  panel needs.

## Constraints
- HARD RULES (CLAUDE.md): surgical changes only; simplest full solution; proper
  error handling (panel must show an error state if a fetch fails, not crash).
- Every displayed number must be real per-country data — no fabricated values.
- Respect `prefers-reduced-motion` for both the open transition and loader.
- Fetch resilience: hovering rapidly across many countries must not leak
  state (cancel/ignore stale responses; cache by country).
- Keep the existing `country · N sessions` info available (header line of the
  new panel satisfies this).

## Verification commands
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run smoke`
- Runtime/visual: `node scripts/verify-ui.mjs` (Playwright CLI installed
  locally) against `npm run dev`; extend it to hover a hotspot and assert the
  panel + loader appear and then show real numbers. Playwright MCP is NOT loaded
  this session — visual gate degrades to the CLI script + health check.
