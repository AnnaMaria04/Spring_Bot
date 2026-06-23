import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { config } from "../src/config";

/**
 * Apply src/db/schema.sql to DATABASE_URL. The schema is idempotent, so this
 * doubles as the seed step and is safe to re-run. Useful for a VPS Postgres;
 * on Supabase the same schema was applied via migrations.
 */
async function main(): Promise<void> {
  const sqlPath = join(__dirname, "..", "src", "db", "schema.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
  });

  await pool.query(sql);
  await pool.end();
  console.log("✅ Database schema applied and houses seeded.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
