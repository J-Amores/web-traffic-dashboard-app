"use client";

// Dotted pixel world map, ported from the Vercel-style template and rewired
// to OUR data: dot color + density + pulse are driven by per-country session
// counts from /api/geo. Vercel edge-POP markers were dropped entirely.

import { useMemo, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { geoMercator } from "d3-geo";
import dottedMapData from "@/lib/data/dotted-map-data.json";
import { iso2For, colorForIso2 } from "@/lib/country-meta";
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

/**
 * Glows the selected country on the map: a soft color halo, a pulsing ring, and
 * a bright center dot in the country's color — so the country the side panel is
 * describing is obvious at a glance. Pointer-events-none; purely decorative.
 */
function SelectionRing({
  x,
  y,
  country,
}: {
  x: number;
  y: number;
  country: string;
}) {
  const reduce = useReducedMotion();
  const iso = iso2For(country);
  const color = iso ? colorForIso2(iso) : "var(--ds-gray-100)";
  return (
    <g pointerEvents="none" data-testid="country-glow">
      {/* soft halo glow */}
      <circle cx={x} cy={y} r={20} fill={color} opacity={0.12} />
      <motion.circle
        cx={x}
        cy={y}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        initial={reduce ? { r: 14, opacity: 0.85 } : { r: 8, opacity: 0 }}
        animate={
          reduce
            ? { r: 14, opacity: 0.85 }
            : { r: [10, 18, 10], opacity: [0.9, 0.25, 0.9] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <circle cx={x} cy={y} r={3} fill={color} />
    </g>
  );
}

interface DottedMapProps {
  geo: GeoItem[];
  width?: number;
  height?: number;
  /** Country (raw name from /api/geo) to glow; selection comes from the list. */
  selectedCountry?: string | null;
}

export default function DottedMap({
  geo,
  width = 1000,
  height = 560,
  selectedCountry = null,
}: DottedMapProps) {
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

  // Per-country centroid (capital-ish first dot) — used to glow the selected
  // country. Keyed by the raw /api/geo country name the list selects with.
  const centroids = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const g of geo) {
      const iso = iso2For(g.country);
      if (!iso) continue;
      const anchor = MAP_DATA[iso]?.[0];
      if (!anchor) continue;
      const coords = projection([anchor.lon, anchor.lat]);
      if (!coords) continue;
      map.set(g.country, { x: coords[0], y: coords[1] });
    }
    return map;
  }, [geo, projection]);

  const sel = selectedCountry ? centroids.get(selectedCountry) : undefined;

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
        {/* Glow the country currently selected in the side list. */}
        {sel && selectedCountry && (
          <SelectionRing x={sel.x} y={sel.y} country={selectedCountry} />
        )}
      </svg>
    </div>
  );
}
