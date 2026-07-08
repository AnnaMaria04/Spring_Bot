/**
 * Admin-facing copy and request-card formatting. Per the spec the admin
 * interface is always in Russian ("All buttons are in Russian"), so this
 * module is not language-switched.
 */

export interface AdminCardData {
  requestId: number;
  houseName: string;
  guestName: string;
  category: string; // human-readable label
  time: string; // HH:MM
  message: string;
  status: string;
  assignedName?: string | null;
  takenAt?: string | null; // HH:MM the admin took it
  responseDuration?: string | null; // e.g. "4 мин" — request → first reply
  doneBy?: string | null;
  doneAt?: string | null; // HH:MM completed
  resolutionDuration?: string | null; // request → done
  priority?: string | null;
}

/** Human-readable duration from milliseconds, e.g. "4 мин", "1 ч 5 мин". */
export function formatDuration(ms: number): string {
  const min = Math.round(Math.max(0, ms) / 60000);
  if (min < 1) return "меньше минуты";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${h} ч ${mm} мин` : `${h} ч`;
}

const STATUS_TITLE: Record<string, string> = {
  new: "🆕 НОВЫЙ ЗАПРОС",
  in_progress: "🛠 ЗАПРОС В РАБОТЕ",
  waiting_guest: "⏳ ОЖИДАЕМ ОТВЕТ ГОСТЯ",
  done: "✅ ЗАПРОС ЗАВЕРШЁН",
  urgent: "🚨 СРОЧНЫЙ ЗАПРОС",
  cancelled: "🚫 ЗАПРОС ОТМЕНЁН",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  in_progress: "В работе",
  waiting_guest: "Ожидает гостя",
  done: "Завершён",
  urgent: "Срочно",
  cancelled: "Отменён",
};

export function statusTitle(status: string): string {
  return STATUS_TITLE[status] ?? "ЗАПРОС";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Format a guest display name like "Anna / @username". */
export function formatGuestName(
  firstName?: string | null,
  username?: string | null
): string {
  const parts: string[] = [];
  if (firstName) parts.push(firstName);
  if (username) parts.push(`@${username}`);
  if (parts.length === 0) return "Гость";
  return parts.join(" / ");
}

/** Format a timestamp as HH:MM in Moscow time (Spring Village is in Russia). */
export function formatTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

/** Render the main request card posted to the admin group. */
export function renderCard(d: AdminCardData): string {
  const lines: (string | null)[] = [
    d.priority === "urgent" && d.status !== "urgent" ? "🚨 СРОЧНО" : null,
    statusTitle(d.status),
    "",
    `🏡 Домик: ${d.houseName}`,
    `👤 Гость: ${d.guestName}`,
    `📌 Категория: ${d.category}`,
    `🕒 Время: ${d.time}`,
    `🆔 Запрос #${d.requestId}`,
    "",
    "💬 Сообщение:",
    d.message?.trim() ? d.message.trim() : "—",
    "",
    d.assignedName
      ? `👷 Взял: ${d.assignedName}${d.takenAt ? ` · ${d.takenAt}` : ""}`
      : null,
    d.responseDuration ? `⏱ Ответ за ${d.responseDuration}` : null,
    d.status === "done" && d.doneBy
      ? `✅ Завершил: ${d.doneBy}${d.doneAt ? ` · ${d.doneAt}` : ""}` +
        (d.resolutionDuration ? ` · за ${d.resolutionDuration}` : "")
      : null,
    `Статус: ${statusLabel(d.status)}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Short block for a guest follow-up message, posted as a reply to the card. */
export function renderFollowup(p: {
  houseName: string;
  requestId: number;
  text: string;
}): string {
  return (
    `✉️ Новое сообщение от гостя (${p.houseName}, запрос #${p.requestId}):\n\n` +
    (p.text?.trim() ? p.text.trim() : "—")
  );
}

/** Info card shown when an admin presses "📄 Инфо". */
export function renderInfo(p: {
  houseName: string;
  guestName: string;
  stayStatus: string;
  checkIn?: string | null;
  totalRequests: number;
  openRequests: number;
}): string {
  return [
    "📄 Информация о госте",
    "",
    `🏡 Домик: ${p.houseName}`,
    `👤 Гость: ${p.guestName}`,
    `📅 Проживание: ${p.stayStatus === "active" ? "активно" : "завершено"}` +
      (p.checkIn ? ` (с ${p.checkIn})` : ""),
    `📨 Всего запросов: ${p.totalRequests}`,
    `📂 Открытых запросов: ${p.openRequests}`,
  ].join("\n");
}

/** Alert reposted to the Urgent topic / group when a request is escalated. */
export function renderUrgentAlert(p: {
  houseName: string;
  guestName: string;
  requestId: number;
  message: string;
}): string {
  return (
    `🚨 СРОЧНЫЙ ЗАПРОС\n\n` +
    `🏡 ${p.houseName}\n` +
    `👤 ${p.guestName}\n` +
    `🆔 Запрос #${p.requestId}\n\n` +
    (p.message?.trim() ? p.message.trim() : "—") +
    `\n\nОтветьте reply на это сообщение, чтобы написать гостю.`
  );
}

/** Short admin action acknowledgements and internal notices. */
export const adminText = {
  notAuthorized: "Недостаточно прав для этого действия.",
  takenAck: (id: number) => `Вы взяли запрос #${id}.`,
  alreadyTaken: (name: string) => `Запрос уже взял ${name}.`,
  replySent: "Ответ отправлен гостю ✅",
  markedDone: (id: number) => `Запрос #${id} отмечен как завершённый ✅`,
  markedUrgent: (id: number) => `Запрос #${id} помечен как срочный 🚨`,
  reopened: (id: number) => `Запрос #${id} открыт снова.`,
  cannotIdentifyGuest:
    "Не удалось определить гостя. Ответьте, пожалуйста, прямо (reply) на сообщение с запросом гостя.",
  guestBlocked:
    "⚠️ Не удалось доставить ответ: гость заблокировал бота или недоступен.",
  replyInstruction:
    "Чтобы ответить гостю, сделайте reply (ответить) на это сообщение и напишите текст или прикрепите фото.",
  doneWithPhotoHint:
    "📷 Если хотите показать гостю фото готовой работы (и сохранить его здесь для владельца) — сделайте reply на карточку заявки этой фотографией.",
  groupNotConfigured:
    "⚠️ Группа администраторов не настроена. Запустите /setgroup в нужной группе.",
  setGroupOk: (id: number) =>
    `✅ Эта группа сохранена как группа администраторов (ID: ${id}).`,
  whereami: (chatId: number, threadId?: number) =>
    `ID этого чата: ${chatId}` + (threadId ? `\nID темы (topic): ${threadId}` : ""),
  staffPanel:
    "🛎 Панель администратора\n\n" +
    "Вы вошли как сотрудник — гостевое меню вам не нужно. Работайте прямо в группе поддержки: " +
    "отвечайте (reply) на карточки заявок, нажимайте «✅ Взять» и «✔️ Готово».\n\n" +
    "Команды:\n" +
    "/open — открытые заявки\n" +
    "/occupancy — кто сейчас проживает\n" +
    "/houses — домики и настройки\n" +
    "/setwifi · /setcheckin · /setaddress — автоответы гостям",
};
