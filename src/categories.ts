import type { Language } from "./config";

/**
 * Guest request categories for an in-stay concierge (guests already at the
 * cottage). Labels live here so the menu, admin card, and history stay in sync.
 */
export type CategoryKey =
  // Services (open a request)
  | "drova"
  | "linen"
  | "cleaning"
  | "gear"
  | "bbq"
  | "broken"
  // Info (instant auto-answer)
  | "wifi"
  | "activities"
  | "checkout"
  | "rules"
  | "address"
  // Contact
  | "other"
  | "call";

interface CategoryDef {
  emoji: string;
  ru: string;
  en: string;
  /** When true, choosing it does not create a service request (info-only). */
  infoOnly?: boolean;
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  drova: { emoji: "🪵", ru: "Дрова", en: "Firewood" },
  linen: { emoji: "🧺", ru: "Полотенца / бельё", en: "Towels / linen" },
  cleaning: { emoji: "🧹", ru: "Уборка", en: "Cleaning" },
  gear: { emoji: "🛶", ru: "Лодка, SUP, велосипеды", en: "Boat, SUP, bikes" },
  bbq: { emoji: "🔥", ru: "Мангал / гриль", en: "Grill / BBQ" },
  broken: { emoji: "🔧", ru: "Что-то не работает", en: "Something's not working" },
  wifi: { emoji: "📶", ru: "Wi-Fi", en: "Wi-Fi", infoOnly: true },
  activities: { emoji: "🎣", ru: "Чем заняться", en: "Things to do", infoOnly: true },
  checkout: { emoji: "🕒", ru: "Выезд", en: "Check-out", infoOnly: true },
  rules: { emoji: "📖", ru: "Правила и важное", en: "Rules & info", infoOnly: true },
  address: { emoji: "📍", ru: "Адрес", en: "Address", infoOnly: true },
  other: { emoji: "❓", ru: "Другой вопрос", en: "Other question" },
  call: { emoji: "📞", ru: "Позвонить хозяину", en: "Call the host" },
};

/** Human-readable label for a category in the given language (no emoji). */
export function categoryLabel(key: string | null | undefined, lang: Language): string {
  if (!key) return lang === "ru" ? "Сообщение" : "Message";
  const def = CATEGORIES[key as CategoryKey];
  if (!def) return key;
  return lang === "ru" ? def.ru : def.en;
}

/** Label with emoji, used on menu buttons. */
export function categoryButtonLabel(key: CategoryKey, lang: Language): string {
  const def = CATEGORIES[key];
  return `${def.emoji} ${lang === "ru" ? def.ru : def.en}`;
}

/**
 * Russian one-line summary for a chosen sub-option, shown on the admin card.
 * Admin side is always Russian per the spec.
 */
export function detailSummary(category: string, detail: string): string {
  const map: Record<string, string> = {
    "drova:default": "Гость просит дрова (камин / мангал).",
    "linen:towels": "Нужны полотенца.",
    "linen:bed": "Нужно постельное бельё.",
    "linen:paper": "Нужна туалетная бумага.",
    "cleaning:clean": "Нужна уборка.",
    "cleaning:trash": "Просьба забрать мусор.",
    "gear:boat": "Гость просит подготовить лодку.",
    "gear:sup": "Гость просит SUP-доски.",
    "gear:bike": "Гость просит велосипеды.",
    "bbq:coals": "Гость просит подготовить мангал / дрова.",
    "bbq:tools": "Гость просит шампуры / решётку.",
    "broken:light": "Не работает свет.",
    "broken:water": "Проблема с водой.",
    "broken:heat": "Не работает отопление / камин.",
    "broken:door": "Проблема с дверью или замком.",
    "broken:wifi": "Не работает Wi-Fi.",
  };
  return map[`${category}:${detail}`] ?? categoryLabel(category, "ru");
}
