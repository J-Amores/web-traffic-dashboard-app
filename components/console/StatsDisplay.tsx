"use client";

// Dark mono stat cards + lists, ported from the Vercel-style template's
// StatsDisplay and rewired to OUR real /api/* data. No fabricated /s rates:
// numerals use a ONE-SHOT count-up (lib/motion useCountUp) that stops at the
// real value. The PixelGridTransition info-flip flourish is preserved.

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useScramble } from "@/lib/motion";
import { fmtInt } from "@/lib/format";
import { iso2For, colorForIso2 } from "@/lib/country-meta";
import type {
  KpisResponse,
  GeoItem,
  DeviceBreakdownItem,
  ChannelBreakdownItem,
  ReferrerBreakdownItem,
  PageBreakdownItem,
  SparklinePoint,
} from "@/lib/types";

/* ----------------------------- shared helpers ---------------------------- */

/** Integer that digit-scrambles on load, settling to the real value. */
function CountInt({ value, durationMs = 1200 }: { value: number; durationMs?: number }) {
  return <>{useScramble(fmtInt(value), durationMs)}</>;
}

/** Decimal that digit-scrambles on load, settling to the real value. */
function CountNum({
  value,
  decimals = 1,
  durationMs = 1200,
}: {
  value: number;
  decimals?: number;
  durationMs?: number;
}) {
  return <>{useScramble(value.toFixed(decimals), durationMs)}</>;
}

/**
 * Full-width 16-month trend with gradient area-fill. Hovering shows a point
 * indicator + tooltip for the nearest month's value.
 */
