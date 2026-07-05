import { config } from "../config";

/**
 * Minimal Bnovo Open API «Старт» client (read-only bookings).
 *
 * The exact request/response shapes are only fully visible from Bnovo's docs
 * (which this build environment can't reach), so this client is deliberately
 * defensive: it tries several common field names and, on any failure, returns
 * a human-readable diagnostic that the /occupancy command surfaces — so the
 * first live test either works or tells us exactly what to adjust.
 */
const BASE = "https://online.bnovo.ru";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function bnovoConfigured(): boolean {
  return !!config.bnovoApiKey;
}

/** Today's date (YYYY-MM-DD) in Moscow time. */
export function moscowToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface Occupant {
  name: string;
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
}

export interface OccupancyResult {
  ok: boolean;
  occupant?: Occupant | null;
  error?: string;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function toList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = (data ?? {}) as Record<string, unknown>;
  const candidate = d.bookings ?? d.data ?? d.results ?? d.items ?? [];
  return Array.isArray(candidate) ? (candidate as Record<string, unknown>[]) : [];
}

const ARRIVAL_KEYS = ["arrival", "date_from", "checkin", "check_in", "arrival_date", "start_date"];
const DEPARTURE_KEYS = ["departure", "date_to", "checkout", "check_out", "departure_date", "end_date"];

function dateStr(b: Record<string, unknown>, keys: string[]): string {
  return String(pick(b, keys) ?? "").slice(0, 10);
}

function guestName(b: Record<string, unknown>): string {
  const direct = pick(b, ["customer_name", "guest_name", "name", "client_name", "fio"]);
  if (direct) return String(direct);
  const first = pick(b, ["first_name", "customer_first_name", "guest_first_name"]);
  const last = pick(b, ["last_name", "customer_last_name", "guest_last_name"]);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || "Гость";
}

function extractToken(text: string): string | undefined {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const nested = (data.data ?? {}) as Record<string, unknown>;
  return (data.access_token ?? data.token ?? data.jwt ?? nested.access_token) as
    | string
    | undefined;
}

async function authRequest(id: string, password: string) {
  const res = await fetch(`${BASE}/api/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id, password }),
  });
  return { res, text: await res.text() };
}

/**
 * Bnovo's "Старт" panel gives one copyable string for id + password, joined
 * with "|" (a base64 secret and a hex account id). Which half is which isn't
 * documented, so try one order and fall back to the other on 401.
 */
async function authenticate(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.token;

  const [a, b] = config.bnovoApiKey.split("|");
  if (!a || !b) {
    throw new Error(
      "BNOVO_API_KEY не похож на пару id|password — проверьте значение в Vercel."
    );
  }

  let { res, text } = await authRequest(b, a);
  if (res.status === 401) {
    ({ res, text } = await authRequest(a, b));
  }
  if (!res.ok) throw new Error(`auth → HTTP ${res.status}: ${text.slice(0, 300)}`);

  const token = extractToken(text);
  if (!token) throw new Error(`auth → token not found: ${text.slice(0, 200)}`);

  // JWT is valid 1 day per Bnovo's docs; refresh a little early.
  cachedToken = { token, expiresAt: now + 23 * 60 * 60_000 };
  return token;
}

/** Who is currently in the house according to Bnovo (arrival ≤ today < departure). */
export async function getOccupancy(today: string): Promise<OccupancyResult> {
  if (!config.bnovoApiKey) return { ok: false, error: "BNOVO_API_KEY не задан." };
  try {
    const token = await authenticate();
    const url = `${BASE}/api/v1/bookings?date_from=${today}&date_to=${today}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`bookings → HTTP ${res.status}: ${text.slice(0, 300)}`);

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`bookings → non-JSON response: ${text.slice(0, 200)}`);
    }

    const current = toList(data).find((b) => {
      const arrival = dateStr(b, ARRIVAL_KEYS);
      const departure = dateStr(b, DEPARTURE_KEYS);
      return arrival && departure && arrival <= today && today < departure;
    });
    if (!current) return { ok: true, occupant: null };

    return {
      ok: true,
      occupant: {
        name: guestName(current),
        arrival: dateStr(current, ARRIVAL_KEYS),
        departure: dateStr(current, DEPARTURE_KEYS),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
