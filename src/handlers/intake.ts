import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { formatGuestName } from "../messages/admin";
import { upsertGuest } from "../services/guests";
import { getActiveStay } from "../services/stays";
import { getHouseById, listActiveHouses } from "../services/houses";
import {
  createRequest,
  getLatestOpenRequest,
  touchRequest,
} from "../services/requests";
import {
  copyGuestMedia,
  postFollowup,
  postRequestCard,
} from "../services/notifications";
import { resolveEmergencyPhone } from "../services/settings";
import { buildHousePicker } from "../keyboards/guestMenu";
import type { GuestMessages } from "../messages";
import type { House, RequestStatus, ServiceRequest } from "../types";

export interface IntakeOptions {
  /** Category key, or null for plain free text. */
  category: string | null;
  /** Skip follow-up grouping (used for explicit categorized requests). */
  forceNew: boolean;
  /** Card / follow-up text. */
  summary: string;
  /** Media kind, or "text". */
  mediaType?: string | null;
  /** Source message id in the guest chat, for copying media to admins. */
  sourceMessageId?: number;
  priority?: string;
}

function confirmation(m: GuestMessages, mediaType?: string | null): string {
  switch (mediaType) {
    case "photo":
      return m.photoReceived;
    case "voice":
      return m.voiceReceived;
    case "document":
    case "video":
    case "audio":
      return m.fileReceived;
    default:
      return m.requestReceived;
  }
}

/**
 * Create a new request or append to the guest's most recent open one, post it
 * to the admin group, and acknowledge the guest. Shared by free-text and media.
 */
export async function intake(ctx: MyContext, opts: IntakeOptions): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const guest = await upsertGuest(from);
  const lang = (guest.language as Language) || config.defaultLanguage;
  const m = t(lang);

  const stay = await getActiveStay(guest.id);
  if (!stay) {
    const houses = await listActiveHouses();
    await ctx.reply(m.scanOrChooseHouse, { reply_markup: buildHousePicker(houses) });
    return;
  }

  const house = await getHouseById(stay.house_id);
  if (!house) {
    await ctx.reply(m.genericError(await resolveEmergencyPhone()));
    return;
  }

  const isMedia = !!opts.mediaType && opts.mediaType !== "text";

  let req = opts.forceNew
    ? null
    : await getLatestOpenRequest(guest.id, config.followupWindowMinutes);

  if (req) {
    await touchRequest(req.id);
    if (isMedia && opts.sourceMessageId) {
      await copyGuestMedia(ctx.api, req, house, chat.id, opts.sourceMessageId, opts.mediaType!);
    } else {
      await postFollowup(ctx.api, req, house, opts.summary);
    }
  } else {
    req = await createRequest({
      stayId: stay.id,
      houseId: house.id,
      guestId: guest.id,
      category: opts.category,
      summary: opts.summary,
      priority: opts.priority ?? "normal",
    });
    await postRequestCard(
      ctx.api,
      req,
      house,
      formatGuestName(guest.first_name, guest.username)
    );
    if (isMedia && opts.sourceMessageId) {
      await copyGuestMedia(ctx.api, req, house, chat.id, opts.sourceMessageId, opts.mediaType!);
    }
  }

  await ctx.reply(confirmation(m, opts.mediaType));
}

export interface CategorizedResult {
  ok: boolean;
  lang: Language;
  m: GuestMessages;
  req?: ServiceRequest;
  house?: House;
}

/**
 * Create a request from a button-driven (categorized) flow. Unlike `intake`
 * this never groups into an existing request and returns the created row so
 * the caller can escalate it or tailor the confirmation.
 */
export async function createCategorizedRequest(
  ctx: MyContext,
  opts: {
    category: string;
    summary: string;
    status?: RequestStatus;
    priority?: string;
  }
): Promise<CategorizedResult> {
  const from = ctx.from;
  if (!from) return { ok: false, lang: config.defaultLanguage, m: t(config.defaultLanguage) };

  const guest = await upsertGuest(from);
  const lang = (guest.language as Language) || config.defaultLanguage;
  const m = t(lang);

  const stay = await getActiveStay(guest.id);
  if (!stay) {
    const houses = await listActiveHouses();
    await ctx.reply(m.scanOrChooseHouse, { reply_markup: buildHousePicker(houses) });
    return { ok: false, lang, m };
  }
  const house = await getHouseById(stay.house_id);
  if (!house) {
    await ctx.reply(m.genericError(await resolveEmergencyPhone()));
    return { ok: false, lang, m };
  }

  const req = await createRequest({
    stayId: stay.id,
    houseId: house.id,
    guestId: guest.id,
    category: opts.category,
    summary: opts.summary,
    status: opts.status ?? "new",
    priority: opts.priority ?? "normal",
  });
  await postRequestCard(
    ctx.api,
    req,
    house,
    formatGuestName(guest.first_name, guest.username)
  );
  return { ok: true, lang, m, req, house };
}
