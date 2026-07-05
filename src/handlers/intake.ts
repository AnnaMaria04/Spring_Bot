import type { MyContext } from "../context";
import { config, type Language } from "../config";
import { t } from "../messages";
import { formatGuestName } from "../messages/admin";
import { upsertGuest } from "../services/guests";
import { getActiveStay } from "../services/stays";
import { getHouseById } from "../services/houses";
import {
  createRequest,
  getLatestOpenRequest,
  touchRequest,
  updateStatus,
} from "../services/requests";
import {
  copyGuestMedia,
  postFollowup,
  postRequestCard,
  refreshCard,
} from "../services/notifications";
import { resolveEmergencyPhone } from "../services/settings";
import { promptForHouse } from "./start";
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
    await promptForHouse(ctx, lang);
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
    : await getLatestOpenRequest(
        guest.id,
        config.followupWindowMinutes,
        config.doneFollowupWindowMinutes
      );

  let delivered: boolean;

  if (req) {
    await touchRequest(req.id);
    // The guest answered while we were waiting on them — ball's back in the
    // admins' court. A "done" request stays done; this only ever un-waits.
    if (req.status === "waiting_guest") {
      await updateStatus(req.id, "in_progress");
      await refreshCard(ctx.api, req.id);
    }
    delivered =
      isMedia && opts.sourceMessageId
        ? await copyGuestMedia(ctx.api, req, house, chat.id, opts.sourceMessageId, opts.mediaType!)
        : await postFollowup(ctx.api, req, house, opts.summary);
  } else {
    req = await createRequest({
      stayId: stay.id,
      houseId: house.id,
      guestId: guest.id,
      category: opts.category,
      summary: opts.summary,
      priority: opts.priority ?? "normal",
    });
    const cardMessageId = await postRequestCard(
      ctx.api,
      req,
      house,
      formatGuestName(guest.first_name, guest.username)
    );
    delivered = cardMessageId != null;
    if (delivered && isMedia && opts.sourceMessageId) {
      delivered = await copyGuestMedia(ctx.api, req, house, chat.id, opts.sourceMessageId, opts.mediaType!);
    }
  }

  // Don't tell the guest we've got it if the admin group never actually saw it.
  await ctx.reply(
    delivered ? confirmation(m, opts.mediaType) : m.genericError(await resolveEmergencyPhone())
  );
}

export interface CategorizedResult {
  /** False means nothing more to show — promptForHouse/genericError already ran. */
  ok: boolean;
  /** False means the request was created but the admin group never got it. */
  delivered: boolean;
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
  if (!from) {
    return {
      ok: false,
      delivered: false,
      lang: config.defaultLanguage,
      m: t(config.defaultLanguage),
    };
  }

  const guest = await upsertGuest(from);
  const lang = (guest.language as Language) || config.defaultLanguage;
  const m = t(lang);

  const stay = await getActiveStay(guest.id);
  if (!stay) {
    await promptForHouse(ctx, lang);
    return { ok: false, delivered: false, lang, m };
  }
  const house = await getHouseById(stay.house_id);
  if (!house) {
    await ctx.reply(m.genericError(await resolveEmergencyPhone()));
    return { ok: false, delivered: false, lang, m };
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
  const cardMessageId = await postRequestCard(
    ctx.api,
    req,
    house,
    formatGuestName(guest.first_name, guest.username)
  );
  return { ok: true, delivered: cardMessageId != null, lang, m, req, house };
}
