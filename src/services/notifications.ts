import type { Api } from "grammy";
import type { House, ServiceRequest } from "../types";
import * as requests from "./requests";
import { getHouseById } from "./houses";
import { getGuestById } from "./guests";
import { resolveAdminGroupId } from "./settings";
import { buildAdminKeyboard } from "../keyboards/adminButtons";
import { categoryLabel } from "../categories";
import {
  renderCard,
  renderFollowup,
  renderInfo,
  renderUrgentAlert,
  formatGuestName,
  formatTime,
  formatDuration,
  type AdminCardData,
} from "../messages/admin";

/**
 * Reply parameters that degrade gracefully instead of throwing: if the card
 * (or whatever message we're replying to) was since deleted — by a human,
 * or anything else — Telegram would otherwise reject the whole send with
 * "message to be replied not found", silently dropping guest/admin content.
 * `allow_sending_without_reply` sends it anyway, just without the reply link.
 */
export function replyToStored(messageId: number | null | undefined) {
  return messageId
    ? { message_id: messageId, allow_sending_without_reply: true }
    : undefined;
}

function cardData(req: ServiceRequest, guestName: string, houseName: string): AdminCardData {
  const createdMs = new Date(req.created_at).getTime();
  return {
    requestId: req.id,
    houseName,
    guestName,
    category: categoryLabel(req.category, "ru"),
    time: formatTime(new Date(req.created_at)),
    message: req.summary ?? "",
    status: req.status,
    assignedName: req.assigned_admin_name,
    takenAt: req.taken_at ? formatTime(new Date(req.taken_at)) : null,
    responseDuration: req.first_reply_at
      ? formatDuration(new Date(req.first_reply_at).getTime() - createdMs)
      : null,
    doneBy: req.done_by_name,
    doneAt: req.done_at ? formatTime(new Date(req.done_at)) : null,
    resolutionDuration: req.done_at
      ? formatDuration(new Date(req.done_at).getTime() - createdMs)
      : null,
    priority: req.priority,
  };
}

/**
 * Post the initial request card into the admin group (house topic if set).
 * Returns null if it wasn't configured or delivery failed — callers must
 * check this rather than assume the admin group actually saw the request.
 */
export async function postRequestCard(
  api: Api,
  req: ServiceRequest,
  house: House,
  guestName: string
): Promise<number | null> {
  const groupId = await resolveAdminGroupId();
  if (!groupId) {
    console.error("[notifications] admin group id is not configured");
    return null;
  }
  try {
    const sent = await api.sendMessage(groupId, renderCard(cardData(req, guestName, house.name)), {
      reply_markup: buildAdminKeyboard(req.id, req.status),
      message_thread_id: house.topic_id ?? undefined,
    });
    await requests.setAdminMessage(req.id, groupId, sent.message_id);
    return sent.message_id;
  } catch (err) {
    console.error("[notifications] postRequestCard failed:", (err as Error).message);
    return null;
  }
}

/** Re-render a request card after a status / assignment change. */
export async function refreshCard(api: Api, requestId: number): Promise<void> {
  const req = await requests.getRequestById(requestId);
  if (!req || req.admin_chat_id == null || req.admin_message_id == null) return;
  const house = await getHouseById(req.house_id);
  const guest = await getGuestById(req.guest_id);
  const guestName = formatGuestName(guest?.first_name, guest?.username);
  const data = cardData(req, guestName, house?.name ?? `Дом ${req.house_id}`);
  try {
    await api.editMessageText(req.admin_chat_id, req.admin_message_id, renderCard(data), {
      reply_markup: buildAdminKeyboard(req.id, req.status),
    });
  } catch (err) {
    // "message is not modified" and similar are non-fatal.
    console.warn("[notifications] refreshCard:", (err as Error).message);
  }
}

/**
 * Post a guest's follow-up text as a reply to the request card. Returns false
 * if the admin group isn't configured or delivery failed, so the caller can
 * tell the guest honestly instead of confirming a message that never arrived.
 */
export async function postFollowup(
  api: Api,
  req: ServiceRequest,
  house: House,
  text: string
): Promise<boolean> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return false;
  try {
    const sent = await api.sendMessage(
      groupId,
      renderFollowup({ houseName: house.name, requestId: req.id, text }),
      {
        reply_parameters: replyToStored(req.admin_message_id),
        message_thread_id: house.topic_id ?? undefined,
      }
    );
    await requests.addMessage({
      requestId: req.id,
      direction: "guest_to_admin",
      text,
      mediaType: "text",
      telegramMessageId: sent.message_id,
    });
    return true;
  } catch (err) {
    console.error("[notifications] postFollowup failed:", (err as Error).message);
    return false;
  }
}

