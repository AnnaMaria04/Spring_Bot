import { Bot, session } from "grammy";
import { config } from "./config";
import { initialSession, type MyContext, type SessionData } from "./context";
import { PostgresAdapter } from "./services/sessionStore";
import { handleStart } from "./handlers/start";
import { handleCallback } from "./handlers/callbacks";
import { handleGuestMessage } from "./handlers/guestMessages";
import { handleAdminMessage } from "./handlers/adminReplies";
import * as cmd from "./handlers/commands";

/** Build and wire the bot. Used by every entry point (polling / webhook). */
export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(config.botToken);

  // Conversation state is only needed for guest (private) chats. Admin actions
  // in the group are stateless, so we skip session storage there.
  const sessionMiddleware = session<SessionData, MyContext>({
    initial: initialSession,
    storage: new PostgresAdapter<SessionData>(),
  });
  bot.use((ctx, next) => {
    if (ctx.chat?.type === "private") return sessionMiddleware(ctx, next);
    return next();
  });

  // Commands (guest + setup/admin).
  bot.command("start", handleStart);
  bot.command("menu", cmd.handleMenu);
  bot.command("help", cmd.handleHelp);
  bot.command("call", cmd.handleCall);
  bot.command("language", cmd.handleLanguage);
  bot.command("whereami", cmd.handleWhereami);
  bot.command(["myid", "id"], cmd.handleMyId);
  bot.command("setgroup", cmd.handleSetGroup);
  bot.command("addadmin", cmd.handleAddAdmin);
  bot.command("removeadmin", cmd.handleRemoveAdmin);
  bot.command("houses", cmd.handleHouses);
  bot.command("enablehouse", cmd.handleEnableHouse);
  bot.command("disablehouse", cmd.handleDisableHouse);
  bot.command("setwifi", cmd.handleSetWifi);
  bot.command("setcheckin", cmd.handleSetCheckin);
  bot.command("setaddress", cmd.handleSetAddress);

  // Inline button presses (guest navigation + admin actions).
  bot.on("callback_query:data", handleCallback);

  // Free-form messages: private chats are guests, groups are the admin team.
  bot.chatType("private").on("message", handleGuestMessage);
  bot.chatType(["group", "supergroup"]).on("message", handleAdminMessage);

  bot.catch((err) => {
    console.error(
      "[bot] error while handling update",
      err.ctx?.update.update_id,
      err.error
    );
  });

  return bot;
}
