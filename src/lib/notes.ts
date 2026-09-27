import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import { dateToDay, dayToDate } from "@/lib/datetime";
import type { ListNotesInput } from "@/lib/noteInput";
import { sortDoneLast } from "@/lib/ordering";
import { prisma } from "@/lib/prisma";
import type { NoteDTO } from "@/components/board/types";

/**
 * Scheduled notes whose day falls in [fromDay, toDay) (yyyy-MM-dd, `toDay`
 * exclusive), ordered for display on the board. Uses the [userId, date]
 * composite index for the range filter; `position` (not `time`) drives
 * order within a day, so notes can be freely reordered.
 */
export function getNotesForDays(userId: string, fromDay: string, toDay: string) {
  return prisma.note.findMany({
    where: {
      userId,
      isDraft: false,
      date: { gte: dayToDate(fromDay), lt: dayToDate(toDay) },
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
  date: Date | null;
  time: string | null;
  isDone: boolean;
  googleEventId: string | null;
};

/**
 * Groups scheduled notes by their yyyy-MM-dd day key, seeding every day in
 * `dayKeys` (even ones with no notes). Notes without a `date` (i.e.
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
    if (!note.date) continue;
    const key = dateToDay(note.date);
    notesByDay[key]?.push({
      id: note.id,
      title: note.title,
      location: note.location,
      description: note.description,
      time: note.time,
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
    time: null,
    isDone: draft.isDone,
    googleEventId: draft.googleEventId,
  };
}

/**
 * The user's scheduled notes between two days (inclusive) for the chat's
 * `list_notes` tool. Every day in the range is returned, even empty ones, so
 * the model can say "nothing on Tuesday" without inferring missing days.
 * Within a day, notes keep the board order (pending before done).
 */
export async function listNotesForUser(userId: string, input: ListNotesInput) {
  const dayKeys = eachDayOfInterval({ start: parseISO(input.from), end: parseISO(input.to) }).map(
    (day) => format(day, "yyyy-MM-dd")
  );
  const dayAfter = format(addDays(parseISO(input.to), 1), "yyyy-MM-dd");

  const notes = await getNotesForDays(userId, input.from, dayAfter);
  const matching = notes.filter(
    (note) => input.status === "all" || note.isDone === (input.status === "done")
  );
  const notesByDay = groupNotesByDay(matching, dayKeys);

  return {
    days: dayKeys.map((day) => ({
      day,
      weekday: format(parseISO(day), "EEEE"),
      notes: notesByDay[day].map((note) => ({
        time: note.time,
        title: note.title,
        location: note.location,
        description: note.description,
        isDone: note.isDone,
      })),
    })),
  };
}
