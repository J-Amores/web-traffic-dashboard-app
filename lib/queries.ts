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
  BrandBreakdownItem,
  ChannelBreakdownItem,
  DimensionKey,
  GeoItem,
  KpiBlock,
  KpisResponse,
  MetricKey,
  PlatformBreakdownItem,
  ProductBreakdownItem,
  SparklinePoint,
  TopPerformersResponse,
} from "./types";

const TABLE = "social_media_posts";

// SQL fragment computing each metric as a scalar aggregate.
const METRIC_SQL: Record<MetricKey, string> = {
  totalPosts: "COUNT(*)",
  avgEngagementRate: "AVG(engagement_rate)",
  avgImpressions: "AVG(impressions)",
  avgEngagements: "AVG(likes_count + shares_count + comments_count)",
};

// Column expression a dimension groups by.
const DIMENSION_COL: Record<DimensionKey, string> = {
  platform: "platform",
  brand: "brand_name",
  product: "product_name",
  channel: "campaign_phase",
  location: "location",
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  const period = await resolvePeriod(filters);
  const months = monthsBetween(period.current.gte, period.current.lte);
  // Fall back to whatever months exist if the range produced none.
  const axis = months.length ? months : rows.map((r) => r.month);
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
  const [totalPosts, avgEngagementRate, avgImpressions, avgEngagements] =
    await Promise.all([
      kpiBlock("totalPosts", filters),
      kpiBlock("avgEngagementRate", filters),
      kpiBlock("avgImpressions", filters),
      kpiBlock("avgEngagements", filters),
    ]);
  return { totalPosts, avgEngagementRate, avgImpressions, avgEngagements };
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

export async function getPlatformBreakdown(
  filters: FilterParams
): Promise<PlatformBreakdownItem[]> {
  const period = await resolvePeriod(filters);
  const [current, prior] = await Promise.all([
    dimensionCounts("platform", filters, period.current),
    dimensionCounts("platform", filters, period.prior),
  ]);
  const total = Array.from(current.values()).reduce((a, b) => a + b, 0);

  return Array.from(current.entries())
    .map(([platform, count]) => ({
      platform,
      count,
      sharePct: total ? (count / total) * 100 : 0,
      deltaPct: deltaPct(count, prior.get(platform) ?? 0),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getBrandBreakdown(
  filters: FilterParams
): Promise<BrandBreakdownItem[]> {
  const { where, params } = buildWhere(filters);
  const rows = await query<{
    brand: string;
    count: number | string;
    impressions: number | string;
  }>(
    `SELECT brand_name AS brand, COUNT(*) AS count, SUM(impressions) AS impressions
     FROM ${TABLE} ${where}
     GROUP BY brand_name ORDER BY count DESC`,
    params
  );
  return rows.map((r) => ({
    brand: r.brand,
    count: num(r.count),
    impressions: num(r.impressions),
  }));
}

export async function getGeo(filters: FilterParams): Promise<GeoItem[]> {
  const { where, params } = buildWhere(filters);
  const rows = await query<{ location: string; count: number | string }>(
    `SELECT location, COUNT(*) AS count FROM ${TABLE} ${where}
     GROUP BY location ORDER BY count DESC`,
    params
  );

  const out: GeoItem[] = [];
  for (const r of rows) {
    const coords = coordsFor(r.location);
    if (!coords) continue; // omit unmapped locations
    out.push({
      location: r.location,
      lat: coords.lat,
      lng: coords.lng,
      count: num(r.count),
    });
  }
  return out;
}

export async function getChannelBreakdown(
  filters: FilterParams
): Promise<ChannelBreakdownItem[]> {
  const { where, params } = buildWhere(filters);
  const [base, spark, period] = await Promise.all([
    query<{
      channel: string;
      count: number | string;
      avgimpressions: number | string;
    }>(
      `SELECT campaign_phase AS channel, COUNT(*) AS count,
              AVG(impressions) AS avgimpressions
       FROM ${TABLE} ${where}
       GROUP BY campaign_phase ORDER BY count DESC`,
      params
    ),
    query<{ channel: string; month: string; value: number | string }>(
      `SELECT campaign_phase AS channel, ${MONTH_BUCKET} AS month,
              AVG(impressions) AS value
       FROM ${TABLE} ${where}
       GROUP BY campaign_phase, month`,
      params
    ),
    resolvePeriod(filters),
  ]);

  const months = monthsBetween(period.current.gte, period.current.lte);
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
      avgImpressions: num(r.avgimpressions),
      sparkline: axis.map((month) => ({ month, value: m.get(month) ?? 0 })),
    };
  });
}

export async function getProductBreakdown(
  filters: FilterParams
): Promise<ProductBreakdownItem[]> {
  const { where, params } = buildWhere(filters);
  const rows = await query<{
    product: string;
    count: number | string;
    avgengagements: number | string;
  }>(
    `SELECT product_name AS product, COUNT(*) AS count,
            AVG(likes_count + shares_count + comments_count) AS avgengagements
     FROM ${TABLE} ${where}
     GROUP BY product_name ORDER BY count DESC`,
    params
  );
  const total = rows.reduce((a, r) => a + num(r.count), 0);
  return rows.map((r) => ({
    product: r.product,
    count: num(r.count),
    avgEngagements: num(r.avgengagements),
    sharePct: total ? (num(r.count) / total) * 100 : 0,
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

  const months = monthsBetween(period.current.gte, period.current.lte);
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

  const [platforms, locations, brands, campaigns, sentiments, dateBounds] =
    await Promise.all([
      distinct("platform"),
      distinct("location"),
      distinct("brand_name"),
      distinct("campaign_name"),
      distinct("sentiment_label"),
      getDateBounds(),
    ]);

  // country = substring after the comma; locations without a comma keep their
  // full value (e.g. "Singapore").
  const countries = Array.from(
    new Set(
      locations.map((loc) => {
        const idx = loc.indexOf(",");
        return idx === -1 ? loc.trim() : loc.slice(idx + 1).trim();
      })
    )
  ).sort();

  return { platforms, countries, brands, campaigns, sentiments, dateBounds };
}

// Validation helpers for /api/top-performers.
export const METRIC_KEYS: MetricKey[] = [
  "totalPosts",
  "avgEngagementRate",
  "avgImpressions",
  "avgEngagements",
];
export const DIMENSION_KEYS: DimensionKey[] = [
  "platform",
  "brand",
  "product",
  "channel",
  "location",
];

export function isMetricKey(v: string | null): v is MetricKey {
  return v !== null && (METRIC_KEYS as string[]).includes(v);
}
export function isDimensionKey(v: string | null): v is DimensionKey {
  return v !== null && (DIMENSION_KEYS as string[]).includes(v);
}
