"use server";

import { revalidatePath } from "next/cache";
import { unsyncNoteFromGoogleCalendar } from "@/app/actions/calendar";
import { dayToDate, nextDay } from "@/lib/datetime";
import { createDraftNoteForUser, createNoteForUser } from "@/lib/noteCreation";
import {
  sanitizeDay,
  sanitizeDescription,
  sanitizeLocation,
  sanitizeTitle,
} from "@/lib/noteInput";
import { insertAtIndex, sortDoneLast } from "@/lib/ordering";
import { prisma } from "@/lib/prisma";
import { localDaysFilter, parseScheduleInput, type ScheduleInput } from "@/lib/schedule";
import { requireUserId } from "@/lib/session";
import { getTimeZoneForUser } from "@/lib/userTimeZone";

const MAX_ID_LENGTH = 64;

function sanitizeClientId(id: string): string {
  if (!id || id.length > MAX_ID_LENGTH) {
    throw new Error("INVALID_NOTE_ID");
  }
  return id;
}

/*
 * The board converts what the user types into a stored schedule (UTC, see
 * src/lib/schedule.ts) before calling these, so they receive `schedule`
 * rather than a local day and time. `day` (local, yyyy-MM-dd) is only used to
 * find the notes that share the destination column when reordering.
 */

export async function createNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
  schedule: ScheduleInput;
}) {
  const userId = await requireUserId();
  await createNoteForUser(userId, {
    ...input,
    id: sanitizeClientId(input.id),
    schedule: parseScheduleInput(input.schedule),
  });

  revalidatePath("/");
}

export async function updateNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
  schedule: ScheduleInput;
}) {
  const userId = await requireUserId();
  const existing = await prisma.note.findFirst({
    where: { id: input.id, userId },
  });
  if (!existing?.startsAt) {
    throw new Error("NOTE_NOT_FOUND");
  }

  const title = sanitizeTitle(input.title);
  const location = sanitizeLocation(input.location);
  const description = sanitizeDescription(input.description);
  const { kind, startsAt } = parseScheduleInput(input.schedule);

  const clearingTime = existing.kind === "TIMED" && kind === "ALL_DAY" && existing.googleEventId;
  if (clearingTime) {
    await unsyncNoteFromGoogleCalendar(existing.googleEventId!);
  }

  await prisma.note.updateMany({
    where: { id: input.id, userId },
    data: {
      title,
      location,
      description,
      kind,
      startsAt,
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

/**
 * Moves a note to position `index` of the local day `day`. `schedule` is the
 * note's new stored schedule, computed by the board: the same local time on
 * the new day for a TIMED note, the new day for an ALL_DAY one.
 */
export async function moveNote(input: {
  noteId: string;
  day: string;
  index: number;
  schedule: ScheduleInput;
}) {
  const userId = await requireUserId();
  const day = sanitizeDay(input.day);
  const { kind, startsAt } = parseScheduleInput(input.schedule);
  const dayFilter = localDaysFilter(day, nextDay(day), await getTimeZoneForUser(userId));

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
        OR: dayFilter,
        id: { not: input.noteId },
      },
      orderBy: { position: "asc" },
    });

    const ordered = insertAtIndex(sortDoneLast(dayNotes), movingNote, input.index);

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({
          where: { id: note.id },
          data: {
            position,
            ...(note.id === input.noteId ? { kind, startsAt } : {}),
          },
        })
      )
    );
  });

  revalidatePath("/");
}

/** Creates a draft note, up to `MAX_DRAFT_NOTES` per user (see `createDraftNoteForUser`). */
export async function createDraftNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
}) {
  const userId = await requireUserId();
  await createDraftNoteForUser(userId, { ...input, id: sanitizeClientId(input.id) });

  revalidatePath("/");
}

export async function updateDraftNote(input: {
  id: string;
  title: string;
  location: string;
  description: string;
}) {
  const userId = await requireUserId();
  await prisma.note.updateMany({
    where: { id: input.id, userId, isDraft: true },
    data: {
      title: sanitizeTitle(input.title),
      location: sanitizeLocation(input.location),
      description: sanitizeDescription(input.description),
    },
  });

  revalidatePath("/");
}

/** Moves a draft note to position `index` among the user's drafts. */
export async function moveDraftNote(input: { noteId: string; index: number }) {
  const userId = await requireUserId();

  await prisma.$transaction(async (tx) => {
    const drafts = await tx.note.findMany({
      where: { userId, isDraft: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const movingNote = drafts.find((note) => note.id === input.noteId);
    if (!movingNote) {
      throw new Error("DRAFT_NOTE_NOT_FOUND");
    }

    const ordered = insertAtIndex(
      drafts.filter((note) => note.id !== input.noteId),
      movingNote,
      input.index
    );

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({ where: { id: note.id }, data: { position } })
      )
    );
  });

  revalidatePath("/");
}

/** Promotes a draft note to a scheduled note on the given local day, with no time set. */
export async function scheduleDraftNote(input: { noteId: string; day: string; index: number }) {
  const userId = await requireUserId();
  const day = sanitizeDay(input.day);
  // An ALL_DAY note is stored as its day, so there's nothing to convert.
  const startsAt = dayToDate(day);
  const dayFilter = localDaysFilter(day, nextDay(day), await getTimeZoneForUser(userId));

  await prisma.$transaction(async (tx) => {
    const draftNote = await tx.note.findFirst({
      where: { id: input.noteId, userId, isDraft: true },
    });
    if (!draftNote) {
      throw new Error("DRAFT_NOTE_NOT_FOUND");
    }

    const dayNotes = await tx.note.findMany({
      where: { userId, isDraft: false, OR: dayFilter },
      orderBy: { position: "asc" },
    });

    const ordered = insertAtIndex(sortDoneLast(dayNotes), draftNote, input.index);

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({
          where: { id: note.id },
          data: {
            position,
            ...(note.id === input.noteId
              ? { isDraft: false, kind: "ALL_DAY" as const, startsAt }
              : {}),
          },
        })
      )
    );
  });

  revalidatePath("/");
}
