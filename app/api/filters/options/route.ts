import { jsonHandler } from "@/lib/respond";
import { getFilterOptions } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonHandler(() => getFilterOptions());
}
