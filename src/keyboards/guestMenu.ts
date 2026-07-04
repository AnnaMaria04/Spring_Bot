import { InlineKeyboard } from "grammy";
import type { Language } from "../config";
import { categoryButtonLabel, type CategoryKey } from "../categories";
import { t } from "../messages";

/** Main in-stay concierge menu: services, instant info, and contact. */
export function buildMainMenu(lang: Language): InlineKeyboard {
  const order: CategoryKey[] = [
    // Services
    "drova",
    "linen",
    "cleaning",
    "gear",
    "bbq",
    "broken",
    // Info (instant)
    "wifi",
    "activities",
    "checkout",
    "rules",
    "address",
    // Contact
    "other",
    "call",
  ];
  const kb = new InlineKeyboard();
  order.forEach((key, i) => {
    kb.text(categoryButtonLabel(key, lang), `cat:${key}`);
    if (key === "call") return; // last item, own row
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

/** Sub-menu for a category. Info-only categories get a Back button; free-text
 *  categories return null (handled by the caller). */
export function buildCategoryKeyboard(
  category: CategoryKey,
  lang: Language
): InlineKeyboard | null {
  const m = t(lang);
  const back = () => new InlineKeyboard().text(m.btnBack, "menu_back");

  switch (category) {
    case "drova":
      return new InlineKeyboard()
        .text(m.btnYesDrova, "req:drova:default")
        .row()
        .text(m.btnAddComment, "catcomment:drova")
        .row()
        .text(m.btnBack, "menu_back");
    case "linen":
      return new InlineKeyboard()
        .text(m.btnTowels, "req:linen:towels")
        .text(m.btnBedLinen, "req:linen:bed")
        .row()
        .text(m.btnPaper, "req:linen:paper")
        .text(m.btnOther, "catcomment:linen")
        .row()
        .text(m.btnBack, "menu_back");
    case "cleaning":
      return new InlineKeyboard()
        .text(m.btnCleaning, "req:cleaning:clean")
        .text(m.btnTakeTrash, "req:cleaning:trash")
        .row()
        .text(m.btnOther, "catcomment:cleaning")
        .row()
        .text(m.btnBack, "menu_back");
    case "gear":
      return new InlineKeyboard()
        .text(m.btnBoat, "req:gear:boat")
        .text(m.btnSup, "req:gear:sup")
        .row()
        .text(m.btnBikes, "req:gear:bike")
        .text(m.btnOther, "catcomment:gear")
        .row()
        .text(m.btnBack, "menu_back");
    case "bbq":
      return new InlineKeyboard()
        .text(m.btnGrill, "req:bbq:coals")
        .text(m.btnSkewers, "req:bbq:tools")
        .row()
        .text(m.btnOther, "catcomment:bbq")
        .row()
        .text(m.btnBack, "menu_back");
    case "broken":
      return new InlineKeyboard()
        .text(m.btnLight, "req:broken:light")
        .text(m.btnWater, "req:broken:water")
        .row()
        .text(m.btnHeating, "req:broken:heat")
        .text(m.btnDoorLock, "req:broken:door")
        .row()
        .text(m.btnWifi, "req:broken:wifi")
        .text(m.btnOther, "catcomment:broken")
        .row()
        .text(m.btnBack, "menu_back");
    case "wifi":
    case "activities":
    case "checkout":
    case "rules":
    case "address":
      return back();
    default:
      return null;
  }
}
