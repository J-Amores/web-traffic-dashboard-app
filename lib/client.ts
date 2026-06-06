// Client-side data access: typed fetch + shared URL-state filters.
// Response shapes come from lib/types.ts — never redefine them here.
"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Shared, optional filter params. The API whitelists these; unknown keys ignored.
// `period` is included so the header period selector flows through useFilters().
export const FILTER_KEYS = [
  "from",
  "to",
  "device",
  "country",
  "channel",
  "source",
  "period",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

// Period presets (mirror lib/filters.ts PeriodPreset; default is "month").
export const PERIOD_PRESETS = ["month", "3m", "6m", "12m", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: "This month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  all: "All time",
};

// Banner phrasing reflecting the active selection against the loaded data range
// (2024-01 -> 2025-04). Honest, current-vs-prior framing where it applies.
export const PERIOD_BANNERS: Record<PeriodPreset, string> = {
  month: "Apr 2025 compared to Mar 2025",
  "3m": "Feb 2025 – Apr 2025 vs the prior 3 months",
  "6m": "Nov 2024 – Apr 2025 vs the prior 6 months",
  "12m": "May 2024 – Apr 2025 (full year)",
  all: "All available data (Jan 2024 – Apr 2025)",
};

/**
 * Fetch JSON from an internal API path, typed by the caller.
 * Throws on non-2xx so callers can surface an error state.
 */
export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

/** Build a querystring (with leading `?`) from a filters object, dropping empties. */
export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Read/write the shared filter querystring. `query` is the leading-`?` string to
 * append to every fetch; `set`/`clear` update the URL (shallow, no scroll reset).
 */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const out: Filters = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) out[key] = value;
    }
    return out;
  }, [searchParams]);

  const query = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams]);

  const set = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of FILTER_KEYS) {
        const value = next[key];
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  // Active period preset (defaults to "month" when absent/invalid).
  const period = useMemo<PeriodPreset>(() => {
    const raw = searchParams.get("period");
    return raw && (PERIOD_PRESETS as readonly string[]).includes(raw)
      ? (raw as PeriodPreset)
      : "month";
  }, [searchParams]);

  const setPeriod = useCallback(
    (next: PeriodPreset) => {
      const params = new URLSearchParams(searchParams.toString());
      // Keep the URL clean: omit the default.
      if (next === "month") params.delete("period");
      else params.set("period", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { filters, query, set, clear, period, setPeriod };
}
