import type { GuestMessages } from "./types";
import { PROPERTY } from "../content/property";

/** English guest interface copy (optional secondary language). */
export const en: GuestMessages = {
  welcome: (houseName) =>
    `🌲 Spring Village\n\n` +
    `Welcome to "${houseName}" — your A-frame on the shore of Lake Mikhalyovskoye.\n\n` +
    `This is a private chat with your hosts. Firewood, towels, the boat, or a recommendation for your stay — ` +
    `just write, and we'll take care of it.\n\n` +
    `How can we help?`,

  menuPrompt: "How can we help?",
  servicesTitle: "🛎 What do you need?",
  infoTitle: "ℹ️ Useful information:",
  inputPlaceholder: "Type your message…",
  housePlaceholder: "House number, e.g. 1",

  askHouseNumber: "Just type your house number here in the chat (for example, 1) ⌨️",
  chooseHouseTitle: "Choose your house:",
  houseNotFound: "We couldn't find a house with that number. Please check and type it again.",
  houseConfirm: (houseName) =>
    `Looks like you scanned another house's QR code — "${houseName}". ` +
    `Switch this chat to it? The previous house will close.`,
  scanOrChooseHouse: "Please type your house number so we know where to route your request.",

  requestReceived: "Thank you, we've received your request ✅ Your hosts see it and will reply shortly.",
  done: "Done ✅ If you need anything else, just write to us here.",
  unclear: "We didn't quite catch that. Pick a menu item or describe it in words — we'll understand.",
  emergency: (phone) =>
    `If it's urgent, call your host: ${phone}. We've already received your message.`,
  photoReceived: "Got the photo — your hosts will take a look shortly.",
  voiceReceived: "Got your voice message — we'll listen shortly.",
  fileReceived: "Got the file — your hosts will take a look shortly. If it's urgent, please also send a short text.",
  writeQuestion: "✍️ Write your question as a message right here in the chat — we'll help.",
  addCommentPrompt: "✍️ Write a comment as a message in the chat — we'll pass it to your hosts.",
  brokenPhotoHint: "\n\nIf you can, send a photo — it'll help us sort it out faster.",

  drovaQuestion: "Bring firewood for the fireplace or the grill?",
  linenQuestion: "What should we bring?",
  cleaningQuestion: "How can we help?",
  gearQuestion: "What should we get ready?",
  bbqQuestion: "What do you need for the grill?",
  brokenQuestion: "What exactly isn't working?",

  wifiInfo: (name, password) =>
    `📶 Wi-Fi\n\nNetwork: ${name}\nPassword: ${password}\n\nIf it won't connect, write to us and we'll help.`,
  wifiMissing: "One moment — we'll confirm the Wi-Fi details and send them right over. We've already passed this to your hosts.",

  activitiesInfo:
    "🎣 Things to do\n\n" +
    "• 🛶 SUP & boat — straight off the pier, included in your stay\n" +
    "• 🎣 Fishing — lake up to 21 m deep, tackle on site\n" +
    "• 🔥 Lakeside grill — firewood, grate and skewers ready\n" +
    "• 💧 Finnish spring — fresh living water on the grounds\n" +
    "• 🌲 Forest trails — mushrooms, berries and quiet right behind the house\n" +
    "• 🚲 Bikes, pétanque, badminton, volleyball\n\n" +
    "In winter — skating on the lake, skis, ice fishing and evenings by the fireplace.\n\n" +
    "Want something prepared? Just write — we'll arrange it.",

  checkoutInfo:
    `🕒 Check-out\n\nBy ${PROPERTY.checkOut}. Need a later time? ` +
    `Write to us — we'll do our best if the house is free.\n\n` +
    `Check-in, for reference, is from ${PROPERTY.checkIn}.`,

  rulesInfo:
    "📖 Rules & good to know\n\n" +
    "• Up to 5 guests\n" +
    "• Quiet hours from 23:00 — we protect the calm of the lake and our neighbors\n" +
    `• Deposit ${PROPERTY.deposit} — refunded on check-out\n` +
    "• Pets (up to 10 kg) — by arrangement with the hosts\n" +
    "• Please take care of the house, appliances, and grounds\n\n" +
    "Included: linen & towels, Wi-Fi, parking, firewood, SUP, boat, bikes.\n\n" +
    "Any question — just write, we're always here.",

  addressInfo: (address, coords) =>
    `📍 Address (for taxi & delivery)\n\n${address}\n🧭 Coordinates: ${coords}\n\n` +
    `The last 2 km is a gravel road along the shore — a regular car handles it fine.`,

  dbError: (phone) =>
    `Sorry, looks like a temporary technical hiccup. If it's urgent, call your host: ${phone}.`,
  genericError: (phone) => `Sorry, something went wrong. If it's urgent, call your host: ${phone}.`,

  help: (phone) =>
    "Spring Village 🌲 — the help chat for your stay.\n\n" +
    "• Pick a menu item or just write what you need.\n" +
    "• You can send a photo or a voice message.\n" +
    `• Urgent? Call your host: ${phone}.\n\n` +
    "Commands: /menu — open the menu, /language — change language, /call — host's phone.",
  callInfo: (phone) => `📞 Host's phone: ${phone}\n\nWe're also always here in the chat.`,
  languageChoose: "Выберите язык / Choose language:",
  languageSet: "Done, switched to English 🇬🇧",

  btnServices: "🛎 Services",
  btnInfo: "ℹ️ Information",
  btnBack: "⬅️ Back",
  btnConfirmHouse: "✅ Yes, correct",
  btnChangeHouse: "🔁 Another house",
  btnAddComment: "✍️ Add a comment",
  btnYesDrova: "✅ Yes, bring firewood",
  btnTowels: "🧺 Towels",
  btnBedLinen: "🛏 Bed linen",
  btnPaper: "🧻 Toilet paper",
  btnOther: "✍️ Other",
  btnCleaning: "🧹 Cleaning",
  btnTakeTrash: "🗑 Take out trash",
  btnBoat: "🛶 Boat",
  btnSup: "🏄 SUP boards",
  btnBikes: "🚲 Bikes",
  btnGrill: "🔥 Grill / firewood",
  btnSkewers: "🍢 Skewers / grate",
  btnLight: "💡 Light",
  btnWater: "🚿 Water",
  btnHeating: "🌡️ Heating / fireplace",
  btnDoorLock: "🚪 Door / lock",
  btnWifi: "📶 Wi-Fi isn't working",
};
