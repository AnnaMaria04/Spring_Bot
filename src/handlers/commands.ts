import type { MyContext } from "../context";
import { config, ownerIdNum, type Language } from "../config";
import { t } from "../messages";
import { adminText } from "../messages/admin";
import { upsertGuest } from "../services/guests";
import { getActiveStay } from "../services/stays";
import { listActiveHouses } from "../services/houses";
import { resolveEmergencyPhone, setAdminGroupId } from "../services/settings";
import { isOwner, addAdmin, deactivateAdmin } from "../services/admins";
import {
  buildMainMenu,
  buildHousePicker,
} from "../keyboards/guestMenu";
import { buildLanguageKeyboard } from "../keyboards/languageButtons";

async function guestLang(ctx: MyContext): Promise<Language> {
  if (!ctx.from) return config.defaultLanguage;
  const guest = await upsertGuest(ctx.from);
  return (guest.language as Language) || config.defaultLanguage;
}

// ── Guest commands ──────────────────────────────────────────────

export async function handleMenu(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const guest = await upsertGuest(ctx.from);
  const lang = (guest.language as Language) || config.defaultLanguage;
  const m = t(lang);
  const stay = await getActiveStay(guest.id);
  if (stay) {
    await ctx.reply(m.menuPrompt, { reply_markup: buildMainMenu(lang) });
  } else {
    const houses = await listActiveHouses();
    await ctx.reply(m.scanOrChooseHouse, { reply_markup: buildHousePicker(houses) });
  }
}

export async function handleHelp(ctx: MyContext): Promise<void> {
  const lang = await guestLang(ctx);
  await ctx.reply(t(lang).help(await resolveEmergencyPhone()));
}

export async function handleCall(ctx: MyContext): Promise<void> {
  const lang = await guestLang(ctx);
  await ctx.reply(t(lang).callInfo(await resolveEmergencyPhone()));
}

export async function handleLanguage(ctx: MyContext): Promise<void> {
  const lang = await guestLang(ctx);
  await ctx.reply(t(lang).languageChoose, { reply_markup: buildLanguageKeyboard() });
}

// ── Admin / setup commands ──────────────────────────────────────

/** Report the current chat id (and topic id), to find ADMIN_GROUP_ID. */
export async function handleWhereami(ctx: MyContext): Promise<void> {
  if (!ctx.chat) return;
  const threadId = ctx.message?.message_thread_id;
  await ctx.reply(adminText.whereami(ctx.chat.id, threadId), {
    reply_to_message_id: ctx.message?.message_id,
  });
}

/** Report the caller's Telegram id, to find OWNER_TELEGRAM_ID. */
export async function handleMyId(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  await ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
}

/** Save the current group as the admin group (owner only). */
export async function handleSetGroup(ctx: MyContext): Promise<void> {
  if (!ctx.chat || !ctx.from) return;
  if (ctx.chat.type === "private") {
    await ctx.reply("Команду /setgroup нужно отправить в группе администраторов.");
    return;
  }
  // During first-time setup (no owner configured) allow anyone to claim it.
  if (ownerIdNum() !== null && !(await isOwner(ctx.from.id))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  await setAdminGroupId(ctx.chat.id);
  await ctx.reply(adminText.setGroupOk(ctx.chat.id));
}

export async function handleAddAdmin(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  if (!(await isOwner(ctx.from.id))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  let targetId: number | null = null;
  let username: string | null = null;
  const reply = ctx.message?.reply_to_message;
  if (reply?.from) {
    targetId = reply.from.id;
    username = reply.from.username ?? null;
  } else {
    const args = (typeof ctx.match === "string" ? ctx.match : "").trim().split(/\s+/);
    const n = Number(args[0]);
    if (Number.isFinite(n) && n > 0) targetId = n;
    if (args[1]) username = args[1].replace("@", "");
  }
  if (!targetId) {
    await ctx.reply(
      "Использование: ответьте командой /addadmin на сообщение пользователя, или укажите ID: /addadmin 123456789"
    );
    return;
  }
  await addAdmin(targetId, username, "admin");
  await ctx.reply(`✅ Добавлен администратор: ${targetId}${username ? ` (@${username})` : ""}`);
}

export async function handleRemoveAdmin(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  if (!(await isOwner(ctx.from.id))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  let targetId: number | null = null;
  const reply = ctx.message?.reply_to_message;
  if (reply?.from) {
    targetId = reply.from.id;
  } else {
    const n = Number((typeof ctx.match === "string" ? ctx.match : "").trim());
    if (Number.isFinite(n) && n > 0) targetId = n;
  }
  if (!targetId) {
    await ctx.reply("Использование: /removeadmin 123456789 или ответом на сообщение пользователя.");
    return;
  }
  await deactivateAdmin(targetId);
  await ctx.reply(`✅ Администратор деактивирован: ${targetId}`);
}
