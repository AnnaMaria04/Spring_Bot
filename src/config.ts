import * as dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in.`
    );
  }
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export type Language = "ru" | "en";

export const config = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),

  // The admin group id is needed to post request cards. We read it lazily as a
  // number so the bot can still boot (and report a clear error) if it is unset.
  adminGroupId: optional("ADMIN_GROUP_ID"),

  webhookSecret: optional("WEBHOOK_SECRET"),
  webhookUrl: optional("WEBHOOK_URL"),

  ownerTelegramId: optional("OWNER_TELEGRAM_ID"),

  defaultLanguage: (optional("DEFAULT_LANGUAGE", "ru") as Language) || "ru",
  emergencyPhone: optional("EMERGENCY_PHONE", "+7 XXX XXX XX XX"),
  publicBotUsername: optional("PUBLIC_BOT_USERNAME", "SpringVillageSupportBot"),

  port: optionalNumber("PORT", 8080),
  followupWindowMinutes: optionalNumber("FOLLOWUP_WINDOW_MINUTES", 10),

  // Vercel sets this automatically; used to tune the DB pool size.
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_REGION),
} as const;

/** Numeric admin group id, or null when not configured. */
export function adminGroupIdNum(): number | null {
  const n = Number(config.adminGroupId);
  return config.adminGroupId && Number.isFinite(n) ? n : null;
}

/** Numeric owner id, or null when not configured. */
export function ownerIdNum(): number | null {
  const n = Number(config.ownerTelegramId);
  return config.ownerTelegramId && Number.isFinite(n) ? n : null;
}
