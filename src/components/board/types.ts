export type NoteDTO = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  time: string | null; // HH:mm; null when the note has no time
  isDone: boolean;
  googleEventId: string | null;
};

export type BoardDay = {
  key: string; // yyyy-MM-dd
  label: string;
};
