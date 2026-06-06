"use client";

import { Bell } from "lucide-react";
import { PERIOD_BANNERS, useFilters } from "@/lib/client";
import PeriodSelector from "@/components/ui/PeriodSelector";

export default function Header() {
  const { period } = useFilters();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-8 pt-7">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-ink">
          <span aria-hidden>👋</span> Hello! Welcome to Web Traffic Dashboard
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Showing results for{" "}
          <span className="font-semibold text-ink-soft">{PERIOD_BANNERS[period]}</span>
        </p>
      </div>

      <div className="flex items-center gap-4">
        <PeriodSelector />
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-2xl bg-panel text-muted shadow-tile ring-1 ring-grid/70 transition-colors hover:text-ink"
        >
          <Bell size={17} />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-down" />
        </button>
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent-grad text-[12px] font-bold text-white shadow-glow">
            UN
          </span>
          <div className="leading-tight">
            <div className="text-[12.5px] font-semibold text-ink">User Name</div>
            <div className="text-[11px] text-muted">username@email.com</div>
          </div>
        </div>
      </div>
    </header>
  );
}
