import {
  MAX_DRAFT_NOTES,
  sanitizeDescription,
  sanitizeLocation,
  sanitizeTitle,
  type NoteFields,
} from "@/lib/noteInput";
import { prisma } from "@/lib/prisma";
import { queueNoteReminderAfterResponse } from "@/lib/reminders";
import type { StoredSchedule } from "@/lib/schedule";

/**
 * Creates a scheduled note at the end of its day. Shared by the board's
 * `createNote` action and the web chat's `create_note` tool, each of which
 * converts the user's local day and time into `schedule` first.
 * Kept outside `"use server"` files on purpose: it takes an already-resolved
 * `userId`, so it must never be exposed as a server action itself.
 *
 * `id` is client-generated when coming from the board (optimistic UI); tool
 * calls omit it and get a server-generated one. Tool arguments are untrusted
 * JSON, so run them through `parseNoteToolInput` before calling this.
 */
export async function createNoteForUser(
  userId: string,
  input: NoteFields & { id?: string; schedule: StoredSchedule }
): Promise<{ id: string }> {
  const id = input.id ?? crypto.randomUUID();
  const title = sanitizeTitle(input.title);

  // Which local day a TIMED note falls on depends on the viewer's zone, so
  // "last in its day" is taken as last among all the user's notes: positions
  // only need to order notes within a day, not be contiguous.
  const maxPosition = await prisma.note.aggregate({
    where: { userId, isDraft: false },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  await prisma.note.create({
    data: {
      id,
      title,
      location: sanitizeLocation(input.location),
      description: sanitizeDescription(input.description),
      kind: input.schedule.kind,
      startsAt: input.schedule.startsAt,
      position,
      userId,
    },
  });

  // Board, web chat and WhatsApp notes alike.
  if (input.schedule.kind === "TIMED") {
    queueNoteReminderAfterResponse(id);
  }

  return { id };
}

/**
 * Creates a draft note (no date) last among the user's drafts. Shared by the
 * board's `createDraftNote` action and the web chat's `create_draft_note`
 * tool; same `userId` and `id` caveats as `createNoteForUser`.
 *
 * The count-then-create runs in a transaction holding a Postgres advisory
 * lock scoped to the user, so concurrent calls (double click, two tabs, the
 * chat) can't all see room for one more and go over `MAX_DRAFT_NOTES`. The
 * limit is enforced here, not by a DB constraint (see CLAUDE.md).
 */
export async function createDraftNoteForUser(
  userId: string,
  input: NoteFields & { id?: string }
): Promise<{ id: string }> {
  const id = input.id ?? crypto.randomUUID();
  const title = sanitizeTitle(input.title);
  const location = sanitizeLocation(input.location);
  const description = sanitizeDescription(input.description);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`;

    const drafts = await tx.note.aggregate({
      where: { userId, isDraft: true },
      _count: true,
      _max: { position: true },
    });
    if (drafts._count >= MAX_DRAFT_NOTES) {
      throw new Error("DRAFT_LIMIT_REACHED");
    }

    // Drafts are ordered among themselves; scheduleDraftNote gives a draft
    // its position in the day it's dropped on.
    await tx.note.create({
      data: {
        id,
        title,
        location,
        description,
        userId,
        isDraft: true,
        position: (drafts._max.position ?? -1) + 1,
      },
    });
  });

  return { id };
}
