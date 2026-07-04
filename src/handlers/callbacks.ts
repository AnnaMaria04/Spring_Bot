import { GrammyError, InlineKeyboard } from "grammy";
import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { adminText, formatGuestName } from "../messages/admin";
import {
  CATEGORIES,
  detailSummary,
  type CategoryKey,
} from "../categories";
import { upsertGuest, getGuestById, setGuestLanguage } from "../services/guests";
import { getActiveStay, startStay } from "../services/stays";
import {
  getHouseByCode,
  getHouseById,
  listActiveHouses,
} from "../services/houses";
import {
  getRequestById,
  assignAdmin,
  updateStatus,
  markUrgent,
} from "../services/requests";
import { isAuthorizedAdmin } from "../services/admins";
import { resolveEmergencyPhone } from "../services/settings";
import {
  refreshCard,
  postUrgentAlert,
  sendInfoCard,
} from "../services/notifications";
import { sendWelcome } from "./start";
import { createCategorizedRequest } from "./intake";
import {
  buildMainMenu,
  buildHousePicker,
  buildCategoryKeyboard,
} from "../keyboards/guestMenu";

const ADMIN_ACTIONS = new Set(["take", "reply", "done", "urgent", "reopen", "info"]);

/** Safely edit the message the callback came from, falling back to a reply. */
async function editOrReply(
  ctx: MyContext,
  text: string,
  keyboard?: Parameters<MyContext["reply"]>[1]
): Promise<void> {
  try {
    await ctx.editMessageText(text, keyboard as never);
  } catch (err) {
    if (err instanceof GrammyError && err.description.includes("not modified")) return;
    await ctx.reply(text, keyboard as never);
  }
}

async function guestLang(ctx: MyContext): Promise<Language> {
  if (!ctx.from) return config.defaultLanguage;
  const guest = await upsertGuest(ctx.from);
  return (guest.language as Language) || config.defaultLanguage;
}

function backKb(lang: Language): InlineKeyboard {
  return new InlineKeyboard().text(t(lang).btnBack, "menu_back");
}

export async function handleCallback(ctx: MyContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [action] = data.split(":");
  if (ADMIN_ACTIONS.has(action)) {
    await handleAdminCallback(ctx, data);
  } else {
    await handleGuestCallback(ctx, data);
  }
}

// ── Guest callbacks ─────────────────────────────────────────────
async function handleGuestCallback(ctx: MyContext, data: string): Promise<void> {
  const lang = await guestLang(ctx);
  const m = t(lang);

  // House selection / confirmation
  if (data.startsWith("house_confirm:") || data.startsWith("house_pick:")) {
    const code = data.split(":")[1];
    const house = await getHouseByCode(code);
    if (!ctx.from || !house) {
      await ctx.answerCallbackQuery();
      return;
    }
    const guest = await upsertGuest(ctx.from);
    await startStay(guest.id, house.id);
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.welcome(house.name), { reply_markup: buildMainMenu(lang) });
    return;
  }

  if (data === "house_change") {
    const houses = await listActiveHouses();
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.chooseHouse, { reply_markup: buildHousePicker(houses) });
    return;
  }

  if (data === "menu_back") {
    await ctx.answerCallbackQuery();
    ctx.session.pending = null;
    await editOrReply(ctx, m.menuPrompt, { reply_markup: buildMainMenu(lang) });
    return;
  }

  if (data.startsWith("lang:")) {
    const newLang = data.split(":")[1] === "en" ? "en" : "ru";
    if (ctx.from) await setGuestLanguage(ctx.from.id, newLang);
    const m2 = t(newLang);
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m2.languageSet, { reply_markup: buildMainMenu(newLang) });
    return;
  }

  // Category selection: cat:<key>
  if (data.startsWith("cat:")) {
    await handleCategory(ctx, data.split(":")[1] as CategoryKey, lang);
    return;
  }

  // Add a free-text comment for a category: catcomment:<key>
  if (data.startsWith("catcomment:")) {
    const category = data.split(":")[1];
    ctx.session.pending = { kind: "new_request_text", category };
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.addCommentPrompt, { reply_markup: backKb(lang) });
    return;
  }

  // Direct request from a sub-option: req:<category>:<detail>
  if (data.startsWith("req:")) {
    const [, category, detail] = data.split(":");
    const res = await createCategorizedRequest(ctx, {
      category,
      summary: detailSummary(category, detail),
    });
    await ctx.answerCallbackQuery();
    if (res.ok) {
      // For technical issues a photo speeds things up (spec recommendation).
      const extra =
        category === "broken" && lang === "ru"
          ? "\n\nЕсли можно, пришлите фото — так быстрее разберёмся."
          : "";
      await editOrReply(ctx, res.m.requestReceived + extra);
    }
    return;
  }

  // Returning-after-checkout branch
  if (data.startsWith("past:")) {
    ctx.session.pending = { kind: "new_request_text", category: "other" };
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.writeQuestion);
    return;
  }

  await ctx.answerCallbackQuery();
}

