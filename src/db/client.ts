import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { config } from "../config";

// Parse Postgres BIGINT (int8, OID 20) as a JS number. All BIGINT values in
// this app are Telegram ids, chat ids, and message ids, which stay well within
// Number.MAX_SAFE_INTEGER, so this is safe and keeps the code free of string
// juggling.
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

/**
 * A single shared connection pool. On serverless (Vercel) the module is
 * reused across warm invocations, so the pool is created once per instance.
 * A small pool keeps us well under Supabase / Postgres connection limits.
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      // Supabase requires SSL; `sslmode` in the URL handles it, but enabling
      // this keeps plain connection strings working too. rejectUnauthorized
      // is relaxed because managed providers use their own CA chains.
      ssl: config.databaseUrl.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
      max: config.isServerless ? 1 : 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on("error", (err) => {
      console.error("[db] unexpected pool error", err);
    });
  }
  return pool;
}

/** Run a parameterised query and return the rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

/** Run a query and return the first row, or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run several statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
