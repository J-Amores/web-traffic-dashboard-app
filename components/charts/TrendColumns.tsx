// Vertical column chart for a monthly trend. Bars grow in, hover highlights the
// column and shows a month + value tooltip, last column emphasized. Client.
// Reused by Top Performers.
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SparklinePoint } from "@/lib/types";
import { fmtCompact, fmtMonth } from "@/lib/format";

interface TrendColumnsProps {
  data: SparklinePoint[];
  height?: number;
  className?: string;
}

export default function TrendColumns({ data, height = 140, className }: TrendColumnsProps) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <div className={className} style={{ height }} aria-hidden />;
  }

  const max = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <div className={`relative w-full ${className ?? ""}`} style={{ height }}>
      <div className="flex h-full w-full items-end gap-1.5">
        {data.map((d, i) => {
          const hPct = Math.max(2, (d.value / max) * 100);
          const isLast = i === data.length - 1;
          const isHover = hover === i;
          return (
            <div
              key={d.month}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <motion.div
                className="w-full rounded-t-md"
                style={{
                  background:
                    isLast || isHover
                      ? "linear-gradient(180deg,#4f7cff,#7c5cff)"
                      : "linear-gradient(180deg,#a9bfff,#cdb8ff)",
                }}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${hPct}%` }}
                transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
              />
              {isHover && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                  <span className="tnum">{fmtCompact(d.value)}</span>
                  <span className="ml-1 text-white/60">{fmtMonth(d.month)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
