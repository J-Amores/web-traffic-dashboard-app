// Shared WHERE-clause builder. All user values are passed as bound
// parameters ($1, $2, …) — parametrized statements only — to prevent SQL
// injection.
//
// `from`/`to` compare against the `"timestamp"` column (Postgres TIMESTAMP).
// String params in 'YYYY-MM-DD HH:MM:SS' form are implicitly cast to timestamp
// by Postgres. A bare date 'YYYY-MM-DD' for `to` is expanded to the end of the
// day so the whole day is inclusive. `"timestamp"` is quoted because it is a
// Postgres reserved keyword.

export interface FilterParams {
  from?: string;
  to?: string;
  platform?: string;
  location?: string;
  brand?: string;
  campaign?: string;
  sentiment?: string;
}

export interface WhereResult {
  where: string; // e.g. 'WHERE platform = $1 AND "timestamp" >= $2' or ""
  params: (string | number)[];
}

const ALLOWED_KEYS: (keyof FilterParams)[] = [
  "from",
  "to",
  "platform",
  "location",
  "brand",
  "campaign",
  "sentiment",
];

/**
 * Extract only the known filter params from a URLSearchParams, ignoring any
 * unknown keys. Empty strings are treated as absent.
 */
export function parseFilters(search: URLSearchParams): FilterParams {
  const out: FilterParams = {};
  for (const key of ALLOWED_KEYS) {
    const raw = search.get(key);
    if (raw !== null && raw.trim() !== "") {
      out[key] = raw.trim();
    }
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
  if (filters.platform) clauses.push(`platform = ${ph(filters.platform)}`);
  if (filters.location) clauses.push(`location = ${ph(filters.location)}`);
  if (filters.brand) clauses.push(`brand_name = ${ph(filters.brand)}`);
  if (filters.campaign) clauses.push(`campaign_name = ${ph(filters.campaign)}`);
  if (filters.sentiment) {
    clauses.push(`sentiment_label = ${ph(filters.sentiment)}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, params };
}
