---
name: new-entity-crud
description: End-to-end recipe for adding a new field, entity, or data-mutating feature to Stickly — Prisma schema + migration, server action, validation in src/lib, NoteDTO/board wiring, i18n error codes, and action tests. Use this whenever the user wants to store something new (e.g. "add a priority/color/tag/reminder to notes", "let users pin notes", "add a checklist entity"), add or change a server action in src/app/actions, or touch schema.prisma — even if they only describe the feature and don't mention Prisma or actions.
effort: low
---

# Adding a field / entity / mutation to Stickly

CLAUDE.md already covers the architecture. This skill is the ordered checklist plus the places that are easy to forget, most of them because a new note field has to be wired through several layers by hand.

**Start from the closest existing feature and copy its shape.** A boolean flag on a note (pinned, priority, archived…) is `isDone` all over again: the `add_note_is_done` migration, `toggleNoteDone` in `actions/notes.ts`, the DTO mappers, the done toggle in `NoteCard`, and its tests. A free-text field copies `location`/`description` through `createNote`/`updateNote`. Skip the sections below that don't apply.

## 1. Schema + migration
- Edit `prisma/schema.prisma`. For note fields, think about a `@default` so existing rows migrate cleanly, and whether the draft note (`isDraft: true`, `scheduledAt: null`) should carry the field too.
- `npx prisma migrate dev --name <snake_case_description>`, then **`npx prisma generate`**. Prisma 7's `migrate dev` no longer regenerates the client, and `postinstall` only runs on `npm install`, so without this step the types in `src/generated/prisma` are stale and type-check fails.
- Import the client from `@/lib/prisma` and types from `@/generated/prisma`, never from `@prisma/client`.

## 2. Server action (`src/app/actions/<domain>.ts`, `"use server"`)
- First line: `const userId = await requireUserId();`. Use `auth()` only if you need `session.accessToken` (Calendar), as `calendar.ts` does.
- **Scope every query by `userId`**: `findFirst({ where: { id, userId } })`, `updateMany`/`deleteMany` with `{ id, userId }`. Never read, update, or delete by `id` alone, because that lets one user touch another's note. The exception is `tx.note.update` on ids you just loaded with a `userId` filter.
- A simple single-row update (a toggle, a field edit) is just a scoped `updateMany` with no transaction and no pre-check, like `toggleNoteDone`. Reach for `findFirst` + throw `NOTE_NOT_FOUND` only when you need the row's current values.
- Sanitize string input before it hits Prisma (trim + max length). The existing note sanitizers (`sanitizeTitle`/`sanitizeLocation`/`sanitizeDescription`/`sanitizeClientId`) are private inside `actions/notes.ts`. Extend them there for simple cases. Put non-trivial new validation in `src/lib/*.ts` (as `lib/profile.ts` → `sanitizeName` does) so it can be unit-tested. Booleans and ids already covered by `sanitizeClientId` need nothing new.
- Revalidate at the end: `revalidatePath("/")`, plus `revalidatePath("/profile")` if the profile page shows the data (see `actions/profile.ts`).
- Errors are bare string codes (`throw new Error("SOME_CODE")`), only for failures the user can actually hit. Don't invent one when existing codes (`UNAUTHORIZED`, `NOTE_NOT_FOUND`) cover it. For each new code, add the key to the `errors` namespace of **both** `messages/en.json` and `messages/es.json`, since a missing key shows up as a raw code in that locale.

## 3. Concurrency / ordering (only if the feature reorders notes or has a uniqueness rule)
- Decide explicitly whether the new field affects order within a day. If it does (e.g. "priority notes first"), that means changing `sortDoneLast`/`ordering.ts` and the cross-group handling in `Board.tsx`'s `handleDragOver`/`handleDragEnd`, not just the query.
- Anything that reads positions and then writes them (`moveNote`, `scheduleDraftNote`) goes inside `prisma.$transaction`. Reassign `position` for the whole affected day via `insertAtIndex` + `sortDoneLast` (`src/lib/ordering.ts`); never use fractional positions. New notes get `max(position) + 1` in their day.
- For check-then-create that must be unique per user (the single-draft rule), take `pg_advisory_xact_lock(hashtext(userId)::bigint)` inside the transaction, as `saveDraftNote` does. Don't add a partial unique constraint to the schema.

## 4. Wiring a new note field to the board
A new column on `Note` doesn't reach the UI by itself. Update each of these:
1. `ScheduledNote` type in `src/lib/notes.ts`.
2. Both mappers there: `groupNotesByDay` (scheduled notes) and `toDraftNoteDTO` (the draft).
3. `NoteDTO` in `src/components/board/types.ts`.
4. The `lastServerNote` comparison in `NoteCard.tsx`. It decides when the server copy has changed and the optimistic copy can be dropped, so it should compare every DTO field. If a field is missing, the card can keep showing stale optimistic data. (`description` is currently missing from it, so add it if you're in there.)
5. The form (`NoteForm.tsx` / `DraftForm.tsx`) and the card display. Follow the `ui-conventions` skill for these. If the field is visible on the card, also consider the simplified card copy in `Board.tsx`'s `DragOverlay`.
6. If the field belongs on the Google Calendar event, update the event body in `actions/calendar.ts`.

## 5. Tests
- Pure logic in `src/lib` → `tests/lib/<file>.test.ts`, no mocks needed.
- Actions → `tests/actions/<domain>.test.ts`. There's no test DB: mock `@/lib/prisma`, `@/auth`, and `next/cache` with `vi.hoisted` + `vi.mock` (including `$transaction`/`$executeRaw` if used), then import the action. Copy the mock setup from `tests/actions/notes.test.ts` instead of writing it from scratch. Cover at least: the unauthorized path (`mockAuth.mockResolvedValue(null)`, since `requireUserId` calls `auth()`; assert it rejects with `UNAUTHORIZED` and that Prisma wasn't called), the `userId` scoping (assert the `where` includes `userId`), and each new error code.
- Update the mapper tests in `tests/lib/notes.test.ts` if you touched `groupNotesByDay`/`toDraftNoteDTO`.

## Before finishing
- The `Stop` hook (`.claude/hooks/verify.sh`) runs lint, type-check and tests, so there's no need to run them by hand.
- Delegate a review to the `stickly-reviewer` subagent (required after touching actions, schema, auth, ordering, or the board).
- End with an English commit message suggestion.
