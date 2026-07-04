import type { StorageAdapter } from "grammy";
import { query, queryOne } from "../db/client";

/**
 * grammY session storage backed by the `sessions` Postgres table. Keeping
 * conversation state in the database (instead of memory) means multi-step
 * guest flows survive bot restarts and work on serverless platforms where
 * each invocation is a fresh process.
 */
export class PostgresAdapter<T> implements StorageAdapter<T> {
  async read(key: string): Promise<T | undefined> {
    const row = await queryOne<{ value: T }>(
      "SELECT value FROM sessions WHERE key = $1",
      [key]
    );
    return row?.value ?? undefined;
  }

  async write(key: string, value: T): Promise<void> {
    await query(
      `INSERT INTO sessions (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }

  async delete(key: string): Promise<void> {
    await query("DELETE FROM sessions WHERE key = $1", [key]);
  }
}
