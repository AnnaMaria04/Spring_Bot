import { InputFile } from "grammy";
import QRCode from "qrcode";
import type { MyContext } from "../context";
import { config, ownerIdNum, type Language } from "../config";
import { t } from "../messages";
import { adminText, statusLabel, formatDuration } from "../messages/admin";
import { categoryLabel } from "../categories";
import { upsertGuest } from "../services/guests";
import { getActiveStay } from "../services/stays";
import type { House } from "../types";
import {
  listAllHouses,
  listActiveHouses,
  getHouseById,
  getHouseByCode,
  normalizeHouseCode,
  setHouseWifi,
  setHouseCheckin,
  setHouseAddress,
  setHouseStatus,
  setHouseName,
} from "../services/houses";
import { listOpenRequests } from "../services/requests";
import { resolveEmergencyPhone, setAdminGroupId } from "../services/settings";
import { isOwner, addAdmin, deactivateAdmin, isAuthorizedActor } from "../services/admins";
import { getOccupancy, moscowToday, bnovoConfigured } from "../services/bnovo";
import { buildMainMenu } from "../keyboards/guestMenu";
import { buildLanguageKeyboard } from "../keyboards/languageButtons";
import { promptForHouse } from "./start";

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
    await promptForHouse(ctx, lang);
  }
}

export async function handleHelp(ctx: MyContext): Promise<void> {
  const lang = await guestLang(ctx);
  await ctx.reply(t(lang).help(await resolveEmergencyPhone()), {
    reply_markup: buildMainMenu(lang),
  });
}