function MiniSpark({
  data,
  format,
}: {
  data: SparklinePoint[];
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  if (!data || data.length < 2) return null;

  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const W = 100;
  const H = 32;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * H;
  const line = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(fx * (data.length - 1)))));
  };

  const hv = hover != null ? data[hover] : null;
  const hLeft = hover != null ? (hover / (data.length - 1)) * 100 : 0;
  const hTop = hover != null ? (1 - (data[hover].value - min) / span) * 100 : 0;

  return (
    <div
      className="relative mt-3 w-full cursor-crosshair"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <motion.div
        className="w-full"
        initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.1, ease: "easeInOut", delay: 0.15 }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-9 w-full text-[var(--ds-blue-500)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.4} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#spark-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      {hv && (
        <>
          <span
            className="pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ds-blue-500)] ring-2 ring-[var(--ds-background-100)]"
            style={{ left: `${hLeft}%`, top: `${hTop}%` }}
          />
          <div
            className="text-gray-1000 pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums shadow-lg"
            style={{ left: `${hLeft}%`, top: `calc(${hTop}% - 7px)` }}
          >
            <span className="text-gray-900">{hv.month}</span>{" "}
            {format ? format(hv.value) : String(Math.round(hv.value))}
          </div>
        </>
      )}
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function PixelGridTransition({
  firstContent,
  secondContent,
  isActive,
  gridSize = 30,
  animationStepDuration = 0.3,
  className,
}: {
  firstContent: React.ReactNode;
  secondContent: React.ReactNode;
  isActive: boolean;
  gridSize?: number;
  animationStepDuration?: number;
  className?: string;
}) {
  const [showPixels, setShowPixels] = useState(false);
  const [animState, setAnimState] = useState<"idle" | "growing" | "shrinking">("idle");
  const hasActivatedRef = useRef(false);

  const pixels = useMemo(() => {
    const total = gridSize * gridSize;
    const result = [];
    for (let n = 0; n < total; n++) {
      const row = Math.floor(n / gridSize);
      const col = n % gridSize;
      const color = Math.random() > 0.85 ? "var(--ds-blue-800, #0070f3)" : "var(--ds-gray-200, #333)";
      result.push({ id: n, row, col, color });
    }
    return result;
  }, [gridSize]);

  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  useEffect(() => {
    if (!hasActivatedRef.current && !isActive) return;
    if (isActive) hasActivatedRef.current = true;

    const indices = pixels.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledOrder(indices);

    setShowPixels(true);
    setAnimState("growing");

    const shrinkTimer = setTimeout(() => setAnimState("shrinking"), animationStepDuration * 1000);
    const hideTimer = setTimeout(() => {
      setShowPixels(false);
      setAnimState("idle");
    }, animationStepDuration * 2000);

    return () => {
      clearTimeout(shrinkTimer);
      clearTimeout(hideTimer);
    };
  }, [isActive, animationStepDuration, pixels]);

  const delayPerPixel = useMemo(
    () => animationStepDuration / pixels.length,
    [animationStepDuration, pixels.length]
  );
  const orderMap = useMemo(() => {
    const map = new Map<number, number>();
    shuffledOrder.forEach((idx, order) => map.set(idx, order));
    return map;
  }, [shuffledOrder]);

  return (
    <div className={`relative w-full max-w-full overflow-hidden ${className || ""}`}>
      <motion.div
        className="h-full"
        aria-hidden={isActive}
        initial={{ opacity: 1 }}
        animate={{ opacity: isActive ? 0 : 1 }}
        transition={{ duration: 0, delay: animationStepDuration }}
      >
        {firstContent}
      </motion.div>

      <motion.div
        className="absolute inset-0 z-[2] h-full w-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: 0, delay: animationStepDuration }}
        style={{ pointerEvents: isActive ? "auto" : "none" }}
        aria-hidden={!isActive}
      >
        {secondContent}
      </motion.div>

      <div
        className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
        style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        <AnimatePresence>
          {showPixels &&
            pixels.map((pixel) => {
              const order = orderMap.get(pixel.id) ?? 0;
              return (
                <motion.div
                  key={pixel.id}
                  style={{
                    backgroundColor: pixel.color,
                    aspectRatio: "1 / 1",
                    gridArea: `${pixel.row + 1} / ${pixel.col + 1}`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: animState === "growing" ? 1 : 0,
                    scale: animState === "growing" ? 1 : 0,
                  }}
                  transition={{ duration: 0.01, delay: order * delayPerPixel }}
                />
              );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Dark card with optional big numeral + optional info-flip. */
function StatCard({
  title,
  value,
  children,
  infoContent,
  className,
}: {
  title: string;
  value?: number;
  children?: React.ReactNode;
  infoContent?: string;
  className?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);

  const statsContent = (
    <div className="bg-gray-alpha-100 h-full min-h-[120px] w-full p-4 md:p-6">
      <div className="space-y-2">
        <h2 className="text-gray-1000 my-0 pr-6 font-mono text-sm font-medium uppercase tracking-tight">
          {title}
        </h2>
        {value !== undefined && (
          <div className="font-mono text-3xl tabular-nums tracking-normal md:text-4xl">
            <CountInt value={value} />
          </div>
        )}
        {children}
      </div>
    </div>
  );

  const infoContentView = (
    <div className="bg-gray-alpha-100 flex h-full w-full flex-col gap-y-2 overflow-y-auto p-4 md:p-6">
      <span className="text-gray-1000 my-0 shrink-0 font-mono text-sm font-medium uppercase tracking-tight">
        {title}
      </span>
      <span className="text-gray-900 line-clamp-6 text-sm leading-relaxed tracking-tight">
        {infoContent}
      </span>
    </div>
  );

  return (
    <div className={`group relative overflow-hidden rounded-md ${className || ""}`}>
      <PixelGridTransition
        firstContent={statsContent}
        secondContent={infoContentView}
        isActive={showInfo}
        gridSize={30}
        animationStepDuration={0.3}
        className="h-full"
      />
      {infoContent && (
        <div
          className={`absolute right-2 top-2 z-[20] isolate transition-opacity duration-150 ${
            showInfo
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          }`}
        >
          <button
            aria-label={`Learn more about ${title}`}
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="m-0 flex cursor-pointer items-center justify-center border border-solid border-[var(--ds-gray-alpha-400)] bg-transparent p-1 text-[var(--ds-gray-900)] outline-none transition-colors duration-150 hover:bg-[var(--ds-gray-alpha-200)] hover:text-[var(--ds-gray-1000)] focus-visible:ring"
          >
            <InfoIcon />
          </button>
        </div>
      )}
    </div>
  );
}

/** Label + value row used inside list cards. No /s column (honest aggregate). */
function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3">
      <h3 className="text-gray-900 m-0 truncate font-mono text-base font-normal uppercase">
        {label}
      </h3>
      <div className="flex items-center gap-3 text-right md:gap-4">
        <span className="text-gray-1000 font-mono text-base tabular-nums">
          <CountInt value={value} />
        </span>
        {sub && (
          <span className="text-gray-900 w-16 text-right font-mono text-base tabular-nums">
            {sub}
          </span>
        )}
      </div>
    </li>
  );
}

/* ----------------------------- hero stats -------------------------------- */

export function TotalSessions({ value }: { value: number }) {
  return (
    <div className="space-y-2">
      <h2 className="text-gray-900 my-0 font-mono text-sm font-medium uppercase tracking-tight">
        Total sessions
      </h2>
      <div className="font-mono text-4xl tabular-nums tracking-normal md:text-5xl">
        <CountInt value={value} />
      </div>
    </div>
  );
}

export function TopCountries({
  geo,
  selected,
  onSelect,
}: {
  geo: GeoItem[];
  /** Raw country name currently selected (highlights that row). */
  selected?: string | null;
  /** Fired on hover/focus/tap of a row; null when the pointer leaves. */
  onSelect?: (sel: { country: string; count: number } | null) => void;
}) {
  const ranked = useMemo(
    () => [...geo].sort((a, b) => b.count - a.count).slice(0, 7),
    [geo]
  );
  // Grace delay on leave so moving between adjacent rows doesn't flicker the
  // panel; clearing to null only fires if no new row is entered in time.
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pick = (sel: { country: string; count: number }) => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    onSelect?.(sel);
  };
  const scheduleClear = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => onSelect?.(null), 140);
  };

  return (
    <div className="space-y-2">
      <h2 className="text-gray-900 my-0 font-mono text-sm font-medium uppercase tracking-tight">
        Top countries by sessions
      </h2>
      <ul className="list-none space-y-0.5 pl-0">
        {ranked.map((c) => {
          const iso = iso2For(c.country) ?? "??";
          const color = colorForIso2(iso);
          const active = selected === c.country;
          return (
            <li key={c.country}>
              <button
                type="button"
                aria-pressed={active}
                onMouseEnter={() => pick({ country: c.country, count: c.count })}
                onFocus={() => pick({ country: c.country, count: c.count })}
                onClick={() => pick({ country: c.country, count: c.count })}
                onMouseLeave={scheduleClear}
                onBlur={scheduleClear}
                className={`flex w-full items-center rounded-sm px-1 py-0.5 text-left font-mono transition-colors md:w-[20ch] ${
                  active
                    ? "bg-[var(--ds-gray-100)]"
                    : "hover:bg-[var(--ds-gray-100)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block translate-x-[2px] translate-y-[-2px]"
                >
                  <span style={{ color }}>■</span>
                </span>
                <span
                  className="inline-block text-[16px] font-medium"
                  style={{ color }}
                >
                  &nbsp;{iso}
                </span>
                <span className="ml-auto w-[14ch] text-right md:ml-6">
                  <span className="inline-flex tabular-nums">
                    <CountInt value={c.count} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CountryCount({ count }: { count: number }) {
  return (
    <div className="mt-2 flex w-full items-center md:w-fit">
      <span aria-hidden="true" className="inline-block translate-x-[2px] translate-y-[-2px]">
        <span className="text-[10px]">▲</span>
      </span>
      <div className="text-left">
        <span className="my-0 inline-block text-[16px] font-medium tabular-nums">
          &nbsp;<CountInt value={count} durationMs={700} />
        </span>
        <span className="text-gray-900 text-[16px] font-medium tracking-tight">
          &nbsp;Countries
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ card grid -------------------------------- */

export function StatsGrid({
  kpis,
  devices,
  channels,
  referrers,
  pages,
}: {
  kpis: KpisResponse;
  devices: DeviceBreakdownItem[];
  channels: ChannelBreakdownItem[];
  referrers: ReferrerBreakdownItem[];
  pages: PageBreakdownItem[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* KPI numerals — three across, so each fills its card */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <StatCard
          title="Session Duration"
          value={Math.round(kpis.sessionDuration.current)}
          infoContent="Average session duration in seconds across the full dataset, AVG(session_duration_s) over all 79,011 sessions."
        >
          <span className="text-gray-900 font-mono text-sm">seconds avg</span>
          <MiniSpark
            data={kpis.sessionDuration.sparkline}
            format={(n) => `${Math.round(n)} s`}
          />
        </StatCard>
        <StatCard
          title="Avg Time on Page"
          value={Math.round(kpis.timeOnPage.current)}
          infoContent="Average time on page in seconds, AVG(time_on_page_s) across the full dataset."
        >
          <span className="text-gray-900 font-mono text-sm">seconds avg</span>
          <MiniSpark
            data={kpis.timeOnPage.sparkline}
            format={(n) => `${Math.round(n)} s`}
          />
        </StatCard>
        <StatCard
          title="Avg Unique Pageviews"
          value={undefined}
          infoContent="Average unique pageviews per session, AVG(unique_pageviews) across the full dataset."
        >
          <div className="font-mono text-3xl tabular-nums tracking-normal md:text-4xl">
            <CountNum value={kpis.uniquePageviews.current} decimals={1} />
          </div>
          <span className="text-gray-900 font-mono text-sm">per session</span>
          <MiniSpark
            data={kpis.uniquePageviews.sparkline}
            format={(n) => n.toFixed(1)}
          />
        </StatCard>
      </div>

      {/* Detail lists — four columns, one row */}
      <div className="grid grid-cols-1 items-start gap-1.5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Traffic Channels"
          infoContent="Sessions grouped by acquisition channel across the full dataset."
        >
          <ul className="mt-2 list-none space-y-1 pl-0">
            {channels.map((c) => (
              <MetricRow key={c.channel} label={c.channel} value={c.count} />
            ))}
          </ul>
        </StatCard>

        <StatCard
          title="Devices"
          infoContent="Session share by device category (Desktop, Mobile, Tablet) across the full dataset."
        >
          <ul className="mt-2 list-none space-y-1 pl-0">
            {devices.map((d) => (
              <MetricRow
                key={d.device}
                label={d.device}
                value={d.count}
                sub={`${d.sharePct.toFixed(1)}%`}
              />
            ))}
          </ul>
        </StatCard>

        <StatCard
          title="Top Referrers"
          infoContent="Referral sources sending the most sessions across the full dataset."
        >
          <ul className="mt-2 list-none space-y-1 pl-0">
            {referrers.slice(0, 6).map((r) => (
              <MetricRow
                key={`${r.source}-${r.medium}`}
                label={r.source}
                value={r.count}
              />
            ))}
          </ul>
        </StatCard>

        <StatCard
          title="Most-Visited Pages"
          infoContent="Most-visited pages by sessions, with bounce rate, across the full dataset."
        >
          <ul className="mt-2 list-none space-y-1 pl-0">
            {pages.slice(0, 6).map((p) => (
              <MetricRow
                key={p.pageTitle}
                label={p.pageTitle}
                value={p.count}
                sub={`${(p.bounceRate * 100).toFixed(1)}%`}
              />
            ))}
          </ul>
        </StatCard>
      </div>
    </div>
  );
}
