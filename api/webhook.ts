import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Bot } from "grammy";
import type { MyContext } from "../src/context";

/**
 * Vercel serverless webhook. Config/bot are imported lazily so a GET health
 * check still works when env vars are missing (instead of a hard 500). The
 * bot instance is cached across warm invocations.
 */
let botPromise: Promise<Bot<MyContext>> | null = null;

async function getBot(): Promise<Bot<MyContext>> {
  if (!botPromise) {
    botPromise = (async () => {
      const { createBot } = await import("../src/bot");
      const bot = createBot();
      await bot.init();
      return bot;
    })();
  }
  return botPromise;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res
      .status(200)
      .send("Spring Village bot webhook is running. Open /api/setup to configure and check status.");
    return;
  }

  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    res.status(401).send("unauthorized");
    return;
  }

  try {
    const bot = await getBot();
    await bot.handleUpdate(req.body);
    res.status(200).send("ok");
  } catch (err) {
    // Acknowledge so Telegram does not hammer retries; the error is logged.
    console.error("[webhook] error handling update:", err);
    res.status(200).send("ok");
  }
}
