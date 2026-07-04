import type { Context, SessionFlavor } from "grammy";

/**
 * Short-lived guest conversation state. `pending` marks that the next plain
 * message from the guest should open a request in a specific category
 * (e.g. after tapping "Другой вопрос" or "Добавить комментарий").
 */
export interface SessionData {
  pending?: { kind: "new_request_text"; category: string } | null;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export function initialSession(): SessionData {
  return {};
}
