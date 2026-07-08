import type { Api } from "grammy";

/** Guest-facing commands — shown only in private chats with the bot. */
const GUEST_COMMANDS = [
  { command: "start", description: "Открыть чат поддержки" },
  { command: "menu", description: "Меню запросов" },
  { command: "help", description: "Помощь" },
  { command: "call", description: "Телефон хозяина" },
  { command: "language", description: "Сменить язык / Change language" },
];

/** Staff-facing commands — shown only inside group/supergroup chats. */
const ADMIN_GROUP_COMMANDS = [
  { command: "open", description: "Открытые заявки" },
  { command: "occupancy", description: "Кто сейчас проживает" },
];

/**
 * Scope the command list by chat type so the admin group never shows the
 * guest menu (start/menu/help/call) and private chats never show staff-only
 * commands. Telegram resolves all_private_chats / all_group_chats ahead of
 * the unscoped "default" list, so this fully overrides whatever was set before.
 */
export async function registerBotCommands(api: Api): Promise<void> {
  await api.setMyCommands(GUEST_COMMANDS, { scope: { type: "all_private_chats" } });
  await api.setMyCommands(ADMIN_GROUP_COMMANDS, { scope: { type: "all_group_chats" } });
}
