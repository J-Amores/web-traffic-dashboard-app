// Delta percentage badge: green up / red down / neutral grey when exactly 0.
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fmtDelta } from "@/lib/format";

interface DeltaBadgeProps {
  value: number;
  /** Render on a dark surface (e.g. gradient KPI tiles). */
  onDark?: boolean;
  className?: string;
}

export default function DeltaBadge({ value, onDark, className }: DeltaBadgeProps) {
  const neutral = value === 0;
  const positive = value > 0;

  const tone = onDark
    ? "bg-white/20 text-white"
    : neutral
      ? "bg-grid text-muted"
      : positive
        ? "bg-up/12 text-up"
        : "bg-down/12 text-down";

  const Icon = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone} ${className ?? ""}`}
    >
      <Icon size={12} strokeWidth={2.6} />
      {fmtDelta(value)}
    </span>
  );
}
