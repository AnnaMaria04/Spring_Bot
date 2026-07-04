import { queryOne, withTransaction } from "../db/client";
import type { Stay } from "../types";

/** The guest's current active stay, or null. */
export function getActiveStay(guestId: number): Promise<Stay | null> {
  return queryOne<Stay>(
    "SELECT * FROM stays WHERE guest_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1",
    [guestId]
  );
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
