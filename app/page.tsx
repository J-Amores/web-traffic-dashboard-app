"use client";

// Live-ops web-traffic console — a single dark, monospace scrolling page.
// Hero: dotted pixel world map + overlaid stats column. Below: dark card grid.
// Every number is fetched client-side from our real /api/* endpoints with
// ?period=all so the console shows full-dataset totals.

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client";
import { fmtMonthYear } from "@/lib/format";
import type {
  KpisResponse,
  GeoItem,
  DeviceBreakdownItem,
  ChannelBreakdownItem,
  ReferrerBreakdownItem,
  PageBreakdownItem,
  HealthResponse,
} from "@/lib/types";
import MapContainer from "@/components/console/MapContainer";
import {
  TotalSessions,
  TopCountries,
  CountryCount,
  StatsGrid,
} from "@/components/console/StatsDisplay";

const ALL = "?period=all";

interface ConsoleData {
  health: HealthResponse;
  kpis: KpisResponse;
  geo: GeoItem[];
  devices: DeviceBreakdownItem[];
  channels: ChannelBreakdownItem[];
  referrers: ReferrerBreakdownItem[];
  pages: PageBreakdownItem[];
}

export default function ConsolePage() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      fetchJson<HealthResponse>("/api/health"),
      fetchJson<KpisResponse>(`/api/kpis${ALL}`),
      fetchJson<GeoItem[]>(`/api/geo${ALL}`),
      fetchJson<DeviceBreakdownItem[]>(`/api/breakdown/devices${ALL}`),
      fetchJson<ChannelBreakdownItem[]>(`/api/breakdown/channels${ALL}`),
      fetchJson<ReferrerBreakdownItem[]>(`/api/breakdown/referrers${ALL}`),
      fetchJson<PageBreakdownItem[]>(`/api/pages${ALL}`),
    ])
      .then(([health, kpis, geo, devices, channels, referrers, pages]) => {
        if (!cancelled)
          setData({ health, kpis, geo, devices, channels, referrers, pages });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 font-mono text-sm text-[var(--ds-red-600)]">
        {error}
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black font-mono text-sm uppercase tracking-widest text-[var(--ds-gray-500)]">
        Loading console…
      </main>
    );
  }

  const { health, kpis, geo, devices, channels, referrers, pages } = data;
  const range = `${fmtMonthYear(health.range.min)} – ${fmtMonthYear(health.range.max)}`;
  const countryCount = geo.length;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-[min(100vw,1600px)] flex-col overflow-hidden px-6 pt-12 font-mono md:block md:pt-16">
      <div className="mx-auto mb-12 mt-1 w-full max-w-[1600px] space-y-1.5">
        {/* Mobile / narrow layout */}
        <div className="flex flex-col min-[961px]:hidden">
          <header className="mb-6 flex flex-col items-start gap-2 font-mono text-sm uppercase">
            <p className="text-gray-1000 my-0 whitespace-nowrap font-mono">
              Web Traffic Analytics{" "}
              <span className="text-gray-900 block font-mono">[{range}]</span>
            </p>
          </header>

          <section className="w-full pb-6">
            <div className="flex flex-col gap-y-6">
              <TotalSessions value={kpis.sessions.current} />
              <TopCountries geo={geo} />
            </div>
            <CountryCount count={countryCount} />
          </section>

          <div className="flex w-full justify-center">
            <MapContainer geo={geo} />
          </div>
        </div>

        {/* Wide layout: stats column overlaid on the full-width map */}
        <div className="relative hidden flex-row min-[961px]:flex lg:items-center lg:justify-between">
          <header className="mb-auto flex flex-col items-start gap-2 font-mono text-sm uppercase xl:text-base">
            <p className="text-gray-1000 my-0 whitespace-nowrap font-mono">
              Web Traffic Analytics{" "}
              <span className="text-gray-900 block font-mono">[{range}]</span>
            </p>
          </header>

          <section className="relative z-10 w-fit pb-6 lg:absolute lg:bottom-0">
            <div className="flex flex-col gap-y-8">
              <TotalSessions value={kpis.sessions.current} />
              <TopCountries geo={geo} />
            </div>
            <CountryCount count={countryCount} />
          </section>

          <div className="pointer-events-none h-full w-full">
            <div className="pointer-events-auto">
              <MapContainer geo={geo} />
            </div>
          </div>
        </div>

        <section className="mt-8">
          <StatsGrid
            kpis={kpis}
            devices={devices}
            channels={channels}
            referrers={referrers}
            pages={pages}
          />
        </section>
      </div>
    </main>
  );
}
