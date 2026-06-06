"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Download,
  SlidersHorizontal,
  Activity,
  Globe,
  Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { label: "Cockpit", href: "/", icon: LayoutDashboard },
  { label: "Top Performers", href: "/top-performers", icon: Trophy },
  { label: "Download Report", href: "/filters", icon: Download },
  { label: "Show Filters", href: "/filters", icon: SlidersHorizontal },
];

const VIEW_SUBTITLE: Record<string, string> = {
  "/": "Cockpit",
  "/top-performers": "Top Performers",
  "/filters": "Filters",
};

export default function Rail() {
  const pathname = usePathname();
  const subtitle = VIEW_SUBTITLE[pathname] ?? "Cockpit";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[224px] flex-col bg-rail-grad text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent-grad shadow-glow">
          <Activity size={19} strokeWidth={2.4} />
        </span>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight">Web Traffic</div>
          <div className="text-[11px] text-white/45">{subtitle}</div>
        </div>
      </div>

      <nav className="mt-3 flex flex-col gap-1.5 px-3">
        {NAV.map((item, i) => {
          // First match wins for active state (Cockpit vs filters share routes).
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href && NAV.findIndex((n) => n.href === item.href) === i;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] transition-all ${
                active
                  ? "bg-rail-active font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent-grad" aria-hidden />
              )}
              <item.icon
                size={17}
                strokeWidth={2}
                className={active ? "text-white" : "text-white/55 group-hover:text-white"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-6">
        <div className="flex items-center gap-3 text-white/45">
          <Globe size={16} className="transition-colors hover:text-white" />
          <Share2 size={16} className="transition-colors hover:text-white" />
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-white/30">
          Web traffic analytics dashboard.
        </p>
      </div>
    </aside>
  );
}
