import { createBot } from "./bot";

/**
 * Long-polling entry point. Best for local development and for a VPS that
 * runs a single persistent process. For serverless use the webhook
 * (api/webhook.ts) instead.
 */
async function main(): Promise<void> {
  const bot = createBot();

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());

  await bot.start({
    drop_pending_updates: false,
    allowed_updates: ["message", "callback_query"],
    onStart: (info) =>
      console.log(`Spring Village bot @${info.username} started (long polling).`),
  });
}

main().catch((err) => {
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});
