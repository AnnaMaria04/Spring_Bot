import { InlineKeyboard } from "grammy";
import type { Language } from "../config";
import { categoryButtonLabel, type CategoryKey } from "../categories";
import { t } from "../messages";
import type { House } from "../types";

const SERVICE_KEYS: CategoryKey[] = ["drova", "linen", "cleaning", "gear", "bbq", "broken"];
// "call" lives in Info, not on the main screen — it's an escalation, not an
// everyday action, so it only appears once the guest is already looking for help.
const INFO_KEYS: CategoryKey[] = ["wifi", "activities", "checkout", "rules", "address", "call"];

/**
 * Compact top-level menu: two groups plus one direct action. Keeping it small
 * avoids overwhelming the guest; services/info drill down.
 */
export function buildMainMenu(lang: Language): InlineKeyboard {
  const m = t(lang);
  return new InlineKeyboard()
    .text(m.btnServices, "group:services")
    .text(m.btnInfo, "group:info")
    .row()
    .text(categoryButtonLabel("other", lang), "cat:other");
}

function gridMenu(keys: CategoryKey[], lang: Language, backTo: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  keys.forEach((key, i) => {
    kb.text(categoryButtonLabel(key, lang), `cat:${key}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text(t(lang).btnBack, backTo);
  return kb;
}

export function buildServicesMenu(lang: Language): InlineKeyboard {
  return gridMenu(SERVICE_KEYS, lang, "menu_back");
}

export function buildInfoMenu(lang: Language): InlineKeyboard {
  return gridMenu(INFO_KEYS, lang, "menu_back");
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

/** Tappable house picker (used when a handful of houses are active). */
export function buildHousePicker(houses: House[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  houses.forEach((h, i) => {
    kb.text(h.name, `house_pick:${h.code}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row();
  return kb;
}

/** Sub-menu for a category. Service categories go back to the services group;
 *  info categories go back to the info group; free-text categories return null. */
export function buildCategoryKeyboard(
  category: CategoryKey,
  lang: Language
): InlineKeyboard | null {
  const m = t(lang);
  const backServices = m.btnBack;

  switch (category) {
    case "drova":
      return new InlineKeyboard()
        .text(m.btnYesDrova, "req:drova:default")
        .row()
        .text(m.btnAddComment, "catcomment:drova")
        .row()
        .text(backServices, "group:services");
    case "linen":
      return new InlineKeyboard()
        .text(m.btnTowels, "req:linen:towels")
        .text(m.btnBedLinen, "req:linen:bed")
        .row()
        .text(m.btnPaper, "req:linen:paper")
        .text(m.btnOther, "catcomment:linen")
        .row()
        .text(backServices, "group:services");
    case "cleaning":
      return new InlineKeyboard()
        .text(m.btnCleaning, "req:cleaning:clean")
        .text(m.btnTakeTrash, "req:cleaning:trash")
        .row()
        .text(m.btnOther, "catcomment:cleaning")
        .row()
        .text(backServices, "group:services");
    case "gear":
      return new InlineKeyboard()
        .text(m.btnBoat, "req:gear:boat")
        .text(m.btnSup, "req:gear:sup")
        .row()
        .text(m.btnBikes, "req:gear:bike")
        .text(m.btnOther, "catcomment:gear")
        .row()
        .text(backServices, "group:services");
    case "bbq":
      return new InlineKeyboard()
        .text(m.btnGrill, "req:bbq:coals")
        .text(m.btnSkewers, "req:bbq:tools")
        .row()
        .text(m.btnOther, "catcomment:bbq")
        .row()
        .text(backServices, "group:services");
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
        .text(backServices, "group:services");
    case "wifi":
    case "activities":
    case "checkout":
    case "rules":
    case "address":
      return new InlineKeyboard().text(m.btnBack, "group:info");
    default:
      return null;
  }
}
