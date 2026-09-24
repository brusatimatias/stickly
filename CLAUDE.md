# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# stickly

A notes/reminders app organized on a whiteboard-style weekly board, with Google Calendar integration (see README.md for the functional and stack overview).

**Next.js 16 has breaking changes vs. older versions** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code, and heed deprecation notices. `next dev` re-adds that block to `AGENTS.md` automatically.

## Commands

- `npm run dev` — start the dev server.
- `npm run build` / `npm run start` — production build / start.
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`).
- `npm run type-check` — `next typegen && tsc --noEmit`; regenerates Next's route types before checking.
- `npm test` — Vitest (jsdom environment, `tests/**/*.test.{ts,tsx}`). Run a single file with `npm test -- tests/lib/notes.test.ts`, or filter by name with `npm test -- -t "pattern"`.
- `npx prisma migrate dev` — apply/create Prisma migrations locally.
- `npx prisma generate` — regenerate the Prisma client into `src/generated/prisma` (runs automatically via `postinstall`).
- Deploy is Vercel: `vercel-build` runs `prisma migrate deploy` before `next build`. CI (`.github/workflows`) runs lint, type-check, test and build on every push/PR.
- A project `Stop` hook (`.claude/hooks/verify.sh`) runs lint + type-check + tests at the end of each turn when `src`, `tests`, `prisma`, `messages` or the tooling config changed, and feeds failures back (up to 3 attempts) — so there's no need to run those manually just before finishing.

## Architecture

- **Server actions, not API routes.** All mutations live in `src/app/actions/*.ts` (`"use server"`), called directly from client components. Every action starts by resolving the current user via `requireUserId()` (`src/lib/session.ts`), which throws `UNAUTHORIZED` if there's no session, and ends with `revalidatePath("/")`. (`calendar.ts` calls `auth()` directly instead, since it also needs the session's `accessToken`.)
  - Errors are thrown as bare string codes (`new Error("TITLE_REQUIRED")`) that the UI translates via the `errors` namespace in `messages/*.json` — when adding a new code, add the key to both `en.json` and `es.json`.
  - Pure validation/transform logic is pulled out into `src/lib/*` (e.g. `profile.ts`, `notes.ts`) so it can be unit-tested without Prisma.
  - `notes.ts`: CRUD + reordering/moving notes and the draft-note upsert (`saveDraftNote`, `scheduleDraftNote`).
  - `calendar.ts`: creates/updates/deletes the linked Google Calendar event for a note (`googleEventId`), using the session's Google `accessToken`.
  - `profile.ts`, `locale.ts`: user profile fields and the locale cookie, respectively.
- **Auth (`src/auth.ts`).** Auth.js with two providers: Google (primary, grants the Calendar scope and stores access/refresh tokens in the JWT) and Credentials (email/password against a bcrypt `password` hash on `User`; the password is set from the profile page via `setPassword` — not mentioned in the README's feature list). A Credentials session has no Google tokens, so Calendar actions fail with `MISSING_GOOGLE_TOKEN` there. The `jwt` callback is where the app's `User` row is upserted and where an expired Google access token gets silently refreshed via `refreshGoogleAccessToken`.
- **Data access.** No repository layer — server actions call `prisma` (`src/lib/prisma.ts`) directly. Multi-step mutations that touch note ordering (`moveNote`, `scheduleDraftNote`) run inside `prisma.$transaction`; `saveDraftNote` additionally takes a Postgres advisory lock (`pg_advisory_xact_lock`) keyed on `userId` to make the draft's check-then-act race-safe across concurrent calls.
- **Note ordering.** Notes within a day are ordered by an integer `position` column, manipulated via `insertAtIndex` (`src/lib/ordering.ts`) rather than fractional indexing; moving a note reassigns `position` for every note in the affected day.
- **Week/date handling.** `src/lib/week.ts` computes week ranges (Monday-start, `[start, end)`), parses/formats the `week` query param, and steps to adjacent weeks — no week number is stored, see below. `src/lib/datetime.ts` combines a day string + time string into the single `scheduledAt` used throughout.
- **Board UI (`src/components/board/`).** `Board.tsx` is the top-level client component; drag & drop between days/positions is handled with `@dnd-kit`. `useNoteEditorKeyboard.ts` centralizes the keyboard behavior (Shift+Enter to submit, etc.) shared by `NoteForm.tsx` and `DraftForm.tsx`.
- **i18n.** `next-intl`, locale resolved from a cookie (`NEXT_LOCALE`, `src/i18n/locales.ts`/`request.ts`) rather than the URL; supported locales are `en`/`es` with message catalogs in `messages/*.json`.
- **Tests.** No test database: action tests (`tests/actions/`) mock `@/lib/prisma`, `@/auth` and `next/cache` with `vi.hoisted` + `vi.mock` (including `$transaction`/`$executeRaw`), then import the action under test.
- **Prisma client.** Generated into `src/generated/prisma` (not `node_modules`), via the `prisma-client` generator and `@prisma/adapter-pg` as the driver adapter — see `prisma7.config.ts` for the config used by the CLI.

## Design decisions to respect

- After changing server actions, `schema.prisma`, `src/auth.ts`, ordering/week logic or the board, delegate a review to the `stickly-reviewer` subagent before finishing.
- `scheduledAt` is a single `DateTime` field (date + time together), not split into two fields, so the Calendar event can be built directly without combining values.
- `title` and `location` are kept separate because the Calendar API accepts `location` as its own event field.
- `scheduledAt` is nullable; the only valid case with `null` is the draft note (`isDraft: true`).
- The "single draft note per user" rule is enforced at the application level (no partial unique constraint in Prisma for this): before creating a draft note, check with `findFirst({ userId, isDraft: true })` whether one already exists and update it instead of creating a new one.
- Composite index `[userId, scheduledAt]` is meant for the most frequent query: a user's notes between the start and end of a given week.
- Week navigation is resolved via query (`scheduledAt >= weekStart AND scheduledAt < weekEnd`); no week number is persisted on the note — it's derived from the date on each query.
- `@auth/prisma-adapter` is not used: the schema has no `Account`/`Session` models. Sessions are JWT-based (`src/auth.ts`), and Google tokens (access/refresh) are stored in the JWT, not in the database. The app's own `User` record is synced (upserted) in Auth.js's `jwt` callback.
- Postgres runs on the user's local server (not Docker). The dev database is `stickly-development`, following the `<app>-development`/`<app>-test` convention used in their other projects.

## Broader plan context

This project is being developed alongside another, bigger personal project (a social network, with a Rails API, a React client, and a Node.js messaging service), also intended as a portfolio piece. stickly serves as a "quick win" block: a smaller, well-scoped project to make progress on during moments with less time or energy available.
