# Spring Village — Telegram Guest Support Bot 🌿

A private concierge bot for the **Spring Village** guest houses. Guests scan a
house‑specific QR code, open a private Telegram chat, and ask for anything
(firewood, towels, cleaning, technical help, Wi‑Fi, taxi…). Every request is
posted as a structured card into a single **private admin group**, where staff
reply from their own Telegram accounts. The bot routes each reply back to the
correct guest.

- **Guests** never see each other or the admin group.
- **Admins** never share one Telegram account — they work from one staff group.
- **Routing** is database‑backed, so replies always reach the right guest and
  survive restarts / serverless cold starts.

Bot interface language: **Russian** (English available via `/language`).
This document is in English for implementation.

---

## How it works

```
Guest scans house QR (t.me/<bot>?start=h3)
        │
        ▼
Bot welcomes guest, confirms house, shows the Russian menu
        │
        ▼
Guest taps a button or writes free text / sends a photo or voice note
        │
        ▼
Bot stores the request and posts a card into the private admin group
        │
        ▼
Admin presses ✅ Взять, replies (Telegram "reply") to the card, presses ✔️ Готово
        │
        ▼
Bot delivers the reply to the guest as "Spring Village"
```

---

## Features

- **House detection** from the QR deep link (`/start h3`), with confirmation if
  a guest opens a different house.
- **Russian guest menu**: Дрова, Полотенца/бельё, Уборка, Что‑то не работает,
  Wi‑Fi, Баня/мангал/купель, Такси, Заезд/выезд, Карта, Другой вопрос,
  Позвонить администратору.
- **Free text always works** — guests are never trapped in buttons.
- **Photos, voice messages, and files** are forwarded to admins with the house
  label and acknowledged instantly.
- **Admin cards** with inline actions: ✅ Взять · 💬 Ответить · ✔️ Готово ·
  🚨 Срочно · 📄 Инфо · ↩️ Открыть снова.
- **Reply by replying** — an admin replies to the request card and the bot sends
  it to the guest. No commands needed for daily work.
- **Statuses**: new · in_progress · waiting_guest · done · urgent · cancelled.
- **Follow‑up grouping** — quick consecutive guest messages join the same open
  request instead of flooding the group.
- **Emergency path** — the phone number is shown immediately and admins get an
  urgent alert.
- **Per‑house forum topics** (optional) — set a `topic_id` per house to route
  cards into a Telegram forum topic.
- **Authorization** — only the owner and active admins can use admin actions.
- **Portable** — runs as a Vercel serverless webhook **or** a long‑running
  process (VPS / local) against any PostgreSQL (Supabase or self‑hosted).

---

## Tech stack

