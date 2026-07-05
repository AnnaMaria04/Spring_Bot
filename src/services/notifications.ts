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

/** Post the initial request card into the admin group (house topic if set). */
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
  const sent = await api.sendMessage(groupId, renderCard(cardData(req, guestName, house.name)), {
    reply_markup: buildAdminKeyboard(req.id, req.status),
    message_thread_id: house.topic_id ?? undefined,
  });
  await requests.setAdminMessage(req.id, groupId, sent.message_id);
  return sent.message_id;
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

/** Post a guest's follow-up text as a reply to the request card. */
export async function postFollowup(
  api: Api,
  req: ServiceRequest,
  house: House,
  text: string
): Promise<void> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return;
  const sent = await api.sendMessage(
    groupId,
    renderFollowup({ houseName: house.name, requestId: req.id, text }),
    {
      reply_to_message_id: req.admin_message_id ?? undefined,
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
}

/** Copy a guest's media message into the admin group as a reply to the card. */
export async function copyGuestMedia(
  api: Api,
  req: ServiceRequest,
  house: House,
  fromChatId: number,
  messageId: number,
  mediaType: string
): Promise<void> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return;
  const copied = await api.copyMessage(groupId, fromChatId, messageId, {
    reply_to_message_id: req.admin_message_id ?? undefined,
    message_thread_id: house.topic_id ?? undefined,
  });
  await requests.addMessage({
    requestId: req.id,
    direction: "guest_to_admin",
    mediaType,
    telegramMessageId: copied.message_id,
    senderTelegramId: fromChatId,
  });
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

/** Repost an escalated request to the group so it is visible and replyable. */
export async function postUrgentAlert(
  api: Api,
  req: ServiceRequest,
  house: House,
  guestName: string
): Promise<void> {
  const groupId = await resolveAdminGroupId();
  if (!groupId) return;
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
}

/** Build and send the "📄 Инфо" card for a request. */
export async function sendInfoCard(api: Api, req: ServiceRequest): Promise<void> {
  const groupId = req.admin_chat_id ?? (await resolveAdminGroupId());
  if (!groupId) return;
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
    reply_to_message_id: req.admin_message_id ?? undefined,
    message_thread_id: house?.topic_id ?? undefined,
  });
}
