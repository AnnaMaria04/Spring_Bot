import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { upsertGuest } from "../services/guests";
import { getActiveStay, startStay } from "../services/stays";
import {
  getHouseByCode,
  getHouseById,
  getSoleActiveHouse,
  normalizeHouseCode,
} from "../services/houses";
import { buildMainMenu, buildHouseConfirmKeyboard } from "../keyboards/guestMenu";

/** Send the welcome screen with the main menu. */
export async function sendWelcome(
  ctx: MyContext,
  lang: Language,
  houseName: string
): Promise<void> {
  await ctx.reply(t(lang).welcome(houseName), { reply_markup: buildMainMenu(lang) });
}

/**
 * Make sure the guest is attached to a house. If only one active house exists,
 * assign it automatically (no prompt). Otherwise ask the guest to type the
 * house number — this scales cleanly from 1 to many houses.
 */
export async function promptForHouse(ctx: MyContext, lang: Language): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const guest = await upsertGuest(from);

  const sole = await getSoleActiveHouse();
  if (sole) {
    await startStay(guest.id, sole.id);
    ctx.session.awaitingHouseNumber = false;
    await sendWelcome(ctx, lang, sole.name);
    return;
  }

  ctx.session.awaitingHouseNumber = true;
  await ctx.reply(t(lang).askHouseNumber);
}

/** Resolve a typed house number into a stay. Returns true on success. */
export async function selectHouseByNumber(
  ctx: MyContext,
  lang: Language,
  text: string
): Promise<boolean> {
  const m = t(lang);
  const code = normalizeHouseCode(text);
  const house = code ? await getHouseByCode(code) : null;
  if (!house || house.status !== "active") {
    await ctx.reply(m.houseNotFound);
    return false;
  }
  if (!ctx.from) return false;
  const guest = await upsertGuest(ctx.from);
  await startStay(guest.id, house.id);
  ctx.session.awaitingHouseNumber = false;
  await sendWelcome(ctx, lang, house.name);
  return true;
}

export async function handleStart(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  // /start is a guest action; ignore it in the admin group (no session there).
  if (ctx.chat?.type !== "private") return;

  // Fresh start clears any half-finished flow.
  ctx.session.pending = null;
  ctx.session.awaitingHouseNumber = false;

  const guest = await upsertGuest(from);
  const lang = (guest.language as Language) || config.defaultLanguage;

  // ctx.match holds the text after "/start" (the QR deep-link payload).
  const payload = typeof ctx.match === "string" ? ctx.match : "";
  const code = normalizeHouseCode(payload);

  if (code) {
    const house = await getHouseByCode(code);
    if (!house || house.status !== "active") {
      await promptForHouse(ctx, lang);
      return;
    }

    const stay = await getActiveStay(guest.id);
    if (stay && stay.house_id === house.id) {
      await sendWelcome(ctx, lang, house.name);
      return;
    }
    if (stay && stay.house_id !== house.id) {
      // Guest opened a different house QR — confirm before switching.
      await ctx.reply(t(lang).houseConfirm(house.name), {
        reply_markup: buildHouseConfirmKeyboard(house.code, lang),
      });
      return;
    }
    await startStay(guest.id, house.id);
    await sendWelcome(ctx, lang, house.name);
    return;
  }

  // No / unrecognized payload.
  const stay = await getActiveStay(guest.id);
  if (stay) {
    const house = await getHouseById(stay.house_id);
    await sendWelcome(ctx, lang, house?.name ?? "");
    return;
  }

  await promptForHouse(ctx, lang);
}
