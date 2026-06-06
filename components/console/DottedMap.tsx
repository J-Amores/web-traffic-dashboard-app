"use client";

// Dotted pixel world map, ported from the Vercel-style template and rewired
// to OUR data: dot color + density + pulse are driven by per-country session
// counts from /api/geo. Vercel edge-POP markers were dropped entirely.

import { useMemo, memo, useState } from "react";
import { motion } from "framer-motion";
import { geoMercator } from "d3-geo";
import dottedMapData from "@/lib/data/dotted-map-data.json";
import { iso2For, colorForIso2 } from "@/lib/country-meta";
import { fmtInt } from "@/lib/format";
import type { GeoItem } from "@/lib/types";

type DotCity = { lon: number; lat: number; cityDistanceRank: number };
const MAP_DATA = dottedMapData as Record<string, DotCity[]>;

const MIN_DOTS = 2;
const MAX_DOTS = 35;
const PULSE_TOP_N = 7; // top N countries by sessions get pulsing dots

/**
 * Scale a country's session count into the template's 2..35 dot range,
 * relative to the busiest country. Uses a sqrt curve so smaller countries
 * still surface a few colored dots instead of collapsing to the floor.
 */
function dotsForCount(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return MIN_DOTS;
  const ratio = Math.sqrt(count / maxCount); // 0..1, eased
  return Math.round(MIN_DOTS + ratio * (MAX_DOTS - MIN_DOTS));
}

const StaticPixel = memo(({ x, y }: { x: number; y: number }) => (
  <rect
    x={x}
    y={y}
    width={3}
    height={3}
    className="fill-[var(--ds-gray-400)]"
    fillOpacity={0.5}
  />
));
StaticPixel.displayName = "StaticPixel";

const AnimatedPixel = memo(
  ({
    x,
    y,
    color,
    canPulse,
    cityDistanceRank,
  }: {
    x: number;
    y: number;
    color: string;
    canPulse: boolean;
    cityDistanceRank: number;
  }) => {
    const delay = useMemo(() => cityDistanceRank * 0.1, [cityDistanceRank]);

    const animate = canPulse
      ? { scale: [1, 1.8, 1], opacity: [0.8, 1, 0.8] }
      : { scale: 1, opacity: 1 };

    const transition = canPulse
      ? {
          opacity: {
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
            repeatDelay: delay,
          },
          scale: {
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
            repeatDelay: delay,
          },
        }
      : { type: "spring" as const, stiffness: 260, damping: 20 };

    return (
      <motion.rect
        x={x}
        y={y}
        width={3}
        height={3}
        fill={color}
        animate={animate}
        transition={transition}
        style={{
          willChange:
            canPulse && cityDistanceRank < 10 ? "transform, opacity" : undefined,
        }}
      />
    );
  }
);
AnimatedPixel.displayName = "AnimatedPixel";

interface Tooltip {
  x: number;
  y: number;
  country: string;
  count: number;
}

interface DottedMapProps {
  geo: GeoItem[];
  width?: number;
  height?: number;
}

export default function DottedMap({
  geo,
  width = 1000,
  height = 560,
}: DottedMapProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const projection = useMemo(
    () =>
      geoMercator()
        .scale(140)
        .center([15, 25])
        .rotate([0, 0, 0])
        .translate([width / 2, height / 2]),
    [width, height]
  );

  // Per-ISO2 session count + pulse eligibility derived from /api/geo.
  const countByIso2 = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of geo) {
      const iso = iso2For(g.country);
      if (iso) map.set(iso, g.count);
    }
    return map;
  }, [geo]);

  const pulseSet = useMemo(() => {
    const ranked = [...geo]
      .sort((a, b) => b.count - a.count)
      .slice(0, PULSE_TOP_N)
      .map((g) => iso2For(g.country))
      .filter((x): x is string => Boolean(x));
    return new Set(ranked);
  }, [geo]);

  const maxCount = useMemo(
    () => geo.reduce((m, g) => Math.max(m, g.count), 0),
    [geo]
  );

  const { staticPixels, animatedPixels } = useMemo(() => {
    const staticArr: Array<{ key: string; x: number; y: number }> = [];
    const animatedArr: Array<{
      key: string;
      x: number;
      y: number;
      color: string;
      canPulse: boolean;
      cityDistanceRank: number;
    }> = [];

    Object.entries(MAP_DATA).forEach(([countryCode, cities]) => {
      const count = countByIso2.get(countryCode);
      // Countries without traffic (or not in our 16) render as gray dots only.
      const dotsToShow = count ? dotsForCount(count, maxCount) : 0;
      const color = colorForIso2(countryCode);
      const canPulse = pulseSet.has(countryCode);

      cities.forEach((city) => {
        const coords = projection([city.lon, city.lat]);
        if (!coords) return;
        const [x, y] = coords;
        if (x < 0 || x > width || y < 0 || y > height) return;

        const key = `${countryCode}-${city.cityDistanceRank}`;
        const isAnimated = city.cityDistanceRank < dotsToShow;

        if (isAnimated) {
          animatedArr.push({
            key,
            x,
            y,
            color,
            canPulse: canPulse && city.cityDistanceRank < 5,
            cityDistanceRank: city.cityDistanceRank,
          });
        } else {
          staticArr.push({ key, x, y });
        }
      });
    });

    return { staticPixels: staticArr, animatedPixels: animatedArr };
  }, [projection, width, height, countByIso2, maxCount, pulseSet]);

  // Hover hotspots: one invisible target per country (at its capital-ish dot).
  const hotspots = useMemo(() => {
    const out: Array<{ x: number; y: number; country: string; count: number }> =
      [];
    for (const g of geo) {
      const iso = iso2For(g.country);
      if (!iso) continue;
      const cities = MAP_DATA[iso];
      const anchor = cities?.[0];
      if (!anchor) continue;
      const coords = projection([anchor.lon, anchor.lat]);
      if (!coords) continue;
      out.push({ x: coords[0], y: coords[1], country: g.country, count: g.count });
    }
    return out;
  }, [geo, projection]);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full bg-[var(--ds-background-100)]"
      >
        <g>
          {staticPixels.map((p) => (
            <StaticPixel key={p.key} x={p.x} y={p.y} />
          ))}
        </g>
        <g>
          {animatedPixels.map((p) => (
            <AnimatedPixel
              key={p.key}
              x={p.x}
              y={p.y}
              color={p.color}
              canPulse={p.canPulse}
              cityDistanceRank={p.cityDistanceRank}
            />
          ))}
        </g>
        {/* Invisible hover targets for a country tooltip. */}
        <g>
          {hotspots.map((h) => (
            <rect
              key={h.country}
              x={h.x - 9}
              y={h.y - 9}
              width={18}
              height={18}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() =>
                setTooltip({
                  x: h.x,
                  y: h.y,
                  country: h.country,
                  count: h.count,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </g>
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded border border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] px-2.5 py-1.5 font-mono text-xs shadow-lg"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
            transform: "translate(-50%, -140%)",
          }}
        >
          <span className="text-[var(--ds-gray-1000)]">{tooltip.country}</span>
          <span className="text-[var(--ds-gray-500)]"> · </span>
          <span className="tabular-nums text-[var(--ds-gray-900)]">
            {fmtInt(tooltip.count)} sessions
          </span>
        </div>
      )}
    </div>
  );
}
