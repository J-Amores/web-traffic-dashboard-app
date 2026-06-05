// Placeholder home. NO dashboard UI yet — that comes after UI/UX is chosen.
// This server component fetches the data layer directly to prove the skeleton
// is wired and lists the API surface for manual exploration.

import { getHealth } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_ROUTES: string[] = [
  "/api/health",
  "/api/kpis",
  "/api/breakdown/platforms",
  "/api/breakdown/brands",
  "/api/geo",
  "/api/breakdown/channels",
  "/api/breakdown/products",
  "/api/top-performers?metric=totalPosts&dimension=platform",
  "/api/filters/options",
];

export default async function Home() {
  const { rows, range } = await getHealth();

  return (
    <main className="p-6">
      <h1 className="text-lg font-semibold">
        Skeleton OK — {rows.toLocaleString()} rows, range {range.min} → {range.max}
      </h1>
      <p className="mt-2">Backend skeleton verified. API routes:</p>
      <ul className="mt-2 list-disc pl-6">
        {API_ROUTES.map((route) => (
          <li key={route}>
            <a href={route}>{route}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
