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

export function listAllHouses(): Promise<House[]> {
  return query<House>("SELECT * FROM houses ORDER BY id");
}

export function setHouseStatus(
  code: string,
  status: "active" | "inactive"
): Promise<House | null> {
  return queryOne<House>(
    "UPDATE houses SET status = $2 WHERE code = $1 RETURNING *",
    [code, status]
  );
}

export function setHouseName(code: string, name: string): Promise<House | null> {
  return queryOne<House>(
    "UPDATE houses SET name = $2 WHERE code = $1 RETURNING *",
    [code, name]
  );
}

/** Returns the only active house if exactly one exists, otherwise null. */
export async function getSoleActiveHouse(): Promise<House | null> {
  const rows = await query<House>(
    "SELECT * FROM houses WHERE status = 'active' ORDER BY id LIMIT 2"
  );
  return rows.length === 1 ? rows[0] : null;
}

export function setHouseWifi(
  code: string,
  wifiName: string,
  wifiPassword: string
): Promise<House | null> {
  return queryOne<House>(
    "UPDATE houses SET wifi_name = $2, wifi_password = $3 WHERE code = $1 RETURNING *",
    [code, wifiName, wifiPassword]
  );
}

export function setHouseCheckin(code: string, info: string): Promise<House | null> {
  return queryOne<House>(
    "UPDATE houses SET checkin_info = $2 WHERE code = $1 RETURNING *",
    [code, info]
  );
}

export function setHouseAddress(code: string, address: string): Promise<House | null> {
  return queryOne<House>(
    "UPDATE houses SET address = $2 WHERE code = $1 RETURNING *",
    [code, address]
  );
}
