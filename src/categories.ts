import type { Language } from "./config";

/**
 * Central definition of guest request categories. Keeping labels here means
 * the guest menu, the admin request card, and message history all show the
 * same human-readable text without duplication.
 */
export type CategoryKey =
  | "drova"
  | "linen"
  | "cleaning"
  | "broken"
  | "wifi"
  | "banya"
  | "taxi"
  | "checkinout"
  | "map"
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
  broken: { emoji: "🔧", ru: "Что-то не работает", en: "Something is broken" },
  wifi: { emoji: "📶", ru: "Wi-Fi", en: "Wi-Fi", infoOnly: true },
  banya: { emoji: "🔥", ru: "Баня / мангал / купель", en: "Sauna / grill / tub" },
  taxi: { emoji: "🚕", ru: "Такси / трансфер", en: "Taxi / transfer" },
  checkinout: { emoji: "🕒", ru: "Заезд / выезд", en: "Check-in / out", infoOnly: true },
  map: { emoji: "📍", ru: "Карта территории", en: "Site map", infoOnly: true },
  other: { emoji: "❓", ru: "Другой вопрос", en: "Other question" },
  call: { emoji: "📞", ru: "Позвонить администратору", en: "Call the administrator" },
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
    "drova:default": "Гость попросил принести дрова.",
    "linen:towels": "Нужны полотенца.",
    "linen:bed": "Нужно постельное бельё.",
    "linen:paper": "Нужна туалетная бумага.",
    "cleaning:clean": "Нужна уборка.",
    "cleaning:trash": "Просьба забрать мусор.",
    "cleaning:urgent": "Нужна срочная уборка.",
    "broken:light": "Не работает свет.",
    "broken:water": "Проблема с водой.",
    "broken:heating": "Не работает отопление.",
    "broken:door": "Проблема с дверью или замком.",
    "broken:wifi": "Не работает Wi-Fi.",
    "banya:banya": "Вопрос по бане.",
    "banya:grill": "Вопрос по мангалу.",
    "banya:tub": "Вопрос по купели.",
  };
  return map[`${category}:${detail}`] ?? categoryLabel(category, "ru");
}
