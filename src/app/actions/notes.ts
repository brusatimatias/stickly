"use server";

import { addDays, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { unsyncNoteFromGoogleCalendar } from "@/app/actions/calendar";
import { combineDayAndTime } from "@/lib/datetime";
import { createNoteForUser } from "@/lib/noteCreation";
import { sanitizeDescription, sanitizeLocation, sanitizeTitle } from "@/lib/noteInput";
import { insertAtIndex, sortDoneLast } from "@/lib/ordering";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const MAX_ID_LENGTH = 64;

function sanitizeClientId(id: string): string {
  if (!id || id.length > MAX_ID_LENGTH) {
    throw new Error("INVALID_NOTE_ID");
  }
  return id;
}

export async function createNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
  day: string;
  time: string;
}) {
  const userId = await requireUserId();
  await createNoteForUser(userId, { ...input, id: sanitizeClientId(input.id) });

  revalidatePath("/");
}

export async function updateNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
  time: string;
}) {
  const userId = await requireUserId();
  const existing = await prisma.note.findFirst({
    where: { id: input.id, userId },
  });
  if (!existing?.scheduledAt) {
    throw new Error("NOTE_NOT_FOUND");
  }

  const title = sanitizeTitle(input.title);
  const location = sanitizeLocation(input.location);
  const description = sanitizeDescription(input.description);
  const hasTime = input.time !== "";
  const day = existing.scheduledAt.toISOString().slice(0, 10);
  const scheduledAt = combineDayAndTime(day, hasTime ? input.time : "00:00");

  const clearingTime = existing.hasTime && !hasTime && existing.googleEventId;
  if (clearingTime) {
    await unsyncNoteFromGoogleCalendar(existing.googleEventId!);
  }

  await prisma.note.updateMany({
    where: { id: input.id, userId },
    data: {
      title,
      location,
      description,
      scheduledAt,
      hasTime,
      ...(clearingTime ? { googleEventId: null } : {}),
    },
  });

  revalidatePath("/");
}

export async function toggleNoteDone(id: string, isDone: boolean) {
  const userId = await requireUserId();
  await prisma.note.updateMany({ where: { id, userId }, data: { isDone } });
  revalidatePath("/");
}

export async function deleteNote(id: string) {
  const userId = await requireUserId();
  const existing = await prisma.note.findFirst({ where: { id, userId } });
  if (existing?.googleEventId) {
    await unsyncNoteFromGoogleCalendar(existing.googleEventId);
  }
  await prisma.note.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function moveNote(input: { noteId: string; day: string; index: number }) {
  const userId = await requireUserId();
  const targetDayStart = startOfDay(combineDayAndTime(input.day, "00:00"));
  const targetDayEnd = addDays(targetDayStart, 1);

  await prisma.$transaction(async (tx) => {
    const movingNote = await tx.note.findFirst({
      where: { id: input.noteId, userId },
    });
    if (!movingNote) {
      throw new Error("NOTE_NOT_FOUND");
    }

    const dayNotes = await tx.note.findMany({
      where: {
        userId,
        isDraft: false,
        scheduledAt: { gte: targetDayStart, lt: targetDayEnd },
        id: { not: input.noteId },
      },
      orderBy: { position: "asc" },
    });

    const ordered = insertAtIndex(sortDoneLast(dayNotes), movingNote, input.index);

    const previousTime = movingNote.scheduledAt ?? targetDayStart;
    const newScheduledAt = new Date(targetDayStart);
    newScheduledAt.setHours(previousTime.getHours(), previousTime.getMinutes(), 0, 0);

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({
          where: { id: note.id },
          data: {
            position,
            ...(note.id === input.noteId ? { scheduledAt: newScheduledAt } : {}),
          },
        })
      )
    );
  });

  revalidatePath("/");
}

/**
 * Upserts the single draft note for the current user, per the
 * application-level "one draft per user" rule (see CLAUDE.md).
 *
 * The check-then-act (findFirst, then create/update) is wrapped in a
 * transaction holding a Postgres advisory lock scoped to the user, so two
 * concurrent calls (double click, two tabs) can't both see "no draft yet"
 * and create duplicates. This is app-level serialization, not a DB
 * constraint, matching the documented decision in CLAUDE.md.
 */
export async function saveDraftNote(input: {
  title: string;
  location: string;
  description: string;
}) {
  const userId = await requireUserId();
  const title = sanitizeTitle(input.title);
  const location = sanitizeLocation(input.location);
  const description = sanitizeDescription(input.description);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`;

    const existingDraft = await tx.note.findFirst({
      where: { userId, isDraft: true },
    });

    if (existingDraft) {
      await tx.note.update({
        where: { id: existingDraft.id },
        data: { title, location, description },
      });
    } else {
      await tx.note.create({
        data: {
          title,
          location,
          description,
          userId,
          isDraft: true,
          scheduledAt: null,
        },
      });
    }
  });

  revalidatePath("/");
}

/** Promotes the draft note to a scheduled note on the given day, with no time set. */
export async function scheduleDraftNote(input: { noteId: string; day: string; index: number }) {
  const userId = await requireUserId();
  const targetDayStart = startOfDay(combineDayAndTime(input.day, "00:00"));
  const targetDayEnd = addDays(targetDayStart, 1);

  await prisma.$transaction(async (tx) => {
    const draftNote = await tx.note.findFirst({
      where: { id: input.noteId, userId, isDraft: true },
    });
    if (!draftNote) {
      throw new Error("DRAFT_NOTE_NOT_FOUND");
    }

    const dayNotes = await tx.note.findMany({
      where: { userId, isDraft: false, scheduledAt: { gte: targetDayStart, lt: targetDayEnd } },
      orderBy: { position: "asc" },
    });

    const ordered = insertAtIndex(sortDoneLast(dayNotes), draftNote, input.index);

    const scheduledAt = combineDayAndTime(input.day, "00:00");

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({
          where: { id: note.id },
          data: {
            position,
            ...(note.id === input.noteId
              ? { isDraft: false, scheduledAt, hasTime: false }
              : {}),
          },
        })
      )
    );
  });

  revalidatePath("/");
}
