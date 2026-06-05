// One-time migration: load social_media_engagement.db (SQLite) into Neon
// Postgres with proper column types. Idempotent — drops and recreates the
// table, so it is safe to re-run.
//
// Usage: npm run migrate   (loads .env.local via node --env-file)
// Requires DATABASE_URL_UNPOOLED (preferred for DDL/bulk) or DATABASE_URL.

import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";

const SQLITE_FILE = "social_media_engagement.db";
const TABLE = "social_media_posts";
const BATCH = 500;

// Column name -> Postgres type. Order is the canonical insert order.
const COLUMNS = [
  ["post_id", "TEXT PRIMARY KEY"],
  ["timestamp", "TIMESTAMP NOT NULL"],
  ["day_of_week", "TEXT"],
  ["platform", "TEXT"],
  ["user_id", "TEXT"],
  ["location", "TEXT"],
  ["language", "TEXT"],
  ["text_content", "TEXT"],
  ["hashtags", "TEXT"],
  ["mentions", "TEXT"],
  ["keywords", "TEXT"],
  ["topic_category", "TEXT"],
  ["sentiment_score", "DOUBLE PRECISION"],
  ["sentiment_label", "TEXT"],
  ["emotion_type", "TEXT"],
  ["toxicity_score", "DOUBLE PRECISION"],
  ["likes_count", "INTEGER"],
  ["shares_count", "INTEGER"],
  ["comments_count", "INTEGER"],
  ["impressions", "INTEGER"],
  ["engagement_rate", "DOUBLE PRECISION"],
  ["brand_name", "TEXT"],
  ["product_name", "TEXT"],
  ["campaign_name", "TEXT"],
  ["campaign_phase", "TEXT"],
  ["user_past_sentiment_avg", "DOUBLE PRECISION"],
  ["user_engagement_growth", "DOUBLE PRECISION"],
  ["buzz_change_rate", "DOUBLE PRECISION"],
];

const COL_NAMES = COLUMNS.map(([name]) => name);
const INDEXED = [
  "timestamp",
  "platform",
  "brand_name",
  "campaign_name",
  "sentiment_label",
  "day_of_week",
  "location",
  "engagement_rate",
];

// Quote an identifier (handles the reserved keyword `timestamp`).
const q = (id) => `"${id}"`;

function connectionString() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "No connection string. Set DATABASE_URL (and ideally DATABASE_URL_UNPOOLED) " +
        "in .env.local — run `vercel env pull .env.local` after adding the Neon integration."
    );
    process.exit(1);
  }
  return url;
}

async function main() {
  const sql = neon(connectionString());
  const sqlitePath = path.join(process.cwd(), SQLITE_FILE);
  const sdb = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  const rows = sdb.prepare(`SELECT ${COL_NAMES.join(", ")} FROM ${TABLE}`).all();
  console.log(`Read ${rows.length} rows from SQLite.`);

  // Recreate the table.
  await sql(`DROP TABLE IF EXISTS ${TABLE}`);
  const colDefs = COLUMNS.map(([name, type]) => `${q(name)} ${type}`).join(",\n  ");
  await sql(`CREATE TABLE ${TABLE} (\n  ${colDefs}\n)`);
  console.log("Created table.");

  // Bulk insert in batches.
  const colList = COL_NAMES.map(q).join(", ");
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = COL_NAMES.map((c) => {
        params.push(row[c] ?? null);
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await sql(
      `INSERT INTO ${TABLE} (${colList}) VALUES ${tuples.join(", ")}`,
      params
    );
    inserted += slice.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }
  process.stdout.write("\n");

  // Indexes.
  for (const col of INDEXED) {
    await sql(
      `CREATE INDEX IF NOT EXISTS idx_${col} ON ${TABLE} (${q(col)})`
    );
  }
  console.log(`Created ${INDEXED.length} indexes.`);

  // Verify.
  const [{ count }] = await sql(`SELECT COUNT(*)::int AS count FROM ${TABLE}`);
  console.log(`Done. Postgres row count: ${count}`);
  sdb.close();
  if (count !== rows.length) {
    console.error(`Row count mismatch: sqlite=${rows.length} pg=${count}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
