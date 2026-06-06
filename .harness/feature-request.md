# Feature Request — Country hover mini-dashboard

## Change
On the dotted world map (`components/console/DottedMap.tsx`), hovering a country
hotspot opens a **floating mini-dashboard panel** showing metrics scoped to that
country. The panel has a smooth opening transition and shows a loading animation
while its data is in flight.

## Decided behavior (from planning)
- **Interaction: hover-floating only.** Panel appears on `mouseenter` of a
  country hotspot, positioned near the dot, and disappears on `mouseleave`.
  No pinning, no click, no mobile/touch affordance (out of scope this pass).
  This supersedes the current tiny one-line tooltip (country · N sessions) —
  the new panel replaces it.
- **Content: full mini-dashboard**, all per-country and all real:
  - Country name/flag + **Total sessions** (from `/api/kpis`)
  - 3 KPI numerals: **Session Duration**, **Avg Time on Page**,
    **Avg Unique Pageviews** (`/api/kpis`)
  - **Device split** (`/api/breakdown/devices`)
  - **Channel split** (`/api/breakdown/channels`)
  - **Top referrers** (`/api/breakdown/referrers`, top ~4)
  - **Top pages** with bounce rate (`/api/pages`, top ~4)
- **Smooth opening transition:** fade + slight scale/translate in
  (framer-motion, already a dependency). Respect `prefers-reduced-motion`.
- **Loading animation:** while the country's data is fetching, the panel opens
  immediately (with the country name) and shows an animated loading state
  (skeleton shimmer or pulsing placeholders) in the metric area, then swaps to
  real values. Subsequent hovers of the same country are instant (cache).

## Data source — NO backend change
Every existing GET route already accepts a `country` query param via
`parseFilters` → `buildWhere` (`lib/filters.ts`). Fetch with
`?period=all&country=<COUNTRY>`:
- `/api/kpis` → sessions + 3 KPIs (use `.current`)
- `/api/breakdown/devices`, `/api/breakdown/channels`
- `/api/breakdown/referrers`, `/api/pages`
The country values are the raw `country` strings from `/api/geo` (already loaded
by the page). Reuse `iso2For` / `colorForIso2` / flag helpers from
`lib/country-meta.ts` for the header, consistent with `TopCountries`.

## Acceptance criteria
1. Hovering any country hotspot opens a floating panel anchored near that dot;
   moving the mouse off the dot closes it.
2. The panel shows the country header immediately, a visible **loading
   animation** in place of the metrics, then real per-country numbers once
   fetched.
3. All numbers are real per-country aggregates (verified: a country's panel
   `Total sessions` equals that country's count in `/api/geo`).
4. Opening is animated (fade/scale-in); `prefers-reduced-motion` disables it.
5. Re-hovering an already-fetched country shows data with no re-flash of the
   loader (client cache).
6. No regressions: existing console (numerals, sparklines, info-flip, list
   cards) and `npm run smoke` still pass; no new console errors.
7. `npm run build`, `typecheck`, `lint` all green.
