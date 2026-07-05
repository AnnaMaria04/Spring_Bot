import { queryOne, withTransaction } from "../db/client";
import { config } from "../config";
import type { Stay } from "../types";

/**
 * The guest's current active stay, or null. A stay older than STAY_TTL_DAYS
 * is treated as over and closed out here — otherwise a guest who visited
 * long ago would be silently welcomed back into their old house on a bare
 * /start instead of being asked to select their (new) house.
 */
export async function getActiveStay(guestId: number): Promise<Stay | null> {
  const stay = await queryOne<Stay>(
    "SELECT * FROM stays WHERE guest_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1",
    [guestId]
  );
  if (!stay) return null;

  const ageMs = Date.now() - new Date(stay.check_in).getTime();
  if (ageMs > config.stayTtlDays * 24 * 60 * 60 * 1000) {
    await completeStay(stay.id);
    return null;
  }
  return stay;
}

/**
 * Start a new active stay for the guest in the given house. Any previously
 * active stays for the guest are closed so only one is active at a time.
 */
export function startStay(guestId: number, houseId: number): Promise<Stay> {
  return withTransaction(async (client) => {
    await client.query(
      "UPDATE stays SET status = 'completed', check_out = now() WHERE guest_id = $1 AND status = 'active'",
      [guestId]
    );
    const res = await client.query<Stay>(
      "INSERT INTO stays (guest_id, house_id) VALUES ($1, $2) RETURNING *",
      [guestId, houseId]
    );
    return res.rows[0];
  });
}

export async function completeStay(stayId: number): Promise<void> {
  await queryOne(
    "UPDATE stays SET status = 'completed', check_out = now() WHERE id = $1 RETURNING id",
    [stayId]
  );
}
