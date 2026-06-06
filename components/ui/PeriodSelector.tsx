// Segmented period control driving the `period` querystring via useFilters().
"use client";

import { motion } from "framer-motion";
import {
  PERIOD_PRESETS,
  PERIOD_LABELS,
  useFilters,
  type PeriodPreset,
} from "@/lib/client";

// Short labels for the compact segmented control; full labels in the title.
const SHORT: Record<PeriodPreset, string> = {
  month: "Month",
  "3m": "3M",
  "6m": "6M",
  "12m": "12M",
  all: "All",
};

export default function PeriodSelector() {
  const { period, setPeriod } = useFilters();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-panel p-1 shadow-tile ring-1 ring-grid/70">
      {PERIOD_PRESETS.map((p) => {
        const active = p === period;
        return (
          <button
            key={p}
            type="button"
            title={PERIOD_LABELS[p]}
            onClick={() => setPeriod(p)}
            className={`relative rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              active ? "text-white" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 rounded-full bg-accent-grad shadow-glow"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{SHORT[p]}</span>
          </button>
        );
      })}
    </div>
  );
}
