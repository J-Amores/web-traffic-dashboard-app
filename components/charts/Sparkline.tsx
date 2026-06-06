// Area + line sparkline. Even point distribution across the full width,
// min/max-aware y-scaling, draw-in animation, hover dot + value tooltip,
// subtle area gradient. Client component.
"use client";

import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SparklinePoint } from "@/lib/types";
import { fmtCompact, fmtMonth } from "@/lib/format";

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: string;
  /** Show a hover dot + tooltip on pointer move. */
  interactive?: boolean;
}

export default function Sparkline({
  data,
  width = 84,
  height = 30,
  className,
  stroke = "#4f7cff",
  fill = "#7c5cff",
  interactive = true,
}: SparklineProps) {
  const gradId = useId();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const padX = 3;
    const padY = 4;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const pts = data.map((d, i) => {
      const x = padX + (i / (data.length - 1)) * innerW;
      const y = padY + innerH - ((d.value - min) / span) * innerH;
      return { x, y, d };
    });
    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    const baseY = height - padY;
    const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${baseY} L${pts[0].x.toFixed(2)},${baseY} Z`;
    return { pts, line, area };
  }, [data, width, height]);

  if (!geom) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }

  const { pts, line, area } = geom;
  const active = hover != null ? pts[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  }

  return (
    <div className={`relative ${className ?? ""}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Trend sparkline"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={0.32} />
            <stop offset="100%" stopColor={fill} stopOpacity={0} />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill={`url(#${gradId})`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
        {active && (
          <>
            <line
              x1={active.x}
              y1={0}
              x2={active.x}
              y2={height}
              stroke={stroke}
              strokeWidth={0.75}
              strokeOpacity={0.35}
            />
            <circle cx={active.x} cy={active.y} r={3.5} fill={stroke} stroke="#fff" strokeWidth={1.5} />
          </>
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white shadow-lg"
          style={{ left: active.x, top: active.y - 6 }}
        >
          <span className="tnum">{fmtCompact(active.d.value)}</span>
          <span className="ml-1 text-white/60">{fmtMonth(active.d.month)}</span>
        </div>
      )}
    </div>
  );
}