async function handleCategory(
  ctx: MyContext,
  key: CategoryKey,
  lang: Language
): Promise<void> {
  const m = t(lang);
  await ctx.answerCallbackQuery();

  // Emergency: show the phone immediately and alert admins.
  if (key === "call") {
    const phone = await resolveEmergencyPhone();
    const res = await createCategorizedRequest(ctx, {
      category: "call",
      summary: "🚨 Гость запросил срочную связь с администратором.",
      status: "urgent",
      priority: "urgent",
    });
    if (res.ok && res.req && res.house) {
      await postUrgentAlert(
        ctx.api,
        res.req,
        res.house,
        formatGuestName(ctx.from?.first_name, ctx.from?.username)
      );
    }
    await editOrReply(ctx, m.emergency(phone));
    return;
  }

  // Info-only: Wi-Fi
  if (key === "wifi") {
    const house = await activeHouse(ctx);
    if (house?.wifi_name && house.wifi_password) {
      await editOrReply(ctx, m.wifiInfo(house.wifi_name, house.wifi_password), {
        reply_markup: buildCategoryKeyboard("wifi", lang) ?? undefined,
      });
    } else {
      // No Wi-Fi on file → forward the question to admins.
      await createCategorizedRequest(ctx, {
        category: "wifi",
        summary: "Гость спрашивает данные Wi-Fi.",
      });
      await editOrReply(ctx, m.wifiMissing);
    }
    return;
  }

  if (key === "checkinout") {
    await editOrReply(ctx, m.checkinoutInfo, {
      reply_markup: buildCategoryKeyboard("checkinout", lang) ?? undefined,
    });
    return;
  }

  if (key === "map") {
    await editOrReply(ctx, m.mapInfo, {
      reply_markup: buildCategoryKeyboard("map", lang) ?? undefined,
    });
    return;
  }

  // Free-text categories
  if (key === "other") {
    ctx.session.pending = { kind: "new_request_text", category: "other" };
    await editOrReply(ctx, m.writeQuestion, { reply_markup: backKb(lang) });
    return;
  }
  if (key === "taxi") {
    ctx.session.pending = { kind: "new_request_text", category: "taxi" };
    await editOrReply(ctx, m.taxiQuestion, { reply_markup: backKb(lang) });
    return;
  }

  // Categories with a sub-menu (drova, linen, cleaning, broken, banya)
  const question = categoryQuestion(key, m);
  const kb = buildCategoryKeyboard(key, lang);
  await editOrReply(ctx, question, { reply_markup: kb ?? buildMainMenu(lang) });
}

function categoryQuestion(key: CategoryKey, m: ReturnType<typeof t>): string {
  switch (key) {
    case "drova":
      return m.drovaQuestion;
    case "linen":
      return m.linenQuestion;
    case "cleaning":
      return m.cleaningQuestion;
    case "broken":
      return m.brokenQuestion;
    case "banya":
      return m.banyaQuestion;
    default:
      return CATEGORIES[key]?.ru ?? m.menuPrompt;
  }
}

async function activeHouse(ctx: MyContext) {
  if (!ctx.from) return null;
  const guest = await upsertGuest(ctx.from);
  const stay = await getActiveStay(guest.id);
  if (!stay) return null;
  return getHouseById(stay.house_id);
}

// ── Admin callbacks ─────────────────────────────────────────────
async function handleAdminCallback(ctx: MyContext, data: string): Promise<void> {
  if (!ctx.from || !(await isAuthorizedAdmin(ctx.from.id))) {
    await ctx.answerCallbackQuery({ text: adminText.notAuthorized, show_alert: true });
    return;
  }

  const [action, idStr] = data.split(":");
  const requestId = Number(idStr);
  const req = await getRequestById(requestId);
  if (!req) {
    await ctx.answerCallbackQuery({ text: "Запрос не найден.", show_alert: true });
    return;
  }

  const adminName = formatGuestName(ctx.from.first_name, ctx.from.username);

  switch (action) {
    case "take": {
      if (req.assigned_admin_id && req.assigned_admin_id !== ctx.from.id) {
        await ctx.answerCallbackQuery({
          text: adminText.alreadyTaken(req.assigned_admin_name ?? "другой администратор"),
          show_alert: true,
        });
        return;
      }
      await assignAdmin(requestId, ctx.from.id, adminName);
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.takenAck(requestId) });
      return;
    }
    case "reply": {
      await ctx.answerCallbackQuery({ text: adminText.replyInstruction, show_alert: true });
      return;
    }
    case "done": {
      await updateStatus(requestId, "done");
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.markedDone(requestId) });
      await notifyGuest(ctx, req.guest_id, (m) => m.done);
      return;
    }
    case "urgent": {
      const updated = await markUrgent(requestId);
      await refreshCard(ctx.api, requestId);
      const house = await getHouseById(req.house_id);
      const guest = await getGuestById(req.guest_id);
      if (updated && house) {
        await postUrgentAlert(
          ctx.api,
          updated,
          house,
          formatGuestName(guest?.first_name, guest?.username)
        );
      }
      await ctx.answerCallbackQuery({ text: adminText.markedUrgent(requestId) });
      const phone = await resolveEmergencyPhone();
      await notifyGuest(ctx, req.guest_id, (m) => m.emergency(phone));
      return;
    }
    case "reopen": {
      await updateStatus(requestId, "in_progress");
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.reopened(requestId) });
      return;
    }
    case "info": {
      await sendInfoCard(ctx.api, req);
      await ctx.answerCallbackQuery();
      return;
    }
    default:
      await ctx.answerCallbackQuery();
  }
}

/** Send a localized message to a guest, ignoring delivery failures. */
async function notifyGuest(
  ctx: MyContext,
  guestId: number,
  pick: (m: ReturnType<typeof t>) => string
): Promise<void> {
  const guest = await getGuestById(guestId);
  if (!guest) return;
  const m = t((guest.language as Language) || config.defaultLanguage);
  try {
    await ctx.api.sendMessage(guest.telegram_user_id, pick(m));
  } catch (err) {
    console.warn("[callbacks] notifyGuest failed:", (err as Error).message);
  }
}
