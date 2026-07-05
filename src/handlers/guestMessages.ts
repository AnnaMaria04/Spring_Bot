import type { Message } from "grammy/types";
import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { upsertGuest } from "../services/guests";
import { isStaffUser } from "../services/admins";
import { adminText } from "../messages/admin";
import { resolveEmergencyPhone } from "../services/settings";
import { buildMainMenu } from "../keyboards/guestMenu";
import { intake } from "./intake";
import { selectHouseByNumber } from "./start";

function detectMediaType(msg: Message): string | null {
  if (msg.photo) return "photo";
  if (msg.voice) return "voice";
  if (msg.video || msg.video_note) return "video";
  if (msg.audio) return "audio";
  if (msg.document) return "document";
  if (msg.animation) return "document";
  if (msg.sticker) return "document";
  return null;
}

function mediaPlaceholder(mediaType: string): string {
  switch (mediaType) {
    case "photo":
      return "[Фото]";
    case "voice":
      return "[Голосовое сообщение]";
    case "video":
      return "[Видео]";
    case "audio":
      return "[Аудио]";
    default:
      return "[Файл]";
  }
}

/** Handle any non-command message a guest sends in their private chat. */
export async function handleGuestMessage(ctx: MyContext): Promise<void> {
  const msg = ctx.message;
  if (!msg) return;

  // TEMP (testing): staff panel redirect disabled so owner/staff accounts can
  // go through the guest flow themselves. Re-enable by uncommenting below.
  // if (ctx.from && (await isStaffUser(ctx.api, ctx.from.id))) {
  //   await ctx.reply(adminText.staffPanel);
  //   return;
  // }

  const lang = await guestLang(ctx);

  // While waiting for a house number, a typed number selects the house.
  if (ctx.session.awaitingHouseNumber) {
    if (msg.text) {
      await selectHouseByNumber(ctx, lang, msg.text);
    } else {
      await ctx.reply(t(lang).askHouseNumber);
    }
    return;
  }

  const pending = ctx.session.pending;
  const category = pending?.category ?? null;
  const forceNew = !!pending;

  try {
    if (msg.text) {
      ctx.session.pending = null;
      await intake(ctx, { category, forceNew, summary: msg.text, mediaType: "text" });
      return;
    }

    const mediaType = detectMediaType(msg);
    if (mediaType) {
      ctx.session.pending = null;
      const summary = msg.caption?.trim() || mediaPlaceholder(mediaType);
      await intake(ctx, {
        category,
        forceNew,
        summary,
        mediaType,
        sourceMessageId: msg.message_id,
      });
      return;
    }

    // Content we can't meaningfully forward (location, contact, poll, ...).
    // Still abandons any pending ForceReply prompt, same as the text/media
    // branches above — otherwise it lingers and misfiles the next real message.
    if (ctx.session.pending?.promptMessageId && ctx.chat) {
      await ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.pending.promptMessageId)
        .catch(() => undefined);
    }
    ctx.session.pending = null;
    await ctx.reply(t(lang).unclear, { reply_markup: buildMainMenu(lang) });
  } catch (err) {
    console.error("[guestMessages] error:", err);
    const phone = await resolveEmergencyPhone().catch(() => config.emergencyPhone);
    await ctx
      .reply(t(config.defaultLanguage).dbError(phone))
      .catch(() => undefined);
  }
}

async function guestLang(ctx: MyContext): Promise<Language> {
  if (!ctx.from) return config.defaultLanguage;
  const guest = await upsertGuest(ctx.from);
  return (guest.language as Language) || config.defaultLanguage;
}
