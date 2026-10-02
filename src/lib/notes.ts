import { eachDayOfInterval, format, parseISO } from "date-fns";
import { nextDay } from "@/lib/datetime";
import type { ListNotesInput } from "@/lib/noteInput";
import { groupNotesByDay, toStoredNoteDTO } from "@/lib/noteGroups";
import { prisma } from "@/lib/prisma";
import { localDaysFilter } from "@/lib/schedule";

/**
 * Scheduled notes that fall on the local days [fromDay, toDay) (yyyy-MM-dd,
 * `toDay` exclusive) in `timeZone`, ordered for display on the board. Uses
 * the [userId, startsAt] composite index; `position` (not the time) drives
 * order within a day, so notes can be freely reordered.
 */
export function getNotesForDays(userId: string, fromDay: string, toDay: string, timeZone: string) {
  return prisma.note.findMany({
    where: { userId, isDraft: false, OR: localDaysFilter(fromDay, toDay, timeZone) },
    orderBy: { position: "asc" },
  });
}

/** The user's draft notes (isDraft: true, no date), in their panel order. */
export function getDraftNotes(userId: string) {
  return prisma.note.findMany({
    where: { userId, isDraft: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * The user's scheduled notes between two days (inclusive) for the chat's
 * `list_notes` tool. Every day in the range is returned, even empty ones, so
 * the model can say "nothing on Tuesday" without inferring missing days.
 * Days and times are the user's local ones (`timeZone`). Within a day, notes keep the board order (pending before done).
 */
export async function listNotesForUser(userId: string, input: ListNotesInput, timeZone: string) {
  const dayKeys = eachDayOfInterval({ start: parseISO(input.from), end: parseISO(input.to) }).map(
    (day) => format(day, "yyyy-MM-dd")
  );

  const notes = await getNotesForDays(userId, input.from, nextDay(input.to), timeZone);
  const matching = notes.filter(
    (note) => input.status === "all" || note.isDone === (input.status === "done")
  );
  const notesByDay = groupNotesByDay(matching.map(toStoredNoteDTO), dayKeys, timeZone);

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
