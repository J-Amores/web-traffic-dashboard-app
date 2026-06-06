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
       FROM web_sessions`
    );
    boundsCache = { min: row?.min ?? "", max: row?.max ?? "" };
  }
  return boundsCache;
}

/** First instant of the month containing `d` (UTC). */
function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

/** Last instant (…23:59:59) of the month containing `d` (UTC). */
function monthEnd(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0) - 1000
  );
}

/** Shift a date back by N whole calendar months (UTC). */
function addMonths(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate(),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
  );
}

/**
 * Resolve the current window and an equal-length prior window for delta math.
 *
 * Precedence:
 *   1. Explicit `from`/`to` -> current = that range, prior = equal-length span
 *      immediately before it. (Existing behavior, wins over `period`.)
 *   2. `period` preset (default `month`):
 *        - month -> latest full month present in the data; prior = month before.
 *        - 3m/6m/12m/all -> the last N months ending at the latest month
 *          (12m/all = the full data range); prior = the equal-length span
 *          immediately before (so 12m/all -> prior has no rows -> delta 0).
 */
export async function resolvePeriod(filters: FilterParams): Promise<Period> {
  const bounds = await getDateBounds();

  // 1. Explicit range overrides everything.
  if (filters.from || filters.to) {
    const curGte = filters.from ?? bounds.min;
    const curLte = filters.to
      ? /^\d{4}-\d{2}-\d{2}$/.test(filters.to)
        ? `${filters.to} 23:59:59`
        : filters.to
      : bounds.max;

    const start = parseTs(curGte);
    const end = parseTs(curLte);
    const lengthMs = Math.max(0, end.getTime() - start.getTime());
    const priorEnd = new Date(start.getTime() - 1000);
    const priorStart = new Date(priorEnd.getTime() - lengthMs);

    return {
      current: { gte: curGte, lte: curLte },
      prior: { gte: fmtTs(priorStart), lte: fmtTs(priorEnd) },
    };
  }

  // 2. Period preset (whole calendar months anchored at the latest data month).
  const latest = parseTs(bounds.max);
  const curEndDate = monthEnd(latest); // end of latest full month
  const preset = filters.period ?? "month";
  // `all` spans the entire dataset (whatever its month count); the fixed presets
  // use their literal window. Anchored at the latest data month either way.
  const totalMonths = monthsBetween(bounds.min, bounds.max).length;
  const span =
    preset === "month"
      ? 1
      : preset === "3m"
        ? 3
        : preset === "6m"
          ? 6
          : preset === "12m"
            ? 12
            : totalMonths; // "all"

  const curStartDate = monthStart(addMonths(latest, -(span - 1)));
  const priorEndDate = new Date(curStartDate.getTime() - 1000);
  const priorStartDate = monthStart(addMonths(curStartDate, -span));

  return {
    current: { gte: fmtTs(curStartDate), lte: fmtTs(curEndDate) },
    prior: { gte: fmtTs(priorStartDate), lte: fmtTs(priorEndDate) },
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
