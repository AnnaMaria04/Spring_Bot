/**
 * Spring Village property facts, mirrored from the website content
 * (springvillage.vercel.app). Single source of truth for the bot's
 * auto-answers so the concierge copy stays accurate.
 */
export const PROPERTY = {
  brand: "Spring Village",
  houseName: "Коттедж WILD",
  houseNameEn: "WILD Cottage",
  tagline: "A-frame у Михалёвского озера",

  phone: "+7 (911) 110-16-52",
  phoneDial: "+79111101652",
  email: "springvillage@yandex.ru",
  telegram: "@springvillage",

  addressFull: "Песчаный проезд, 5а, пос. Михалёво, Выборгский район, ЛО",
  addressShort: "пос. Михалёво · 127 км от Санкт-Петербурга",
  coords: "60.983791, 29.422227",
  distanceFromSpb: "127 км",
  driveTime: "~2 часа",
  bookingUrl:
    "https://reservationsteps.ru/rooms/index/12e2e2c5-b04f-4f43-ab36-3eff3f10dc16",

  checkIn: "15:00",
  checkOut: "12:00",
  deposit: "5 000 ₽",
  priceFrom: "20 000 ₽",
  capacity: 5,
  area: 60,
} as const;
