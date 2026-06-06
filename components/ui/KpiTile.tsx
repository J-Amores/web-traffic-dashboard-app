// KPI tile: icon + label, big count-up value, delta badge, sparkline.
// `featured` renders a gradient hero treatment for the lead metric.
"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { KpiBlock } from "@/lib/types";
import Sparkline from "@/components/charts/Sparkline";
import DeltaBadge from "@/components/ui/DeltaBadge";
import { useCountUp } from "@/lib/motion";

interface KpiTileProps {
  label: string;
  /** Format the (animated) numeric value into the displayed string. */
  format: (n: number) => string;
  block: KpiBlock;
  icon: LucideIcon;
  featured?: boolean;
  index?: number;
}

export default function KpiTile({
  label,
  format,
  block,
  icon: Icon,
  featured = false,
  index = 0,
}: KpiTileProps) {
  const reduce = useReducedMotion();
  const value = useCountUp(block.current, 1000);

  if (featured) {
    return (
      <motion.div
        className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-accent-grad p-5 text-white shadow-glow ring-1 ring-white/10"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="text-[12px] font-medium text-white/85">{label}</span>
          </div>
          <DeltaBadge value={block.deltaPct} onDark />
        </div>
        <div className="relative mt-4">
          <div className="tnum text-[34px] font-bold leading-none tracking-tight">
            {format(value)}
          </div>
          <div className="mt-1.5 text-[11px] text-white/70">vs prior period</div>
        </div>
        <div className="relative mt-3">
          <Sparkline data={block.sparkline} width={260} height={40} stroke="#ffffff" fill="#ffffff" className="w-full" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col justify-between rounded-3xl bg-panel p-5 shadow-tile ring-1 ring-grid/70"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent-deep">
            <Icon size={16} strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-muted">{label}</span>
        </div>
        <DeltaBadge value={block.deltaPct} />
      </div>
      <div className="mt-4">
        <div className="tnum text-[28px] font-bold leading-none tracking-tight text-ink">
          {format(value)}
        </div>
        <div className="mt-1.5 text-[11px] text-muted">vs prior period</div>
      </div>
      <div className="mt-3">
        <Sparkline data={block.sparkline} width={240} height={36} className="w-full" />
      </div>
    </motion.div>
  );
}
