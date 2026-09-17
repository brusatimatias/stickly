"use server";

import { addDays, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { combineDayAndTime } from "@/lib/datetime";
import { insertAtIndex } from "@/lib/ordering";
import { prisma } from "@/lib/prisma";

const DEFAULT_SCHEDULE_TIME = "09:00";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function createNote(input: {
  title: string;
  location: string;
  day: string;
  time: string;
}) {
  const userId = await requireUserId();
  const scheduledAt = combineDayAndTime(input.day, input.time);
  const dayStart = startOfDay(scheduledAt);
  const dayEnd = addDays(dayStart, 1);

  const maxPosition = await prisma.note.aggregate({
    where: { userId, isDraft: false, scheduledAt: { gte: dayStart, lt: dayEnd } },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  await prisma.note.create({
    data: {
      title: input.title,
      location: input.location || null,
      scheduledAt,
      position,
      userId,
    },
  });

  revalidatePath("/");
}

export async function updateNote(input: {
  id: string;
  title: string;
  location: string;
  time: string;
}) {
  const userId = await requireUserId();
  const existing = await prisma.note.findFirst({
    where: { id: input.id, userId },
  });
  if (!existing?.scheduledAt) {
    throw new Error("Note not found");
  }

  const day = existing.scheduledAt.toISOString().slice(0, 10);
  const scheduledAt = combineDayAndTime(day, input.time);

  await prisma.note.updateMany({
    where: { id: input.id, userId },
    data: { title: input.title, location: input.location || null, scheduledAt },
  });

  revalidatePath("/");
}

export async function deleteNote(id: string) {
  const userId = await requireUserId();
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
      throw new Error("Note not found");
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

    const ordered = insertAtIndex(dayNotes, movingNote, input.index);

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
 */
export async function saveDraftNote(input: { title: string; location: string }) {
  const userId = await requireUserId();
  const existingDraft = await prisma.note.findFirst({
    where: { userId, isDraft: true },
  });

  if (existingDraft) {
    await prisma.note.update({
      where: { id: existingDraft.id },
      data: { title: input.title, location: input.location || null },
    });
  } else {
    await prisma.note.create({
      data: {
        title: input.title,
        location: input.location || null,
        userId,
        isDraft: true,
        scheduledAt: null,
      },
    });
  }

  revalidatePath("/");
}

/** Promotes the draft note to a scheduled note on the given day, at a default time. */
export async function scheduleDraftNote(input: { noteId: string; day: string; index: number }) {
  const userId = await requireUserId();
  const targetDayStart = startOfDay(combineDayAndTime(input.day, "00:00"));
  const targetDayEnd = addDays(targetDayStart, 1);

  await prisma.$transaction(async (tx) => {
    const draftNote = await tx.note.findFirst({
      where: { id: input.noteId, userId, isDraft: true },
    });
    if (!draftNote) {
      throw new Error("Draft note not found");
    }

    const dayNotes = await tx.note.findMany({
      where: { userId, isDraft: false, scheduledAt: { gte: targetDayStart, lt: targetDayEnd } },
      orderBy: { position: "asc" },
    });

    const ordered = insertAtIndex(dayNotes, draftNote, input.index);

    const scheduledAt = combineDayAndTime(input.day, DEFAULT_SCHEDULE_TIME);

    await Promise.all(
      ordered.map((note, position) =>
        tx.note.update({
          where: { id: note.id },
          data: {
            position,
            ...(note.id === input.noteId ? { isDraft: false, scheduledAt } : {}),
          },
        })
      )
    );
  });

  revalidatePath("/");
}
