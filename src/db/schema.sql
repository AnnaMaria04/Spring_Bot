-- ─────────────────────────────────────────────────────────────
-- Spring Village Bot — database schema (PostgreSQL)
--
-- This file is portable: it runs on a Supabase Postgres database
-- and on a plain PostgreSQL instance on a VPS. It is idempotent,
-- so it is safe to run more than once.
-- ─────────────────────────────────────────────────────────────

-- Houses ───────────────────────────────────────────────────────
-- One row per Spring Village house. `code` is the QR start payload.
CREATE TABLE IF NOT EXISTS houses (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,            -- h1, h2, ... used in /start <code>
  name          TEXT NOT NULL,                   -- Дом 1
  status        TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  wifi_name     TEXT,
  wifi_password TEXT,
  notes         TEXT,
  topic_id      BIGINT,                          -- optional forum topic id in the admin group
  checkin_info  TEXT,                            -- per-house check-in/out details (auto-answer)
  address       TEXT,                            -- per-house address / how to find us (auto-answer)
  map_url       TEXT,                            -- optional link to a map
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guests ───────────────────────────────────────────────────────
-- One row per Telegram user who ever opened the bot.
CREATE TABLE IF NOT EXISTS guests (
  id               SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username         TEXT,
  first_name       TEXT,
  language         TEXT NOT NULL DEFAULT 'ru',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stays ────────────────────────────────────────────────────────
-- Connects a guest to a house for a period of time. Only one stay
-- per guest is `active` at a time.
CREATE TABLE IF NOT EXISTS stays (
  id         SERIAL PRIMARY KEY,
  guest_id   INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  house_id   INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  check_in   TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out  TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'active',     -- active | completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requests ─────────────────────────────────────────────────────
-- A service request raised by a guest.
CREATE TABLE IF NOT EXISTS requests (
  id                SERIAL PRIMARY KEY,
  stay_id           INTEGER REFERENCES stays(id) ON DELETE SET NULL,
  house_id          INTEGER NOT NULL REFERENCES houses(id),
  guest_id          INTEGER NOT NULL REFERENCES guests(id),
  category            TEXT,                            -- drova, linen, cleaning, ...
  status              TEXT NOT NULL DEFAULT 'new',     -- new | in_progress | waiting_guest | done | urgent | cancelled
  priority            TEXT NOT NULL DEFAULT 'normal',  -- normal | urgent
  summary             TEXT,                            -- short text shown on the request card
  assigned_admin_id   BIGINT,                          -- telegram_user_id of admin who took it
  assigned_admin_name TEXT,                            -- display name of that admin (for the card)
  taken_at            TIMESTAMPTZ,                     -- when an admin took it
  first_reply_at      TIMESTAMPTZ,                     -- when the guest first got a reply (response time)
  done_at             TIMESTAMPTZ,                     -- when it was completed
  done_by_name        TEXT,                            -- who completed it
  admin_chat_id       BIGINT,                          -- chat where the request card was posted
  admin_message_id    BIGINT,                          -- message id of the request card
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_guest        ON requests (guest_id);
CREATE INDEX IF NOT EXISTS idx_requests_house        ON requests (house_id);
CREATE INDEX IF NOT EXISTS idx_requests_status       ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_admin_msg    ON requests (admin_chat_id, admin_message_id);

-- Messages ─────────────────────────────────────────────────────
-- Every guest<->admin message tied to a request, for history and
-- for routing admin replies back to the right guest.
CREATE TABLE IF NOT EXISTS messages (
  id                  SERIAL PRIMARY KEY,
  request_id          INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL,                  -- guest_to_admin | admin_to_guest
  text                TEXT,
  media_type          TEXT,                           -- text | photo | voice | document | video | sticker
  telegram_message_id BIGINT,                         -- message id in the relevant chat
  sender_telegram_id  BIGINT,                         -- author's telegram user id
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_request   ON messages (request_id);
CREATE INDEX IF NOT EXISTS idx_messages_admin_msg ON messages (direction, telegram_message_id);

-- Admins ───────────────────────────────────────────────────────
-- Authorized staff. The OWNER_TELEGRAM_ID is always treated as owner
-- even if not present here.
CREATE TABLE IF NOT EXISTS admins (
  id               SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username         TEXT,
  role             TEXT NOT NULL DEFAULT 'admin',     -- owner | admin
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings ─────────────────────────────────────────────────────
-- Single-row operational settings. Values fall back to env vars.
CREATE TABLE IF NOT EXISTS settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  admin_group_id   BIGINT,
  emergency_phone  TEXT,
  default_language TEXT NOT NULL DEFAULT 'ru',
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Sessions ─────────────────────────────────────────────────────
-- Operational table (not in the spec's "minimum" list) used to keep
-- short-lived guest conversation state (e.g. "waiting for free text")
-- in the database so flows survive restarts and work on serverless.
CREATE TABLE IF NOT EXISTS sessions (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security ───────────────────────────────────────────
-- Lock the tables down from any PostgREST/anon access (Supabase). The bot
-- connects with a privileged Postgres role that bypasses RLS, so this does
-- not affect the bot. Harmless on a plain VPS Postgres (owner bypasses RLS).
ALTER TABLE houses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Seed: 10 house records with QR codes ready (h1..h10). Only Дом 1 starts
-- active so a single-house setup works out of the box (the bot auto-assigns
-- the sole active house). Enable more later with /enablehouse <code>.
INSERT INTO houses (code, name, status) VALUES
  ('h1',  'Коттедж WILD', 'active'),
  ('h2',  'Дом 2',  'inactive'),
  ('h3',  'Дом 3',  'inactive'),
  ('h4',  'Дом 4',  'inactive'),
  ('h5',  'Дом 5',  'inactive'),
  ('h6',  'Дом 6',  'inactive'),
  ('h7',  'Дом 7',  'inactive'),
  ('h8',  'Дом 8',  'inactive'),
  ('h9',  'Дом 9',  'inactive'),
  ('h10', 'Дом 10', 'inactive')
ON CONFLICT (code) DO NOTHING;
