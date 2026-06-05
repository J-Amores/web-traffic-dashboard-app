// Period helpers: resolve the current window from the filters, derive an
// equal-length prior window, and provide the month-bucket SQL expression for
// sparkline series.
//
// The `"timestamp"` column is a Postgres TIMESTAMP. We do window math in JS by
// parsing the bounds to UTC-naive Date objects and re-formatting to
// 'YYYY-MM-DD HH:MM:SS' strings, which Postgres implicitly casts in comparisons.

import { queryOne } from "./db";
import type { FilterParams } from "./filters";

export interface Period {
  current: { gte: string; lte: string };
  prior: { gte: string; lte: string };
}

const PAD = (n: number) => String(n).padStart(2, "0");

/** Parse 'YYYY-MM-DD[ HH:MM:SS]' as a UTC Date. */
function parseTs(ts: string): Date {
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    )
  );
}

/** Format a UTC Date back to 'YYYY-MM-DD HH:MM:SS'. */
function fmtTs(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${PAD(d.getUTCMonth() + 1)}-${PAD(d.getUTCDate())}` +
    ` ${PAD(d.getUTCHours())}:${PAD(d.getUTCMinutes())}:${PAD(d.getUTCSeconds())}`
  );
}

/** Min/max timestamp across the whole table (cached per process). */
let boundsCache: { min: string; max: string } | null = null;
export async function getDateBounds(): Promise<{ min: string; max: string }> {
  if (!boundsCache) {
    // Cast to text so neon returns 'YYYY-MM-DD HH:MM:SS' strings (not Date).
    const row = await queryOne<{ min: string; max: string }>(
      `SELECT MIN("timestamp")::text AS min, MAX("timestamp")::text AS max
       FROM social_media_posts`
    );
    boundsCache = { min: row?.min ?? "", max: row?.max ?? "" };
  }
  return boundsCache;
}

/**
 * Resolve the current window from filters (defaulting to the full data range)
 * and compute the prior window of equal length immediately preceding it.
 */
export async function resolvePeriod(filters: FilterParams): Promise<Period> {
  const bounds = await getDateBounds();
  const curGte = filters.from ?? bounds.min;
  const curLte = filters.to
    ? /^\d{4}-\d{2}-\d{2}$/.test(filters.to)
      ? `${filters.to} 23:59:59`
      : filters.to
    : bounds.max;

  const start = parseTs(curGte);
  const end = parseTs(curLte);
  const lengthMs = Math.max(0, end.getTime() - start.getTime());

  const priorEnd = new Date(start.getTime() - 1000); // 1s before current start
  const priorStart = new Date(priorEnd.getTime() - lengthMs);

  return {
    current: { gte: curGte, lte: curLte },
    prior: { gte: fmtTs(priorStart), lte: fmtTs(priorEnd) },
  };
}

/** Percentage change guarding divide-by-zero (returns 0 when prior is 0). */
export function deltaPct(current: number, prior: number): number {
  if (!prior) return 0;
  return ((current - prior) / prior) * 100;
}

/** SQL expression bucketing a row to its 'YYYY-MM' month. */
export const MONTH_BUCKET = `to_char("timestamp", 'YYYY-MM')`;

/** Generate the list of 'YYYY-MM' months inclusive between two timestamps. */
export function monthsBetween(gte: string, lte: string): string[] {
  const start = parseTs(gte);
  const end = parseTs(lte);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const months: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${PAD(m + 1)}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}
