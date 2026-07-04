/** Database row types. BIGINT columns are parsed to `number` (see db/client.ts). */

export interface House {
  id: number;
  code: string;
  name: string;
  status: string;
  wifi_name: string | null;
  wifi_password: string | null;
  notes: string | null;
  topic_id: number | null;
  checkin_info: string | null;
  address: string | null;
  map_url: string | null;
  created_at: string;
}

export interface Guest {
  id: number;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  language: string;
  created_at: string;
}

export interface Stay {
  id: number;
  guest_id: number;
  house_id: number;
  check_in: string;
  check_out: string | null;
  status: string; // active | completed
  created_at: string;
}

export type RequestStatus =
  | "new"
  | "in_progress"
  | "waiting_guest"
  | "done"
  | "urgent"
  | "cancelled";

export interface ServiceRequest {
  id: number;
  stay_id: number | null;
  house_id: number;
  guest_id: number;
  category: string | null;
  status: RequestStatus;
  priority: string; // normal | urgent
  summary: string | null;
  assigned_admin_id: number | null;
  assigned_admin_name: string | null;
  admin_chat_id: number | null;
  admin_message_id: number | null;
  created_at: string;
  updated_at: string;
}

export type MessageDirection = "guest_to_admin" | "admin_to_guest";

export interface MessageRow {
  id: number;
  request_id: number | null;
  direction: MessageDirection;
  text: string | null;
  media_type: string | null;
  telegram_message_id: number | null;
  sender_telegram_id: number | null;
  created_at: string;
}

export interface Admin {
  id: number;
  telegram_user_id: number;
  username: string | null;
  role: string; // owner | admin
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  admin_group_id: number | null;
  emergency_phone: string | null;
  default_language: string;
}

/** Statuses that mean a request is still open (eligible for follow-up grouping). */
export const OPEN_STATUSES: RequestStatus[] = [
  "new",
  "in_progress",
  "waiting_guest",
  "urgent",
];
