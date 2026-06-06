"use client";

// Country hover mini-dashboard. Mounts as a floating panel over the dotted map
// when a country hotspot is hovered, and shows REAL per-country aggregates by
// re-fetching the existing GET routes filtered with ?period=all&country=<C>.
//
// Layout: a LANDSCAPE card — a 3-up KPI strip (each with a mini trend
// sparkline) over a 2x2 grid of chart blocks (Devices / Channels / Top
// referrers / Top pages) drawn as proportional bar rows.
//
// Resilience contract (see .harness/api-contract.md):
//   - results cached per-country (re-hover = no loader re-flash);
//   - stale responses from rapid hovering are ignored (request-id guard);
//   - fetch failure renders an error state, never crashes;
//   - prefers-reduced-motion disables the open transition + loader pulse +
//     bar-grow + sparkline draw.

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fetchJson } from "@/lib/client";
import { fmtInt, fmtPct } from "@/lib/format";
import { iso2For, colorForIso2 } from "@/lib/country-meta";
import type {
  KpisResponse,
  DeviceBreakdownItem,
  ChannelBreakdownItem,
  ReferrerBreakdownItem,
  PageBreakdownItem,
  SparklinePoint,
} from "@/lib/types";

interface CountryData {
  kpis: KpisResponse;
  devices: DeviceBreakdownItem[];
  channels: ChannelBreakdownItem[];
  referrers: ReferrerBreakdownItem[];
  pages: PageBreakdownItem[];
}

type Status =
  | { state: "loading" }
  | { state: "ready"; data: CountryData }
  | { state: "error"; message: string };

// Module-level cache keyed by raw country name. Survives hover churn and
// component unmounts so re-hovering a country never re-flashes the loader.
const CACHE = new Map<string, CountryData>();

async function loadCountry(country: string): Promise<CountryData> {
  const q = `?period=all&country=${encodeURIComponent(country)}`;
  const [kpis, devices, channels, referrers, pages] = await Promise.all([
    fetchJson<KpisResponse>(`/api/kpis${q}`),
    fetchJson<DeviceBreakdownItem[]>(`/api/breakdown/devices${q}`),
    fetchJson<ChannelBreakdownItem[]>(`/api/breakdown/channels${q}`),
    fetchJson<ReferrerBreakdownItem[]>(`/api/breakdown/referrers${q}`),
    fetchJson<PageBreakdownItem[]>(`/api/pages${q}`),
  ]);
  return { kpis, devices, channels, referrers, pages };
}

/**
 * Fetch (or replay from cache) per-country data. A monotonically increasing
 * request id guards against rapid hover churn: only the response for the
 * latest requested country is allowed to set state.
 */
function useCountryData(country: string): Status {
  const [status, setStatus] = useState<Status>(() =>
    CACHE.has(country)
      ? { state: "ready", data: CACHE.get(country)! }
      : { state: "loading" },
  );
  const reqRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqRef.current;

    const cached = CACHE.get(country);
    if (cached) {
      setStatus({ state: "ready", data: cached });
      return;
    }

    setStatus({ state: "loading" });
    loadCountry(country)
      .then((data) => {
        CACHE.set(country, data);
        if (reqRef.current === reqId) setStatus({ state: "ready", data });
      })
      .catch((e: unknown) => {
        if (reqRef.current === reqId)
          setStatus({
            state: "error",
            message: e instanceof Error ? e.message : "Failed to load",
          });
      });
  }, [country]);

  return status;
}

/* ------------------------------- subviews -------------------------------- */

