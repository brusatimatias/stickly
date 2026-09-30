# stickly

A notes/reminders app organized on a whiteboard-style weekly board, with Google Calendar integration to turn any note into an event with one click.

## Features

- Login with Google (the only authentication method).
- Weekly board based on real calendar weeks, with navigation between weeks and jumping to a specific week.
- Notes as sticky notes per day and time (title, optional location, exact date/time), movable via drag & drop.
- Draft notes: up to 4 per user, with no date, used as a scratch space; they can be reordered and dragged onto a day, and the assistant creates one when asked for a draft.
- A per-note button to create a Google Calendar event, linked to the note via `googleEventId`.
- Assistant chat (floating button on the board) that works in natural language, in English or Spanish:
  - Creates notes: "remind me on Friday at 6 pm to buy my sister's gift" becomes a note with the right day, time, title and details. If no date is given, it asks for one.
  - Answers about your notes: "what's left to do this week?" lists every day with its pending notes; "what do I have today?" lists today's.
  - Usage is rate-limited per user and globally, sized for the Gemini API free tier.
- The same assistant on WhatsApp: link your number from the profile (a one-time code you send from WhatsApp) and message Stickly to create notes or ask about them, in your own language. It keeps the last half hour of conversation, so it can ask for a missing date.

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
