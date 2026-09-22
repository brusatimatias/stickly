export type NoteDTO = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  time: string; // HH:mm
  hasTime: boolean;
  googleEventId: string | null;
};

export type BoardDay = {
  key: string; // yyyy-MM-dd
  label: string;
};
