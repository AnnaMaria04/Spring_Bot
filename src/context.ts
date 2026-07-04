import type { Context, SessionFlavor } from "grammy";

/**
 * Short-lived guest conversation state. `pending` marks that the next plain
 * message from the guest should open a request in a specific category
 * (e.g. after tapping "Другой вопрос" or "Добавить комментарий").
 */
export interface SessionData {
  pending?: { kind: "new_request_text"; category: string } | null;
  /** True while we're waiting for the guest to type their house number. */
  awaitingHouseNumber?: boolean;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export function initialSession(): SessionData {
  return {};
}