| Layer    | Choice                                            |
| -------- | ------------------------------------------------- |
| Language | TypeScript (Node.js ≥ 18)                         |
| Telegram | [grammY](https://grammy.dev)                      |
| Database | PostgreSQL (Supabase or self‑hosted), via `pg`    |
| Hosting  | Vercel (webhook) **or** VPS (webhook / polling)   |
| QR codes | `qrcode`                                          |

---

## Project structure

```
spring-village-bot/
├── api/
│   └── webhook.ts          # Vercel serverless webhook entry
├── src/
│   ├── bot.ts              # Bot factory: wires middleware + handlers
│   ├── index.ts            # Long-polling entry (VPS / local)
│   ├── server.ts           # Node webhook server entry (VPS)
│   ├── config.ts           # Env var loading & validation
│   ├── context.ts          # Custom context + session type
│   ├── categories.ts       # Request categories + Russian summaries
│   ├── types.ts            # DB row types
│   ├── db/
│   │   ├── schema.sql      # Tables, indexes, seed, RLS (idempotent)
│   │   └── client.ts       # pg pool + helpers
│   ├── messages/
│   │   ├── ru.ts           # Guest copy (Russian, default)
│   │   ├── en.ts           # Guest copy (English)
│   │   ├── admin.ts        # Admin copy + card formatting (Russian)
│   │   ├── types.ts        # Guest message catalog interface
│   │   └── index.ts        # Language resolver
│   ├── keyboards/
│   │   ├── guestMenu.ts    # Menu + sub-menus + house pickers
│   │   ├── adminButtons.ts # Inline admin actions
│   │   └── languageButtons.ts
│   ├── handlers/
│   │   ├── start.ts        # /start + house detection
│   │   ├── commands.ts     # /menu /help /call /language + admin/setup cmds
│   │   ├── callbacks.ts    # All inline button presses
│   │   ├── guestMessages.ts# Guest text / media intake
│   │   ├── adminReplies.ts # Admin reply routing
│   │   └── intake.ts       # Shared request create/append logic
│   └── services/
│       ├── houses.ts  guests.ts  stays.ts  admins.ts
│       ├── requests.ts     # Request lifecycle + reply routing lookups
│       ├── notifications.ts# Posting cards / delivering replies
│       ├── settings.ts     # Admin group id, emergency phone
│       └── sessionStore.ts # Postgres-backed grammY session storage
├── scripts/
│   ├── migrate.ts          # Apply schema.sql to DATABASE_URL
│   ├── setWebhook.ts       # Set/delete webhook + bot commands
│   └── generateQr.ts       # Generate per-house QR codes
├── .env.example
├── vercel.json
├── tsconfig.json / tsconfig.build.json
└── package.json
```

---

## Prerequisites

1. **A Telegram bot** — create one with [@BotFather](https://t.me/BotFather)
   and copy the token.
2. **A private admin group** — create a Telegram group, add the bot, and
   **promote it to admin** (so it can post and read replies). A *forum*
   supergroup with one topic per house is recommended but optional.
3. **A PostgreSQL database** — a Supabase project, or any Postgres ≥ 13.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Configure `.env`

| Variable             | Required | Notes                                                       |
| -------------------- | :------: | ----------------------------------------------------------- |
| `BOT_TOKEN`          |    ✅    | From @BotFather                                             |
| `DATABASE_URL`       |    ✅    | Postgres/Supabase connection string (see below)            |
| `WEBHOOK_SECRET`     |    ✅    | Long random string (`openssl rand -hex 32`)                |
| `ADMIN_GROUP_ID`     |    ✅\*  | Negative group id. Use `/whereami` in the group to get it.  |
| `OWNER_TELEGRAM_ID`  |    ✅    | Your user id. Use `/myid` to get it.                        |
| `EMERGENCY_PHONE`    |   rec.   | Shown to guests for urgent cases                            |
| `PUBLIC_BOT_USERNAME`|   rec.   | Bot @username (no `@`), used for QR links                   |
| `DEFAULT_LANGUAGE`   |   opt.   | `ru` (default) or `en`                                      |
| `FOLLOWUP_WINDOW_MINUTES` | opt. | Grouping window for follow‑ups (default `10`)            |
| `WEBHOOK_URL`        | webhook  | Public webhook URL (for `set-webhook` script)              |
| `PORT`               |   opt.   | Port for `src/server.ts` (default `8080`)                  |

\* `ADMIN_GROUP_ID` can instead be set at runtime with the `/setgroup` command
(it is stored in the `settings` table, which takes precedence over the env var).

**Getting `DATABASE_URL` from Supabase:** Project → **Connect** →
*Connection string*. Use the **Session/Transaction pooler** URI for serverless
(Vercel); the direct `db.<ref>.supabase.co:5432` URI is fine for a VPS. Put your
database password into the URI.

### 3. Create the schema

- **Supabase**: already applied for the provisioned project (see *Provisioned
  infrastructure* below). For a new project, paste `src/db/schema.sql` into the
  SQL editor, or run `npm run migrate`.
- **Self‑hosted Postgres**: `npm run migrate`.

The schema seeds 10 houses (`h1`…`h10` / `Дом 1`…`Дом 10`) and enables Row Level
Security so the data is not reachable through the public Supabase REST API.

### 4. First‑run bot setup (inside Telegram)

1. DM the bot `/myid` → put the number in `OWNER_TELEGRAM_ID`.
2. In the admin group, send `/whereami` → put the chat id in `ADMIN_GROUP_ID`,
   **or** send `/setgroup` to store it automatically.
3. Add staff: reply to a teammate's message with `/addadmin` (owner only).

---

## Running

### Option A — Vercel (serverless webhook)

1. Push this repo to GitHub and import it in Vercel.
2. Add the environment variables above in **Project → Settings → Environment
   Variables** (the token variable must be named exactly `BOT_TOKEN`).
3. Deploy. The webhook endpoint is `https://<app>.vercel.app/api/webhook`.
4. Register it (from any machine with internet access):

   ```bash
   WEBHOOK_URL=https://<app>.vercel.app/api/webhook npm run set-webhook
   ```

### Option B — VPS (webhook server)

```bash
npm run build
node dist/server.js          # serves POST /webhook on $PORT
# put Nginx/Caddy in front for HTTPS, then:
WEBHOOK_URL=https://bot.example.com/webhook npm run set-webhook
```

### Option C — Long polling (local / simple VPS)

```bash
npm run delete-webhook       # ensure no webhook is set
npm run dev                  # or: npm run build && npm start
```

> A bot can use **either** a webhook **or** long polling, not both at once.

---

## QR codes

Set `PUBLIC_BOT_USERNAME` in `.env`, then:

```bash
npm run qr
```

This writes one PNG per house to `qr-codes/` and a `qr-codes/links.txt` with the
deep links (`https://t.me/<bot>?start=h3`). Print one per house.

Suggested sign text (Russian):

```
SPRING VILLAGE — Помощь во время проживания
Отсканируйте QR-код и напишите администрации в Telegram.
Домик: Дом 3   ·   Срочный звонок: +7 XXX XXX XX XX
```

---

## Admin workflow

1. A request card appears in the group (in the house's topic if configured).
2. Press **✅ Взять** to claim it (moves it to *in progress*).
3. **Reply** (Telegram reply) to the card and type your message — the guest
   receives it as Spring Village. You can also reply with a photo/file.
4. Press **✔️ Готово** when done (the guest gets a completion note).
5. **🚨 Срочно** escalates: the guest is shown the phone number and an urgent
   alert is posted. **📄 Инфо** shows guest/house details. **↩️ Открыть снова**
   reopens a completed request.

Unauthorized users' button presses and replies are ignored.

---

## Data model

`houses · guests · stays · requests · messages · admins · settings` (+ an
operational `sessions` table for conversation state). See `src/db/schema.sql`.
Request statuses: `new · in_progress · waiting_guest · done · urgent ·
cancelled`. BIGINT id/chat/message columns are parsed to JS numbers (Telegram
ids stay within the safe‑integer range).

---

## Scripts

| Command                 | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Long polling with auto‑reload (tsx)           |
| `npm run build`         | Compile to `dist/`                            |
| `npm start`             | Run compiled long‑polling bot                 |
| `npm run start:server`  | Run compiled webhook server                   |
| `npm run migrate`       | Apply `schema.sql` to `DATABASE_URL`          |
| `npm run qr`            | Generate per‑house QR codes                   |
| `npm run set-webhook`   | Set webhook + bot commands/description        |
| `npm run delete-webhook`| Delete webhook (switch to polling)            |
| `npm run typecheck`     | Type‑check the whole project                  |

---

## Security & privacy

- Guests are never added to the admin group; guest data is only in the bot DB.
- Only the owner and active admins can perform admin actions or route replies.
- The webhook verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header
  against `WEBHOOK_SECRET`.
- RLS is enabled on every table, so guest data is not exposed through the
  Supabase REST API. Keep `.env` and `DATABASE_URL` private (never committed).

---

## Provisioned infrastructure

A dedicated Supabase project has been created and initialized for this bot:

- **Project:** `spring-village-bot` · **Ref:** `vxzbzsvnqfoownhsmnfn`
- **Region:** `eu-central-1` (Frankfurt) · **Postgres:** 17
- Schema applied, 10 houses seeded, RLS enabled, verified empty/ready.

To get `DATABASE_URL`: Supabase dashboard → this project → **Connect** → copy the
pooler URI and insert your database password.

---

## Troubleshooting

- **Cards don't appear in the group** — ensure the bot is a group admin and
  `ADMIN_GROUP_ID` (or `/setgroup`) is correct. For forum groups, leave new
  cards in the right topic by setting each house's `topic_id`.
- **Replies don't reach the guest** — replies must be a Telegram *reply* to a
  bot message (the card or a follow‑up). The bot warns if it can't identify the
  guest.
- **Webhook returns 401** — `WEBHOOK_SECRET` in the environment must match the
  `secret_token` used by `set-webhook`.
- **`Missing required environment variable`** — copy `.env.example` to `.env`
  and fill in `BOT_TOKEN` and `DATABASE_URL`.
```
