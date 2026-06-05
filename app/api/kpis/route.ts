import type { NextRequest } from "next/server";
import { jsonHandler } from "@/lib/respond";
import { parseFilters } from "@/lib/filters";
import { getKpis } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return jsonHandler(() => getKpis(parseFilters(req.nextUrl.searchParams)));
}
