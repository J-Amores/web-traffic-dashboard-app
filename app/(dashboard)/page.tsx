"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Users,
  Gauge,
  Eye,
  Clock,
  Smartphone,
  Globe2,
  Share2,
  Layers,
  FileText,
} from "lucide-react";
import type {
  KpisResponse,
  DeviceBreakdownItem,
  ReferrerBreakdownItem,
  GeoItem,
  ChannelBreakdownItem,
  PageBreakdownItem,
} from "@/lib/types";
import { fetchJson, useFilters } from "@/lib/client";
import { fmtInt, fmtRate, fmtPct, fmtSeconds } from "@/lib/format";
import Panel from "@/components/ui/Panel";
import KpiTile from "@/components/ui/KpiTile";
import DeltaBadge from "@/components/ui/DeltaBadge";
import HBar from "@/components/charts/HBar";
import MiniDonut from "@/components/charts/MiniDonut";
import GeoBubbles from "@/components/charts/GeoBubbles";
import Sparkline from "@/components/charts/Sparkline";

interface CockpitData {
  kpis: KpisResponse;
  devices: DeviceBreakdownItem[];
  referrers: ReferrerBreakdownItem[];
  geo: GeoItem[];
  channels: ChannelBreakdownItem[];
  pages: PageBreakdownItem[];
}

export default function CockpitPage() {
  // useFilters() reads the querystring; wrap in Suspense for static prerender.
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Cockpit />
    </Suspense>
  );
}

function Cockpit() {
  const { query } = useFilters();
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      fetchJson<KpisResponse>(`/api/kpis${query}`),
      fetchJson<DeviceBreakdownItem[]>(`/api/breakdown/devices${query}`),
      fetchJson<ReferrerBreakdownItem[]>(`/api/breakdown/referrers${query}`),
      fetchJson<GeoItem[]>(`/api/geo${query}`),
      fetchJson<ChannelBreakdownItem[]>(`/api/breakdown/channels${query}`),
      fetchJson<PageBreakdownItem[]>(`/api/pages${query}`),
    ])
      .then(([kpis, devices, referrers, geo, channels, pages]) => {
        if (!cancelled) setData({ kpis, devices, referrers, geo, channels, pages });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (error) {
    return (
      <div className="rounded-3xl bg-panel p-6 text-sm text-down shadow-tile ring-1 ring-grid/70">
        {error}
      </div>
    );
  }

  if (!data) return <CockpitSkeleton />;

  const { kpis, devices, referrers, geo, channels, pages } = data;
  const referrerMax = Math.max(...referrers.map((b) => b.count), 1);
  const pageMax = Math.max(...pages.map((p) => p.count), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Hero KPI row: featured lead tile + three supporting tiles */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <KpiTile
          featured
          index={0}
          label="Total Sessions"
          format={(n) => fmtInt(n)}
          block={kpis.sessions}
          icon={Users}
        />
        <KpiTile
          index={1}
          label="Session Duration"
          format={(n) => fmtSeconds(n)}
          block={kpis.sessionDuration}
          icon={Gauge}
        />
        <KpiTile
          index={2}
          label="Avg Unique Pageviews"
          format={(n) => fmtRate(n)}
          block={kpis.uniquePageviews}
          icon={Eye}
        />
        <KpiTile
          index={3}
          label="Avg Time on Page"
          format={(n) => fmtSeconds(n)}
          block={kpis.timeOnPage}
          icon={Clock}
        />
      </div>

      {/* Bento mid row: devices (narrow) · geo map (wide) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel
          index={4}
          icon={Smartphone}
          title="Which devices bring the most sessions?"
          aside="Sessions by device"
          className="lg:col-span-4"
        >
          <ul className="flex flex-col gap-4">
            {devices.map((d) => (
              <li key={d.device} className="flex items-center gap-3.5">
                <MiniDonut pct={d.sharePct} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{d.device}</span>
                    <DeltaBadge value={d.deltaPct} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span className="tnum">{fmtInt(d.count)} sessions</span>
                    <span className="tnum">{fmtPct(d.sharePct)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          index={5}
          icon={Globe2}
          title="Where does the traffic come from?"
          aside="Sessions by city"
          className="lg:col-span-8"
        >
          <GeoBubbles data={geo} className="aspect-[2/1] w-full" />
        </Panel>
      </div>

      {/* Bento lower row: referral sites · channels · most-visited pages */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel
          index={6}
          icon={Share2}
          title="Which referral sites bring the most traffic?"
          aside="Sessions"
          className="lg:col-span-4"
        >
          <ul className="flex flex-col gap-3.5">
            {referrers.slice(0, 7).map((b, i) => (
              <li key={`${b.source}-${b.medium}`}>
                <HBar
                  label={b.source}
                  value={b.count}
                  max={referrerMax}
                  display={fmtInt(b.count)}
                  hint={b.medium}
                  index={i}
                />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          index={7}
          icon={Layers}
          title="Channels"
          aside="Sessions · trend"
          className="lg:col-span-4"
        >
          <ul className="flex flex-col gap-3.5">
            {channels.map((c) => (
              <li key={c.channel} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12px] text-ink-soft" title={c.channel}>
                  {c.channel}
                </span>
                <Sparkline data={c.sparkline} width={110} height={28} className="flex-1" />
                <span className="tnum w-16 shrink-0 text-right text-[12px] font-semibold text-ink">
                  {fmtInt(c.count)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          index={8}
          icon={FileText}
          title="What are the most visited pages?"
          aside="Sessions · bounce"
          className="lg:col-span-4"
        >
          <ul className="flex flex-col gap-3.5">
            {pages.slice(0, 7).map((p, i) => (
              <li key={p.pageTitle} className="flex items-center gap-3">
                <HBar
                  label={p.pageTitle}
                  value={p.count}
                  max={pageMax}
                  display={fmtInt(p.count)}
                  hint={`${fmtSeconds(p.avgTimeOnPage)} on page`}
                  index={i}
                  className="flex-1"
                />
                <span className="tnum w-12 shrink-0 text-right text-[11px] font-medium text-muted">
                  {fmtPct(p.bounceRate * 100)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-40 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="shimmer h-72 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70 lg:col-span-4" />
        <div className="shimmer h-72 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70 lg:col-span-8" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer h-64 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70 lg:col-span-4" />
        ))}
      </div>
    </div>
  );
}
