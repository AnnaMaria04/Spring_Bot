import { InlineKeyboard } from "grammy";

/**
 * Inline buttons attached to a request card. Active requests get the full
 * action set; completed/cancelled requests get a "reopen" affordance.
 * Labels are Russian per the spec.
 */
export function buildAdminKeyboard(
  requestId: number,
  status: string
): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (status === "done" || status === "cancelled") {
    kb.text("↩️ Открыть снова", `reopen:${requestId}`).text(
      "📄 Инфо",
      `info:${requestId}`
    );
    return kb;
  }

  kb.text("✅ Взять", `take:${requestId}`)
    .text("💬 Ответить", `reply:${requestId}`)
    .row()
    .text("✔️ Готово", `done:${requestId}`)
    .text("📄 Инфо", `info:${requestId}`);

  return kb;
}
