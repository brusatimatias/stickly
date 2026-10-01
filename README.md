# stickly

A notes/reminders app organized on a whiteboard-style weekly board, with Google Calendar integration to turn any note into an event with one click.

## Features

- Login with Google, or with email and password (the password is set from the profile).
- Forgotten password: users who also sign in with Google can reset it from the profile ("Forgot it?"), by signing in with Google again instead of typing the current password.
- Weekly board based on real calendar weeks, with navigation between weeks and jumping to a specific week.
- Notes as sticky notes per day and time (title, optional location, exact date/time), movable via drag & drop.
- Draft notes: up to 4 per user, with no date, used as a scratch space; they can be reordered and dragged onto a day, and the assistant creates one when asked for a draft.
- A per-note button to create a Google Calendar event, linked to the note via `googleEventId`. Editing or moving a synced note updates its event.
- Assistant chat (floating button on the board) that works in natural language, in English or Spanish:
  - Creates notes: "remind me on Friday at 6 pm to buy my sister's gift" becomes a note with the right day, time, title and details. If no date is given, it asks for one.
  - Answers about your notes: "what's left to do this week?" lists every day with its pending notes; "what do I have today?" lists today's.
  - Usage is rate-limited per user and globally, sized for the Gemini API free tier.
- The same assistant on WhatsApp: link your number from the profile (a one-time code you send from WhatsApp) and message Stickly to create notes or ask about them, in your own language. It keeps the last half hour of conversation, so it can ask for a missing date.

## Architecture

