import type { Language } from "../config";
import type { GuestMessages } from "./types";
import { ru } from "./ru";
import { en } from "./en";

const CATALOGS: Record<Language, GuestMessages> = { ru, en };

/** Return the guest message catalog for a language, falling back to Russian. */
export function t(lang: string | null | undefined): GuestMessages {
  if (lang === "en") return CATALOGS.en;
  return CATALOGS.ru;
}

export type { GuestMessages };
export * from "./admin";
