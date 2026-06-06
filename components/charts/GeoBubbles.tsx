// Real world map (react-simple-maps + world-atlas topojson) with proportional,
// animated bubbles at each location's lng/lat. Hover shows location + count.
// Client component.
"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { motion, useReducedMotion } from "framer-motion";
import type { GeoItem } from "@/lib/types";
import { fmtInt } from "@/lib/format";

interface GeoBubblesProps {
  data: GeoItem[];
  className?: string;
}

const GEO_URL = "/world-110m.json";

interface Tip {
  x: number;
  y: number;
  location: string;
  count: number;
}

export default function GeoBubbles({ data, className }: GeoBubblesProps) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const minR = 3;
  const maxR = 16;

  // Larger bubbles draw first so smaller ones stay clickable on top.
  const ordered = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className={`relative ${className ?? ""}`}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155 }}
        width={800}
        height={380}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#eef1f8"
                stroke="#dfe4ef"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#e7ebf6" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        {ordered.map((d, i) => {
          const r = minR + Math.sqrt(d.count / max) * (maxR - minR);
          return (
            <Marker key={d.country} coordinates={[d.lng, d.lat]}>
              <motion.circle
                r={r}
                fill="url(#geo-grad)"
                fillOpacity={0.7}
                stroke="#3a5bdb"
                strokeWidth={0.75}
                strokeOpacity={0.9}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.015, ease: "backOut" }}
                style={{ cursor: "pointer" }}
                onPointerEnter={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement?.parentElement as HTMLElement | null
                  )?.getBoundingClientRect();
                  if (!rect) return;
                  setTip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    location: d.country,
                    count: d.count,
                  });
                }}
                onPointerLeave={() => setTip(null)}
              />
            </Marker>
          );
        })}
        <defs>
          <radialGradient id="geo-grad" cx="40%" cy="40%">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#4f7cff" />
          </radialGradient>
        </defs>
      </ComposableMap>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white shadow-lg"
          style={{ left: tip.x, top: tip.y - 8 }}
        >
          {tip.location}
          <span className="tnum ml-1 text-white/70">{fmtInt(tip.count)}</span>
        </div>
      )}
    </div>
  );
}
