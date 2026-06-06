# API Contract — Country hover mini-dashboard (feature gate)

Backend is **unchanged** by this feature. The frontend consumes existing GET
routes filtered by `?period=all&country=<COUNTRY>`. Every route already accepts
`country` via `parseFilters` → `buildWhere` (`lib/filters.ts`, parametrized).
`<COUNTRY>` is the raw `country` string from `/api/geo` (URL-encode it).

Response shapes are defined in `lib/types.ts` (the sole source of truth — do not
redefine in components). All numerals are real Neon `web_sessions` aggregates.

## Routes the panel uses

| Route (add `?period=all&country=<C>`) | Shape (`lib/types.ts`) | Panel use |
|---|---|---|
| `GET /api/kpis` | `KpisResponse` — `{sessions, sessionDuration, uniquePageviews, timeOnPage}`, each a `KpiBlock {current, prior, deltaPct, sparkline:[{month,value}]}` | Header total = `sessions.current`; 3 KPI numerals = `.current` of `sessionDuration`, `timeOnPage`, `uniquePageviews` |
| `GET /api/breakdown/devices` | `DeviceBreakdownItem[]` — `{device, count, sharePct, avgUniquePageviews, deltaPct}` desc | Device split |
| `GET /api/breakdown/channels` | `ChannelBreakdownItem[]` — `{channel, count, avgUniquePageviews, sparkline[]}` desc | Channel split |
| `GET /api/breakdown/referrers` | `ReferrerBreakdownItem[]` — `{source, medium, count}` desc | Top referrers (slice ~4) |
| `GET /api/pages` | `PageBreakdownItem[]` — `{pageTitle, count, avgTimeOnPage, bounceRate(0..1)}` desc | Top pages + bounce (slice ~4) |
| `GET /api/geo` | `GeoItem[]` — `{country, lat, lng, count}` desc | Already loaded by the page; supplies the country list + the count the panel header must equal |

## Contract invariants (verified live this session, server on :3111)

- `/api/health` → `{status:"ok", rows:79011, range:{min:"2024-01-01 00:30:48", max:"2025-04-28 23:59:22"}}`.
- **Per-country correctness (acceptance #3):** for `country=United States`,
  `/api/kpis?period=all&country=United States` `sessions.current` = `16906`,
  which **equals** that country's `count` in `/api/geo?period=all`. The panel's
  "Total sessions" must use `kpis.sessions.current` and will match `/api/geo`.
- Without `country`, `period=all` totals reconcile to 79011 (devices/geo sums),
  confirming the `country` filter is the only thing scoping the panel data.
- Errors surface as HTTP non-2xx with `{error}`; `fetchJson` (`lib/client.ts`)
  throws on non-2xx — the panel must catch and render an error state, not crash.

## Client guidance (non-binding, from spec)

- Use `fetchJson<T>` from `lib/client.ts`; type each call with the shape above.
- Cache results per-country (re-hover = no loader re-flash). Cancel/ignore stale
  responses when hovering rapidly across countries (no state leak).
- No new endpoints, no SQL, no seed, no new npm deps. framer-motion + Tailwind
  `--ds-*` tokens + Geist Mono + `tabular-nums` only.
