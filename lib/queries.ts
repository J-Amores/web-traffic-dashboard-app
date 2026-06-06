// Parametrized aggregation queries backing the API. Every function takes the
// parsed FilterParams and uses bound parameters ($1, $2, …) only. Postgres
// returns bigint/numeric aggregates as strings; num() coerces them to numbers.

import { query } from "./db";
import { buildWhere, type FilterParams } from "./filters";
import {
  MONTH_BUCKET,
  deltaPct,
  monthsBetween,
  resolvePeriod,
  getDateBounds,
} from "./period";
import { coordsFor } from "./geo";
import type {
  ChannelBreakdownItem,
  DeviceBreakdownItem,
  DimensionKey,
  GeoItem,
  KpiBlock,
  KpisResponse,
  MetricKey,
  PageBreakdownItem,
  ReferrerBreakdownItem,
  SparklinePoint,
  TopPerformersResponse,
} from "./types";

const TABLE = "web_sessions";

// SQL fragment computing each metric as a scalar aggregate.
const METRIC_SQL: Record<MetricKey, string> = {
  sessions: "COUNT(*)",
  sessionDuration: "AVG(session_duration_s)",
  uniquePageviews: "AVG(unique_pageviews)",
  timeOnPage: "AVG(time_on_page_s)",
};

// Column expression a dimension groups by.
const DIMENSION_COL: Record<DimensionKey, string> = {
  device: "device_category",
  channel: "channel",
  source: "source",
  country: "country",
  page: "page_title",
  sourceMedium: "(source || ' / ' || medium)",
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Month axis for sparklines / trend lines: the full filtered range, NOT the
 * period window. Honors explicit `from`/`to` (which actually constrain the
 * underlying rows); otherwise spans the whole dataset. Falls back to the months
 * observed in the rows if bounds can't be derived.
 */
async function fullRangeMonths(
  filters: FilterParams,
  observed: string[]
): Promise<string[]> {
  const bounds = await getDateBounds();
  const gte = filters.from ?? bounds.min;
  const lte = filters.to
    ? /^\d{4}-\d{2}-\d{2}$/.test(filters.to)
      ? `${filters.to} 23:59:59`
      : filters.to
    : bounds.max;
  const months = monthsBetween(gte, lte);
  return months.length ? months : observed;
}

/** Scalar metric over a constrained window. */
async function scalarMetric(
  metric: MetricKey,
  filters: FilterParams,
  window?: { gte: string; lte: string }
): Promise<number> {
  const { where, params } = buildWhere(filters, {
    extraTimestamp: window ? { gte: window.gte, lte: window.lte } : undefined,
  });
  const rows = await query<{ v: number | string | null }>(
    `SELECT ${METRIC_SQL[metric]} AS v FROM ${TABLE} ${where}`,
    params
  );
  return num(rows[0]?.v);
}

/** Monthly series of a metric across the full filtered set. */
async function monthlySeries(
  metric: MetricKey,
  filters: FilterParams
): Promise<SparklinePoint[]> {
  const { where, params } = buildWhere(filters);
  const rows = await query<{ month: string; value: number | string | null }>(
    `SELECT ${MONTH_BUCKET} AS month, ${METRIC_SQL[metric]} AS value
     FROM ${TABLE} ${where}
     GROUP BY month ORDER BY month`,
    params
  );

  const byMonth = new Map(rows.map((r) => [r.month, num(r.value)]));
  // Sparkline/trend axis spans the FULL filtered range so all months show,
  // independent of the (possibly single-month) current period window.
  const axis = await fullRangeMonths(filters, rows.map((r) => r.month));
  return axis.map((m) => ({ month: m, value: byMonth.get(m) ?? 0 }));
}

async function kpiBlock(
  metric: MetricKey,
  filters: FilterParams
): Promise<KpiBlock> {
  const period = await resolvePeriod(filters);
  const [current, prior, sparkline] = await Promise.all([
    scalarMetric(metric, filters, period.current),
    scalarMetric(metric, filters, period.prior),
    monthlySeries(metric, filters),
  ]);
  return { current, prior, deltaPct: deltaPct(current, prior), sparkline };
}

export async function getKpis(filters: FilterParams): Promise<KpisResponse> {
  const [sessions, sessionDuration, uniquePageviews, timeOnPage] =
    await Promise.all([
      kpiBlock("sessions", filters),
      kpiBlock("sessionDuration", filters),
      kpiBlock("uniquePageviews", filters),
      kpiBlock("timeOnPage", filters),
    ]);
  return { sessions, sessionDuration, uniquePageviews, timeOnPage };
}

/** Generic dimension count for the current vs prior window (for deltaPct). */
async function dimensionCounts(
  col: string,
  filters: FilterParams,
  window?: { gte: string; lte: string }
): Promise<Map<string, number>> {
  const { where, params } = buildWhere(filters, {
    extraTimestamp: window ? { gte: window.gte, lte: window.lte } : undefined,
  });
  const rows = await query<{ k: string; c: number | string }>(
    `SELECT ${col} AS k, COUNT(*) AS c FROM ${TABLE} ${where} GROUP BY ${col}`,
    params
  );
  return new Map(rows.map((r) => [r.k, num(r.c)]));
}

/** "Which devices bring the most sessions?" */
export async function getDeviceBreakdown(
  filters: FilterParams
): Promise<DeviceBreakdownItem[]> {
  const period = await resolvePeriod(filters);
  const curWhere = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const [base, prior] = await Promise.all([
    query<{
      device: string;
      count: number | string;
      avgupv: number | string;
    }>(
      `SELECT device_category AS device, COUNT(*) AS count,
              AVG(unique_pageviews) AS avgupv
       FROM ${TABLE} ${curWhere.where}
       GROUP BY device_category`,
      curWhere.params
    ),
    dimensionCounts("device_category", filters, period.prior),
  ]);
  const total = base.reduce((a, r) => a + num(r.count), 0);

  return base
    .map((r) => ({
      device: r.device,
      count: num(r.count),
      sharePct: total ? (num(r.count) / total) * 100 : 0,
      avgUniquePageviews: num(r.avgupv),
      deltaPct: deltaPct(num(r.count), prior.get(r.device) ?? 0),
    }))
    .sort((a, b) => b.count - a.count);
}

/** "Which referral sites bring the most traffic?" */
export async function getReferrerBreakdown(
  filters: FilterParams
): Promise<ReferrerBreakdownItem[]> {
  const period = await resolvePeriod(filters);
  const { where, params } = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const rows = await query<{
    source: string;
    medium: string;
    count: number | string;
  }>(
    `SELECT source, medium, COUNT(*) AS count
     FROM ${TABLE} ${where}
     GROUP BY source, medium ORDER BY count DESC`,
    params
  );
  return rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    count: num(r.count),
  }));
}

