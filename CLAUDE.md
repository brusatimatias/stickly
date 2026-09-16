# stickly

A notes/reminders app organized on a whiteboard-style weekly board, with Google Calendar integration (see README.md for the functional and stack overview).

## Design decisions to respect

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
