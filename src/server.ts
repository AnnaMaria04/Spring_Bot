import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { createBot } from "./bot";
import { config } from "./config";

/**
 * Standalone webhook server for a VPS. Exposes POST /webhook (verified with
 * WEBHOOK_SECRET) and a GET /health check. Put Nginx/Caddy in front for TLS,
 * then register the public URL with `npm run set-webhook`.
 */
async function main(): Promise<void> {
  const bot = createBot();
  await bot.init(); // fetch bot info before handling updates

  const handleUpdate = webhookCallback(bot, "http", {
    secretToken: config.webhookSecret || undefined,
  });

  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook") {
      try {
        await handleUpdate(req, res);
      } catch (err) {
        console.error("[server] webhook error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      }
      return;
    }
    if (req.url === "/health" || req.url === "/") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  server.listen(config.port, () => {
    console.log(`Spring Village webhook server listening on :${config.port} (POST /webhook).`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting webhook server:", err);
  process.exit(1);
});
