import { sortDoneLast } from "@/lib/ordering";
import { toLocalSchedule, type NoteKind } from "@/lib/schedule";
import type { NoteDTO, StoredNoteDTO } from "@/components/board/types";

/**
 * Converting stored notes to what the board shows. No server imports: the
 * board (a client component) groups the notes itself, in the viewer's zone.
 */

type StoredNote = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  kind: NoteKind;
  startsAt: Date | null;
  isDone: boolean;
  googleEventId: string | null;
};

/** Maps a note row to what the board receives. */
export function toStoredNoteDTO(note: StoredNote): StoredNoteDTO {
  return {
    id: note.id,
    title: note.title,
    location: note.location,
    description: note.description,
    kind: note.kind,
    startsAt: note.startsAt ? note.startsAt.toISOString() : null,
    isDone: note.isDone,
    googleEventId: note.googleEventId,
  };
}

/**
 * Groups stored notes by the day they fall on in `timeZone` (yyyy-MM-dd),
 * seeding every day in `dayKeys` (even ones with no notes). Notes without
 * `startsAt` (drafts) or whose day isn't in `dayKeys` are skipped. Within a
 * day, pending notes are sorted before done ones (stable, so their relative
 * order from the query is otherwise preserved).
 */
export function groupNotesByDay(
  notes: StoredNoteDTO[],
  dayKeys: string[],
  timeZone: string
): Record<string, NoteDTO[]> {
  const notesByDay: Record<string, NoteDTO[]> = Object.fromEntries(
    dayKeys.map((key) => [key, []])
  );
  for (const note of notes) {
    if (!note.startsAt) continue;
    const { day, time } = toLocalSchedule(new Date(note.startsAt), note.kind, timeZone);
    notesByDay[day]?.push({
      id: note.id,
      title: note.title,
      location: note.location,
      description: note.description,
      time,
      isDone: note.isDone,
      googleEventId: note.googleEventId,
    });
  }
  for (const key of Object.keys(notesByDay)) {
    notesByDay[key] = sortDoneLast(notesByDay[key]);
  }
  return notesByDay;
}

/** Maps a draft note to its board DTO; drafts never carry a time. */
export function toDraftNoteDTO(draft: StoredNoteDTO): NoteDTO {
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
