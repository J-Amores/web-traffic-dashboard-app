// Small radial % ring with the value in the center. Animated sweep + count-up,
// gradient stroke. Client component.
"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useCountUp } from "@/lib/motion";

interface MiniDonutProps {
  /** Percentage 0..100. */
  pct: number;
  size?: number;
  stroke?: number;
  className?: string;
  track?: string;
}

export default function MiniDonut({
  pct,
  size = 48,
  stroke = 6,
  className,
  track = "#e9ecf3",
}: MiniDonutProps) {
  const gradId = useId();
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const counted = useCountUp(clamped, 800);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${clamped.toFixed(0)} percent`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f7cff" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <motion.circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        transform={`rotate(-90 ${center} ${center})`}
        initial={reduce ? false : { strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="tnum fill-ink"
        fontSize={size * 0.27}
        fontWeight={700}
      >
        {counted.toFixed(0)}%
      </text>
    </svg>
  );
}
