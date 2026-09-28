import type { NoteKind } from "@/lib/schedule";

/** A note as the board shows it: day and time already in the viewer's zone. */
export type NoteDTO = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  time: string | null; // HH:mm in the viewer's zone; null when the note has no time
  isDone: boolean;
  googleEventId: string | null;
};

/** A note as stored (UTC schedule), sent to the board, which converts it. */
export type StoredNoteDTO = Omit<NoteDTO, "time"> & {
  kind: NoteKind;
  startsAt: string | null; // ISO instant; null only for the draft
};

export type BoardDay = {
  key: string; // yyyy-MM-dd
  label: string;
};
