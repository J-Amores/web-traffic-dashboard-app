# Codebase Map — admin-dashboard-app

Backend skeleton for the social-media engagement admin dashboard.
Next.js (App Router) + TypeScript + Tailwind; data via Neon Postgres
(`@neondatabase/serverless` HTTP driver). **No dashboard UI yet** — only a
placeholder home page. UI/UX is pending.

## Stack & conventions

| Aspect | Choice |
|--------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind (wired, barely used) |
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
| `npm run migrate` | One-time: load `social_media_engagement.db` into Neon with proper PG types (reads `.env.local`) |
| `npm run smoke` | Hit every endpoint + assert invariants (server must be running; `BASE` env overrides URL) |

## Layout

| Area | Path | Responsibility |
|------|------|----------------|
| DB connection | `lib/db.ts` | Neon HTTP client (cached) + `query`/`queryOne` helpers (`$1` params) |
| Filter builder | `lib/filters.ts` | `parseFilters` (whitelist params) + `buildWhere` (parametrized `$N` WHERE only) |
| Period math | `lib/period.ts` | Current vs prior window, month buckets, `deltaPct`, date bounds (cached) |
| Geo coords | `lib/geo.ts` | Static lat/lng for all 33 distinct locations; unmapped -> omit + warn once |
| Queries | `lib/queries.ts` | Parametrized aggregations backing every endpoint + metric/dimension validators |
| Types | `lib/types.ts` | Shared response shapes + metric-mapping doc comment |
| Response helper | `lib/respond.ts` | `jsonHandler` — wraps handlers, errors -> 500 `{error}` |
| App shell | `app/layout.tsx`, `app/globals.css` | Minimal root layout + Tailwind globals |
| Home | `app/page.tsx` | Placeholder: "Skeleton OK" + API route list (no dashboard) |
| API routes | `app/api/**/route.ts` | See API contract below |
| Migration | `scripts/migrate-to-neon.mjs` | One-time SQLite -> Neon load (drops/recreates, batched, idempotent) |
| Smoke test | `scripts/smoke.mjs` | Endpoint + invariant checks |

## API surface

| Method | Route | Returns |
|--------|-------|---------|
| GET | `/api/health` | `{status,rows,range}` (no filters) |
| GET | `/api/kpis` | `{totalPosts,avgEngagementRate,avgImpressions,avgEngagements}` each `{current,prior,deltaPct,sparkline[]}` |
| GET | `/api/breakdown/platforms` | `[{platform,count,sharePct,deltaPct}]` |
| GET | `/api/breakdown/brands` | `[{brand,count,impressions}]` desc |
| GET | `/api/geo` | `[{location,lat,lng,count}]` |
| GET | `/api/breakdown/channels` | `[{channel,count,avgImpressions,sparkline[]}]` (channel = campaign_phase) |
| GET | `/api/breakdown/products` | `[{product,count,avgEngagements,sharePct}]` desc |
| GET | `/api/top-performers?metric=&dimension=` | `{metric,dimension,monthlyTrend[],top[]}` |
| GET | `/api/filters/options` | `{platforms,countries,brands,campaigns,sentiments,dateBounds}` |

Shared filter querystring params (all optional, unknown ignored):
`from`, `to`, `platform`, `location`, `brand`, `campaign`, `sentiment`.

## Metric mapping (mockup intent -> real social data)

| Mockup label | Code field | SQL |
|--------------|-----------|-----|
| Total Sessions | `totalPosts` | `COUNT(*)` |
| Session Duration | `avgEngagementRate` | `AVG(engagement_rate)` |
| Avg Unique Pageviews | `avgImpressions` | `AVG(impressions)` |
| Avg Time on Page | `avgEngagements` | `AVG(likes+shares+comments)` |
| Devices | platform breakdown | group by `platform` |
| Referral sites | brand breakdown | group by `brand_name` |
| Geo map | geo | group by `location` + static coords |
| Channels | channel breakdown | group by `campaign_phase` |
| Most-visited pages | product breakdown | group by `product_name` |

## Data source

**Runtime:** Neon Postgres, table `social_media_posts` (12,000 rows, timestamp range
2024-05-01 → 2025-04-30). Proper PG types: `"timestamp"` is `TIMESTAMP` (quoted — reserved
keyword), counts `INTEGER`, rates `DOUBLE PRECISION`, `post_id` PK. 8 indexes mirror the
original. Month buckets via `to_char("timestamp",'YYYY-MM')`. Aggregates (bigint/numeric)
return as strings from the driver; `num()` coerces.

**Seed:** `social_media_engagement.db` (SQLite, repo root) is the migration source only —
not used at runtime. Load it once with `npm run migrate`.
