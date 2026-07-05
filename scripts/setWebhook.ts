import { Bot } from "grammy";
import { config } from "../src/config";
import { registerBotCommands } from "../src/telegramCommands";

/**
 * Register (or delete) the Telegram webhook and set the bot's command list,
 * description, and short description.
 *
 *   npm run set-webhook      # set webhook to WEBHOOK_URL
 *   npm run delete-webhook   # delete webhook (switch back to long polling)
 *
 * Must run somewhere with outbound access to api.telegram.org.
 */
async function main(): Promise<void> {
  const mode = process.argv[2];
  const bot = new Bot(config.botToken);

  if (mode === "delete") {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log("✅ Webhook deleted. You can now run long polling: npm start");
    return;
  }

  if (!config.webhookUrl) {
    throw new Error("WEBHOOK_URL is not set in .env (e.g. https://app.vercel.app/api/webhook)");
  }

  await bot.api.setWebhook(config.webhookUrl, {
    secret_token: config.webhookSecret || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });

  await registerBotCommands(bot.api);
  await bot.api.setMyDescription("Чат поддержки гостей Spring Village.");
  await bot.api.setMyShortDescription("Помощь гостям Spring Village во время проживания.");

  const info = await bot.api.getWebhookInfo();
  console.log("✅ Webhook set to:", info.url);
  console.log("   Pending updates:", info.pending_update_count);
}

main().catch((err) => {
  console.error("setWebhook failed:", err);
  process.exit(1);
});
