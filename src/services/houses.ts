import { query, queryOne } from "../db/client";
import type { House } from "../types";

/**
 * Normalize a /start payload or typed code into a canonical house code.
 * Accepts "h3", "H3", "3", "дом3", "house3" -> "h3".
 */
export function normalizeHouseCode(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const m = cleaned.match(/(?:h|house|дом)?(\d{1,3})$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `h${n}`;
}

export function getHouseByCode(code: string): Promise<House | null> {
  return queryOne<House>("SELECT * FROM houses WHERE code = $1", [code]);
}

export function getHouseById(id: number): Promise<House | null> {
  return queryOne<House>("SELECT * FROM houses WHERE id = $1", [id]);
}

export function listActiveHouses(): Promise<House[]> {
  return query<House>(
    "SELECT * FROM houses WHERE status = 'active' ORDER BY id"
  );
}
