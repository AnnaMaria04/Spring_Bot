import { InlineKeyboard } from "grammy";
import type { Language } from "../config";
import { CATEGORIES, categoryButtonLabel, type CategoryKey } from "../categories";
import { t } from "../messages";
import type { House } from "../types";

/** Main guest menu shown after welcome / on /menu. */
export function buildMainMenu(lang: Language): InlineKeyboard {
  const order: CategoryKey[] = [
    "drova",
    "linen",
    "cleaning",
    "broken",
    "wifi",
    "banya",
    "taxi",
    "checkinout",
    "map",
    "other",
    "call",
  ];
  const kb = new InlineKeyboard();
  order.forEach((key, i) => {
    kb.text(categoryButtonLabel(key, lang), `cat:${key}`);
    // Two buttons per row, except the final "call" which gets its own row.
    if (key === "call") return;
    if (i % 2 === 1) kb.row();
  });
  kb.row();
  return kb;
}

/** Confirm / change the detected house. */
export function buildHouseConfirmKeyboard(
  code: string,
  lang: Language
): InlineKeyboard {
  const m = t(lang);
  return new InlineKeyboard()
    .text(m.btnConfirmHouse, `house_confirm:${code}`)
    .row()
    .text(m.btnChangeHouse, "house_change");
}

/** Picker listing all active houses. */
export function buildHousePicker(houses: House[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  houses.forEach((h, i) => {
    kb.text(h.name, `house_pick:${h.code}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row();
  return kb;
}

function backRow(kb: InlineKeyboard, lang: Language): InlineKeyboard {
  return kb.row().text(t(lang).btnBack, "menu_back");
}

/** Sub-menu for a category. Returns null for free-text-only categories. */
export function buildCategoryKeyboard(
  category: CategoryKey,
  lang: Language
): InlineKeyboard | null {
  const m = t(lang);
  switch (category) {
    case "drova":
      return backRow(
        new InlineKeyboard()
          .text(m.btnYesDrova, "req:drova:default")
          .row()
          .text(m.btnAddComment, "catcomment:drova"),
        lang
      );
    case "linen":
      return backRow(
        new InlineKeyboard()
          .text(m.btnTowels, "req:linen:towels")
          .text(m.btnBedLinen, "req:linen:bed")
          .row()
          .text(m.btnPaper, "req:linen:paper")
          .text(m.btnOther, "catcomment:linen"),
        lang
      );
    case "cleaning":
      return backRow(
        new InlineKeyboard()
          .text(m.btnCleaning, "req:cleaning:clean")
          .text(m.btnTakeTrash, "req:cleaning:trash")
          .row()
          .text(m.btnUrgentCleaning, "req:cleaning:urgent")
          .text(m.btnOther, "catcomment:cleaning"),
        lang
      );
    case "broken":
      return backRow(
        new InlineKeyboard()
          .text(m.btnLight, "req:broken:light")
          .text(m.btnWater, "req:broken:water")
          .row()
          .text(m.btnHeating, "req:broken:heating")
          .text(m.btnDoorLock, "req:broken:door")
          .row()
          .text(m.btnWifi, "req:broken:wifi")
          .text(m.btnOther, "catcomment:broken"),
        lang
      );
    case "banya":
      return backRow(
        new InlineKeyboard()
          .text(m.btnBanya, "req:banya:banya")
          .text(m.btnGrill, "req:banya:grill")
          .row()
          .text(m.btnTub, "req:banya:tub")
          .text(m.btnOther, "catcomment:banya"),
        lang
      );
    case "wifi":
    case "checkinout":
    case "map":
      // Info-only categories: just a Back button (checkin/out also lets the
      // guest write to an admin).
      if (category === "checkinout") {
        return backRow(
          new InlineKeyboard().text(m.btnOther, "catcomment:other"),
          lang
        );
      }
      return new InlineKeyboard().text(m.btnBack, "menu_back");
    default:
      return null;
  }
}

/** Keyboard for the "returning after checkout" question. */
export function buildPastStayKeyboard(lang: Language): InlineKeyboard {
  const m = t(lang);
  return new InlineKeyboard()
    .text(m.btnPastStay, "past:visit")
    .text(m.btnNewBooking, "past:booking");
}

export { CATEGORIES };
