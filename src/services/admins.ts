import { query, queryOne } from "../db/client";
import { ownerIdNum } from "../config";
import { resolveAdminGroupId } from "./settings";
import type { Admin } from "../types";

/** True if the user is the configured owner or an active admin. */
export async function isAuthorizedAdmin(telegramUserId: number): Promise<boolean> {
  if (ownerIdNum() === telegramUserId) return true;
  const row = await queryOne(
    "SELECT 1 FROM admins WHERE telegram_user_id = $1 AND is_active = true",
    [telegramUserId]
  );
  return row !== null;
}

/**
 * Whether an actor may reply to guests / use admin buttons. In addition to the
 * owner and explicit admins, anyone acting *inside the configured private admin
 * group* is trusted as staff — simple mode for small teams (just add people to
 * the group, no /addadmin needed).
 */
export async function isAuthorizedActor(
  chatId: number | undefined,
  telegramUserId: number
): Promise<boolean> {
  if (await isAuthorizedAdmin(telegramUserId)) return true;
  const groupId = await resolveAdminGroupId();
  return groupId != null && chatId === groupId;
}

/** True if the user is the configured owner or an active admin with owner role. */
export async function isOwner(telegramUserId: number): Promise<boolean> {
  if (ownerIdNum() === telegramUserId) return true;
  const row = await queryOne(
    "SELECT 1 FROM admins WHERE telegram_user_id = $1 AND role = 'owner' AND is_active = true",
    [telegramUserId]
  );
  return row !== null;
}

export async function addAdmin(
  telegramUserId: number,
  username: string | null,
  role: "owner" | "admin" = "admin"
): Promise<void> {
  await query(
    `INSERT INTO admins (telegram_user_id, username, role, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET username = EXCLUDED.username, role = EXCLUDED.role, is_active = true`,
    [telegramUserId, username, role]
  );
}

export async function deactivateAdmin(telegramUserId: number): Promise<void> {
  await query(
    "UPDATE admins SET is_active = false WHERE telegram_user_id = $1",
    [telegramUserId]
  );
}

export function listAdmins(): Promise<Admin[]> {
  return query<Admin>(
    "SELECT * FROM admins WHERE is_active = true ORDER BY id"
  );
}