/** "Where does the traffic come from?" — geo bubbles by country. */
export async function getGeo(filters: FilterParams): Promise<GeoItem[]> {
  const period = await resolvePeriod(filters);
  const { where, params } = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const rows = await query<{ country: string; count: number | string }>(
    `SELECT country, COUNT(*) AS count FROM ${TABLE} ${where}
     GROUP BY country ORDER BY count DESC`,
    params
  );

  const out: GeoItem[] = [];
  for (const r of rows) {
    const coords = coordsFor(r.country);
    if (!coords) continue; // omit unmapped countries
    out.push({
      country: r.country,
      lat: coords.lat,
      lng: coords.lng,
      count: num(r.count),
    });
  }
  return out;
}

/** "Which channels bring the most sessions?" */
export async function getChannelBreakdown(
  filters: FilterParams
): Promise<ChannelBreakdownItem[]> {
  // Base counts/avg are scoped to the CURRENT period (consistent with KPIs);
  // the sparkline stays over the FULL filtered range to show the whole trend.
  const period = await resolvePeriod(filters);
  const curWhere = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const full = buildWhere(filters);
  const [base, spark] = await Promise.all([
    query<{
      channel: string;
      count: number | string;
      avgupv: number | string;
    }>(
      `SELECT channel, COUNT(*) AS count, AVG(unique_pageviews) AS avgupv
       FROM ${TABLE} ${curWhere.where}
       GROUP BY channel ORDER BY count DESC`,
      curWhere.params
    ),
    query<{ channel: string; month: string; value: number | string }>(
      `SELECT channel, ${MONTH_BUCKET} AS month, COUNT(*) AS value
       FROM ${TABLE} ${full.where}
       GROUP BY channel, month`,
      full.params
    ),
  ]);

  const months = await fullRangeMonths(filters, spark.map((s) => s.month));
  const byChannel = new Map<string, Map<string, number>>();
  for (const s of spark) {
    if (!byChannel.has(s.channel)) byChannel.set(s.channel, new Map());
    byChannel.get(s.channel)!.set(s.month, num(s.value));
  }

  return base.map((r) => {
    const m = byChannel.get(r.channel) ?? new Map<string, number>();
    const axis = months.length ? months : Array.from(m.keys()).sort();
    return {
      channel: r.channel,
      count: num(r.count),
      avgUniquePageviews: num(r.avgupv),
      sparkline: axis.map((month) => ({ month, value: m.get(month) ?? 0 })),
    };
  });
}

