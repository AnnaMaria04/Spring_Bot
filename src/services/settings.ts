import { queryOne, query } from "../db/client";
import { config, adminGroupIdNum } from "../config";
import type { Settings } from "../types";

export async function getSettings(): Promise<Settings> {
  const s = await queryOne<Settings>("SELECT * FROM settings WHERE id = 1");
  return (
    s ?? {
      id: 1,
      admin_group_id: null,
      emergency_phone: null,
      default_language: config.defaultLanguage,
    }
  );
}

/** Admin group id: DB value wins, otherwise the ADMIN_GROUP_ID env var. */
export async function resolveAdminGroupId(): Promise<number | null> {
  const s = await getSettings();
  return s.admin_group_id ?? adminGroupIdNum();
}

/** Emergency phone: DB value wins, otherwise the EMERGENCY_PHONE env var. */
export async function resolveEmergencyPhone(): Promise<string> {
  const s = await getSettings();
  return s.emergency_phone || config.emergencyPhone;
}

export async function setAdminGroupId(groupId: number): Promise<void> {
  await query("UPDATE settings SET admin_group_id = $1 WHERE id = 1", [groupId]);
}

export async function setEmergencyPhone(phone: string): Promise<void> {
  await query("UPDATE settings SET emergency_phone = $1 WHERE id = 1", [phone]);
}
