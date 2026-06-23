import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { upsertGuest } from "../services/guests";
import { getActiveStay, startStay } from "../services/stays";
import {
  getHouseByCode,
  listActiveHouses,
  normalizeHouseCode,
} from "../services/houses";
import { buildMainMenu, buildHouseConfirmKeyboard, buildHousePicker } from "../keyboards/guestMenu";

/** Send the welcome screen with the main menu. */
export async function sendWelcome(
  ctx: MyContext,
  lang: Language,
  houseName: string
): Promise<void> {
  await ctx.reply(t(lang).welcome(houseName), { reply_markup: buildMainMenu(lang) });
}

export async function handleStart(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  // /start is a guest action; ignore it in the admin group (where there is no
  // session middleware). Guests always use the bot in a private chat.
  if (ctx.chat?.type !== "private") return;

  // Fresh start clears any half-finished flow.
  ctx.session.pending = null;

  const guest = await upsertGuest(from);
  const lang = (guest.language as Language) || config.defaultLanguage;
  const m = t(lang);

  // ctx.match holds the text after "/start" (the QR deep-link payload).
  const payload = typeof ctx.match === "string" ? ctx.match : "";
  const code = normalizeHouseCode(payload);

  if (code) {
    const house = await getHouseByCode(code);
    if (!house) {
      const houses = await listActiveHouses();
      await ctx.reply(m.unknownHouse, { reply_markup: buildHousePicker(houses) });
      return;
    }

    const stay = await getActiveStay(guest.id);
    if (stay && stay.house_id === house.id) {
      await sendWelcome(ctx, lang, house.name);
      return;
    }
    if (stay && stay.house_id !== house.id) {
      // Guest opened a different house QR — confirm before switching.
      await ctx.reply(m.houseConfirm(house.name), {
        reply_markup: buildHouseConfirmKeyboard(house.code, lang),
      });
      return;
    }
    // No active stay yet: open one for the detected house.
    await startStay(guest.id, house.id);
    await sendWelcome(ctx, lang, house.name);
    return;
  }

  // No / unrecognized payload.
  const stay = await getActiveStay(guest.id);
  if (stay) {
    const houses = await listActiveHouses();
    const house = houses.find((h) => h.id === stay.house_id);
    await sendWelcome(ctx, lang, house?.name ?? "");
    return;
  }

  const houses = await listActiveHouses();
  await ctx.reply(m.scanOrChooseHouse, { reply_markup: buildHousePicker(houses) });
}
