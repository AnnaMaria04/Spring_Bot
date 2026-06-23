import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Bot } from "grammy";
import { createBot } from "../src/bot";
import { config } from "../src/config";
import type { MyContext } from "../src/context";

/**
 * Vercel serverless webhook. The bot instance is cached across warm
 * invocations. Telegram's secret token header is verified before processing.
 */
let bot: Bot<MyContext> | null = null;
let initialized = false;

async function getBot(): Promise<Bot<MyContext>> {
  if (!bot) bot = createBot();
  if (!initialized) {
    await bot.init();
    initialized = true;
  }
  return bot;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(200).send("Spring Village bot webhook is running.");
    return;
  }

  if (config.webhookSecret) {
    const token = req.headers["x-telegram-bot-api-secret-token"];
    if (token !== config.webhookSecret) {
      res.status(401).send("unauthorized");
      return;
    }
  }

  try {
    const b = await getBot();
    await b.handleUpdate(req.body);
    res.status(200).send("ok");
  } catch (err) {
    // Acknowledge so Telegram does not hammer retries; the error is logged.
    console.error("[webhook] error handling update:", err);
    res.status(200).send("ok");
  }
}
