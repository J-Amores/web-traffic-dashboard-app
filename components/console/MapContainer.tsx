"use client";

import dynamic from "next/dynamic";
import type { GeoItem } from "@/lib/types";

const DottedMap = dynamic(() => import("./DottedMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[560px] w-full animate-pulse rounded-md bg-[var(--ds-background-100)]" />
  ),
});

export default function MapContainer({ geo }: { geo: GeoItem[] }) {
  return <DottedMap geo={geo} />;
}
