# stickly

A notes/reminders app organized on a whiteboard-style weekly board, with Google Calendar integration to turn any note into an event with one click.

## Features

- Login with Google (the only authentication method).
- Weekly board based on real calendar weeks, with navigation between weeks and jumping to a specific week.
- Notes as sticky notes per day and time (title, optional location, exact date/time), movable via drag & drop.
- Draft note: a single note per user, with no date, used as a scratch space.
- A per-note button to create a Google Calendar event, linked to the note via `googleEventId`.

## Stack

- Next.js (App Router) + TypeScript
- Auth.js (Google provider, JWT sessions)
- PostgreSQL + Prisma (driver adapter `@prisma/adapter-pg`)
- dnd-kit for drag & drop
- `googleapis` for the Calendar integration
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

- `scheduledAt` is a single `DateTime` (date + time together) so the Calendar event can be built directly without combining fields.
- `scheduledAt` is nullable; the only valid case with `null` is the draft note (`isDraft: true`).
- The "single draft note per user" rule is enforced at the application level, not in the schema.
- Composite index `[userId, scheduledAt]` for the weekly-notes query.