/**
 * Copy a guest's media message into the admin group as a reply to the card.
 * Returns false if the admin group isn't configured or delivery failed.
 */
export async function copyGuestMedia(
  api: Api,
  req: ServiceRequest,
  house: House,
  fromChatId: number,
  messageId: number,
  mediaType: string
): Promise<boolean> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return false;
  try {
    const copied = await api.copyMessage(groupId, fromChatId, messageId, {
      reply_parameters: replyToStored(req.admin_message_id),
      message_thread_id: house.topic_id ?? undefined,
    });
    await requests.addMessage({
      requestId: req.id,
      direction: "guest_to_admin",
      mediaType,
      telegramMessageId: copied.message_id,
      senderTelegramId: fromChatId,
    });
    return true;
  } catch (err) {
    console.error("[notifications] copyGuestMedia failed:", (err as Error).message);
    return false;
  }
}

/** Send an admin's text reply to the guest. Returns false if delivery failed. */
export async function deliverReplyToGuest(
  api: Api,
  req: ServiceRequest,
  text: string
): Promise<boolean> {
  const guest = await getGuestById(req.guest_id);
  if (!guest) return false;
  try {
    const sent = await api.sendMessage(guest.telegram_user_id, text);
    await requests.addMessage({
      requestId: req.id,
      direction: "admin_to_guest",
      text,
      mediaType: "text",
      telegramMessageId: sent.message_id,
    });
    return true;
  } catch (err) {
    console.error("[notifications] deliverReplyToGuest failed:", (err as Error).message);
    return false;
  }
}

/** Copy an admin's media reply (e.g. a map photo) to the guest. */
export async function copyReplyMediaToGuest(
  api: Api,
  req: ServiceRequest,
  fromChatId: number,
  messageId: number,
  mediaType: string
): Promise<boolean> {
  const guest = await getGuestById(req.guest_id);
  if (!guest) return false;
  try {
    const copied = await api.copyMessage(guest.telegram_user_id, fromChatId, messageId);
    await requests.addMessage({
      requestId: req.id,
      direction: "admin_to_guest",
      mediaType,
      telegramMessageId: copied.message_id,
    });
    return true;
  } catch (err) {
    console.error("[notifications] copyReplyMediaToGuest failed:", (err as Error).message);
    return false;
  }
}

/**
 * Repost an escalated request to the group so it is visible and replyable.
 * Returns false if the admin group isn't configured or delivery failed —
 * the guest is always shown the emergency phone number regardless, but the
 * caller can log/handle a failed staff alert as the more serious event it is.
 */
export async function postUrgentAlert(
  api: Api,
  req: ServiceRequest,
  house: House,
  guestName: string
): Promise<boolean> {
  const groupId = await resolveAdminGroupId();
  if (!groupId) return false;
  try {
    const sent = await api.sendMessage(
      groupId,
      renderUrgentAlert({
        houseName: house.name,
        guestName,
        requestId: req.id,
        message: req.summary ?? "",
      }),
      { message_thread_id: house.topic_id ?? undefined }
    );
    // Record so replies to the urgent alert also route to the guest.
    await requests.addMessage({
      requestId: req.id,
      direction: "guest_to_admin",
      text: req.summary,
      mediaType: "text",
      telegramMessageId: sent.message_id,
    });
    return true;
  } catch (err) {
    console.error("[notifications] postUrgentAlert failed:", (err as Error).message);
    return false;
  }
}

/** Build and send the "📄 Инфо" card for a request. Returns false on failure. */
export async function sendInfoCard(api: Api, req: ServiceRequest): Promise<boolean> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return false;
  try {
    const house = await getHouseById(req.house_id);
    const guest = await getGuestById(req.guest_id);
    const guestName = formatGuestName(guest?.first_name, guest?.username);
    const stats = await requests.getRequestStats(req.guest_id);
    const text = renderInfo({
      houseName: house?.name ?? `Дом ${req.house_id}`,
      guestName,
      stayStatus: req.stay_id ? "active" : "completed",
      checkIn: formatTime(new Date(req.created_at)),
      totalRequests: stats.total,
      openRequests: stats.open,
    });
    await api.sendMessage(groupId, text, {
      reply_parameters: replyToStored(req.admin_message_id),
      message_thread_id: house?.topic_id ?? undefined,
    });
    return true;
  } catch (err) {
    console.error("[notifications] sendInfoCard failed:", (err as Error).message);
    return false;
  }
}
