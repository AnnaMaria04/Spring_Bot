import type { GuestMessages } from "./types";

/** English guest interface copy (optional secondary language). */
export const en: GuestMessages = {
  welcome: (houseName) =>
    `Welcome to Spring Village 🌿\n\n` +
    `This is a private chat with your house's administration.\n` +
    `You can ask for firewood, towels, cleaning, technical help, or any question.\n\n` +
    `🏡 Your house: ${houseName}\n\n` +
    `How can we help?`,

  menuPrompt: "How can we help?",

  chooseHouse: "Please tell us your house so we know where to route your request.",
  scanOrChooseHouse:
    "To help you faster, scan the QR code in the house or type your house number.",
  askHouseNumber: "Please type your house number as a digit — for example, 3.",
  houseNotFound:
    "We couldn't find a house with that number. Please check and type the number again.",
  houseConfirm: (houseName) => `Your house: ${houseName}. Is that correct?`,
  houseSwitched: (houseName) => `Done, your house is now: ${houseName}.`,
  houseKept: (houseName) => `Okay, keeping your house: ${houseName}.`,
  unknownHouse: "We couldn't detect the house. Please pick your house from the list.",
  pastStayQuestion:
    "It looks like your stay has ended. Is this about a past visit or a new booking?",

  requestReceived: "Thank you, we've received your request ✅ An administrator will reply soon.",
  adminHandling: "An administrator is already handling your request.",
  needDetails: "Could you add a few more details so we can help faster?",
  done: "Done ✅ If you need anything else, just write to us here.",
  unclear:
    "We didn't quite catch that. You can pick a menu item or simply write your question as a normal message.",
  emergency: (phone) =>
    `If this is urgent, please call the administrator: ${phone}. We've also notified the administrator.`,
  photoReceived: "Got the photo, an administrator will take a look shortly.",
  voiceReceived: "Got your voice message, an administrator will listen shortly.",
  fileReceived:
    "Got the file. If it's urgent, please also send a short text description.",
  waitingReassure: "Your message is with the administrator. Thanks for waiting.",

  writeQuestion: "Please write your question in a single message.",
  addCommentPrompt: "Please write a comment and we'll pass it to the administrator.",
  drovaQuestion: "Do you need firewood brought over?",
  linenQuestion: "What do you need?",
  cleaningQuestion: "What kind of help do you need?",
  brokenQuestion: "What exactly isn't working?",
  banyaQuestion: "What can we help with?",
  taxiQuestion:
    "Please write where and when you need the car, and we'll pass it to the administrator.",
  wifiInfo: (name, password) =>
    `Wi-Fi details for your house:\n\n📶 Network: ${name}\n🔑 Password: ${password}`,
  wifiMissing:
    "We're confirming the Wi-Fi details. We've passed your question to the administrator.",
  checkinoutInfo:
    "🕒 Check-in: from 14:00\n🕚 Check-out: until 12:00\n\n" +
    "Need an early check-in or late check-out? Write to us and we'll do our best.",
  mapInfo: "📍 The site map has been sent. If you need help finding your way, write to us.",
  addressInfo: (address) =>
    `📍 How to find us:\n\n${address}\n\nIf anything is unclear on the way, message us and we'll help.`,
  addressMissing:
    "We're confirming the address and directions — we've passed your question to the administrator.",

  dbError: (phone) =>
    `A temporary technical issue may have occurred. If urgent, call the administrator: ${phone}.`,
  genericError: (phone) =>
    `Sorry, something went wrong. If urgent, call the administrator: ${phone}.`,

  help: (phone) =>
    "This is the Spring Village support chat 🌿\n\n" +
    "• Choose a menu item or simply type your question as a normal message.\n" +
    "• You can send a photo or a voice message.\n" +
    `• Urgent? Call the administrator: ${phone}.\n\n` +
    "Commands: /menu — menu, /call — administrator phone, /help — help.",
  callInfo: (phone) =>
    `📞 Administrator phone: ${phone}\n\nWe also receive your messages here in the chat.`,
  languageChoose: "Выберите язык / Choose language:",
  languageSet: "Done, language switched to English 🇬🇧",

  btnBack: "⬅️ Back",
  btnYesDrova: "✅ Yes, bring firewood",
  btnAddComment: "✍️ Add a comment",
  btnConfirmHouse: "✅ Yes, correct",
  btnChangeHouse: "🔁 Choose another house",
  btnPastStay: "Past visit",
  btnNewBooking: "New booking",
  btnTowels: "🧺 Towels",
  btnBedLinen: "🛏 Bed linen",
  btnPaper: "🧻 Paper",
  btnOther: "✍️ Other",
  btnCleaning: "🧹 Cleaning",
  btnTakeTrash: "🗑 Take out trash",
  btnUrgentCleaning: "🧽 Urgent cleaning",
  btnLight: "💡 Light",
  btnWater: "🚿 Water",
  btnHeating: "🔥 Heating",
  btnDoorLock: "🚪 Door/lock",
  btnWifi: "📶 Wi-Fi",
  btnBanya: "🔥 Sauna",
  btnGrill: "🍢 Grill",
  btnTub: "🛁 Hot tub",
};
