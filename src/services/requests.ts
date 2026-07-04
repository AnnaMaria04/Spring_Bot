import { query, queryOne } from "../db/client";
import {
  OPEN_STATUSES,
  type MessageDirection,
  type RequestStatus,
  type ServiceRequest,
} from "../types";

export interface CreateRequestInput {
  stayId: number | null;
  houseId: number;
  guestId: number;
  category: string | null;
  summary: string | null;
  status?: RequestStatus;
  priority?: string;
}

export async function createRequest(
  input: CreateRequestInput
): Promise<ServiceRequest> {
  const row = await queryOne<ServiceRequest>(
    `INSERT INTO requests (stay_id, house_id, guest_id, category, summary, status, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.stayId,
      input.houseId,
      input.guestId,
      input.category,
      input.summary,
      input.status ?? "new",
      input.priority ?? "normal",
    ]
  );
  return row as ServiceRequest;
}

export function getRequestById(id: number): Promise<ServiceRequest | null> {
  return queryOne<ServiceRequest>("SELECT * FROM requests WHERE id = $1", [id]);
}

/** The guest's most recent still-open request updated within `withinMinutes`. */
export function getLatestOpenRequest(
  guestId: number,
  withinMinutes: number
): Promise<ServiceRequest | null> {
  return queryOne<ServiceRequest>(
    `SELECT * FROM requests
       WHERE guest_id = $1
         AND status = ANY($2)
         AND updated_at > now() - make_interval(mins => $3)
       ORDER BY updated_at DESC
       LIMIT 1`,
    [guestId, OPEN_STATUSES, withinMinutes]
  );
}

export async function setAdminMessage(
  requestId: number,
  chatId: number,
  messageId: number
): Promise<void> {
  await query(
    "UPDATE requests SET admin_chat_id = $2, admin_message_id = $3, updated_at = now() WHERE id = $1",
    [requestId, chatId, messageId]
  );
}

export function updateStatus(
  requestId: number,
  status: RequestStatus
): Promise<ServiceRequest | null> {
  return queryOne<ServiceRequest>(
    "UPDATE requests SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
    [requestId, status]
  );
}

/** Assign an admin and move a brand-new request into progress. */
export function assignAdmin(
  requestId: number,
  adminTelegramId: number,
  adminName: string
): Promise<ServiceRequest | null> {
  return queryOne<ServiceRequest>(
    `UPDATE requests
       SET assigned_admin_id = $2,
           assigned_admin_name = $3,
           status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END,
           updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [requestId, adminTelegramId, adminName]
  );
}

export function markUrgent(requestId: number): Promise<ServiceRequest | null> {
  return queryOne<ServiceRequest>(
    "UPDATE requests SET priority = 'urgent', status = 'urgent', updated_at = now() WHERE id = $1 RETURNING *",
    [requestId]
  );
}

export async function touchRequest(requestId: number): Promise<void> {
  await query("UPDATE requests SET updated_at = now() WHERE id = $1", [
    requestId,
  ]);
}

/**
 * Find the request an admin is replying to, given the message they replied to
 * in the admin group. Matches the request card first, then any follow-up /
 * media message recorded for a request.
 */
export async function findRequestByAdminMessage(
  chatId: number,
  messageId: number
): Promise<ServiceRequest | null> {
  const direct = await queryOne<ServiceRequest>(
    "SELECT * FROM requests WHERE admin_chat_id = $1 AND admin_message_id = $2",
    [chatId, messageId]
  );
  if (direct) return direct;

  const link = await queryOne<{ request_id: number }>(
    `SELECT request_id FROM messages
       WHERE direction = 'guest_to_admin' AND telegram_message_id = $1
       ORDER BY id DESC LIMIT 1`,
    [messageId]
  );
  if (link?.request_id != null) return getRequestById(link.request_id);
  return null;
}

export interface AddMessageInput {
  requestId: number | null;
  direction: MessageDirection;
  text?: string | null;
  mediaType?: string | null;
  telegramMessageId?: number | null;
  senderTelegramId?: number | null;
}

export async function addMessage(input: AddMessageInput): Promise<void> {
  await query(
    `INSERT INTO messages
       (request_id, direction, text, media_type, telegram_message_id, sender_telegram_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.requestId,
      input.direction,
      input.text ?? null,
      input.mediaType ?? null,
      input.telegramMessageId ?? null,
      input.senderTelegramId ?? null,
    ]
  );
}

export async function getRequestStats(
  guestId: number
): Promise<{ total: number; open: number }> {
  const row = await queryOne<{ total: number; open: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = ANY($2))::int AS open
       FROM requests WHERE guest_id = $1`,
    [guestId, OPEN_STATUSES]
  );
  return { total: row?.total ?? 0, open: row?.open ?? 0 };
}
