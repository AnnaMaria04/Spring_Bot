import type { Message } from "grammy/types";
import type { MyContext } from "../context";
import { adminText, formatGuestName } from "../messages/admin";
import { isAuthorizedActor } from "../services/admins";
import {
  findRequestByAdminMessage,
  assignAdmin,
  recordFirstReply,
  updateStatusIf,
} from "../services/requests";
import {
  deliverReplyToGuest,
  copyReplyMediaToGuest,
  refreshCard,
} from "../services/notifications";

function detectMediaType(msg: Message): string | null {
  if (msg.photo) return "photo";
  if (msg.voice) return "voice";
  if (msg.video || msg.video_note) return "video";
  if (msg.audio) return "audio";
  if (msg.document || msg.animation || msg.sticker) return "document";
  return null;
}

/**
 * Handle messages in the admin group. The daily workflow is: an admin replies
 * (Telegram "reply") to a request card or follow-up; the bot routes that reply
 * to the right guest. Everything else in the group is ignored.
 */
export async function handleAdminMessage(ctx: MyContext): Promise<void> {
  const msg = ctx.message;
  if (!msg || !ctx.from || !ctx.chat) return;

  const replyTo = msg.reply_to_message;
  // Only react to replies aimed at one of the bot's own messages.
  if (!replyTo || replyTo.from?.id !== ctx.me.id) return;

  // Anyone in the configured staff group (or an explicit admin) may reply;
  // others are silently ignored.
  if (!(await isAuthorizedActor(ctx.chat.id, ctx.from.id))) return;

  const req = await findRequestByAdminMessage(ctx.chat.id, replyTo.message_id);
  if (!req) {
    await ctx.reply(adminText.cannotIdentifyGuest, {
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  // First responder takes ownership; this also moves a "new" request to "in progress".
  if (!req.assigned_admin_id) {
    await assignAdmin(req.id, ctx.from.id, formatGuestName(ctx.from.first_name, ctx.from.username));
    await refreshCard(ctx.api, req.id);
  }

  let delivered = false;
  if (msg.text) {
    delivered = await deliverReplyToGuest(ctx.api, req, msg.text);
  } else {
    const mediaType = detectMediaType(msg);
    if (mediaType) {
      delivered = await copyReplyMediaToGuest(
        ctx.api,
        req,
        ctx.chat.id,
        msg.message_id,
        mediaType
      );
    }
  }

  if (delivered) {
    // Record response time on first reply. For a normal open request, mark it
    // "waiting_guest" so a slow reply still threads into this request instead
    // of the follow-up window forcing a new one (done/urgent/cancelled are
    // left alone — see getLatestOpenRequest). Guarded on current DB status,
    // not the possibly-stale `req` read above, so a concurrent "Готово"
    // (which took real time via the Telegram API call just above) can't be
    // silently undone by this write landing after it.
    await recordFirstReply(req.id);
    await updateStatusIf(req.id, "waiting_guest", ["new", "in_progress"]);
    await refreshCard(ctx.api, req.id);
    await ctx.react("👍").catch(() => undefined);
  } else {
    await ctx.reply(adminText.guestBlocked, { reply_to_message_id: msg.message_id });
  }
}