/** "What are the most visited pages?" */
export async function getPageBreakdown(
  filters: FilterParams
): Promise<PageBreakdownItem[]> {
  const period = await resolvePeriod(filters);
  const { where, params } = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const rows = await query<{
    page: string;
    count: number | string;
    avgtop: number | string;
    bounce: number | string;
  }>(
    `SELECT page_title AS page, COUNT(*) AS count,
            AVG(time_on_page_s) AS avgtop, AVG(bounce) AS bounce
     FROM ${TABLE} ${where}
     GROUP BY page_title ORDER BY count DESC`,
    params
  );
  return rows.map((r) => ({
    pageTitle: r.page,
    count: num(r.count),
    avgTimeOnPage: num(r.avgtop),
    bounceRate: num(r.bounce),
  }));
}

const TOP_LIMIT = 10;

export async function getTopPerformers(
  metric: MetricKey,
  dimension: DimensionKey,
  filters: FilterParams
): Promise<TopPerformersResponse> {
  const col = DIMENSION_COL[dimension];
  const metricSql = METRIC_SQL[metric];

  const period = await resolvePeriod(filters);
  const curWhere = buildWhere(filters, {
    extraTimestamp: { gte: period.current.gte, lte: period.current.lte },
  });
  const priorWhere = buildWhere(filters, {
    extraTimestamp: { gte: period.prior.gte, lte: period.prior.lte },
  });
  const fullWhere = buildWhere(filters);

  const [monthlyTrend, currentRows, priorRows, sparkRows] = await Promise.all([
    // Overall monthly trend of the metric (across all groups).
    monthlySeries(metric, filters),
    // Per-group current value (ranking).
    query<{ key: string; value: number | string }>(
      `SELECT ${col} AS key, ${metricSql} AS value FROM ${TABLE} ${curWhere.where}
       GROUP BY ${col} ORDER BY value DESC LIMIT ${TOP_LIMIT}`,
      curWhere.params
    ),
    // Per-group prior value (for delta).
    query<{ key: string; value: number | string }>(
      `SELECT ${col} AS key, ${metricSql} AS value FROM ${TABLE} ${priorWhere.where}
       GROUP BY ${col}`,
      priorWhere.params
    ),
    // Per-group monthly sparkline across the full filtered set.
    query<{ key: string; month: string; value: number | string }>(
      `SELECT ${col} AS key, ${MONTH_BUCKET} AS month, ${metricSql} AS value
       FROM ${TABLE} ${fullWhere.where}
       GROUP BY ${col}, month`,
      fullWhere.params
    ),
  ]);

  const priorByKey = new Map(priorRows.map((r) => [r.key, num(r.value)]));

  // Per-group sparkline spans the full filtered range (not the period window).
  const months = await fullRangeMonths(filters, sparkRows.map((s) => s.month));
  const sparkByKey = new Map<string, Map<string, number>>();
  for (const s of sparkRows) {
    if (!sparkByKey.has(s.key)) sparkByKey.set(s.key, new Map());
    sparkByKey.get(s.key)!.set(s.month, num(s.value));
  }

  const top = currentRows.map((r) => {
    const m = sparkByKey.get(r.key) ?? new Map<string, number>();
    const axis = months.length ? months : Array.from(m.keys()).sort();
    return {
      key: r.key,
      value: num(r.value),
      deltaPct: deltaPct(num(r.value), priorByKey.get(r.key) ?? 0),
      sparkline: axis.map((month) => ({ month, value: m.get(month) ?? 0 })),
    };
  });

  return { metric, dimension, monthlyTrend, top };
}

/** Health: row count + date range (unfiltered). */
export async function getHealth(): Promise<{
  rows: number;
  range: { min: string; max: string };
}> {
  const [rows, range] = await Promise.all([
    query<{ rows: number | string }>(`SELECT COUNT(*) AS rows FROM ${TABLE}`),
    getDateBounds(),
  ]);
  return { rows: num(rows[0]?.rows), range };
}

export async function getFilterOptions() {
  const distinct = async (col: string): Promise<string[]> => {
    const rows = await query<{ v: string }>(
      `SELECT DISTINCT ${col} AS v FROM ${TABLE} WHERE ${col} IS NOT NULL ORDER BY ${col}`
    );
    return rows.map((r) => r.v);
  };

  const [devices, channels, countries, sources, dateBounds] = await Promise.all(
    [
      distinct("device_category"),
      distinct("channel"),
      distinct("country"),
      distinct("source"),
      getDateBounds(),
    ]
  );

  return { devices, channels, countries, sources, dateBounds };
}

// Validation helpers for /api/top-performers.
export const METRIC_KEYS: MetricKey[] = [
  "sessions",
  "sessionDuration",
  "uniquePageviews",
  "timeOnPage",
];
export const DIMENSION_KEYS: DimensionKey[] = [
  "device",
  "channel",
  "source",
  "country",
  "page",
  "sourceMedium",
];

export function isMetricKey(v: string | null): v is MetricKey {
  return v !== null && (METRIC_KEYS as string[]).includes(v);
}
export function isDimensionKey(v: string | null): v is DimensionKey {
  return v !== null && (DIMENSION_KEYS as string[]).includes(v);
}
