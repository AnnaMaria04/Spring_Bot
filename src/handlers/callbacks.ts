import { GrammyError, InlineKeyboard } from "grammy";
import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { adminText, formatGuestName } from "../messages/admin";
import { detailSummary, type CategoryKey } from "../categories";
import { PROPERTY } from "../content/property";
import { upsertGuest, getGuestById, setGuestLanguage } from "../services/guests";
import { getActiveStay, startStay } from "../services/stays";
import { getHouseByCode, getHouseById } from "../services/houses";
import {
  getRequestById,
  assignAdmin,
  updateStatus,
  markDone,
  addMessage,
} from "../services/requests";
import { isAuthorizedActor } from "../services/admins";
import { resolveEmergencyPhone } from "../services/settings";
import {
  refreshCard,
  postUrgentAlert,
  sendInfoCard,
  replyToStored,
} from "../services/notifications";
import { promptForHouse } from "./start";
import { createCategorizedRequest } from "./intake";
import {
  buildMainMenu,
  buildServicesMenu,
  buildInfoMenu,
  buildCategoryKeyboard,
} from "../keyboards/guestMenu";

const ADMIN_ACTIONS = new Set(["take", "reply", "done", "reopen", "info"]);

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

function backKb(lang: Language, target: string = "menu_back"): InlineKeyboard {
  return new InlineKeyboard().text(t(lang).btnBack, target);
}

/**
 * Prompt the guest for free text using ForceReply — this auto-opens the
 * keyboard with a placeholder hint, so it's obvious they should just type.
 * Returns the sent message so its id can be tracked and deleted if abandoned.
 */
