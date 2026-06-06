"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Download, RotateCcw } from "lucide-react";
import type { FilterOptionsResponse } from "@/lib/types";
import { fetchJson, useFilters, type Filters } from "@/lib/client";
import Panel from "@/components/ui/Panel";

export default function FiltersPage() {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <FiltersView />
    </Suspense>
  );
}

function FiltersView() {
  const { filters, set, clear } = useFilters();
  const [options, setOptions] = useState<FilterOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<FilterOptionsResponse>("/api/filters/options")
      .then((o) => {
        if (!cancelled) setOptions(o);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () =>
      (["from", "to", "device", "country", "channel", "source"] as const).filter(
        (k) => filters[k],
      ).length,
    [filters],
  );

  function update(key: keyof Filters, value: string) {
    set({ ...filters, [key]: value || undefined });
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-panel p-6 text-sm text-down shadow-tile ring-1 ring-grid/70">
        {error}
      </div>
    );
  }

  if (!options) return <FiltersSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Panel
        index={0}
        icon={SlidersHorizontal}
        title="Filters"
        aside={activeCount ? `${activeCount} active` : "None active"}
        className="lg:col-span-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label="From date">
            <input
              type="date"
              value={filters.from ?? ""}
              min={options.dateBounds.min.slice(0, 10)}
              max={options.dateBounds.max.slice(0, 10)}
              onChange={(e) => update("from", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={filters.to ?? ""}
              min={options.dateBounds.min.slice(0, 10)}
              max={options.dateBounds.max.slice(0, 10)}
              onChange={(e) => update("to", e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Source">
            <Select
              value={filters.source ?? ""}
              onChange={(v) => update("source", v)}
              options={options.sources}
              placeholder="All sources"
            />
          </Field>
          <Field label="Channel">
            <Select
              value={filters.channel ?? ""}
              onChange={(v) => update("channel", v)}
              options={options.channels}
              placeholder="All channels"
            />
          </Field>
          <Field label="Country">
            <Select
              value={filters.country ?? ""}
              onChange={(v) => update("country", v)}
              options={options.countries}
              placeholder="All countries"
            />
          </Field>
          <Field label="Device">
            <Select
              value={filters.device ?? ""}
              onChange={(v) => update("device", v)}
              options={options.devices}
              placeholder="All devices"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-[12.5px] font-medium text-muted shadow-tile ring-1 ring-grid/70 transition-colors hover:text-ink"
          >
            <RotateCcw size={15} />
            Reset filters
          </button>
        </div>
      </Panel>

      <Panel
        index={1}
        icon={Download}
        title="Download Report"
        aside="CSV"
        className="lg:col-span-4"
      >
        <p className="text-[12.5px] leading-relaxed text-muted">
          Export the current view as a CSV. The active filters above are applied
          to the exported data.
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-[12px] text-ink-soft">
          <SummaryRow label="Date" value={dateLabel(filters)} />
          <SummaryRow label="Source" value={filters.source ?? "All"} />
          <SummaryRow label="Channel" value={filters.channel ?? "All"} />
          <SummaryRow label="Country" value={filters.country ?? "All"} />
          <SummaryRow label="Device" value={filters.device ?? "All"} />
        </ul>
        <a
          href={`/api/kpis${queryFrom(filters)}`}
          download="web-traffic-report.json"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-grad px-4 py-3 text-[13px] font-semibold text-white shadow-glow transition-opacity hover:opacity-90"
        >
          <Download size={16} />
          Download report
        </a>
      </Panel>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-panel px-3 py-2.5 text-[12.5px] font-medium text-ink shadow-tile ring-1 ring-grid/70 outline-none focus:ring-accent/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-grid/60 pb-2">
      <span className="text-muted">{label}</span>
      <span className="truncate font-medium text-ink" title={value}>
        {value}
      </span>
    </li>
  );
}

function dateLabel(f: Filters): string {
  if (f.from && f.to) return `${f.from} → ${f.to}`;
  if (f.from) return `From ${f.from}`;
  if (f.to) return `Until ${f.to}`;
  return "All dates";
}

function queryFrom(f: Filters): string {
  const params = new URLSearchParams();
  (["from", "to", "device", "country", "channel", "source"] as const).forEach((k) => {
    if (f[k]) params.set(k, f[k] as string);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function FiltersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="shimmer h-96 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70 lg:col-span-8" />
      <div className="shimmer h-96 rounded-3xl bg-panel shadow-tile ring-1 ring-grid/70 lg:col-span-4" />
    </div>
  );
}