/** Tiny static trend line for a KPI's 16-month per-country sparkline. */
function Sparkline({ data }: { data: SparklinePoint[] }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const W = 100;
  const H = 20;
  const pts = data
    .map(
      (d, i) =>
        `${((i / (data.length - 1)) * W).toFixed(1)},${(
          H -
          ((d.value - min) / span) * H
        ).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-1 h-5 w-full text-[var(--ds-blue-500)]"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KpiSpark({
  label,
  value,
  unit,
  data,
}: {
  label: string;
  value: string;
  unit: string;
  data: SparklinePoint[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-[var(--ds-gray-500)]">
        {label}
      </span>
      <span className="text-lg leading-none tabular-nums text-[var(--ds-gray-1000)]">
        {value}
      </span>
      <span className="text-[9px] text-[var(--ds-gray-500)]">{unit}</span>
      <Sparkline data={data} />
    </div>
  );
}

/** One labelled metric drawn as a proportional bar (frac in 0..1). */
function BarRow({
  label,
  value,
  frac,
  color,
}: {
  label: string;
  value: string;
  frac: number;
  color: string;
}) {
  const reduce = useReducedMotion();
  const pct = Math.max(2, Math.min(100, frac * 100));
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="truncate text-[var(--ds-gray-700)]">{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--ds-gray-900)]">
          {value}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--ds-gray-200)]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
        />
      </div>
    </li>
  );
}

function ChartBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[9px] uppercase tracking-wide text-[var(--ds-gray-500)]">
        {title}
      </span>
      <ul className="m-0 list-none space-y-1.5 p-0">{children}</ul>
    </div>
  );
}

function PanelBody({ country, count }: { country: string; count: number }) {
  const status = useCountryData(country);
  const reduce = useReducedMotion();
  const iso = iso2For(country);
  const color = iso ? colorForIso2(iso) : "var(--ds-gray-500)";

  return (
    <div className="w-[min(580px,86vw)] space-y-3 font-mono">
      {/* Header — keeps the original `country · N sessions` info line. */}
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--ds-gray-200)] pb-2">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--ds-gray-1000)]">
          <span aria-hidden="true" style={{ color }}>
            ■
          </span>
          {country}
        </span>
        <span className="tabular-nums text-xs text-[var(--ds-gray-900)]">
          {fmtInt(count)} sessions
        </span>
      </div>

      {status.state === "loading" && (
        <div
          className={`space-y-3 ${reduce ? "" : "animate-pulse"}`}
          aria-busy="true"
        >
          <div className="grid grid-cols-3 gap-3 border-b border-[var(--ds-gray-200)] pb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-12 rounded bg-[var(--ds-gray-200)]" />
                <div className="h-5 w-10 rounded bg-[var(--ds-gray-200)]" />
                <div className="h-4 w-full rounded bg-[var(--ds-gray-200)]" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2 w-16 rounded bg-[var(--ds-gray-200)]" />
                <div className="h-1.5 w-full rounded bg-[var(--ds-gray-200)]" />
                <div className="h-1.5 w-5/6 rounded bg-[var(--ds-gray-200)]" />
                <div className="h-1.5 w-3/4 rounded bg-[var(--ds-gray-200)]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {status.state === "error" && (
        <p className="m-0 text-[11px] leading-relaxed text-[var(--ds-red-600)]">
          Couldn&apos;t load {country} data. {status.message}
        </p>
      )}

      {status.state === "ready" && (
        <PanelContent data={status.data} color={color} />
      )}
    </div>
  );
}

function PanelContent({
  data,
  color,
}: {
  data: CountryData;
  color: string;
}) {
  const { kpis, devices, channels, referrers, pages } = data;
  const topChannels = channels.slice(0, 4);
  const chMax = Math.max(1, ...topChannels.map((c) => c.count));
  const topReferrers = referrers.slice(0, 4);
  const refMax = Math.max(1, ...topReferrers.map((r) => r.count));
  const topPages = pages.slice(0, 4);

  return (
    <div className="space-y-3">
      {/* KPI strip with mini trend sparklines */}
      <div className="grid grid-cols-3 gap-3 border-b border-[var(--ds-gray-200)] pb-3">
        <KpiSpark
          label="Duration"
          value={`${Math.round(kpis.sessionDuration.current)}`}
          unit="sec avg"
          data={kpis.sessionDuration.sparkline}
        />
        <KpiSpark
          label="Time / page"
          value={`${Math.round(kpis.timeOnPage.current)}`}
          unit="sec avg"
          data={kpis.timeOnPage.sparkline}
        />
        <KpiSpark
          label="Unique PV"
          value={kpis.uniquePageviews.current.toFixed(1)}
          unit="per sess"
          data={kpis.uniquePageviews.sparkline}
        />
      </div>

      {/* 2x2 chart grid — landscape */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <ChartBlock title="Devices">
          {devices.map((d) => (
            <BarRow
              key={d.device}
              label={d.device}
              value={fmtPct(d.sharePct)}
              frac={d.sharePct / 100}
              color={color}
            />
          ))}
        </ChartBlock>

        <ChartBlock title="Channels">
          {topChannels.map((c) => (
            <BarRow
              key={c.channel}
              label={c.channel}
              value={fmtInt(c.count)}
              frac={c.count / chMax}
              color={color}
            />
          ))}
        </ChartBlock>

        <ChartBlock title="Top referrers">
          {topReferrers.map((r) => (
            <BarRow
              key={`${r.source}-${r.medium}`}
              label={r.source}
              value={fmtInt(r.count)}
              frac={r.count / refMax}
              color={color}
            />
          ))}
        </ChartBlock>

        <ChartBlock title="Top pages (bounce)">
          {topPages.map((p) => (
            <BarRow
              key={p.pageTitle}
              label={p.pageTitle}
              value={fmtPct(p.bounceRate * 100)}
              frac={p.bounceRate}
              color={color}
            />
          ))}
        </ChartBlock>
      </div>
    </div>
  );
}

/* -------------------------------- panel ---------------------------------- */

export interface CountryPanelProps {
  country: string;
  count: number;
}

/**
 * The mini-dashboard card. Rendered in a fixed spot beside the "Top Countries"
 * list (selection is driven by hovering that list, not the map), so it no
 * longer needs to anchor/flip against a map hotspot. Fades + scales in on
 * mount and out on unmount (via the parent's <AnimatePresence>); honors
 * prefers-reduced-motion.
 */
export default function CountryPanel({ country, count }: CountryPanelProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 shadow-2xl ring-1 ring-black/40"
      initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.97, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
      transition={{ duration: reduce ? 0 : 0.18, ease: "easeOut" }}
    >
      <PanelBody country={country} count={count} />
    </motion.div>
  );
}
