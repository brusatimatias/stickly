"use server";

import { addDays, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { combineDayAndTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

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

  const position = await prisma.note.count({
    where: { userId, isDraft: false, scheduledAt: { gte: dayStart, lt: dayEnd } },
  });

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

    const insertAt = Math.min(Math.max(input.index, 0), dayNotes.length);
    const ordered = [...dayNotes];
    ordered.splice(insertAt, 0, movingNote);

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
