// Shared WHERE-clause builder. All user values are passed as bound
// parameters ($1, $2, …) — parametrized statements only — to prevent SQL
// injection.
//
// `from`/`to` compare against the `"timestamp"` column (Postgres TIMESTAMP).
// String params in 'YYYY-MM-DD HH:MM:SS' form are implicitly cast to timestamp
// by Postgres. A bare date 'YYYY-MM-DD' for `to` is expanded to the end of the
// day so the whole day is inclusive. `"timestamp"` is quoted because it is a
// Postgres reserved keyword.

// Period presets the header selector can request without computing dates
// client-side. `month` is the default when no period/from/to is supplied.
// Explicit `from`/`to` always override `period`.
export const PERIOD_PRESETS = ["month", "3m", "6m", "12m", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export interface FilterParams {
  from?: string;
  to?: string;
  period?: PeriodPreset;
  device?: string;
  country?: string;
  channel?: string;
  source?: string;
}

export interface WhereResult {
  where: string; // e.g. 'WHERE platform = $1 AND "timestamp" >= $2' or ""
  params: (string | number)[];
}

// String-valued keys parsed generically. `period` is parsed separately because
// it is a whitelisted enum, not a free-form string.
const ALLOWED_KEYS: Exclude<keyof FilterParams, "period">[] = [
  "from",
  "to",
  "device",
  "country",
  "channel",
  "source",
];

function isPeriodPreset(v: string): v is PeriodPreset {
  return (PERIOD_PRESETS as readonly string[]).includes(v);
}

/**
 * Extract only the known filter params from a URLSearchParams, ignoring any
 * unknown keys. Empty strings are treated as absent. `period` is validated
 * against the preset whitelist; unknown values are dropped (period.ts then
 * applies the `month` default).
 */
export function parseFilters(search: URLSearchParams): FilterParams {
  const out: FilterParams = {};
  for (const key of ALLOWED_KEYS) {
    const raw = search.get(key);
    if (raw !== null && raw.trim() !== "") {
      out[key] = raw.trim();
    }
  }
  const period = search.get("period");
  if (period !== null && isPeriodPreset(period.trim())) {
    out.period = period.trim() as PeriodPreset;
  }
  return out;
}

/** Normalize a `to` bound so a bare date includes the entire day. */
function normalizeTo(to: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) return `${to} 23:59:59`;
  return to;
}

export function buildWhere(
  filters: FilterParams,
  opts: { extraTimestamp?: { gte?: string; lte?: string } } = {}
): WhereResult {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  // Push a bound value and return its positional placeholder ($N).
  const ph = (val: string | number): string => {
    params.push(val);
    return `$${params.length}`;
  };

  // Caller-supplied explicit timestamp bounds (used by period calc).
  if (opts.extraTimestamp?.gte) {
    clauses.push(`"timestamp" >= ${ph(opts.extraTimestamp.gte)}`);
  }
  if (opts.extraTimestamp?.lte) {
    clauses.push(`"timestamp" <= ${ph(opts.extraTimestamp.lte)}`);
  }

  if (filters.from) clauses.push(`"timestamp" >= ${ph(filters.from)}`);
  if (filters.to) clauses.push(`"timestamp" <= ${ph(normalizeTo(filters.to))}`);
  if (filters.device) clauses.push(`device_category = ${ph(filters.device)}`);
  if (filters.country) clauses.push(`country = ${ph(filters.country)}`);
  if (filters.channel) clauses.push(`channel = ${ph(filters.channel)}`);
  if (filters.source) clauses.push(`source = ${ph(filters.source)}`);

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, params };
}
