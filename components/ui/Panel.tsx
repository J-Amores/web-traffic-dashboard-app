// Bento card: large radius, layered shadow, subtle ring, generous padding,
// optional accent icon chip in the title row. The base container for modules.
"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  /** Stagger index for entrance animation. */
  index?: number;
}

export default function Panel({
  title,
  aside,
  icon: Icon,
  children,
  className,
  index = 0,
}: PanelProps) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={`flex flex-col rounded-3xl bg-panel p-5 shadow-tile ring-1 ring-grid/70 ${className ?? ""}`}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent-deep">
              <Icon size={16} strokeWidth={2} />
            </span>
          )}
          <h2 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {aside ? <div className="text-[11px] font-medium text-muted">{aside}</div> : null}
      </header>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}
