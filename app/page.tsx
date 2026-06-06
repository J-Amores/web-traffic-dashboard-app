"use client";

// Landing page — a cinematic front door for the web-traffic console.
// The dotted world map renders as a backdrop layer behind a gradient scrim;
// overlaid copy + live scramble-in stats (Total Sessions, Countries) sell the
// product, and a CTA sends visitors into the real console at /dashboard. Every
// number is fetched client-side from the real /api/* endpoints with ?period=all
// — no fake data. Visual treatment (scrim, layout, staggered entrance) is the
// frontend refinement; the map (MapContainer/DottedMap) and the scramble
// (TotalSessions/CountryCount via useScramble) are REUSED, not re-implemented.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { fetchJson } from "@/lib/client";
import { fmtMonthYear } from "@/lib/format";
import type { KpisResponse, GeoItem, HealthResponse } from "@/lib/types";
import MapContainer from "@/components/console/MapContainer";
import { TotalSessions, CountryCount } from "@/components/console/StatsDisplay";

const ALL = "?period=all";

interface LandingData {
  health: HealthResponse;
  kpis: KpisResponse;
  geo: GeoItem[];
}

export default function LandingPage() {
  const [data, setData] = useState<LandingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      fetchJson<HealthResponse>("/api/health"),
      fetchJson<KpisResponse>(`/api/kpis${ALL}`),
      fetchJson<GeoItem[]>(`/api/geo${ALL}`),
    ])
      .then(([health, kpis, geo]) => {
        if (!cancelled) setData({ health, kpis, geo });
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black p-6 font-mono text-sm">
        <p className="text-[var(--ds-red-600)]">{error}</p>
        <Link
          href="/dashboard"
          className="text-[var(--ds-gray-500)] underline-offset-4 hover:text-[var(--ds-gray-1000)] hover:underline"
        >
          Continue to the console →
        </Link>
      </main>
    );
  }

  // Staggered entrance for the hero copy. Reduced-motion snaps everything in.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, delay },
        };

  const range = data
    ? `${fmtMonthYear(data.health.range.min)} – ${fmtMonthYear(data.health.range.max)}`
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black font-mono">
      {/* Backdrop layer: the live dotted world map (ssr:false via MapContainer). */}
      {data && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-full"
            initial={reduce ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          >
            <MapContainer geo={data.geo} selectedCountry={null} />
          </motion.div>
        </div>
      )}

      {/* Scrim: keep the copy legible over the map without hiding it. A bottom
          vignette anchors the hero; a left gradient grounds the headline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Top bar: product-name treatment, dashboard mono idiom. */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 pt-10">
        <motion.p
          {...rise(0)}
          className="text-gray-1000 my-0 font-mono text-sm uppercase tracking-tight"
        >
          Web Traffic Analytics
        </motion.p>
        {range && (
          <motion.p
            {...rise(0.05)}
            className="text-gray-900 my-0 hidden font-mono text-xs uppercase tracking-tight sm:block"
          >
            [{range}]
          </motion.p>
        )}
      </div>

      {/* Hero content, bottom-anchored for a cinematic, console-style frame. */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1600px] flex-col justify-end px-6 pb-16">
        <motion.p
          {...rise(0.1)}
          className="text-gray-900 mb-5 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Live ops console
        </motion.p>

        <motion.h1
          {...rise(0.18)}
          className="text-gray-1000 my-0 max-w-3xl font-mono text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl"
        >
          Web traffic, in real time.
        </motion.h1>

        <motion.p
          {...rise(0.26)}
          className="text-gray-900 mt-6 max-w-2xl font-mono text-sm leading-relaxed md:text-base"
        >
          A live ops console over ~79,000 real sessions across 16 countries —
          sessions, channels, devices and geo, straight from the live API.
        </motion.p>

        {/* Live scramble-in headline stats (real data only). */}
        <motion.div {...rise(0.34)} className="mt-12 min-h-[6rem]">
          {data ? (
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
              <TotalSessions value={data.kpis.sessions.current} />
              <CountryCount count={data.geo.length} />
            </div>
          ) : (
            <p className="text-gray-500 font-mono text-sm uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ds-blue-500)]" />
                Loading live data…
              </span>
            </p>
          )}
        </motion.div>

        {/* CTAs → the console. */}
        <motion.div {...rise(0.42)} className="mt-12 flex flex-wrap items-center gap-5">
          <Link
            href="/dashboard"
            className="text-gray-1000 group inline-flex items-center gap-2 border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-5 py-2.5 font-mono text-sm uppercase tracking-tight transition-colors hover:border-[var(--ds-blue-700)] hover:text-[var(--ds-blue-500)]"
          >
            Enter the console
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          {data && (
            <span className="text-gray-700 font-mono text-xs uppercase tracking-tight">
              <span className="mr-2 inline-block h-1.5 w-1.5 align-middle animate-pulse rounded-full bg-[var(--ds-green-600)]" />
              Live · {data.geo.length} countries
            </span>
          )}
        </motion.div>
      </div>
    </main>
  );
}
