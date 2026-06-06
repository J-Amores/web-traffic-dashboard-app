# Codebase Map — admin-dashboard-app

Web-traffic analytics dashboard. Next.js (App Router) + TypeScript + Tailwind;
data via Neon Postgres (`@neondatabase/serverless` HTTP driver), table
`web_sessions` (~79k synthetic session rows, 16 months). **UI = a single dark,
monospace "live-ops console"** at `app/page.tsx` (Vercel-style), client-fetching
the live API with `?period=all`. Pixel dotted world map + scramble-in numerals +
animated trend sparklines. (The earlier 3-view light Tableau dashboard was
replaced — recoverable from git history.)

## Stack & conventions

| Aspect | Choice |
|--------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind v3 + dark `--ds-*` tokens (in `globals.css`); Geist Mono via `geist` pkg |
| Data access | Neon Postgres via `@neondatabase/serverless` (HTTP, one-shot) |
| API style | `app/api/.../route.ts`, all GET, JSON, async |
| Runtime | `nodejs` on every data route (Edge-capable, kept on Node) |
| Import alias | `@/*` -> repo root |
| Env | `DATABASE_URL` (pooled) injected by the Vercel-Neon integration; `vercel env pull .env.local` for local |

## Scoped commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` (core-web-vitals) |
| `npm run seed` | Regenerate `web_sessions` straight into Neon (drops + reseeds; reads `.env.local`) |
| `npm run smoke` | Hit every endpoint + assert invariants (server must be running; `BASE` env overrides URL) |

## Layout

| Area | Path | Responsibility |
|------|------|----------------|
| DB connection | `lib/db.ts` | Neon HTTP client (cached) + `query`/`queryOne` helpers (`$1` params) |
| Filter builder | `lib/filters.ts` | `parseFilters` (whitelist params) + `buildWhere` (parametrized `$N` WHERE only) |
| Period math | `lib/period.ts` | Current vs prior window, month buckets, `deltaPct`, date bounds (cached) |
| Geo coords | `lib/geo.ts` | Static lat/lng centroids for the 16 seed countries; unmapped -> omit + warn once |
| Queries | `lib/queries.ts` | Parametrized aggregations backing every endpoint + metric/dimension validators |
| Types | `lib/types.ts` | Shared response shapes + metric-mapping doc comment |
| Response helper | `lib/respond.ts` | `jsonHandler` — wraps handlers, errors -> 500 `{error}` |
| Client data | `lib/client.ts` | `fetchJson` typed fetch (the console fetches with `?period=all`) |
| Formatting | `lib/format.ts` | `fmtInt`/`fmtRate`/`fmtPct`/`fmtCompact`/`fmtSeconds`/`fmtMonthYear` display helpers |
| Motion | `lib/motion.ts` | `useCountUp` + `useScramble` (digit-scramble on load; reduced-motion safe) |
| Country meta | `lib/country-meta.ts` | country-name → ISO2 bridge + per-country dot colors for the map |
| Map dot grid | `lib/data/dotted-map-data.json` | precomputed per-country pixel-dot coords (keyed by ISO2) |
| Console page | `app/page.tsx` | the single dark ops-console view; client-fetches all endpoints |
| App shell | `app/layout.tsx`, `app/globals.css` | dark root layout (Geist Mono, black bg) + `--ds-*` token defs |
| Components | `components/console/*` | `DottedMap` (d3-geo pixel map), `MapContainer`, `StatsDisplay` (numeral cards, lists, `MiniSpark` trend, scramble) |
| API routes | `app/api/**/route.ts` | See API contract below |
| Seed generator | `scripts/generate-seed.mjs` | Synthetic `web_sessions` generator → Neon (drops + recreates + indexes, batched) |
| Smoke test | `scripts/smoke.mjs` | Endpoint + invariant checks |
| UI verify | `scripts/verify-ui.mjs` | Headless view checks |

## API surface

| Method | Route | Returns |
|--------|-------|---------|
| GET | `/api/health` | `{status,rows,range}` (no filters) |
| GET | `/api/kpis` | `{sessions,sessionDuration,uniquePageviews,timeOnPage}` each `{current,prior,deltaPct,sparkline[]}` |
| GET | `/api/breakdown/devices` | `[{device,count,sharePct,avgUniquePageviews,deltaPct}]` desc |
| GET | `/api/breakdown/referrers` | `[{source,medium,count}]` desc |
| GET | `/api/breakdown/channels` | `[{channel,count,avgUniquePageviews,sparkline[]}]` desc |
| GET | `/api/geo` | `[{country,lat,lng,count}]` desc |
| GET | `/api/pages` | `[{pageTitle,count,avgTimeOnPage,bounceRate}]` desc |
| GET | `/api/top-performers?metric=&dimension=` | `{metric,dimension,monthlyTrend[],top[]}` |
| GET | `/api/filters/options` | `{devices,channels,countries,sources,dateBounds}` |

Shared filter querystring params (all optional, unknown ignored):
`from`, `to`, `device`, `country`, `channel`, `source`, `period` (`month|3m|6m|12m|all`, default `month`).
`metric` ∈ `sessions|sessionDuration|uniquePageviews|timeOnPage`;
`dimension` ∈ `device|channel|source|country|page|sourceMedium`.

## Metric mapping (mockup label -> web-analytics SQL)

| Mockup label | Code field | SQL |
|--------------|-----------|-----|
| Total Sessions | `sessions` | `COUNT(*)` |
| Session Duration | `sessionDuration` | `AVG(session_duration_s)` |
| Avg Unique Pageviews | `uniquePageviews` | `AVG(unique_pageviews)` |
| Avg Time on Page | `timeOnPage` | `AVG(time_on_page_s)` |
| Devices | device breakdown | group by `device_category` |
| Referral sites | referrer breakdown | group by `source`, `medium` |
| Geo map | geo | group by `country` + static centroids |
| Channels | channel breakdown | group by `channel` |
| Most-visited pages | page breakdown | group by `page_title` (+ `bounce_rate`) |

## Data source

**Runtime:** Neon Postgres, table `web_sessions` (~79,011 rows, timestamp range
2024-01-01 → 2025-04-30, 16 months). `"timestamp"` is `TIMESTAMP` (quoted — reserved
keyword), measures `INTEGER`. 7 indexes (timestamp, device_category, channel, source,
country, page_title, medium). Month buckets via `to_char("timestamp",'YYYY-MM')`.
Aggregates (bigint/numeric) return as strings from the driver; `num()` coerces.

**Seed:** generated, not migrated. `scripts/generate-seed.mjs` (`npm run seed`) builds the
synthetic rows directly in Neon (drops + recreates the table). No SQLite; no `from`/`to`
fixture file. Dimension catalogs + weights + row count live in that script.
