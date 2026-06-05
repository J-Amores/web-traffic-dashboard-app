import type { NextRequest } from "next/server";
import { jsonHandler } from "@/lib/respond";
import { parseFilters } from "@/lib/filters";
import {
  getTopPerformers,
  isDimensionKey,
  isMetricKey,
} from "@/lib/queries";
import type { DimensionKey, MetricKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_METRIC: MetricKey = "totalPosts";
const DEFAULT_DIMENSION: DimensionKey = "platform";

export function GET(req: NextRequest) {
  return jsonHandler(() => {
    const sp = req.nextUrl.searchParams;
    const metricRaw = sp.get("metric");
    const dimensionRaw = sp.get("dimension");
    const metric = isMetricKey(metricRaw) ? metricRaw : DEFAULT_METRIC;
    const dimension = isDimensionKey(dimensionRaw)
      ? dimensionRaw
      : DEFAULT_DIMENSION;
    return getTopPerformers(metric, dimension, parseFilters(sp));
  });
}
