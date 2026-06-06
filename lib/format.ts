// Display formatters shared across dashboard views.

/** Compact integer, e.g. 12000 -> "12,000". */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Abbreviated large number, e.g. 49811 -> "49.8K", 62657448 -> "62.7M". */
export function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Engagement rate (0..1-ish ratio) shown as a single-decimal value. */
export function fmtRate(n: number): string {
  return n.toFixed(2);
}

/** Percentage with one decimal, e.g. 20.258 -> "20.3%". */
export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Duration in seconds, e.g. 52.4 -> "52 s". */
export function fmtSeconds(n: number): string {
  return `${Math.round(n)} s`;
}

/** Signed delta percentage for badges, e.g. 6.6 -> "+6.6%", 0 -> "0.0%". */
export function fmtDelta(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 'YYYY-MM' -> "Apr '25" for chart tooltips/axes. */
export function fmtMonth(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  if (!m) return ym;
  const month = MONTHS[Number(m[2]) - 1] ?? "";
  return `${month} '${m[1].slice(2)}`;
}

/** 'YYYY-MM-DD HH:MM:SS' -> "Jan 2024" (month + full year), for the header line. */
export function fmtMonthYear(ts: string): string {
  const m = ts.match(/^(\d{4})-(\d{2})/);
  if (!m) return ts;
  const month = MONTHS[Number(m[2]) - 1] ?? "";
  return `${month} ${m[1]}`;
}
