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

## Stack

- Next.js (App Router) + TypeScript
- Auth.js (Google and email/password providers, JWT sessions; Google tokens stored encrypted in the database)
- PostgreSQL + Prisma (driver adapter `@prisma/adapter-pg`)
- dnd-kit for drag & drop
- `googleapis` for the Calendar integration
- Vercel AI SDK (`ai` + `@ai-sdk/google`) with Gemini for the assistant chat
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

3. Apply Prisma migrations:

   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Data model

See `prisma/schema.prisma`. Notable decisions:

- A note's schedule is `startsAt` plus a `kind`. A note with a time (`TIMED`) is an instant stored in UTC and shown in the time zone you're in: 10:00 written in Buenos Aires shows 09:00 in Miami. A note without a time (`ALL_DAY`) is a calendar day and stays on that day everywhere. The time zone is the one the browser reports, stored in `User.timeZone`.
- `startsAt` is nullable; the only valid case with `null` is a draft note (`isDraft: true`).
- The "at most 4 draft notes per user" rule is enforced at the application level, not in the schema.
- Composite index `[userId, startsAt]` for the weekly-notes query.
- `WebChatUsage` stores one row per chat message (user and timestamp only, never the message text) to enforce the chat's rate limits. Conversations are not persisted: the history lives in the browser and is lost on reload.
