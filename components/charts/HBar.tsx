// Horizontal bar row: label + animated gradient bar + value. Grows in on mount,
// highlights + shows a value tooltip on hover. Client component.
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fmtCompact } from "@/lib/format";

interface HBarProps {
  label: string;
  value: number;
  max: number;
  /** Optional override for the right-aligned value text. */
  display?: string;
  /** Optional secondary text shown in the hover tooltip. */
  hint?: string;
  /** 0-based row index, used to stagger the entrance. */
  index?: number;
  className?: string;
}

export default function HBar({
  label,
  value,
  max,
  display,
  hint,
  index = 0,
  className,
}: HBarProps) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;

  return (
    <div
      className={`group flex items-center gap-3 ${className ?? ""}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="w-28 shrink-0 truncate text-xs text-ink-soft" title={label}>
        {label}
      </div>
      <div className="relative h-3.5 flex-1 rounded-full bg-grid/70">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            hover ? "bg-accent-deep" : "bg-accent-grad"
          }`}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: index * 0.04, ease: "easeOut" }}
        />
        {hover && (
          <div
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white shadow-lg"
            style={{ left: `${Math.min(92, Math.max(8, pct))}%` }}
          >
            <span className="tnum">{display ?? fmtCompact(value)}</span>
            {hint && <span className="ml-1 text-white/60">{hint}</span>}
          </div>
        )}
      </div>
      <div className="tnum w-14 shrink-0 text-right text-xs font-semibold text-ink">
        {display ?? fmtCompact(value)}
      </div>
    </div>
  );
}
