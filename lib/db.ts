// Neon Postgres data access via the serverless HTTP driver. Each query is a
// single one-shot HTTP request (no pool to exhaust), which fits this app's
// read-only aggregation workload and works on both Node and Edge runtimes.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** Pooled connection string injected by the Vercel-Neon integration. */
function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the Neon integration in Vercel and run " +
        "`vercel env pull .env.local`."
    );
  }
  return url;
}

// Cache the client across hot-reloads / invocations.
const globalForDb = globalThis as unknown as {
  __dashboardSql?: NeonQueryFunction<false, false>;
};

function getSql(): NeonQueryFunction<false, false> {
  if (!globalForDb.__dashboardSql) {
    globalForDb.__dashboardSql = neon(connectionString());
  }
  return globalForDb.__dashboardSql;
}

/** Run a parametrized query ($1, $2, …) and return all rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: (string | number)[] = []
): Promise<T[]> {
  // The neon() HTTP function is called directly with ($text, params[]); it
  // returns the rows array by default (fullResults: false).
  const rows = await getSql()(text, params);
  return rows as T[];
}

/** Run a parametrized query and return the first row (or undefined). */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: (string | number)[] = []
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}
