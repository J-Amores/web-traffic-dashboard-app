"use client";

import { Suspense, useEffect, useState } from "react";
import { Users, Gauge, Eye, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MetricKey, DimensionKey, TopPerformersResponse } from "@/lib/types";
import { fetchJson, useFilters } from "@/lib/client";
import { fmtInt, fmtRate, fmtSeconds } from "@/lib/format";
import Panel from "@/components/ui/Panel";
import DeltaBadge from "@/components/ui/DeltaBadge";
import TrendColumns from "@/components/charts/TrendColumns";
import Sparkline from "@/components/charts/Sparkline";

interface MetricMeta {
  key: MetricKey;
  label: string;
  icon: LucideIcon;
  format: (n: number) => string;
}

// Metric rows, in the mockup's order.
const METRICS: MetricMeta[] = [
  { key: "sessions", label: "Total Sessions", icon: Users, format: fmtInt },
  { key: "sessionDuration", label: "Session Duration", icon: Gauge, format: fmtSeconds },
  { key: "uniquePageviews", label: "Avg Unique Pageviews", icon: Eye, format: fmtRate },
  { key: "timeOnPage", label: "Avg Time on Page", icon: Clock, format: fmtSeconds },
];

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: "sourceMedium", label: "Source / Medium" },
  { key: "source", label: "Source" },
  { key: "channel", label: "Channel" },
  { key: "device", label: "Device" },
  { key: "country", label: "Country" },
  { key: "page", label: "Page" },
];

export default function TopPerformersPage() {
  return (
    <Suspense fallback={<TopPerformersSkeleton />}>
      <TopPerformers />
    </Suspense>
  );
}

function TopPerformers() {
  const { query } = useFilters();
  const [dimension, setDimension] = useState<DimensionKey>("sourceMedium");
  const [rows, setRows] = useState<TopPerformersResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);
    Promise.all(
      METRICS.map((m) =>
        fetchJson<TopPerformersResponse>(
          `/api/top-performers${query ? `${query}&` : "?"}metric=${m.key}&dimension=${dimension}`,
        ),
      ),
    )
      .then((res) => {
        if (!cancelled) setRows(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [query, dimension]);

  return (
    <div className="flex flex-col gap-5">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-ink">
          Top performers by metric
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <span>Top by</span>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as DimensionKey)}
            className="rounded-xl bg-panel px-3 py-2 text-[12px] font-medium text-ink shadow-tile ring-1 ring-grid/70 outline-none focus:ring-accent/40"
          >
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-3xl bg-panel p-6 text-sm text-down shadow-tile ring-1 ring-grid/70">
          {error}
        </div>
      ) : !rows ? (
        <TopPerformersSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          {METRICS.map((meta, i) => (
            <MetricRow key={meta.key} meta={meta} data={rows[i]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricRow({
  meta,
  data,
  index,
}: {
  meta: MetricMeta;
  data: TopPerformersResponse;
  index: number;
}) {
  const Icon = meta.icon;
  const latest = data.monthlyTrend.at(-1)?.value ?? 0;
  const topMax = Math.max(...data.top.map((t) => t.value), 1);

  return (
    <Panel index={index} icon={Icon} title={meta.label} aside="Monthly trend vs prior">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Headline value */}
        <div className="lg:col-span-2">
          <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink">
            {meta.format(latest)}
          </div>
          <div className="mt-1.5 text-[11px] text-muted">latest month</div>
        </div>

        {/* Monthly trend columns */}
        <div className="lg:col-span-4">
          <TrendColumns data={data.monthlyTrend} height={120} />
        </div>

        {/* Top performers list */}
        <div className="lg:col-span-6">
          <ul className="flex flex-col gap-3">
            {data.top.slice(0, 6).map((t) => (
              <li key={t.key} className="flex items-center gap-3">
                <span
                  className="w-32 shrink-0 truncate text-[12px] text-ink-soft"
                  title={t.key}
                >
                  {t.key}
                </span>
                <Sparkline data={t.sparkline} width={72} height={26} className="shrink-0" />
                <div className="relative h-3.5 flex-1 rounded-full bg-grid/70">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent-grad"
                    style={{ width: `${Math.max(2, (t.value / topMax) * 100)}%` }}
                  />
                </div>
                <span className="tnum w-16 shrink-0 text-right text-[12px] font-semibold text-ink">
                  {meta.format(t.value)}
                </span>
                <DeltaBadge value={t.deltaPct} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function TopPerformersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-44 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70"
        />
      ))}
    </div>
  );
}
