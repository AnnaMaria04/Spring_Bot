import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Bot } from "grammy";
import { registerBotCommands } from "../src/telegramCommands";

/**
 * One-time setup / status endpoint.
 *
 *   GET /api/setup            -> report which env vars are set + current webhook info
 *   GET /api/setup?register=1 -> also register the Telegram webhook to this host
 *
 * It is self-contained (does not import the app config), so it works even when
 * some environment variables are still missing, and reports exactly what's left.
 */
function present(v?: string): boolean {
  return !!(v && v.trim());
}

function send(res: VercelResponse, status: number, obj: unknown): void {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(obj, null, 2));
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const env = {
    BOT_TOKEN: present(process.env.BOT_TOKEN),
    DATABASE_URL: present(process.env.DATABASE_URL),
    WEBHOOK_SECRET: present(process.env.WEBHOOK_SECRET),
    ADMIN_GROUP_ID: present(process.env.ADMIN_GROUP_ID),
    OWNER_TELEGRAM_ID: present(process.env.OWNER_TELEGRAM_ID),
    EMERGENCY_PHONE: present(process.env.EMERGENCY_PHONE),
    PUBLIC_BOT_USERNAME: present(process.env.PUBLIC_BOT_USERNAME),
  };

  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const webhookUrl = `${proto}://${host}/api/webhook`;
  const register = req.query.register === "1";

  const result: Record<string, unknown> = { env, webhookUrl };

  if (!env.BOT_TOKEN) {
    result.ok = false;
    result.message =
      "BOT_TOKEN is not set in Vercel. Add BOT_TOKEN and DATABASE_URL in Project Settings -> Environment Variables, Redeploy, then reload this page.";
    return send(res, 200, result);
  }

  try {
    const bot = new Bot(process.env.BOT_TOKEN!.trim());
    const me = await bot.api.getMe();
    result.bot = { id: me.id, username: me.username, name: me.first_name };

    if (register) {
      await bot.api.setWebhook(webhookUrl, {
        secret_token: present(process.env.WEBHOOK_SECRET)
          ? process.env.WEBHOOK_SECRET!.trim()
          : undefined,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      });
      await registerBotCommands(bot.api);
      await bot.api.setMyDescription("Чат поддержки гостей Spring Village.");
      await bot.api.setMyShortDescription(
        "Помощь гостям Spring Village во время проживания."
      );
      result.registered = true;
    }

    const info = await bot.api.getWebhookInfo();
    result.webhookInfo = {
      url: info.url,
      pending_update_count: info.pending_update_count,
      last_error_message: info.last_error_message ?? null,
      last_error_date: info.last_error_date ?? null,
    };

    result.ok = true;
    result.message = !register
      ? "Status only. Add ?register=1 to register the webhook."
      : env.DATABASE_URL
        ? "Webhook registered. Message your bot /start to test."
        : "Webhook registered, but DATABASE_URL is missing — the bot will error on messages until you add it in Vercel and redeploy.";
    return send(res, 200, result);
  } catch (err) {
    result.ok = false;
    result.error = (err as Error).message;
    result.message =
      "Failed to talk to Telegram. Check that BOT_TOKEN is correct.";
    return send(res, 200, result);
  }
}