async function askText(ctx: MyContext, text: string, placeholder: string) {
  return ctx.reply(text, {
    reply_markup: { force_reply: true, input_field_placeholder: placeholder.slice(0, 64) },
  });
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
/** Thin error boundary — button-driven flows had no fallback, unlike typed messages. */
async function handleGuestCallback(ctx: MyContext, data: string): Promise<void> {
  try {
    await handleGuestCallbackInner(ctx, data);
  } catch (err) {
    console.error("[callbacks] guest callback error:", err);
    await ctx.answerCallbackQuery().catch(() => undefined);
    const lang = await guestLang(ctx).catch(() => config.defaultLanguage);
    const phone = await resolveEmergencyPhone().catch(() => config.emergencyPhone);
    await ctx.reply(t(lang).dbError(phone)).catch(() => undefined);
  }
}

async function handleGuestCallbackInner(ctx: MyContext, data: string): Promise<void> {
  const lang = await guestLang(ctx);
  const m = t(lang);

  // Any button press supersedes a pending ForceReply prompt — otherwise a
  // guest who changes their mind and taps a different button (instead of
  // typing) leaves stale state around, and their next message would get
  // misfiled under whatever they were asked about before. Delete the now-
  // meaningless "please type..." prompt too, so it doesn't linger in the
  // chat. Handlers below that need a fresh prompt (catcomment / "other")
  // set it again right after.
  if (ctx.session.pending?.promptMessageId && ctx.chat) {
    await ctx.api
      .deleteMessage(ctx.chat.id, ctx.session.pending.promptMessageId)
      .catch(() => undefined);
  }
  ctx.session.pending = null;

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
    ctx.session.awaitingHouseNumber = false;
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.welcome(house.name), { reply_markup: buildMainMenu(lang) });
    return;
  }

  if (data === "house_change") {
    await ctx.answerCallbackQuery();
    await promptForHouse(ctx, lang);
    return;
  }

  if (data === "menu_back") {
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.menuPrompt, { reply_markup: buildMainMenu(lang) });
    return;
  }

  // Menu groups
  if (data === "group:services") {
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.servicesTitle, { reply_markup: buildServicesMenu(lang) });
    return;
  }
  if (data === "group:info") {
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, m.infoTitle, { reply_markup: buildInfoMenu(lang) });
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
    await ctx.answerCallbackQuery();
    const sent = await askText(ctx, m.addCommentPrompt, m.inputPlaceholder);
    ctx.session.pending = { kind: "new_request_text", category, promptMessageId: sent.message_id };
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
      if (!res.delivered) {
        // Don't confirm a request the admin group never actually received.
        await editOrReply(ctx, res.m.genericError(await resolveEmergencyPhone()), {
          reply_markup: backKb(lang, "group:services"),
        });
      } else {
        // For technical issues a photo speeds things up (spec recommendation).
        const extra = category === "broken" ? res.m.brokenPhotoHint : "";
        await editOrReply(ctx, res.m.requestReceived + extra, {
          reply_markup: backKb(lang, "group:services"),
        });
      }
    }
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
      // The phone number below is always shown regardless — this alert is a
      // bonus, not the guest's only path to help — but a failure here still
      // means staff won't see it proactively, so it's worth a server log.
      const alerted = await postUrgentAlert(
        ctx.api,
        res.req,
        res.house,
        formatGuestName(ctx.from?.first_name, ctx.from?.username)
      );
      if (!alerted) {
        console.error(`[callbacks] urgent alert failed to deliver for request #${res.req.id}`);
      }
    }
    await editOrReply(ctx, m.emergency(phone), { reply_markup: backKb(lang, "group:info") });
    return;
  }

  // Info-only: Wi-Fi (from stored house data, else forward to the administrators).
  if (key === "wifi") {
    const house = await activeHouse(ctx);
    if (house?.wifi_name && house.wifi_password) {
      await editOrReply(ctx, m.wifiInfo(house.wifi_name, house.wifi_password), {
        reply_markup: backKb(lang, "group:info"),
      });
    } else {
      const res = await createCategorizedRequest(ctx, {
        category: "wifi",
        summary: "Гость спрашивает данные Wi-Fi.",
      });
      if (!res.ok) return; // promptForHouse/genericError already shown
      await editOrReply(
        ctx,
        res.delivered ? m.wifiMissing : m.genericError(await resolveEmergencyPhone()),
        { reply_markup: backKb(lang, "group:info") }
      );
    }
    return;
  }

  // Info-only: instant auto-answers from property data.
  if (key === "activities") {
    await editOrReply(ctx, m.activitiesInfo, { reply_markup: backKb(lang, "group:info") });
    return;
  }
  if (key === "checkout") {
    const house = await activeHouse(ctx);
    const text = house?.checkin_info?.trim() || m.checkoutInfo;
    await editOrReply(ctx, text, { reply_markup: backKb(lang, "group:info") });
    return;
  }
  if (key === "rules") {
    await editOrReply(ctx, m.rulesInfo, { reply_markup: backKb(lang, "group:info") });
    return;
  }
  if (key === "address") {
    const house = await activeHouse(ctx);
    const address = house?.address?.trim() || PROPERTY.addressFull;
    await editOrReply(ctx, m.addressInfo(address, PROPERTY.coords), {
      reply_markup: backKb(lang, "group:info"),
    });
    return;
  }

  // Free-text — ForceReply makes it obvious the guest should just type.
  if (key === "other") {
    const sent = await askText(ctx, m.writeQuestion, m.inputPlaceholder);
    ctx.session.pending = {
      kind: "new_request_text",
      category: "other",
      promptMessageId: sent.message_id,
    };
    return;
  }

  // Service categories with a sub-menu (drova, linen, cleaning, gear, bbq, broken)
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
    case "gear":
      return m.gearQuestion;
    case "bbq":
      return m.bbqQuestion;
    case "broken":
      return m.brokenQuestion;
    default:
      return m.menuPrompt;
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
  if (!ctx.from || !(await isAuthorizedActor(ctx.chat?.id, ctx.from.id))) {
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
      // assignAdmin only succeeds if unassigned or already this admin — the
      // in-memory `req` could be stale, so trust the DB write, not the read.
      const updated = await assignAdmin(requestId, ctx.from.id, adminName);
      if (!updated) {
        const current = await getRequestById(requestId);
        await ctx.answerCallbackQuery({
          text: adminText.alreadyTaken(current?.assigned_admin_name ?? "другой администратор"),
          show_alert: true,
        });
        return;
      }
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.takenAck(requestId) });
      return;
    }
    case "reply": {
      await ctx.answerCallbackQuery({ text: adminText.replyInstruction, show_alert: true });
      return;
    }
    case "done": {
      // markDone only succeeds once (WHERE status != 'done') — if someone
      // already completed it a moment ago, don't re-notify or overwrite credit.
      const updated = await markDone(requestId, adminName);
      if (!updated) {
        await ctx.answerCallbackQuery({ text: "Уже отмечено как завершённое.", show_alert: true });
        return;
      }
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.markedDone(requestId) });
      const guestNotified = await notifyGuest(ctx, req.guest_id, (m) => m.done);
      if (!guestNotified) {
        await ctx.reply(adminText.guestBlocked, {
          reply_parameters: replyToStored(req.admin_message_id),
        });
      }
      const house = await getHouseById(req.house_id);
      const hint = await ctx.reply(adminText.doneWithPhotoHint, {
        reply_parameters: replyToStored(req.admin_message_id),
        message_thread_id: house?.topic_id ?? undefined,
      });
      // Track this message too, so a staff reply to the hint itself (not just
      // the original card) still routes back to this request. It's an
      // admin-group-only note (not a message to the guest), so it's tagged
      // "admin_note" — its id lives in the admin chat's id space, same as
      // guest_to_admin, which is what findRequestByAdminMessage relies on.
      await addMessage({
        requestId,
        direction: "admin_note",
        text: adminText.doneWithPhotoHint,
        mediaType: "text",
        telegramMessageId: hint.message_id,
      });
      return;
    }
    case "reopen": {
      await updateStatus(requestId, "in_progress");
      await refreshCard(ctx.api, requestId);
      await ctx.answerCallbackQuery({ text: adminText.reopened(requestId) });
      return;
    }
    case "info": {
      const sent = await sendInfoCard(ctx.api, req);
      await ctx.answerCallbackQuery(
        sent ? undefined : { text: "Не удалось отправить, попробуйте ещё раз.", show_alert: true }
      );
      return;
    }
    default:
      await ctx.answerCallbackQuery();
  }
}

/** Send a localized message to a guest. Returns false if delivery failed (e.g. blocked). */
async function notifyGuest(
  ctx: MyContext,
  guestId: number,
  pick: (m: ReturnType<typeof t>) => string
): Promise<boolean> {
  const guest = await getGuestById(guestId);
  if (!guest) return false;
  const m = t((guest.language as Language) || config.defaultLanguage);
  try {
    await ctx.api.sendMessage(guest.telegram_user_id, pick(m));
    return true;
  } catch (err) {
    console.warn("[callbacks] notifyGuest failed:", (err as Error).message);
    return false;
  }
}
