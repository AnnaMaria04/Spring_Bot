import { queryOne, query } from "../db/client";
import { config } from "../config";
import type { Guest } from "../types";

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

/**
 * Insert the guest on first contact, or refresh their username/first_name.
 * The chosen language is preserved on conflict so a guest who picked English
 * keeps it across visits.
 */
export async function upsertGuest(user: TelegramUser): Promise<Guest> {
  const guest = await queryOne<Guest>(
    `INSERT INTO guests (telegram_user_id, username, first_name, language)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING *`,
    [user.id, user.username ?? null, user.first_name ?? null, config.defaultLanguage]
  );
  // RETURNING always yields a row here.
  return guest as Guest;
}

export function getGuestByTelegramId(telegramUserId: number): Promise<Guest | null> {
  return queryOne<Guest>(
    "SELECT * FROM guests WHERE telegram_user_id = $1",
    [telegramUserId]
  );
}

export function getGuestById(id: number): Promise<Guest | null> {
  return queryOne<Guest>("SELECT * FROM guests WHERE id = $1", [id]);
}

export async function setGuestLanguage(
  telegramUserId: number,
  language: "ru" | "en"
): Promise<void> {
  await query("UPDATE guests SET language = $2 WHERE telegram_user_id = $1", [
    telegramUserId,
    language,
  ]);
}