export async function handleCall(ctx: MyContext): Promise<void> {
  const lang = await guestLang(ctx);
  await ctx.reply(t(lang).callInfo(await resolveEmergencyPhone()), {
    reply_markup: buildMainMenu(lang),
  });
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
    await ctx.reply("Команду /setgroup нужно отправить в группе хозяев.");
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
  if (!(await canManage(ctx))) {
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
  await ctx.reply(`✅ Добавлен в команду хозяев: ${targetId}${username ? ` (@${username})` : ""}`);
}

export async function handleRemoveAdmin(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  if (!(await canManage(ctx))) {
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
  await ctx.reply(`✅ Удалён из команды хозяев: ${targetId}`);
}

// ── House configuration (owner) ─────────────────────────────────

/** Owner-only, with a bootstrap allowance before an owner id is configured. */
async function canManage(ctx: MyContext): Promise<boolean> {
  if (!ctx.from) return false;
  if (ownerIdNum() === null) return true; // no owner set yet → allow first-time setup
  return isOwner(ctx.from.id);
}

/** List all houses, their status, and their configured auto-answer info. */
export async function handleHouses(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const houses = await listAllHouses();
  const lines = houses.map((h) => {
    const on = h.status === "active" ? "✅" : "⏸";
    const wifi = h.wifi_name ? "📶✓" : "📶—";
    const chk = h.checkin_info ? "🕒✓" : "🕒—";
    const addr = h.address ? "📍✓" : "📍—";
    return `${on} ${h.code} · ${h.name}   ${wifi} ${chk} ${addr}`;
  });
  const help =
    "\n\nУправление домиками:\n" +
    "/enablehouse <код> [название] — включить / переименовать\n" +
    "/disablehouse <код> — выключить\n\n" +
    "Автоответы гостям:\n" +
    "/setwifi <код> <сеть> <пароль> — сохранить данные Wi-Fi\n" +
    "/setcheckin <код> <текст> — сохранить текст про заезд/выезд\n" +
    "/setaddress <код> <адрес> — сохранить адрес / как добраться\n\n" +
    "QR-код для гостей:\n" +
    "/qr <код> — прислать QR-код домика (распечатайте и разместите в домике: гость сканирует и сразу попадает в чат с этим домиком)\n" +
    "/qr all — прислать QR-коды всех активных домиков разом";
  await ctx.reply((lines.join("\n") || "Домиков нет.") + help);
}

/** Send one house's printable QR code (deep-links straight into its chat). */
async function sendHouseQr(ctx: MyContext, house: House): Promise<void> {
  const link = `https://t.me/${config.publicBotUsername}?start=${house.code}`;
  const png = await QRCode.toBuffer(link, { width: 800, margin: 2 });
  await ctx.replyWithPhoto(new InputFile(png, `${house.code}.png`), {
    caption:
      `📷 QR-код «${house.name}» (${house.code})\n${link}\n\n` +
      "Распечатайте и разместите в домике — гость отсканирует и сразу попадёт в чат с этим домиком.",
  });
}

/** /qr <code> for one house, or /qr all for every active house at once. */
export async function handleQr(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const arg = (typeof ctx.match === "string" ? ctx.match : "").trim();

  if (arg.toLowerCase() === "all") {
    const houses = await listActiveHouses();
    if (houses.length === 0) {
      await ctx.reply("Активных домиков нет.");
      return;
    }
    for (const house of houses) {
      await sendHouseQr(ctx, house);
    }
    return;
  }

  const code = normalizeHouseCode(arg);
  if (!code) {
    await ctx.reply(
      "Использование: /qr <код домика> (например /qr h1), или /qr all — коды всех активных домиков"
    );
    return;
  }
  const house = await getHouseByCode(code);
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  await sendHouseQr(ctx, house);
}

export async function handleEnableHouse(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const raw = (typeof ctx.match === "string" ? ctx.match : "").trim();
  const sp = raw.indexOf(" ");
  const code = normalizeHouseCode(sp > 0 ? raw.slice(0, sp) : raw);
  const newName = sp > 0 ? raw.slice(sp + 1).trim() : "";
  if (!code) {
    await ctx.reply("Использование: /enablehouse <код домика> [новое название]");
    return;
  }
  let house = await setHouseStatus(code, "active");
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  if (newName) house = (await setHouseName(code, newName)) ?? house;
  await ctx.reply(`✅ Домик «${house.name}» (${code}) включён.`);
}

export async function handleDisableHouse(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const code = normalizeHouseCode((typeof ctx.match === "string" ? ctx.match : "").trim());
  if (!code) {
    await ctx.reply("Использование: /disablehouse <код домика>");
    return;
  }
  const house = await setHouseStatus(code, "inactive");
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  await ctx.reply(`⏸ Домик «${house.name}» (${code}) выключен.`);
}

export async function handleSetWifi(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const args = (typeof ctx.match === "string" ? ctx.match : "").trim().split(/\s+/);
  const code = args[0] ? normalizeHouseCode(args[0]) : null;
  if (!code || args.length < 3) {
    await ctx.reply(
      "Использование: /setwifi <код домика> <сеть> <пароль>\nНапример: /setwifi h1 SpringVillage_WiFi 12345678"
    );
    return;
  }
  const name = args[1];
  const password = args.slice(2).join(" ");
  const house = await setHouseWifi(code, name, password);
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  await ctx.reply(
    `✅ Wi-Fi для «${house.name}» сохранён.\n📶 ${name}\n🔑 ${password}\n\nТеперь бот отвечает на вопрос про Wi-Fi автоматически.`
  );
}

export async function handleSetCheckin(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const raw = (typeof ctx.match === "string" ? ctx.match : "").trim();
  const sp = raw.indexOf(" ");
  const code = sp > 0 ? normalizeHouseCode(raw.slice(0, sp)) : null;
  const text = sp > 0 ? raw.slice(sp + 1).trim() : "";
  if (!code || !text) {
    await ctx.reply("Использование: /setcheckin <код домика> <текст про заезд/выезд>");
    return;
  }
  const house = await setHouseCheckin(code, text);
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  await ctx.reply(`✅ Информация о заезде/выезде для «${house.name}» сохранена.`);
}

export async function handleSetAddress(ctx: MyContext): Promise<void> {
  if (!(await canManage(ctx))) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const raw = (typeof ctx.match === "string" ? ctx.match : "").trim();
  const sp = raw.indexOf(" ");
  const code = sp > 0 ? normalizeHouseCode(raw.slice(0, sp)) : null;
  const text = sp > 0 ? raw.slice(sp + 1).trim() : "";
  if (!code || !text) {
    await ctx.reply("Использование: /setaddress <код домика> <адрес / как добраться>");
    return;
  }
  const house = await setHouseAddress(code, text);
  if (!house) {
    await ctx.reply(`Домик «${code}» не найден.`);
    return;
  }
  await ctx.reply(`✅ Адрес для «${house.name}» сохранён.`);
}

// ── Occupancy (Bnovo) ───────────────────────────────────────────

/** Show who is currently staying, per Bnovo. Staff-only (owner, group members,
 *  or anyone during first-time setup before an owner is configured). */
export async function handleOccupancy(ctx: MyContext): Promise<void> {
  const allowed =
    (await canManage(ctx)) ||
    (ctx.from ? await isAuthorizedActor(ctx.chat?.id, ctx.from.id) : false);
  if (!allowed) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  if (!bnovoConfigured()) {
    await ctx.reply(
      "Bnovo не подключён. Добавьте переменные BNOVO_API_KEY и BNOVO_ACCOUNT_ID (ID аккаунта из панели Bnovo) в Vercel → Settings → Environment Variables и сделайте Redeploy."
    );
    return;
  }
  const r = await getOccupancy(moscowToday());
  if (!r.ok) {
    await ctx.reply(`⚠️ Не удалось получить данные из Bnovo:\n\n${r.error}`);
    return;
  }
  if (!r.occupant) {
    await ctx.reply("🏡 Сейчас в домике никто не проживает (по данным Bnovo).");
    return;
  }
  await ctx.reply(
    `🗓 Сейчас проживает:\n\n👤 ${r.occupant.name}\n📥 Заезд: ${r.occupant.arrival}\n📤 Выезд: ${r.occupant.departure}`
  );
}

// ── Open requests overview ──────────────────────────────────────

/** List all still-open requests so staff can check nothing was forgotten. */
export async function handleOpen(ctx: MyContext): Promise<void> {
  const allowed =
    (await canManage(ctx)) ||
    (ctx.from ? await isAuthorizedActor(ctx.chat?.id, ctx.from.id) : false);
  if (!allowed) {
    await ctx.reply(adminText.notAuthorized);
    return;
  }
  const open = await listOpenRequests();
  if (open.length === 0) {
    await ctx.reply("✅ Открытых заявок нет — всё закрыто.");
    return;
  }
  const now = Date.now();
  const blocks: string[] = [];
  for (const r of open) {
    const house = await getHouseById(r.house_id);
    const age = formatDuration(now - new Date(r.created_at).getTime());
    const who = r.assigned_admin_name ? `👷 ${r.assigned_admin_name}` : "🔸 не взят";
    blocks.push(
      `#${r.id} · ${house?.name ?? ""} · ${categoryLabel(r.category, "ru")}\n` +
        `   ${statusLabel(r.status)} · ${who} · ${age} назад`
    );
  }
  await ctx.reply(`📋 Открытые заявки (${open.length}):\n\n${blocks.join("\n\n")}`);
}
