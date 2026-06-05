import { jsonHandler } from "@/lib/respond";
import { getHealth } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonHandler(async () => {
    const { rows, range } = await getHealth();
    return { status: "ok" as const, rows, range };
  });
}