![stickly architecture: the board client, the Next.js server with its server actions, Auth.js, WhatsApp webhook and chat core, PostgreSQL, Google OAuth/Calendar, Gemini and Meta's WhatsApp Cloud API](docs/architecture.svg)

## Stack

- Next.js (App Router) + TypeScript
- Auth.js (Google and email/password providers, JWT sessions; Google tokens stored encrypted in the database)
- PostgreSQL + Prisma (driver adapter `@prisma/adapter-pg`)
- dnd-kit for drag & drop
- `googleapis` for the Calendar integration
- Vercel AI SDK (`ai` + `@ai-sdk/google`) with Gemini for the assistant chat
- WhatsApp Cloud API (Meta) for the WhatsApp assistant
- Vercel for deployment

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: connection string to your local Postgres.
   - `AUTH_SECRET`: generate with `openssl rand -base64 32`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials from Google Cloud Console, with the Calendar API enabled and the `https://www.googleapis.com/auth/calendar.events` scope.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: encrypts the Google tokens stored in the database. Keep it safe: if it's lost or changed, every user has to sign in with Google again to reconnect Calendar.
   - `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key for the assistant chat, from [Google AI Studio](https://aistudio.google.com/apikey). Create it in a Google Cloud project **without a billing account**, so the free tier quota is a hard cap (requests over it fail with 429, nothing is charged).
   - `CHAT_MODEL` (optional): Gemini model id for the chat. Defaults to `gemini-3.5-flash-lite`.
   - `CHAT_FALLBACK_MODEL` (optional): Gemini model id to retry with once when the main model answers 503 ("high demand").
   - WhatsApp (optional; without `WHATSAPP_DISPLAY_NUMBER` the profile hides it), see [WhatsApp setup](#whatsapp-setup):
     - `WHATSAPP_ACCESS_TOKEN`: a System User token with `whatsapp_business_messaging` and `whatsapp_business_management` (the one on the app's "API Setup" page expires in 24 hours).
     - `WHATSAPP_PHONE_NUMBER_ID`: the sending number's id, from "API Setup".
     - `WHATSAPP_DISPLAY_NUMBER`: that number as users see it, digits only (e.g. `15551234567`).
     - `WHATSAPP_APP_SECRET`: App settings > Basic > App secret; verifies that webhook calls come from Meta.
     - `WHATSAPP_VERIFY_TOKEN`: any random string (`openssl rand -hex 32`), also entered in Meta's webhook setup.

3. Apply Prisma migrations:

   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. Optionally, load demo data:

   ```bash
   npm run db:seed
   ```

   It (re)creates two users with notes in the current week. They sign in with email and password only: `ana@stickly.test` and `bruno@stickly.test`, both with `stickly-demo-123`.

### Other commands

- `npm test`: unit and component tests (Vitest). Run a single file with `npm test -- tests/lib/notes.test.ts`.
- `npm run lint`: ESLint.
- `npm run type-check`: regenerates Next's route types, then runs `tsc --noEmit`.
- `npm run build` / `npm run start`: production build and server.

## Deployment and CI

- The app is deployed on Vercel. Its build command, `npm run vercel-build`, applies pending migrations (`prisma migrate deploy`) before `next build`, so a deploy never runs against an outdated schema.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, tests and a production build on every push and pull request.

## WhatsApp setup

1. In [Meta for Developers](https://developers.facebook.com/), create an app with the WhatsApp product. It comes with a test number that can message up to 5 verified recipients; add yours.
2. In your business portfolio's settings, create a System User, assign it the app and the WhatsApp account, and generate a token that never expires with the two permissions above.
3. Fill in the `WHATSAPP_*` variables. Reset the app secret *before* generating the token: resetting it invalidates existing tokens.
4. Deploy (or, locally, expose `npm run dev` with a tunnel such as `ngrok http 3000`), then in the app's WhatsApp > Configuration set the callback URL to `https://<host>/api/whatsapp` with your verify token, and subscribe to the `messages` field.
5. Subscribe the app to the WhatsApp Business Account, or messages won't reach the webhook:

   ```bash
   curl -X POST -H "Authorization: Bearer <access token>" \
     https://graph.facebook.com/v23.0/<WhatsApp Business Account id>/subscribed_apps
   ```

6. On your profile, generate a code and send it to the number.

## Data model

See `prisma/schema.prisma`. Notable decisions:

- A note's schedule is `startsAt` plus a `kind`. A note with a time (`TIMED`) is an instant stored in UTC and shown in the time zone you're in: 10:00 written in Buenos Aires shows 09:00 in Miami. A note without a time (`ALL_DAY`) is a calendar day and stays on that day everywhere. The time zone is the one the browser reports, stored in `User.timeZone`.
- `startsAt` is nullable; the only valid case with `null` is a draft note (`isDraft: true`).
- The "at most 4 draft notes per user" rule is enforced at the application level, not in the schema.
- Composite index `[userId, startsAt]` for the weekly-notes query.
- `WebChatUsage` stores one row per chat message, from the board or WhatsApp (user and timestamp only, never the message text), to enforce the chat's rate limits. Board conversations are not persisted: the history lives in the browser and is lost on reload.
- WhatsApp conversations are kept for half an hour (`WhatsAppMessage`) and deleted after that or when the number is unlinked. `WhatsAppLinkCode` stores a keyed hash of the pending link code, never the code, and `WhatsAppInboundMessage` keeps received message ids for a day so a message delivered twice is handled once.

## Security

- Google tokens are stored encrypted (AES-256-GCM) on `User`, never in the session. The JWT only carries the user id, and `/api/auth/session` strips server-only fields before they reach the browser.
- Every page gets a nonce-based Content Security Policy (`src/proxy.ts`), plus HSTS, `X-Frame-Options` and related headers (`next.config.ts`).
- Passwords are hashed with bcrypt. Login normalizes emails and compares against a dummy hash when the account doesn't exist, so response times don't reveal which emails are registered. Changing a password requires the current one (or a Google sign in from the last 10 minutes).
- The WhatsApp webhook rejects any request whose `X-Hub-Signature-256` doesn't match the raw body. Link codes are stored as a keyed hash, work once, and attempts are limited per number.
- Every server action checks the session first, and every query is scoped to that user.
- The assistant's tool arguments are treated as untrusted input and validated on the server, and chat usage is rate-limited per user and globally.

## Testing

- Vitest with jsdom. `tests/lib` covers the pure logic (scheduling, ordering, weeks, input parsing), `tests/actions` the server actions, `tests/components` the UI, rendered with the Spanish message catalog.
- There's no test database: action tests mock Prisma, Auth.js and `next/cache`, and assert on the queries each action makes.
- The chat tests run the real AI SDK tool loop against a mock language model, so tool calls, validation errors and the 503 fallback are exercised end to end without calling Gemini.
- Tests run in the `Pacific/Kiritimati` time zone (UTC+14), far from both UTC (Vercel) and Argentina (local dev), so any code that silently depends on the server's time zone fails in CI instead of in production.
