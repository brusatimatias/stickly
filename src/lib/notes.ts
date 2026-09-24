import { format } from "date-fns";
import { sortDoneLast } from "@/lib/ordering";
import { prisma } from "@/lib/prisma";
import type { NoteDTO } from "@/components/board/types";

/**
 * Notes scheduled within a week's [start, end) range, ordered for display
 * on the board. Uses the [userId, scheduledAt] composite index for the
 * range filter; `position` (not `scheduledAt`) drives order within a day,
 * so notes can be freely reordered regardless of whether they have a time.
 */
export function getNotesForWeek(userId: string, weekStart: Date, weekEnd: Date) {
  return prisma.note.findMany({
    where: {
      userId,
      isDraft: false,
      scheduledAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { position: "asc" },
  });
}

/** The user's single draft note (isDraft: true), if any. */
export function getDraftNote(userId: string) {
  return prisma.note.findFirst({ where: { userId, isDraft: true } });
}

type ScheduledNote = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  scheduledAt: Date | null;
  hasTime: boolean;
  isDone: boolean;
  googleEventId: string | null;
};

/**
 * Groups scheduled notes by their yyyy-MM-dd day key, seeding every day in
 * `dayKeys` (even ones with no notes). Notes without a `scheduledAt` (i.e.
 * drafts) or whose day isn't in `dayKeys` are skipped. Within a day, pending
 * notes are sorted before done ones (stable, so their relative order from
 * the query is otherwise preserved).
 */
export function groupNotesByDay(
  notes: ScheduledNote[],
  dayKeys: string[]
): Record<string, NoteDTO[]> {
  const notesByDay: Record<string, NoteDTO[]> = Object.fromEntries(
    dayKeys.map((key) => [key, []])
  );
  for (const note of notes) {
    if (!note.scheduledAt) continue;
    const key = format(note.scheduledAt, "yyyy-MM-dd");
    notesByDay[key]?.push({
      id: note.id,
      title: note.title,
      location: note.location,
      description: note.description,
      time: format(note.scheduledAt, "HH:mm"),
      hasTime: note.hasTime,
      isDone: note.isDone,
      googleEventId: note.googleEventId,
    });
  }
  for (const key of Object.keys(notesByDay)) {
    notesByDay[key] = sortDoneLast(notesByDay[key]);
  }
  return notesByDay;
}

/** Maps the draft note (if any) to its board DTO; drafts never carry a time. */
export function toDraftNoteDTO(draft: ScheduledNote | null): NoteDTO | null {
  if (!draft) return null;
  return {
    id: draft.id,
    title: draft.title,
    location: draft.location,
    description: draft.description,
    time: "",
    hasTime: draft.hasTime,
    isDone: draft.isDone,
    googleEventId: draft.googleEventId,
  };
}
